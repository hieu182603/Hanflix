import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';

const { userModelMock, studyActivityModelMock, progressModelMock } = vi.hoisted(() => {
  return {
    userModelMock: {
      find: vi.fn(),
    },
    studyActivityModelMock: {
      aggregate: vi.fn(),
    },
    progressModelMock: {
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

import { LeaderboardService } from '../leaderboard.service.js';

describe('LeaderboardService.getLeaderboard', () => {
  const userA = new Types.ObjectId();
  const userB = new Types.ObjectId();

  beforeEach(() => {
    userModelMock.find.mockReset();
    studyActivityModelMock.aggregate.mockReset();
    progressModelMock.aggregate.mockReset();
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

    const xpStats = await LeaderboardService.getUserXP(userA.toString());
    expect(xpStats).toBeDefined();
    expect(xpStats.completedLessons).toBe(3);
    expect(xpStats.quizAttempts).toBe(2);
    expect(xpStats.vocabReviews).toBe(10);
    expect(xpStats.minutesStudied).toBe(30);
    expect(xpStats.totalXP).toBeGreaterThanOrEqual(310);
  });
});
