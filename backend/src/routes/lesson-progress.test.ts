import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import type { Express } from 'express';

let app: Express;
let UserModel: typeof import('../models/user.model.js').UserModel;
let LessonModel: typeof import('../models/lesson.model.js').LessonModel;
let ProgressModel: typeof import('../models/progress.model.js').ProgressModel;
let signAccessToken: typeof import('../services/jwt.js').signAccessToken;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  ({ app } = await import('../app.js'));
  ({ UserModel } = await import('../models/user.model.js'));
  ({ LessonModel } = await import('../models/lesson.model.js'));
  ({ ProgressModel } = await import('../models/progress.model.js'));
  ({ signAccessToken } = await import('../services/jwt.js'));
});

afterEach(() => vi.restoreAllMocks());

describe('GET /api/v1/lessons/:lessonId/progress', () => {
  it('returns a safe default for a published lesson not yet started', async () => {
    const userId = new Types.ObjectId();
    const lessonId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'admin', status: 'active' }) }),
    } as never);
    vi.spyOn(LessonModel, 'findOne').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: lessonId, durationSeconds: 100 }) }),
    } as never);
    vi.spyOn(LessonModel, 'find').mockReturnValue({
      sort: () => ({ limit: () => ({ select: () => ({ lean: () => Promise.resolve([{ _id: lessonId }]) }) }) }),
    } as never);
    vi.spyOn(ProgressModel, 'findOne').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    } as never);

    const response = await request(app).get(`/api/v1/lessons/${lessonId}/progress`)
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'user')}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      lastPositionSeconds: 0, watchedRanges: [], coverage: 0, completed: false, bestQuizScore: null,
    });
  });

  it('requires authentication', async () => {
    const response = await request(app).get(`/api/v1/lessons/${new Types.ObjectId()}/progress`);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });
});
