import { Request, Response, NextFunction } from 'express';
import * as bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/apiResponse';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { sendWelcomeEmail } from '../utils/mailer';

// Input Validation Schemas
const createCompanySchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  email: z.string().email('Invalid company email address').optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  currency: z.string().default('INR'),
  timezone: z.string().default('Asia/Kolkata'),
  adminName: z.string().min(2, 'Admin name must be at least 2 characters'),
  adminEmail: z.string().email('Invalid admin email address'),
  adminPhone: z.string().min(10, 'Admin phone number must be at least 10 digits'),
  adminPassword: z.string().min(6, 'Admin password must be at least 6 characters'),
});

const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE']),
});

const updateCompanySchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  email: z.string().email('Invalid company email address').optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  currency: z.string().default('INR'),
  timezone: z.string().default('Asia/Kolkata'),
  adminEmail: z.string().email('Invalid admin email address').optional().nullable(),
  subscriptionStatus: z.enum(['TRIAL', 'ACTIVE', 'EXPIRED']).optional(),
  trialEndsAt: z.string().nullable().optional().transform(val => val ? new Date(val) : null),
  subscriptionEndsAt: z.string().nullable().optional().transform(val => val ? new Date(val) : null),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * List all client companies in the system (excludes master company metrics from general counts if desired, or lists all).
 */
export const listCompanies = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companies = await prisma.company.findMany({
      where: {
        id: { not: '00000000-0000-0000-0000-000000000000' } // exclude the master settings company
      },
      include: {
        users: {
          where: { status: { not: 'DELETED' } }
        },
        employees: {
          where: { status: 'ACTIVE' }
        },
        subscriptionPlan: {
          select: {
            name: true,
            months: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedCompanies = companies.map(company => {
      const primaryAdmin = company.users[0];
      return {
        id: company.id,
        name: company.name,
        email: company.email,
        phone: company.phone,
        address: company.address,
        logo: company.logo,
        gstin: company.gstin,
        currency: company.currency,
        timezone: company.timezone,
        status: company.status,
        subscriptionStatus: company.subscriptionStatus,
        trialEndsAt: company.trialEndsAt,
        subscriptionEndsAt: company.subscriptionEndsAt,
        subscriptionPlanId: company.subscriptionPlanId,
        subscriptionPlan: company.subscriptionPlan,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
        userCount: company.users.length,
        employeeCount: company.employees.length,
        adminEmail: primaryAdmin ? primaryAdmin.email : null,
      };
    });

    sendSuccess(res, 'System companies retrieved successfully', formattedCompanies, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Creates a new Client Company and seeds all baseline modules.
 */
export const createCompany = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payload = createCompanySchema.parse(req.body);

    // 1. Verify credentials uniqueness globally
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: payload.adminEmail },
          { phone: payload.adminPhone }
        ]
      }
    });

    if (existingUser) {
      throw new BadRequestError('Admin email or phone number is already registered under another account.');
    }

    const hashedPassword = await bcrypt.hash(payload.adminPassword, 12);
    const currentYear = new Date().getFullYear();

    // 2. Perform transactional database seeding
    const result = await prisma.$transaction(async (tx) => {
      // A. Create the Company Record
      const company = await tx.company.create({
        data: {
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          address: payload.address,
          currency: payload.currency,
          timezone: payload.timezone,
          status: 'ACTIVE',
          subscriptionStatus: 'TRIAL',
          trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default trial
        }
      });

      // B. Create Admin Employee Record
      const employee = await tx.employee.create({
        data: {
          companyId: company.id,
          employeeCode: 'EMP-001',
          name: payload.adminName,
          email: payload.adminEmail,
          mobile: payload.adminPhone,
          address: payload.address || '',
          joiningDate: new Date(),
          status: 'ACTIVE',
        }
      });

      // C. Create User Account
      const user = await tx.user.create({
        data: {
          companyId: company.id,
          name: payload.adminName,
          email: payload.adminEmail,
          phone: payload.adminPhone,
          passwordHash: hashedPassword,
          employeeId: employee.id,
          status: 'ACTIVE',
        }
      });

      // D. Find SUPER_ADMIN system role
      const superAdminRole = await tx.role.findUnique({
        where: { name: 'SUPER_ADMIN' }
      });
      if (!superAdminRole) {
        throw new NotFoundError('SUPER_ADMIN system role not found in system.');
      }

      // E. Connect User to SuperAdmin Role
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: superAdminRole.id
        }
      });

      // F. Seed Default Accounts
      await tx.account.create({
        data: {
          companyId: company.id,
          name: 'Primary Cash Box',
          type: 'CASH',
          accountNumber: 'CASHBOX-001',
          currentBalance: 0.0,
          status: 'ACTIVE',
        }
      });

      // G. Seed Default Leave Types
      const defaultLeaveTypes = [
        { code: 'CL', name: 'Casual Leave', description: 'Paid leave for personal matters', isPaid: true, annualQuota: 12, allowHalfDay: true },
        { code: 'SL', name: 'Sick Leave', description: 'Paid leave for medical reasons', isPaid: true, annualQuota: 12, allowHalfDay: true },
        { code: 'EL', name: 'Earned / Privilege Leave', description: 'Earned leave carried forward yearly', isPaid: true, annualQuota: 15, allowCarryForward: true, carryForwardLimit: 30 },
        { code: 'PL', name: 'Paid Leave', description: 'Standard paid leave allowance', isPaid: true, annualQuota: 10, allowHalfDay: true },
        { code: 'LWP', name: 'Unpaid Leave (LWP)', description: 'Leave Without Pay / Salary deduction', isPaid: false, annualQuota: 0, allowHalfDay: true },
        { code: 'OL', name: 'Optional / Festival Leave', description: 'Optional holiday leaves', isPaid: true, annualQuota: 3, allowHalfDay: false },
        { code: 'HD', name: 'Half Day Leave', description: 'Half day leave allowance', isPaid: true, annualQuota: 6, allowHalfDay: true },
      ];

      for (const lt of defaultLeaveTypes) {
        await tx.leaveType.create({
          data: {
            companyId: company.id,
            code: lt.code,
            name: lt.name,
            description: lt.description,
            isPaid: lt.isPaid,
            annualQuota: lt.annualQuota,
            allowHalfDay: lt.allowHalfDay,
            allowCarryForward: lt.allowCarryForward,
            carryForwardLimit: lt.carryForwardLimit || null,
            isActive: true,
          }
        });
      }

      // H. Seed Default Leave Policy
      await tx.leavePolicy.create({
        data: {
          companyId: company.id,
          name: 'Standard Corporate Policy',
          year: currentYear,
          workingDaysOnly: true,
          excludeWeekends: true,
          excludeHolidays: true,
          advanceNoticeDays: 1,
          allowNegativeBalance: false,
          autoApprove: false,
          isActive: true,
        }
      });

      // I. Seed Default Expense Categories
      const defaultExpenseCategories = [
        'Office Supplies & Stationery',
        'Travel & Conveyance',
        'Food & Client Refreshments',
        'Fuel & Petrol Allowance',
        'Internet & Phone Bills',
        'Equipment & Maintenance',
        'Miscellaneous Expense',
      ];
      for (const catName of defaultExpenseCategories) {
        await tx.expenseCategory.create({
          data: {
            companyId: company.id,
            name: catName,
            status: 'ACTIVE',
          }
        });
      }

      // J. Seed Default Payment Categories
      const defaultPaymentCategories = [
        { name: 'Sales Revenue', type: 'PAYMENT_IN' },
        { name: 'Vendor Payout', type: 'PAYMENT_OUT' },
        { name: 'Salary & Payroll', type: 'PAYMENT_OUT' },
        { name: 'Office Expense', type: 'BOTH' },
      ];
      for (const pcat of defaultPaymentCategories) {
        await tx.paymentCategory.create({
          data: {
            companyId: company.id,
            name: pcat.name,
            type: pcat.type,
            status: 'ACTIVE',
          }
        });
      }

      return { company, user };
    }, { timeout: 60000 });

    // Send welcome email to the newly created primary admin
    try {
      await sendWelcomeEmail(
        payload.adminEmail,
        payload.adminName,
        payload.adminPassword,
        'SUPER_ADMIN',
        {
          name: result.company.name,
          email: result.company.email,
          phone: result.company.phone,
          address: result.company.address,
          currency: result.company.currency || 'INR'
        }
      );
    } catch (mailErr: any) {
      console.error(`Failed to send welcome email to client admin ${payload.adminEmail}:`, mailErr.message || mailErr);
    }

    sendSuccess(res, 'Client Company created and seeded successfully', result, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle active/suspended status of a client company.
 */
export const updateCompanyStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = updateStatusSchema.parse(req.body);

    if (id === '00000000-0000-0000-0000-000000000000') {
      throw new BadRequestError('Cannot modify status of the System Master settings tenant.');
    }

    const company = await prisma.company.findUnique({
      where: { id }
    });

    if (!company) {
      throw new NotFoundError('Company record not found.');
    }

    const updated = await prisma.company.update({
      where: { id },
      data: { status }
    });

    sendSuccess(res, `Company status updated to ${status} successfully`, updated, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve system-wide analytical metrics for Master Admin dashboard.
 */
export const getSystemStats = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const totalCompanies = await prisma.company.count({
      where: { id: { not: '00000000-0000-0000-0000-000000000000' } }
    });
    
    const activeCompanies = await prisma.company.count({
      where: {
        id: { not: '00000000-0000-0000-0000-000000000000' },
        status: 'ACTIVE'
      }
    });

    const suspendedCompanies = totalCompanies - activeCompanies;

    const totalUsers = await prisma.user.count({
      where: {
        status: { not: 'DELETED' },
        companyId: { not: '00000000-0000-0000-0000-000000000000' }
      }
    });

    const totalEmployees = await prisma.employee.count({
      where: {
        status: 'ACTIVE',
        companyId: { not: '00000000-0000-0000-0000-000000000000' }
      }
    });

    const txsSum = await prisma.transaction.aggregate({
      where: {
        companyId: { not: '00000000-0000-0000-0000-000000000000' }
      },
      _sum: { amount: true }
    });

    const totalVolume = txsSum._sum.amount || 0.0;

    const stats = {
      totalCompanies,
      activeCompanies,
      suspendedCompanies,
      totalUsers,
      totalEmployees,
      totalTransactionVolume: totalVolume
    };

    sendSuccess(res, 'System stats retrieved successfully', stats, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Update client company profile details (Master Admin only).
 */
export const updateCompanyDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const payload = updateCompanySchema.parse(req.body);

    if (id === '00000000-0000-0000-0000-000000000000') {
      throw new BadRequestError('Cannot modify details of the System Master settings tenant.');
    }

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        users: {
          orderBy: { createdAt: 'asc' },
          take: 1
        }
      }
    });

    if (!company) {
      throw new NotFoundError('Company record not found.');
    }

    const primaryAdmin = company.users[0];

    const updated = await prisma.$transaction(async (tx) => {
      // A. Update company details
      const companyUpdated = await tx.company.update({
        where: { id },
        data: {
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          address: payload.address,
          currency: payload.currency,
          timezone: payload.timezone,
          subscriptionStatus: payload.subscriptionStatus,
          trialEndsAt: payload.trialEndsAt,
          subscriptionEndsAt: payload.subscriptionEndsAt,
        }
      });

      // B. If adminEmail is provided and has changed, update primary admin user email
      if (payload.adminEmail && primaryAdmin && primaryAdmin.email !== payload.adminEmail) {
        const existing = await tx.user.findFirst({
          where: {
            email: payload.adminEmail,
            id: { not: primaryAdmin.id }
          }
        });
        if (existing) {
          throw new BadRequestError(`The admin email "${payload.adminEmail}" is already in use by another account.`);
        }

        await tx.user.update({
          where: { id: primaryAdmin.id },
          data: { email: payload.adminEmail }
        });
      }

      return companyUpdated;
    }, { timeout: 10000 });

    sendSuccess(res, 'Company details updated successfully', updated, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a client company and permanently purge all linked records (Master Admin only).
 */
export const deleteCompany = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (id === '00000000-0000-0000-0000-000000000000') {
      throw new BadRequestError('Cannot delete the System Master settings tenant.');
    }

    const company = await prisma.company.findUnique({
      where: { id }
    });

    if (!company) {
      throw new NotFoundError('Company record not found.');
    }

    // Perform cascade delete in transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete linked log items and sessions
      await tx.auditLog.deleteMany({ where: { companyId: id } });
      await tx.refreshToken.deleteMany({ where: { user: { companyId: id } } });
      await tx.userRole.deleteMany({ where: { user: { companyId: id } } });
      
      // 2. Delete user and employees records
      await tx.user.deleteMany({ where: { companyId: id } });
      await tx.employee.deleteMany({ where: { companyId: id } });
      
      // 3. Delete accounts and financial ledger settings
      await tx.transaction.deleteMany({ where: { account: { companyId: id } } });
      await tx.voucher.deleteMany({ where: { companyId: id } });
      await tx.account.deleteMany({ where: { companyId: id } });
      
      // 4. Delete policy definitions
      await tx.leavePolicy.deleteMany({ where: { companyId: id } });
      await tx.leaveType.deleteMany({ where: { companyId: id } });
      await tx.expenseCategory.deleteMany({ where: { companyId: id } });
      await tx.paymentCategory.deleteMany({ where: { companyId: id } });
      await tx.announcement.deleteMany({ where: { companyId: id } });
      
      // 5. Finally, delete the company record itself
      await tx.company.delete({ where: { id } });
    }, { timeout: 60000 });

    sendSuccess(res, 'Company and all associated records permanently deleted', null, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password of a client company's primary administrator account (Master Admin only).
 */
export const resetCompanyAdminPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { companyId } = req.params;
    const { password } = resetPasswordSchema.parse(req.body);

    if (companyId === '00000000-0000-0000-0000-000000000000') {
      throw new BadRequestError('Use general reset API for System Master settings tenant accounts.');
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        users: {
          orderBy: { createdAt: 'asc' }, // The first user is the seeded primary admin
          take: 1
        }
      }
    });

    if (!company) {
      throw new NotFoundError('Company record not found.');
    }

    const primaryAdmin = company.users[0];
    if (!primaryAdmin) {
      throw new NotFoundError('No admin account found for this company.');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: primaryAdmin.id },
      data: { passwordHash: hashedPassword }
    });

    // Revoke any active refresh tokens to force re-authentication
    await prisma.refreshToken.deleteMany({
      where: { userId: primaryAdmin.id }
    });

    sendSuccess(res, `Password for administrator ${primaryAdmin.email} has been successfully reset.`, { email: primaryAdmin.email }, 200);
  } catch (error) {
    next(error);
  }
};

// Subscription Plan Validation Schemas
const createPlanSchema = z.object({
  name: z.string().min(2, 'Plan name must be at least 2 characters'),
  months: z.number().int().min(1, 'Months must be at least 1'),
  price: z.number().min(0, 'Price must be at least 0'),
  hasGst: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

const updatePlanSchema = z.object({
  name: z.string().min(2).optional(),
  months: z.number().int().min(1).optional(),
  price: z.number().min(0).optional(),
  hasGst: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/**
 * List all subscription plans (both active and inactive) for the master dashboard.
 */
export const listPlans = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, 'Subscription plans retrieved successfully', plans, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new subscription plan.
 */
export const createPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payload = createPlanSchema.parse(req.body);
    const plan = await prisma.subscriptionPlan.create({
      data: payload,
    });
    sendSuccess(res, 'Subscription plan created successfully', plan, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing subscription plan.
 */
export const updatePlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const payload = updatePlanSchema.parse(req.body);

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!plan) {
      throw new NotFoundError('Subscription plan not found.');
    }

    const updated = await prisma.subscriptionPlan.update({
      where: { id },
      data: payload,
    });
    sendSuccess(res, 'Subscription plan updated successfully', updated, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a subscription plan.
 */
export const deletePlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!plan) {
      throw new NotFoundError('Subscription plan not found.');
    }

    await prisma.subscriptionPlan.delete({
      where: { id },
    });
    sendSuccess(res, 'Subscription plan deleted successfully', null, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * List all subscription payments across all companies for master admin billing history.
 */
export const listPayments = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payments = await (prisma as any).subscriptionPayment.findMany({
      include: {
        company: {
          select: { id: true, name: true, email: true }
        },
        plan: {
          select: { name: true, months: true }
        }
      },
      orderBy: { paidAt: 'desc' }
    });
    sendSuccess(res, 'Subscription payment history retrieved successfully', payments, 200);
  } catch (error) {
    next(error);
  }
};


