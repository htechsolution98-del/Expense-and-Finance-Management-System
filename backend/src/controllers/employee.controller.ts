import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { z } from 'zod';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { generateNextEmployeeCode } from '../utils/employeeCode';

// ─────────────────────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────────────────────
const upsertBankSchema = z.object({
  bankName: z.string().min(2, 'Bank name is required'),
  accountHolder: z.string().min(2, 'Account holder name is required'),
  accountNumber: z.string().min(5, 'Account number must be at least 5 digits'),
  ifsc: z.string().min(4, 'IFSC code is required'),
  branchName: z.string().optional(),
  proofFile: z.string().optional(),
});

const rejectBankSchema = z.object({
  rejectionReason: z.string().min(3, 'Rejection reason is required'),
});

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name is required').optional(),
  address: z.string().optional(),
  photo: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────
// Helper: get employee ID for current request
// ─────────────────────────────────────────────────────────────
async function resolveEmployeeId(req: Request): Promise<string> {
  if (req.user?.employeeId) {
    return req.user.employeeId;
  }
  // Lookup user record to see if employeeId is set
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
  });
  
  if (!user) {
    throw new ForbiddenError('User not found.');
  }

  if (user.employeeId) {
    return user.employeeId;
  }

  // Try to match existing employee by email before creating a new one
  if (user.email) {
    const existingEmployee = await prisma.employee.findFirst({
      where: { email: user.email, companyId: user.companyId },
    });
    if (existingEmployee) {
      // Auto-link the user to this existing employee
      await prisma.user.update({
        where: { id: user.id },
        data: { employeeId: existingEmployee.id },
      });
      return existingEmployee.id;
    }
  }

  // Auto-create Employee profile for the User syncing their details
  const employeeCode = await generateNextEmployeeCode(user.companyId);
  
  const newEmployee = await prisma.employee.create({
    data: {
      companyId: user.companyId,
      employeeCode,
      name: user.name || 'Update Your Name',
      email: user.email,
      mobile: user.phone || '',
      address: '',
      photo: null,
      joiningDate: new Date(),
    }
  });

  // Link to user
  await prisma.user.update({
    where: { id: user.id },
    data: { employeeId: newEmployee.id }
  });

  return newEmployee.id;
}

// ─────────────────────────────────────────────────────────────
// GET /employees/me — Profile self-service
// ─────────────────────────────────────────────────────────────
export const getMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const employeeId = await resolveEmployeeId(req);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: { select: { name: true } },
        designation: { select: { name: true } },
        bankAccounts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        salaryStructures: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
      },
    });

    if (!employee) throw new NotFoundError('Employee profile not found.');

    res.json({ status: 'success', data: employee });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /employees/me — Update Profile
// ─────────────────────────────────────────────────────────────
export const updateMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const employeeId = await resolveEmployeeId(req);
    const validated = updateProfileSchema.parse(req.body);

    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.address !== undefined && { address: validated.address }),
        ...(validated.photo !== undefined && { photo: validated.photo }),
      }
    });

    // Sync name back to User account if updated
    if (validated.name) {
      await prisma.user.updateMany({
        where: { employeeId },
        data: { name: validated.name }
      });
    }

    res.json({ status: 'success', message: 'Profile updated successfully', data: updated });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /employees/me/bank-account
// ─────────────────────────────────────────────────────────────
export const getMyBankAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const employeeId = await resolveEmployeeId(req);

    const bankAccount = await prisma.employeeBankAccount.findFirst({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ status: 'success', data: bankAccount || null });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST/PUT /employees/me/bank-account — Submit/update bank details
// ─────────────────────────────────────────────────────────────
export const upsertMyBankAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const employeeId = await resolveEmployeeId(req);
    const companyId = req.user!.companyId;
    const validated = upsertBankSchema.parse(req.body);

    const existing = await prisma.employeeBankAccount.findFirst({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });

    let bankAccount;
    if (existing) {
      // Update existing record and reset to PENDING_VERIFICATION
      bankAccount = await prisma.employeeBankAccount.update({
        where: { id: existing.id },
        data: {
          bankName: validated.bankName,
          accountHolder: validated.accountHolder,
          accountNumber: validated.accountNumber,
          ifsc: validated.ifsc,
          branchName: validated.branchName || null,
          proofFile: validated.proofFile || null,
          status: 'PENDING_VERIFICATION',
          rejectionReason: null,
          verifiedBy: null,
          verifiedAt: null,
        },
      });
    } else {
      // Create new bank account entry
      bankAccount = await prisma.employeeBankAccount.create({
        data: {
          companyId,
          employeeId,
          bankName: validated.bankName,
          accountHolder: validated.accountHolder,
          accountNumber: validated.accountNumber,
          ifsc: validated.ifsc,
          branchName: validated.branchName || null,
          proofFile: validated.proofFile || null,
          status: 'PENDING_VERIFICATION',
        },
      });
    }

    res.status(existing ? 200 : 201).json({
      status: 'success',
      message: 'Bank account details submitted. Pending verification.',
      data: bankAccount,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /employees/bank-accounts/pending — Accounts / Admin review list
// ─────────────────────────────────────────────────────────────
export const getPendingBankAccounts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.user!.companyId;

    const pending = await prisma.employeeBankAccount.findMany({
      where: { companyId, status: 'PENDING_VERIFICATION' },
      include: {
        employee: { select: { id: true, name: true, employeeCode: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ status: 'success', data: pending });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /employees/bank-accounts/:id/verify
// ─────────────────────────────────────────────────────────────
export const verifyBankAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;

    const bankAccount = await prisma.employeeBankAccount.findFirst({
      where: { id, companyId },
    });
    if (!bankAccount) throw new NotFoundError('Bank account record not found.');

    const updated = await prisma.employeeBankAccount.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        rejectionReason: null,
        verifiedBy: req.user!.id,
        verifiedAt: new Date(),
      },
    });

    res.json({ status: 'success', message: 'Bank account verified successfully.', data: updated });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /employees/bank-accounts/:id/reject
// ─────────────────────────────────────────────────────────────
export const rejectBankAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;
    const { rejectionReason } = rejectBankSchema.parse(req.body);

    const bankAccount = await prisma.employeeBankAccount.findFirst({
      where: { id, companyId },
    });
    if (!bankAccount) throw new NotFoundError('Bank account record not found.');

    const updated = await prisma.employeeBankAccount.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason,
        verifiedBy: req.user!.id,
        verifiedAt: new Date(),
      },
    });

    res.json({ status: 'success', message: 'Bank account rejected.', data: updated });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /employees/me/salary-slips — Employee's paid payslips
// ─────────────────────────────────────────────────────────────
export const getMySalarySlips = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const employeeId = await resolveEmployeeId(req);

    const slips = await prisma.payrollItem.findMany({
      where: {
        employeeId,
        status: { in: ['PAID', 'ON_HOLD'] },
      },
      include: {
        payroll: { select: { month: true, year: true, payrollNo: true } },
        account: { select: { name: true } },
      },
      orderBy: { id: 'desc' },
    });

    res.json({ status: 'success', data: slips });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /employees/me/salary-slips/:id — Payslip detail for rendering
// ─────────────────────────────────────────────────────────────
export const getMySalarySlipDetail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const role = req.user!.role;
    let employeeId: string | null = null;

    const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'ACCOUNTS' || role.startsWith('ADMIN') || role.startsWith('ACCOUNT');
    if (!isAdmin) {
      employeeId = await resolveEmployeeId(req);
    }

    const slip = await prisma.payrollItem.findUnique({
      where: { id },
      include: {
        payroll: { select: { month: true, year: true, payrollNo: true, company: true } },
        employee: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
            email: true,
            mobile: true,
            joiningDate: true,
            department: { select: { name: true } },
            designation: { select: { name: true } },
          },
        },
        account: { select: { name: true } },
      },
    });

    if (!slip) throw new NotFoundError('Salary slip not found.');

    // Privacy assertion
    if (!isAdmin && slip.employeeId !== employeeId) {
      throw new ForbiddenError('You can only view your own salary slips.');
    }

    res.json({ status: 'success', data: slip });
  } catch (error) {
    next(error);
  }
};
