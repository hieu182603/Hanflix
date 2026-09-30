import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../errors/app-error.js';
import { ExamModel, examCategories } from '../models/exam.model.js';
import { ExamAttemptModel } from '../models/exam-attempt.model.js';
import { examFilter, examMetadata, publicExam, importExams, submitExam } from '../services/exam.service.js';
import { importExamsSchema, submitExamSchema } from '../services/exam-validation.js';

export const examRoutes = Router();
export const adminExamRoutes = Router();
examRoutes.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

examRoutes.get('/', asyncHandler(async (req, res) => {
  const query = z.object({ level: z.coerce.number().int().min(1).max(6).optional(), category: z.enum(examCategories).optional() }).parse(req.query);
  const exams = await ExamModel.find({ isPublished: true, ...query }).select('-sections').sort({ level: 1, code: 1 }).lean();
  res.json({ data: exams.map(examMetadata) });
}));

// History endpoints must precede /:id to prevent route shadowing.
examRoutes.get('/my-history', requireAuth, asyncHandler(async (req, res) => {
  const { page, limit } = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(req.query);
  const filter = { userId: req.auth!.userId };
  const [items, total] = await Promise.all([
    ExamAttemptModel.find(filter).select('-answers -resultJson -submissionKey -userId').sort({ submittedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ExamAttemptModel.countDocuments(filter),
  ]);
  res.json({ data: { items: items.map(item => ({ ...item, id: String(item._id) })), page, limit, total } });
}));

examRoutes.get('/my-history/:attemptId', requireAuth, asyncHandler(async (req, res) => {
  const id = String(req.params.attemptId);
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'Không tìm thấy bài làm');
  const attempt = await ExamAttemptModel.findOne({ _id: id, userId: req.auth!.userId }).select('+resultJson').lean();
  if (!attempt) throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'Không tìm thấy bài làm');
  const result: unknown = JSON.parse(attempt.resultJson);
  res.json({ data: result });
}));

examRoutes.get('/:id', asyncHandler(async (req, res) => {
  const exam = await ExamModel.findOne(examFilter(String(req.params.id))).lean();
  if (!exam) throw new AppError(404, 'EXAM_NOT_FOUND', 'Không tìm thấy đề thi');
  res.json({ data: publicExam(exam) });
}));

examRoutes.post('/:id/submit', requireAuth, asyncHandler(async (req, res) => {
  const body = submitExamSchema.parse(req.body);
  const key = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/).parse(req.header('Idempotency-Key') ?? randomUUID());
  res.json({ data: await submitExam(String(req.params.id), req.auth!.userId, body.answers, body.timeSpentSeconds, key) });
}));

adminExamRoutes.post('/import', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const parsed = importExamsSchema.parse(req.body);
  res.json({ data: await importExams(Array.isArray(parsed) ? parsed : [parsed]) });
}));
