import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { loggerMiddleware } from './middleware/logger.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import v1Router from './routes/v1';
import { sendError } from './utils/apiResponse';

const app: Express = express();

// 1. Basic Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:5174',
      'https://expense-and-finance-management-system.onrender.com',
      'https://expense-and-finance-management-system-1.onrender.com',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'Idempotency-Key'],
    credentials: true,
  })
);

// 2. Request Parser & Contexts
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

import path from 'path';
// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

app.use(requestIdMiddleware);
app.use(loggerMiddleware);

// 3. Rate Limiting (2000 requests per minute per IP)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2000,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
    code: 'TOO_MANY_REQUESTS',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// 4. API Endpoints Version 1
app.use('/api/v1', v1Router);

// 5. Serve static frontend in production
const frontendDistPath = path.join(__dirname, '../../../frontend/dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(frontendDistPath));
}

// 6. Catch-all 404 / SPA router support
app.use((req: Request, res: Response, _next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    return sendError(res, 'Resource not found', 404, 'NOT_FOUND');
  }
  if (process.env.NODE_ENV === 'production') {
    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  }
  sendError(res, 'Resource not found', 404, 'NOT_FOUND');
});

// 6. Global Centralized Error Middleware
app.use(errorMiddleware);

export default app;
