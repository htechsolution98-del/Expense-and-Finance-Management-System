import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/apiResponse';
import { NotFoundError } from '../utils/errors';

const createCategorySchema = z.object({
  name: z.string().min(2),
  type: z.enum(['PAYMENT_IN', 'PAYMENT_OUT', 'BOTH']).default('BOTH'),
});

const updateCategorySchema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(['PAYMENT_IN', 'PAYMENT_OUT', 'BOTH']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { type } = req.query;

    const where: any = { companyId, deletedAt: null };
    if (type) {
      where.type = { in: [type, 'BOTH'] };
    }

    const categories = await prisma.paymentCategory.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    sendSuccess(res, 'Payment categories retrieved successfully', categories);
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { name, type } = createCategorySchema.parse(req.body);

    const category = await prisma.paymentCategory.create({
      data: {
        companyId,
        name,
        type,
      },
    });

    sendSuccess(res, 'Payment category created successfully', category, 201);
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.companyId!;
    const { name, type, status } = updateCategorySchema.parse(req.body);

    const category = await prisma.paymentCategory.findFirst({
      where: { id, companyId, deletedAt: null },
    });

    if (!category) throw new NotFoundError('Payment category not found');

    const updatedCategory = await prisma.paymentCategory.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(status && { status }),
      },
    });

    sendSuccess(res, 'Payment category updated successfully', updatedCategory);
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.companyId!;

    const category = await prisma.paymentCategory.findFirst({
      where: { id, companyId, deletedAt: null },
    });

    if (!category) throw new NotFoundError('Payment category not found');

    await prisma.paymentCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    sendSuccess(res, 'Payment category deleted successfully');
  } catch (err) {
    next(err);
  }
};
