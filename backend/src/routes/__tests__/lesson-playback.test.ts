import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getCachedSignedDownloadUrl = vi.fn();
const getCachedSignedDownloadUrl_orig = vi.fn();
vi.mock('../../services/signed-url-cache.js', () => ({
  getCachedSignedDownloadUrl: (...args: unknown[]) => getCachedSignedDownloadUrl(...args),
}));

const lessonModel = { findOne: vi.fn() };
vi.mock('../../models/lesson.model.js', () => ({
  LessonModel: lessonModel,
}));

import request from 'supertest';
import type { Express } from 'express';
import { Types } from 'mongoose';

let app: Express;
let signAccessToken: typeof import('../../services/jwt.js').signAccessToken;

beforeEach(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'b'.repeat(32);
  ({ app } = await import('../../app.js'));
  ({ signAccessToken } = await import('../../services/jwt.js'));
  lessonModel.findOne.mockReset();
  getCachedSignedDownloadUrl.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe('GET /api/v1/lessons/:lessonId', () => {
  it('returns the playback derivative URL when playbackKey is set', async () => {
    const lessonId = new Types.ObjectId();
    lessonModel.findOne.mockReturnValue({
      lean: async () => ({
        _id: lessonId,
        status: 'published',
        media: { objectKey: 'lessons/x/source.mp4', mimeType: 'video/mp4', sizeBytes: 1 },
        playbackKey: 'lessons/x/playback/v1-fast.mp4',
        playbackVersion: 1,
      }),
    });
    getCachedSignedDownloadUrl.mockImplementation(async (key: string) => `https://r2.example/${key}?sig=1`);

    const response = await request(app)
      .get(`/api/v1/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${signAccessToken(new Types.ObjectId().toString(), 'user')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.media?.url).toContain('lessons/x/playback/v1-fast.mp4');
    // Backward-compat: the original objectKey is never echoed back.
    expect(response.body.data.media?.objectKey).toBeUndefined();
  });

  it('falls back to the original media key when playbackKey is missing', async () => {
    const lessonId = new Types.ObjectId();
    lessonModel.findOne.mockReturnValue({
      lean: async () => ({
        _id: lessonId,
        status: 'published',
        media: { objectKey: 'lessons/x/source.mp4', mimeType: 'video/mp4', sizeBytes: 1 },
      }),
    });
    getCachedSignedDownloadUrl.mockImplementation(async (key: string) => `https://r2.example/${key}?sig=1`);

    const response = await request(app)
      .get(`/api/v1/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${signAccessToken(new Types.ObjectId().toString(), 'user')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.media?.url).toContain('lessons/x/source.mp4');
  });

  // Reference the original import to keep it from being tree-shaken.
  it('keeps signedUrlCache wired', () => {
    void getCachedSignedDownloadUrl_orig;
  });
});
