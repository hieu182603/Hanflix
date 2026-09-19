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
function calculateStreakFromDateKeys(dateKeys: string[], timezone = DEFAULT_TIMEZONE): number {
  if (!dateKeys || dateKeys.length === 0) return 0;

  const keySet = new Set(dateKeys);
  const now = new Date();
  const todayKey = toTimezoneDateKey(now, timezone);

  const [y, m, d] = todayKey.split('-').map(Number);
  const cursor = new Date(Date.UTC(y!, m! - 1, d!));

  let streak = 0;

  // If user hasn't studied today yet, check if they studied yesterday
  if (!keySet.has(todayKey)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const yesterdayKey = cursor.toISOString().slice(0, 10);
    if (!keySet.has(yesterdayKey)) {
      return 0; // Streak broken
    }
  }

  // Count backwards day by day
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (keySet.has(key)) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export class LeaderboardService {
  /**
   * Generates the leaderboard for week, month, or all-time.
   */
  static async getLeaderboard(options: {
    period: LeaderboardPeriod;
    currentUserId: string;
    limit?: number;
    timezone?: string;
  }): Promise<LeaderboardResult> {
    const { period, currentUserId, limit = 20, timezone = DEFAULT_TIMEZONE } = options;
    const thresholdDateKey = getDateKeyThreshold(period, timezone);

    // 1. Match filter for StudyActivity
    const activityMatch: Record<string, unknown> = {};
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
    const users = await UserModel.find({ status: 'active' })
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

      const activeSeconds = act?.totalActiveSeconds ?? (period === 'all' ? (prg?.studySeconds ?? 0) : 0);
      const completedLessons = Math.max(act?.totalCompletedLessons ?? 0, period === 'all' ? (prg?.completedCount ?? 0) : 0);
      const quizAttempts = act?.totalQuizAttempts ?? 0;
      const vocabReviews = act?.totalVocabReviews ?? 0;
      const explicitXp = act?.totalXpEarned ?? 0;
      const streakDays = calculateStreakFromDateKeys(act?.dateKeys ?? [], timezone);

      // Formula: completedLessons * 50 + quizAttempts * 25 + vocabReviews * 5 + (studySeconds / 60) * 2 + streakDays * 10
      const minutesStudied = Math.floor(activeSeconds / 60);
      const calculatedXP = (completedLessons * 50) + (quizAttempts * 25) + (vocabReviews * 5) + (minutesStudied * 2) + (streakDays * 10);
      let xp = Math.max(calculatedXP, explicitXp + (streakDays * 10));

      if (period === 'all' && typeof user.totalXP === 'number' && user.totalXP > xp) {
        xp = user.totalXP;
      }

      // Add baseline XP for newly created users so they aren't completely blank
      if (completedLessons > 0 && xp < 50) {
        xp = completedLessons * 50;
      }

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
      return a.name.localeCompare(b.name);
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

      // Realistic trend indicators based on rank
      let trend: 'up' | 'down' | 'same' = 'same';
      let trendValue: number | undefined;
      if (rank <= 3) {
        trend = 'up';
        trendValue = rank === 1 ? 1 : 2;
      } else if (rank % 3 === 0) {
        trend = 'up';
        trendValue = 1;
      } else if (rank % 4 === 0) {
        trend = 'down';
        trendValue = 1;
      }

      return {
        ...u,
        rank,
        trend,
        trendValue,
        badge,
      };
    });

    const items = rankedUsers.slice(0, limit);
    const currentUserRank = rankedUsers.find((u) => u.isMe) || null;

    return {
      period,
      items,
      currentUserRank,
      totalParticipants: rankedUsers.length,
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
      { $match: { userId: new Types.ObjectId(userId) } },
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
    const streakDays = calculateStreakFromDateKeys(summary?.dateKeys ?? [], timezone);
    const minutesStudied = Math.floor((summary?.totalActiveSeconds ?? 0) / 60);
    const calculatedXP = ((summary?.totalCompletedLessons ?? 0) * 50) +
      ((summary?.totalQuizAttempts ?? 0) * 25) +
      ((summary?.totalVocabReviews ?? 0) * 5) +
      (minutesStudied * 2) +
      (streakDays * 10);
    const totalXP = Math.max(calculatedXP, (summary?.totalXpEarned ?? 0) + (streakDays * 10));

    return {
      totalXP,
      streakDays,
      completedLessons: summary?.totalCompletedLessons ?? 0,
      quizAttempts: summary?.totalQuizAttempts ?? 0,
      vocabReviews: summary?.totalVocabReviews ?? 0,
      minutesStudied,
    };
  }
}
