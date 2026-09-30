import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import type { Express } from 'express';


let app: Express;
let UserModel: typeof import('../models/user.model.js').UserModel;
let StudyActivityModel: typeof import('../models/study-activity.model.js').StudyActivityModel;
let ExamAttemptModel: typeof import('../models/exam-attempt.model.js').ExamAttemptModel;
let signAccessToken: typeof import('../services/jwt.js').signAccessToken;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  ({ app } = await import('../app.js'));
  ({ UserModel } = await import('../models/user.model.js'));
  ({ StudyActivityModel } = await import('../models/study-activity.model.js'));
  ({ ExamAttemptModel } = await import('../models/exam-attempt.model.js'));
  ({ signAccessToken } = await import('../services/jwt.js'));
});

beforeEach(() => { vi.spyOn(ExamAttemptModel, 'aggregate').mockResolvedValue([]); });
afterEach(() => vi.restoreAllMocks());

describe('GET /api/v1/learning/activity', () => {
  it('adds exam activity on its submission day without treating exams as video lessons', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findById').mockReturnValue({ select: () => ({ lean: async () => ({
      _id: userId, role: 'user', status: 'active', premiumExpiresAt: new Date(Date.now() + 86400000),
    }) }) } as never);
    vi.spyOn(StudyActivityModel, 'find').mockReturnValue({ sort: () => ({ lean: async () => [
      { dateKey: '2026-09-18', activeStudySeconds: 60, quizAttempts: 1 },
    ] }) } as never);
    vi.spyOn(ExamAttemptModel, 'aggregate').mockResolvedValue([{ userId, dateKey: '2026-09-18', examAttempts: 2, examStudySeconds: 180 }]);
    const response = await request(app).get('/api/v1/learning/activity?from=2026-09-17&to=2026-09-18')
      .set('Authorization', `Bearer ${signAccessToken(String(userId), 'user')}`);
    expect(response.status).toBe(200);
    expect(response.body.data.totals).toMatchObject({ activeStudySeconds: 240, examAttempts: 2, examStudySeconds: 180,
      quizAttempts: 1, completedLessons: 0 });
    expect(vi.mocked(ExamAttemptModel.aggregate).mock.calls[0][0]).toContainEqual({ $match: { dateKey: { $gte: '2026-09-17', $lte: '2026-09-18' } } });
  });
  it('fills missing UTC days and returns totals', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'user', status: 'active', premiumExpiresAt: new Date(Date.now() + 86400000) }) }),
    } as never);
    vi.spyOn(StudyActivityModel, 'find').mockReturnValue({
      sort: () => ({ lean: () => Promise.resolve([
        { dateKey: '2026-09-16', activeStudySeconds: 90, progressUpdates: 2, quizAttempts: 1, completedLessons: 0 },
        { dateKey: '2026-09-18', activeStudySeconds: 30, progressUpdates: 1, quizAttempts: 0, completedLessons: 1 },
      ]) }),
    } as never);
    vi.spyOn(ExamAttemptModel, 'aggregate').mockResolvedValue([]);

    const response = await request(app).get('/api/v1/learning/activity?from=2026-09-16&to=2026-09-18')
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'user')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.timezone).toBe('Asia/Ho_Chi_Minh');
    expect(response.body.data.days).toHaveLength(3);
    expect(response.body.data.days[1]).toEqual({
      date: '2026-09-17', examAttempts: 0, examStudySeconds: 0, activeStudySeconds: 0, progressUpdates: 0, quizAttempts: 0, completedLessons: 0,
    });
    expect(response.body.data.totals).toEqual({
      examAttempts: 0, examStudySeconds: 0, activeStudySeconds: 120, progressUpdates: 3, quizAttempts: 1, completedLessons: 1,
    });
  });

  it('rejects reversed or overlong ranges', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'user', status: 'active', premiumExpiresAt: new Date(Date.now() + 86400000) }) }),
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

  it('combines exam attempts and study seconds into activity days and totals', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'user', status: 'active', premiumExpiresAt: new Date(Date.now() + 86400000) }) }),
    } as never);
    vi.spyOn(StudyActivityModel, 'find').mockReturnValue({
      sort: () => ({ lean: () => Promise.resolve([]) }),
    } as never);
    vi.spyOn(ExamAttemptModel, 'aggregate').mockResolvedValue([
      { userId, dateKey: '2026-09-17', examAttempts: 1, examStudySeconds: 1500 },
    ]);

    const response = await request(app).get('/api/v1/learning/activity?from=2026-09-16&to=2026-09-18')
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'user')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.days[1]).toEqual({
      date: '2026-09-17',
      activeStudySeconds: 1500,
      examAttempts: 1,
      examStudySeconds: 1500,
      progressUpdates: 0,
      quizAttempts: 0,
      completedLessons: 0,
    });
    expect(response.body.data.totals).toEqual({
      activeStudySeconds: 1500,
      progressUpdates: 0,
      quizAttempts: 0,
      completedLessons: 0,
      examAttempts: 1,
      examStudySeconds: 1500,
    });
  });
});
