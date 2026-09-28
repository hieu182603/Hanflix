import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import type { Express } from 'express';
import { createHash } from 'node:crypto';

let app: Express;
let UserModel: typeof import('../models/user.model.js').UserModel;
let RefreshSessionModel: typeof import('../models/refresh-session.model.js').RefreshSessionModel;
let signAccessToken: typeof import('../services/jwt.js').signAccessToken;
let signRefreshToken: typeof import('../services/jwt.js').signRefreshToken;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  ({ app } = await import('../app.js'));
  ({ UserModel } = await import('../models/user.model.js'));
  ({ RefreshSessionModel } = await import('../models/refresh-session.model.js'));
  ({ signAccessToken } = await import('../services/jwt.js'));
  ({ signRefreshToken } = await import('../services/jwt.js'));
});

afterEach(() => vi.restoreAllMocks());

function mockUser(userId: Types.ObjectId) {
  vi.spyOn(UserModel, 'findById').mockReturnValue({
    select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'user', status: 'active' }) }),
  } as never);
}

describe('authenticated session management', () => {
  it('refreshes a legacy session when proxy IP changes but user-agent stays the same', async () => {
    const userId = new Types.ObjectId();
    const userAgent = 'HanFlix reload regression';
    const oldIp = '192.0.2.10';
    vi.spyOn(RefreshSessionModel, 'findOneAndUpdate').mockResolvedValue({
      userId, ip: oldIp,
      fingerprint: createHash('sha256').update(`${userAgent}|${oldIp}`).digest('hex'),
      save: vi.fn().mockResolvedValue(undefined),
    } as never);
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: () => Promise.resolve({ _id: userId, role: 'user', status: 'active' }),
    } as never);
    const create = vi.spyOn(RefreshSessionModel, 'create').mockResolvedValue({} as never);
    const revoke = vi.spyOn(RefreshSessionModel, 'updateMany').mockResolvedValue({} as never);
    const token = signRefreshToken(userId.toString(), 'user', 'reload-legacy-session');
    const response = await request(app).post('/api/v1/auth/refresh')
      .set('User-Agent', userAgent).set('Cookie', `hanflix_refresh=${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBeTruthy();
    expect(response.headers['set-cookie']).toBeDefined();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      fingerprint: createHash('sha256').update(userAgent).digest('hex'),
    }));
    expect(revoke).not.toHaveBeenCalled();
  });

  it('still rejects a different user-agent for a valid refresh token', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(RefreshSessionModel, 'findOneAndUpdate').mockResolvedValue({
      userId, ip: '192.0.2.10',
      fingerprint: createHash('sha256').update('Original browser').digest('hex'),
    } as never);
    const revoke = vi.spyOn(RefreshSessionModel, 'updateMany').mockResolvedValue({} as never);
    const token = signRefreshToken(userId.toString(), 'user', 'reload-other-browser');
    const response = await request(app).post('/api/v1/auth/refresh')
      .set('User-Agent', 'Different browser').set('Cookie', `hanflix_refresh=${token}`);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('DEVICE_MISMATCH');
    expect(revoke).toHaveBeenCalled();
  });

  it('lists sessions without exposing token material', async () => {
    const userId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();
    mockUser(userId);
    vi.spyOn(RefreshSessionModel, 'find').mockReturnValue({
      select: () => ({ sort: () => ({ limit: () => ({ lean: () => Promise.resolve([{
        _id: sessionId,
        tokenHash: 'must-not-leak',
        jti: 'must-not-leak',
        userAgent: 'Vitest',
        ip: '127.0.0.1',
        createdAt: new Date('2026-09-17T00:00:00Z'),
        updatedAt: new Date('2026-09-17T01:00:00Z'),
        expiresAt: new Date('2099-01-01T00:00:00Z'),
      }]) }) }) }),
    } as never);

    const response = await request(app).get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'user')}`);
    expect(response.status).toBe(200);
    expect(response.body.data.items[0]).toMatchObject({ id: sessionId.toString(), status: 'active', userAgent: 'Vitest' });
    expect(JSON.stringify(response.body)).not.toContain('must-not-leak');
  });

  it('revokes only a session owned by the authenticated user', async () => {
    const userId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();
    mockUser(userId);
    const update = vi.spyOn(RefreshSessionModel, 'findOneAndUpdate').mockReturnValue({
      select: () => Promise.resolve({ _id: sessionId, revokedAt: new Date() }),
    } as never);

    const response = await request(app).delete(`/api/v1/auth/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'user')}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ id: sessionId.toString(), revoked: true });
    expect(update).toHaveBeenCalledWith(
      { _id: sessionId.toString(), userId },
      expect.anything(),
      expect.objectContaining({ returnDocument: 'after' }),
    );
  });
});
