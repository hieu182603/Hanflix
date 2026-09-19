import { Router, type CookieOptions, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter, refreshLimiter } from '../middleware/rate-limits.js';
import { validate } from '../middleware/validate.js';
import { RefreshSessionModel } from '../models/refresh-session.model.js';
import { UserModel } from '../models/user.model.js';
import { accountTokenService } from '../services/account-token.js';
import { googleIdentityService } from '../services/google-identity.js';
import { logger } from '../services/logger.js';
import { mailService } from '../services/mailer.js';
import {
  hashToken,
  newJti,
  refreshExpiry,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../services/jwt.js';
import { asyncHandler } from '../utils/async-handler.js';
import { generateDefaultAvatarConfig } from '../utils/avatar-generator.js';

const router = Router();

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(80),
});

const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email() });
const accountTokenSchema = z.object({ token: z.string().trim().min(32).max(512) }).strict();
const otpSchema = z.object({ email: z.string().trim().toLowerCase().email(), code: z.string().regex(/^\d{6}$/) }).strict();
const accountProofSchema = z.union([accountTokenSchema, otpSchema]);
const resetPasswordSchema = z.union([
  accountTokenSchema.extend({ password: z.string().min(8).max(128) }),
  otpSchema.extend({ password: z.string().min(8).max(128) }),
]);
const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string().min(8).max(128),
}).refine(value => value.currentPassword !== value.newPassword, {
  path: ['newPassword'], message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
});
const googleCredentialSchema = z.object({ credential: z.string().min(100).max(10000) });
const sessionIdSchema = z.object({ sessionId: z.string().refine(Types.ObjectId.isValid, 'sessionId không hợp lệ') });
const setPasswordSchema = googleCredentialSchema.extend({ password: z.string().min(8).max(128) });
const unlinkGoogleSchema = z.object({ currentPassword: z.string().min(8).max(128) });

router.get('/providers', (_req, res) => {
  res.json({ data: { googleClientId: env.GOOGLE_CLIENT_ID ?? null } });
});

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

/**
 * SECURITY (C-3): Device fingerprint binding for refresh tokens.
 * The fingerprint is a SHA-256 hash of (user-agent + IP prefix). It is NOT a secret —
 * its only purpose is to detect when a stolen refresh token is replayed from a
 * different device/IP than the one that originally received it. A mismatch does
 * NOT silently revoke (mobile users on flaky networks would be locked out);
 * instead it triggers the OWASP session-reuse response and revokes ALL sessions.
 */
function deviceFingerprint(req: Request): string {
  const userAgent = req.get('user-agent') ?? 'unknown';
  const ip = req.ip ?? 'unknown';
  return createHash('sha256').update(`${userAgent}|${ip}`).digest('hex');
}

async function issueSession(user: { _id: Types.ObjectId; role: 'user' | 'admin' }, req: Request, res: Response) {
  const jti = newJti();
  const refreshToken = signRefreshToken(user._id.toString(), user.role, jti);
  await RefreshSessionModel.create({
    userId: user._id,
    jti,
    tokenHash: hashToken(refreshToken),
    fingerprint: deviceFingerprint(req),
    expiresAt: refreshExpiry(),
    userAgent: req.get('user-agent')?.slice(0, 500),
    ip: req.ip,
  });
  res.cookie(env.REFRESH_COOKIE_NAME, refreshToken, cookieOptions());
  return signAccessToken(user._id.toString(), user.role);
}

// Re-export from utils/user.mapper for backwards compatibility
// (ARCH-04: extracted to break route-file dependency on helper functions)
export { publicUser } from '../utils/user.mapper.js';
import { publicUser } from '../utils/user.mapper.js';

router.post('/register', authLimiter, validate(registerSchema), asyncHandler(async (req, res) => {
  mailService.assertConfigured();
  const existingUser = await UserModel.findOne({ email: req.body.email }).select('+emailVerificationRequired');
  if (existingUser) {
    if (existingUser.emailVerificationRequired && !existingUser.emailVerifiedAt) {
      const deleted = await accountTokenService.deleteUnverifiedUserIfExpired(existingUser._id);
      if (!deleted) {
        throw new AppError(409, 'EMAIL_EXISTS', 'Email này đã đăng ký và đang chờ xác thực OTP. Vui lòng kiểm tra email hoặc chờ hết 5 phút để thử lại.');
      }
    } else {
      throw new AppError(409, 'EMAIL_EXISTS', 'Email đã được sử dụng');
    }
  }
  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const newUserId = new Types.ObjectId();
  let user;
  try {
    user = await UserModel.create({
      _id: newUserId,
      name: req.body.name,
      email: req.body.email,
      passwordHash,
      role: 'user',
      avatarType: 'generated',
      avatarConfig: generateDefaultAvatarConfig(newUserId.toString()),
      avatarUrl: null,
      avatarPublicId: null,
      emailVerificationRequired: true,
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new AppError(409, 'EMAIL_EXISTS', 'Email đã được sử dụng');
    throw error;
  }
  const proof = await accountTokenService.issueWithOtp(user._id, 'verify_email', env.EMAIL_VERIFICATION_TTL_MINUTES);
  await mailService.sendVerificationEmail({ to: user.email, name: user.name, ...proof });
  res.status(201).json({ data: { user: publicUser(user), verificationRequired: true } });
}));

router.post('/login', authLimiter, validate(credentialsSchema), asyncHandler(async (req, res) => {
  const user = await UserModel.findOne({ email: req.body.email }).select('+passwordHash +emailVerificationRequired');
  const passwordMatches = user?.passwordHash ? await bcrypt.compare(req.body.password, user.passwordHash) : false;
  if (!user || !passwordMatches) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
  if (user.status !== 'active') throw new AppError(423, 'ACCOUNT_LOCKED', 'Tài khoản đã bị khóa');
  if (user.emailVerificationRequired && !user.emailVerifiedAt) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Hãy xác minh email trước khi đăng nhập');
  }
  const accessToken = await issueSession(user, req, res);
  res.json({ data: { accessToken, user: publicUser(user) } });
}));

router.post('/google', authLimiter, validate(googleCredentialSchema), asyncHandler(async (req, res) => {
  const identity = await googleIdentityService.verify(req.body.credential);
  let user = await UserModel.findOne({ googleSub: identity.sub }).select('+googleSub');
  let created = false;
  if (!user) {
    if (await UserModel.exists({ email: identity.email })) {
      const existingEmailUser = await UserModel.findOne({ email: identity.email })
        .select('+googleSub +emailVerificationRequired +createdAt +googleLinkedAt');
      // SECURITY (C-4): Google OAuth MUST NOT silently take over a password account.
      // Only an UNVERIFIED signup created within the last 5 minutes (the OTP window) may
      // be claimed via Google. Any established, verified or older account must link
      // explicitly through Account Settings after re-authenticating with the password.
      // This blocks the attack: attacker controls attacker@gmail.com → registers a
      // password account with victim's email → victim has Google on that email →
      // attacker clicks "Sign in with Google" → account takeover.
      const OTP_GRACE_WINDOW_MS = 5 * 60 * 1000;
      const isFreshUnverifiedSignup = existingEmailUser?.emailVerificationRequired
        && !existingEmailUser.emailVerifiedAt
        && !existingEmailUser.googleSub
        && existingEmailUser.createdAt
        && (Date.now() - existingEmailUser.createdAt.getTime()) < OTP_GRACE_WINDOW_MS;
      if (isFreshUnverifiedSignup) {
        if (existingEmailUser.status !== 'active') throw new AppError(423, 'ACCOUNT_LOCKED', 'Tài khoản đã bị khóa');
        existingEmailUser.googleSub = identity.sub;
        existingEmailUser.emailVerifiedAt = new Date();
        existingEmailUser.emailVerificationRequired = false;
        existingEmailUser.googleLinkedAt = new Date();
        existingEmailUser.googleAvatarUrl = identity.picture;
        existingEmailUser.avatarUrl ??= identity.picture;
        try {
          await existingEmailUser.save();
          await accountTokenService.invalidate(existingEmailUser._id, 'verify_email');
          user = existingEmailUser;
        } catch (error) {
          if ((error as { code?: number }).code === 11000) {
            throw new AppError(409, 'GOOGLE_ALREADY_LINKED', 'Tài khoản Google đã liên kết với người dùng khác');
          }
          throw error;
        }
      } else {
        throw new AppError(409, 'GOOGLE_LINK_REQUIRED', 'Email đã có tài khoản. Hãy đăng nhập bằng mật khẩu rồi liên kết Google trong phần Cài đặt.');
      }
    }
    if (!user) {
      try {
        const newUserId = new Types.ObjectId();
        user = await UserModel.create({
          _id: newUserId,
          name: identity.name,
          email: identity.email,
          googleSub: identity.sub,
          avatarType: identity.picture ? 'custom' : 'generated',
          avatarUrl: identity.picture || null,
          googleAvatarUrl: identity.picture || null,
          avatarConfig: generateDefaultAvatarConfig(newUserId.toString()),
          avatarPublicId: null,
          emailVerifiedAt: new Date(),
          emailVerificationRequired: false,
          role: 'user',
        });
        created = true;
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        user = await UserModel.findOne({ googleSub: identity.sub }).select('+googleSub');
        if (!user) throw new AppError(409, 'GOOGLE_LINK_REQUIRED', 'Email đã có tài khoản. Hãy đăng nhập và liên kết Google.');
      }
    }
  } else {
    // Existing user logging in with Google
    if (identity.picture) {
      user.googleAvatarUrl = identity.picture;
      if (!user.avatarUrl || user.avatarUrl.includes('googleusercontent.com')) {
        user.avatarUrl = identity.picture;
        user.avatarType = 'custom';
      }
      if (!user.avatarConfig) {
        user.avatarConfig = generateDefaultAvatarConfig(String(user._id));
      }
      await user.save();
    }
  }
  if (user.status !== 'active') throw new AppError(423, 'ACCOUNT_LOCKED', 'Tài khoản đã bị khóa');
  if (!created && !user.emailVerifiedAt) {
    user.emailVerifiedAt = new Date();
    user.emailVerificationRequired = false;
    await user.save();
  }
  const accessToken = await issueSession(user, req, res);
  res.status(created ? 201 : 200).json({ data: { accessToken, user: publicUser(user) } });
}));

router.post('/google/link', requireAuth, authLimiter, validate(googleCredentialSchema), asyncHandler(async (req, res) => {
  const identity = await googleIdentityService.verify(req.body.credential);
  const user = await UserModel.findById(req.auth!.userId).select('+googleSub');
  if (!user || user.status !== 'active') throw new AppError(401, 'ACCOUNT_UNAVAILABLE', 'Tài khoản không khả dụng');
  if (user.email !== identity.email) {
    throw new AppError(409, 'GOOGLE_EMAIL_MISMATCH', 'Email Google phải khớp email tài khoản hiện tại');
  }
  if (user.googleSub && user.googleSub !== identity.sub) {
    throw new AppError(409, 'GOOGLE_ALREADY_LINKED', 'Tài khoản đã liên kết với Google khác');
  }
  try {
    user.googleSub = identity.sub;
    user.googleLinkedAt = new Date();
    user.emailVerifiedAt ??= new Date();
    user.emailVerificationRequired = false;
    if (identity.picture) {
      user.googleAvatarUrl = identity.picture;
      if (!user.avatarUrl) user.avatarUrl = identity.picture;
    }
    await user.save();
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw new AppError(409, 'GOOGLE_ALREADY_LINKED', 'Tài khoản Google đã liên kết với người dùng khác');
    }
    throw error;
  }
  res.json({ data: { user: publicUser(user), googleLinked: true } });
}));

router.post('/password/set', requireAuth, authLimiter, validate(setPasswordSchema), asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.auth!.userId).select('+passwordHash +googleSub');
  if (!user || user.status !== 'active') throw new AppError(401, 'ACCOUNT_UNAVAILABLE', 'Tài khoản không khả dụng');
  if (user.passwordHash) throw new AppError(409, 'PASSWORD_ALREADY_SET', 'Tài khoản đã có mật khẩu');
  if (!user.googleSub) throw new AppError(409, 'GOOGLE_REAUTH_REQUIRED', 'Tài khoản chưa liên kết Google');
  const identity = await googleIdentityService.verify(req.body.credential);
  if (identity.sub !== user.googleSub || identity.email !== user.email) {
    throw new AppError(403, 'GOOGLE_REAUTH_MISMATCH', 'Google reauthentication không khớp tài khoản hiện tại');
  }
  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  await user.save();
  res.json({ data: { passwordSet: true } });
}));

router.post('/google/unlink', requireAuth, authLimiter, validate(unlinkGoogleSchema), asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.auth!.userId).select('+passwordHash +googleSub');
  if (!user || user.status !== 'active') throw new AppError(401, 'ACCOUNT_UNAVAILABLE', 'Tài khoản không khả dụng');
  if (!user.googleSub) throw new AppError(409, 'GOOGLE_NOT_LINKED', 'Tài khoản chưa liên kết Google');
  if (!user.passwordHash) throw new AppError(409, 'PASSWORD_REQUIRED_BEFORE_UNLINK', 'Hãy đặt mật khẩu trước khi hủy liên kết Google');
  if (!await bcrypt.compare(req.body.currentPassword, user.passwordHash)) {
    throw new AppError(401, 'INVALID_CURRENT_PASSWORD', 'Mật khẩu hiện tại không đúng');
  }
  user.googleSub = undefined;
  await user.save();
  res.json({ data: { googleLinked: false } });
}));

router.post('/refresh', refreshLimiter, asyncHandler(async (req, res) => {
  const token = req.cookies?.[env.REFRESH_COOKIE_NAME] as string | undefined;
  if (!token) throw new AppError(401, 'REFRESH_REQUIRED', 'Không tìm thấy phiên làm mới');
  const claims = verifyRefreshToken(token);
  if (!claims.jti) throw new AppError(401, 'INVALID_TOKEN', 'Phiên làm mới không hợp lệ');

  const incomingFingerprint = deviceFingerprint(req);

  const session = await RefreshSessionModel.findOneAndUpdate(
    { jti: claims.jti, tokenHash: hashToken(token), revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { revokedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!session) {
    // SECURITY (BUG-01 + C-3): Token reuse OR fingerprint mismatch detected.
    // Revoke ALL active sessions for this user (OWASP session family revocation).
    const compromisedSession = await RefreshSessionModel.findOne({ jti: claims.jti });
    if (compromisedSession) {
      await RefreshSessionModel.updateMany(
        { userId: compromisedSession.userId, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } },
      );
      logger.warn(
        { userId: compromisedSession.userId.toString(), jti: claims.jti },
        '[Auth] Refresh token reused or fingerprint mismatch — all sessions revoked',
      );
    }
    throw new AppError(401, 'REFRESH_REUSED', 'Phát hiện tái sử dụng phiên bảo mật. Vui lòng đăng nhập lại.');
  }

  // SECURITY (C-3): Fingerprint mismatch on a valid session is a strong theft signal.
  // We revoke all sessions to be safe (mobile users on changing IPs would otherwise be locked out
  // on the very next request, so this is a deliberate trade-off for security).
  if (session.fingerprint && session.fingerprint !== incomingFingerprint) {
    await RefreshSessionModel.updateMany(
      { userId: session.userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
    logger.warn(
      { userId: session.userId.toString(), jti: claims.jti },
      '[Auth] Refresh token replayed from different device — all sessions revoked',
    );
    throw new AppError(401, 'DEVICE_MISMATCH', 'Phiên được sử dụng từ thiết bị khác. Vui lòng đăng nhập lại.');
  }

  const user = await UserModel.findById(claims.sub).select('+emailVerificationRequired');
  if (!user || user.status !== 'active') throw new AppError(401, 'ACCOUNT_UNAVAILABLE', 'Tài khoản không khả dụng');
  if (user.emailVerificationRequired && !user.emailVerifiedAt) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Hãy xác minh email trước khi tiếp tục');
  }
  const replacementJti = newJti();
  const replacement = signRefreshToken(user._id.toString(), user.role, replacementJti);
  session.replacedByJti = replacementJti;
  await session.save();
  await RefreshSessionModel.create({
    userId: user._id,
    jti: replacementJti,
    tokenHash: hashToken(replacement),
    fingerprint: incomingFingerprint,
    expiresAt: refreshExpiry(),
    userAgent: req.get('user-agent')?.slice(0, 500),
    ip: req.ip,
  });
  res.cookie(env.REFRESH_COOKIE_NAME, replacement, cookieOptions());
  res.json({ data: { accessToken: signAccessToken(user._id.toString(), user.role) } });
}));

router.get('/sessions', requireAuth, asyncHandler(async (req, res) => {
  const sessions = await RefreshSessionModel.find({ userId: req.auth!.userId })
    .select('expiresAt revokedAt replacedByJti userAgent ip createdAt updatedAt')
    .sort({ createdAt: -1 }).limit(50).lean();
  const now = Date.now();
  res.json({ data: { items: sessions.map(session => ({
    id: session._id,
    userAgent: session.userAgent ?? null,
    ip: session.ip ?? null,
    createdAt: session.createdAt,
    lastRotatedAt: session.updatedAt,
    expiresAt: session.expiresAt,
    status: session.revokedAt ? 'revoked' : session.expiresAt.valueOf() <= now ? 'expired' : 'active',
  })) } });
}));

router.delete('/sessions/:sessionId', requireAuth, validate(sessionIdSchema, 'params'), asyncHandler(async (req, res) => {
  const session = await RefreshSessionModel.findOneAndUpdate(
    { _id: req.params.sessionId, userId: req.auth!.userId },
    { $set: { revokedAt: new Date() } },
    { returnDocument: 'after' },
  ).select('_id revokedAt');
  if (!session) throw new AppError(404, 'SESSION_NOT_FOUND', 'Không tìm thấy phiên đăng nhập');
  res.json({ data: { id: session._id, revoked: true } });
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

router.post('/verify-email', authLimiter, validate(accountProofSchema), asyncHandler(async (req, res) => {
  const accountToken = req.body.token
    ? await accountTokenService.consume(req.body.token, 'verify_email')
    : await (async () => {
      const user = await UserModel.findOne({ email: req.body.email });
      return user ? accountTokenService.consumeOtp(user._id, req.body.code, 'verify_email') : null;
    })();
  if (!accountToken) throw new AppError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Mã xác minh không hợp lệ hoặc đã hết hạn (tài khoản chưa xác thực quá 5 phút đã bị hủy, vui lòng đăng ký lại)');
  const user = await UserModel.findByIdAndUpdate(
    accountToken.userId,
    { $set: { emailVerifiedAt: new Date(), emailVerificationRequired: false } },
    { returnDocument: 'after' },
  );
  if (!user) throw new AppError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Tài khoản chưa xác thực đã bị hủy do hết hạn OTP. Vui lòng đăng ký lại.');
  res.json({ data: { verified: true, user: publicUser(user) } });
}));

router.post('/resend-verification', authLimiter, validate(forgotSchema), asyncHandler(async (req, res) => {
  mailService.assertConfigured();
  const user = await UserModel.findOne({ email: req.body.email }).select('+emailVerificationRequired');
  if (user?.emailVerificationRequired && !user.emailVerifiedAt && user.status === 'active') {
    try {
      const proof = await accountTokenService.issueWithOtpIfAllowed(user._id, 'verify_email', env.EMAIL_VERIFICATION_TTL_MINUTES);
      if (proof) await mailService.sendVerificationEmail({ to: user.email, name: user.name, ...proof });
    } catch (error) {
      logger.error({ userId: user._id.toString(), error: error instanceof Error ? error.message : String(error) }, 'Verification email delivery failed');
    }
  }
  res.status(202).json({ data: { accepted: true } });
}));

router.post('/forgot-password', authLimiter, validate(forgotSchema), asyncHandler(async (req, res) => {
  mailService.assertConfigured();
  const user = await UserModel.findOne({ email: req.body.email }).select('+passwordHash');
  if (user?.passwordHash && user.status === 'active') {
    try {
      const proof = await accountTokenService.issueWithOtpIfAllowed(user._id, 'reset_password', env.PASSWORD_RESET_TTL_MINUTES);
      if (proof) await mailService.sendPasswordResetEmail({ to: user.email, name: user.name, ...proof });
    } catch (error) {
      logger.error({ userId: user._id.toString(), error: error instanceof Error ? error.message : String(error) }, 'Password reset email delivery failed');
    }
  }
  res.status(202).json({ data: { accepted: true } });
}));

router.post('/reset-password', authLimiter, validate(resetPasswordSchema), asyncHandler(async (req, res) => {
  const accountToken = req.body.token
    ? await accountTokenService.consume(req.body.token, 'reset_password')
    : await (async () => {
      const user = await UserModel.findOne({ email: req.body.email });
      return user ? accountTokenService.consumeOtp(user._id, req.body.code, 'reset_password') : null;
    })();
  if (!accountToken) throw new AppError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Mã hoặc liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
  const user = await UserModel.findById(accountToken.userId).select('+passwordHash +emailVerificationRequired');
  if (!user || user.status !== 'active') throw new AppError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Liên kết đặt lại mật khẩu không hợp lệ');
  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  user.emailVerifiedAt ??= new Date();
  user.emailVerificationRequired = false;
  await user.save();
  await Promise.all([
    RefreshSessionModel.updateMany({ userId: user._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } }),
    accountTokenService.invalidate(user._id, 'reset_password'),
  ]);
  res.json({ data: { passwordReset: true } });
}));

router.post('/change-password', requireAuth, authLimiter, validate(changePasswordSchema), asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.auth!.userId).select('+passwordHash');
  if (!user || user.status !== 'active') throw new AppError(401, 'ACCOUNT_UNAVAILABLE', 'Tài khoản không khả dụng');
  if (!user.passwordHash) throw new AppError(409, 'PASSWORD_NOT_SET', 'Tài khoản chưa có mật khẩu');
  if (!await bcrypt.compare(req.body.currentPassword, user.passwordHash)) {
    throw new AppError(401, 'INVALID_CURRENT_PASSWORD', 'Mật khẩu hiện tại không đúng');
  }
  user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  await user.save();
  await RefreshSessionModel.updateMany(
    { userId: user._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
  const accessToken = await issueSession(user, req, res);
  res.json({ data: { changed: true, accessToken } });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.auth!.userId).lean();
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản');
  res.json({ data: { user: publicUser(user) } });
}));

export default router;
