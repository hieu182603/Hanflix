import { lessonHskFilter, learnerHsk } from '../services/lesson-access.js';
import { Router } from 'express';
import { optionalAuth, requireLessonAccess, requireLessonHsk, requirePremium } from '../middleware/premium.js';
import { freeSampleIds } from '../services/premium.js';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { LessonModel } from '../models/lesson.model.js';
import { ProgressModel } from '../models/progress.model.js';
import { QuizAttemptModel } from '../models/quiz-attempt.model.js';
import { QuizModel } from '../models/quiz.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';
import { createVideoDownloadUrl } from '../services/r2.js';
import { resolvePlaybackKey } from '../services/playback-derivative.js';
import { getCachedSignedDownloadUrl } from '../services/signed-url-cache.js';
import { logger } from '../services/logger.js';
import { recordStudyActivity, type StudyActivityIncrement } from '../services/study-activity.js';
import { mergeWatchedRanges, watchedCoverage } from '../services/watched-ranges.js';
import { asyncHandler } from '../utils/async-handler.js';
import { withProcessingCompatibility } from '../services/lesson-presentation.js';
import { NotificationService } from '../services/notification.service.js';

const router = Router();
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });

const listSchema = z.object({
  q: z.string().trim().max(120).optional(),
  sample: z.enum(['true', 'false']).optional(),
  hsk: z.coerce.number().int().min(1).max(9).optional(),
  topic: z.string().trim().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

const idSchema = z.object({ lessonId: z.string().refine(Types.ObjectId.isValid, 'lessonId không hợp lệ') });

const progressSchema = z.object({
  positionSeconds: z.number().min(0),
  watchedRange: z.object({ start: z.number().min(0), end: z.number().positive() }).refine(value => value.end > value.start).optional(),
  activeStudyDeltaSeconds: z.number().int().min(0).max(120).default(0),
});

const attemptSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128),
  answers: z.array(z.object({
    questionId: z.string().min(1).max(100),
    selectedOptionId: z.string().max(100).optional(),
    textAnswer: z.string().max(500).optional(),
  })).min(1).max(50),
});
type AttemptInput = z.infer<typeof attemptSchema>;

function normalizeAnswer(value: string): string {
  return value.trim().toLocaleLowerCase('vi').replace(/[.,!?;:，。！？；：]/g, '').replace(/\s+/g, ' ');
}

async function recordActivitySafely(userId: Types.ObjectId, increment: StudyActivityIncrement) {
  try {
    await recordStudyActivity(userId, increment);
  } catch (error) {
    logger.warn({ userId, error: error instanceof Error ? error.message : String(error) }, '[StudyActivity] write failed');
  }
}

async function safeDownloadUrl(key?: string | null): Promise<string | null> {
  if (!key) return null;
  try {
    // F12 fix (2026-09-19): prefer the in-memory signed URL cache so we
    // don't pay a fresh S3 signing call for every list/detail hit. The
    // cache lives for `R2_DOWNLOAD_URL_TTL_SECONDS - 60s`, well within the
    // 1h URL validity window — see signed-url-cache.ts for eviction policy.
    return await getCachedSignedDownloadUrl(key);
  } catch {
    return null;
  }
}

router.get('/', optionalAuth, validateQuery(listSchema), asyncHandler(async (req, res) => {
  const { q, hsk, topic, page, limit, sample } = (req as unknown as Record<string, unknown>).parsedQuery as z.infer<typeof listSchema>;
  const hskFilter = lessonHskFilter(req.auth, hsk);
  const samples = await freeSampleIds(learnerHsk(req.auth));
  const filter: Record<string, unknown> = { status: 'published', ...hskFilter };
  if (sample === 'true') filter._id = { $in: samples };
  if (topic) filter.topicIds = topic;
  if (q) filter.$text = { $search: q };

  const [items, total] = await Promise.all([
    LessonModel.find(filter)
      .select('-media.objectKey -lyricsRaw -chapters')
      .sort(q ? { score: { $meta: 'textScore' } } : { publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    LessonModel.countDocuments(filter),
  ]);
  // PERFORMANCE (BUG-04): Parallel signed URL generation is already in Promise.all,
  // but each URL still hits R2/S3 individually. For high-traffic thumbnail lists,
  // consider caching the signed URLs (Redis with TTL ~= signed URL expiry)
  // or making the thumbnail bucket public (CDN) to skip signing entirely.
  const itemsWithThumbnails = await Promise.all(
    items.map(async item => {
      const thumbnailUrl = await safeDownloadUrl(item.thumbnailKey);
      return withProcessingCompatibility({ ...item, playbackKey: undefined, thumbnailUrl, isFreeSample: samples.includes(String(item._id)) });
    }),
  );
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ data: { items: itemsWithThumbnails, page, limit, total, pages: Math.ceil(total / limit), currentHsk: learnerHsk(req.auth) ?? null } });
}));

router.get('/:lessonId', validate(idSchema, 'params'), optionalAuth, requireLessonAccess, asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOne({ _id: req.params.lessonId, status: 'published' }).lean();
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  // F12 fix (2026-09-19): prefer the faststart derivative when one exists.
  // Older lessons without `playbackKey` continue to serve `media.objectKey`
  // until the migration tool backfills them.
  const playbackKey = resolvePlaybackKey(lesson);
  const [mediaUrl, thumbnailUrl] = await Promise.all([
    safeDownloadUrl(playbackKey),
    safeDownloadUrl(lesson.thumbnailKey),
  ]);
  res.json({ data: withProcessingCompatibility({ ...lesson, playbackKey: undefined, thumbnailUrl, media: lesson.media ? { ...lesson.media, objectKey: undefined, url: mediaUrl } : null }) });
}));

router.get('/:lessonId/subtitles', validate(idSchema, 'params'), optionalAuth, requireLessonAccess, asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOne({ _id: req.params.lessonId, status: 'published' }).select('activeSubtitleRevision subtitleStyle').lean();
  if (!lesson?.activeSubtitleRevision) throw new AppError(404, 'SUBTITLES_NOT_FOUND', 'Bài học chưa có phụ đề đã xuất bản');
  const track = await SubtitleTrackModel.findOne({
    lessonId: lesson._id,
    revision: lesson.activeSubtitleRevision,
    status: 'published',
  }).populate('cues.tokens.wordId', 'hanzi pinyin meaningVi partOfSpeech examples audioKey').lean();
  if (!track) throw new AppError(404, 'SUBTITLES_NOT_FOUND', 'Không tìm thấy phụ đề');
  // Surface the per-lesson appearance config so the learner player renders
  // the same font sizes the admin approved in the Subtitle Review workspace.
  res.json({ data: { ...track, style: lesson.subtitleStyle } });
}));

router.get('/:lessonId/quiz', validate(idSchema, 'params'), optionalAuth, requirePremium, requireLessonHsk, asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOne({ _id: req.params.lessonId, status: 'published' }).select('activeQuizRevision').lean();
  if (!lesson?.activeQuizRevision) throw new AppError(404, 'QUIZ_NOT_FOUND', 'Bài học chưa có bài luyện tập');
  // FEATURE (2026-09-23): Send isCorrect in options so learner sees correct answer immediately after selection.
  // SECURITY (H-6): Still strip acceptedAnswers and explanationVi — those are answer keys, not just feedback.
  const quiz = await QuizModel.findOne({ lessonId: lesson._id, revision: lesson.activeQuizRevision, status: 'published' })
    .select('+questions.correctOptionId -questions.acceptedAnswers -questions.explanationVi')
    .lean();
  if (!quiz) throw new AppError(404, 'QUIZ_NOT_FOUND', 'Không tìm thấy bài luyện tập');

  // Add isCorrect flag to each option for immediate feedback after user selection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quizWithIsCorrect = {
    ...quiz,
    questions: (quiz.questions as any[]).map((q) => {
      const { correctOptionId, ...restQ } = q;
      return {
        ...restQ,
        options: (q.options as any[]).map((opt) => ({
          ...opt,
          isCorrect: Boolean(correctOptionId && opt.optionId === correctOptionId),
        })),
      };
    }),
  };

  res.json({ data: quizWithIsCorrect });
}));

// CONTENT MODE (2026-09-22) - PODCAST: chapters endpoint.
// Trả về danh sách chapter cho podcast player. Trả về [] nếu lesson không phải podcast
// hoặc chưa có chapters (an toàn — caller check truthy trước khi render).
router.get('/:lessonId/chapters', validate(idSchema, 'params'), optionalAuth, requireLessonAccess, asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOne({ _id: req.params.lessonId, status: 'published' })
    .select('contentMode chapters')
    .lean();
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  const chapters = lesson.contentMode === 'podcast' && Array.isArray(lesson.chapters) ? lesson.chapters : [];
  res.json({ data: { chapters } });
}));

router.get('/:lessonId/progress', requireAuth, validate(idSchema, 'params'), requirePremium, requireLessonHsk, asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOne({ _id: req.params.lessonId, status: 'published' }).select('durationSeconds').lean();
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  const progress = await ProgressModel.findOne({ userId: req.auth!.userId, lessonId: lesson._id })
    .select('lastPositionSeconds watchedRanges activeStudySeconds completed completedAt bestQuizScore').lean();
  const watchedRanges = progress?.watchedRanges ?? [];
  res.json({ data: {
    lastPositionSeconds: progress?.lastPositionSeconds ?? 0,
    watchedRanges,
    coverage: watchedCoverage(watchedRanges, lesson.durationSeconds),
    activeStudySeconds: progress?.activeStudySeconds ?? 0,
    completed: progress?.completed ?? false,
    completedAt: progress?.completedAt ?? null,
    bestQuizScore: progress?.bestQuizScore ?? null,
  } });
}));

router.patch('/:lessonId/progress', requireAuth, validate(idSchema, 'params'), requireLessonAccess, validate(progressSchema), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOne({ _id: req.params.lessonId, status: 'published' }).select('durationSeconds').lean();
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  if (req.body.positionSeconds > lesson.durationSeconds) throw new AppError(422, 'INVALID_POSITION', 'Vị trí phát vượt quá thời lượng video');

  const existing = await ProgressModel.findOne({ userId: req.auth!.userId, lessonId: lesson._id });
  const ranges = mergeWatchedRanges(
    existing?.watchedRanges.map(range => ({ start: range.start, end: range.end })) ?? [],
    req.body.watchedRange,
  );
  const completed = watchedCoverage(ranges, lesson.durationSeconds) >= 0.9;
  const progress = await ProgressModel.findOneAndUpdate(
    { userId: req.auth!.userId, lessonId: lesson._id },
    {
      $set: {
        lastPositionSeconds: req.body.positionSeconds,
        watchedRanges: ranges,
        completed,
        ...(completed && !existing?.completed ? { completedAt: new Date() } : {}),
      },
      $inc: { activeStudySeconds: req.body.activeStudyDeltaSeconds },
    },
    { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  const isNewCompletion = completed && !existing?.completed;
  const studySeconds = req.body.activeStudyDeltaSeconds || 0;
  const studyXp = Math.floor(studySeconds / 60) * 2;
  const xpEarned = (isNewCompletion ? 50 : 0) + studyXp;

  await recordActivitySafely(req.auth!.userId, {
    activeStudySeconds: studySeconds,
    progressUpdates: 1,
    completedLessons: isNewCompletion ? 1 : 0,
    xpEarned,
  });
  res.json({ data: { progress, coverage: watchedCoverage(ranges, lesson.durationSeconds), xpEarned, isNewCompletion } });
}));

router.post('/:lessonId/attempts', requireAuth, validate(idSchema, 'params'), requirePremium, requireLessonHsk, validate(attemptSchema), asyncHandler(async (req, res) => {
  const input = req.body as AttemptInput;
  const existingAttempt = await QuizAttemptModel.findOne({ userId: req.auth!.userId, idempotencyKey: input.idempotencyKey }).lean();
  if (existingAttempt) {
    res.json({ data: existingAttempt, replayed: true });
    return;
  }
  const lesson = await LessonModel.findOne({ _id: req.params.lessonId, status: 'published' }).select('activeQuizRevision').lean();
  if (!lesson?.activeQuizRevision) throw new AppError(404, 'QUIZ_NOT_FOUND', 'Bài học chưa có bài luyện tập');
  const quiz = await QuizModel.findOne({ lessonId: lesson._id, revision: lesson.activeQuizRevision, status: 'published' })
    .select('+questions.correctOptionId +questions.acceptedAnswers +questions.explanationVi');
  if (!quiz) throw new AppError(404, 'QUIZ_NOT_FOUND', 'Không tìm thấy bài luyện tập');

  if (!quiz.questions.length) throw new AppError(422, 'QUIZ_EMPTY', 'Nội dung này không có bài luyện tập');
  const answerMap = new Map<string, AttemptInput['answers'][number]>(input.answers.map(answer => [answer.questionId, answer]));
  const hasAnsweredQuestion = quiz.questions.some(question => {
    const answer = answerMap.get(question.questionId);
    return question.type === 'multiple_choice'
      ? question.options.some(option => option.optionId === answer?.selectedOptionId)
      : Boolean(answer?.textAnswer?.trim());
  });
  if (!hasAnsweredQuestion) throw new AppError(422, 'QUIZ_UNANSWERED', 'Hãy trả lời ít nhất một câu hỏi trước khi nộp.');
  const graded = quiz.questions.map(question => {
    const answer = answerMap.get(question.questionId);
    const correct = question.type === 'multiple_choice'
      ? answer?.selectedOptionId === question.correctOptionId
      : (question.acceptedAnswers ?? []).some(value => normalizeAnswer(value) === normalizeAnswer(answer?.textAnswer ?? ''));
    return {
      questionId: question.questionId,
      selectedOptionId: answer?.selectedOptionId,
      textAnswer: answer?.textAnswer,
      correct,
      explanationVi: question.explanationVi,
      correctOptionId: question.correctOptionId,
      acceptedAnswers: question.acceptedAnswers,
    };
  });
  const correctCount = graded.filter(answer => answer.correct).length;
  const score = Math.round((correctCount / quiz.questions.length) * 100);
  const attempt = await QuizAttemptModel.create({
    userId: req.auth!.userId,
    lessonId: lesson._id,
    quizId: quiz._id,
    idempotencyKey: input.idempotencyKey,
    answers: graded.map(({ explanationVi: _explanation, correctOptionId: _correctOption, acceptedAnswers: _accepted, ...answer }) => answer),
    score,
    correctCount,
    totalCount: quiz.questions.length,
  });
  await ProgressModel.updateOne(
    { userId: req.auth!.userId, lessonId: lesson._id },
    { $max: { bestQuizScore: score }, $setOnInsert: { lastPositionSeconds: 0, watchedRanges: [], activeStudySeconds: 0 } },
    { upsert: true },
  );

  let quizXpEarned = 25; // 25 XP base for quiz completion
  if (score === 100) {
    quizXpEarned = 50; // Perfect score bonus
  } else if (score >= 80) {
    quizXpEarned = 40; // High score bonus
  }

  await recordActivitySafely(req.auth!.userId, {
    quizAttempts: 1,
    xpEarned: quizXpEarned,
  });

  // Gửi thông báo chúc mừng khi đạt điểm cao (>= 80%)
  if (score >= 80) {
    const lessonTitle = lesson.titleVi || lesson.titleZh || 'Bài học';
    // Fire-and-forget: notification không critical cho response. Đăng ký
    // `.catch` để mọi lỗi vẫn được log nhưng không block response.
    NotificationService.createNotification({
      userId: req.auth!.userId,
      type: 'quiz',
      category: 'study',
      title: {
        vi: `Xuất sắc! Đạt ${score}% điểm Quiz`,
        en: `Great job! Scored ${score}% on Quiz`,
        zh: `太棒了！随堂测试获得 ${score}% 高分`,
      },
      message: {
        vi: `Bạn đã trả lời đúng ${correctCount}/${quiz.questions.length} câu hỏi bài học "${lessonTitle}". Hãy tiếp tục phát huy!`,
        en: `You answered ${correctCount}/${quiz.questions.length} questions correctly in "${lessonTitle}". Keep it up!`,
        zh: `您在课程《${lessonTitle}》中答对 ${correctCount}/${quiz.questions.length} 题。继续加油！`,
      },
      actionUrl: '/history',
      actionText: {
        vi: 'Xem lịch sử',
        en: 'View History',
        zh: '查看记录',
      },
      metadata: { lessonId: lesson._id, score, correctCount, totalCount: quiz.questions.length, xpEarned: quizXpEarned },
    }).catch(err => logger.error({ err, userId: req.auth!.userId, lessonId: lesson._id }, 'Failed to create quiz success notification'));
  }
  // SECURITY (H-6): Strip answer keys from the response sent back to learners.
  // The graded answers still contain correct/explanation, but correctOptionId/acceptedAnswers
  // must never be echoed to the client (already filtered out in the persisted attempt above).
  const safeGraded = graded.map(({ correctOptionId: _correctOption, acceptedAnswers: _accepted, explanationVi: _explanation, ...answer }) => ({
    ...answer,
    // Keep `correct` flag so UI can show pass/fail, but do NOT reveal the right answer.
  }));
  res.status(201).json({ data: { attemptId: attempt._id, score, correctCount, totalCount: quiz.questions.length, answers: safeGraded, xpEarned: quizXpEarned } });
}));

export default router;
