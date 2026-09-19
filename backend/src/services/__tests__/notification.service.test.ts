import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';

// vi.mock hoisted → tất cả constant phải trong vi.hoisted() block.
const { userModelMock, notificationModelMock } = vi.hoisted(() => ({
  userModelMock: {
    findById: vi.fn(),
    find: vi.fn(),
  },
  notificationModelMock: {
    countDocuments: vi.fn(),
    insertMany: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateMany: vi.fn(),
    deleteOne: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock('../../models/notification.model.js', () => ({
  NotificationModel: notificationModelMock,
}));

vi.mock('../../models/user.model.js', () => ({
  UserModel: userModelMock,
}));

import { NotificationService } from '../notification.service.js';

const USER_ID = new Types.ObjectId();

/**
 * Mongoose chainable mock. Trả một object có các chainable method trả về
 * chính nó, và `lean()` resolve `data`. `then` để await được trực tiếp.
 *
 * Cursor: trả một iterator-friendly object thay vì Promise. Caller dùng
 * `for await (const x of query.cursor()) {...}`.
 */
const makeQueryMock = (data: unknown = []) => {
  const query: Record<string, unknown> = {};
  query.sort = vi.fn().mockReturnValue(query);
  query.skip = vi.fn().mockReturnValue(query);
  query.limit = vi.fn().mockReturnValue(query);
  query.select = vi.fn().mockReturnValue(query);
  query.lean = vi.fn().mockResolvedValue(data);
  query.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(data).then(resolve, reject);
  return query;
};

const makeCursorMock = (items: Array<unknown>) => {
  return {
    cursor: () => ({
      [Symbol.asyncIterator]: async function* () {
        for (const item of items) yield item;
      },
    }),
  };
};

beforeEach(() => {
  for (const fn of Object.values(notificationModelMock)) {
    (fn as { mockReset: () => void }).mockReset();
  }
  for (const fn of Object.values(userModelMock)) {
    (fn as { mockReset: () => void }).mockReset();
  }

  // Defaults
  notificationModelMock.find.mockReturnValue(makeQueryMock([]));
  notificationModelMock.countDocuments.mockResolvedValue(0);
  notificationModelMock.insertMany.mockImplementation((docs: unknown) =>
    Promise.resolve(docs),
  );
  notificationModelMock.create.mockResolvedValue({ _id: 'n1' });
  userModelMock.findById.mockReturnValue(
    makeQueryMock({ learningProfile: { currentHsk: 3 } }),
  );
  userModelMock.find.mockReturnValue(makeQueryMock([]));
});

describe('NotificationService.createNotification', () => {
  it('defaults category=system for video_pipeline / system types', async () => {
    await NotificationService.createNotification({
      userId: USER_ID,
      type: 'video_pipeline',
      title: { vi: 't' },
      message: { vi: 'm' },
    });
    expect(notificationModelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'system' }),
    );
  });

  it('defaults category=study for streak / lesson / quiz / vocab', async () => {
    await NotificationService.createNotification({
      userId: USER_ID,
      type: 'streak',
      title: { vi: 't' },
      message: { vi: 'm' },
    });
    expect(notificationModelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'study' }),
    );
  });

  it('falls back en/zh to vi when not provided', async () => {
    await NotificationService.createNotification({
      userId: USER_ID,
      type: 'lesson',
      title: { vi: 'tiếng Việt' },
      message: { vi: 'thông báo' },
    });
    const arg = notificationModelMock.create.mock.calls[0][0] as {
      title: { vi: string; en: string; zh: string };
      message: { vi: string; en: string; zh: string };
    };
    expect(arg.title.en).toBe('tiếng Việt');
    expect(arg.title.zh).toBe('tiếng Việt');
    expect(arg.message.en).toBe('thông báo');
    expect(arg.message.zh).toBe('thông báo');
  });
});

describe('NotificationService.ensureWelcomeNotifications (regression #1)', () => {
  it('uses user.learningProfile.currentHsk for lesson welcome', async () => {
    notificationModelMock.countDocuments.mockResolvedValue(0);
    userModelMock.findById.mockReturnValue(
      makeQueryMock({ learningProfile: { currentHsk: 1 } }),
    );

    await NotificationService.getUserNotifications(USER_ID.toString());

    const inserted = notificationModelMock.insertMany.mock.calls[0][0] as Array<{
      type: string;
      title: { vi: string };
    }>;
    const lessonTitle = inserted[1].title.vi;
    expect(lessonTitle).toContain('HSK 1');
    expect(lessonTitle).not.toContain('HSK 3');
  });

  it('falls back to HSK 3 when user has no currentHsk', async () => {
    notificationModelMock.countDocuments.mockResolvedValue(0);
    userModelMock.findById.mockReturnValue(
      makeQueryMock({ learningProfile: {} }),
    );

    await NotificationService.getUserNotifications(USER_ID.toString());

    const inserted = notificationModelMock.insertMany.mock.calls[0][0] as Array<{
      title: { vi: string };
    }>;
    expect(inserted[1].title.vi).toContain('HSK 3');
  });

  it('handles null learningProfile', async () => {
    notificationModelMock.countDocuments.mockResolvedValue(0);
    userModelMock.findById.mockReturnValue(makeQueryMock({ learningProfile: null }));

    await NotificationService.getUserNotifications(USER_ID.toString());

    const inserted = notificationModelMock.insertMany.mock.calls[0][0] as Array<{
      title: { vi: string };
    }>;
    expect(inserted[1].title.vi).toContain('HSK 3');
  });

  it('is idempotent: skips when user already has notifications', async () => {
    notificationModelMock.countDocuments.mockResolvedValue(5);

    await NotificationService.getUserNotifications(USER_ID.toString());

    expect(notificationModelMock.insertMany).not.toHaveBeenCalled();
  });

  it('sets expiresAt on welcome notifications (TTL, regression #5)', async () => {
    notificationModelMock.countDocuments.mockResolvedValue(0);
    userModelMock.findById.mockReturnValue(
      makeQueryMock({ learningProfile: { currentHsk: 2 } }),
    );

    const before = Date.now();
    await NotificationService.getUserNotifications(USER_ID.toString());
    const after = Date.now();

    const inserted = notificationModelMock.insertMany.mock.calls[0][0] as Array<{
      expiresAt: Date;
    }>;
    for (const n of inserted) {
      expect(n.expiresAt).toBeInstanceOf(Date);
      const expectedMin = before + 30 * 24 * 60 * 60 * 1000;
      const expectedMax = after + 30 * 24 * 60 * 60 * 1000;
      expect(n.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(n.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
    }
  });
});

describe('NotificationService.notifyLearnersByHsk (regression #2)', () => {
  it('matches by both currentHsk and targetHsk', async () => {
    userModelMock.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnValue({
        cursor: () => ({
          [Symbol.asyncIterator]: async function* () {
            // empty
          },
        }),
      }),
    } as never);

    await NotificationService.notifyLearnersByHsk(4, {
      type: 'lesson',
      title: { vi: 'test' },
      message: { vi: 'msg' },
    });

    const query = userModelMock.find.mock.calls[0][0] as Record<string, unknown>;
    expect(query.$or).toEqual([
      { 'learningProfile.currentHsk': 4 },
      { 'learningProfile.targetHsk': 4 },
    ]);
  });

  it('handles >100 learners without artificial limit', async () => {
    const fakeUsers = Array.from({ length: 250 }, () => ({
      _id: new Types.ObjectId(),
    }));
    userModelMock.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnValue(makeCursorMock(fakeUsers)),
    } as never);

    const result = await NotificationService.notifyLearnersByHsk(3, {
      type: 'lesson',
      title: { vi: 'test' },
      message: { vi: 'msg' },
    });

    expect(result.length).toBe(250);
    expect(notificationModelMock.insertMany.mock.calls.length).toBe(1);
    expect(notificationModelMock.insertMany.mock.calls[0][0].length).toBe(250);
  });

  it('splits into multiple batches when >500', async () => {
    const fakeUsers = Array.from({ length: 1200 }, () => ({
      _id: new Types.ObjectId(),
    }));
    userModelMock.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnValue(makeCursorMock(fakeUsers)),
    } as never);

    const result = await NotificationService.notifyLearnersByHsk(3, {
      type: 'lesson',
      title: { vi: 'test' },
      message: { vi: 'msg' },
    });

    expect(result.length).toBe(1200);
    // 1200 / 500 → 3 batches (500, 500, 200)
    expect(notificationModelMock.insertMany.mock.calls.length).toBe(3);
    expect(notificationModelMock.insertMany.mock.calls[0][0].length).toBe(500);
    expect(notificationModelMock.insertMany.mock.calls[1][0].length).toBe(500);
    expect(notificationModelMock.insertMany.mock.calls[2][0].length).toBe(200);
  });
});

describe('NotificationService.markAsRead', () => {
  it('returns null for invalid ObjectId', async () => {
    const result = await NotificationService.markAsRead(
      USER_ID.toString(),
      'not-an-id',
    );
    expect(result).toBeNull();
  });

  it('scopes query to userId (IDOR protection)', async () => {
    notificationModelMock.findOneAndUpdate.mockReturnValue({
      lean: async () => ({ _id: 'n1', isRead: true }),
    });

    await NotificationService.markAsRead(
      USER_ID.toString(),
      new Types.ObjectId().toString(),
      true,
    );

    expect(notificationModelMock.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: expect.any(Types.ObjectId) }),
      expect.objectContaining({ $set: { isRead: true } }),
      expect.any(Object),
    );
  });
});

describe('NotificationService.deleteNotification', () => {
  it('returns false for invalid ObjectId', async () => {
    const result = await NotificationService.deleteNotification(
      USER_ID.toString(),
      'bad-id',
    );
    expect(result).toBe(false);
  });

  it('scopes delete to userId', async () => {
    notificationModelMock.deleteOne.mockResolvedValue({ deletedCount: 1 });

    await NotificationService.deleteNotification(
      USER_ID.toString(),
      new Types.ObjectId().toString(),
    );

    expect(notificationModelMock.deleteOne).toHaveBeenCalledWith(
      expect.objectContaining({ userId: expect.any(Types.ObjectId) }),
    );
  });
});

describe('NotificationService.markAllAsRead', () => {
  it('returns updatedCount from updateMany result', async () => {
    notificationModelMock.updateMany.mockResolvedValue({ modifiedCount: 12 });

    const result = await NotificationService.markAllAsRead(USER_ID.toString());
    expect(result.updatedCount).toBe(12);
  });

  it('only updates unread notifications', async () => {
    notificationModelMock.updateMany.mockResolvedValue({ modifiedCount: 0 });

    await NotificationService.markAllAsRead(USER_ID.toString());

    const filter = notificationModelMock.updateMany.mock.calls[0][0] as Record<string, unknown>;
    expect(filter.isRead).toBe(false);
  });
});

describe('NotificationService.getUnreadCount', () => {
  it('returns count from countDocuments', async () => {
    notificationModelMock.countDocuments.mockResolvedValue(42);

    const count = await NotificationService.getUnreadCount(USER_ID.toString());
    expect(count).toBe(42);
    expect(notificationModelMock.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ isRead: false }),
    );
  });
});
