import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import type { Express } from 'express';
import { UserModel } from '../models/user.model.js';
import { LessonModel } from '../models/lesson.model.js';
import { QuizModel } from '../models/quiz.model.js';
import { QuizAttemptModel } from '../models/quiz-attempt.model.js';
import { ProgressModel } from '../models/progress.model.js';
import * as activity from '../services/study-activity.js';

let app: Express;
let signAccessToken: typeof import('../services/jwt.js').signAccessToken;
const userId = new Types.ObjectId();
const lessonId = new Types.ObjectId();
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.REDIS_URL = '';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  ({ app } = await import('../app.js'));
  ({ signAccessToken } = await import('../services/jwt.js'));
}, 30_000);
beforeEach(() => {
  vi.spyOn(UserModel, 'findById').mockReturnValue({ select: () => ({ lean: async () => ({
    _id: userId, role: 'user', status: 'active', learningProfile: { currentHsk: 3 }, premiumExpiresAt: new Date(Date.now() + 86_400_000),
  }) }) } as never);
  vi.spyOn(LessonModel, 'findOne').mockReturnValue({ select: () => ({ lean: async () => ({ _id: lessonId, hsk: 3, activeQuizRevision: 1 }) }) } as never);
  vi.spyOn(QuizAttemptModel, 'findOne').mockReturnValue({ lean: async () => null } as never);
  vi.spyOn(QuizModel, 'findOne').mockReturnValue({ select: async () => ({
    _id: new Types.ObjectId(), questions: [
      { questionId: 'choice', type: 'multiple_choice', options: [{ optionId: 'a' }, { optionId: 'b' }], correctOptionId: 'a' },
      { questionId: 'text', type: 'fill_blank', options: [], acceptedAnswers: ['你好'] },
    ],
  }) } as never);
  vi.spyOn(QuizAttemptModel, 'create').mockResolvedValue({ _id: new Types.ObjectId() } as never);
  vi.spyOn(ProgressModel, 'updateOne').mockResolvedValue({} as never);
  vi.spyOn(activity, 'recordStudyActivity').mockResolvedValue(null);
});
afterEach(() => vi.restoreAllMocks());
const submit = (answers: unknown[]) => request(app).post(`/api/v1/lessons/${lessonId}/attempts`)
  .set('Authorization', `Bearer ${signAccessToken(String(userId), 'user')}`)
  .send({ idempotencyKey: 'test-quiz-streak', answers });

describe('quiz streak qualification', () => {
  it.each([
    { questionId: 'choice' },
    { questionId: 'choice', selectedOptionId: 'missing-option' },
    { questionId: 'text', textAnswer: '  ' },
    { questionId: 'unknown', textAnswer: 'hello' },
  ])('does not record an unanswered quiz: %j', async answer => {
    const response = await submit([answer]);
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('QUIZ_UNANSWERED');
    expect(QuizAttemptModel.create).not.toHaveBeenCalled();
    expect(activity.recordStudyActivity).not.toHaveBeenCalled();
  });
  it('records an actual answer even at zero score with unanswered questions remaining', async () => {
    const response = await submit([{ questionId: 'choice', selectedOptionId: 'b' }]);
    expect(response.status).toBe(201);
    expect(response.body.data.score).toBe(0);
    expect(activity.recordStudyActivity).toHaveBeenCalledWith(userId, { quizAttempts: 1, xpEarned: 25 });
  });
});
