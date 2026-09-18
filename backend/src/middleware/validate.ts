import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors/app-error.js';

type Target = 'body' | 'params';

export const validate = (schema: ZodType, target: Target = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      next(new AppError(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', result.error.flatten()));
      return;
    }
    // SECURITY: Replace entire object with sanitized data instead of merging
    // to prevent mass assignment via extra fields in req.body
    (req as unknown as Record<string, unknown>)[target] = result.data;
    next();
  };

// Separate validator for query params - uses custom property to avoid Node.js 20+ readonly issue
export const validateQuery = (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new AppError(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', result.error.flatten()));
      return;
    }
    // Store parsed query in a custom accessible property
    (req as unknown as Record<string, unknown>).parsedQuery = result.data;
    next();
  };
