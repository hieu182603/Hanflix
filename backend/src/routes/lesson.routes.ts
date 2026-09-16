import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { LessonModel } from '../models/lesson.model.js';
import { ProgressModel } from '../models/progress.model.js';
import { QuizAttemptModel } from '../models/quiz-attempt.model.js';
import { QuizModel } from '../models/quiz.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';
import { createVideoDownloadUrl } from '../services/r2.js';
import { mergeWatchedRanges, watchedCoverage } from '../services/watched-ranges.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

const listSchema = z.object({
  q: z.string().trim().max(120).optional(),
  hsk: z.coerce.number().int().min(1).max(6).optional(),
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

router.get('/', validate(listSchema, 'query'), asyncHandler(async (req, res) => {
  const { q, hsk, topic, page, limit } = req.query as unknown as z.infer<typeof listSchema>;
  const filter: Record<string, unknown> = { status: 'published' };
  if (hsk) filter.hsk = hsk;
  if (topic) filter.topicIds = topic;
  if (q) filter.$text = { $search: q };

  const [items, total] = await Promise.all([
    LessonModel.find(filter)
      .select('-media.objectKey')
      .sort(q ? { score: { $meta: 'textScore' } } : { publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    LessonModel.countDocuments(filter),
  ]);
  res.json({ data: { items, page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.get('/:lessonId', validate(idSchema, 'params'), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOne({ _id: req.params.lessonId, status: 'published' }).lean();
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  const mediaUrl = lesson.media?.objectKey ? await createVideoDownloadUrl(lesson.media.objectKey) : null;
  res.json({ data: { ...lesson, media: lesson.media ? { ...lesson.media, objectKey: undefined, url: mediaUrl } : null } });
}));

router.get('/:lessonId/subtitles', validate(idSchema, 'params'), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOne({ _id: req.params.lessonId, status: 'published' }).select('activeSubtitleRevision').lean();
  if (!lesson?.activeSubtitleRevision) throw new AppError(404, 'SUBTITLES_NOT_FOUND', 'Bài học chưa có phụ đề đã xuất bản');
  const track = await SubtitleTrackModel.findOne({
    lessonId: lesson._id,
    revision: lesson.activeSubtitleRevision,
    status: 'published',
  }).populate('cues.tokens.wordId', 'hanzi pinyin meaningVi partOfSpeech examples audioKey').lean();
  if (!track) throw new AppError(404, 'SUBTITLES_NOT_FOUND', 'Không tìm thấy phụ đề');
  res.json({ data: track });
}));

router.get('/:lessonId/quiz', validate(idSchema, 'params'), asyncHandler(async (req, res) => {
  const lesson = await LessonModel.findOne({ _id: req.params.lessonId, status: 'published' }).select('activeQuizRevision').lean();
  if (!lesson?.activeQuizRevision) throw new AppError(404, 'QUIZ_NOT_FOUND', 'Bài học chưa có bài luyện tập');
  const quiz = await QuizModel.findOne({ lessonId: lesson._id, revision: lesson.activeQuizRevision, status: 'published' }).lean();
  if (!quiz) throw new AppError(404, 'QUIZ_NOT_FOUND', 'Không tìm thấy bài luyện tập');
  res.json({ data: quiz });
}));

router.patch('/:lessonId/progress', requireAuth, validate(idSchema, 'params'), validate(progressSchema), asyncHandler(async (req, res) => {
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
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  res.json({ data: { progress, coverage: watchedCoverage(ranges, lesson.durationSeconds) } });
}));

router.post('/:lessonId/attempts', requireAuth, validate(idSchema, 'params'), validate(attemptSchema), asyncHandler(async (req, res) => {
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

  const answerMap = new Map<string, AttemptInput['answers'][number]>(input.answers.map(answer => [answer.questionId, answer]));
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
  res.status(201).json({ data: { attemptId: attempt._id, score, correctCount, totalCount: quiz.questions.length, answers: graded } });
}));

export default router;
