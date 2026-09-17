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

function authenticateAdmin(userId: Types.ObjectId) {
  vi.spyOn(UserModel, 'findById').mockReturnValue({
    select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'admin', status: 'active' }) }),
  } as never);
}

describe('admin R2 upload lifecycle', () => {
  it('rejects confirmation for an object outside the exact presigned upload', async () => {
    const userId = new Types.ObjectId();
    const lessonId = new Types.ObjectId();
    authenticateAdmin(userId);
    vi.spyOn(LessonModel, 'findOne').mockReturnValue({
      select: () => Promise.resolve({ _id: lessonId, pendingUploadObjectKey: `videos/${lessonId}/expected.mp4` }),
    } as never);
    const head = vi.spyOn(storageService, 'headObject');

    const response = await request(app).post('/api/v1/admin/uploads/confirm')
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'admin')}`)
      .send({ lessonId: lessonId.toString(), objectKey: `videos/${lessonId}/different.mp4` });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INVALID_OBJECT_KEY');
    expect(head).not.toHaveBeenCalled();
  });

  it('deletes an abandoned object and restores the lesson draft', async () => {
    const userId = new Types.ObjectId();
    const lessonId = new Types.ObjectId();
    const objectKey = `videos/${lessonId}/abandoned.mp4`;
    authenticateAdmin(userId);
    const document = {
      _id: lessonId,
      status: 'uploading',
      pendingUploadObjectKey: objectKey,
      processingProgress: 0,
      processingError: undefined,
      set: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(LessonModel, 'findOne').mockReturnValue({ select: () => Promise.resolve(document) } as never);
    const remove = vi.spyOn(storageService, 'deleteObject').mockResolvedValue(undefined);

    const response = await request(app).post(`/api/v1/admin/lessons/${lessonId}/upload/cancel`)
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('draft');
    expect(remove).toHaveBeenCalledWith(objectKey);
    expect(document.pendingUploadObjectKey).toBeUndefined();
    expect(document.save).toHaveBeenCalledOnce();
  });
});
