import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import type { Express } from 'express';
import { qualifyingPracticeActivity, qualifyingStudyActivity } from '../services/streak.js';


let app: Express;
let UserModel: typeof import('../models/user.model.js').UserModel;
let StudyActivityModel: typeof import('../models/study-activity.model.js').StudyActivityModel;
let PracticeAttemptModel: typeof import('../models/practice.model.js').PracticeAttemptModel;
let ExamAttemptModel: typeof import('../models/exam-attempt.model.js').ExamAttemptModel;
let signAccessToken: typeof import('../services/jwt.js').signAccessToken;
const userId = new Types.ObjectId();

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.REDIS_URL = '';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  ({ app } = await import('../app.js'));
  ({ UserModel } = await import('../models/user.model.js'));
  ({ StudyActivityModel } = await import('../models/study-activity.model.js'));
  ({ PracticeAttemptModel } = await import('../models/practice.model.js'));
  ({ ExamAttemptModel } = await import('../models/exam-attempt.model.js'));
  ({ signAccessToken } = await import('../services/jwt.js'));
}, 30_000);
beforeEach(() => {
  vi.spyOn(ExamAttemptModel, 'aggregate').mockResolvedValue([]);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-26T16:59:59Z'));
  vi.spyOn(UserModel, 'findById').mockReturnValue({
    select: () => ({ lean: async () => ({ _id: userId, role: 'user', status: 'active' }) }),
  } as never);
  vi.spyOn(ExamAttemptModel, 'aggregate').mockResolvedValue([]);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('GET /learning/streak', () => {
  it('merges learning sources once per Vietnam day for a non-premium account', async () => {
    const study = vi.spyOn(StudyActivityModel, 'aggregate').mockResolvedValue([
      { dateKey: '2026-09-24' }, { dateKey: '2026-09-26' },
    ]);
    const practice = vi.spyOn(PracticeAttemptModel, 'aggregate').mockResolvedValue([
      { dateKey: '2026-09-25' }, { dateKey: '2026-09-26' },
    ]);
    const response = await request(app).get('/api/v1/learning/streak')
      .set('Authorization', `Bearer ${signAccessToken(String(userId), 'user')}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ streakCount: 3, activeDays: 3, isCompletedToday: true, today: '2026-09-26', timezone: 'Asia/Ho_Chi_Minh' });
    expect(study.mock.calls[0][0]![0]).toEqual({ $match: { userId, ...qualifyingStudyActivity } });
    expect(practice.mock.calls[0][0]![0]).toEqual({ $match: { userId, ...qualifyingPracticeActivity } });
  });
  it('includes exam-only days and deduplicates days shared with lessons', async () => {
    vi.spyOn(StudyActivityModel, 'aggregate').mockResolvedValue([{ dateKey: '2026-09-25' }]);
    vi.spyOn(PracticeAttemptModel, 'aggregate').mockResolvedValue([]);
    vi.spyOn(ExamAttemptModel, 'aggregate').mockResolvedValue([
      { userId, dateKey: '2026-09-25', examAttempts: 2, examStudySeconds: 120 },
      { userId, dateKey: '2026-09-26', examAttempts: 1, examStudySeconds: 60 },
    ]);
    const response = await request(app).get('/api/v1/learning/streak')
      .set('Authorization', `Bearer ${signAccessToken(String(userId), 'user')}`);
    expect(response.body.data).toMatchObject({ streakCount: 2, activeDays: 2, isCompletedToday: true });
    expect(vi.mocked(ExamAttemptModel.aggregate).mock.calls[0][0]?.[0]).toMatchObject({ $match: { userId } });
  });
  it('keeps the previous streak after midnight while today is still pending', async () => {
    vi.setSystemTime(new Date('2026-09-26T17:00:00Z'));
    vi.spyOn(StudyActivityModel, 'aggregate').mockResolvedValue([{ dateKey: '2026-09-25' }, { dateKey: '2026-09-26' }]);
    vi.spyOn(PracticeAttemptModel, 'aggregate').mockResolvedValue([]);
    const response = await request(app).get('/api/v1/learning/streak')
      .set('Authorization', `Bearer ${signAccessToken(String(userId), 'user')}`);
    expect(response.body.data).toMatchObject({ streakCount: 2, today: '2026-09-27', isCompletedToday: false });
  });
  it('does not return a false zero streak when storage is unavailable', async () => {
    vi.spyOn(StudyActivityModel, 'aggregate').mockRejectedValue(new Error('storage unavailable'));
    vi.spyOn(PracticeAttemptModel, 'aggregate').mockResolvedValue([]);
    const response = await request(app).get('/api/v1/learning/streak')
      .set('Authorization', `Bearer ${signAccessToken(String(userId), 'user')}`);
    expect(response.status).toBe(500);
    expect(response.body.data).toBeUndefined();
  });
  it('counts exam attempts toward streak', async () => {
    vi.spyOn(StudyActivityModel, 'aggregate').mockResolvedValue([]);
    vi.spyOn(PracticeAttemptModel, 'aggregate').mockResolvedValue([]);
    vi.spyOn(ExamAttemptModel, 'aggregate').mockResolvedValue([
      { userId, dateKey: '2026-09-26', examAttempts: 1, examStudySeconds: 1200 },
    ]);
    const response = await request(app).get('/api/v1/learning/streak')
      .set('Authorization', `Bearer ${signAccessToken(String(userId), 'user')}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      streakCount: 1,
      activeDays: 1,
      isCompletedToday: true,
      today: '2026-09-26',
    });
  });
  it('requires a signed-in account', async () => {
    expect((await request(app).get('/api/v1/learning/streak')).status).toBe(401);
  });
});
