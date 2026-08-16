import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  code?: string;
  errors?: unknown[];
}

export const sendSuccess = <T>(
  res: Response,
  message: string,
  data?: T,
  statusCode = 200
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 400,
  code?: string,
  errors?: unknown[]
): Response => {
  const responseBody: ApiResponse = {
    success: false,
    message,
    code: code || 'BAD_REQUEST',
    errors: errors || [],
  };
  return res.status(statusCode).json(responseBody);
};
