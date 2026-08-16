import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { z } from 'zod';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';

// ─────────────────────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────────────────────
const createAdvanceSchema = z.object({
  employeeId: z.string().uuid(),
  amount: z.number().positive('Amount must be positive'),
  purpose: z.string().min(5, 'Purpose must be at least 5 characters'),
  dateNeeded: z.string().transform((v) => new Date(v)),
  submitDirectly: z.boolean().optional().default(false),
});

const updateAdvanceSchema = z.object({
  amount: z.number().positive().optional(),
  purpose: z.string().min(5).optional(),
  dateNeeded: z
    .string()
    .transform((v) => new Date(v))
    .optional(),
});

const actionSchema = z.object({
  comments: z.string().optional(),
});

const disburseSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
});

const settleSchema = z.object({
  items: z
    .array(
      z.object({
        categoryId: z.string().min(1, 'Category required'),
        amount: z.number().positive('Item amount must be positive'),
        description: z.string().min(3, 'Description required'),
      })
    )
    .min(1, 'At least one settlement item is required'),
});

const returnCashSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  amount: z.number().positive('Return amount must be positive'),
});

// ─────────────────────────────────────────────────────────────
// Helper: build sequential ApprovalRequest for an advance
// ─────────────────────────────────────────────────────────────
async function createApprovalWorkflow(companyId: string, advanceId: string, amount: number) {
  const rules = await prisma.approvalRule.findMany({
    where: {
      companyId,
      module: 'ADVANCE',
      minAmount: { lte: amount },
      maxAmount: { gte: amount },
    },
  });

  let roleNames = ['ADMIN']; // Default fallback if no rules are configured
  
  if (rules.length > 0) {
    roleNames = rules[0].approverRoles.split(',').map((r) => r.trim());
  }

  const request = await prisma.approvalRequest.create({
    data: {
      companyId,
      module: 'ADVANCE',
      recordId: advanceId,
      status: 'PENDING',
      currentStep: 0,
    },
  });

  for (let i = 0; i < roleNames.length; i++) {
    await prisma.approvalStep.create({
      data: {
        approvalRequestId: request.id,
        stepNumber: i,
        roleName: roleNames[i],
        status: 'PENDING',
      },
    });
  }

  return request;
}

// ─────────────────────────────────────────────────────────────
// Helper: generate unique advance number
// ─────────────────────────────────────────────────────────────
async function generateAdvanceNo(companyId: string): Promise<string> {
  const prefix = `ADV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  const count = await prisma.advance.count({
    where: { companyId, advanceNo: { startsWith: prefix } },
  });
  return `${prefix}-${(count + 1).toString().padStart(4, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// GET /advances
// ─────────────────────────────────────────────────────────────
export const getAdvances = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const role = req.user!.role;

    // STAFF sees only their own (via employeeId on their user record)
    const where: Record<string, unknown> = { companyId };
    const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'ACCOUNTS' || role.startsWith('ADMIN') || role.startsWith('ACCOUNT');
    if (!isAdmin && req.user!.employeeId) {
      where.employeeId = req.user!.employeeId;
    }

    const advances = await prisma.advance.findMany({
      where,
      include: {
        employee: { select: { name: true, employeeCode: true } },
        disburseAccount: { select: { name: true } },
        settlements: {
          include: { category: { select: { name: true } } },
        },
        // Include related transactions (e.g., advance returns) so frontend can show returned cash entries
        transactions: {
          include: {
            account: { select: { name: true } },
            vouchers: { select: { voucherNo: true } },
            creator: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Attach approval request info
    const enriched = await Promise.all(
      advances.map(async (adv) => {
        const approvalRequest = await prisma.approvalRequest.findFirst({
          where: { module: 'ADVANCE', recordId: adv.id },
          include: { approvalSteps: { orderBy: { stepNumber: 'asc' } } },
        });
        return { ...adv, approvalRequest };
      })
    );

    res.json({ status: 'success', data: enriched });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /advances  — create draft or submit directly
// ─────────────────────────────────────────────────────────────
export const createAdvance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const validated = createAdvanceSchema.parse(req.body);

    // Verify employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: { id: validated.employeeId, companyId },
    });
    if (!employee) throw new NotFoundError('Employee not found.');

    const advanceNo = await generateAdvanceNo(companyId);

    const advance = await prisma.advance.create({
      data: {
        companyId,
        advanceNo,
        employeeId: validated.employeeId,
        amount: validated.amount,
        purpose: validated.purpose,
        dateNeeded: validated.dateNeeded,
        status: validated.submitDirectly ? 'SUBMITTED' : 'DRAFT',
        outstandingAmount: validated.amount,
        createdBy: req.user!.id,
      },
    });

    if (validated.submitDirectly) {
      const workflow = await createApprovalWorkflow(companyId, advance.id, validated.amount);
      if (workflow) {
        await prisma.advance.update({
          where: { id: advance.id },
          data: { status: 'UNDER_REVIEW' },
        });
      } else {
        // No rule — auto-approve
        await prisma.advance.update({
          where: { id: advance.id },
          data: { status: 'APPROVED' },
        });
      }
    }

    const result = await prisma.advance.findUnique({
      where: { id: advance.id },
      include: { employee: { select: { name: true } } },
    });

    res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /advances/:id — update draft/returned advance
// ─────────────────────────────────────────────────────────────
export const updateAdvance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;
    const validated = updateAdvanceSchema.parse(req.body);

    const advance = await prisma.advance.findFirst({ where: { id, companyId } });
    if (!advance) throw new NotFoundError('Advance not found.');
    if (!['DRAFT', 'RETURNED_FOR_CORRECTION', 'REJECTED'].includes(advance.status)) {
      throw new BadRequestError('Only DRAFT, RETURNED, or REJECTED advances can be edited.');
    }

    const updated = await prisma.advance.update({
      where: { id },
      data: {
        ...(validated.amount !== undefined && {
          amount: validated.amount,
          outstandingAmount: validated.amount,
        }),
        ...(validated.purpose !== undefined && { purpose: validated.purpose }),
        ...(validated.dateNeeded !== undefined && { dateNeeded: validated.dateNeeded }),
      },
    });

    res.json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /advances/:id/submit
// ─────────────────────────────────────────────────────────────
export const submitAdvance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;

    const advance = await prisma.advance.findFirst({ where: { id, companyId } });
    if (!advance) throw new NotFoundError('Advance not found.');
    if (!['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(advance.status)) {
      throw new BadRequestError('Only DRAFT or RETURNED advances can be submitted.');
    }

    // Delete old approval request if exists (resubmission)
    const existing = await prisma.approvalRequest.findFirst({
      where: { module: 'ADVANCE', recordId: id },
    });
    if (existing) {
      await prisma.approvalStep.deleteMany({ where: { approvalRequestId: existing.id } });
      await prisma.approvalRequest.delete({ where: { id: existing.id } });
    }

    const workflow = await createApprovalWorkflow(companyId, id, advance.amount);

    const newStatus = workflow ? 'UNDER_REVIEW' : 'APPROVED';
    const updated = await prisma.advance.update({
      where: { id },
      data: { status: newStatus },
    });

    res.json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /advances/:id/approve
// ─────────────────────────────────────────────────────────────
export const approveAdvance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;
    const { comments } = actionSchema.parse(req.body);
    const actorRole = req.user!.role;

    const advance = await prisma.advance.findFirst({ where: { id, companyId } });
    if (!advance) throw new NotFoundError('Advance not found.');
    if (advance.status !== 'UNDER_REVIEW') {
      throw new BadRequestError('Only advances UNDER_REVIEW can be approved.');
    }

    const approvalRequest = await prisma.approvalRequest.findFirst({
      where: { module: 'ADVANCE', recordId: id },
      include: { approvalSteps: { orderBy: { stepNumber: 'asc' } } },
    });
    if (!approvalRequest) throw new NotFoundError('Approval workflow not found.');

    const activeStep = approvalRequest.approvalSteps[approvalRequest.currentStep];
    if (!activeStep) throw new BadRequestError('No active approval step found.');

    const isMatched = actorRole === activeStep.roleName || 
      (activeStep.roleName === 'ACCOUNTS' && actorRole.startsWith('ACCOUNT')) ||
      (activeStep.roleName === 'ADMIN' && actorRole.startsWith('ADMIN')) ||
      actorRole === 'SUPER_ADMIN';
    if (!isMatched) {
      throw new ForbiddenError(
        `Only users holding the role "${activeStep.roleName}" can approve this step.`
      );
    }

    await prisma.approvalStep.update({
      where: { id: activeStep.id },
      data: {
        status: 'APPROVED',
        actionBy: req.user!.id,
        actionAt: new Date(),
        comments,
      },
    });

    const nextStep = approvalRequest.currentStep + 1;
    const isFinal = nextStep >= approvalRequest.approvalSteps.length;

    if (isFinal) {
      await prisma.approvalRequest.update({
        where: { id: approvalRequest.id },
        data: { status: 'APPROVED', currentStep: nextStep },
      });
      await prisma.advance.update({ where: { id }, data: { status: 'APPROVED' } });
    } else {
      await prisma.approvalRequest.update({
        where: { id: approvalRequest.id },
        data: { currentStep: nextStep },
      });
    }

    const updated = await prisma.advance.findUnique({ where: { id } });
    res.json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /advances/:id/reject
// ─────────────────────────────────────────────────────────────
export const rejectAdvance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;
    const { comments } = actionSchema.parse(req.body);
    const actorRole = req.user!.role;

    const advance = await prisma.advance.findFirst({ where: { id, companyId } });
    if (!advance) throw new NotFoundError('Advance not found.');
    if (advance.status !== 'UNDER_REVIEW')
      throw new BadRequestError('Only advances under review can be rejected.');

    const approvalRequest = await prisma.approvalRequest.findFirst({
      where: { module: 'ADVANCE', recordId: id },
      include: { approvalSteps: { orderBy: { stepNumber: 'asc' } } },
    });
    if (!approvalRequest) throw new NotFoundError('Approval workflow not found.');

    const activeStep = approvalRequest.approvalSteps[approvalRequest.currentStep];
    const isMatched = actorRole === activeStep.roleName || 
      (activeStep.roleName === 'ACCOUNTS' && actorRole.startsWith('ACCOUNT')) ||
      (activeStep.roleName === 'ADMIN' && actorRole.startsWith('ADMIN')) ||
      actorRole === 'SUPER_ADMIN';
    if (!isMatched) {
      throw new ForbiddenError(
        `Only users holding the role "${activeStep.roleName}" can act on this step.`
      );
    }

    await prisma.approvalStep.update({
      where: { id: activeStep.id },
      data: { status: 'REJECTED', actionBy: req.user!.id, actionAt: new Date(), comments },
    });
    await prisma.approvalRequest.update({
      where: { id: approvalRequest.id },
      data: { status: 'REJECTED' },
    });
    const updated = await prisma.advance.update({ where: { id }, data: { status: 'REJECTED' } });

    res.json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /advances/:id/return
// ─────────────────────────────────────────────────────────────
export const returnAdvance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;
    const { comments } = actionSchema.parse(req.body);
    const actorRole = req.user!.role;

    const advance = await prisma.advance.findFirst({ where: { id, companyId } });
    if (!advance) throw new NotFoundError('Advance not found.');
    if (advance.status !== 'UNDER_REVIEW')
      throw new BadRequestError('Only advances under review can be returned.');

    const approvalRequest = await prisma.approvalRequest.findFirst({
      where: { module: 'ADVANCE', recordId: id },
      include: { approvalSteps: { orderBy: { stepNumber: 'asc' } } },
    });
    if (!approvalRequest) throw new NotFoundError('Approval workflow not found.');

    const activeStep = approvalRequest.approvalSteps[approvalRequest.currentStep];
    const isMatched = actorRole === activeStep.roleName || 
      (activeStep.roleName === 'ACCOUNTS' && actorRole.startsWith('ACCOUNT')) ||
      (activeStep.roleName === 'ADMIN' && actorRole.startsWith('ADMIN')) ||
      actorRole === 'SUPER_ADMIN';
    if (!isMatched) {
      throw new ForbiddenError(
        `Only users holding the role "${activeStep.roleName}" can act on this step.`
      );
    }

    await prisma.approvalStep.update({
      where: { id: activeStep.id },
      data: { status: 'RETURNED', actionBy: req.user!.id, actionAt: new Date(), comments },
    });
    await prisma.approvalRequest.update({
      where: { id: approvalRequest.id },
      data: { status: 'RETURNED' },
    });
    const updated = await prisma.advance.update({
      where: { id },
      data: { status: 'RETURNED_FOR_CORRECTION' },
    });

    res.json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /advances/:id/disburse — pay advance to employee
// ─────────────────────────────────────────────────────────────
export const disburseAdvance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { accountId } = disburseSchema.parse(req.body);
    const companyId = req.user!.companyId;

    const advance = await prisma.advance.findFirst({
      where: { id, companyId },
      include: { employee: { select: { name: true } } },
    });
    if (!advance) throw new NotFoundError('Advance not found.');
    if (advance.status !== 'APPROVED')
      throw new BadRequestError('Only APPROVED advances can be disbursed.');

    const result = await prisma.$transaction(
      async (tx) => {
        const account = await tx.account.findFirst({
          where: { id: accountId, companyId, status: 'ACTIVE', deletedAt: null },
        });
        if (!account) throw new NotFoundError('Account not found.');
        if (account.currentBalance < advance.amount) {
          throw new BadRequestError(`Insufficient balance. Available: ₹${account.currentBalance}`);
        }

        // Decrement account
        const updatedAccount = await tx.account.update({
          where: { id: accountId },
          data: { currentBalance: { decrement: advance.amount }, version: { increment: 1 } },
        });

        // Generate numbers
        const trxPrefix = `TX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
        const trxCount = await tx.transaction.count({
          where: { companyId, transactionNo: { startsWith: trxPrefix } },
        });
        const transactionNo = `${trxPrefix}-${(trxCount + 1).toString().padStart(4, '0')}`;

        const vchPrefix = 'VCH-ADV';
        const vchCount = await tx.voucher.count({
          where: { companyId, voucherNo: { startsWith: vchPrefix } },
        });
        const voucherNo = `${vchPrefix}-${(vchCount + 1).toString().padStart(5, '0')}`;

        // Ledger entry
        const transaction = await tx.transaction.create({
          data: {
            companyId,
            transactionNo,
            type: 'PAYMENT_OUT',
            category: 'STAFF_ADVANCE',
            date: new Date(),
            amount: advance.amount,
            runningBalance: updatedAccount.currentBalance,
            accountId,
            purpose: `Staff Advance disbursed to ${advance.employee.name} — ${advance.advanceNo}`,
            paymentMode: 'CASH',
            employeeId: advance.employeeId,
            advanceId: advance.id,
            createdBy: req.user!.id,
          },
        });

        // Voucher
        await tx.voucher.create({
          data: { companyId, voucherNo, transactionId: transaction.id },
        });

        // Update advance status
        const updatedAdvance = await tx.advance.update({
          where: { id },
          data: {
            status: 'SETTLEMENT_PENDING',
            disburseAccountId: accountId,
            disbursedAt: new Date(),
          },
        });

        return { advance: updatedAdvance, account: updatedAccount, transaction };
      },
      { timeout: 15000 }
    );

    res.json({ status: 'success', message: 'Advance disbursed successfully.', data: result });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /advances/:id/settle — employee submits how advance was used
// ─────────────────────────────────────────────────────────────
export const settleAdvance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;
    const { items } = settleSchema.parse(req.body);

    const advance = await prisma.advance.findFirst({ where: { id, companyId } });
    if (!advance) throw new NotFoundError('Advance not found.');
    if (advance.status !== 'SETTLEMENT_PENDING') {
      throw new BadRequestError('Only SETTLEMENT_PENDING advances can be settled.');
    }

    const totalUsed = items.reduce((sum, item) => sum + item.amount, 0);
    // Use the current outstandingAmount for calculations. Using the original advance.amount
    // can produce incorrect outstanding values if prior returns/adjustments happened.
    const baseOutstanding = advance.outstandingAmount ?? advance.amount;
    const surplus = baseOutstanding - totalUsed; // positive → Case B (return), negative → Case C (reimburse more)

    // Verify all categories exist
    for (const item of items) {
      const cat = await prisma.expenseCategory.findFirst({
        where: { id: item.categoryId, companyId, status: 'ACTIVE' },
      });
      if (!cat) throw new NotFoundError(`Expense category ${item.categoryId} not found.`);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create settlement line items
      const settlements = await Promise.all(
        items.map((item) =>
          tx.advanceSettlement.create({
            data: {
              advanceId: id,
              categoryId: item.categoryId,
              amount: item.amount,
              description: item.description,
            },
          })
        )
      );

      // Determine outcome
      let newStatus: string;
      let outstandingAmount: number;

      if (surplus > 0.01) {
        // Case B — less used, employee must return surplus
        newStatus = 'SETTLEMENT_PENDING'; // stays pending until cash returned
        outstandingAmount = surplus;
      } else if (surplus < -0.01) {
        // Case C — overspent, company owes extra
        newStatus = 'SETTLED';
        outstandingAmount = 0;
        // TODO: optionally trigger reimbursement flow in a future iteration
      } else {
        // Case A — exact match
        newStatus = 'SETTLED';
        outstandingAmount = 0;
      }

      const updatedAdvance = await tx.advance.update({
        where: { id },
        data: { status: newStatus, outstandingAmount },
      });

      return { advance: updatedAdvance, settlements, totalUsed, surplus };
    });

    const message =
      result.surplus > 0.01
        ? `Settlement recorded. Employee must return ₹${result.surplus.toFixed(2)} surplus.`
        : result.surplus < -0.01
          ? `Settlement recorded. Company owes ₹${Math.abs(result.surplus).toFixed(2)} additional reimbursement.`
          : 'Advance fully settled. Outstanding balance: ₹0.';

    res.json({ status: 'success', message, data: result });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /advances/:id/return-cash — employee returns surplus (Case B)
// ─────────────────────────────────────────────────────────────
export const returnCash = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { accountId, amount } = returnCashSchema.parse(req.body);
    const companyId = req.user!.companyId;

    const advance = await prisma.advance.findFirst({
      where: { id, companyId },
      include: { employee: { select: { name: true } } },
    });
    if (!advance) throw new NotFoundError('Advance not found.');
    if (advance.outstandingAmount <= 0) {
      throw new BadRequestError('No outstanding amount to return for this advance.');
    }
    if (amount > advance.outstandingAmount + 0.01) {
      throw new BadRequestError(
        `Return amount ₹${amount} exceeds outstanding ₹${advance.outstandingAmount}.`
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        // Credit account
        const updatedAccount = await tx.account.update({
          where: { id: accountId },
          data: { currentBalance: { increment: amount }, version: { increment: 1 } },
        });

        // Generate numbers
        const trxPrefix = `TX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
        const trxCount = await tx.transaction.count({
          where: { companyId, transactionNo: { startsWith: trxPrefix } },
        });
        const transactionNo = `${trxPrefix}-${(trxCount + 1).toString().padStart(4, '0')}`;

        const vchPrefix = 'VCH-ADV';
        const vchCount = await tx.voucher.count({
          where: { companyId, voucherNo: { startsWith: vchPrefix } },
        });
        const voucherNo = `${vchPrefix}-${(vchCount + 1).toString().padStart(5, '0')}`;

        // PAYMENT_IN ledger entry
        const transaction = await tx.transaction.create({
          data: {
            companyId,
            transactionNo,
            type: 'PAYMENT_IN',
            category: 'ADVANCE_RETURN',
            date: new Date(),
            amount,
            runningBalance: updatedAccount.currentBalance,
            accountId,
            purpose: `Advance surplus returned by ${advance.employee.name} — ${advance.advanceNo}`,
            paymentMode: 'CASH',
            employeeId: advance.employeeId,
            advanceId: advance.id,
            createdBy: req.user!.id,
          },
        });

        // Voucher
        await tx.voucher.create({
          data: { companyId, voucherNo, transactionId: transaction.id },
        });

        // Update outstanding
        const newOutstanding = Math.max(0, advance.outstandingAmount - amount);
        const updatedAdvance = await tx.advance.update({
          where: { id },
          data: {
            outstandingAmount: newOutstanding,
            status: newOutstanding < 0.01 ? 'SETTLED' : 'SETTLEMENT_PENDING',
          },
        });

        return { advance: updatedAdvance, account: updatedAccount, transaction };
      },
      { timeout: 15000 }
    );

    res.json({ status: 'success', message: 'Cash return recorded.', data: result });
  } catch (error) {
    next(error);
  }
};
