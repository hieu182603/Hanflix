import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { requireAuth } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rate-limits.js';
import { validateQuery } from '../middleware/validate.js';
import { LessonModel } from '../models/lesson.model.js';
import { ProgressModel } from '../models/progress.model.js';
import { QuizAttemptModel } from '../models/quiz-attempt.model.js';
import { SavedWordModel } from '../models/saved-word.model.js';
import { StudyActivityModel } from '../models/study-activity.model.js';
import { UserModel } from '../models/user.model.js';
import { rerankLessonCandidates } from '../services/gemini.js';
import {
  DEFAULT_TIMEZONE,
  enumerateDateKeys,
  parseDateKey,
  toTimezoneDateKey,
} from '../services/study-activity.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(requireAuth);

const activityQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from phải có dạng YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to phải có dạng YYYY-MM-DD').optional(),
  timezone: z.string().trim().min(1).max(50).optional(),
});

router.get('/activity', validateQuery(activityQuerySchema), asyncHandler(async (req, res) => {
  const query = (req as unknown as Record<string, unknown>).parsedQuery as z.infer<typeof activityQuerySchema>;
  const timezone = query.timezone || DEFAULT_TIMEZONE;
  const to = query.to ?? toTimezoneDateKey(new Date(), timezone);
  const toDate = parseDateKey(to);
  const defaultFrom = new Date(toDate);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);
  const from = query.from ?? defaultFrom.toISOString().slice(0, 10);
  let dateKeys: string[];
  try {
    dateKeys = enumerateDateKeys(from, to);
  } catch {
    throw new AppError(422, 'INVALID_ACTIVITY_RANGE', 'Khoảng thời gian hoạt động không hợp lệ');
  }
  if (dateKeys.length > 366) throw new AppError(422, 'ACTIVITY_RANGE_TOO_LARGE', 'Chỉ được xem tối đa 366 ngày');

  const records = await StudyActivityModel.find({
    userId: req.auth!.userId,
    dateKey: { $gte: from, $lte: to },
  }).sort({ dateKey: 1 }).lean();
  const recordMap = new Map(records.map(record => [record.dateKey, record]));
  const days = dateKeys.map(dateKey => {
    const record = recordMap.get(dateKey);
    return {
      date: dateKey,
      activeStudySeconds: record?.activeStudySeconds ?? 0,
      progressUpdates: record?.progressUpdates ?? 0,
      quizAttempts: record?.quizAttempts ?? 0,
      completedLessons: record?.completedLessons ?? 0,
    };
  });
  const totals = days.reduce((sum, day) => ({
    activeStudySeconds: sum.activeStudySeconds + day.activeStudySeconds,
    progressUpdates: sum.progressUpdates + day.progressUpdates,
    quizAttempts: sum.quizAttempts + day.quizAttempts,
    completedLessons: sum.completedLessons + day.completedLessons,
  }), { activeStudySeconds: 0, progressUpdates: 0, quizAttempts: 0, completedLessons: 0 });

  res.json({ data: { from, to, timezone, days, totals } });
}));

router.get('/dashboard', asyncHandler(async (req, res) => {
  const now = new Date();
  // PERFORMANCE (PERF-01): Limit dashboard progress query to 50 items.
  // For power users with thousands of progress records, use the dedicated
  // /learning/history endpoint with proper pagination.
  const PROGRESS_DASHBOARD_LIMIT = 50;
  const [progress, savedCount, dueCount, attempts] = await Promise.all([
    ProgressModel.find({ userId: req.auth!.userId })
      .populate('lessonId', 'slug titleVi titleZh pinyin hsk topicIds durationSeconds thumbnailKey')
      .sort({ updatedAt: -1 })
      .limit(PROGRESS_DASHBOARD_LIMIT)
      .lean(),
    SavedWordModel.countDocuments({ userId: req.auth!.userId }),
    SavedWordModel.countDocuments({ userId: req.auth!.userId, nextReviewAt: { $lte: now } }),
    QuizAttemptModel.find({ userId: req.auth!.userId }).select('score lessonId createdAt').sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  const completedLessons = progress.filter(item => item.completed).length;
  const averageQuizScore = attempts.length
    ? Math.round(attempts.reduce((sum, item) => sum + item.score, 0) / attempts.length)
    : null;
  res.json({
    data: {
      metrics: { completedLessons, savedWords: savedCount, dueWords: dueCount, averageQuizScore },
      continueLearning: progress.find(item => !item.completed) ?? null,
      recentProgress: progress.slice(0, 10),
      recentAttempts: attempts,
    },
  });
}));

router.get('/recommendations', asyncHandler(async (req, res) => {
  const [user, lessons, progress] = await Promise.all([
    UserModel.findById(req.auth!.userId).select('learningProfile').lean(),
    // PERFORMANCE (PERF-03): We fetch up to 100 lessons and score/sort in JS
    // because the scoring function depends on multiple profile fields (hsk match,
    // topic overlap, completion history) — it's complex enough that translating
    // into a Mongo aggregation would hurt readability without clear win.
    // For scale: cap the candidate pool (100) and add DB index on { status, hsk, topicIds }.
    LessonModel.find({ status: 'published' }).select('-media.objectKey').limit(100).lean(),
    ProgressModel.find({ userId: req.auth!.userId }).select('lessonId completed bestQuizScore').lean(),
  ]);
  const profile = user?.learningProfile;
  const progressMap = new Map(progress.map(item => [item.lessonId.toString(), item]));
  const items = lessons.map(lesson => {
    let score = 0;
    const reasons: string[] = [];
    if (profile?.currentHsk && lesson.hsk === profile.currentHsk) {
      score += 4;
      reasons.push(`Phù hợp HSK ${lesson.hsk} tự khai/đã lưu`);
    } else if (!profile?.currentHsk || Math.abs(lesson.hsk - profile.currentHsk) <= 1) {
      score += 2;
      reasons.push('Gần mức bắt đầu hiện tại');
    }
    const topics = profile?.topicIds ?? [];
    if (lesson.topicIds.some(topic => topics.includes(topic))) {
      score += 3;
      reasons.push('Khớp chủ đề quan tâm');
    }
    if (profile?.goal && lesson.goalTags.includes(profile.goal)) {
      score += 3;
      reasons.push('Khớp mục tiêu học tập');
    }
    const lessonProgress = progressMap.get(lesson._id.toString());
    if (lessonProgress && !lessonProgress.completed) {
      score += 5;
      reasons.unshift('Tiếp tục bài đang học');
    } else if (lessonProgress?.completed) {
      score -= 2;
    }
    return { lesson, score, reasons: reasons.slice(0, 2) };
  }).sort((a, b) => b.score - a.score).slice(0, 12);
  res.json({ data: { items, source: 'deterministic_profile_rules' } });
}));

router.post('/recommendations/ai', aiLimiter, asyncHandler(async (req, res) => {
  const [user, lessons] = await Promise.all([
    UserModel.findById(req.auth!.userId).select('learningProfile').lean(),
    LessonModel.find({ status: 'published' }).select('titleVi titleZh pinyin descriptionVi hsk topicIds goalTags durationSeconds thumbnailKey').limit(30).lean(),
  ]);
  if (lessons.length === 0) {
    res.json({ data: { items: [], source: 'no_published_lessons' } });
    return;
  }
  let resultItems: { lessonId: string; reasonVi: string }[] = [];
  try {
    const result = await rerankLessonCandidates({
      profile: user?.learningProfile ?? {},
      candidates: lessons.map(lesson => ({
        lessonId: lesson._id.toString(),
        titleVi: lesson.titleVi,
        hsk: lesson.hsk,
        topicIds: lesson.topicIds,
        goalTags: lesson.goalTags,
      })),
    });
    resultItems = result.items;
  } catch {
    // Graceful fallback below
  }

  const lessonMap = new Map(lessons.map(lesson => [lesson._id.toString(), lesson]));
  const validAiItems = resultItems
    .map(item => ({ lesson: lessonMap.get(item.lessonId), reasonVi: item.reasonVi }))
    .filter(item => item.lesson != null);

  if (validAiItems.length > 0) {
    res.json({
      data: {
        items: validAiItems,
        source: 'gemini_validated_rerank',
      },
    });
    return;
  }

  // Deterministic profile-aware fallback
  const userHsk = user?.learningProfile?.currentHsk || 3;
  const userTopics = user?.learningProfile?.topicIds || [];
  const sorted = [...lessons]
    .sort((a, b) => {
      const aHskDiff = Math.abs(a.hsk - userHsk);
      const bHskDiff = Math.abs(b.hsk - userHsk);
      if (aHskDiff !== bHskDiff) return aHskDiff - bHskDiff;
      const aTopicMatch = a.topicIds?.some(t => userTopics.includes(t)) ? 1 : 0;
      const bTopicMatch = b.topicIds?.some(t => userTopics.includes(t)) ? 1 : 0;
      return bTopicMatch - aTopicMatch;
    })
    .slice(0, 8);

  res.json({
    data: {
      items: sorted.map(lesson => ({
        lesson,
        reasonVi: `Phù hợp với trình độ HSK ${lesson.hsk} và chủ đề học tập của bạn`,
      })),
      source: 'profile_deterministic_fallback',
    },
  });
}));

export default router;
