import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/apiResponse';
import { logger } from '../config/logger';

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log the complete error stack on the server side
  logger.error({
    message: err.message,
    stack: err.stack,
    requestId: req.id,
  });

  // 1. Handle custom AppError
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.code, err.errors);
    return;
  }

  // 2. Handle Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors);
    return;
  }

  // 3. Handle Prisma known DB errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 is Unique Constraint Violation
    if (err.code === 'P2002') {
      const targets = (err.meta?.target as string[]) || [];
      const fields = targets.join(', ');
      sendError(
        res,
        `Duplicate entry. A record with this value already exists for: ${fields}`,
        409,
        'DUPLICATE_ENTRY'
      );
      return;
    }
  }

  // 4. Handle default server internal errors
  const isProduction = process.env.NODE_ENV === 'production';
  sendError(
    res,
    isProduction ? 'Internal Server Error' : err.message,
    500,
    'INTERNAL_SERVER_ERROR'
  );
};
