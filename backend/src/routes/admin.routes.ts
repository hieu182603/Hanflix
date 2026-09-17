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
import { confirmR2Object, createVideoDownloadUrl, createVideoUploadUrl, deleteR2Object } from '../services/r2.js';
import { addVideoProcessingJob, retryVideoProcessingJob } from '../queue/video.queue.js';
import { wakeVideoProcessingWorker } from '../workers/video-processing.worker.js';
import { withProcessingCompatibility } from '../services/lesson-presentation.js';
import { pinyinService } from '../services/pinyin.js';
import { asyncHandler } from '../utils/async-handler.js';
import adminVocabularyRoutes from './admin-vocabulary.routes.js';
import adminGrammarRoutes from './admin-grammar.routes.js';

const router = Router();
router.use(requireAuth, requireAdmin);
router.use('/vocabulary', adminVocabularyRoutes);
router.use('/grammar', adminGrammarRoutes);

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
const processingListSchema = z.object({
  status: z.enum(['queued', 'running', 'failed', 'completed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
const cueInput = z.object({
  cueId: z.string().min(1).max(100),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  zh: z.string().trim().min(1).max(1000),
  pinyin: z.string().trim().min(1).max(2000).optional(),
  vi: z.string().trim().min(1).max(2000),
}).refine(cue => cue.endMs > cue.startMs, { message: 'endMs phải lớn hơn startMs' });
const subtitleDraftSchema = z.object({ cues: z.array(cueInput).min(1).max(500) }).superRefine((value, context) => {
  const ids = new Set<string>();
  value.cues.forEach((cue, index) => {
    if (ids.has(cue.cueId)) context.addIssue({ code: 'custom', path: ['cues', index, 'cueId'], message: 'cueId bị trùng' });
    ids.add(cue.cueId);
  });
});
const quizQuestionInput = z.object({
  questionId: z.string().trim().min(1).max(100),
  type: z.enum(['multiple_choice', 'fill_blank']),
  prompt: z.string().trim().min(1).max(1000),
  cueId: z.string().trim().max(100).optional(),
  options: z.array(z.object({ optionId: z.string().min(1).max(100), text: z.string().trim().min(1).max(500) })).max(6).default([]),
  correctOptionId: z.string().max(100).optional(),
  acceptedAnswers: z.array(z.string().trim().min(1).max(500)).max(10).optional(),
  explanationVi: z.string().trim().min(1).max(2000),
}).superRefine((question, context) => {
  const optionIds = new Set<string>();
  question.options.forEach((option, index) => {
    if (optionIds.has(option.optionId)) context.addIssue({ code: 'custom', path: ['options', index, 'optionId'], message: 'optionId bị trùng' });
    optionIds.add(option.optionId);
  });
  if (question.type === 'multiple_choice' && (!question.correctOptionId ||
    !question.options.some(option => option.optionId === question.correctOptionId))) {
    context.addIssue({ code: 'custom', path: ['correctOptionId'], message: 'Đáp án đúng phải nằm trong options' });
  }
  if (question.type === 'fill_blank' && !question.acceptedAnswers?.length) {
    context.addIssue({ code: 'custom', path: ['acceptedAnswers'], message: 'Cần ít nhất một đáp án chấp nhận' });
  }
});
const quizDraftSchema = z.object({ questions: z.array(quizQuestionInput).min(1).max(20) }).superRefine((value, context) => {
  const questionIds = new Set<string>();
  value.questions.forEach((question, index) => {
    if (questionIds.has(question.questionId)) context.addIssue({ code: 'custom', path: ['questions', index, 'questionId'], message: 'questionId bị trùng' });
    questionIds.add(question.questionId);
  });
});

router.post('/lessons', validate(lessonInput), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.create({ ...req.body, createdBy: req.auth!.userId, status: 'draft' });
  res.status(201).json({ data: lesson });
}));

router.get('/lessons', asyncHandler(async (_req, res) => {
  const items = await LessonModel.find().select('-media.objectKey').sort({ createdAt: -1 }).limit(100).lean();
  res.json({ data: { items: items.map(item => withProcessingCompatibility(item)) } });
}));

router.get('/lessons/:lessonId', validate(lessonIdSchema, 'params'), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findById(req.params.lessonId).select('-media.objectKey').lean();
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  res.json({ data: withProcessingCompatibility(lesson) });
}));

router.patch('/lessons/:lessonId', validate(lessonIdSchema, 'params'), validate(lessonInput.partial()), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOneAndUpdate(
    { _id: req.params.lessonId, status: { $in: ['draft', 'ready_for_review', 'failed'] } },
    { $set: req.body },
    { returnDocument: 'after', runValidators: true },
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
  lesson.processingStatus = 'UPLOADED';
  lesson.processingStep = 'UPLOADING';
  lesson.processingProgress = 0;
  lesson.processingError = undefined;
  lesson.pendingUploadObjectKey = objectKey;
  await lesson.save();
  res.json({ data: { ...signed, requiredHeaders: { 'Content-Type': req.body.contentType }, maxBytes: env.MAX_VIDEO_BYTES } });
}));

router.post('/uploads/confirm', uploadLimiter, validate(confirmSchema), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOne({ _id: req.body.lessonId, createdBy: req.auth!.userId, status: 'uploading' })
    .select('+pendingUploadObjectKey');
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy video đang tải lên');
  if (!lesson.pendingUploadObjectKey || req.body.objectKey !== lesson.pendingUploadObjectKey) {
    throw new AppError(422, 'INVALID_OBJECT_KEY', 'Đường dẫn R2 không khớp phiên tải lên');
  }
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
  lesson.processingStatus = 'QUEUED';
  lesson.processingStep = 'QUEUED';
  lesson.processingProgress = 5;
  lesson.processingError = undefined;
  lesson.pendingUploadObjectKey = undefined;
  await lesson.save();
  const job = await addVideoProcessingJob({
    lessonId: lesson._id.toString(),
    objectKey: req.body.objectKey,
  });
  wakeVideoProcessingWorker();

  res.json({ data: { lessonId: lesson._id, status: lesson.status, processingJobId: job._id, media: { sizeBytes: object.sizeBytes, contentType: object.contentType } } });
}));

router.post('/lessons/:lessonId/upload/cancel', uploadLimiter, validate(lessonIdSchema, 'params'), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOne({
    _id: req.params.lessonId,
    createdBy: req.auth!.userId,
    status: 'uploading',
  }).select('+pendingUploadObjectKey');
  if (!lesson) throw new AppError(409, 'UPLOAD_NOT_CANCELLABLE', 'Bài học không có phiên tải lên để hủy');
  if (lesson.pendingUploadObjectKey) await deleteR2Object(lesson.pendingUploadObjectKey);
  lesson.status = 'draft';
  lesson.processingProgress = 0;
  lesson.processingError = undefined;
  lesson.pendingUploadObjectKey = undefined;
  lesson.set('processingStatus', undefined);
  lesson.set('processingStep', undefined);
  await lesson.save();
  res.json({ data: { lessonId: lesson._id, status: lesson.status } });
}));

router.get('/lessons/:lessonId/processing', validate(lessonIdSchema, 'params'), asyncHandler(async (req, res) => {
  const [job, lesson] = await Promise.all([
    ProcessingJobModel.findOne({ lessonId: req.params.lessonId }).sort({ createdAt: -1 }).lean(),
    LessonModel.findById(req.params.lessonId).select('status processingStatus processingProgress processingStep processingError').lean(),
  ]);
  if (!job) throw new AppError(404, 'PROCESSING_JOB_NOT_FOUND', 'Không tìm thấy tiến trình xử lý');
  res.json({ data: { ...job, video: lesson } });
}));

router.get('/processing-jobs', validate(processingListSchema, 'query'), asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query as unknown as z.infer<typeof processingListSchema>;
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    ProcessingJobModel.find(filter).select('-objectKey -activeKey -lockedBy').sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    ProcessingJobModel.countDocuments(filter),
  ]);
  res.json({ data: { items, page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.get('/lessons/:lessonId/review', validate(lessonIdSchema, 'params'), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findById(req.params.lessonId).select('status titleVi durationSeconds').lean();
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  const [subtitle, quiz] = await Promise.all([
    SubtitleTrackModel.findOne({ lessonId: lesson._id, status: 'draft' }).sort({ revision: -1 }).lean(),
    QuizModel.findOne({ lessonId: lesson._id, status: 'draft' }).sort({ revision: -1 })
      .select('+questions.correctOptionId +questions.acceptedAnswers +questions.explanationVi').lean(),
  ]);
  res.json({ data: { lesson, subtitle, quiz } });
}));

router.get('/lessons/:lessonId/media', validate(lessonIdSchema, 'params'), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findById(req.params.lessonId).select('status media thumbnailKey').lean();
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  if (!lesson.media?.objectKey) throw new AppError(404, 'MEDIA_NOT_FOUND', 'Bài học chưa có video');
  const [url, thumbnailUrl] = await Promise.all([
    createVideoDownloadUrl(lesson.media.objectKey),
    lesson.thumbnailKey ? createVideoDownloadUrl(lesson.thumbnailKey) : Promise.resolve(null),
  ]);
  res.json({ data: {
    lessonId: lesson._id,
    status: lesson.status,
    media: { url, mimeType: lesson.media.mimeType, sizeBytes: lesson.media.sizeBytes },
    thumbnailUrl,
  } });
}));

router.put('/lessons/:lessonId/subtitles', validate(lessonIdSchema, 'params'), validate(subtitleDraftSchema), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOne({ _id: req.params.lessonId, status: 'ready_for_review' }).select('durationSeconds').lean();
  if (!lesson) throw new AppError(409, 'LESSON_NOT_READY', 'Bài học chưa sẵn sàng để duyệt');
  const track = await SubtitleTrackModel.findOne({ lessonId: lesson._id, status: 'draft' }).sort({ revision: -1 });
  if (!track) throw new AppError(404, 'SUBTITLES_NOT_FOUND', 'Không tìm thấy phụ đề nháp');
  const previous = new Map(track.cues.map(cue => [cue.cueId, cue]));
  const cues = (req.body as z.infer<typeof subtitleDraftSchema>).cues.map(cue => {
    if (cue.endMs > lesson.durationSeconds * 1000) throw new AppError(422, 'INVALID_CUE_TIME', 'Phụ đề vượt thời lượng video');
    const old = previous.get(cue.cueId);
    return {
      ...cue,
      pinyin: cue.pinyin || pinyinService.convert(cue.zh),
      tokens: old?.zh === cue.zh ? old.tokens : pinyinService.tokenize(cue.zh).map(token => ({ text: token.text, wordId: null })),
    };
  });
  track.set('cues', cues);
  await track.save();
  res.json({ data: track });
}));

router.put('/lessons/:lessonId/quiz', validate(lessonIdSchema, 'params'), validate(quizDraftSchema), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOne({ _id: req.params.lessonId, status: 'ready_for_review' }).select('_id').lean();
  if (!lesson) throw new AppError(409, 'LESSON_NOT_READY', 'Bài học chưa sẵn sàng để duyệt');
  const quiz = await QuizModel.findOne({ lessonId: lesson._id, status: 'draft' }).sort({ revision: -1 })
    .select('+questions.correctOptionId +questions.acceptedAnswers +questions.explanationVi');
  if (!quiz) throw new AppError(404, 'QUIZ_NOT_FOUND', 'Không tìm thấy bài tập nháp');
  quiz.set('questions', (req.body as z.infer<typeof quizDraftSchema>).questions.map(question => ({
    ...question,
    relatedWordIds: [],
  })));
  await quiz.save();
  res.json({ data: quiz });
}));

const retryProcessing = asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOne({ _id: req.params.lessonId, status: 'failed', 'media.objectKey': { $exists: true } });
  if (!lesson?.media?.objectKey) throw new AppError(409, 'PROCESSING_NOT_RETRYABLE', 'Video không ở trạng thái có thể thử lại');
  const job = await retryVideoProcessingJob(lesson._id.toString(), lesson.media.objectKey);
  if (!job) throw new AppError(409, 'PROCESSING_NOT_RETRYABLE', 'Không tìm thấy tiến trình lỗi để thử lại');
  lesson.status = 'processing';
  lesson.processingStatus = 'QUEUED';
  lesson.processingStep = 'QUEUED';
  lesson.processingProgress = 0;
  lesson.processingError = undefined;
  await lesson.save();
  wakeVideoProcessingWorker();
  res.json({ data: job });
});

router.post('/lessons/:lessonId/processing/retry', uploadLimiter, validate(lessonIdSchema, 'params'), retryProcessing);
router.post('/videos/:lessonId/retry-processing', uploadLimiter, validate(lessonIdSchema, 'params'), retryProcessing);

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
      lesson.processingStatus = 'READY';
      lesson.processingStep = 'COMPLETED';
      lesson.processingProgress = 100;
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

router.post('/lessons/:lessonId/hide', validate(lessonIdSchema, 'params'), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOneAndUpdate(
    { _id: req.params.lessonId, status: 'published' },
    { $set: { status: 'hidden', hiddenAt: new Date(), hiddenBy: req.auth!.userId } },
    { returnDocument: 'after', runValidators: true },
  ).select('-media.objectKey');
  if (!lesson) throw new AppError(409, 'LESSON_NOT_PUBLISHED', 'Chỉ có thể ẩn bài học đang xuất bản');
  res.json({ data: withProcessingCompatibility(lesson.toObject()) });
}));

router.post('/lessons/:lessonId/restore', validate(lessonIdSchema, 'params'), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOneAndUpdate(
    { _id: req.params.lessonId, status: 'hidden' },
    { $set: { status: 'published' }, $unset: { hiddenAt: 1, hiddenBy: 1 } },
    { returnDocument: 'after', runValidators: true },
  ).select('-media.objectKey');
  if (!lesson) throw new AppError(409, 'LESSON_NOT_HIDDEN', 'Chỉ có thể khôi phục bài học đang bị ẩn');
  res.json({ data: withProcessingCompatibility(lesson.toObject()) });
}));

router.get('/users', asyncHandler(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  const filter = q ? { $text: { $search: q } } : {};
  const users = await UserModel.find(filter).select('name email role status learningProfile createdAt').sort({ createdAt: -1 }).limit(100).lean();
  res.json({ data: { items: users } });
}));

router.patch('/users/:userId/status', validate(userIdSchema, 'params'), validate(statusSchema), asyncHandler(async (req, res) => {
  if (req.params.userId === req.auth!.userId.toString()) throw new AppError(422, 'CANNOT_LOCK_SELF', 'Không thể khóa tài khoản đang đăng nhập');
  const user = await UserModel.findOneAndUpdate({ _id: req.params.userId, role: 'user' }, { $set: { status: req.body.status } }, { returnDocument: 'after' })
    .select('name email role status');
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy người học');
  res.json({ data: user });
}));

export default router;
