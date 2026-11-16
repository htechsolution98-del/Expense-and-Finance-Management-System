import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { z } from 'zod';
import { NotFoundError } from '../utils/errors';

// Schema for validation
const ruleSchema = z.object({
  module: z.enum(['EXPENSE', 'ADVANCE', 'SALARY', 'BANK_ACCOUNT', 'PAYMENT_OUT', 'PAYMENT_IN']),
  minAmount: z.number().min(0),
  maxAmount: z.number().min(0),
  approverRoles: z.string().min(1),
}).refine(data => data.minAmount < data.maxAmount, {
  message: "minAmount must be less than maxAmount",
  path: ["maxAmount"]
});

export const getRules = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = (req as any).user;
    const rules = await prisma.approvalRule.findMany({
      where: { companyId },
      orderBy: [
        { module: 'asc' },
        { minAmount: 'asc' }
      ]
    });
    res.json({ status: 'success', data: rules });
  } catch (error) {
    next(error);
  }
};

export const createRule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = (req as any).user;
    const data = ruleSchema.parse(req.body);

    const rule = await prisma.approvalRule.create({
      data: {
        ...data,
        companyId,
      },
    });

    res.status(201).json({ status: 'success', data: rule });
  } catch (error) {
    next(error);
  }
};

export const updateRule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = (req as any).user;
    const { id } = req.params;
    const data = ruleSchema.parse(req.body);

    const existing = await prisma.approvalRule.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundError('Rule not found');
    }

    const rule = await prisma.approvalRule.update({
      where: { id },
      data,
    });

    res.json({ status: 'success', data: rule });
  } catch (error) {
    next(error);
  }
};

export const deleteRule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = (req as any).user;
    const { id } = req.params;

    const existing = await prisma.approvalRule.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundError('Rule not found');
    }

    await prisma.approvalRule.delete({
      where: { id },
    });

    res.json({ status: 'success', data: null });
  } catch (error) {
    next(error);
  }
};
