import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { z } from 'zod';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { sendSuccess } from '../utils/apiResponse';

// Validators
const createCategorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

const createExpenseSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  categoryId: z.string().nonempty('Category ID is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  date: z.string().transform((val) => new Date(val)),
  purpose: z.string().min(3, 'Purpose must be at least 3 characters'),
  paymentMode: z.enum([
    'CASH',
    'BANK_TRANSFER',
    'UPI',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'CHEQUE',
    'OTHER',
  ]),
  submitDirectly: z.coerce.boolean().optional().default(false),
});

const updateExpenseSchema = z.object({
  categoryId: z.string().nonempty('Category ID is required').optional(),
  amount: z.coerce.number().positive('Amount must be positive').optional(),
  date: z
    .string()
    .transform((val) => new Date(val))
    .optional(),
  purpose: z.string().min(3, 'Purpose must be at least 3 characters').optional(),
  paymentMode: z
    .enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'CHEQUE', 'OTHER'])
    .optional(),
  submitDirectly: z.coerce.boolean().optional().default(false),
});

const reviewActionSchema = z.object({
  comments: z.string().optional().default(''),
});

const payoutSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  paymentReference: z.string().optional(),
});

export const getCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.expenseCategory.findMany({
      where: {
        companyId: req.user!.companyId,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });

    res.json({ status: 'success', data: categories });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check permission
    const permissions = req.user!.permissions;
    if (
      !permissions.includes('EXPENSE_APPROVE') &&
      req.user!.role !== 'ADMIN' &&
      req.user!.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenError('You do not have permission to manage expense categories.');
    }

    const { name } = createCategorySchema.parse(req.body);

    const categoryId = `cat-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    const category = await prisma.expenseCategory.upsert({
      where: { id: categoryId },
      update: { deletedAt: null, status: 'ACTIVE' },
      create: {
        id: categoryId,
        companyId: req.user!.companyId,
        name,
      },
    });

    res.status(201).json({ status: 'success', data: category });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const permissions = req.user!.permissions;
    if (
      !permissions.includes('EXPENSE_APPROVE') &&
      req.user!.role !== 'ADMIN' &&
      req.user!.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenError('You do not have permission to manage expense categories.');
    }

    const { name } = createCategorySchema.parse(req.body);
    const { id } = req.params;

    const category = await prisma.expenseCategory.update({
      where: { id },
      data: { name },
    });

    res.status(200).json({ status: 'success', data: category });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const permissions = req.user!.permissions;
    if (
      !permissions.includes('EXPENSE_APPROVE') &&
      req.user!.role !== 'ADMIN' &&
      req.user!.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenError('You do not have permission to manage expense categories.');
    }

    const { id } = req.params;

    // Check if category is in use
    const expenses = await prisma.expense.findFirst({ where: { categoryId: id } });
    if (expenses) {
      throw new BadRequestError('Cannot delete category because it is used in existing expenses.');
    }

    await prisma.expenseCategory.delete({
      where: { id },
    });

    res.status(200).json({ status: 'success', message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getExpenses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const offset = (page - 1) * limit;

    const role = req.user!.role;
    const userId = req.user!.id;
    const companyId = req.user!.companyId;

    // Filter rules:
    // STAFF can only view their own expenses or expenses they created
    const filter: { companyId: string; OR?: { createdBy?: string; employeeId?: string }[] } = {
      companyId,
    };

    const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'ACCOUNTS' || role.startsWith('ADMIN') || role.startsWith('ACCOUNT');
    if (!isAdmin) {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { employeeId: true },
      });
      filter.OR = [{ createdBy: userId }, { employeeId: dbUser?.employeeId || 'none' }];
    }

    const [expenses, count] = await Promise.all([
      prisma.expense.findMany({
        where: filter,
        include: {
          employee: { select: { id: true, name: true, employeeCode: true } },
          category: { select: { id: true, name: true } },
          creator: { select: { id: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.expense.count({ where: filter }),
    ]);

    // Format workflow steps if present
    const enhancedExpenses = await Promise.all(
      expenses.map(async (exp) => {
        const approvalRequest = await prisma.approvalRequest.findFirst({
          where: { companyId, module: 'EXPENSE', recordId: exp.id },
          include: {
            approvalSteps: {
              orderBy: { stepNumber: 'asc' },
              include: { actor: { select: { id: true, email: true } } },
            },
          },
        });
        return {
          ...exp,
          approvalRequest: approvalRequest || null,
        };
      })
    );

    res.json({
      status: 'success',
      data: enhancedExpenses,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createExpenseSchema.parse(req.body);
    const companyId = req.user!.companyId;

    // Verify employee and category exist
    const employee = await prisma.employee.findFirst({
      where: { id: validated.employeeId, companyId },
    });
    if (!employee) {
      throw new NotFoundError('Employee not found in company.');
    }

    const category = await prisma.expenseCategory.findFirst({
      where: { id: validated.categoryId, companyId, deletedAt: null },
    });
    if (!category) {
      throw new NotFoundError('Expense Category not found.');
    }

    // Generate unique expense number (EXP-YYYYMMDD-XXXX)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `EXP-${dateStr}`;
    const matchCount = await prisma.expense.count({
      where: { companyId, expenseNo: { startsWith: prefix } },
    });
    const expenseNo = `${prefix}-${(matchCount + 1).toString().padStart(4, '0')}`;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const receiptUrl = files?.['receipt']?.[0] ? `/uploads/${files['receipt'][0].filename}` : undefined;
    const paymentProofUrl = files?.['paymentProof']?.[0] ? `/uploads/${files['paymentProof'][0].filename}` : undefined;

    // Create record
    const expense = await prisma.expense.create({
      data: {
        companyId,
        expenseNo,
        employeeId: validated.employeeId,
        categoryId: validated.categoryId,
        amount: validated.amount,
        date: validated.date,
        purpose: validated.purpose,
        paymentMode: validated.paymentMode,
        receiptUrl,
        paymentProofUrl,
        createdBy: req.user!.id,
        status: 'DRAFT',
      },
      include: {
        employee: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    if (validated.submitDirectly) {
      const submitted = await triggerWorkflow(expense.id, companyId);
      res.status(201).json({ status: 'success', data: submitted });
      return;
    }

    res.status(201).json({ status: 'success', data: expense });
    return;
  } catch (error) {
    next(error);
  }
};

export const updateExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validated = updateExpenseSchema.parse(req.body);
    const companyId = req.user!.companyId;

    const expense = await prisma.expense.findFirst({
      where: { id, companyId },
    });

    if (!expense) {
      throw new NotFoundError('Expense not found.');
    }

    // Enforce that updates are only allowed in DRAFT, RETURNED, or REJECTED statuses
    if (expense.status !== 'DRAFT' && expense.status !== 'RETURNED_FOR_CORRECTION' && expense.status !== 'REJECTED') {
      throw new BadRequestError(
        'Expenses can only be updated when in DRAFT, RETURNED_FOR_CORRECTION, or REJECTED status.'
      );
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const receiptUrl = files?.['receipt']?.[0] ? `/uploads/${files['receipt'][0].filename}` : undefined;
    const paymentProofUrl = files?.['paymentProof']?.[0] ? `/uploads/${files['paymentProof'][0].filename}` : undefined;
    
    // Extract submitDirectly so we don't pass it to Prisma update
    const { submitDirectly, ...updateData } = validated;
    if (receiptUrl) {
      (updateData as any).receiptUrl = receiptUrl;
    }
    if (paymentProofUrl) {
      (updateData as any).paymentProofUrl = paymentProofUrl;
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: updateData,
    });

    res.json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

export const submitExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;

    const expense = await prisma.expense.findFirst({
      where: { id, companyId },
    });

    if (!expense) {
      throw new NotFoundError('Expense not found.');
    }

    if (expense.status !== 'DRAFT' && expense.status !== 'RETURNED_FOR_CORRECTION') {
      throw new BadRequestError('Only DRAFT or RETURNED_FOR_CORRECTION expenses can be submitted.');
    }

    const submitted = await triggerWorkflow(id, companyId);
    res.json({ status: 'success', data: submitted });
  } catch (error) {
    next(error);
  }
};

// Internal workflow engine rules mapping instantiator
async function triggerWorkflow(expenseId: string, companyId: string) {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
  });

  if (!expense) throw new NotFoundError('Expense details missing.');

  // Clean old workflow request/steps if returning/resubmitting
  await prisma.approvalRequest.deleteMany({
    where: { companyId, module: 'EXPENSE', recordId: expenseId },
  });

  // Find matching rule
  const rule = await prisma.approvalRule.findFirst({
    where: {
      companyId,
      module: 'EXPENSE',
      minAmount: { lte: expense.amount },
      maxAmount: { gte: expense.amount },
    },
    orderBy: { minAmount: 'desc' }, // choose narrowest matching range if duplicate
  });

  // Find matching account role name in the database (defaults to ACCOUNTS if none found)
  const dbAccountsRole = await prisma.role.findFirst({
    where: {
      name: { startsWith: 'ACCOUNT' }
    }
  });
  const finalAccountsRoleName = dbAccountsRole ? dbAccountsRole.name : 'ACCOUNTS';

  let roles: string[] = ['SUPER_ADMIN', 'ADMIN', finalAccountsRoleName]; // default fallback flow: SUPER_ADMIN -> ADMIN -> Accounts Role
  if (rule) {
    roles = rule.approverRoles.split(',').map((r) => r.trim());
  }

  // Dynamic overrides based on creator role
  const creator = await prisma.user.findUnique({
    where: { id: expense.createdBy },
    include: { userRoles: { include: { role: true } } },
  });
  const creatorRole = creator?.userRoles[0]?.role?.name || 'STAFF';

  if (creatorRole === 'ADMIN') {
    // If Admin creates it, Super Admin approves, then Accounts approves & disburses
    roles = ['SUPER_ADMIN', finalAccountsRoleName];
  } else if (creatorRole === 'ACCOUNTS' || creatorRole.startsWith('ACCOUNT')) {
    // If Accounts creates it, Super Admin -> Admin -> Accounts (disburses)
    roles = ['SUPER_ADMIN', 'ADMIN', finalAccountsRoleName];
  } else if (creatorRole === 'SUPER_ADMIN') {
    // If Super Admin creates it, only Accounts needs to process the payout
    roles = [finalAccountsRoleName];
  }

  // Create request sequence
  const request = await prisma.approvalRequest.create({
    data: {
      companyId,
      module: 'EXPENSE',
      recordId: expenseId,
      status: 'PENDING',
      currentStep: 0,
    },
  });

  // Create approval step mappings
  for (let i = 0; i < roles.length; i++) {
    await prisma.approvalStep.create({
      data: {
        approvalRequestId: request.id,
        stepNumber: i,
        roleName: roles[i],
        status: i === 0 ? 'PENDING' : 'PENDING', // all start pending, but user checks active index
      },
    });
  }

  // Move expense to review status
  const updatedExpense = await prisma.expense.update({
    where: { id: expenseId },
    data: { status: 'UNDER_REVIEW' },
    include: {
      employee: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  return updatedExpense;
}

export const approveExpenseStep = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { comments } = reviewActionSchema.parse(req.body);
    const companyId = req.user!.companyId;

    // Check permissions
    if (
      !req.user!.permissions.includes('EXPENSE_APPROVE') &&
      req.user!.role !== 'ADMIN' &&
      req.user!.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenError('You do not hold permissions to approve expenses.');
    }

    const expense = await prisma.expense.findFirst({
      where: { id, companyId },
    });
    if (!expense) throw new NotFoundError('Expense not found.');
    if (expense.status !== 'UNDER_REVIEW') {
      throw new BadRequestError('Expense is not currently in review.');
    }

    const request = await prisma.approvalRequest.findFirst({
      where: { companyId, module: 'EXPENSE', recordId: id },
      include: { approvalSteps: { orderBy: { stepNumber: 'asc' } } },
    });
    if (!request) throw new NotFoundError('Workflow request details missing.');

    const activeStep = request.approvalSteps.find((s) => s.stepNumber === request.currentStep);
    if (!activeStep) throw new BadRequestError('No active approval step found.');

    // Authorize that reviewer belongs to step role Name
    const userRole = req.user!.role;
    const isMatched = userRole === activeStep.roleName || 
      (activeStep.roleName === 'ACCOUNTS' && userRole.startsWith('ACCOUNT')) ||
      (activeStep.roleName === 'ADMIN' && userRole.startsWith('ADMIN')) ||
      userRole === 'SUPER_ADMIN';
    if (!isMatched) {
      throw new ForbiddenError(
        `Only users holding the role "${activeStep.roleName}" can approve this step.`
      );
    }

    // Update active step
    await prisma.approvalStep.update({
      where: { id: activeStep.id },
      data: {
        status: 'APPROVED',
        actionBy: req.user!.id,
        actionAt: new Date(),
        comments,
      },
    });

    const isLastStep = request.currentStep + 1 >= request.approvalSteps.length;
    let expenseStatus = 'UNDER_REVIEW';

    if (isLastStep) {
      expenseStatus = 'APPROVED';
      await prisma.approvalRequest.update({
        where: { id: request.id },
        data: { status: 'APPROVED' },
      });
    } else {
      await prisma.approvalRequest.update({
        where: { id: request.id },
        data: { currentStep: request.currentStep + 1 },
      });
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: { status: expenseStatus },
    });

    res.json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

export const rejectExpenseStep = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { comments } = reviewActionSchema.parse(req.body);
    const companyId = req.user!.companyId;

    if (
      !req.user!.permissions.includes('EXPENSE_APPROVE') &&
      req.user!.role !== 'ADMIN' &&
      req.user!.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenError('You do not hold permissions to reject expenses.');
    }

    const expense = await prisma.expense.findFirst({
      where: { id, companyId },
    });
    if (!expense) throw new NotFoundError('Expense not found.');
    if (expense.status !== 'UNDER_REVIEW') {
      throw new BadRequestError('Expense is not in review.');
    }

    const request = await prisma.approvalRequest.findFirst({
      where: { companyId, module: 'EXPENSE', recordId: id },
      include: { approvalSteps: { orderBy: { stepNumber: 'asc' } } },
    });
    if (!request) throw new NotFoundError('Workflow request details missing.');

    const activeStep = request.approvalSteps.find((s) => s.stepNumber === request.currentStep);
    if (!activeStep) throw new BadRequestError('No active step found.');

    const userRole = req.user!.role;
    const isMatched = userRole === activeStep.roleName || 
      (activeStep.roleName === 'ACCOUNTS' && userRole.startsWith('ACCOUNT')) ||
      (activeStep.roleName === 'ADMIN' && userRole.startsWith('ADMIN')) ||
      userRole === 'SUPER_ADMIN';
    if (!isMatched) {
      throw new ForbiddenError(
        `Only users holding the role "${activeStep.roleName}" can act on this step.`
      );
    }

    // Update step
    await prisma.approvalStep.update({
      where: { id: activeStep.id },
      data: {
        status: 'REJECTED',
        actionBy: req.user!.id,
        actionAt: new Date(),
        comments,
      },
    });

    // Update request and expense to rejected
    await prisma.approvalRequest.update({
      where: { id: request.id },
      data: { status: 'REJECTED' },
    });

    const updated = await prisma.expense.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    res.json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

export const returnExpenseStep = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { comments } = reviewActionSchema.parse(req.body);
    const companyId = req.user!.companyId;

    if (
      !req.user!.permissions.includes('EXPENSE_APPROVE') &&
      req.user!.role !== 'ADMIN' &&
      req.user!.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenError('You do not hold permissions to return expenses.');
    }

    const expense = await prisma.expense.findFirst({
      where: { id, companyId },
    });
    if (!expense) throw new NotFoundError('Expense not found.');
    if (expense.status !== 'UNDER_REVIEW') {
      throw new BadRequestError('Expense is not in review.');
    }

    const request = await prisma.approvalRequest.findFirst({
      where: { companyId, module: 'EXPENSE', recordId: id },
      include: { approvalSteps: { orderBy: { stepNumber: 'asc' } } },
    });
    if (!request) throw new NotFoundError('Workflow request details missing.');

    const activeStep = request.approvalSteps.find((s) => s.stepNumber === request.currentStep);
    if (!activeStep) throw new BadRequestError('No active step found.');

    const userRole = req.user!.role;
    const isMatched = userRole === activeStep.roleName || 
      (activeStep.roleName === 'ACCOUNTS' && userRole.startsWith('ACCOUNT')) ||
      (activeStep.roleName === 'ADMIN' && userRole.startsWith('ADMIN')) ||
      userRole === 'SUPER_ADMIN';
    if (!isMatched) {
      throw new ForbiddenError(
        `Only users holding the role "${activeStep.roleName}" can act on this step.`
      );
    }

    // Update step
    await prisma.approvalStep.update({
      where: { id: activeStep.id },
      data: {
        status: 'RETURNED',
        actionBy: req.user!.id,
        actionAt: new Date(),
        comments,
      },
    });

    // Update request and expense
    await prisma.approvalRequest.update({
      where: { id: request.id },
      data: { status: 'RETURNED' },
    });

    const updated = await prisma.expense.update({
      where: { id },
      data: { status: 'RETURNED_FOR_CORRECTION' },
    });

    res.json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

export const payExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { accountId, paymentReference } = payoutSchema.parse(req.body);
    const companyId = req.user!.companyId;
    const paymentProofUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

    // Check permission
    if (!req.user!.permissions.includes('PAYMENT_CREATE') && req.user!.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError(
        'You do not hold permissions to record payments or settle expenses.'
      );
    }

    const expense = await prisma.expense.findFirst({
      where: { id, companyId },
    });
    if (!expense) throw new NotFoundError('Expense not found.');

    if (expense.status !== 'APPROVED') {
      throw new BadRequestError('Reimbursement is only permitted for APPROVED expense requests.');
    }

    // Run database balance checks and settlement transactions inside OCC sequential lock block
    const result = await prisma.$transaction(
      async (tx) => {
        const account = await tx.account.findFirst({
          where: { id: accountId, companyId, status: 'ACTIVE', deletedAt: null },
        });

        if (!account) {
          throw new NotFoundError('Payout cash/bank account not found or deactivated.');
        }

        // Check balance
        if (account.currentBalance < expense.amount) {
          throw new BadRequestError(
            `Insufficient balance in account: current balance is ${account.currentBalance}`
          );
        }

        // 1. Decrement account balance
        const updatedAccount = await tx.account.update({
          where: { id: accountId },
          data: {
            currentBalance: { decrement: expense.amount },
            version: { increment: 1 },
          },
        });

        // 2. Transition expense status and save proofs
        const updatedExpense = await tx.expense.update({
          where: { id: expense.id },
          data: { 
            status: 'REIMBURSED',
            paymentReference: paymentReference || null,
            paymentProofUrl: paymentProofUrl || null
          },
        });

        // 3. Generate transaction numbers and voucher numbers
        const trxPrefix = `TX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
        const trxCount = await tx.transaction.count({
          where: { companyId, transactionNo: { startsWith: trxPrefix } },
        });
        const transactionNo = `${trxPrefix}-${(trxCount + 1).toString().padStart(4, '0')}`;

        const vchPrefix = 'VCH-PAY';
        const vchCount = await tx.voucher.count({
          where: { companyId, voucherNo: { startsWith: vchPrefix } },
        });
        const voucherNo = `${vchPrefix}-${(vchCount + 1).toString().padStart(5, '0')}`;

        // 4. Create Transaction Ledger record
        const transaction = await tx.transaction.create({
          data: {
            companyId,
            transactionNo,
            type: 'PAYMENT_OUT',
            category: 'STAFF_REIMBURSEMENT',
            date: new Date(),
            amount: expense.amount,
            runningBalance: updatedAccount.currentBalance,
            accountId,
            purpose: `Reimbursement for expense ${expense.expenseNo}: ${expense.purpose}`,
            paymentMode: expense.paymentMode,
            employeeId: expense.employeeId,
            expenseId: expense.id,
            createdBy: req.user!.id,
          },
        });

        // 5. Create Voucher
        const voucher = await tx.voucher.create({
          data: {
            companyId,
            voucherNo,
            transactionId: transaction.id,
          },
        });

        return {
          expense: updatedExpense,
          account: updatedAccount,
          transaction,
          voucher,
        };
      },
      { timeout: 15000 }
    );

    res.json({
      status: 'success',
      message: 'Expense successfully settled and reimbursed.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
export const deleteExpense = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.companyId!;

    const expense = await prisma.expense.findFirst({
      where: { id, companyId },
    });

    if (!expense) throw new NotFoundError('Expense not found');

    if (expense.status === 'REIMBURSED') {
      throw new BadRequestError('Cannot delete a reimbursed expense because a financial transaction exists.');
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete associated approval request and its steps (Cascade handles steps)
      await tx.approvalRequest.deleteMany({
        where: { recordId: id, module: 'EXPENSE' },
      });

      // 2. Delete the expense
      await tx.expense.delete({
        where: { id },
      });
    });

    sendSuccess(res, 'Expense deleted successfully');
  } catch (err) {
    next(err);
  }
};
