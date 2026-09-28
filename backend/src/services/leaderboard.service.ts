import { summarizeStreak, qualifyingStudyActivity, qualifyingPracticeActivity } from './streak.js';
import { PracticeAttemptModel } from '../models/practice.model.js';
import { Types } from 'mongoose';
import { UserModel } from '../models/user.model.js';
import { StudyActivityModel } from '../models/study-activity.model.js';
import { ProgressModel } from '../models/progress.model.js';
import { toTimezoneDateKey, DEFAULT_TIMEZONE } from './study-activity.js';

export type LeaderboardPeriod = 'week' | 'month' | 'all';

export interface LeaderboardUserItem {
  rank: number;
  id: string;
  name: string;
  avatar: string;
  xp: number;
  streakDays: number;
  hskLevel: string;
  isMe: boolean;
  trend: 'up' | 'down' | 'same';
  trendValue?: number;
  badge?: string;
}

export interface LeaderboardResult {
  period: LeaderboardPeriod;
  items: LeaderboardUserItem[];
  currentUserRank: LeaderboardUserItem | null;
  totalParticipants: number;
  page: number;
  totalPages: number;
  topUsers: LeaderboardUserItem[];
  timezone: string;
}

/**
 * Calculates dateKey boundary for a given period.
 */
function getDateKeyThreshold(period: LeaderboardPeriod, timezone = DEFAULT_TIMEZONE): string | null {
  const now = new Date();
  const todayKey = toTimezoneDateKey(now, timezone);
  const [y, m, d] = todayKey.split('-').map(Number);

  if (period === 'week') {
    // Start from Monday of the current week
    const date = new Date(Date.UTC(y!, m! - 1, d!));
    const dayOfWeek = date.getUTCDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = (dayOfWeek + 6) % 7;
    date.setUTCDate(date.getUTCDate() - diffToMonday);
    return date.toISOString().slice(0, 10);
  }

  if (period === 'month') {
    // Start of current month (YYYY-MM-01)
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`;
  }

  return null; // 'all'
}

/**
 * Calculates current streak in days from an array of active dateKeys.
 */
export function calculateStreakFromDateKeys(dateKeys: string[], timezone = DEFAULT_TIMEZONE): number {
  return summarizeStreak(dateKeys, new Date(), timezone).streakCount;
}

type ActivityTotals = {
  totalActiveSeconds?: number; totalCompletedLessons?: number; totalQuizAttempts?: number;
  totalVocabReviews?: number; totalXpEarned?: number;
};
type ProgressTotals = { completedCount?: number; studySeconds?: number };

// The same policy serves the dashboard and all leaderboard periods. Legacy XP
// is a floor, not an additive award; practice rewards are added exactly once.
function summarizeXP(activity: ActivityTotals | undefined, progress: ProgressTotals | undefined,
  activeDays: number, legacyXP = 0, practiceXP = 0) {
  const minutesStudied = Math.floor((activity?.totalActiveSeconds ?? progress?.studySeconds ?? 0) / 60);
  const completedLessons = Math.max(activity?.totalCompletedLessons ?? 0, progress?.completedCount ?? 0);
  const quizAttempts = activity?.totalQuizAttempts ?? 0;
  const vocabReviews = activity?.totalVocabReviews ?? 0;
  const bonus = activeDays * 10;
  const calculated = completedLessons * 50 + quizAttempts * 25 + vocabReviews * 5 + minutesStudied * 2 + bonus;
  const totalXP = Math.max(calculated, (activity?.totalXpEarned ?? 0) + bonus, legacyXP) + practiceXP;
  return { totalXP, completedLessons, quizAttempts, vocabReviews, minutesStudied };
}

export class LeaderboardService {
  /**
   * Generates the leaderboard for week, month, or all-time.
   */
  static async getLeaderboard(options: {
    period: LeaderboardPeriod;
    currentUserId: string;
    limit?: number;
    page?: number;
    hsk?: number;
    timezone?: string;
  }): Promise<LeaderboardResult> {
    const { period, currentUserId, limit = 20, page = 1, hsk } = options;
    const timezone = DEFAULT_TIMEZONE;
    const thresholdDateKey = getDateKeyThreshold(period, timezone);

    // 1. Match filter for StudyActivity
    const activityMatch: Record<string, unknown> = { ...qualifyingStudyActivity };
    if (thresholdDateKey) {
      activityMatch.dateKey = { $gte: thresholdDateKey };
    }

    // 2. Aggregate activity points per user
    const activityAgg = await StudyActivityModel.aggregate<{
      _id: Types.ObjectId;
      totalActiveSeconds: number;
      totalCompletedLessons: number;
      totalQuizAttempts: number;
      totalVocabReviews: number;
      totalXpEarned: number;
      dateKeys: string[];
    }>([
      { $match: activityMatch },
      {
        $group: {
          _id: '$userId',
          totalActiveSeconds: { $sum: '$activeStudySeconds' },
          totalCompletedLessons: { $sum: '$completedLessons' },
          totalQuizAttempts: { $sum: '$quizAttempts' },
          totalVocabReviews: { $sum: '$vocabReviews' },
          totalXpEarned: { $sum: '$xpEarned' },
          dateKeys: { $addToSet: '$dateKey' },
        },
      },
    ]);

    const activityMap = new Map(activityAgg.map((a) => [a._id.toString(), a]));
    const [allActivityDates, practicePoints, practiceDates] = await Promise.all([
      StudyActivityModel.aggregate<{ _id: Types.ObjectId; dateKeys: string[] }>([
        { $match: qualifyingStudyActivity },
        { $group: { _id: '$userId', dateKeys: { $addToSet: '$dateKey' } } },
      ]),
      PracticeAttemptModel.aggregate<{ _id: Types.ObjectId; xp: number }>([
        { $match: { status: 'submitted', ...(thresholdDateKey ? { dateKey: { $gte: thresholdDateKey } } : {}) } },
        { $group: { _id: '$userId', xp: { $sum: '$rewardXp' } } },
      ]),
      PracticeAttemptModel.aggregate<{ _id: Types.ObjectId; dateKeys: string[] }>([
        { $match: qualifyingPracticeActivity },
        { $group: { _id: '$userId', dateKeys: { $addToSet: '$dateKey' } } },
      ]),
    ]);
    const streakMap = new Map(allActivityDates.map(a => [String(a._id), a.dateKeys]));
    const practiceXpMap = new Map(practicePoints.map(a => [String(a._id), a.xp]));
    for (const row of practiceDates) streakMap.set(String(row._id), [...(streakMap.get(String(row._id)) ?? []), ...row.dateKeys]);


    // 3. For all-time or fallback, also get ProgressModel completions
    const progressAgg = await ProgressModel.aggregate<{
      _id: Types.ObjectId;
      completedCount: number;
      studySeconds: number;
    }>([
      { $match: { completed: true } },
      {
        $group: {
          _id: '$userId',
          completedCount: { $sum: 1 },
          studySeconds: { $sum: '$activeStudySeconds' },
        },
      },
    ]);
    const progressMap = new Map(progressAgg.map((p) => [p._id.toString(), p]));

    // 4. Fetch all active users (limited to reasonable pool, e.g. 500)
    const users = await UserModel.find({ status: 'active', role: 'user', ...(hsk ? { 'learningProfile.currentHsk': hsk } : {}) })
      .select('name avatarUrl googleAvatarUrl learningProfile totalXP')
      .lean();

    // 5. Compute XP and streak for each user
    const userScores: Array<{
      id: string;
      name: string;
      avatar: string;
      xp: number;
      streakDays: number;
      hskLevel: string;
      isMe: boolean;
    }> = [];

    for (const user of users) {
      const uId = user._id.toString();
      const act = activityMap.get(uId);
      const prg = progressMap.get(uId);

      const streakDays = calculateStreakFromDateKeys(streakMap.get(uId) ?? [], timezone);

      const bonusDates = (streakMap.get(uId) ?? []).filter(key => !thresholdDateKey || key >= thresholdDateKey);
      const periodStreak = summarizeStreak(bonusDates, new Date(), timezone).activeDays;
      const { totalXP: xp } = summarizeXP(act, period === 'all' ? prg : undefined, periodStreak,
        period === 'all' ? (user.totalXP ?? 0) : 0, practiceXpMap.get(uId) ?? 0);

      const hskNum = user.learningProfile?.currentHsk || user.learningProfile?.targetHsk || 3;
      const avatar = user.avatarUrl || user.googleAvatarUrl || '';

      userScores.push({
        id: uId,
        name: user.name || 'Học viên HanFlix',
        avatar,
        xp,
        streakDays,
        hskLevel: `HSK ${hskNum}`,
        isMe: uId === currentUserId,
      });
    }

    // 6. Sort descending by XP, then streak, then name
    userScores.sort((a, b) => {
      if (b.xp !== a.xp) return b.xp - a.xp;
      if (b.streakDays !== a.streakDays) return b.streakDays - a.streakDays;
      return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    });

    // 7. Assign ranks and trends
    const rankedUsers: LeaderboardUserItem[] = userScores.map((u, idx) => {
      const rank = idx + 1;
      let badge: string | undefined;
      if (rank === 1) badge = 'Quán quân';
      else if (rank === 2) badge = 'Á quân';
      else if (rank === 3) badge = 'Huy chương Đồng';
      else if (u.streakDays >= 7) badge = `${u.streakDays} ngày liên tiếp`;
      else if (u.xp >= 1000) badge = 'Cao thủ';

      // No historical snapshot yet: do not invent rank movement.
      const trend = 'same' as const;
      const trendValue = undefined;

      return {
        ...u,
        rank,
        trend,
        trendValue,
        badge,
      };
    });

    const totalPages = Math.max(1, Math.ceil(rankedUsers.length / limit));
    const safePage = Math.min(page, totalPages);
    const items = rankedUsers.slice((safePage - 1) * limit, safePage * limit);
    const currentUserRank = rankedUsers.find((u) => u.isMe) || null;

    return {
      period,
      items,
      currentUserRank,
      totalParticipants: rankedUsers.length,
      page: safePage, totalPages, topUsers: rankedUsers.slice(0, 3), timezone,
    };
  }

  /**
   * Retrieves summary XP statistics for a single user.
   */
  static async getUserXP(userId: string, timezone = DEFAULT_TIMEZONE) {
    const act = await StudyActivityModel.aggregate<{
      totalActiveSeconds: number;
      totalCompletedLessons: number;
      totalQuizAttempts: number;
      totalVocabReviews: number;
      totalXpEarned: number;
      dateKeys: string[];
    }>([
      { $match: { userId: new Types.ObjectId(userId), ...qualifyingStudyActivity } },
      {
        $group: {
          _id: '$userId',
          totalActiveSeconds: { $sum: '$activeStudySeconds' },
          totalCompletedLessons: { $sum: '$completedLessons' },
          totalQuizAttempts: { $sum: '$quizAttempts' },
          totalVocabReviews: { $sum: '$vocabReviews' },
          totalXpEarned: { $sum: '$xpEarned' },
          dateKeys: { $addToSet: '$dateKey' },
        },
      },
    ]);
    const summary = act[0];
    const [practice] = await PracticeAttemptModel.aggregate<{ xp: number; dateKeys: string[] }>([
      { $match: { userId: new Types.ObjectId(userId), status: 'submitted' } },
      { $group: { _id: null, xp: { $sum: '$rewardXp' }, dateKeys: { $addToSet: '$dateKey' } } },
    ]);
    const [practiceActivity] = await PracticeAttemptModel.aggregate<{ dateKeys: string[] }>([
      { $match: { userId: new Types.ObjectId(userId), ...qualifyingPracticeActivity } },
      { $group: { _id: null, dateKeys: { $addToSet: '$dateKey' } } },
    ]);
    const streak = summarizeStreak([...(summary?.dateKeys ?? []), ...(practiceActivity?.dateKeys ?? [])], new Date(), timezone);
    const [user, progress] = await Promise.all([
      UserModel.findById(userId).select('totalXP').lean(),
      ProgressModel.aggregate<ProgressTotals>([
        { $match: { userId: new Types.ObjectId(userId), completed: true } },
        { $group: { _id: '$userId', completedCount: { $sum: 1 }, studySeconds: { $sum: '$activeStudySeconds' } } },
      ]),
    ]);

    return {
      ...summarizeXP(summary, progress[0], streak.activeDays, user?.totalXP ?? 0, practice?.xp ?? 0),
      streakDays: streak.streakCount,
    };
  }
}
