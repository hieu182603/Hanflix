import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors/app-error.js';

type Target = 'body' | 'params' | 'query';

export const validate = (schema: ZodType, target: Target = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      next(new AppError(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', result.error.flatten()));
      return;
    }
    Object.assign(req[target], result.data);
    next();
  };
