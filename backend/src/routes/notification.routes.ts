import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { broadcastLimiter } from '../middleware/rate-limits.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { NotificationService } from '../services/notification.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../errors/app-error.js';

const router = Router();
router.use(requireAuth);

// SECURITY: actionUrl là URL mà user click để navigate. Có thể do admin
// broadcast (compromised admin có thể inject phishing URL) hoặc do system
// trigger. Validate rằng URL chỉ là relative path bắt đầu bằng `/` và
// KHÔNG phải protocol-relative (`//evil.com`), không có ký tự control.
const actionUrlSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine(
    (url) => url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\'),
    { message: 'actionUrl phải là relative path bắt đầu bằng /' },
  );

const listNotificationsQuerySchema = z.object({
  filter: z.enum(['all', 'unread', 'study', 'system']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const toggleReadBodySchema = z.object({
  isRead: z.boolean().optional(),
});

const broadcastBodySchema = z.object({
  target: z.enum(['all', 'hsk', 'admins']),
  hskLevel: z.coerce.number().int().min(1).max(6).optional(),
  type: z.enum(['streak', 'lesson', 'quiz', 'vocab', 'video_pipeline', 'system']).default('system'),
  title: z.object({
    vi: z.string().min(1),
    en: z.string().optional(),
    zh: z.string().optional(),
  }),
  message: z.object({
    vi: z.string().min(1),
    en: z.string().optional(),
    zh: z.string().optional(),
  }),
  actionUrl: actionUrlSchema.optional(),
  actionText: z.object({
    vi: z.string().min(1),
    en: z.string().optional(),
    zh: z.string().optional(),
  }).optional(),
});

// GET /api/v1/notifications
router.get('/', validateQuery(listNotificationsQuerySchema), asyncHandler(async (req, res) => {
  const query = (req as unknown as Record<string, unknown>).parsedQuery as z.infer<typeof listNotificationsQuerySchema>;
  const result = await NotificationService.getUserNotifications(
    req.auth!.userId,
    query.filter,
    query.page,
    query.limit,
  );
  res.json({ data: result });
}));

// GET /api/v1/notifications/unread-count
router.get('/unread-count', asyncHandler(async (req, res) => {
  const unreadCount = await NotificationService.getUnreadCount(req.auth!.userId);
  res.json({ data: { unreadCount } });
}));

// PATCH /api/v1/notifications/mark-all-read
router.patch('/mark-all-read', asyncHandler(async (req, res) => {
  const result = await NotificationService.markAllAsRead(req.auth!.userId);
  res.json({ data: result });
}));

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', validate(toggleReadBodySchema), asyncHandler(async (req, res) => {
  const body = req.body as z.infer<typeof toggleReadBodySchema>;
  const updated = await NotificationService.markAsRead(
    req.auth!.userId,
    String(req.params.id),
    body.isRead !== undefined ? body.isRead : true,
  );
  if (!updated) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thông báo');
  }
  res.json({ data: updated });
}));

// DELETE /api/v1/notifications/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const success = await NotificationService.deleteNotification(req.auth!.userId, String(req.params.id));
  if (!success) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thông báo cần xóa');
  }
  res.json({ data: { success: true } });
}));

// POST /api/v1/notifications/broadcast (Admin only)
router.post('/broadcast', requireAdmin, broadcastLimiter, validate(broadcastBodySchema), asyncHandler(async (req, res) => {
  const body = req.body as z.infer<typeof broadcastBodySchema>;
  let result;
  if (body.target === 'admins') {
    result = await NotificationService.notifyAdmins({
      type: body.type,
      title: body.title,
      message: body.message,
      actionUrl: body.actionUrl,
      actionText: body.actionText,
    });
  } else {
    result = await NotificationService.notifyLearnersByHsk(body.hskLevel || 0, {
      type: body.type,
      title: body.title,
      message: body.message,
      actionUrl: body.actionUrl,
      actionText: body.actionText,
    });
  }
  res.status(201).json({ data: { sentCount: Array.isArray(result) ? result.length : 0 } });
}));

export default router;
