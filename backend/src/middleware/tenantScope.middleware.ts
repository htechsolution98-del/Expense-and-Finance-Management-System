/* eslint-disable @typescript-eslint/no-namespace */
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      companyId?: string;
      user?: {
        id: string;
        companyId: string;
        role: string;
        permissions: string[];
        employeeId: string | null;
      };
    }
  }
}

export const tenantScopeMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  // If request has been authenticated, copy the companyId from user claims
  if (req.user) {
    if (!req.user.companyId) {
      next(new ForbiddenError('Tenant company ID missing in token context'));
      return;
    }
    req.companyId = req.user.companyId;
  }
  next();
};
