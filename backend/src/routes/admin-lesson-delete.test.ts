import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import type { Express } from 'express';

let app: Express;
let UserModel: typeof import('../models/user.model.js').UserModel;
let signAccessToken: typeof import('../services/jwt.js').signAccessToken;

const purgeAdminLesson = vi.fn();

vi.mock('../services/lesson-delete.js', () => ({
  purgeAdminLesson: (...args: unknown[]) => purgeAdminLesson(...args),
}));

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  ({ app } = await import('../app.js'));
  ({ UserModel } = await import('../models/user.model.js'));
  ({ signAccessToken } = await import('../services/jwt.js'));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('admin lesson delete', () => {
  it('deletes a lesson permanently for admins', async () => {
    const userId = new Types.ObjectId();
    const lessonId = new Types.ObjectId();
    purgeAdminLesson.mockResolvedValue({ lessonId: lessonId.toString(), titleVi: 'Bài test' });

    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'admin', status: 'active' }) }),
    } as never);

    const response = await request(app)
      .delete(`/api/v1/admin/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      lessonId: lessonId.toString(),
      titleVi: 'Bài test',
      deleted: true,
    });
    expect(purgeAdminLesson).toHaveBeenCalledWith(lessonId.toString());
  });
});
