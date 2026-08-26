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

    // Check if the user is a Global Master Admin (SUPER_ADMIN of seed company '00000000-0000-0000-0000-000000000000')
    const isGlobalMasterAdmin =
      req.user.role === 'SUPER_ADMIN' &&
      req.user.companyId === '00000000-0000-0000-0000-000000000000';

    const switchCompanyHeader = req.headers['x-switch-company'];

    if (isGlobalMasterAdmin && switchCompanyHeader && typeof switchCompanyHeader === 'string' && switchCompanyHeader.trim() !== '') {
      req.companyId = switchCompanyHeader;
      req.user.companyId = switchCompanyHeader;
    } else {
      req.companyId = req.user.companyId;
    }
  }
  next();
};
