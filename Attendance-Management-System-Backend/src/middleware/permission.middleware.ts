import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';

export const authorize = (requiredPermission: string | string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ForbiddenError('User context not found'));
      return;
    }

    // Wildcard '*' or SUPER_ADMIN grants access to all routes
    if (req.user.permissions.includes('*') || req.user.role === 'SUPER_ADMIN') {
      next();
      return;
    }

    // Support single permission string or array of permissions (any one match grants access)
    const perms = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const hasPermission = perms.some(p => req.user!.permissions.includes(p));

    if (!hasPermission) {
      const permLabel = Array.isArray(requiredPermission) ? requiredPermission.join(' or ') : requiredPermission;
      next(new ForbiddenError(`Required permission not granted: ${permLabel}`));
      return;
    }

    next();
  };
};
