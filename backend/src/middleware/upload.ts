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

/**
 * SECURITY (H-2): MIME sniffing magic bytes. The HTTP Content-Type header is set by the
 * client and is trivially spoofable. We verify the actual file signature ("magic bytes")
 * to defend against polyglot files (e.g. a malicious script disguised as a JPEG).
 *
 * Each signature is read from the FIRST 12 bytes of the uploaded buffer.
 */
const MAGIC_BYTES: Record<string, { signature: number[]; offset: number }> = {
  'image/jpeg': { signature: [0xff, 0xd8, 0xff], offset: 0 },
  'image/png': { signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0 },
  // WebP: RIFF container. Bytes 0-3 = "RIFF", bytes 8-11 = "WEBP".
  'image/webp': { signature: [0x52, 0x49, 0x46, 0x46, 0x57, 0x45, 0x42, 0x50], offset: 0 },
};

function matchesMagic(buffer: Buffer, mime: string): boolean {
  const rule = MAGIC_BYTES[mime];
  if (!rule) return false;
  if (buffer.length < rule.signature.length) return false;
  for (let index = 0; index < rule.signature.length; index += 1) {
    if (buffer[rule.offset + index] !== rule.signature[index]) return false;
  }
  return true;
}

/**
 * Verify the uploaded buffer's actual magic bytes match its claimed MIME type.
 * Throws AppError(415) on mismatch so attackers cannot smuggle polyglot payloads.
 */
function assertImageSignature(buffer: Buffer, declaredMime: string): void {
  const mime = declaredMime.toLowerCase();
  if (!matchesMagic(buffer, mime)) {
    throw new AppError(
      415,
      'INVALID_FILE_SIGNATURE',
      'Nội dung file không khớp định dạng đã khai báo. Vui lòng thử lại với ảnh JPEG/PNG/WebP hợp lệ.',
    );
  }
}

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
 * SECURITY (H-2): Performs post-upload magic-byte verification so a spoofed Content-Type
 * header cannot smuggle polyglot files into Cloudinary.
 */
export function handleSingleImageUpload(fieldName: string = 'image') {
  const upload = multerUpload.single(fieldName);

  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err: unknown) => {
      if (err) return handleMulterError(err, next, MAX_IMAGE_BYTES);

      if (req.file) {
        try {
          assertImageSignature(req.file.buffer, req.file.mimetype);
        } catch (verifyError) {
          return next(verifyError);
        }
      }
      return next();
    });
  };
}

function handleMulterError(err: unknown, next: NextFunction, maxBytes: number) {
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const limitMb = Math.round((maxBytes / 1024 / 1024) * 10) / 10;
      return next(
        new AppError(
          413,
          'FILE_TOO_LARGE',
          `Kích thước ảnh vượt quá giới hạn ${limitMb}MB.`
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
}

/**
 * Middleware wrapper for handling single avatar upload (JPEG, PNG, WebP only, <=2MB).
 * SECURITY (H-2): Performs magic-byte verification after multer accepts the file.
 */
export function handleSingleAvatarUpload(fieldName: string = 'file') {
  const upload = multerAvatarUpload.single(fieldName);

  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err: unknown) => {
      if (err) return handleMulterError(err, next, MAX_AVATAR_BYTES);

      if (req.file) {
        try {
          assertImageSignature(req.file.buffer, req.file.mimetype);
        } catch (verifyError) {
          return next(verifyError);
        }
      }
      return next();
    });
  };
}

