import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/apiResponse';

export const checkHealth = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Run simple query to check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    sendSuccess(res, 'Health status ok', {
      status: 'ok',
      database: 'connected',
    });
  } catch (err) {
    next(err);
  }
};
