import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ForbiddenError } from '../utils/errors';

export const subscriptionGuard = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return next();
    }

    // Skip verification for system master admin company
    if (companyId === '00000000-0000-0000-0000-000000000000') {
      return next();
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
      },
    });

    if (!company) {
      return next();
    }

    const now = new Date();

    if (company.subscriptionStatus === 'ACTIVE') {
      if (company.subscriptionEndsAt && company.subscriptionEndsAt > now) {
        return next();
      }
    } else if (company.subscriptionStatus === 'TRIAL') {
      if (company.trialEndsAt && company.trialEndsAt > now) {
        return next();
      }
    }

    // Otherwise, block access
    throw new ForbiddenError(
      'Your trial/subscription has expired. Please renew your subscription to continue using the platform.',
      'SUBSCRIPTION_EXPIRED'
    );
  } catch (error) {
    next(error);
  }
};
