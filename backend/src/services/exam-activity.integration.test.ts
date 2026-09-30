import mongoose, { Types } from 'mongoose';
import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ExamModel } from '../models/exam.model.js';
import { ExamAttemptModel } from '../models/exam-attempt.model.js';
import { UserModel } from '../models/user.model.js';
import { StudyActivityModel } from '../models/study-activity.model.js';
import { examSeeds } from '../data/exam-seeds.js';
import { submitExam } from './exam.service.js';
import { getExamActivity } from './exam-activity.js';
import learningRoutes from '../routes/learning.routes.js';
import { errorHandler } from '../middleware/error-handler.js';
import { signAccessToken } from './jwt.js';

const uri = process.env.EXAM_TEST_MONGODB_URI;
const databaseName = `hanflix_exam_activity_test_${process.pid}_${Date.now()}`;
const userId = new Types.ObjectId();
const otherId = new Types.ObjectId();
const app = express();
app.use('/learning', learningRoutes);
app.use(errorHandler);
describe.skipIf(!uri)('exam learning activity with real MongoDB', () => {
  beforeAll(async () => {
    if (!/^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(uri!)) throw new Error('Use a local MongoDB server without a database name');
    await mongoose.connect(uri!, { dbName: databaseName, serverSelectionTimeoutMS: 3000 });
    await Promise.all([ExamModel.init(), ExamAttemptModel.init()]);
    await ExamModel.create(examSeeds[0]);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
  afterAll(async () => {
    if (mongoose.connection.name === databaseName) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  it('persists approved alternatives and grades them on the server without exposing them in public details', async () => {
    const sample = structuredClone(examSeeds[2]!);
    const question = sample.sections[2]!.questions[0]!;
    Object.assign(question, { type: 'sentence_ordering', sentenceChunks: ['姐姐', '汉语说得', '我', '比', '流利'],
      correctAnswer: '姐姐比我汉语说得流利', acceptedAnswers: ['姐姐汉语说得比我流利'] });
    const saved = await ExamModel.create(sample);
    const publicData = await ExamModel.findById(saved._id).lean();
    expect(JSON.stringify(publicData)).not.toContain('acceptedAnswers');
    const result = await submitExam(sample.code, new Types.ObjectId(), { [question.id]: '姐姐 汉语说得 比 我 流利' }, 60, 'alternative');
    expect(result).toMatchObject({ writingScore: 20, questionResults: expect.arrayContaining([
      expect.objectContaining({ userAns: '姐姐 汉语说得 比 我 流利', isCorrect: true }),
    ]) });
  });
  it('records retries once, excludes blank work, isolates accounts and uses the Vietnam submission day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T17:00:01Z'));
    const id = examSeeds[0]!.code;
    const question = examSeeds[0]!.sections[0]!.questions[0]!;
    const answers = { [question.id]: question.correctAnswer };
    const [first, retry] = await Promise.all([
      submitExam(id, userId, answers, 120, 'same-submission'),
      submitExam(id, userId, answers, 120, 'same-submission'),
    ]);
    expect(retry).toEqual(first);
    expect(await ExamAttemptModel.countDocuments({ userId })).toBe(1);
    await submitExam(id, userId, { [question.id]: '  \t ' }, 900, 'blank');
    await submitExam(id, otherId, answers, 999, 'other-user');
    expect(await getExamActivity(userId)).toEqual([{ userId, dateKey: '2026-10-01', examAttempts: 1, examStudySeconds: 120 }]);
    expect(await getExamActivity(userId, { from: '2026-09-30', to: '2026-09-30' })).toEqual([]);
    // Retrying on a later day must not create a new learning day or overwrite duration.
    vi.setSystemTime(new Date('2026-10-01T17:00:01Z'));
    expect(await submitExam(id, userId, {}, 9999, 'same-submission')).toEqual(first);
    expect(await getExamActivity(userId)).toEqual([{ userId, dateKey: '2026-10-01', examAttempts: 1, examStudySeconds: 120 }]);
    expect(await StudyActivityModel.countDocuments({ userId })).toBe(0);
    vi.spyOn(UserModel, 'findById').mockReturnValue({ select: () => ({ lean: async () => ({ _id: userId,
      role: 'user', status: 'active', premiumExpiresAt: new Date('2027-01-01') }) }) } as never);
    const token = signAccessToken(String(userId), 'user');
    const streak = await request(app).get('/learning/streak').auth(token, { type: 'bearer' });
    expect(streak.body.data).toMatchObject({ streakCount: 1, activeDays: 1, today: '2026-10-02', isCompletedToday: false });
    const activity = await request(app).get('/learning/activity?from=2026-10-01&to=2026-10-02').auth(token, { type: 'bearer' });
    expect(activity.status).toBe(200);
    expect(activity.body.data.totals).toMatchObject({ examAttempts: 1, examStudySeconds: 120, activeStudySeconds: 120 });
    const history = await request(app).get('/learning/history').auth(token, { type: 'bearer' });
    expect(history.status).toBe(200);
    expect(history.body.data.stats).toMatchObject({ examAttempts: 1, examStudySeconds: 120, totalStudySeconds: 120 });
  });
});
