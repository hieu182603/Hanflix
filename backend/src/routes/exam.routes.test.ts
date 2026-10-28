import express from 'express';
import request from 'supertest';
import { Types } from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { examRoutes, adminExamRoutes } from './exam.routes.js';
import { errorHandler } from '../middleware/error-handler.js';
import { UserModel } from '../models/user.model.js';
import { ExamModel } from '../models/exam.model.js';
import { ExamAttemptModel } from '../models/exam-attempt.model.js';
import { StudyActivityModel } from '../models/study-activity.model.js';
import { signAccessToken } from '../services/jwt.js';
import { examSeeds } from '../data/exam-seeds.js';
import { AppError } from '../errors/app-error.js';

const generator = vi.hoisted(() => ({ generateExamDraft: vi.fn() }));
vi.mock('../services/exam-generator.js', async original => ({ ...await original<object>(), ...generator }));
vi.mock('../middleware/rate-limits.js', () => ({ aiLimiter: (_req: unknown, _res: unknown, next: () => void) => next() }));

const app = express();
app.use(express.json());
app.use('/exams', examRoutes);
app.use('/admin/exams', adminExamRoutes);
app.use(errorHandler);
const userId = new Types.ObjectId();
const token = signAccessToken(String(userId), 'user');
const exam = new ExamModel(examSeeds[0]).toObject();
beforeEach(() => {
  vi.spyOn(UserModel, 'findById').mockReturnValue({ select: () => ({ lean: async () => ({ _id: userId, role: 'user', status: 'active' }) }) } as never);
  vi.spyOn(UserModel, 'updateOne').mockResolvedValue({} as never);
  vi.spyOn(StudyActivityModel, 'findOneAndUpdate').mockResolvedValue({ _id: new Types.ObjectId() } as never);
});
afterEach(() => vi.restoreAllMocks());

describe('exam API', () => {
  it('filters published metadata without question arrays', async () => {
    const find = vi.spyOn(ExamModel, 'find').mockReturnValue({ select: () => ({ sort: () => ({ lean: async () => [exam] }) }) } as never);
    const res = await request(app).get('/exams?level=1&category=mini_test');
    expect(res.status).toBe(200);
    expect(find).toHaveBeenCalledWith({ isPublished: true, level: 1, category: 'mini_test' });
    expect(res.body.data[0]).not.toHaveProperty('sections');
    expect((await request(app).get('/exams?level=7')).status).toBe(422);
  });
  it('returns safe details and rejects missing exams', async () => {
    vi.spyOn(ExamModel, 'findOne').mockReturnValue({ lean: async () => exam } as never);
    const res = await request(app).get('/exams/H11001');
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('correctAnswer');
    expect(JSON.stringify(res.body)).not.toContain('explanationVi');
    expect(res.headers['cache-control']).toBe('no-store');
    vi.mocked(ExamModel.findOne).mockReturnValue({ lean: async () => null } as never);
    expect((await request(app).get('/exams/invalid')).status).toBe(404);
  });
  it('requires authentication and admin privileges', async () => {
    expect((await request(app).post('/exams/H11001/submit').send({ answers: {}, timeSpentSeconds: 0 })).status).toBe(401);
    expect((await request(app).get('/exams/my-history')).status).toBe(401);
    expect((await request(app).post('/admin/exams/import').send(examSeeds[0])).status).toBe(401);
    expect((await request(app).post('/admin/exams/import').auth(token, { type: 'bearer' }).send(examSeeds[0])).status).toBe(403);
  });
  it('persists authoritative results once and returns the snapshot on retry', async () => {
    vi.spyOn(ExamModel, 'findOne').mockReturnValue({ select: () => ({ lean: async () => exam }) } as never);
    let saved: Record<string, unknown> | null = null;
    vi.spyOn(ExamAttemptModel, 'findOne').mockImplementation(() => ({ select: () => ({ lean: async () => saved }) }) as never);
    const create = vi.spyOn(ExamAttemptModel, 'create').mockImplementation((async (value: Record<string, unknown>) => { saved = value; return value; }) as never);
    vi.spyOn(ExamAttemptModel, 'countDocuments').mockResolvedValue(1);
    const update = vi.spyOn(ExamModel, 'updateOne').mockResolvedValue({} as never);
    const answers = Object.fromEntries(examSeeds[0]!.sections.flatMap(section => section.questions).map(q => [q.id, q.correctAnswer]));
    const send = () => request(app).post('/exams/H11001/submit').auth(token, { type: 'bearer' }).set('Idempotency-Key', 'attempt-1').send({ answers, timeSpentSeconds: 40 });
    const first = await send();
    const retry = await send();
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ score: 200, isPassed: true, timeSpentSeconds: 40 });
    expect(first.body.data.questionResults[0].question.correctAnswer).toBe('A');
    expect(retry.body.data).toEqual(first.body.data);
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ _id: exam._id }, { $max: { attemptCount: 1 } });
  });
  it('restricts history to the authenticated user before dynamic ID routing', async () => {
    const find = vi.spyOn(ExamAttemptModel, 'find').mockReturnValue({ select: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) }) } as never);
    vi.spyOn(ExamAttemptModel, 'countDocuments').mockResolvedValue(0);
    const res = await request(app).get('/exams/my-history?userId=someone-else').auth(token, { type: 'bearer' });
    expect(res.status).toBe(200);
    expect(find).toHaveBeenCalledWith({ userId });
    expect(res.body.data.items).toEqual([]);
  });
  it('allows admins to upsert by code without resetting attempts', async () => {
    vi.mocked(UserModel.findById).mockReturnValue({ select: () => ({ lean: async () => ({ _id: userId, role: 'admin', status: 'active' }) }) } as never);
    vi.spyOn(ExamModel, 'init').mockResolvedValue(ExamModel);
    const update = vi.spyOn(ExamModel, 'updateOne').mockResolvedValue({} as never);
    const res = await request(app).post('/admin/exams/import').auth(token, { type: 'bearer' }).send({ ...examSeeds[0], attemptCount: 0 });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ code: 'H11001' }, { $set: examSeeds[0], $setOnInsert: { attemptCount: 0 } }, { upsert: true, runValidators: true });
  });
  describe('admin CRUD', () => {
    const asAdmin = () => vi.mocked(UserModel.findById).mockReturnValue({ select: () => ({ lean: async () => ({ _id: userId, role: 'admin', status: 'active' }) }) } as never);
    const examId = String(new Types.ObjectId());
    it('requires admin for every route', async () => {
      expect((await request(app).get('/admin/exams')).status).toBe(401);
      expect((await request(app).delete(`/admin/exams/${examId}`).auth(token, { type: 'bearer' })).status).toBe(403);
    });
    it('lists drafts too and escapes the search pattern', async () => {
      asAdmin();
      const find = vi.spyOn(ExamModel, 'find').mockReturnValue({ select: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [{ ...exam, isPublished: false }] }) }) }) }) } as never);
      vi.spyOn(ExamModel, 'countDocuments').mockResolvedValue(1);
      const res = await request(app).get('/admin/exams?status=draft&level=1&search=a.b').auth(token, { type: 'bearer' });
      expect(res.status).toBe(200);
      expect(find).toHaveBeenCalledWith({ level: 1, isPublished: false, $or: [{ code: /a\.b/i }, { title: /a\.b/i }] });
      expect(res.body.data.items[0]).toMatchObject({ code: 'H11001', isPublished: false });
      expect(res.body.data.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });
    it('returns answer keys to admins only through the admin detail route', async () => {
      asAdmin();
      const select = vi.fn(() => ({ lean: async () => exam }));
      vi.spyOn(ExamModel, 'findById').mockReturnValue({ select } as never);
      const res = await request(app).get(`/admin/exams/${examId}`).auth(token, { type: 'bearer' });
      expect(res.status).toBe(200);
      expect(select.mock.calls[0]![0]).toContain('+sections.questions.correctAnswer');
      expect(res.body.data.id).toBe(String(exam._id));
      expect((await request(app).get('/admin/exams/not-an-id').auth(token, { type: 'bearer' })).status).toBe(404);
    });
    it('creates, rejects invalid bodies with field paths and maps duplicate codes to 409', async () => {
      asAdmin();
      const create = vi.spyOn(ExamModel, 'create').mockResolvedValue({ toObject: () => exam } as never);
      expect((await request(app).post('/admin/exams').auth(token, { type: 'bearer' }).send(examSeeds[0])).status).toBe(201);
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ code: 'H11001', attemptCount: 0 }));
      const invalid = await request(app).post('/admin/exams').auth(token, { type: 'bearer' }).send({ ...examSeeds[0], totalQuestions: 99 });
      expect(invalid.status).toBe(422);
      expect(invalid.body.error.message).toContain('totalQuestions');
      create.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 11000 }));
      expect((await request(app).post('/admin/exams').auth(token, { type: 'bearer' }).send(examSeeds[0])).status).toBe(409);
    });
    it('drafts an exam with AI without saving it', async () => {
      asAdmin();
      const create = vi.spyOn(ExamModel, 'create');
      generator.generateExamDraft.mockResolvedValue({ exam: examSeeds[0], references: [], warnings: [] });
      const res = await request(app).post('/admin/exams/generate').auth(token, { type: 'bearer' }).send({ level: 3, category: 'full_mock', questionsPerSection: 4 });
      expect(res.status).toBe(200);
      expect(generator.generateExamDraft).toHaveBeenCalledWith({ level: 3, category: 'full_mock', questionsPerSection: 4 });
      expect(create).not.toHaveBeenCalled();
      expect((await request(app).post('/admin/exams/generate').auth(token, { type: 'bearer' }).send({ level: 9, category: 'mini_test' })).status).toBe(422);
      generator.generateExamDraft.mockRejectedValueOnce(new AppError(503, 'GEMINI_NOT_CONFIGURED', 'Gemini API chưa được cấu hình'));
      const failed = await request(app).post('/admin/exams/generate').auth(token, { type: 'bearer' }).send({ level: 1, category: 'mini_test' });
      expect(failed.status).toBe(503);
      expect(failed.body.error.message).toContain('Panda AI');
    });
    it('updates, toggles publication and deletes', async () => {
      asAdmin();
      const update = vi.spyOn(ExamModel, 'findByIdAndUpdate').mockReturnValue({ select: () => ({ lean: () => Promise.resolve(exam) }) } as never);
      expect((await request(app).put(`/admin/exams/${examId}`).auth(token, { type: 'bearer' }).send(examSeeds[0])).status).toBe(200);
      expect(update.mock.calls[0]![1]).toEqual({ $set: examSeeds[0] });
      expect((await request(app).patch(`/admin/exams/${examId}/publish`).auth(token, { type: 'bearer' }).send({ isPublished: false })).status).toBe(200);
      expect(update.mock.calls[1]![1]).toEqual({ $set: { isPublished: false } });
      vi.spyOn(ExamModel, 'findByIdAndDelete').mockResolvedValueOnce(exam as never).mockResolvedValueOnce(null as never);
      expect((await request(app).delete(`/admin/exams/${examId}`).auth(token, { type: 'bearer' })).status).toBe(204);
      expect((await request(app).delete(`/admin/exams/${examId}`).auth(token, { type: 'bearer' })).status).toBe(404);
    });
  });
  it('does not expose another user’s result snapshot', async () => {
    const attemptId = String(new Types.ObjectId());
    const find = vi.spyOn(ExamAttemptModel, 'findOne').mockReturnValue({ select: () => ({ lean: async () => null }) } as never);
    const response = await request(app).get(`/exams/my-history/${attemptId}`).auth(token, { type: 'bearer' });
    expect(response.status).toBe(404);
    expect(find).toHaveBeenCalledWith({ _id: attemptId, userId });
    expect((await request(app).get(`/exams/my-history/${attemptId}`)).status).toBe(401);
  });
});
