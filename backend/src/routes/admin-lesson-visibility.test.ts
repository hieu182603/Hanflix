import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import type { Express } from 'express';

let app: Express;
let UserModel: typeof import('../models/user.model.js').UserModel;
let LessonModel: typeof import('../models/lesson.model.js').LessonModel;
let signAccessToken: typeof import('../services/jwt.js').signAccessToken;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  ({ app } = await import('../app.js'));
  ({ UserModel } = await import('../models/user.model.js'));
  ({ LessonModel } = await import('../models/lesson.model.js'));
  ({ signAccessToken } = await import('../services/jwt.js'));
});

afterEach(() => vi.restoreAllMocks());

describe('admin lesson visibility', () => {
  it.each([
    ['hide', 'published', 'hidden'],
    ['restore', 'hidden', 'published'],
  ] as const)('%s transitions lesson visibility without deleting it', async (action, previousStatus, nextStatus) => {
    const userId = new Types.ObjectId();
    const lessonId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'admin', status: 'active' }) }),
    } as never);
    const update = vi.spyOn(LessonModel, 'findOneAndUpdate').mockReturnValue({
      select: () => Promise.resolve({
        toObject: () => ({ _id: lessonId, status: nextStatus, titleVi: 'Bài kiểm thử' }),
      }),
    } as never);

    const response = await request(app).post(`/api/v1/admin/lessons/${lessonId}/${action}`)
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe(nextStatus);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ _id: lessonId.toString(), status: previousStatus }),
      expect.anything(),
      expect.objectContaining({ returnDocument: 'after' }),
    );
  });
});
