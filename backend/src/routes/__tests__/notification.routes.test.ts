import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock NotificationService trước khi import app
const notificationServiceMock = {
  getUserNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAllAsRead: vi.fn(),
  markAsRead: vi.fn(),
  deleteNotification: vi.fn(),
  notifyAdmins: vi.fn(),
  notifyLearnersByHsk: vi.fn(),
};

vi.mock('../../services/notification.service.js', () => ({
  NotificationService: notificationServiceMock,
}));

const { authState, requireAuthMock, requireAdminMock } = vi.hoisted(() => {
  const authState = { current: { userId: '', role: 'user' } };
  const requireAuthMock = vi.fn((req: any, _res: any, next: any) => {
    req.auth = req.auth || { ...authState.current };
    next();
  });
  const requireAdminMock = vi.fn((req: any, res: any, next: any) => {
    const role = req.auth?.role || authState.current.role;
    if (role !== 'admin') {
      return res.status(403).json({ success: false, error: { code: 'ADMIN_REQUIRED', message: 'Admin required' } });
    }
    next();
  });
  return { authState, requireAuthMock, requireAdminMock };
});

vi.mock('../../middleware/auth.js', () => ({
  requireAuth: requireAuthMock,
  requireAdmin: requireAdminMock,
}));

import request from 'supertest';
import type { Express } from 'express';
import { Types } from 'mongoose';

let app: Express;

const USER_A = new Types.ObjectId().toString();
const USER_B = new Types.ObjectId().toString();
const ADMIN_A = new Types.ObjectId().toString();

beforeEach(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'b'.repeat(32);
  ({ app } = await import('../../app.js'));
  for (const fn of Object.values(notificationServiceMock)) {
    (fn as { mockReset?: () => void }).mockReset?.();
  }
});

afterEach(() => vi.restoreAllMocks());

const asUser = (userId: string, role = 'user') =>
  (req: { auth: { userId: string; role: string } }, _res: unknown, next: () => void) => {
    req.auth = { userId, role };
    next();
  };

describe('GET /api/v1/notifications', () => {
  it('returns user-scoped paginated list', async () => {
    notificationServiceMock.getUserNotifications.mockResolvedValue({
      items: [{ _id: 'n1' }],
      total: 1,
      unreadCount: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    requireAuthMock.mockImplementationOnce((req: any, _res: any, next: any) => {
      req.auth = { userId: USER_A, role: 'user' };
      next();
    });
    const res = await request(app)
      .get('/api/v1/notifications?filter=unread&page=2&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toBeDefined();
  });
});

describe('GET /api/v1/notifications/unread-count', () => {
  it('returns unread count for current user', async () => {
    notificationServiceMock.getUnreadCount.mockResolvedValue(7);

    // Override requireAuth mock for this test only — inject USER_A
    const { requireAuth } = await import('../../middleware/auth.js');
    vi.mocked(requireAuth).mockImplementationOnce(
      (asUser(USER_A) as unknown) as never,
    );

    const res = await request(app).get('/api/v1/notifications/unread-count');
    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBe(7);
    expect(notificationServiceMock.getUnreadCount).toHaveBeenCalledWith(USER_A);
  });
});

describe('PATCH /api/v1/notifications/mark-all-read', () => {
  it('returns updatedCount from service', async () => {
    notificationServiceMock.markAllAsRead.mockResolvedValue({ updatedCount: 5 });

    const { requireAuth } = await import('../../middleware/auth.js');
    vi.mocked(requireAuth).mockImplementationOnce(
      (asUser(USER_A) as unknown) as never,
    );

    const res = await request(app).patch('/api/v1/notifications/mark-all-read');
    expect(res.status).toBe(200);
    expect(res.body.data.updatedCount).toBe(5);
  });
});

describe('PATCH /api/v1/notifications/:id/read', () => {
  it('marks a notification as read', async () => {
    const notifId = new Types.ObjectId().toString();
    notificationServiceMock.markAsRead.mockResolvedValue({ _id: notifId, isRead: true });

    const { requireAuth } = await import('../../middleware/auth.js');
    vi.mocked(requireAuth).mockImplementationOnce(
      (asUser(USER_A) as unknown) as never,
    );

    const res = await request(app)
      .patch(`/api/v1/notifications/${notifId}/read`)
      .send({ isRead: true });
    expect(res.status).toBe(200);
    expect(notificationServiceMock.markAsRead).toHaveBeenCalledWith(
      USER_A,
      notifId,
      true,
    );
  });

  it('returns 404 when service returns null (cross-user access)', async () => {
    const notifId = new Types.ObjectId().toString();
    notificationServiceMock.markAsRead.mockResolvedValue(null);

    const { requireAuth } = await import('../../middleware/auth.js');
    vi.mocked(requireAuth).mockImplementationOnce(
      (asUser(USER_A) as unknown) as never,
    );

    const res = await request(app)
      .patch(`/api/v1/notifications/${notifId}/read`)
      .send({});
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects invalid ObjectId gracefully (returns 422 from validation)', async () => {
    notificationServiceMock.markAsRead.mockResolvedValue(null);

    const { requireAuth } = await import('../../middleware/auth.js');
    vi.mocked(requireAuth).mockImplementationOnce(
      (asUser(USER_A) as unknown) as never,
    );

    const res = await request(app).patch('/api/v1/notifications/not-a-real-id/read');
    // Express path param validation rejects non-ObjectId → 422.
    expect(res.status).toBe(422);
  });
});

describe('DELETE /api/v1/notifications/:id', () => {
  it('removes notification when owned by user', async () => {
    const notifId = new Types.ObjectId().toString();
    notificationServiceMock.deleteNotification.mockResolvedValue(true);

    const { requireAuth } = await import('../../middleware/auth.js');
    vi.mocked(requireAuth).mockImplementationOnce(
      (asUser(USER_A) as unknown) as never,
    );

    const res = await request(app).delete(`/api/v1/notifications/${notifId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
  });

  it('returns 404 when service returns false (cross-user delete)', async () => {
    const notifId = new Types.ObjectId().toString();
    notificationServiceMock.deleteNotification.mockResolvedValue(false);

    const { requireAuth } = await import('../../middleware/auth.js');
    vi.mocked(requireAuth).mockImplementationOnce(
      (asUser(USER_A) as unknown) as never,
    );

    const res = await request(app).delete(`/api/v1/notifications/${notifId}`);
    expect(res.status).toBe(404);
  });

  it('rejects invalid ObjectId (service returns false → 404)', async () => {
    const { requireAuth } = await import('../../middleware/auth.js');
    vi.mocked(requireAuth).mockImplementationOnce(
      (asUser(USER_A) as unknown) as never,
    );

    const res = await request(app).delete('/api/v1/notifications/bad-id');
    // DELETE không validate ObjectId trên path params → service trả false → 404
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/notifications/broadcast', () => {
  const validBody = {
    target: 'admins',
    title: { vi: 'Thông báo test' },
    message: { vi: 'Nội dung test' },
  };

  it('returns 403 for non-admin users', async () => {
    const { requireAuth } = await import('../../middleware/auth.js');
    vi.mocked(requireAuth).mockImplementationOnce(
      (asUser(USER_A, 'user') as unknown) as never,
    );

    const res = await request(app)
      .post('/api/v1/notifications/broadcast')
      .send(validBody);
    expect(res.status).toBe(403);
  });

  it('sends broadcast to all admins when target=admins', async () => {
    notificationServiceMock.notifyAdmins.mockResolvedValue([
      { _id: '1' },
      { _id: '2' },
    ]);

    const { requireAuth } = await import('../../middleware/auth.js');
    vi.mocked(requireAuth).mockImplementationOnce(
      (asUser(ADMIN_A, 'admin') as unknown) as never,
    );

    const res = await request(app)
      .post('/api/v1/notifications/broadcast')
      .send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.data.sentCount).toBe(2);
    expect(notificationServiceMock.notifyAdmins).toHaveBeenCalled();
  });

  it('sends broadcast to HSK learners when target=hsk', async () => {
    notificationServiceMock.notifyLearnersByHsk.mockResolvedValue([
      { _id: '1' },
      { _id: '2' },
      { _id: '3' },
    ]);

    const { requireAuth } = await import('../../middleware/auth.js');
    vi.mocked(requireAuth).mockImplementationOnce(
      (asUser(ADMIN_A, 'admin') as unknown) as never,
    );

    const res = await request(app)
      .post('/api/v1/notifications/broadcast')
      .send({ ...validBody, target: 'hsk', hskLevel: 3 });
    expect(res.status).toBe(201);
    expect(res.body.data.sentCount).toBe(3);
    expect(notificationServiceMock.notifyLearnersByHsk).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ type: 'system' }),
    );
  });

  // SECURITY: actionUrl phải là relative path, không phải absolute URL
  // (chống admin compromised gửi phishing link).
  it('rejects absolute actionUrl (security: phishing protection)', async () => {
    const { requireAuth } = await import('../../middleware/auth.js');
    vi.mocked(requireAuth).mockImplementationOnce(
      (asUser(ADMIN_A, 'admin') as unknown) as never,
    );

    const res = await request(app)
      .post('/api/v1/notifications/broadcast')
      .send({ ...validBody, actionUrl: 'https://evil.com/phishing' });
    expect(res.status).toBe(422);
  });

  it('rejects protocol-relative actionUrl (//evil.com)', async () => {
    const { requireAuth } = await import('../../middleware/auth.js');
    vi.mocked(requireAuth).mockImplementationOnce(
      (asUser(ADMIN_A, 'admin') as unknown) as never,
    );

    const res = await request(app)
      .post('/api/v1/notifications/broadcast')
      .send({ ...validBody, actionUrl: '//evil.com' });
    expect(res.status).toBe(422);
  });

  it('accepts relative actionUrl starting with /', async () => {
    notificationServiceMock.notifyAdmins.mockResolvedValue([{ _id: '1' }]);

    const { requireAuth } = await import('../../middleware/auth.js');
    vi.mocked(requireAuth).mockImplementationOnce(
      (asUser(ADMIN_A, 'admin') as unknown) as never,
    );

    const res = await request(app)
      .post('/api/v1/notifications/broadcast')
      .send({ ...validBody, actionUrl: '/lessons/hsk-3' });
    expect(res.status).toBe(201);
  });

  it('rejects hskLevel out of range', async () => {
    const { requireAuth } = await import('../../middleware/auth.js');
    vi.mocked(requireAuth).mockImplementationOnce(
      (asUser(ADMIN_A, 'admin') as unknown) as never,
    );

    const res = await request(app)
      .post('/api/v1/notifications/broadcast')
      .send({ ...validBody, target: 'hsk', hskLevel: 99 });
    expect(res.status).toBe(422);
  });
});

describe('Authorization isolation (IDOR protection)', () => {
  it('user B cannot delete user A notification', async () => {
    const notifId = new Types.ObjectId().toString();
    // Service returns false because findOne query { _id, userId: USER_B } fails
    notificationServiceMock.deleteNotification.mockImplementation(
      (userId: string) => {
        expect(userId).toBe(USER_B);
        return Promise.resolve(false);
      },
    );

    const { requireAuth } = await import('../../middleware/auth.js');
    vi.mocked(requireAuth).mockImplementationOnce(
      (asUser(USER_B) as unknown) as never,
    );

    const res = await request(app).delete(`/api/v1/notifications/${notifId}`);
    expect(res.status).toBe(404);
  });

  it("markAllAsRead only updates caller's notifications", async () => {
    notificationServiceMock.markAllAsRead.mockImplementation((userId: string) => {
      expect(userId).toBe(USER_A);
      return Promise.resolve({ updatedCount: 3 });
    });

    const { requireAuth } = await import('../../middleware/auth.js');
    vi.mocked(requireAuth).mockImplementationOnce(
      (asUser(USER_A) as unknown) as never,
    );

    const res = await request(app).patch('/api/v1/notifications/mark-all-read');
    expect(res.status).toBe(200);
  });
});
