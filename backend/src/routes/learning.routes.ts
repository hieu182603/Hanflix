import { Router } from 'express';
import { z } from 'zod';
import { Types, type PipelineStage } from 'mongoose';
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
import { createVideoDownloadUrl } from '../services/r2.js';
import { withProcessingCompatibility } from '../services/lesson-presentation.js';
import { LeaderboardService } from '../services/leaderboard.service.js';
import { RoadmapService } from '../services/roadmap.service.js';
import { asyncHandler } from '../utils/async-handler.js';

async function safeDownloadUrl(key?: string | null): Promise<string | null> {
  if (!key) return null;
  try {
    return await createVideoDownloadUrl(key);
  } catch {
    return null;
  }
}

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
  const [progress, savedCount, dueCount, attempts, userXP] = await Promise.all([
    ProgressModel.find({ userId: req.auth!.userId })
      .populate('lessonId', 'slug titleVi titleZh pinyin hsk topicIds durationSeconds thumbnailKey')
      .sort({ updatedAt: -1 })
      .limit(PROGRESS_DASHBOARD_LIMIT)
      .lean(),
    SavedWordModel.countDocuments({ userId: req.auth!.userId }),
    SavedWordModel.countDocuments({ userId: req.auth!.userId, nextReviewAt: { $lte: now } }),
    QuizAttemptModel.find({ userId: req.auth!.userId }).select('score lessonId createdAt').sort({ createdAt: -1 }).limit(20).lean(),
    LeaderboardService.getUserXP(req.auth!.userId.toString()),
  ]);
  const completedLessons = progress.filter(item => item.completed).length;
  const averageQuizScore = attempts.length
    ? Math.round(attempts.reduce((sum, item) => sum + item.score, 0) / attempts.length)
    : null;

  const continueItem = progress.find(item => !item.completed) ?? null;
  let continueLearning: unknown = continueItem;
  if (continueItem && continueItem.lessonId && typeof continueItem.lessonId === 'object') {
    const lessonObj = continueItem.lessonId as unknown as Record<string, unknown>;
    const thumbnailUrl = await safeDownloadUrl(lessonObj.thumbnailKey as string | undefined);
    continueLearning = {
      ...continueItem,
      lessonId: withProcessingCompatibility({
        ...lessonObj,
        thumbnailUrl,
      }),
    };
  }

  res.json({
    data: {
      metrics: {
        completedLessons,
        savedWords: savedCount,
        dueWords: dueCount,
        averageQuizScore,
        totalXP: userXP.totalXP,
        streakDays: userXP.streakDays,
      },
      userXP,
      continueLearning,
      recentProgress: progress.slice(0, 10),
      recentAttempts: attempts,
    },
  });
}));

router.get('/history', asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 8));
  const status = req.query.status as string | undefined;
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const hsk = req.query.hsk ? parseInt(req.query.hsk as string, 10) : undefined;
  const userId = new Types.ObjectId(req.auth!.userId);

  // Build filter conditions
  const baseFilter: Record<string, unknown> = { userId };
  if (status === 'completed') baseFilter.completed = true;
  else if (status === 'in_progress') baseFilter.completed = false;

  // M-3: Use aggregation for stats to avoid fetching all documents
  const [statsResult] = await ProgressModel.aggregate([
    { $match: { userId } },
    {
      $lookup: {
        from: 'lessons',
        localField: 'lessonId',
        foreignField: '_id',
        as: 'lesson',
      },
    },
    { $unwind: { path: '$lesson', preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: null,
        totalLessonsLearned: { $sum: 1 },
        completedCount: { $sum: { $cond: ['$completed', 1, 0] } },
        totalStudySeconds: { $sum: { $add: ['$activeStudySeconds', '$lastPositionSeconds'] } },
      },
    },
  ]).limit(1);

  const validProgress = statsResult ?? { totalLessonsLearned: 0, completedCount: 0, totalStudySeconds: 0 };

  // M-3: Fetch quiz attempts separately (lightweight count query)
  const attempts = await QuizAttemptModel.find({ userId }).select('score').lean();
  const averageQuizScore = attempts.length
    ? Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length)
    : null;

  // M-3: Use MongoDB aggregation for paginated items with lookup + filter
  const matchStage: Record<string, unknown> = { userId };
  if (status === 'completed') matchStage.completed = true;
  else if (status === 'in_progress') matchStage.completed = false;

  const lookupAndFilterPipeline: PipelineStage[] = [
    { $match: matchStage },
    {
      $lookup: {
        from: 'lessons',
        localField: 'lessonId',
        foreignField: '_id',
        as: 'lesson',
      },
    },
    { $unwind: { path: '$lesson', preserveNullAndEmptyArrays: true } },
  ];

  // Add text search filter if q is provided
  if (q || hsk) {
    const lessonMatch: Record<string, unknown> = {};
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      lessonMatch.$or = [
        { 'lesson.titleVi': { $regex: escaped, $options: 'i' } },
        { 'lesson.titleZh': { $regex: escaped, $options: 'i' } },
        { 'lesson.pinyin': { $regex: escaped, $options: 'i' } },
      ];
    }
    if (hsk) lessonMatch['lesson.hsk'] = hsk;
    lookupAndFilterPipeline.push({ $match: lessonMatch });
  }

  // Get total count before pagination
  const countPipeline: PipelineStage[] = [...lookupAndFilterPipeline, { $count: 'total' }];
  const countResult = await ProgressModel.aggregate(countPipeline);
  const total = countResult[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startIndex = (page - 1) * limit;

  // Paginated items with sort
  const itemsPipeline: PipelineStage[] = [
    ...lookupAndFilterPipeline,
    { $sort: { updatedAt: -1 } },
    { $skip: startIndex },
    { $limit: limit },
  ];

  const items = await ProgressModel.aggregate(itemsPipeline);

  // Resolve thumbnail URLs
  const itemsWithThumbnails = await Promise.all(
    items.map(async (item) => {
      if (!item.lesson) return item;
      const thumbnailUrl = await safeDownloadUrl(item.lesson.thumbnailKey);
      return {
        ...item,
        lesson: withProcessingCompatibility({
          ...item.lesson,
          thumbnailUrl,
        }),
      };
    })
  );

  res.json({
    data: {
      items: itemsWithThumbnails,
      total,
      page,
      limit,
      totalPages,
      stats: {
        totalLessonsLearned: validProgress.totalLessonsLearned,
        completedCount: validProgress.completedCount,
        inProgressCount: validProgress.totalLessonsLearned - validProgress.completedCount,
        totalStudySeconds: validProgress.totalStudySeconds,
        averageQuizScore,
      },
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

  const itemsWithThumbnails = await Promise.all(
    items.map(async item => {
      const thumbnailUrl = await safeDownloadUrl(item.lesson.thumbnailKey);
      return {
        ...item,
        lesson: withProcessingCompatibility({ ...item.lesson, thumbnailUrl }),
      };
    })
  );

  res.json({ data: { items: itemsWithThumbnails, source: 'deterministic_profile_rules' } });
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
    .filter((item): item is { lesson: NonNullable<typeof item.lesson>; reasonVi: string } => item.lesson != null);

  if (validAiItems.length > 0) {
    const itemsWithThumbnails = await Promise.all(
      validAiItems.map(async item => {
        const thumbnailUrl = await safeDownloadUrl(item.lesson.thumbnailKey);
        return {
          ...item,
          lesson: withProcessingCompatibility({ ...item.lesson, thumbnailUrl }),
        };
      })
    );
    res.json({
      data: {
        items: itemsWithThumbnails,
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

  const fallbackWithThumbnails = await Promise.all(
    sorted.map(async lesson => {
      const thumbnailUrl = await safeDownloadUrl(lesson.thumbnailKey);
      return {
        lesson: withProcessingCompatibility({ ...lesson, thumbnailUrl }),
        reasonVi: `Phù hợp với trình độ HSK ${lesson.hsk} và chủ đề học tập của bạn`,
      };
    })
  );

  res.json({
    data: {
      items: fallbackWithThumbnails,
      source: 'profile_deterministic_fallback',
    },
  });
}));

const leaderboardQuerySchema = z.object({
  period: z.enum(['week', 'month', 'all']).default('week'),
  limit: z.coerce.number().min(1).max(100).default(20),
  timezone: z.string().trim().min(1).max(50).optional(),
});

router.get('/leaderboard', validateQuery(leaderboardQuerySchema), asyncHandler(async (req, res) => {
  const query = (req as unknown as Record<string, unknown>).parsedQuery as z.infer<typeof leaderboardQuerySchema>;
  const result = await LeaderboardService.getLeaderboard({
    period: query.period,
    currentUserId: req.auth!.userId.toString(),
    limit: query.limit,
    timezone: query.timezone,
  });
  res.json({ data: result });
}));

router.get('/roadmap', asyncHandler(async (req, res) => {
  const result = await RoadmapService.getRoadmap(req.auth!.userId.toString());
  res.json({ data: result });
}));

export default router;
