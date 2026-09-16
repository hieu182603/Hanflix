import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { env } from '../config/env.js';

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
    console.error({ requestId: req.requestId, error });
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
