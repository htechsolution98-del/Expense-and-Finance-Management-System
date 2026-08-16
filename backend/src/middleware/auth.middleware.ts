import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors';
import { prisma } from '../config/database';

interface DecodedToken {
  sub: string;
  companyId: string;
  role: string;
  permissions: string[];
  employeeId: string | null;
}

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new UnauthorizedError('Access token is missing or invalid'));
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_ACCESS_SECRET || 'fallback_secret';
    const decoded = jwt.verify(token, secret) as DecodedToken;

    // Fetch user role and permissions dynamically from database to support instant changes
    prisma.user.findUnique({
      where: { id: decoded.sub },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    }).then((dbUser) => {
      if (!dbUser || dbUser.status === 'DELETED' || dbUser.status === 'INACTIVE') {
        next(new UnauthorizedError('User account is invalid or deactivated'));
        return;
      }

      const roleName = dbUser.userRoles[0]?.role.name || 'STAFF';
      // Super Admin gets a wildcard '*' so stale DB rolePermission entries never block them
      const permissions = roleName === 'SUPER_ADMIN'
        ? ['*']
        : (dbUser.userRoles[0]?.role.rolePermissions.map((rp) => rp.permission.name) || []);

      req.user = {
        id: dbUser.id,
        companyId: dbUser.companyId,
        role: roleName,
        permissions: permissions,
        employeeId: dbUser.employeeId || null,
      };

      next();
    }).catch((err) => {
      next(err);
    });
  } catch (err) {
    next(new UnauthorizedError('Token verification failed'));
  }
};
