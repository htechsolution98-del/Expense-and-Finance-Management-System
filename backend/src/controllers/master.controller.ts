import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/apiResponse';
import { BadRequestError } from '../utils/errors';

const createClientSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  mobile: z.string().optional().or(z.literal('')),
});

const createVendorSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  mobile: z.string().optional().or(z.literal('')),
});

const createEmployeeSchema = z.object({
  employeeCode: z.string().min(2),
  name: z.string().min(2),
  joiningDate: z.string().transform((str) => new Date(str)),
  mobile: z.string(),
  email: z.string().email(),
  address: z.string(),
});

const createLoanSchema = z.object({
  loanNo: z.string().min(2),
  lender: z.string().min(2),
  principal: z.number().positive(),
  interestRate: z.number().nonnegative(),
  receivedDate: z.string().transform((str) => new Date(str)),
  purpose: z.string(),
  receivingAccountId: z.string(),
});

// Clients
export const getClients = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const clients = await prisma.client.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, 'Clients retrieved successfully', clients);
  } catch (err) {
    next(err);
  }
};

export const createClient = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { name, email, mobile } = createClientSchema.parse(req.body);

    const client = await prisma.client.create({
      data: {
        companyId,
        name,
        email: email || null,
        mobile: mobile || null,
      },
    });

    sendSuccess(res, 'Client created successfully', client, 201);
  } catch (err) {
    next(err);
  }
};

// Vendors
export const getVendors = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const vendors = await prisma.vendor.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, 'Vendors retrieved successfully', vendors);
  } catch (err) {
    next(err);
  }
};

export const createVendor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { name, email, mobile } = createVendorSchema.parse(req.body);

    const vendor = await prisma.vendor.create({
      data: {
        companyId,
        name,
        email: email || null,
        mobile: mobile || null,
      },
    });

    sendSuccess(res, 'Vendor created successfully', vendor, 201);
  } catch (err) {
    next(err);
  }
};

// Employees
export const getEmployees = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const userRole = req.user!.role;
    const isAccounts = userRole === 'ACCOUNTS' || userRole.startsWith('ACCOUNT');
    const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || userRole.startsWith('ADMIN');
    const hasViewPerm =
      isAdmin ||
      isAccounts ||
      req.user!.permissions.includes('USER_VIEW') ||
      req.user!.permissions.includes('SALARY_VIEW') ||
      req.user!.permissions.includes('SALARY_MANAGE') ||
      req.user!.permissions.includes('PAYROLL_MANAGE');

    let whereClause: any = { companyId };
    
    // If they don't have permission to view all users, restrict to their own employee ID
    if (!hasViewPerm) {
      if (!req.user!.employeeId) {
        // If they don't have an employeeId linked, return nothing since they can't view others
        sendSuccess(res, 'Employees retrieved successfully', []);
        return;
      }
      whereClause.id = req.user!.employeeId;
    }

    const employees = await prisma.employee.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, 'Employees retrieved successfully', employees);
  } catch (err) {
    next(err);
  }
};

export const createEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { employeeCode, name, joiningDate, mobile, email, address } = createEmployeeSchema.parse(
      req.body
    );

    const existing = await prisma.employee.findUnique({
      where: {
        companyId_employeeCode: {
          companyId,
          employeeCode,
        },
      },
    });

    if (existing) {
      throw new BadRequestError(`Employee with code ${employeeCode} already exists`);
    }

    const employee = await prisma.employee.create({
      data: {
        companyId,
        employeeCode,
        name,
        joiningDate,
        mobile,
        email,
        address,
        status: 'ACTIVE',
      },
    });

    sendSuccess(res, 'Employee created successfully', employee, 201);
  } catch (err) {
    next(err);
  }
};

// Loans
export const getLoans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const loans = await prisma.loan.findMany({
      where: { companyId },
      orderBy: { loanNo: 'desc' },
    });
    sendSuccess(res, 'Loans retrieved successfully', loans);
  } catch (err) {
    next(err);
  }
};

export const createLoan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { loanNo, lender, principal, interestRate, receivedDate, purpose, receivingAccountId } =
      createLoanSchema.parse(req.body);

    // Verify account exists and belongs to company
    const account = await prisma.account.findFirst({
      where: { id: receivingAccountId, companyId },
    });
    if (!account) {
      throw new BadRequestError('Receiving bank account not found in this company');
    }

    const existing = await prisma.loan.findFirst({
      where: { companyId, loanNo },
    });
    if (existing) {
      throw new BadRequestError(`Loan number ${loanNo} already exists`);
    }

    // Creating loan also creates a transaction PAYMENT_IN LOAN_RECEIVED
    const result = await prisma.$transaction(async (tx) => {
      const loan = await tx.loan.create({
        data: {
          companyId,
          loanNo,
          lender,
          principal,
          interestRate,
          receivedDate,
          purpose,
          receivingAccountId,
          status: 'ACTIVE',
        },
      });

      // Update receiving account balance
      const updatedAccount = await tx.account.update({
        where: { id: receivingAccountId },
        data: {
          currentBalance: { increment: principal },
        },
      });

      // Record ledger transaction
      const transactionNo = `TRX-LN-${Date.now()}`;
      await tx.transaction.create({
        data: {
          companyId,
          transactionNo,
          type: 'PAYMENT_IN',
          category: 'LOAN_RECEIVED',
          date: receivedDate,
          amount: principal,
          runningBalance: updatedAccount.currentBalance,
          accountId: receivingAccountId,
          purpose: `Loan Principal received: ${lender} (${loanNo})`,
          paymentMode: 'BANK_TRANSFER',
          createdBy: req.user!.id,
          loanId: loan.id,
        },
      });

      // Generate Voucher code
      const voucherNo = `VCH-REC-${Date.now()}`;
      await tx.voucher.create({
        data: {
          companyId,
          voucherNo,
          transactionId: (await tx.transaction.findUniqueOrThrow({ where: { transactionNo } })).id,
        },
      });

      return loan;
    });

    sendSuccess(res, 'Loan registered and principal deposited successfully', result, 201);
  } catch (err) {
    next(err);
  }
};
