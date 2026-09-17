import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import type { Express } from 'express';

let app: Express;
let UserModel: typeof import('../models/user.model.js').UserModel;
let LessonModel: typeof import('../models/lesson.model.js').LessonModel;
let storageService: typeof import('../services/storage/r2-storage.service.js').storageService;
let signAccessToken: typeof import('../services/jwt.js').signAccessToken;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  ({ app } = await import('../app.js'));
  ({ UserModel } = await import('../models/user.model.js'));
  ({ LessonModel } = await import('../models/lesson.model.js'));
  ({ storageService } = await import('../services/storage/r2-storage.service.js'));
  ({ signAccessToken } = await import('../services/jwt.js'));
});

afterEach(() => vi.restoreAllMocks());

describe('GET /api/v1/admin/lessons/:lessonId/media', () => {
  it('returns a playable URL without leaking the R2 object key', async () => {
    const userId = new Types.ObjectId();
    const lessonId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'admin', status: 'active' }) }),
    } as never);
    vi.spyOn(LessonModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({
        _id: lessonId, status: 'ready_for_review',
        media: { objectKey: 'videos/private/video.mp4', mimeType: 'video/mp4', sizeBytes: 2048 },
      }) }),
    } as never);
    vi.spyOn(storageService, 'createDownloadUrl').mockResolvedValue('https://r2.example/signed-video');

    const response = await request(app).get(`/api/v1/admin/lessons/${lessonId}/media`)
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'admin')}`);
    expect(response.status).toBe(200);
    expect(response.body.data.media).toEqual({
      url: 'https://r2.example/signed-video', mimeType: 'video/mp4', sizeBytes: 2048,
    });
    expect(JSON.stringify(response.body)).not.toContain('videos/private/video.mp4');
  });

  it('rejects non-admin users', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'user', status: 'active' }) }),
    } as never);
    const response = await request(app).get(`/api/v1/admin/lessons/${new Types.ObjectId()}/media`)
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'user')}`);
    expect(response.status).toBe(403);
  });
});
