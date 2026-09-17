import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import type { Express } from 'express';

let app: Express;
let UserModel: typeof import('../models/user.model.js').UserModel;
let RefreshSessionModel: typeof import('../models/refresh-session.model.js').RefreshSessionModel;
let accountTokenService: typeof import('../services/account-token.js').accountTokenService;
let mailService: typeof import('../services/mailer.js').mailService;
let signAccessToken: typeof import('../services/jwt.js').signAccessToken;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  ({ app } = await import('../app.js'));
  ({ UserModel } = await import('../models/user.model.js'));
  ({ RefreshSessionModel } = await import('../models/refresh-session.model.js'));
  ({ accountTokenService } = await import('../services/account-token.js'));
  ({ mailService } = await import('../services/mailer.js'));
  ({ signAccessToken } = await import('../services/jwt.js'));
});

afterEach(() => vi.restoreAllMocks());

describe('email verification and password recovery', () => {
  it('registers an unverified user and sends a verification token without creating a session', async () => {
    const userId = new Types.ObjectId();
    const user = {
      _id: userId, name: 'New Learner', email: 'new@example.com', role: 'user', status: 'active',
      emailVerificationRequired: true,
    };
    vi.spyOn(mailService, 'assertConfigured').mockImplementation(() => undefined);
    vi.spyOn(UserModel, 'exists').mockResolvedValue(null);
    vi.spyOn(UserModel, 'create').mockResolvedValue(user as never);
    vi.spyOn(accountTokenService, 'issueWithOtp').mockResolvedValue({ token: 'verification-token', code: '123456' });
    const send = vi.spyOn(mailService, 'sendVerificationEmail').mockResolvedValue(undefined);
    const createSession = vi.spyOn(RefreshSessionModel, 'create');

    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'New Learner', email: 'NEW@example.com', password: 'Password123!',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.verificationRequired).toBe(true);
    expect(response.body.data.user.emailVerified).toBe(false);
    expect(response.body.data.accessToken).toBeUndefined();
    expect(send).toHaveBeenCalledWith({ to: 'new@example.com', name: 'New Learner', token: 'verification-token', code: '123456' });
    expect(createSession).not.toHaveBeenCalled();
  });

  it('rejects password login until the new account email is verified', async () => {
    vi.spyOn(UserModel, 'findOne').mockReturnValue({ select: () => Promise.resolve({
      _id: new Types.ObjectId(), email: 'new@example.com', passwordHash: '$2b$12$invalid',
      role: 'user', status: 'active', emailVerificationRequired: true,
    }) } as never);
    const bcrypt = await import('bcryptjs');
    vi.spyOn(bcrypt.default, 'compare').mockResolvedValue(true as never);

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'new@example.com', password: 'Password123!',
    });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('consumes a verification token and marks the email verified', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(accountTokenService, 'consume').mockResolvedValue({ userId } as never);
    vi.spyOn(UserModel, 'findByIdAndUpdate').mockResolvedValue({
      _id: userId, name: 'Learner', email: 'learner@example.com', role: 'user', status: 'active',
      emailVerifiedAt: new Date(), emailVerificationRequired: false,
    } as never);

    const response = await request(app).post('/api/v1/auth/verify-email').send({ token: 'x'.repeat(43) });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ verified: true, user: { emailVerified: true } });
  });

  it('verifies an account with the emailed six-digit code', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findOne').mockResolvedValue({ _id: userId } as never);
    const consume = vi.spyOn(accountTokenService, 'consumeOtp').mockResolvedValue({ userId } as never);
    vi.spyOn(UserModel, 'findByIdAndUpdate').mockResolvedValue({
      _id: userId, name: 'Learner', email: 'learner@example.com', role: 'user', status: 'active',
      emailVerifiedAt: new Date(), emailVerificationRequired: false,
    } as never);

    const response = await request(app).post('/api/v1/auth/verify-email').send({ email: 'LEARNER@example.com', code: '123456' });
    expect(response.status).toBe(200);
    expect(consume).toHaveBeenCalledWith(userId, '123456', 'verify_email');
  });

  it('keeps forgot-password responses generic while sending a one-time reset link', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(mailService, 'assertConfigured').mockImplementation(() => undefined);
    vi.spyOn(UserModel, 'findOne').mockReturnValue({ select: () => Promise.resolve({
      _id: userId, name: 'Learner', email: 'learner@example.com', status: 'active', passwordHash: 'hash',
    }) } as never);
    vi.spyOn(accountTokenService, 'issueWithOtpIfAllowed').mockResolvedValue({ token: 'reset-token', code: '123456' });
    const send = vi.spyOn(mailService, 'sendPasswordResetEmail').mockResolvedValue(undefined);

    const response = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'learner@example.com' });
    expect(response.status).toBe(202);
    expect(response.body.data).toEqual({ accepted: true });
    expect(send).toHaveBeenCalledWith({ to: 'learner@example.com', name: 'Learner', token: 'reset-token', code: '123456' });
  });

  it('resets the password with a valid token and revokes every old session', async () => {
    const userId = new Types.ObjectId();
    const user = {
      _id: userId, status: 'active', passwordHash: 'old-hash', emailVerifiedAt: undefined as Date | undefined,
      emailVerificationRequired: true, save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(accountTokenService, 'consume').mockResolvedValue({ userId } as never);
    vi.spyOn(UserModel, 'findById').mockReturnValue({ select: () => Promise.resolve(user) } as never);
    const bcrypt = await import('bcryptjs');
    vi.spyOn(bcrypt.default, 'hash').mockResolvedValue('reset-hash' as never);
    const revoke = vi.spyOn(RefreshSessionModel, 'updateMany').mockResolvedValue({ acknowledged: true } as never);
    const invalidate = vi.spyOn(accountTokenService, 'invalidate').mockResolvedValue(undefined);

    const response = await request(app).post('/api/v1/auth/reset-password').send({
      token: 'x'.repeat(43), password: 'ResetPassword123!',
    });
    expect(response.status).toBe(200);
    expect(response.body.data.passwordReset).toBe(true);
    expect(user.passwordHash).toBe('reset-hash');
    expect(user.emailVerificationRequired).toBe(false);
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(revoke).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith(userId, 'reset_password');
  });

  it('rejects a wrong reset code without changing the password', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findOne').mockResolvedValue({ _id: userId } as never);
    vi.spyOn(accountTokenService, 'consumeOtp').mockResolvedValue(null);
    const findById = vi.spyOn(UserModel, 'findById');

    const response = await request(app).post('/api/v1/auth/reset-password').send({
      email: 'learner@example.com', code: '000000', password: 'NewPassword123!',
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    expect(findById).not.toHaveBeenCalled();
  });

  it('changes a password, revokes old refresh sessions and issues a replacement session', async () => {
    const userId = new Types.ObjectId();
    const user = {
      _id: userId, name: 'Learner', email: 'learner@example.com', role: 'user' as const, status: 'active',
      passwordHash: 'stored-hash', save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: (projection: string) => projection.includes('role')
        ? { lean: () => Promise.resolve({ _id: userId, role: 'user', status: 'active' }) }
        : Promise.resolve(user),
    } as never);
    const bcrypt = await import('bcryptjs');
    vi.spyOn(bcrypt.default, 'compare').mockResolvedValue(true as never);
    vi.spyOn(bcrypt.default, 'hash').mockResolvedValue('new-hash' as never);
    const revoke = vi.spyOn(RefreshSessionModel, 'updateMany').mockResolvedValue({ acknowledged: true } as never);
    vi.spyOn(RefreshSessionModel, 'create').mockResolvedValue({} as never);

    const response = await request(app).post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'user')}`)
      .send({ currentPassword: 'Password123!', newPassword: 'NewPassword123!' });

    expect(response.status).toBe(200);
    expect(response.body.data.changed).toBe(true);
    expect(response.body.data.accessToken).toBeTypeOf('string');
    expect(user.passwordHash).toBe('new-hash');
    expect(revoke).toHaveBeenCalled();
  });
});
