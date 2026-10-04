import type { RequestHandler } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { UserModel } from '../models/user.model.js';
import { verifyAccessToken } from '../services/jwt.js';
import { asyncHandler } from '../utils/async-handler.js';

export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const authorization = req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập');
  }
  const claims = verifyAccessToken(authorization.slice(7));
  if (!Types.ObjectId.isValid(claims.sub)) {
    throw new AppError(401, 'INVALID_TOKEN', 'Phiên đăng nhập không hợp lệ');
  }
  const user = await UserModel.findById(claims.sub).select('_id role status premiumExpiresAt premiumStartedAt premiumTrial learningProfile.currentHsk emailVerifiedAt +emailVerificationRequired').lean();
  if (!user || user.status !== 'active') {
    throw new AppError(401, 'ACCOUNT_UNAVAILABLE', 'Tài khoản không khả dụng');
  }
  if (user.emailVerificationRequired && !user.emailVerifiedAt) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Hãy xác minh email trước khi tiếp tục');
  }
  req.auth = { userId: user._id, role: user.role, premiumExpiresAt: user.premiumExpiresAt, premiumStartedAt: user.premiumStartedAt, premiumTrial: user.premiumTrial, currentHsk: user.learningProfile?.currentHsk };
  next();
});

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.auth?.role !== 'admin') {
    next(new AppError(403, 'ADMIN_REQUIRED', 'Bạn không có quyền quản trị'));
    return;
  }
  next();
};
