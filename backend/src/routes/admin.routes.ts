import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import mongoose, { Types } from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rate-limits.js';
import { validate } from '../middleware/validate.js';
import { LessonModel } from '../models/lesson.model.js';
import { ProcessingJobModel } from '../models/processing-job.model.js';
import { QuizModel } from '../models/quiz.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';
import { UserModel } from '../models/user.model.js';
import { confirmR2Object, createVideoUploadUrl } from '../services/r2.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const lessonInput = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  titleVi: z.string().trim().min(2).max(160),
  titleZh: z.string().trim().max(160).optional(),
  pinyin: z.string().trim().max(240).optional(),
  descriptionVi: z.string().trim().min(10).max(1000),
  hsk: z.number().int().min(1).max(6),
  topicIds: z.array(z.string().trim().min(1).max(50)).min(1).max(5),
  goalTags: z.array(z.enum(['daily', 'travel', 'work', 'hsk', 'culture', 'other'])).max(6).default([]),
  durationSeconds: z.number().min(60).max(300),
});
const lessonIdSchema = z.object({ lessonId: z.string().refine(Types.ObjectId.isValid) });
const presignSchema = z.object({
  lessonId: z.string().refine(Types.ObjectId.isValid),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.enum(['video/mp4', 'video/webm']),
  sizeBytes: z.number().int().positive(),
});
const confirmSchema = z.object({ lessonId: z.string().refine(Types.ObjectId.isValid), objectKey: z.string().min(1).max(500) });
const userIdSchema = z.object({ userId: z.string().refine(Types.ObjectId.isValid) });
const statusSchema = z.object({ status: z.enum(['active', 'locked']) });

router.post('/lessons', validate(lessonInput), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.create({ ...req.body, createdBy: req.auth!.userId, status: 'draft' });
  res.status(201).json({ data: lesson });
}));

router.patch('/lessons/:lessonId', validate(lessonIdSchema, 'params'), validate(lessonInput.partial()), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOneAndUpdate(
    { _id: req.params.lessonId, status: { $in: ['draft', 'ready_for_review', 'failed'] } },
    { $set: req.body },
    { new: true, runValidators: true },
  );
  if (!lesson) throw new AppError(409, 'LESSON_NOT_EDITABLE', 'Bài học không ở trạng thái có thể sửa');
  res.json({ data: lesson });
}));

router.post('/uploads/presign', uploadLimiter, validate(presignSchema), asyncHandler(async (req, res) => {
  if (req.body.sizeBytes > env.MAX_VIDEO_BYTES) throw new AppError(413, 'VIDEO_TOO_LARGE', 'Video vượt giới hạn dung lượng cấu hình');
  const lesson = await LessonModel.findOne({ _id: req.body.lessonId, createdBy: req.auth!.userId, status: { $in: ['draft', 'failed'] } });
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bản nháp video');
  const extension = req.body.contentType === 'video/mp4' ? 'mp4' : 'webm';
  const objectKey = `videos/${lesson._id}/${randomUUID()}.${extension}`;
  const signed = await createVideoUploadUrl(objectKey, req.body.contentType);
  lesson.status = 'uploading';
  await lesson.save();
  res.json({ data: { ...signed, requiredHeaders: { 'Content-Type': req.body.contentType }, maxBytes: env.MAX_VIDEO_BYTES } });
}));

router.post('/uploads/confirm', uploadLimiter, validate(confirmSchema), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOne({ _id: req.body.lessonId, createdBy: req.auth!.userId, status: 'uploading' });
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy video đang tải lên');
  if (!req.body.objectKey.startsWith(`videos/${lesson._id}/`)) throw new AppError(422, 'INVALID_OBJECT_KEY', 'Đường dẫn R2 không thuộc bài học');
  const object = await confirmR2Object(req.body.objectKey);
  if (!['video/mp4', 'video/webm'].includes(object.contentType ?? '') || object.sizeBytes > env.MAX_VIDEO_BYTES) {
    throw new AppError(422, 'INVALID_UPLOADED_VIDEO', 'Object R2 không đúng định dạng hoặc dung lượng');
  }
  lesson.media = {
    objectKey: req.body.objectKey,
    mimeType: object.contentType as 'video/mp4' | 'video/webm',
    sizeBytes: object.sizeBytes,
    etag: object.etag,
  };
  lesson.status = 'processing';
  await lesson.save();
  const job = await ProcessingJobModel.create({ lessonId: lesson._id, status: 'queued', stage: 'inspect_media' });
  res.json({ data: { lessonId: lesson._id, status: lesson.status, processingJobId: job._id, media: { sizeBytes: object.sizeBytes, contentType: object.contentType } } });
}));

router.get('/lessons/:lessonId/processing', validate(lessonIdSchema, 'params'), asyncHandler(async (req, res) => {
  const job = await ProcessingJobModel.findOne({ lessonId: req.params.lessonId }).sort({ createdAt: -1 }).lean();
  if (!job) throw new AppError(404, 'PROCESSING_JOB_NOT_FOUND', 'Không tìm thấy tiến trình xử lý');
  res.json({ data: job });
}));

router.post('/lessons/:lessonId/processing/retry', uploadLimiter, validate(lessonIdSchema, 'params'), asyncHandler(async (req, res) => {
  const job = await ProcessingJobModel.findOneAndUpdate(
    { lessonId: req.params.lessonId, status: 'failed' },
    { $set: { status: 'queued', lockedAt: null, lockedBy: null, errorCode: null, errorMessage: null }, $inc: { attempts: 1 } },
    { new: true },
  );
  if (!job) throw new AppError(409, 'PROCESSING_NOT_RETRYABLE', 'Tiến trình không ở trạng thái có thể thử lại');
  await LessonModel.updateOne({ _id: req.params.lessonId }, { $set: { status: 'processing' } });
  res.json({ data: job });
}));

router.post('/lessons/:lessonId/publish', validate(lessonIdSchema, 'params'), asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  let publishedLesson;
  try {
    await session.withTransaction(async () => {
      const lesson = await LessonModel.findOne({ _id: req.params.lessonId, status: 'ready_for_review' }).session(session);
      if (!lesson) throw new AppError(409, 'LESSON_NOT_READY', 'Bài học chưa sẵn sàng để đăng');
      const [subtitle, quiz] = await Promise.all([
        SubtitleTrackModel.findOne({ lessonId: lesson._id, status: 'draft' }).sort({ revision: -1 }).session(session),
        QuizModel.findOne({ lessonId: lesson._id, status: 'draft' }).sort({ revision: -1 }).session(session),
      ]);
      if (!lesson.media || !subtitle || !quiz || subtitle.cues.length === 0 || quiz.questions.length === 0) {
        throw new AppError(422, 'CONTENT_INCOMPLETE', 'Cần video, phụ đề và bài tập đã duyệt trước khi đăng');
      }
      subtitle.status = 'published';
      subtitle.reviewedBy = req.auth!.userId;
      quiz.status = 'published';
      lesson.status = 'published';
      lesson.activeSubtitleRevision = subtitle.revision;
      lesson.activeQuizRevision = quiz.revision;
      lesson.publishedAt = new Date();
      await Promise.all([subtitle.save({ session }), quiz.save({ session }), lesson.save({ session })]);
      publishedLesson = lesson;
    });
  } finally {
    await session.endSession();
  }
  res.json({ data: publishedLesson });
}));

router.get('/users', asyncHandler(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  const filter = q ? { $text: { $search: q } } : {};
  const users = await UserModel.find(filter).select('name email role status learningProfile createdAt').sort({ createdAt: -1 }).limit(100).lean();
  res.json({ data: { items: users } });
}));

router.patch('/users/:userId/status', validate(userIdSchema, 'params'), validate(statusSchema), asyncHandler(async (req, res) => {
  if (req.params.userId === req.auth!.userId.toString()) throw new AppError(422, 'CANNOT_LOCK_SELF', 'Không thể khóa tài khoản đang đăng nhập');
  const user = await UserModel.findOneAndUpdate({ _id: req.params.userId, role: 'user' }, { $set: { status: req.body.status } }, { new: true })
    .select('name email role status');
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy người học');
  res.json({ data: user });
}));

export default router;
