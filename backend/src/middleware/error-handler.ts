import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { env } from '../config/env.js';
import { logger } from '../services/logger.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Không tìm thấy ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const normalized = error instanceof AppError
    ? error
    : error instanceof ZodError
      ? new AppError(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', error.flatten())
      : new AppError(500, 'INTERNAL_ERROR', 'Đã xảy ra lỗi máy chủ');

  if (normalized.statusCode >= 500) {
    // ERR-02: Use structured logger instead of console.error
    logger.error({ requestId: req.requestId, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error) }, 'Unhandled error');
  }

  res.status(normalized.statusCode).json({
    error: {
      code: normalized.code,
      message: normalized.message,
      details: normalized.details,
      requestId: req.requestId,
      ...(env.NODE_ENV === 'development' && !(error instanceof AppError)
        ? { debug: error instanceof Error ? error.message : String(error) }
        : {}),
    },
  });
};
