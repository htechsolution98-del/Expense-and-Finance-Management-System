import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as crypto from 'crypto';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/apiResponse';
import { BadRequestError, NotFoundError } from '../utils/errors';

const transferSchema = z.object({
  fromAccountId: z.string(),
  toAccountId: z.string(),
  amount: z.number().positive(),
  purpose: z.string().min(3),
  referenceNo: z.string().optional().or(z.literal('')),
});

export const executeTransfer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { fromAccountId, toAccountId, amount, purpose, referenceNo } = transferSchema.parse(
      req.body
    );

    if (fromAccountId === toAccountId) {
      throw new BadRequestError('Source and destination accounts must be different');
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch and assert source account
      const fromAccount = await tx.account.findFirst({
        where: { id: fromAccountId, companyId, deletedAt: null },
      });
      if (!fromAccount) throw new NotFoundError('Source account not found');
      if (fromAccount.status !== 'ACTIVE') throw new BadRequestError('Source account is inactive');
      if (fromAccount.currentBalance < amount) {
        throw new BadRequestError(
          `Insufficient balance in source account. Current: ${fromAccount.currentBalance}`
        );
      }

      // 2. Fetch and assert destination account
      const toAccount = await tx.account.findFirst({
        where: { id: toAccountId, companyId, deletedAt: null },
      });
      if (!toAccount) throw new NotFoundError('Destination account not found');
      if (toAccount.status !== 'ACTIVE')
        throw new BadRequestError('Destination account is inactive');

      // 3. Deduct from source and add to destination
      const updatedFromAccount = await tx.account.update({
        where: { id: fromAccountId },
        data: {
          currentBalance: { decrement: amount },
        },
      });

      const updatedToAccount = await tx.account.update({
        where: { id: toAccountId },
        data: {
          currentBalance: { increment: amount },
        },
      });

      const transferGroupId = crypto.randomUUID();

      // 4. Record TRANSFER_OUT
      const outTrxNo = `TRX-TRF-OUT-${Date.now()}`;
      const outTrx = await tx.transaction.create({
        data: {
          companyId,
          transactionNo: outTrxNo,
          type: 'TRANSFER_OUT',
          category: 'INTERNAL_TRANSFER',
          date: new Date(),
          amount,
          runningBalance: updatedFromAccount.currentBalance,
          accountId: fromAccountId,
          purpose: `Transfer to account: ${toAccount.name}. ${purpose}`,
          paymentMode: fromAccount.type === 'CASH' ? 'CASH' : 'BANK_TRANSFER',
          referenceNo: referenceNo || null,
          transferGroupId,
          createdBy: req.user!.id,
        },
      });

      // 5. Record TRANSFER_IN
      const inTrxNo = `TRX-TRF-IN-${Date.now()}`;
      const inTrx = await tx.transaction.create({
        data: {
          companyId,
          transactionNo: inTrxNo,
          type: 'TRANSFER_IN',
          category: 'INTERNAL_TRANSFER',
          date: new Date(),
          amount,
          runningBalance: updatedToAccount.currentBalance,
          accountId: toAccountId,
          purpose: `Transfer from account: ${fromAccount.name}. ${purpose}`,
          paymentMode: toAccount.type === 'CASH' ? 'CASH' : 'BANK_TRANSFER',
          referenceNo: referenceNo || null,
          transferGroupId,
          createdBy: req.user!.id,
        },
      });

      // 6. Generate Vouchers
      const outVoucherNo = `VCH-PAY-TRF-${Date.now()}`;
      await tx.voucher.create({
        data: {
          companyId,
          voucherNo: outVoucherNo,
          transactionId: outTrx.id,
        },
      });

      const inVoucherNo = `VCH-REC-TRF-${Date.now()}`;
      await tx.voucher.create({
        data: {
          companyId,
          voucherNo: inVoucherNo,
          transactionId: inTrx.id,
        },
      });

      // 7. Write Audit Log
      await tx.auditLog.create({
        data: {
          companyId,
          userId: req.user!.id,
          module: 'FINANCE_TRANSFERS',
          recordId: transferGroupId,
          action: 'INTERNAL_TRANSFER_EXECUTE',
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          newData: JSON.stringify({
            from: fromAccount.name,
            to: toAccount.name,
            amount,
            transferGroupId,
          }),
        },
      });

      return [outTrx, inTrx];
    });

    sendSuccess(res, 'Internal transfer completed successfully', result, 201);
  } catch (err) {
    next(err);
  }
};
