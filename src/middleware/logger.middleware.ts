import { Request } from 'express';
import pinoHttp from 'pino-http';
import { logger } from '../config/logger';

export const loggerMiddleware = pinoHttp({
  logger,
  genReqId: (req: Request) => req.id || req.headers['x-request-id'] || 'anonymous',
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      headers: {
        host: req.headers.host,
        'user-agent': req.headers['user-agent'],
      },
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});
