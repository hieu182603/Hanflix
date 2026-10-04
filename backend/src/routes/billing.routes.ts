import { Router } from 'express';
import { z } from 'zod';
import { Types, type QueryFilter, type InferSchemaType } from 'mongoose';
import { UserModel } from '../models/user.model.js';
import { activateUserPremium } from '../services/admin-premium.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { optionalAuth } from '../middleware/premium.js';
import { checkoutLimiter, paymentStatusLimiter } from '../middleware/rate-limits.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { PremiumPlanModel } from '../models/premium-plan.model.js';
import { PaymentOrderModel } from '../models/payment-order.model.js';
import { AppError } from '../errors/app-error.js';
import { createCheckout, handlePayOSWebhook, ownedOrder, publicOrder, reconcileOrder } from '../services/billing.js';
import { freeSampleIds, initializeBilling, PREMIUM_BENEFITS, presentPlan } from '../services/premium.js';
import { getPayOS, payosConfigured } from '../services/payos.js';
import { getCurrentSubscription, subscribePremium } from '../services/subscription.js';
import { markWelcomePopupSeen } from '../services/trial.service.js';

export const billingRoutes = Router();
export const adminBillingRoutes = Router();
const code = z.enum(['monthly', 'quarterly', 'yearly']);
const price = z.number().int().min(2000).max(50000000);
const orderParams = z.object({ orderCode: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER) });
const pagination = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
const orderSearch = pagination.extend({
  status: z.enum(['ALL', 'PAID', 'PENDING', 'OTHER']).default('ALL'),
  search: z.string().trim().max(100).default(''),
});
const pendingStatuses = ['CREATING', 'PENDING', 'PROCESSING'] as const;

billingRoutes.get('/plans', optionalAuth, asyncHandler(async (req, res) => {
  let plans = await PremiumPlanModel.find().sort({ durationMonths: 1 }).lean();
  if (!plans.length) {
    await initializeBilling();
    plans = await PremiumPlanModel.find().sort({ durationMonths: 1 }).lean();
  }
  const monthly = plans.find(plan => plan.code === 'monthly')?.price ?? 99000;
  res.json({ data: {
    title: 'Nâng cấp HanFlix Premium', subtitle: 'Học tiếng Trung trọn vẹn hơn qua mỗi câu chuyện.',
    description: 'Cả 3 gói đều mở khóa toàn bộ quyền lợi Premium, chỉ khác nhau về giá và thời hạn.',
    benefits: PREMIUM_BENEFITS, plans: plans.filter(plan => plan.active).map(plan => presentPlan(plan, monthly)),
    freeSampleLessonIds: await freeSampleIds(req.auth?.currentHsk ?? undefined), paymentAvailable: payosConfigured(),
  } });
}));

billingRoutes.post('/webhook', asyncHandler(async (req, res) => {
  await handlePayOSWebhook(req.body);
  res.json({ success: true });
}));

billingRoutes.use(requireAuth);
billingRoutes.get('/subscription', asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ data: await getCurrentSubscription(req.auth!.userId) });
}));

billingRoutes.post('/trial-welcome/seen', asyncHandler(async (req, res) => {
  await markWelcomePopupSeen(req.auth!.userId);
  res.json({ data: { success: true } });
}));

billingRoutes.post('/subscribe', checkoutLimiter, validate(z.object({ planCode: code, expectedPrice: price.optional() }).strict()), asyncHandler(async (req, res) => {
  const idempotencyKey = z.string().uuid().parse(req.header('Idempotency-Key'));
  res.setHeader('Cache-Control', 'no-store');
  res.json({ data: await subscribePremium(req.auth!.userId, { planCode: req.body.planCode, expectedPrice: req.body.expectedPrice, idempotencyKey }) });
}));

billingRoutes.post('/checkout', checkoutLimiter, validate(z.object({ planCode: code, expectedPrice: price }).strict()), asyncHandler(async (req, res) => {
  const idempotencyKey = z.string().uuid().parse(req.header('Idempotency-Key'));
  res.setHeader('Cache-Control', 'no-store');
  res.json({ data: await createCheckout(req.auth!.userId, { ...req.body, idempotencyKey }) });
}));

billingRoutes.get('/orders', validateQuery(orderSearch), asyncHandler(async (req, res) => {
  const { page, limit, status, search } = (req as unknown as { parsedQuery: z.infer<typeof orderSearch> }).parsedQuery;
  const owner = { userId: req.auth!.userId };
  const term = search.replace(/^#/, '').trim();
  const literal = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filter: QueryFilter<InferSchemaType<typeof PaymentOrderModel.schema>> = {
    ...owner,
    ...(status === 'PAID' ? { status: 'PAID' }
      : status === 'PENDING' ? { status: { $in: pendingStatuses } }
      : status === 'OTHER' ? { status: { $nin: ['PAID', ...pendingStatuses] } } : {}),
    ...(term ? { $or: [
      { planName: { $regex: literal, $options: 'i' } },
      { $expr: { $regexMatch: { input: { $toString: '$orderCode' }, regex: literal } } },
    ] } : {}),
  };
  const [items, total, summaries] = await Promise.all([
    PaymentOrderModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    PaymentOrderModel.countDocuments(filter),
    // Lifetime totals are scoped to this account, independent of search and page.
    PaymentOrderModel.aggregate([
      { $match: owner },
      { $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        paidOrders: { $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, 1, 0] } },
        pendingOrders: { $sum: { $cond: [{ $in: ['$status', pendingStatuses] }, 1, 0] } },
        totalSpent: { $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, '$amount', 0] } },
      } },
      { $project: { _id: 0, totalOrders: 1, paidOrders: 1, pendingOrders: 1, totalSpent: 1,
        otherOrders: { $subtract: ['$totalOrders', { $add: ['$paidOrders', '$pendingOrders'] }] } } },
    ]),
  ]);
  res.setHeader('Cache-Control', 'no-store');
  const summary = summaries[0] ?? { totalOrders: 0, paidOrders: 0, pendingOrders: 0, otherOrders: 0, totalSpent: 0 };
  res.json({ data: { items: items.map(publicOrder), page, limit, total, summary } });
}));

billingRoutes.get('/orders/:orderCode', paymentStatusLimiter, validate(orderParams, 'params'), asyncHandler(async (req, res) => {
  const order = await ownedOrder(req.auth!.userId, Number(req.params.orderCode));
  res.setHeader('Cache-Control', 'no-store');
  res.json({ data: publicOrder(await reconcileOrder(order)) });
}));

billingRoutes.post('/orders/:orderCode/cancel', paymentStatusLimiter, validate(orderParams, 'params'), asyncHandler(async (req, res) => {
  let order = await ownedOrder(req.auth!.userId, Number(req.params.orderCode));
  order = await reconcileOrder(order);
  if (['PENDING', 'UNDERPAID', 'PROCESSING'].includes(order.status)) {
    try { await getPayOS().paymentRequests.cancel(order.orderCode, 'Nguoi dung huy thanh toan'); }
    catch {
      // A payment may win the race with cancellation. Reconcile once more.
      order = await reconcileOrder(order);
      if (!['PAID', 'CANCELLED', 'EXPIRED'].includes(order.status)) throw new AppError(502, 'PAYOS_UNAVAILABLE', 'Chưa hủy được thanh toán. Vui lòng thử lại.');
    }
    order = await reconcileOrder(order);
  }
  res.json({ data: publicOrder(order) });
}));

adminBillingRoutes.use(requireAuth, requireAdmin);
const userParams = z.object({ userId: z.string().refine(Types.ObjectId.isValid, 'Mã người dùng không hợp lệ') });
adminBillingRoutes.post('/users/:userId/activate', validate(userParams, 'params'), validate(z.object({
  planCode: code, reason: z.string().trim().min(3).max(500),
}).strict()), asyncHandler(async (req, res) => {
  const idempotencyKey = z.string().uuid().parse(req.header('Idempotency-Key'));
  const result = await activateUserPremium(new Types.ObjectId(String(req.params.userId)), req.auth!.userId, { ...req.body, idempotencyKey });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ data: result });
}));
adminBillingRoutes.get('/users/:userId/grants', validate(userParams, 'params'), asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.params.userId).select('premiumExpiresAt +premiumReceipts').lean();
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng');
  res.setHeader('Cache-Control', 'no-store');
  res.json({ data: { premiumExpiresAt: user.premiumExpiresAt ?? null,
    items: (user.premiumReceipts ?? []).filter(receipt => receipt.grantId).slice(-20).reverse() } });
}));
adminBillingRoutes.get('/plans', asyncHandler(async (_req, res) => {
  let plans = await PremiumPlanModel.find().sort({ durationMonths: 1 }).lean();
  if (!plans.length) {
    await initializeBilling(true);
    plans = await PremiumPlanModel.find().sort({ durationMonths: 1 }).lean();
  }
  const monthly = plans.find(plan => plan.code === 'monthly')?.price ?? 99000;
  res.json({ data: { items: plans.map(plan => presentPlan(plan, monthly)), paymentAvailable: payosConfigured() } });
}));
adminBillingRoutes.post('/plans/reset-defaults', asyncHandler(async (_req, res) => {
  await initializeBilling(true);
  const plans = await PremiumPlanModel.find().sort({ durationMonths: 1 }).lean();
  const monthly = plans.find(plan => plan.code === 'monthly')?.price ?? 99000;
  res.json({ data: { items: plans.map(plan => presentPlan(plan, monthly)), paymentAvailable: payosConfigured() } });
}));
adminBillingRoutes.patch('/plans/:code', validate(z.object({ code }), 'params'), validate(z.object({
  price: price.optional(), name: z.string().trim().min(1).max(80).optional(), active: z.boolean().optional(),
  revision: z.number().int().positive(),
}).strict().refine(value => value.price !== undefined || value.name !== undefined || value.active !== undefined)), asyncHandler(async (req, res) => {
  const { revision, ...changes } = req.body;
  const plan = await PremiumPlanModel.findOneAndUpdate({ code: code.parse(req.params.code), revision }, {
    $set: { ...changes, updatedBy: req.auth!.userId }, $inc: { revision: 1 },
  }, { returnDocument: 'after', runValidators: true }).lean();
  if (!plan) throw new AppError(409, 'PLAN_CONFLICT', 'Gói đã thay đổi. Vui lòng tải lại trước khi lưu.');
  res.json({ data: plan });
}));
adminBillingRoutes.get('/orders', validateQuery(pagination), asyncHandler(async (req, res) => {
  const { page, limit } = (req as unknown as { parsedQuery: z.infer<typeof pagination> }).parsedQuery;
  const [items, total] = await Promise.all([
    PaymentOrderModel.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    PaymentOrderModel.countDocuments(),
  ]);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ data: { items: items.map(item => ({ ...publicOrder(item), userId: item.userId })), total, page, limit } });
}));
