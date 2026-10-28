import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../errors/app-error.js';
import { ExamModel, examCategories, type Exam } from '../models/exam.model.js';
import { ExamAttemptModel } from '../models/exam-attempt.model.js';
import { examFilter, examMetadata, gradedFieldsSelect, publicExam, importExams, submitExam } from '../services/exam.service.js';
import { importExamSchema, importExamsSchema, submitExamSchema } from '../services/exam-validation.js';
import { generateExamDraft, generateExamInputSchema } from '../services/exam-generator.js';
import { normalizeAiError } from '../services/gemini.js';
import { aiLimiter } from '../middleware/rate-limits.js';

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

adminExamRoutes.use(requireAuth, requireAdmin);

adminExamRoutes.post('/import', asyncHandler(async (req, res) => {
  const parsed = importExamsSchema.parse(req.body);
  res.json({ data: await importExams(Array.isArray(parsed) ? parsed : [parsed]) });
}));

const adminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  level: z.coerce.number().int().min(1).max(6).optional(),
  category: z.enum(examCategories).optional(),
  status: z.enum(['published', 'draft', 'all']).default('all'),
  search: z.string().trim().max(200).optional(),
});

// Surface the first issues with their paths so the editor can point at the broken field.
function parseExamBody(body: unknown) {
  const result = importExamSchema.safeParse(body);
  if (result.success) return result.data;
  const message = result.error.issues.slice(0, 3)
    .map(issue => `${issue.path.join('.') || 'Đề thi'}: ${issue.message}`).join('; ');
  throw new AppError(422, 'EXAM_INVALID', message, result.error.flatten());
}

function adminExamId(value: unknown) {
  const id = String(value);
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, 'EXAM_NOT_FOUND', 'Không tìm thấy đề thi');
  return id;
}

function rethrowDuplicateCode(error: unknown): never {
  if (error instanceof Error && 'code' in error && error.code === 11000) {
    throw new AppError(409, 'DUPLICATE_CODE', 'Mã đề đã tồn tại');
  }
  throw error;
}

const adminSummary = (exam: Omit<Exam, 'sections'> & { _id: Types.ObjectId; createdAt?: Date; updatedAt?: Date }) => ({
  ...examMetadata(exam), isPublished: exam.isPublished, createdAt: exam.createdAt, updatedAt: exam.updatedAt,
});

// Returns an unsaved draft; the admin reviews it in the editor before creating the exam.
adminExamRoutes.post('/generate', aiLimiter, asyncHandler(async (req, res) => {
  const input = generateExamInputSchema.parse(req.body);
  try {
    res.json({ data: await generateExamDraft(input) });
  } catch (error) {
    const normalized = normalizeAiError(error);
    // Keep Panda-branded wording consistent with the rest of the AI surface.
    throw normalized.code === 'AI_UNAVAILABLE'
      ? new AppError(503, 'AI_UNAVAILABLE', 'Panda AI đang bận hoặc chưa được cấu hình. Thử lại sau.')
      : normalized;
  }
}));

adminExamRoutes.get('/stats', asyncHandler(async (_req, res) => {
  const [byLevel, byStatus] = await Promise.all([
    ExamModel.aggregate<{ _id: number; count: number; attempts: number }>([
      { $group: { _id: '$level', count: { $sum: 1 }, attempts: { $sum: '$attemptCount' } } },
    ]),
    ExamModel.aggregate<{ _id: boolean; count: number }>([{ $group: { _id: '$isPublished', count: { $sum: 1 } } }]),
  ]);
  res.json({ data: {
    total: byLevel.reduce((sum, item) => sum + item.count, 0),
    totalAttempts: byLevel.reduce((sum, item) => sum + item.attempts, 0),
    published: byStatus.find(item => item._id === true)?.count ?? 0,
    draft: byStatus.find(item => item._id !== true)?.count ?? 0,
    byLevel: Object.fromEntries(byLevel.map(item => [String(item._id), item.count])),
  } });
}));

adminExamRoutes.get('/', asyncHandler(async (req, res) => {
  const query = adminListQuerySchema.parse(req.query);
  const filter: Record<string, unknown> = {};
  if (query.level) filter.level = query.level;
  if (query.category) filter.category = query.category;
  if (query.status !== 'all') filter.isPublished = query.status === 'published';
  if (query.search) {
    const pattern = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ code: pattern }, { title: pattern }];
  }
  const [items, total] = await Promise.all([
    ExamModel.find(filter).select('-sections').sort({ level: 1, code: 1 })
      .skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    ExamModel.countDocuments(filter),
  ]);
  res.json({ data: {
    items: items.map(adminSummary),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
  } });
}));

adminExamRoutes.get('/:id', asyncHandler(async (req, res) => {
  const exam = await ExamModel.findById(adminExamId(req.params.id)).select(gradedFieldsSelect).lean();
  if (!exam) throw new AppError(404, 'EXAM_NOT_FOUND', 'Không tìm thấy đề thi');
  const { _id, ...rest } = exam;
  res.json({ data: { ...rest, id: String(_id) } });
}));

adminExamRoutes.post('/', asyncHandler(async (req, res) => {
  const exam = parseExamBody(req.body);
  const created = await ExamModel.create({ ...exam, attemptCount: 0 }).catch(rethrowDuplicateCode);
  res.status(201).json({ data: adminSummary(created.toObject()) });
}));

adminExamRoutes.put('/:id', asyncHandler(async (req, res) => {
  const id = adminExamId(req.params.id);
  const exam = parseExamBody(req.body);
  const updated = await ExamModel.findByIdAndUpdate(id, { $set: exam }, { returnDocument: 'after', runValidators: true })
    .select('-sections').lean().catch(rethrowDuplicateCode);
  if (!updated) throw new AppError(404, 'EXAM_NOT_FOUND', 'Không tìm thấy đề thi');
  res.json({ data: adminSummary(updated) });
}));

adminExamRoutes.patch('/:id/publish', asyncHandler(async (req, res) => {
  const { isPublished } = z.object({ isPublished: z.boolean() }).strict().parse(req.body);
  const updated = await ExamModel.findByIdAndUpdate(adminExamId(req.params.id), { $set: { isPublished } }, { returnDocument: 'after' })
    .select('-sections').lean();
  if (!updated) throw new AppError(404, 'EXAM_NOT_FOUND', 'Không tìm thấy đề thi');
  res.json({ data: adminSummary(updated) });
}));

// Past attempts keep their own result snapshot, so history stays readable after deletion.
adminExamRoutes.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = await ExamModel.findByIdAndDelete(adminExamId(req.params.id));
  if (!deleted) throw new AppError(404, 'EXAM_NOT_FOUND', 'Không tìm thấy đề thi');
  res.status(204).send();
}));
