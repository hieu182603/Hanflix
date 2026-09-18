import multer, { MulterError } from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error.js';

const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const ALLOWED_AVATAR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

export const multerUpload = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'Chỉ hỗ trợ định dạng hình ảnh: JPEG, PNG, WebP.'
        )
      );
    }
  },
});

export const multerAvatarUpload = multer({
  storage,
  limits: {
    fileSize: MAX_AVATAR_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_AVATAR_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'Chỉ hỗ trợ định dạng hình ảnh đại diện: JPEG, PNG, WebP.'
        )
      );
    }
  },
});

/**
 * Middleware wrapper for handling single image upload and converting MulterErrors to AppErrors.
 */
export function handleSingleImageUpload(fieldName: string = 'image') {
  const upload = multerUpload.single(fieldName);

  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err: unknown) => {
      if (!err) {
        return next();
      }

      if (err instanceof MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(
              413,
              'FILE_TOO_LARGE',
              'Kích thước ảnh vượt quá giới hạn 5MB.'
            )
          );
        }
        return next(new AppError(400, 'UPLOAD_ERROR', err.message));
      }

      if (err instanceof AppError) {
        return next(err);
      }

      return next(
        new AppError(
          500,
          'UPLOAD_FAILED',
          err instanceof Error ? err.message : 'Tải file thất bại'
        )
      );
    });
  };
}

/**
 * Middleware wrapper for handling single avatar upload (JPEG, PNG, WebP only, <=5MB).
 */
export function handleSingleAvatarUpload(fieldName: string = 'file') {
  const upload = multerAvatarUpload.single(fieldName);

  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err: unknown) => {
      if (!err) {
        return next();
      }

      if (err instanceof MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(
              413,
              'FILE_TOO_LARGE',
              'Kích thước ảnh đại diện vượt quá giới hạn 2MB.'
            )
          );
        }
        return next(new AppError(400, 'UPLOAD_ERROR', err.message));
      }

      if (err instanceof AppError) {
        return next(err);
      }

      return next(
        new AppError(
          500,
          'UPLOAD_FAILED',
          err instanceof Error ? err.message : 'Tải ảnh đại diện thất bại'
        )
      );
    });
  };
}

