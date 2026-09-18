import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import type { Express } from 'express';

let app: Express;
let UserModel: typeof import('../models/user.model.js').UserModel;
let StudyActivityModel: typeof import('../models/study-activity.model.js').StudyActivityModel;
let signAccessToken: typeof import('../services/jwt.js').signAccessToken;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  ({ app } = await import('../app.js'));
  ({ UserModel } = await import('../models/user.model.js'));
  ({ StudyActivityModel } = await import('../models/study-activity.model.js'));
  ({ signAccessToken } = await import('../services/jwt.js'));
});

afterEach(() => vi.restoreAllMocks());

describe('GET /api/v1/learning/activity', () => {
  it('fills missing UTC days and returns totals', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'user', status: 'active' }) }),
    } as never);
    vi.spyOn(StudyActivityModel, 'find').mockReturnValue({
      sort: () => ({ lean: () => Promise.resolve([
        { dateKey: '2026-09-16', activeStudySeconds: 90, progressUpdates: 2, quizAttempts: 1, completedLessons: 0 },
        { dateKey: '2026-09-18', activeStudySeconds: 30, progressUpdates: 1, quizAttempts: 0, completedLessons: 1 },
      ]) }),
    } as never);

    const response = await request(app).get('/api/v1/learning/activity?from=2026-09-16&to=2026-09-18')
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'user')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.timezone).toBe('Asia/Ho_Chi_Minh');
    expect(response.body.data.days).toHaveLength(3);
    expect(response.body.data.days[1]).toEqual({
      date: '2026-09-17', activeStudySeconds: 0, progressUpdates: 0, quizAttempts: 0, completedLessons: 0,
    });
    expect(response.body.data.totals).toEqual({
      activeStudySeconds: 120, progressUpdates: 3, quizAttempts: 1, completedLessons: 1,
    });
  });

  it('rejects reversed or overlong ranges', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'user', status: 'active' }) }),
    } as never);
    const token = signAccessToken(userId.toString(), 'user');

    const reversed = await request(app).get('/api/v1/learning/activity?from=2026-09-18&to=2026-09-17')
      .set('Authorization', `Bearer ${token}`);
    const overlong = await request(app).get('/api/v1/learning/activity?from=2025-01-01&to=2026-09-17')
      .set('Authorization', `Bearer ${token}`);

    expect(reversed.status).toBe(422);
    expect(reversed.body.error.code).toBe('INVALID_ACTIVITY_RANGE');
    expect(overlong.status).toBe(422);
    expect(overlong.body.error.code).toBe('ACTIVITY_RANGE_TOO_LARGE');
  });
});
