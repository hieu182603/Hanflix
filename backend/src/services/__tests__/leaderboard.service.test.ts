import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';

const { userModelMock, studyActivityModelMock, progressModelMock, practiceAttemptModelMock } = vi.hoisted(() => {
  return {
    userModelMock: {
      find: vi.fn(),
      findById: vi.fn(),
    },
    studyActivityModelMock: {
      aggregate: vi.fn(),
    },
    progressModelMock: {
      aggregate: vi.fn(),
    },
    practiceAttemptModelMock: {
      aggregate: vi.fn(),
    },
  };
});

vi.mock('../../models/user.model.js', () => ({
  UserModel: userModelMock,
}));

vi.mock('../../models/study-activity.model.js', () => ({
  StudyActivityModel: studyActivityModelMock,
}));

vi.mock('../../models/progress.model.js', () => ({
  ProgressModel: progressModelMock,
}));
vi.mock('../../models/practice.model.js', () => ({
  PracticeAttemptModel: practiceAttemptModelMock,
}));

import { LeaderboardService } from '../leaderboard.service.js';
import { toTimezoneDateKey } from '../study-activity.js';

describe('LeaderboardService.getLeaderboard', () => {
  const userA = new Types.ObjectId();
  const userB = new Types.ObjectId();

  beforeEach(() => {
    userModelMock.find.mockReset();
    userModelMock.findById.mockReturnValue({ select: () => ({ lean: async () => null }) });
    studyActivityModelMock.aggregate.mockReset();
    progressModelMock.aggregate.mockReset();
    progressModelMock.aggregate.mockResolvedValue([]);
    practiceAttemptModelMock.aggregate.mockReset();
    practiceAttemptModelMock.aggregate.mockResolvedValue([]);
  });

  it('calculates ranks and highlights current user', async () => {
    userModelMock.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: userA, name: 'Nguyễn Văn A', avatarUrl: 'https://a.png', learningProfile: { currentHsk: 3 } },
          { _id: userB, name: 'Trần Thị B', avatarUrl: 'https://b.png', learningProfile: { currentHsk: 4 } },
        ]),
      }),
    });

    studyActivityModelMock.aggregate.mockResolvedValue([
      {
        _id: userA,
        totalActiveSeconds: 1200, // 20 mins * 2 = 40 XP
        totalCompletedLessons: 2, // 2 * 50 = 100 XP
        totalQuizAttempts: 1, // 1 * 25 = 25 XP
        dateKeys: ['2026-09-18', '2026-09-19'],
      },
      {
        _id: userB,
        totalActiveSeconds: 6000, // 100 mins * 2 = 200 XP
        totalCompletedLessons: 5, // 5 * 50 = 250 XP
        totalQuizAttempts: 4, // 4 * 25 = 100 XP
        dateKeys: ['2026-09-19'],
      },
    ]);

    progressModelMock.aggregate.mockResolvedValue([]);

    const result = await LeaderboardService.getLeaderboard({
      period: 'week',
      currentUserId: userA.toString(),
      limit: 10,
    });

    expect(result.period).toBe('week');
    expect(result.items.length).toBe(2);

    // userB has more XP than userA -> userB is rank 1, userA is rank 2
    expect(result.items[0].id).toBe(userB.toString());
    expect(result.items[0].rank).toBe(1);
    expect(result.items[0].isMe).toBe(false);

    expect(result.items[1].id).toBe(userA.toString());
    expect(result.items[1].rank).toBe(2);
    expect(result.items[1].isMe).toBe(true);

    expect(result.currentUserRank).toBeDefined();
    expect(result.currentUserRank?.rank).toBe(2);
    expect(result.currentUserRank?.isMe).toBe(true);
    expect(userModelMock.find).toHaveBeenCalledWith({ status: 'active', role: 'user' });
    expect(result.items.every(item => item.trend === 'same' && item.trendValue === undefined)).toBe(true);
  });

  it('calculates getUserXP accurately for a single user', async () => {
    studyActivityModelMock.aggregate.mockResolvedValue([
      {
        _id: userA,
        totalActiveSeconds: 1800, // 30 mins * 2 = 60 XP
        totalCompletedLessons: 3, // 3 * 50 = 150 XP
        totalQuizAttempts: 2, // 2 * 25 = 50 XP
        totalVocabReviews: 10, // 10 * 5 = 50 XP
        totalXpEarned: 310,
        dateKeys: ['2026-09-19'],
      },
    ]);
    practiceAttemptModelMock.aggregate.mockResolvedValue([{
      xp: 25,
      dateKeys: [toTimezoneDateKey(new Date())],
    }]);

    const xpStats = await LeaderboardService.getUserXP(userA.toString());
    expect(xpStats).toBeDefined();
    expect(xpStats.completedLessons).toBe(3);
    expect(xpStats.quizAttempts).toBe(2);
    expect(xpStats.vocabReviews).toBe(10);
    expect(xpStats.minutesStudied).toBe(30);
    // Daily bonuses remain earned even when an older streak has ended.
    expect(xpStats.totalXP).toBe(355);
    expect(xpStats.streakDays).toBeGreaterThanOrEqual(1);
  });

  it.each([
    { legacy: 500, progress: undefined, activity: undefined, reward: 0, expected: 500 },
    { legacy: 500, progress: undefined, activity: undefined, reward: 25, expected: 525 },
    { legacy: 0, progress: { completedCount: 2, studySeconds: 600 }, activity: undefined, reward: 0, expected: 120 },
    { legacy: 50, progress: { completedCount: 2, studySeconds: 600 }, activity: { totalActiveSeconds: 120, totalCompletedLessons: 1, totalXpEarned: 50 }, reward: 25, expected: 139 },
  ])('keeps dashboard and all-time leaderboard consistent: $expected XP', async ({ legacy, progress, activity, reward, expected }) => {
    const user = { _id: userA, name: 'A', totalXP: legacy };
    userModelMock.find.mockReturnValue({ select: () => ({ lean: async () => [user] }) });
    userModelMock.findById.mockReturnValue({ select: () => ({ lean: async () => user }) });
    studyActivityModelMock.aggregate.mockResolvedValue(activity ? [{ _id: userA, dateKeys: [], ...activity }] : []);
    progressModelMock.aggregate.mockResolvedValue(progress ? [{ _id: userA, ...progress }] : []);
    practiceAttemptModelMock.aggregate.mockResolvedValue(reward ? [{ _id: userA, xp: reward, dateKeys: [toTimezoneDateKey(new Date())] }] : []);
    const board = await LeaderboardService.getLeaderboard({ period: 'all', currentUserId: String(userA) });
    const dashboard = await LeaderboardService.getUserXP(String(userA));
    expect(board.currentUserRank?.xp).toBe(expected);
    expect(dashboard.totalXP).toBe(expected);
    expect(progressModelMock.aggregate.mock.calls.at(-1)?.[0][0].$match).toEqual({ userId: userA, completed: true });
  });

  it('does not carry legacy all-time XP or progress into weekly scores', async () => {
    userModelMock.find.mockReturnValue({ select: () => ({ lean: async () => [{ _id: userA, name: 'A', totalXP: 500 }] }) });
    studyActivityModelMock.aggregate.mockResolvedValue([]);
    progressModelMock.aggregate.mockResolvedValue([{ _id: userA, completedCount: 10, studySeconds: 600 }]);
    const result = await LeaderboardService.getLeaderboard({ period: 'week', currentUserId: String(userA) });
    expect(result.currentUserRank?.xp).toBe(0);
  });
});
