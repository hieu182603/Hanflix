import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import type { Express } from 'express';

let app: Express;
let UserModel: typeof import('../models/user.model.js').UserModel;
let LessonModel: typeof import('../models/lesson.model.js').LessonModel;
let storageService: typeof import('../services/storage/r2-storage.service.js').storageService;
let signAccessToken: typeof import('../services/jwt.js').signAccessToken;
let SubtitleTrackModel: typeof import('../models/subtitle-track.model.js').SubtitleTrackModel;
let ProcessingJobModel: typeof import('../models/processing-job.model.js').ProcessingJobModel;
let commits: typeof import('../services/revision-commit.js');

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
  ({ SubtitleTrackModel } = await import('../models/subtitle-track.model.js'));
  ({ ProcessingJobModel } = await import('../models/processing-job.model.js'));
  commits = await import('../services/revision-commit.js');
});

afterEach(() => vi.restoreAllMocks());

function authenticateAdmin(userId: Types.ObjectId) {
  vi.spyOn(UserModel, 'findById').mockReturnValue({
    select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'admin', status: 'active' }) }),
  } as never);
}

describe('admin R2 upload lifecycle', () => {
  it('returns the upload transition instead of a false missing-job error', async () => {
    const userId = new Types.ObjectId();
    const lessonId = new Types.ObjectId();
    authenticateAdmin(userId);
    vi.spyOn(ProcessingJobModel, 'findOne').mockReturnValue({
      sort: () => ({ lean: () => Promise.resolve(null) }),
    } as never);
    vi.spyOn(LessonModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({
        _id: lessonId,
        status: 'uploading',
        processingStatus: 'UPLOADED',
        processingProgress: 0,
        processingStep: 'UPLOADING',
        media: null,
      }) }),
    } as never);

    const response = await request(app)
      .get(`/api/v1/admin/lessons/${lessonId}/processing`)
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: 'uploading',
      stage: 'UPLOADING',
      stageProgress: 0,
      capabilities: { canCancel: true, noJob: true },
    });
  });

  it.each([false, true])('subtitle edits preserve speaker/chapter and invalidate karaoke only on text/time edits (%s)', async changeTiming => {
    const userId = new Types.ObjectId(); const lessonId = new Types.ObjectId();
    authenticateAdmin(userId);
    vi.spyOn(LessonModel, 'findOne').mockReturnValue({ select: () => ({ lean: async () => ({ _id: lessonId, durationSeconds: 120 }) }) } as never);
    const cue = { cueId: 'cue1', startMs: 0, endMs: 1000, zh: '你好', pinyin: 'ni hao', vi: 'Xin chào', tokens: [],
      speakerId: 'speaker-1', chapterId: 'chapter-1', karaokeTokens: [{ text: '你', startMs: 0, endMs: 500, wordId: null }] };
    vi.spyOn(SubtitleTrackModel, 'findOne').mockReturnValue({ sort: async () => ({ revision: 1, cues: [cue] }) } as never);
    const commit = vi.spyOn(commits, 'runEditorCommit').mockResolvedValue({ lesson: {}, subtitle: {} });
    const response = await request(app).put(`/api/v1/admin/lessons/${lessonId}/subtitles`)
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'admin')}`)
      .send({ cues: [{ cueId: cue.cueId, startMs: 0, endMs: changeTiming ? 1200 : 1000, zh: cue.zh, vi: 'Chào bạn' }] });
    expect(response.status).toBe(200);
    const saved = commit.mock.calls[0]![0].subtitle!.cues[0]!;
    expect(saved).toMatchObject({ speakerId: 'speaker-1', chapterId: 'chapter-1' });
    expect(saved.karaokeTokens).toEqual(changeTiming ? undefined : cue.karaokeTokens);
  });

  it.each(['song', 'podcast', 'lesson', 'drama'])('presigns audio only for supported modes: %s', async contentMode => {
    const userId = new Types.ObjectId(); const lessonId = new Types.ObjectId();
    authenticateAdmin(userId);
    const save = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(LessonModel, 'findOne').mockResolvedValue({ _id: lessonId, contentMode, save } as never);
    const presign = vi.spyOn(storageService, 'createUploadUrl').mockResolvedValue({ uploadUrl: 'https://r2.test/audio', objectKey: 'audio.mp3', expiresIn: 900 });
    const response = await request(app).post('/api/v1/admin/uploads/presign')
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'admin')}`)
      .send({ lessonId: String(lessonId), fileName: 'podcast.mp3', contentType: 'audio/mpeg', sizeBytes: 100 });
    expect(response.status).toBe(['song', 'podcast'].includes(contentMode) ? 200 : 422);
    if (response.status === 200) expect(presign).toHaveBeenCalledWith(expect.stringMatching(/\.mp3$/), 'audio/mpeg', expect.any(Number));
    else expect(presign).not.toHaveBeenCalled();
  });

  it('metadata-only PATCH never resets contentMode or goalTags', async () => {
    const userId = new Types.ObjectId(); const lessonId = new Types.ObjectId();
    authenticateAdmin(userId);
    const update = vi.spyOn(LessonModel, 'findOneAndUpdate').mockResolvedValue({ _id: lessonId, contentMode: 'song' } as never);
    const response = await request(app).patch(`/api/v1/admin/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'admin')}`)
      .send({ titleVi: 'Tên mới' });
    expect(response.status).toBe(200);
    expect(update.mock.calls[0]![1]).toEqual({ $set: { titleVi: 'Tên mới' } });
  });

  it('rejects confirmation for an object outside the exact presigned upload', async () => {
    const userId = new Types.ObjectId();
    const lessonId = new Types.ObjectId();
    authenticateAdmin(userId);
    // F02 (2026-09-18): the confirm endpoint now wraps the lesson lookup in a
    // Mongo transaction. The test mock has to chain `.session(session)` so the
    // transaction can be honored. We attach a no-op `.session` that returns the
    // same promise; this is a common pattern when testing transactional code.
    const fakeDoc = { _id: lessonId, pendingUploadObjectKey: `videos/${lessonId}/expected.mp4` };
    vi.spyOn(LessonModel, 'findOne').mockReturnValue({
      select: () => ({
        session: () => Promise.resolve(fakeDoc),
      }),
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
