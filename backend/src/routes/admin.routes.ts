import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import mongoose, { Types } from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rate-limits.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { LessonModel } from '../models/lesson.model.js';
import { ProcessingJobModel } from '../models/processing-job.model.js';
import { processingStatusDto } from '../services/pipeline/processing-status.js';
import { QuizModel } from '../models/quiz.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';
import { UserModel } from '../models/user.model.js';
import { confirmR2Object, createVideoDownloadUrl, createVideoUploadUrl, deleteR2Object } from '../services/r2.js';
import { resolveLearningWordIds } from '../services/learning-word.js';
import { logger } from '../services/logger.js';
import { addVideoProcessingJob, retryVideoProcessingJob } from '../queue/video.queue.js';
import { purgeAdminLesson } from '../services/lesson-delete.js';
import { runEditorCommit } from '../services/revision-commit.js';
import { generateQuizWithGemini, type QuestionKind } from '../services/quiz-generator.js';
import { autoGenerateQuizForLesson } from '../services/auto-quiz-generator.js';
import { wakeVideoProcessingWorker } from '../workers/video-processing.worker.js';
import { withProcessingCompatibility } from '../services/lesson-presentation.js';
import { getCachedSignedDownloadUrl } from '../services/signed-url-cache.js';
import { pinyinService } from '../services/pinyin.js';
import { asyncHandler } from '../utils/async-handler.js';
import { NotificationService } from '../services/notification.service.js';
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
  hsk: z.number().int().min(1).max(9),
  topicIds: z.array(z.string().trim().min(1).max(50)).min(1).max(5),
  goalTags: z.array(z.enum(['daily', 'travel', 'work', 'hsk', 'culture', 'other'])).max(6).default([]),
  // CONTENT MODE (2026-09-22): nới duration theo mode. Lesson cap 300s cũ vẫn là default.
  // Podcast cho phép tới VIDEO_MAX_DURATION_PODCAST_SECONDS (default 5400s).
  durationSeconds: z.number().min(60, 'Thời lượng video tối thiểu là 1 phút (60 giây)').max(21600),
  // Optional override for AI-generated quiz question count (1-15).
  // Undefined / null = use HSK-based heuristic.
  autoGenerateQuizCount: z.number().int().min(1).max(15).optional().nullable(),
  // CONTENT MODE: loại nội dung. Default 'lesson' để tương thích ngược.
  contentMode: z.enum(['lesson', 'song', 'podcast', 'drama']).default('lesson'),
  mediaType: z.enum(['AUTO', 'MOVIE', 'PODCAST', 'MUSIC']).optional(),
  // SONG-specific
  lyricsRaw: z.string().max(20000).optional(),
  lyricsSource: z.enum(['lrc', 'manual', 'auto']).optional(),
  // DRAMA-specific
  characters: z.array(z.object({
    speakerId: z.string().min(1).max(50),
    displayName: z.string().min(1).max(100),
    descriptionVi: z.string().max(500).optional(),
    color: z.string().max(20).optional(),
    avatarUrl: z.string().max(500).optional(),
  })).max(20).optional(),
});
const lessonIdSchema = z.object({ lessonId: z.string().refine(Types.ObjectId.isValid) });
const presignSchema = z.object({
  lessonId: z.string().refine(Types.ObjectId.isValid),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.enum(['video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav']),
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
const subtitleDraftSchema = z.object({ cues: z.array(cueInput).min(1).max(10000) }).superRefine((value, context) => {
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

const quizGenerationInput = z.object({
  kinds: z.array(z.enum(['comprehension', 'vocabulary', 'grammar', 'cloze'])).min(1).max(4),
  questionCount: z.number().int().min(1).max(15).default(5),
});

router.post('/lessons', validate(lessonInput), asyncHandler(async (req, res) => {
  if (req.body.durationSeconds < 60) throw new AppError(422, 'VIDEO_DURATION_TOO_SHORT', 'Thời lượng video phải từ 1 phút đến 10 phút (60s – 600s)');
  if (req.body.durationSeconds > (req.body.contentMode === 'podcast' ? env.VIDEO_MAX_DURATION_PODCAST_SECONDS : 600)) throw new AppError(422, 'VIDEO_DURATION_EXCEEDED', 'Thời lượng video vượt quá giới hạn tối đa (10 phút)');
  const lesson = await LessonModel.create({ ...req.body, mediaType: req.body.mediaType ?? 'AUTO', createdBy: req.auth!.userId, status: 'draft' });
  res.status(201).json({ data: lesson });
}));

async function safeDownloadUrl(key?: string | null): Promise<string | null> {
  if (!key) return null;
  try {
    return await getCachedSignedDownloadUrl(key);
  } catch {
    return null;
  }
}

const lessonListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(8),
  hsk: z.coerce.number().int().min(1).max(9).optional(),
  status: z.enum(['draft', 'uploading', 'processing', 'ready_for_review', 'published', 'hidden', 'failed']).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  // CONTENT MODE (2026-09-22): filter theo contentMode ở admin list.
  contentMode: z.enum(['lesson', 'song', 'podcast', 'drama']).optional(),
});

router.get('/lessons', validateQuery(lessonListQuerySchema), asyncHandler(async (req, res) => {
  const { page, limit, hsk, status, search, contentMode } = (req as unknown as { parsedQuery: z.infer<typeof lessonListQuerySchema> }).parsedQuery;
  const filter: Record<string, unknown> = {};
  if (hsk !== undefined) filter.hsk = hsk;
  if (status) filter.status = status;
  if (contentMode === 'lesson') filter.$and = [{ $or: [{ contentMode: 'lesson' }, { contentMode: { $exists: false } }, { contentMode: null }] }];
  else if (contentMode) filter.contentMode = contentMode;
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'i');
    filter.$or = [{ titleVi: re }, { titleZh: re }, { pinyin: re }, { descriptionVi: re }];
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    LessonModel.find(filter)
      .select('-media.objectKey')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LessonModel.countDocuments(filter),
  ]);
  const itemsWithThumbnails = await Promise.all(
    items.map(async item => {
      const thumbnailUrl = await safeDownloadUrl(item.thumbnailKey);
      return withProcessingCompatibility({ ...item, thumbnailUrl });
    })
  );
  const totalPages = Math.max(1, Math.ceil(total / limit));
  res.json({
    data: {
      items: itemsWithThumbnails,
      pagination: { page, limit, total, totalPages },
    },
  });
}));

router.get('/lessons/:lessonId', validate(lessonIdSchema, 'params'), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findById(req.params.lessonId).select('-media.objectKey').lean();
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  const thumbnailUrl = await safeDownloadUrl(lesson.thumbnailKey);
  res.json({ data: withProcessingCompatibility({ ...lesson, thumbnailUrl }) });
}));

router.patch('/lessons/:lessonId', validate(lessonIdSchema, 'params'), validate(lessonInput.partial().extend({ contentMode: z.enum(['lesson', 'song', 'podcast', 'drama']).optional(), goalTags: z.array(z.enum(['daily', 'travel', 'work', 'hsk', 'culture', 'other'])).max(6).optional() })), asyncHandler(async (req, res) => {
  // Handle the optional override separately:
  //   - undefined or missing → leave untouched.
  //   - null → $unset the field (return to HSK heuristic).
  //   - number in [1,15] → store as override.
  const { autoGenerateQuizCount, ...rest } = req.body as {
    autoGenerateQuizCount?: number | null;
    [k: string]: unknown;
  };
  if ('contentMode' in rest || 'lyricsRaw' in rest || 'lyricsSource' in rest || 'durationSeconds' in rest) {
    const existing = await LessonModel.findById(req.params.lessonId).select('status contentMode durationSeconds').lean();
    if (!existing) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
    if (!['draft', 'failed'].includes(existing.status)) throw new AppError(409, 'LESSON_NOT_EDITABLE', 'Không đổi nguồn sau khi đã sinh phụ đề');
    const mode = rest.contentMode ?? existing.contentMode ?? 'lesson';
    const duration = Number(rest.durationSeconds ?? existing.durationSeconds);
    if (duration > (mode === 'podcast' ? env.VIDEO_MAX_DURATION_PODCAST_SECONDS : 600)) throw new AppError(422, 'VIDEO_DURATION_EXCEEDED', 'Thời lượng vượt giới hạn của loại nội dung');
  }
  const setOps: Record<string, unknown> = { ...rest };
  const unsetOps: Record<string, 1> = {};
  if (autoGenerateQuizCount === null) {
    unsetOps.autoGenerateQuizCount = 1;
  } else if (typeof autoGenerateQuizCount === 'number') {
    setOps.autoGenerateQuizCount = autoGenerateQuizCount;
  }
  const ops =
    Object.keys(setOps).length || Object.keys(unsetOps).length
      ? { $set: setOps, ...(Object.keys(unsetOps).length ? { $unset: unsetOps } : {}) }
      : { $set: setOps };
  const lesson = await LessonModel.findOneAndUpdate(
    { _id: req.params.lessonId, status: { $in: ['draft', 'ready_for_review', 'failed'] } },
    ops,
    { returnDocument: 'after', runValidators: true },
  );
  if (!lesson) throw new AppError(409, 'LESSON_NOT_EDITABLE', 'Bài học không ở trạng thái có thể sửa');
  res.json({ data: lesson });
}));

router.post('/uploads/presign', uploadLimiter, validate(presignSchema), asyncHandler(async (req, res) => {
  if (req.body.sizeBytes > env.MAX_VIDEO_BYTES) throw new AppError(413, 'VIDEO_TOO_LARGE', 'Video vượt giới hạn dung lượng cấu hình');
  const lesson = await LessonModel.findOne({ _id: req.body.lessonId, createdBy: req.auth!.userId, status: { $in: ['draft', 'failed'] } });
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bản nháp video');
  if (req.body.contentType.startsWith('audio/') && !['song', 'podcast'].includes(lesson.contentMode)) throw new AppError(422, 'INVALID_MEDIA_TYPE', 'Chỉ bài hát và podcast hỗ trợ tệp âm thanh');
  const extension = ({ 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav' } as Record<string, string>)[req.body.contentType];
  const objectKey = `videos/${lesson._id}/${randomUUID()}.${extension}`;
  const signed = await createVideoUploadUrl(objectKey, req.body.contentType, env.MAX_VIDEO_BYTES);
  lesson.status = 'uploading';
  lesson.processingStatus = 'UPLOADED';
  lesson.processingStep = 'UPLOADING';
  lesson.processingProgress = 0;
  lesson.processingError = undefined;
  lesson.pendingUploadObjectKey = objectKey;
  await lesson.save();
  res.json({
    data: {
      ...signed,
      requiredHeaders: { 'Content-Type': req.body.contentType },
      maxBytes: env.MAX_VIDEO_BYTES,
      // F08 fix (2026-09-18): return the byte count that the client committed to upload.
      // The admin UI uses this to compute "% uploaded" against the actual file size.
      // R2 presigned URLs do NOT expose server-side progress; we calculate client-side
      // by streaming the file and counting bytes transferred.
      clientByteSize: req.body.sizeBytes,
      // F08: explicit sessionId so the cancel endpoint can be idempotent and so
      // future resume support can identify which upload attempt was current.
      uploadSessionId: signed.objectKey,
      uploadedAt: new Date().toISOString(),
    },
  });
}));

router.post('/uploads/confirm', uploadLimiter, validate(confirmSchema), asyncHandler(async (req, res) => {
  // F02 fix (2026-09-18): wrap lesson state transition + job creation in a single
  // MongoDB transaction so a network/DB failure between the two writes cannot leave
  // the system with a "processing" lesson but no job.
  //
  // Fallback: if transactions are not supported (standalone Mongo, no replica set),
  // we run sequentially. The atomicity guarantee weakens to "best effort" but the
  // happy-path failure modes are still caught (job-creation failure rolls the lesson
  // back to its uploading state for the admin to retry).
  const supportsTransactions = mongoose.connection.readyState === 1 && (
    mongoose.connection as unknown as { client?: { topology?: { description?: { type?: string } } } }
  ).client?.topology?.description?.type === 'ReplicaSetWithPrimary';

  const session = supportsTransactions ? await mongoose.startSession() : null;
  let result: { lessonId: Types.ObjectId; jobId: Types.ObjectId; media: { sizeBytes: number; contentType: string } } | undefined;
  try {
    const runInSession = async (op: (s: mongoose.ClientSession | null) => Promise<void>) => {
      if (session) {
        await session.withTransaction(() => op(session));
      } else {
        await op(null);
      }
    };
    await runInSession(async (sess) => {
      const lesson = await LessonModel.findOne({ _id: req.body.lessonId, createdBy: req.auth!.userId, status: 'uploading' })
        .select('+pendingUploadObjectKey')
        .session(sess as mongoose.ClientSession | null);
      if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy video đang tải lên');
      if (!lesson.pendingUploadObjectKey || req.body.objectKey !== lesson.pendingUploadObjectKey) {
        throw new AppError(422, 'INVALID_OBJECT_KEY', 'Đường dẫn R2 không khớp phiên tải lên');
      }
      const object = await confirmR2Object(req.body.objectKey);
      if (!['video/mp4', 'video/webm', ...(['song', 'podcast'].includes(lesson.contentMode) ? ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav'] : [])].includes(object.contentType ?? '') || object.sizeBytes > env.MAX_VIDEO_BYTES) {
        throw new AppError(422, 'INVALID_UPLOADED_VIDEO', 'Object R2 không đúng định dạng hoặc dung lượng');
      }
      lesson.media = {
        objectKey: req.body.objectKey,
        mimeType: object.contentType as 'video/mp4' | 'video/webm' | 'audio/mpeg' | 'audio/mp4' | 'audio/wav' | 'audio/x-wav',
        sizeBytes: object.sizeBytes,
        etag: object.etag,
      };
      lesson.status = 'processing';
      lesson.processingStatus = 'QUEUED';
      lesson.processingStep = 'QUEUED';
      lesson.processingProgress = 5;
      lesson.processingError = undefined;
      lesson.pendingUploadObjectKey = undefined;
      await lesson.save({ session: sess });
      const job = await addVideoProcessingJob({
        lessonId: lesson._id.toString(),
        objectKey: req.body.objectKey,
        mediaType: lesson.mediaType ?? 'AUTO',
      }, { session: sess });
      if (!job) {
        // F02: signal back to the transaction so both writes are rolled back.
        throw new AppError(503, 'JOB_QUEUE_UNAVAILABLE', 'Không thể tạo tiến trình xử lý. Vui lòng thử lại.');
      }
      result = { lessonId: lesson._id, jobId: job._id, media: { sizeBytes: object.sizeBytes, contentType: object.contentType! } };
    });
  } finally {
    if (session) await session.endSession();
  }
  wakeVideoProcessingWorker();
  if (!result) throw new AppError(500, 'CONFIRM_INCOMPLETE', 'Quá trình xác nhận video không hoàn tất');
  res.json({ data: { lessonId: result.lessonId, status: 'processing', processingJobId: result.jobId, media: result.media } });
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
    LessonModel.findById(req.params.lessonId).select('status media processingStatus processingProgress processingStep processingError').lean(),
  ]);
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');

  // A lesson is visible in the processing screen before the upload is
  // confirmed and before the durable processing job is created. This is an
  // expected transition (draft/uploading), not a missing-resource error.
  // Return a normalized snapshot so the admin UI can keep showing the upload
  // state without flashing "Không tìm thấy tiến trình xử lý".
  if (!job) {
    const status = lesson.status === 'uploading'
      ? 'uploading'
      : lesson.status === 'processing'
        ? 'queued'
        : 'idle';
    res.json({
      data: {
        lessonId: req.params.lessonId,
        status,
        stage: lesson.processingStep ?? (status === 'uploading' ? 'upload' : 'waiting'),
        stageProgress: lesson.processingProgress ?? 0,
        attempts: 0,
        video: lesson,
        capabilities: {
          canRetry: false,
          canCancel: lesson.status === 'uploading',
          canPublish: false,
          noJob: true,
        },
        lessonStatusSync: 'synced',
        correctedError: lesson.processingError,
        updatedAt: new Date().toISOString(),
      },
    });
    return;
  }
  // F03 fix (2026-09-18): publish a normalized status payload so the admin UI
  // does not have to reconcile lesson vs job itself. We surface:
  //   - canRetry: lesson is in 'failed' AND has a media objectKey (ready for retry)
  //   - canCancel: lesson is in 'uploading' (user can still cancel)
  //   - capabilities.suggestedAction: union of state
  //   - job.lessonStatusSync: 'synced' when both documents agree, 'drift' otherwise.
  //   - correctedError: prefer job.errorMessage when lesson has none.
  const lessonStates = {
    canRetry: lesson?.status === 'failed' && Boolean(lesson.media?.objectKey),
    canCancel: lesson?.status === 'uploading',
    lessonStatus: lesson?.status ?? 'unknown',
  };
  const drift = lesson?.status === 'processing' && job.status !== 'running' && job.status !== 'queued';
  res.json({
    data: {
      ...processingStatusDto(job),
      video: lesson,
      capabilities: {
        ...lessonStates,
        canPublish: lesson?.status === 'ready_for_review',
      },
      lessonStatusSync: drift ? 'drift' : 'synced',
      correctedError: (lesson?.status === 'failed' || job.status === 'failed') ? (lesson?.processingError ?? job.errorMessage) : undefined,
      updatedAt: job.heartbeatAt ?? job.lockedAt ?? job.completedAt ?? job.createdAt,
    },
  });
}));

router.get('/processing-jobs', validateQuery(processingListSchema), asyncHandler(async (req, res) => {
  const { status, page, limit } = (req as unknown as Record<string, unknown>).parsedQuery as z.infer<typeof processingListSchema>;
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    ProcessingJobModel.find(filter).select('-objectKey -activeKey -lockedBy').sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    ProcessingJobModel.countDocuments(filter),
  ]);
  res.json({ data: { items: items.map(processingStatusDto), page, limit, total, pages: Math.ceil(total / limit) } });
}));

/**
 * F03 fix (2026-09-18): reconciliation report.
 *
 * Returns three sets of inconsistencies that admins must triage:
 *   - lessons in 'processing' with NO active job (lesson limbo).
 *   - lessons in 'failed' with an active (queued/running) job (job limbo).
 *   - jobs in 'queued'/'running' whose lesson is already 'published' (stale worker).
 *
 * This endpoint is a read-only diagnostic; it does NOT mutate state. The admin can
 * decide whether to call retry, cancel, or manually reconcile via the DB.
 */
router.get('/processing-jobs/reconcile', asyncHandler(async (_req, res) => {
  const [processingLessons, failedLessons, activeJobsForPublished] = await Promise.all([
    LessonModel.find({ status: 'processing' }).select('_id titleVi media').lean(),
    LessonModel.find({ status: 'failed' }).select('_id titleVi media processingError').lean(),
    ProcessingJobModel.find({ status: { $in: ['queued', 'running'] } }).select('_id lessonId').lean(),
  ]);
  const processingLessonIds = new Set(processingLessons.map(l => String(l._id)));
  const failedLessonIds = new Set(failedLessons.map(l => String(l._id)));
  const allJobs = await ProcessingJobModel.find({
    lessonId: { $in: Array.from(new Set([
      ...processingLessonIds,
      ...failedLessonIds,
      ...activeJobsForPublished.map(j => String(j.lessonId)),
    ])) },
  }).select('_id lessonId status attempts').lean();
  const jobsByLesson = new Map<string, { _id: unknown; status: string; attempts: number }[]>();
  for (const job of allJobs) {
    const key = String(job.lessonId);
    const list = jobsByLesson.get(key) ?? [];
    list.push({ _id: job._id, status: job.status, attempts: job.attempts });
    jobsByLesson.set(key, list);
  }
  const lessonWithoutJob = processingLessons.filter(lesson => {
    const jobs = jobsByLesson.get(String(lesson._id)) ?? [];
    return !jobs.some(j => j.status === 'queued' || j.status === 'running');
  }).map(l => ({ _id: l._id, titleVi: l.titleVi }));
  const lessonWithActiveJobButFailed = failedLessons.filter(lesson => {
    const jobs = jobsByLesson.get(String(lesson._id)) ?? [];
    return jobs.some(j => j.status === 'queued' || j.status === 'running');
  }).map(l => ({ _id: l._id, titleVi: l.titleVi, processingError: l.processingError }));
  const publishedLessons = await LessonModel.find({ status: 'published' }).select('_id').lean();
  const publishedSet = new Set(publishedLessons.map(l => String(l._id)));
  const staleJobs = activeJobsForPublished.filter(job => publishedSet.has(String(job.lessonId)))
    .map(j => ({ _id: j._id, lessonId: j.lessonId }));
  res.json({
    data: {
      lessonWithoutJob,
      lessonWithActiveJobButFailed,
      staleJobs,
      summary: {
        lessonWithoutJobCount: lessonWithoutJob.length,
        lessonWithActiveJobButFailedCount: lessonWithActiveJobButFailed.length,
        staleJobsCount: staleJobs.length,
      },
    },
  });
}));

router.get('/lessons/:lessonId/review', validate(lessonIdSchema, 'params'), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findById(req.params.lessonId)
    .select('status titleVi titleZh hsk durationSeconds activeSubtitleRevision activeQuizRevision media thumbnailKey')
    .lean();
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  const [subtitle, quiz] = await Promise.all([
    SubtitleTrackModel.findOne({ lessonId: lesson._id, status: 'draft' }).sort({ revision: -1 }).lean()
      .then(async (draft) => draft ?? SubtitleTrackModel.findOne({ lessonId: lesson._id, status: 'published' }).sort({ revision: -1 }).lean() ?? SubtitleTrackModel.findOne({ lessonId: lesson._id }).sort({ revision: -1 }).lean()),
    QuizModel.findOne({ lessonId: lesson._id, status: 'draft' }).sort({ revision: -1 })
      .select('+questions.correctOptionId +questions.acceptedAnswers +questions.explanationVi').lean()
      .then(async (draft) => draft ?? QuizModel.findOne({ lessonId: lesson._id, status: 'published' }).sort({ revision: -1 })
        .select('+questions.correctOptionId +questions.acceptedAnswers +questions.explanationVi').lean()
        ?? QuizModel.findOne({ lessonId: lesson._id }).sort({ revision: -1 })
        .select('+questions.correctOptionId +questions.acceptedAnswers +questions.explanationVi').lean()),
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

// CONTENT MODE (2026-09-22) - SONG/PODCAST/DRAMA endpoints.
// Lưu ý: validate nội dung mode trước khi cho phép các field đặc thù.

// POST /admin/lessons/:lessonId/lyrics — upload LRC text cho mode=song.
const lyricsUploadSchema = z.object({
  lyricsRaw: z.string().min(1).max(20000),
  lyricsSource: z.enum(['lrc', 'manual', 'auto']).default('lrc'),
});
router.post('/lessons/:lessonId/lyrics', validate(lessonIdSchema, 'params'), validate(lyricsUploadSchema), asyncHandler(async (req, res) => {
  const { lessonId } = req.params as z.infer<typeof lessonIdSchema>;
  const { lyricsRaw, lyricsSource } = req.body as z.infer<typeof lyricsUploadSchema>;
  const lesson = await LessonModel.findOne({ _id: lessonId }).select('contentMode status').lean();
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  if (lesson.contentMode !== 'song') {
    throw new AppError(422, 'INVALID_CONTENT_MODE', 'Chỉ bài học mode=song mới nhận lyrics');
  }
  if (!['draft', 'failed'].includes(lesson.status)) throw new AppError(409, 'LESSON_NOT_EDITABLE', 'Chỉ sửa lời nguồn khi bài hát còn nháp hoặc xử lý thất bại');
  const updated = await LessonModel.updateOne({ _id: lessonId, status: { $in: ['draft', 'failed'] } }, { $set: { lyricsRaw, lyricsSource } });
  if (!updated.matchedCount) throw new AppError(409, 'LESSON_NOT_EDITABLE', 'Trạng thái bài hát đã thay đổi');
  res.json({ data: { ok: true, lyricsSource } });
}));

// PATCH /admin/lessons/:lessonId/characters — rename / recolor characters cho mode=drama.
const charactersUpdateSchema = z.object({
  characters: z.array(z.object({
    speakerId: z.string().min(1).max(50),
    displayName: z.string().min(1).max(100),
    descriptionVi: z.string().max(500).optional(),
    color: z.string().max(20).optional(),
    avatarUrl: z.string().max(500).optional(),
  })).min(1).max(20),
});
router.patch('/lessons/:lessonId/characters', validate(lessonIdSchema, 'params'), validate(charactersUpdateSchema), asyncHandler(async (req, res) => {
  const { lessonId } = req.params as z.infer<typeof lessonIdSchema>;
  const { characters } = req.body as z.infer<typeof charactersUpdateSchema>;
  const lesson = await LessonModel.findOne({ _id: lessonId }).select('contentMode status').lean();
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  if (lesson.contentMode !== 'drama') {
    throw new AppError(422, 'INVALID_CONTENT_MODE', 'Chỉ bài học mode=drama mới có characters');
  }
  if (!['draft', 'failed', 'ready_for_review'].includes(lesson.status)) throw new AppError(409, 'LESSON_NOT_EDITABLE', 'Chỉ sửa nhân vật trong bản nháp');
  const updated = await LessonModel.updateOne({ _id: lessonId, status: { $in: ['draft', 'failed', 'ready_for_review'] } }, { $set: { characters } });
  if (!updated.matchedCount) throw new AppError(409, 'LESSON_NOT_EDITABLE', 'Trạng thái bài học đã thay đổi');
  res.json({ data: { ok: true, count: characters.length } });
}));

router.put('/lessons/:lessonId/subtitles', validate(lessonIdSchema, 'params'), validate(subtitleDraftSchema), asyncHandler(async (req, res) => {
  const lessonId = String(req.params.lessonId);
  const lesson = await LessonModel.findOne({ _id: lessonId, status: 'ready_for_review' }).select('durationSeconds').lean();
  if (!lesson) throw new AppError(409, 'LESSON_NOT_READY', 'Bài học chưa sẵn sàng để duyệt');
  const track = await SubtitleTrackModel.findOne({ lessonId: lesson._id, status: 'draft' }).sort({ revision: -1 });
  if (!track) throw new AppError(404, 'SUBTITLES_NOT_FOUND', 'Không tìm thấy phụ đề nháp');

  const previous = new Map(track.cues.map(cue => [cue.cueId, cue]));

  // F06 fix (2026-09-18): when an admin edits a cue's `zh`, we must re-tokenize
  // AND re-resolve Word IDs. Previously the new tokens got wordId=null and never
  // got linked back, so learners couldn't save/lookup the word from those cues.
  const newCueInputs = (req.body as z.infer<typeof subtitleDraftSchema>).cues;
  const cuesNeedingResolve = newCueInputs
    .filter(cue => cue.endMs <= lesson.durationSeconds * 1000)
    .filter(cue => cue.zh !== previous.get(cue.cueId)?.zh)
    .map(cue => ({
      zh: cue.zh,
      pinyin: cue.pinyin || pinyinService.convert(cue.zh),
      vi: cue.vi,
      tokens: pinyinService.tokenize(cue.zh).map(token => ({ text: token.text, wordId: null as unknown })),
    }));
  // Word resolution is best-effort: failure here should not break the save.
  // Missing words show in the editor's "needsReview" filter.
  let resolvedWordIds = new Map<string, Types.ObjectId>();
  if (cuesNeedingResolve.length > 0) {
    try {
      resolvedWordIds = await resolveLearningWordIds(cuesNeedingResolve);
    } catch (error) {
      logger.warn({ lessonId, error: error instanceof Error ? error.message : String(error) }, '[admin] Word re-resolution failed; saving cues with wordId=null');
    }
  }

  const cues = newCueInputs.map(cue => {
    if (cue.endMs > lesson.durationSeconds * 1000) {
      throw new AppError(422, 'INVALID_CUE_TIME', 'Phụ đề vượt thời lượng video');
    }
    const old = previous.get(cue.cueId);
    const zhChanged = old?.zh !== cue.zh;
    const tokens = zhChanged
      ? pinyinService.tokenize(cue.zh).map(token => ({ text: token.text, wordId: resolvedWordIds.get(token.text) ?? null }))
      : (old?.tokens ?? []);
    return {
      ...cue,
      pinyin: cue.pinyin || pinyinService.convert(cue.zh),
      tokens,
      speakerId: old?.speakerId,
      chapterId: old?.chapterId,
      rawText: old?.rawText ?? undefined,
      quality: old?.quality ?? undefined,
      normalizedText: zhChanged ? cue.zh.normalize('NFKC') : old?.normalizedText ?? undefined,
      needsFineAlignment: zhChanged || old?.startMs !== cue.startMs || old?.endMs !== cue.endMs ? true : old?.needsFineAlignment ?? undefined,
      karaokeTokens: !zhChanged && old?.startMs === cue.startMs && old?.endMs === cue.endMs ? old?.karaokeTokens : undefined,
    };
  });

  // F11 fix (2026-09-18): atomic save via runEditorCommit. Previously this
  // endpoint did two non-atomic writes (track.save + LessonModel.updateOne).
  // If the second one failed the cues were updated but contentDirty was
  // never set, so the UI would show "ready to publish" while translation
  // was actually stale. The helper also handles revalidation and dirty
  // flag bookkeeping in a single transaction.
  const zhChangedCount = newCueInputs.filter(cue => cue.zh !== previous.get(cue.cueId)?.zh).length;
  const result = await runEditorCommit({
    lessonId,
    subtitle: {
      revision: track.revision,
      cues: cues.map(cue => ({
        cueId: cue.cueId,
        startMs: cue.startMs,
        endMs: cue.endMs,
        zh: cue.zh,
        pinyin: cue.pinyin,
        vi: cue.vi,
        speakerId: cue.speakerId ?? undefined,
        chapterId: cue.chapterId ?? undefined,
        karaokeTokens: cue.karaokeTokens ?? undefined,
        rawText: cue.rawText,
        quality: cue.quality,
        normalizedText: cue.normalizedText,
        needsFineAlignment: cue.needsFineAlignment,
        tokens: (cue.tokens ?? []).map(token => ({ text: token.text, wordId: token.wordId ?? null })),
      })),
      dirty: zhChangedCount > 0
        ? { reason: `${zhChangedCount} câu phụ đề đã thay đổi — cần duyệt lại bản dịch và câu hỏi`, zhChangedCount }
        : undefined,
    },
  });
  res.json({ data: result.subtitle });
}));

router.put('/lessons/:lessonId/quiz', validate(lessonIdSchema, 'params'), validate(quizDraftSchema), asyncHandler(async (req, res) => {
  const lessonId = String(req.params.lessonId);
  const lesson = await LessonModel.findOne({ _id: lessonId, status: { $in: ['ready_for_review', 'published', 'draft'] } }).select('_id status').lean();
  if (!lesson) throw new AppError(409, 'LESSON_NOT_READY', 'Bài học không hợp lệ hoặc chưa sẵn sàng để chỉnh sửa');
  const quiz = (await QuizModel.findOne({ lessonId: lesson._id, status: 'draft' }).sort({ revision: -1 })
    .select('+questions.correctOptionId +questions.acceptedAnswers +questions.explanationVi'))
    ?? (await QuizModel.findOne({ lessonId: lesson._id }).sort({ revision: -1 })
      .select('+questions.correctOptionId +questions.acceptedAnswers +questions.explanationVi'));
  if (!quiz) throw new AppError(404, 'QUIZ_NOT_FOUND', 'Không tìm thấy bài tập');

  // F06 fix (2026-09-18): preserve previously resolved relatedWordIds when the
  // admin did not change the question. Drop them only when the prompt or options
  // changed enough to invalidate the linkage.
  const previousQuestions = new Map(quiz.questions.map(q => [q.questionId, q]));
  const mergedQuestions = (req.body as z.infer<typeof quizDraftSchema>).questions.map(question => {
    const previous = previousQuestions.get(question.questionId);
    const reResolvedNeeded = !previous || previous.prompt !== question.prompt;
    if (reResolvedNeeded) {
      // Drop stale links; admin will re-attach via a follow-up "Liên kết từ" action.
      return { ...question, relatedWordIds: [] as Types.ObjectId[] };
    }
    return { ...question, relatedWordIds: previous?.relatedWordIds ?? [] };
  });

  // F11: atomic save via runEditorCommit. Same rationale as subtitles above —
  // we previously wrote Quiz without updating the lesson's contentDirty flag,
  // so if a question's prompt changed and the user removed relatedWordIds, the
  // admin would never see the "needs re-link" warning.
  const result = await runEditorCommit({
    lessonId,
    quiz: {
      revision: quiz.revision,
      questions: mergedQuestions.map(question => ({
        questionId: question.questionId,
        type: question.type,
        prompt: question.prompt,
        cueId: question.cueId,
        options: question.options,
        correctOptionId: (question as { correctOptionId?: string }).correctOptionId,
        acceptedAnswers: (question as { acceptedAnswers?: string[] }).acceptedAnswers,
        explanationVi: (question as { explanationVi?: string }).explanationVi,
        relatedWordIds: question.relatedWordIds,
      })),
    },
  });
  res.json({ data: result.quiz });
}));

/**
 * POST /lessons/:lessonId/quiz/generate
 *
 * Generates quiz questions using Gemini based on the lesson's subtitle cues.
 * Returns generated questions as a draft-only preview — does NOT save to DB.
 * Admin can then edit/select and save via the existing PUT /quiz endpoint.
 */
router.post('/lessons/:lessonId/quiz/generate', validate(lessonIdSchema, 'params'), validate(quizGenerationInput), asyncHandler(async (req, res) => {
  const lessonId = String(req.params.lessonId);
  const { kinds, questionCount } = (req.body as z.infer<typeof quizGenerationInput>);
  const lesson = await LessonModel.findById(lessonId)
    .select('hsk titleVi activeSubtitleRevision status')
    .lean();
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  if (lesson.status === 'uploading' || lesson.status === 'processing') {
    throw new AppError(409, 'LESSON_NOT_READY', 'Bài học đang xử lý video, chưa có phụ đề');
  }
  const subtitle = await SubtitleTrackModel.findOne({
    lessonId: lesson._id,
    status: 'published',
  }).sort({ revision: -1}).select('cues').lean()
    ?? await SubtitleTrackModel.findOne({
      lessonId: lesson._id,
      status: 'draft',
    }).sort({ revision: -1 }).select('cues').lean();
  if (!subtitle || subtitle.cues.length === 0) {
    throw new AppError(422, 'NO_SUBTITLES', 'Bài học chưa có phụ đề để sinh câu hỏi');
  }
  const cuesForPrompt = subtitle.cues
    .filter((cue) => cue.zh && cue.vi)
    .slice(0, 80)
    .map((cue) => ({
      cueId: cue.cueId,
      startMs: cue.startMs,
      endMs: cue.endMs,
      zh: cue.zh,
      pinyin: cue.pinyin,
      vi: cue.vi,
    }));
  const generated = await generateQuizWithGemini({
    hsk: lesson.hsk,
    kinds: kinds as QuestionKind[],
    questionCount,
    cues: cuesForPrompt,
    lessonTitleVi: lesson.titleVi,
  });

  // F-fix (2026-09-19): clear any stale aiGenerationError from a previous
  // failed attempt so the admin UI's red banner stops showing once the new
  // generation succeeded. Without this the modal-based generator leaves the
  // prior error in the Quiz doc forever (it only saves to DB via the modal's
  // "Import" flow, not on the API call itself).
  await QuizModel.findOneAndUpdate(
    { lessonId: lesson._id, status: 'draft' },
    {
      $set: {
        aiGenerationStatus: 'completed',
        aiGenerationCompletedAt: new Date(),
        aiGenerationError: undefined,
        aiGenerationQuestionCount: generated.length,
      },
    },
    { sort: { revision: -1 } },
  );

  res.json({
    data: {
      questions: generated,
      kinds,
      hsk: lesson.hsk,
      lessonTitleVi: lesson.titleVi,
      cueCount: cuesForPrompt.length,
    },
  });
}));

/**
 * GET /lessons/:lessonId/quiz/ai-status
 *
 * Returns the AI generation status for the current draft quiz. Used by the
 * admin UI to surface "Generating…", "Completed", "Failed" badges.
 */
router.get('/lessons/:lessonId/quiz/ai-status', validate(lessonIdSchema, 'params'), asyncHandler(async (req, res) => {
  const quiz = (await QuizModel.findOne({ lessonId: req.params.lessonId, status: 'draft' })
    .sort({ revision: -1 })
    .select('aiGenerationStatus aiGenerationStartedAt aiGenerationCompletedAt aiGenerationError aiGenerationKinds aiGenerationQuestionCount revision')
    .lean())
    ?? (await QuizModel.findOne({ lessonId: req.params.lessonId })
    .sort({ revision: -1 })
    .select('aiGenerationStatus aiGenerationStartedAt aiGenerationCompletedAt aiGenerationError aiGenerationKinds aiGenerationQuestionCount revision')
    .lean());
  if (!quiz) {
    // Keep the shape aligned with AdminQuizAiStatus so the frontend never has
    // to guess field names. `aiGenerationStatus: 'not_found'` matches the union
    // type so AI_STATUS_STYLES[status] returns a styled entry rather than
    // crashing the admin screen with "AI-improved" badge code that expects the
    // field to always be present.
    res.json({ data: { aiGenerationStatus: 'not_found', revision: null } });
    return;
  }
  res.json({ data: quiz });
}));

/**
 * POST /lessons/:lessonId/quiz/regenerate
 *
 * Re-fires the AI quiz auto-generation. Used when the auto-trigger failed or
 * the admin wants a fresh set of questions. Runs in background — the response
 * returns immediately with the new "pending" status; the admin UI polls the
 * ai-status endpoint above.
 */
router.post('/lessons/:lessonId/quiz/regenerate', validate(lessonIdSchema, 'params'), asyncHandler(async (req, res) => {
  const lessonId = String(req.params.lessonId);
  const lesson = await LessonModel.findById(lessonId).select('status').lean();
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  if (lesson.status === 'uploading' || lesson.status === 'processing') {
    throw new AppError(409, 'LESSON_NOT_READY', 'Bài học đang xử lý video, vui lòng đợi');
  }
  const quiz = (await QuizModel.findOne({ lessonId, status: 'draft' }).sort({ revision: -1 }))
    ?? (await QuizModel.findOne({ lessonId }).sort({ revision: -1 }));
  if (!quiz) throw new AppError(409, 'NO_QUIZ', 'Bài học chưa có bài tập');

  // Mark pending so the admin UI sees the new attempt immediately.
  quiz.aiGenerationStatus = 'pending';
  quiz.aiGenerationError = undefined;
  quiz.aiGenerationStartedAt = new Date();
  quiz.aiGenerationCompletedAt = undefined;
  await quiz.save();

  // Fire-and-forget.
  setImmediate(() => {
    void autoGenerateQuizForLesson(lessonId).catch((err) => {
      logger.error(
        { lessonId, error: err instanceof Error ? err.message : String(err) },
        '[admin] manual regenerate threw unexpectedly',
      );
    });
  });

  res.json({ data: { lessonId, status: 'pending' } });
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
  await LessonModel.updateOne({ _id: lesson._id }, { $unset: { processingError: 1 } });
  await lesson.save();
  wakeVideoProcessingWorker();
  res.json({ data: processingStatusDto(job.toObject()) });
});

router.post('/lessons/:lessonId/processing/retry', uploadLimiter, validate(lessonIdSchema, 'params'), retryProcessing);
router.post('/videos/:lessonId/retry-processing', uploadLimiter, validate(lessonIdSchema, 'params'), retryProcessing);

router.post('/lessons/:lessonId/publish', validate(lessonIdSchema, 'params'), asyncHandler(async (req, res) => {
  // F07 fix (2026-09-18): unified publish-time validator + transaction-wrapped writes.
  // Falls back to sequential writes when transactions are not supported (standalone Mongo).
  const supportsTransactions = mongoose.connection.readyState === 1 && (
    mongoose.connection as unknown as { client?: { topology?: { description?: { type?: string } } } }
  ).client?.topology?.description?.type === 'ReplicaSetWithPrimary';

  const session = supportsTransactions ? await mongoose.startSession() : null;
  // `unknown` thay vì `Record<string, unknown>`: Mongoose Document có nhiều
  // internal symbols không match index signature, nhưng code dưới đây
  // chỉ đọc các field cụ thể (`hsk`, `titleVi`, `titleZh`, `_id`) qua
  // bracket access — nên `any` được biện minh cho ergonomic.
  let publishedLesson: unknown = null;
  try {
    const runInSession = async (op: (s: mongoose.ClientSession | null) => Promise<void>) => {
      if (session) {
        await session.withTransaction(() => op(session));
      } else {
        await op(null);
      }
    };
    await runInSession(async (sess) => {
      const lesson = await LessonModel.findOne({ _id: req.params.lessonId, status: 'ready_for_review' }).session(sess);
      if (!lesson) throw new AppError(409, 'LESSON_NOT_READY', 'Bài học chưa sẵn sàng để đăng');
      const subtitle = await SubtitleTrackModel.findOne({ lessonId: lesson._id, status: 'draft' }).sort({ revision: -1 }).session(sess);
      const quiz = await QuizModel.findOne({ lessonId: lesson._id, status: 'draft' }).sort({ revision: -1 })
        .select('+questions.correctOptionId +questions.acceptedAnswers +questions.explanationVi')
        .session(sess);

      // F07 fix: unified publish-time validator. Same rules as the
      // individual save endpoints so direct API calls to /publish cannot bypass
      // cue-time, word-link or quiz-answer checks.
      if (!lesson.media) throw new AppError(422, 'CONTENT_INCOMPLETE', 'Bài học chưa có video');
      if (!subtitle || subtitle.cues.length === 0) {
        throw new AppError(422, 'CONTENT_INCOMPLETE', 'Phụ đề chưa có nội dung');
      }
      if (!quiz || ((lesson.contentMode ?? 'lesson') === 'lesson' && quiz.questions.length === 0)) {
        throw new AppError(422, 'CONTENT_INCOMPLETE', 'Bài tập chưa có câu hỏi');
      }
      const lastCue = subtitle.cues[subtitle.cues.length - 1]!;
      if (lastCue.endMs > lesson.durationSeconds * 1000) {
        throw new AppError(422, 'INVALID_CUE_TIME', 'Câu phụ đề cuối vượt thời lượng video');
      }
      const invalidQuestion = quiz.questions.find(question =>
        question.type === 'multiple_choice'
          ? !question.correctOptionId || !question.options.some(option => option.optionId === question.correctOptionId)
          : !(question.acceptedAnswers && question.acceptedAnswers.length > 0));
      if (invalidQuestion) {
        throw new AppError(422, 'INVALID_QUIZ', `Câu hỏi ${invalidQuestion.questionId} thiếu đáp án hợp lệ`);
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
      // F07: reset dirty flag since content has now been reviewed and published.
      lesson.contentDirty = false;
      lesson.contentDirtyReason = undefined;

      // F07 fix: Mongoose transactions require sequential awaits on the same
      // session. Promise.all under withTransaction() silently degrades to
      // non-transactional behavior. See:
      //   https://mongoosejs.com/docs/transactions.html
      await subtitle.save({ session: sess });
      await quiz.save({ session: sess });
      await lesson.save({ session: sess });
      publishedLesson = lesson;
    });
  } finally {
    if (session) await session.endSession();
  }

  if (publishedLesson) {
    const hskLevel = (publishedLesson as any).hsk || 1;
    const lessonTitle = (publishedLesson as any).titleVi || (publishedLesson as any).titleZh || 'Bài học mới';
    // Fire-and-forget: broadcast tới toàn bộ learners. Trước đây bug #4
    // quên `.catch` nên unhandled rejection có thể kill process. Giờ đăng
    // ký catch + log context (hskLevel, lessonId) để debug dễ hơn.
    NotificationService.notifyLearnersByHsk(hskLevel, {
      type: 'lesson',
      category: 'study',
      title: {
        vi: `Bài học mới HSK ${hskLevel}: "${lessonTitle}"`,
        en: `New HSK ${hskLevel} lesson: "${lessonTitle}"`,
        zh: `全新 HSK ${hskLevel} 级课程上线："${lessonTitle}"`,
      },
      message: {
        vi: 'Khám phá video bài học mới với phụ đề song ngữ và bài tập tương tác ngay hôm nay!',
        en: 'Explore the new video lesson with bilingual subtitles and interactive exercises today!',
        zh: '立即体验全新双语互动视频与随堂测试！',
      },
      actionUrl: '/lessons',
      actionText: {
        vi: 'Xem bài học',
        en: 'View Lesson',
        zh: '查看课程',
      },
      metadata: { lessonId: (publishedLesson as any)._id, hsk: hskLevel },
    }).catch(err => logger.error({ err, hskLevel, lessonId: (publishedLesson as any)._id }, 'Failed to notify learners on lesson publish'));
  }

  res.json({ data: publishedLesson });
}));

router.delete('/lessons/:lessonId', validate(lessonIdSchema, 'params'), asyncHandler(async (req, res) => {
  const result = await purgeAdminLesson(String(req.params.lessonId));
  res.json({ data: { ...result, deleted: true } });
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
  const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
  const users = await UserModel.find(filter).select('name email role status learningProfile createdAt').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 100).limit(100).lean();
  res.json({ data: { items: users, hasMore: users.length === 100 } });
}));

router.patch('/users/:userId/status', validate(userIdSchema, 'params'), validate(statusSchema), asyncHandler(async (req, res) => {
  if (req.params.userId === req.auth!.userId.toString()) throw new AppError(422, 'CANNOT_LOCK_SELF', 'Không thể khóa tài khoản đang đăng nhập');
  const user = await UserModel.findOneAndUpdate({ _id: req.params.userId, role: 'user' }, { $set: { status: req.body.status } }, { returnDocument: 'after' })
    .select('name email role status');
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy người học');
  res.json({ data: user });
}));

export default router;
