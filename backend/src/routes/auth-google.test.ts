import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import type { Express } from 'express';

let app: Express;
let UserModel: typeof import('../models/user.model.js').UserModel;
let RefreshSessionModel: typeof import('../models/refresh-session.model.js').RefreshSessionModel;
let googleIdentityService: typeof import('../services/google-identity.js').googleIdentityService;
let accountTokenService: typeof import('../services/account-token.js').accountTokenService;
let signAccessToken: typeof import('../services/jwt.js').signAccessToken;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.GOOGLE_CLIENT_ID = 'hanflix-web-client-id';
  ({ app } = await import('../app.js'));
  ({ UserModel } = await import('../models/user.model.js'));
  ({ RefreshSessionModel } = await import('../models/refresh-session.model.js'));
  ({ googleIdentityService } = await import('../services/google-identity.js'));
  ({ accountTokenService } = await import('../services/account-token.js'));
  ({ signAccessToken } = await import('../services/jwt.js'));
});

describe('POST /api/v1/auth/google/link', () => {
  it('links a matching verified Google account to a signed-in password account', async () => {
    const userId = new Types.ObjectId();
    const user = {
      _id: userId, name: 'Existing Learner', email: 'existing@example.com', role: 'user', status: 'active',
      googleSub: undefined as string | undefined, save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: (projection: string) => projection === '+googleSub'
        ? Promise.resolve(user)
        : { lean: () => Promise.resolve({ _id: userId, role: 'user', status: 'active' }) },
    } as never);
    vi.spyOn(googleIdentityService, 'verify').mockResolvedValue({
      sub: 'google-existing', email: 'existing@example.com', name: 'Existing Learner',
    });

    const response = await request(app).post('/api/v1/auth/google/link')
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'user')}`)
      .send({ credential: 'x'.repeat(120) });
    expect(response.status).toBe(200);
    expect(response.body.data.googleLinked).toBe(true);
    expect(user.googleSub).toBe('google-existing');
    expect(user.save).toHaveBeenCalledOnce();
  });

  it('requires the Google email to match the authenticated account', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: (projection: string) => projection === '+googleSub'
        ? Promise.resolve({ _id: userId, email: 'existing@example.com', role: 'user', status: 'active' })
        : { lean: () => Promise.resolve({ _id: userId, role: 'user', status: 'active' }) },
    } as never);
    vi.spyOn(googleIdentityService, 'verify').mockResolvedValue({
      sub: 'google-other', email: 'other@example.com', name: 'Other',
    });
    const response = await request(app).post('/api/v1/auth/google/link')
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'user')}`)
      .send({ credential: 'x'.repeat(120) });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('GOOGLE_EMAIL_MISMATCH');
  });
});

afterEach(() => vi.restoreAllMocks());

describe('POST /api/v1/auth/google', () => {
  it('exposes the public Google client ID needed by the browser', async () => {
    const response = await request(app).get('/api/v1/auth/providers');
    expect(response.status).toBe(200);
    expect(response.body.data.googleClientId).toBe('hanflix-web-client-id');
    expect(Object.keys(response.body.data)).toEqual(['googleClientId']);
  });

  it('lets a verified Google identity claim its still-unverified password signup', async () => {
    const userId = new Types.ObjectId();
    const user = {
      _id: userId, name: 'Learner', email: 'learner@example.com', role: 'user', status: 'active',
      emailVerificationRequired: true, emailVerifiedAt: undefined as Date | undefined,
      googleSub: undefined as string | undefined, avatarUrl: undefined as string | undefined,
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(googleIdentityService, 'verify').mockResolvedValue({
      sub: 'google-verified', email: 'learner@example.com', name: 'Learner',
    });
    vi.spyOn(UserModel, 'findOne').mockImplementation((query) => ({
      select: () => Promise.resolve('googleSub' in query ? null : user),
    } as never));
    vi.spyOn(UserModel, 'exists').mockResolvedValue({ _id: userId } as never);
    vi.spyOn(accountTokenService, 'invalidate').mockResolvedValue(undefined);
    vi.spyOn(RefreshSessionModel, 'create').mockResolvedValue({} as never);

    const response = await request(app).post('/api/v1/auth/google').send({ credential: 'x'.repeat(120) });
    expect(response.status).toBe(200);
    expect(response.body.data.user.emailVerified).toBe(true);
    expect(user.googleSub).toBe('google-verified');
    expect(user.save).toHaveBeenCalledOnce();
    expect(accountTokenService.invalidate).toHaveBeenCalledWith(userId, 'verify_email');
  });

  it('registers a new verified Google user and returns the existing auth contract', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(googleIdentityService, 'verify').mockResolvedValue({
      sub: 'google-123', email: 'new@example.com', name: 'New Learner',
    });
    vi.spyOn(UserModel, 'findOne').mockReturnValue({ select: () => Promise.resolve(null) } as never);
    vi.spyOn(UserModel, 'exists').mockResolvedValue(null);
    vi.spyOn(UserModel, 'create').mockResolvedValue({
      _id: userId, name: 'New Learner', email: 'new@example.com', role: 'user', status: 'active',
    } as never);
    vi.spyOn(RefreshSessionModel, 'create').mockResolvedValue({} as never);

    const response = await request(app).post('/api/v1/auth/google').send({ credential: 'x'.repeat(120) });
    expect(response.status).toBe(201);
    expect(response.body.data.accessToken).toBeTypeOf('string');
    expect(response.body.data.user).toMatchObject({ id: userId.toString(), email: 'new@example.com', role: 'user' });
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('signs in an existing linked Google user', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(googleIdentityService, 'verify').mockResolvedValue({
      sub: 'google-existing', email: 'linked@example.com', name: 'Linked Learner',
    });
    vi.spyOn(UserModel, 'findOne').mockReturnValue({ select: () => Promise.resolve({
      _id: userId, name: 'Linked Learner', email: 'linked@example.com', role: 'user', status: 'active',
      emailVerifiedAt: new Date(),
    }) } as never);
    const createUser = vi.spyOn(UserModel, 'create');
    vi.spyOn(RefreshSessionModel, 'create').mockResolvedValue({} as never);

    const response = await request(app).post('/api/v1/auth/google').send({ credential: 'x'.repeat(120) });
    expect(response.status).toBe(200);
    expect(response.body.data.user.id).toBe(userId.toString());
    expect(createUser).not.toHaveBeenCalled();
  });

  it('requires explicit linking when the Google email already exists', async () => {
    vi.spyOn(googleIdentityService, 'verify').mockResolvedValue({
      sub: 'google-456', email: 'existing@example.com', name: 'Existing Learner',
    });
    vi.spyOn(UserModel, 'findOne').mockReturnValue({ select: () => Promise.resolve(null) } as never);
    vi.spyOn(UserModel, 'exists').mockResolvedValue({ _id: new Types.ObjectId() } as never);

    const response = await request(app).post('/api/v1/auth/google').send({ credential: 'x'.repeat(120) });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('GOOGLE_LINK_REQUIRED');
  });
});
