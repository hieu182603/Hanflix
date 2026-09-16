import { Router, type CookieOptions, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import type { Types } from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rate-limits.js';
import { validate } from '../middleware/validate.js';
import { RefreshSessionModel } from '../models/refresh-session.model.js';
import { UserModel } from '../models/user.model.js';
import {
  hashToken,
  newJti,
  refreshExpiry,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../services/jwt.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(80),
});

const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email() });

function cookieOptions(): CookieOptions {
  const options: CookieOptions = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: `${env.API_PREFIX}/auth`,
    maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
  if (env.COOKIE_DOMAIN) options.domain = env.COOKIE_DOMAIN;
  return options;
}

async function issueSession(user: { _id: Types.ObjectId; role: 'user' | 'admin' }, req: Request, res: Response) {
  const jti = newJti();
  const refreshToken = signRefreshToken(user._id.toString(), user.role, jti);
  await RefreshSessionModel.create({
    userId: user._id,
    jti,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiry(),
    userAgent: req.get('user-agent')?.slice(0, 500),
    ip: req.ip,
  });
  res.cookie(env.REFRESH_COOKIE_NAME, refreshToken, cookieOptions());
  return signAccessToken(user._id.toString(), user.role);
}

function publicUser(user: { _id: unknown; name: string; email: string; role: string; status: string; learningProfile?: unknown }) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    learningProfile: user.learningProfile,
  };
}

router.post('/register', authLimiter, validate(registerSchema), asyncHandler(async (req, res) => {
  const exists = await UserModel.exists({ email: req.body.email });
  if (exists) throw new AppError(409, 'EMAIL_EXISTS', 'Email đã được sử dụng');
  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const user = await UserModel.create({ name: req.body.name, email: req.body.email, passwordHash, role: 'user' });
  const accessToken = await issueSession(user, req, res);
  res.status(201).json({ data: { accessToken, user: publicUser(user) } });
}));

router.post('/login', authLimiter, validate(credentialsSchema), asyncHandler(async (req, res) => {
  const user = await UserModel.findOne({ email: req.body.email }).select('+passwordHash');
  const passwordMatches = user ? await bcrypt.compare(req.body.password, user.passwordHash) : false;
  if (!user || !passwordMatches) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
  if (user.status !== 'active') throw new AppError(423, 'ACCOUNT_LOCKED', 'Tài khoản đã bị khóa');
  const accessToken = await issueSession(user, req, res);
  res.json({ data: { accessToken, user: publicUser(user) } });
}));

router.post('/refresh', authLimiter, asyncHandler(async (req, res) => {
  const token = req.cookies?.[env.REFRESH_COOKIE_NAME] as string | undefined;
  if (!token) throw new AppError(401, 'REFRESH_REQUIRED', 'Không tìm thấy phiên làm mới');
  const claims = verifyRefreshToken(token);
  if (!claims.jti) throw new AppError(401, 'INVALID_TOKEN', 'Phiên làm mới không hợp lệ');

  const session = await RefreshSessionModel.findOneAndUpdate(
    { jti: claims.jti, tokenHash: hashToken(token), revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { revokedAt: new Date() } },
    { new: true },
  );
  if (!session) throw new AppError(401, 'REFRESH_REUSED', 'Phiên làm mới đã hết hạn hoặc đã được sử dụng');

  const user = await UserModel.findById(claims.sub);
  if (!user || user.status !== 'active') throw new AppError(401, 'ACCOUNT_UNAVAILABLE', 'Tài khoản không khả dụng');
  const replacementJti = newJti();
  const replacement = signRefreshToken(user._id.toString(), user.role, replacementJti);
  session.replacedByJti = replacementJti;
  await session.save();
  await RefreshSessionModel.create({
    userId: user._id,
    jti: replacementJti,
    tokenHash: hashToken(replacement),
    expiresAt: refreshExpiry(),
    userAgent: req.get('user-agent')?.slice(0, 500),
    ip: req.ip,
  });
  res.cookie(env.REFRESH_COOKIE_NAME, replacement, cookieOptions());
  res.json({ data: { accessToken: signAccessToken(user._id.toString(), user.role) } });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies?.[env.REFRESH_COOKIE_NAME] as string | undefined;
  if (token) {
    try {
      const claims = verifyRefreshToken(token);
      if (claims.jti) await RefreshSessionModel.updateOne({ jti: claims.jti }, { $set: { revokedAt: new Date() } });
    } catch {
      // Clear invalid or expired cookies without revealing token state.
    }
  }
  res.clearCookie(env.REFRESH_COOKIE_NAME, cookieOptions());
  res.status(204).send();
}));

router.post('/forgot-password', authLimiter, validate(forgotSchema), asyncHandler(async (_req, res) => {
  // Email delivery is intentionally not claimed until a provider and reset-token store are configured.
  res.status(202).json({ data: { accepted: true, delivery: 'not_configured' } });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.auth!.userId).lean();
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản');
  res.json({ data: { user: publicUser(user) } });
}));

export default router;
