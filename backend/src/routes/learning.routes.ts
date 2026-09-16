import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rate-limits.js';
import { LessonModel } from '../models/lesson.model.js';
import { ProgressModel } from '../models/progress.model.js';
import { QuizAttemptModel } from '../models/quiz-attempt.model.js';
import { SavedWordModel } from '../models/saved-word.model.js';
import { UserModel } from '../models/user.model.js';
import { rerankLessonCandidates } from '../services/gemini.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(requireAuth);

router.get('/dashboard', asyncHandler(async (req, res) => {
  const now = new Date();
  const [progress, savedCount, dueCount, attempts] = await Promise.all([
    ProgressModel.find({ userId: req.auth!.userId })
      .populate('lessonId', 'slug titleVi titleZh pinyin hsk topicIds durationSeconds thumbnailKey')
      .sort({ updatedAt: -1 })
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
    LessonModel.find({ status: 'published' }).select('titleVi hsk topicIds goalTags').limit(30).lean(),
  ]);
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
  const lessonMap = new Map(lessons.map(lesson => [lesson._id.toString(), lesson]));
  res.json({
    data: {
      items: result.items.map(item => ({ lesson: lessonMap.get(item.lessonId), reasonVi: item.reasonVi })),
      source: 'gemini_validated_rerank',
    },
  });
}));

export default router;
