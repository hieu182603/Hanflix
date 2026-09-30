import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import type { Express } from 'express';

let app: Express;
let UserModel: typeof import('../models/user.model.js').UserModel;
let WordModel: typeof import('../models/word.model.js').WordModel;
let SubtitleTrackModel: typeof import('../models/subtitle-track.model.js').SubtitleTrackModel;
let SavedWordModel: typeof import('../models/saved-word.model.js').SavedWordModel;
let signAccessToken: typeof import('../services/jwt.js').signAccessToken;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  ({ app } = await import('../app.js'));
  ({ UserModel } = await import('../models/user.model.js'));
  ({ WordModel } = await import('../models/word.model.js'));
  ({ SubtitleTrackModel } = await import('../models/subtitle-track.model.js'));
  ({ SavedWordModel } = await import('../models/saved-word.model.js'));
  ({ signAccessToken } = await import('../services/jwt.js'));
});

afterEach(() => vi.restoreAllMocks());

describe('POST /api/v1/vocabulary', () => {
  const userId = new Types.ObjectId();
  const wordId = new Types.ObjectId();
  const sourceLessonId = new Types.ObjectId();

  function auth() {
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'user', status: 'active', premiumExpiresAt: new Date(Date.now() + 86400000) }) }),
    } as never);
    return `Bearer ${signAccessToken(userId.toString(), 'user')}`;
  }

  it('saves a canonical Word referenced by a published subtitle cue', async () => {
    const token = auth();
    vi.spyOn(WordModel, 'exists').mockResolvedValue({ _id: wordId } as never);
    const source = vi.spyOn(SubtitleTrackModel, 'exists').mockResolvedValue({ _id: new Types.ObjectId() } as never);
    vi.spyOn(SavedWordModel, 'findOne').mockResolvedValue(null);
    const create = vi.spyOn(SavedWordModel, 'create').mockResolvedValue({ _id: new Types.ObjectId(), wordId } as never);

    const response = await request(app).post('/api/v1/vocabulary')
      .set('Authorization', token)
      .send({ wordId: wordId.toString(), sourceLessonId: sourceLessonId.toString(), sourceCueId: 'cue-1' });

    expect(response.status).toBe(201);
    expect(response.body.data.wordId).toBe(wordId.toString());
    expect(source.mock.calls[0]?.[0]).toMatchObject({
      lessonId: sourceLessonId.toString(), status: 'published',
      cues: { $elemMatch: { cueId: 'cue-1', 'tokens.wordId': wordId } },
    });
    expect(create).toHaveBeenCalledOnce();
  });

  it('rejects a catalog Vocabulary ID without a matching Word record', async () => {
    const token = auth();
    vi.spyOn(WordModel, 'exists').mockResolvedValue(null);
    vi.spyOn(SubtitleTrackModel, 'exists').mockResolvedValue({ _id: new Types.ObjectId() } as never);
    const create = vi.spyOn(SavedWordModel, 'create');

    const response = await request(app).post('/api/v1/vocabulary')
      .set('Authorization', token)
      .send({ wordId: wordId.toString(), sourceLessonId: sourceLessonId.toString(), sourceCueId: 'cue-1' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INVALID_WORD_SOURCE');
    expect(create).not.toHaveBeenCalled();
  });
});
