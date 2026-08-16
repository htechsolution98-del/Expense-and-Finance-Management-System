import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/apiResponse';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';

const paymentInSchema = z.object({
  accountId: z.string(),
  amount: z.number().positive(),
  category: z.string(),
  purpose: z.string().min(3),
  paymentMode: z.enum([
    'CASH',
    'BANK_TRANSFER',
    'UPI',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'CHEQUE',
    'OTHER',
  ]),
  referenceNo: z.string().optional().or(z.literal('')),
  clientId: z.string().optional().or(z.literal('')),
  vendorId: z.string().optional().or(z.literal('')),
  employeeId: z.string().optional().or(z.literal('')),
  loanId: z.string().optional().or(z.literal('')),
});

const paymentOutSchema = z.object({
  accountId: z.string(),
  amount: z.coerce.number().positive(),
  category: z.string(),
  purpose: z.string().min(3),
  paymentMode: z.enum([
    'CASH',
    'BANK_TRANSFER',
    'UPI',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'CHEQUE',
    'OTHER',
  ]),
  referenceNo: z.string().optional().or(z.literal('')),
  clientId: z.string().optional().or(z.literal('')),
  vendorId: z.string().optional().or(z.literal('')),
  employeeId: z.string().optional().or(z.literal('')),
  loanId: z.string().optional().or(z.literal('')),
});

// Helper to check target party validation
async function validateParties(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  companyId: string,
  parties: { clientId?: string; vendorId?: string; employeeId?: string; loanId?: string }
) {
  if (parties.clientId) {
    const c = await tx.client.findFirst({ where: { id: parties.clientId, companyId } });
    if (!c) throw new BadRequestError('Invalid Client ID');
  }
  if (parties.vendorId) {
    const v = await tx.vendor.findFirst({ where: { id: parties.vendorId, companyId } });
    if (!v) throw new BadRequestError('Invalid Vendor ID');
  }
  if (parties.employeeId) {
    const e = await tx.employee.findFirst({ where: { id: parties.employeeId, companyId } });
    if (!e) throw new BadRequestError('Invalid Employee ID');
  }
  if (parties.loanId) {
    const l = await tx.loan.findFirst({ where: { id: parties.loanId, companyId } });
    if (!l) throw new BadRequestError('Invalid Loan ID');
  }
}

export const createPaymentIn = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const body = paymentInSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify account exists and is ACTIVE
      const account = await tx.account.findFirst({
        where: { id: body.accountId, companyId, deletedAt: null },
      });

      if (!account) {
        throw new NotFoundError('Selected bank/cash account not found');
      }

      if (account.status !== 'ACTIVE') {
        throw new BadRequestError('Selected account is inactive');
      }

      // 2. Validate target party mappings if passed
      await validateParties(tx, companyId, {
        clientId: body.clientId,
        vendorId: body.vendorId,
        employeeId: body.employeeId,
        loanId: body.loanId,
      });

      // 3. Increment account current balance
      const updatedAccount = await tx.account.update({
        where: { id: account.id },
        data: {
          currentBalance: { increment: body.amount },
        },
      });

      // 4. Create Ledger entry
      const transactionNo = `TRX-IN-${Date.now()}`;
      const trx = await tx.transaction.create({
        data: {
          companyId,
          transactionNo,
          type: 'PAYMENT_IN',
          category: body.category,
          date: new Date(),
          amount: body.amount,
          runningBalance: updatedAccount.currentBalance,
          accountId: body.accountId,
          purpose: body.purpose,
          paymentMode: body.paymentMode,
          referenceNo: body.referenceNo || null,
          createdBy: req.user!.id,
          clientId: body.clientId || null,
          vendorId: body.vendorId || null,
          employeeId: body.employeeId || null,
          loanId: body.loanId || null,
        },
      });

      // 5. Generate receipt voucher
      const voucherNo = `VCH-REC-${Date.now()}`;
      await tx.voucher.create({
        data: {
          companyId,
          voucherNo,
          transactionId: trx.id,
        },
      });

      // 6. Write Audit Log
      await tx.auditLog.create({
        data: {
          companyId,
          userId: req.user!.id,
          module: 'FINANCE_PAYMENTS',
          recordId: trx.id,
          action: 'PAYMENT_IN_CREATE',
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          newData: JSON.stringify({ transactionNo, amount: body.amount, account: account.name }),
        },
      });

      return trx;
    });

    sendSuccess(res, 'Incoming payment logged and deposited successfully', result, 201);
  } catch (err) {
    next(err);
  }
};

export const createPaymentOut = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const body = paymentOutSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify account exists
      const account = await tx.account.findFirst({
        where: { id: body.accountId, companyId, deletedAt: null },
      });

      if (!account) {
        throw new NotFoundError('Selected bank/cash account not found');
      }

      if (account.status !== 'ACTIVE') {
        throw new BadRequestError('Selected account is inactive');
      }

      // 2. Validate sufficient balance
      if (account.currentBalance < body.amount) {
        throw new BadRequestError(
          `Insufficient balance in account: current balance is ${account.currentBalance}`
        );
      }

      // 3. Validate target party mappings if passed
      await validateParties(tx, companyId, {
        clientId: body.clientId,
        vendorId: body.vendorId,
        employeeId: body.employeeId,
        loanId: body.loanId,
      });

      // 4. Role-based Voucher Approval Logic
      let status = 'COMPLETED';
      let createTransaction = true;
      const userRole = req.user!.role;

      if (userRole === 'ACCOUNTS' || userRole === 'ACCOUNT_I' || userRole === 'ACCOUNT_II') {
        if (body.amount > 2500) {
          throw new ForbiddenError('Account users cannot create vouchers above ₹2500.');
        } else if (body.amount > 500) {
          status = 'PENDING_APPROVAL';
          createTransaction = false;
        }
      }

      // 5. Generate Voucher (and Transaction if approved)
      const voucherNo = `VCH-PAY-${Date.now()}`;
      let trx: any = null;
      let transactionNo: string | null = null;

      if (createTransaction) {
        // Decrement account balance
        const updatedAccount = await tx.account.update({
          where: { id: account.id },
          data: {
            currentBalance: { decrement: body.amount },
          },
        });

        transactionNo = `TRX-OUT-${Date.now()}`;
        trx = await tx.transaction.create({
          data: {
            companyId,
            transactionNo,
            type: 'PAYMENT_OUT',
            category: body.category,
            date: new Date(),
            amount: body.amount,
            runningBalance: updatedAccount.currentBalance,
            accountId: body.accountId,
            purpose: body.purpose,
            paymentMode: body.paymentMode,
            referenceNo: body.referenceNo || null,
            createdBy: req.user!.id,
            clientId: body.clientId || null,
            vendorId: body.vendorId || null,
            employeeId: body.employeeId || null,
            loanId: body.loanId || null,
          },
        });
      }

      const voucher = await tx.voucher.create({
        data: {
          companyId,
          voucherNo,
          transactionId: trx ? trx.id : null,
          filePath: req.file ? `uploads/${req.file.filename}` : null,
          amount: body.amount,
          purpose: body.purpose,
          category: body.category,
          accountId: body.accountId,
          paymentMode: body.paymentMode,
          referenceNo: body.referenceNo || null,
          status,
          createdBy: req.user!.id,
        },
      });

      // 6. Write Audit Log
      await tx.auditLog.create({
        data: {
          companyId,
          userId: req.user!.id,
          module: 'FINANCE_PAYMENTS',
          recordId: voucher.id,
          action: createTransaction ? 'PAYMENT_OUT_CREATE' : 'VOUCHER_CREATE_PENDING',
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          newData: JSON.stringify({ 
            voucherNo, 
            transactionNo, 
            amount: body.amount, 
            account: account.name,
            status 
          }),
        },
      });

      return { voucher, transaction: trx };
    });

    sendSuccess(res, 'Outgoing payment logged successfully', result, 201);
  } catch (err) {
    next(err);
  }
};

export const getVouchers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId!;
    const vouchers = await prisma.voucher.findMany({
      where: { companyId },
      include: {
        transaction: true,
        account: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, 'Vouchers fetched successfully', vouchers, 200);
  } catch (err) {
    next(err);
  }
};

export const approveVoucher = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId!;
    const userRole = req.user!.role;

    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Only Admins can approve vouchers.');
    }

    const voucher = await prisma.voucher.findFirst({
      where: { id, companyId },
    });

    if (!voucher) throw new NotFoundError('Voucher not found');
    if (voucher.status !== 'PENDING_APPROVAL') throw new BadRequestError('Voucher is not pending approval');

    const updated = await prisma.voucher.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: req.user!.id,
      },
    });

    sendSuccess(res, 'Voucher approved successfully', updated, 200);
  } catch (err) {
    next(err);
  }
};

export const disburseVoucher = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId!;

    const result = await prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.findFirst({
        where: { id, companyId },
      });

      if (!voucher) throw new NotFoundError('Voucher not found');
      if (voucher.status !== 'APPROVED') throw new BadRequestError('Voucher must be approved before disbursement');
      if (!voucher.accountId) throw new BadRequestError('Account ID is missing in voucher');

      const account = await tx.account.findFirst({
        where: { id: voucher.accountId, companyId, deletedAt: null },
      });

      if (!account) throw new NotFoundError('Selected bank/cash account not found');
      if (account.currentBalance < voucher.amount) {
        throw new BadRequestError(`Insufficient balance in account: current balance is ${account.currentBalance}`);
      }

      // Decrement account balance
      const updatedAccount = await tx.account.update({
        where: { id: account.id },
        data: {
          currentBalance: { decrement: voucher.amount },
        },
      });

      // Create Ledger Entry
      const transactionNo = `TRX-OUT-${Date.now()}`;
      const trx = await tx.transaction.create({
        data: {
          companyId,
          transactionNo,
          type: 'PAYMENT_OUT',
          category: voucher.category,
          date: new Date(),
          amount: voucher.amount,
          runningBalance: updatedAccount.currentBalance,
          accountId: voucher.accountId,
          purpose: voucher.purpose,
          paymentMode: voucher.paymentMode,
          referenceNo: voucher.referenceNo || null,
          createdBy: voucher.createdBy,
        },
      });

      const updatedVoucher = await tx.voucher.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          disbursedBy: req.user!.id,
          transactionId: trx.id,
        },
      });

      return { voucher: updatedVoucher, transaction: trx };
    });

    sendSuccess(res, 'Voucher disbursed successfully', result, 200);
  } catch (err) {
    next(err);
  }
};
