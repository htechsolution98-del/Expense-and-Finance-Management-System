import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/apiResponse';
import { BadRequestError, NotFoundError } from '../utils/errors';

const getTransactionsSchema = z.object({
  accountId: z.string().optional(),
  type: z.string().optional(),
  category: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  clientId: z.string().optional(),
  vendorId: z.string().optional(),
  employeeId: z.string().optional(),
  loanId: z.string().optional(),
  page: z.string().default('1').transform(Number),
  limit: z.string().default('20').transform(Number),
});

const reverseSchema = z.object({
  purpose: z.string().min(5),
});

export const getTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const {
      accountId,
      type,
      category,
      startDate,
      endDate,
      clientId,
      vendorId,
      employeeId,
      loanId,
      page,
      limit,
    } = getTransactionsSchema.parse(req.query);

    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      companyId,
      ...(accountId && { accountId }),
      ...(type && { type }),
      ...(category && { category }),
      ...(clientId && { clientId }),
      ...(vendorId && { vendorId }),
      ...(employeeId && { employeeId }),
      ...(loanId && { loanId }),
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          account: {
            select: { name: true, type: true, currentBalance: true },
          },
          client: { select: { name: true } },
          vendor: { select: { name: true } },
          employee: { select: { name: true } },
          loan: { select: { loanNo: true, lender: true } },
          vouchers: { select: { voucherNo: true, filePath: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    const formatted = transactions.map((t) => ({
      id: t.id,
      transactionNo: t.transactionNo,
      type: t.type,
      category: t.category,
      date: t.date,
      amount: t.amount,
      accountId: t.accountId,
      accountName: t.account.name,
      accountBalance: (t as any).runningBalance,
      purpose: t.purpose,
      paymentMode: t.paymentMode,
      referenceNo: t.referenceNo,
      transferGroupId: t.transferGroupId,
      reversalOfId: t.reversalOfId,
      createdBy: t.createdBy,
      voucherNo: t.vouchers[0]?.voucherNo || null,
      filePath: t.vouchers[0]?.filePath || null,
      expenseId: t.expenseId,
      payrollItemId: t.payrollItemId,
      partyName:
        t.client?.name ||
        t.vendor?.name ||
        t.employee?.name ||
        (t.loan ? `${t.loan.lender} (${t.loan.loanNo})` : null) ||
        'Other Party',
    }));

    res.status(200).json({
      success: true,
      message: 'Transactions retrieved successfully',
      data: formatted,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const reverseTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.companyId!;
    const { purpose } = reverseSchema.parse(req.body);

    const transaction = await prisma.transaction.findFirst({
      where: { id, companyId },
      include: {
        reversedBy: true,
        account: true,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    if (transaction.type === 'REVERSAL' || transaction.reversalOfId) {
      throw new BadRequestError('Cannot reverse a reversal transaction');
    }

    if (transaction.reversedBy) {
      throw new BadRequestError('This transaction has already been reversed');
    }

    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.account.findUniqueOrThrow({
        where: { id: transaction.accountId },
      });

      // Assert balance adjustments
      let isIncrement = false;
      if (transaction.type === 'PAYMENT_IN' || transaction.type === 'TRANSFER_IN') {
        // We are reversing a deposit -> we must subtract funds
        if (account.currentBalance < transaction.amount) {
          throw new BadRequestError('Insufficient balance to execute reversal');
        }
        isIncrement = false;
      } else if (transaction.type === 'PAYMENT_OUT' || transaction.type === 'TRANSFER_OUT') {
        // We are reversing an outflow -> we must restore funds
        isIncrement = true;
      }

      // Update balance
      const updatedAccount = await tx.account.update({
        where: { id: account.id },
        data: {
          currentBalance: isIncrement
            ? { increment: transaction.amount }
            : { decrement: transaction.amount },
        },
      });

      // Create counter-ledger entry
      const reversalNo = `REV-${Date.now()}`;
      const revTrx = await tx.transaction.create({
        data: {
          companyId,
          transactionNo: reversalNo,
          type: 'REVERSAL',
          category: transaction.category,
          date: new Date(),
          amount: transaction.amount,
          runningBalance: updatedAccount.currentBalance,
          accountId: transaction.accountId,
          purpose: `REVERSAL OF ${transaction.transactionNo}: ${purpose}`,
          paymentMode: transaction.paymentMode,
          referenceNo: transaction.referenceNo,
          reversalOfId: transaction.id,
          createdBy: req.user!.id,
          clientId: transaction.clientId,
          vendorId: transaction.vendorId,
          employeeId: transaction.employeeId,
          loanId: transaction.loanId,
        },
      });

      // Generate reversal voucher
      const voucherNo = `VCH-REV-${Date.now()}`;
      await tx.voucher.create({
        data: {
          companyId,
          voucherNo,
          transactionId: revTrx.id,
        },
      });

      // Write audit log
      await tx.auditLog.create({
        data: {
          companyId,
          userId: req.user!.id,
          module: 'FINANCE_LEDGER',
          recordId: revTrx.id,
          action: 'TRANSACTION_REVERSAL',
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          newData: JSON.stringify({ originalNo: transaction.transactionNo, reversalNo }),
        },
      });

      return revTrx;
    });

    sendSuccess(res, 'Transaction reversed successfully', result);
  } catch (err) {
    next(err);
  }
};
