import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/apiResponse';
import { BadRequestError, NotFoundError } from '../utils/errors';

const createAccountSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['CASH', 'BANK', 'UPI', 'CARD', 'OTHER']),
  bankName: z.string().optional().or(z.literal('')),
  accountNumber: z.string().optional().or(z.literal('')),
  ifsc: z.string().optional().or(z.literal('')),
  openingBalance: z.number().default(0.0),
});

const updateAccountSchema = z.object({
  name: z.string().min(2).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  currentBalance: z.number().optional(),
});

export const getAccounts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const accounts = await prisma.account.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    // Mask account numbers for safety before returning
    const formattedAccounts = accounts.map((acc) => {
      let maskedNumber = null;
      if (acc.accountNumber) {
        const num = acc.accountNumber.trim();
        maskedNumber = num.length > 4 ? '*'.repeat(num.length - 4) + num.slice(-4) : '****';
      }
      return {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        bankName: acc.bankName,
        accountNumber: maskedNumber,
        ifsc: acc.ifsc,
        openingBalance: acc.openingBalance,
        currentBalance: acc.currentBalance,
        status: acc.status,
        createdAt: acc.createdAt,
      };
    });

    sendSuccess(res, 'Accounts retrieved successfully', formattedAccounts);
  } catch (err) {
    next(err);
  }
};

export const createAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { name, type, bankName, accountNumber, ifsc, openingBalance } = createAccountSchema.parse(
      req.body
    );

    if (type === 'BANK' && (!bankName || !accountNumber || !ifsc)) {
      throw new BadRequestError(
        'Bank Name, Account Number, and IFSC are required for BANK accounts'
      );
    }

    const account = await prisma.account.create({
      data: {
        companyId,
        name,
        type,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        ifsc: ifsc || null,
        openingBalance,
        currentBalance: openingBalance, // current balance starts as opening balance
        status: 'ACTIVE',
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        companyId,
        userId: req.user!.id,
        module: 'FINANCE_ACCOUNTS',
        recordId: account.id,
        action: 'ACCOUNT_CREATE',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'unknown',
        newData: JSON.stringify({ name: account.name, type: account.type, openingBalance }),
      },
    });

    sendSuccess(res, 'Account created successfully', account, 201);
  } catch (err) {
    next(err);
  }
};

export const updateAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.companyId!;
    const { name, status, currentBalance } = updateAccountSchema.parse(req.body);

    const account = await prisma.account.findFirst({
      where: { id, companyId, deletedAt: null },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    const updatedAccount = await prisma.$transaction(async (tx) => {
      const u = await tx.account.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(status && { status }),
          ...(currentBalance !== undefined && { currentBalance }),
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId: req.user!.id,
          module: 'FINANCE_ACCOUNTS',
          recordId: id,
          action: 'ACCOUNT_UPDATE',
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          oldData: JSON.stringify({ name: account.name, status: account.status, currentBalance: account.currentBalance }),
          newData: JSON.stringify({ name: u.name, status: u.status, currentBalance: u.currentBalance }),
        },
      });

      return u;
    });

    sendSuccess(res, 'Account updated successfully', updatedAccount);
  } catch (err) {
    next(err);
  }
};

export const deleteAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.companyId!;

    const account = await prisma.account.findFirst({
      where: { id, companyId, deletedAt: null },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    // Soft delete
    await prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: 'INACTIVE',
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId: req.user!.id,
          module: 'FINANCE_ACCOUNTS',
          recordId: id,
          action: 'ACCOUNT_DELETE',
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          oldData: JSON.stringify({ name: account.name }),
          newData: JSON.stringify({ deleted: true }),
        },
      });
    });

    sendSuccess(res, 'Account deleted successfully', null);
  } catch (err) {
    next(err);
  }
};
