import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import type { Express } from 'express';

let app: Express;
let UserModel: typeof import('../models/user.model.js').UserModel;
let signAccessToken: typeof import('../services/jwt.js').signAccessToken;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  ({ app } = await import('../app.js'));
  ({ UserModel } = await import('../models/user.model.js'));
  ({ signAccessToken } = await import('../services/jwt.js'));
});

afterEach(() => vi.restoreAllMocks());

describe('PATCH /api/v1/profile', () => {
  it('updates basic profile name and avatarUrl', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'user', status: 'active' }) }),
    } as never);
    vi.spyOn(UserModel, 'findByIdAndUpdate').mockReturnValue({
      select: () => Promise.resolve({
        _id: userId,
        name: 'Minh Anh',
        email: 'learner@example.com',
        avatarUrl: '/assets/panda-chat-icon.png',
        role: 'user',
        status: 'active',
      }),
    } as never);

    const token = signAccessToken(userId.toString(), 'user');
    const response = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Minh Anh', avatarUrl: '/assets/panda-chat-icon.png' });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Minh Anh');
    expect(response.body.data.avatarUrl).toBe('/assets/panda-chat-icon.png');
  });

  it('rejects empty payload without name or avatarUrl', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'user', status: 'active' }) }),
    } as never);

    const token = signAccessToken(userId.toString(), 'user');
    const response = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(422);
  });
});
