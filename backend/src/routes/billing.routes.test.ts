import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Types } from 'mongoose';
import { billingRoutes, adminBillingRoutes } from './billing.routes.js';
import lessonRoutes from './lesson.routes.js';
import learningRoutes from './learning.routes.js';
import aiRoutes from './ai.routes.js';
import { grammarService } from '../services/grammar.service.js';
import grammarRoutes from './grammar.routes.js';
import vocabularyRoutes from './vocabulary.routes.js';
import practiceRoutes from './practice.routes.js';
import { errorHandler } from '../middleware/error-handler.js';
import { UserModel } from '../models/user.model.js';
import { PremiumPlanModel } from '../models/premium-plan.model.js';
import { PaymentOrderModel } from '../models/payment-order.model.js';
import { LessonModel } from '../models/lesson.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';
import { WordModel } from '../models/word.model.js';
import { VocabularyModel } from '../models/vocabulary.model.js';
import { signAccessToken } from '../services/jwt.js';
import * as adminPremium from '../services/admin-premium.js';
import * as billing from '../services/billing.js';
import * as payos from '../services/payos.js';

vi.mock('../middleware/rate-limits.js', () => ({
  aiLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  checkoutLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  paymentStatusLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
const app = express();
app.use(express.json());
app.use('/billing', billingRoutes);
app.use('/admin/billing', adminBillingRoutes);
app.use('/lessons', lessonRoutes);
app.use('/grammar', grammarRoutes);
app.use('/learning', learningRoutes);
app.use('/ai', aiRoutes);
app.use('/vocabulary', vocabularyRoutes);
app.use('/practice', practiceRoutes);
app.use(errorHandler);
const userId = new Types.ObjectId();
const lessonId = new Types.ObjectId();
function auth(extra = {}) {
  vi.spyOn(UserModel, 'findById').mockReturnValue({ select: () => ({ lean: async () => ({ _id: userId, role: 'user', status: 'active', learningProfile: { currentHsk: 3 }, ...extra }) }) } as never);
  return `Bearer ${signAccessToken(String(userId), 'user')}`;
}
function samples(ids: Types.ObjectId[]) {
  vi.spyOn(LessonModel, 'find').mockReturnValue({ sort: () => ({ limit: () => ({ select: () => ({ lean: async () => ids.map(_id => ({ _id })) }) }) }) } as never);
}
afterEach(() => vi.restoreAllMocks());

describe('payment history filtering and lifetime totals', () => {
  function history(summary = { totalOrders: 14, paidOrders: 13, pendingOrders: 1, otherOrders: 0, totalSpent: 1287000 }) {
    const limit = vi.fn().mockResolvedValue([]);
    const skip = vi.fn().mockReturnValue({ limit });
    const find = vi.spyOn(PaymentOrderModel, 'find').mockReturnValue({ sort: () => ({ skip }) } as never);
    const count = vi.spyOn(PaymentOrderModel, 'countDocuments').mockResolvedValue(1);
    const aggregate = vi.spyOn(PaymentOrderModel, 'aggregate').mockResolvedValue([summary]);
    return { find, count, aggregate, skip };
  }
  it('filters before pagination, scopes all queries to the owner and keeps lifetime totals', async () => {
    const db = history();
    const token = auth();
    const all = await request(app).get('/billing/orders?page=2&limit=12').set('Authorization', token);
    expect(all.status).toBe(200);
    expect(db.skip).toHaveBeenLastCalledWith(12);
    const filtered = await request(app).get('/billing/orders?status=PAID&search=%2310013&userId=other').set('Authorization', token);
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.summary).toEqual(all.body.data.summary);
    expect(filtered.body.data.summary.totalSpent).toBe(1287000);
    expect(filtered.body.data.total).toBe(1);
    expect(db.find).toHaveBeenLastCalledWith({ userId, status: 'PAID', $or: [
      { planName: { $regex: '10013', $options: 'i' } },
      { $expr: { $regexMatch: { input: { $toString: '$orderCode' }, regex: '10013' } } },
    ] });
    expect(db.count).toHaveBeenLastCalledWith(db.find.mock.calls.at(-1)![0]);
    expect(db.aggregate.mock.calls.at(-1)![0]![0]).toEqual({ $match: { userId } });
    expect(filtered.headers['cache-control']).toBe('no-store');
  });
  it('treats special characters as literal search text and groups PROCESSING consistently', async () => {
    const db = history();
    const token = auth();
    const res = await request(app).get('/billing/orders').query({ search: '(monthly).*', status: 'PENDING' }).set('Authorization', token);
    expect(res.status).toBe(200);
    expect(db.find).toHaveBeenLastCalledWith(expect.objectContaining({
      status: { $in: ['CREATING', 'PENDING', 'PROCESSING'] },
      $or: expect.arrayContaining([{ planName: { $regex: '\\(monthly\\)\\.\\*', $options: 'i' } }]),
    }));
    await request(app).get('/billing/orders?status=OTHER').set('Authorization', token);
    expect(db.find).toHaveBeenLastCalledWith({ userId, status: { $nin: ['PAID', 'CREATING', 'PENDING', 'PROCESSING'] } });
  });
  it('returns zero lifetime totals for accounts without orders', async () => {
    const db = history();
    db.count.mockResolvedValue(0);
    db.aggregate.mockResolvedValue([]);
    const res = await request(app).get('/billing/orders').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ items: [], total: 0,
      summary: { totalOrders: 0, paidOrders: 0, pendingOrders: 0, otherOrders: 0, totalSpent: 0 } });
  });
  it('requires authentication and validates filters before querying orders', async () => {
    const db = history();
    expect((await request(app).get('/billing/orders')).status).toBe(401);
    const token = auth();
    for (const query of [{ status: 'UNKNOWN' }, { search: 'x'.repeat(101) }, { page: 0 }]) {
      expect((await request(app).get('/billing/orders').query(query).set('Authorization', token)).status).toBe(422);
    }
    expect(db.find).not.toHaveBeenCalled();
  });
});

describe('billing API authorization and validation', () => {
  it('allows only an authenticated admin to activate a user package', async () => {
    const activate = vi.spyOn(adminPremium, 'activateUserPremium').mockResolvedValue({ userId, premiumExpiresAt: new Date('2027-01-01'), replayed: false, grant: {} } as never);
    const path = `/admin/billing/users/${userId}/activate`;
    expect((await request(app).post(path).send({})).status).toBe(401);
    expect((await request(app).post(path).set('Authorization', auth()).send({})).status).toBe(403);
    const response = await request(app).post(path).set('Authorization', auth({ role: 'admin' }))
      .set('Idempotency-Key', '123e4567-e89b-42d3-a456-426614174000').send({ planCode: 'yearly', reason: '  Chương trình hỗ trợ  ' });
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(activate).toHaveBeenCalledExactlyOnceWith(userId, userId, { planCode: 'yearly', reason: 'Chương trình hỗ trợ', idempotencyKey: '123e4567-e89b-42d3-a456-426614174000' });
  });
  it('validates activation inputs and does not accept client-supplied actor or expiry', async () => {
    const token = auth({ role: 'admin' });
    const activate = vi.spyOn(adminPremium, 'activateUserPremium');
    for (const extra of [{ reason: '' }, { planCode: 'unlimited' }, { grantedBy: String(userId) }, { premiumExpiresAt: '2099-01-01' }, { durationMonths: 99 }]) {
      expect((await request(app).post(`/admin/billing/users/${userId}/activate`).set('Authorization', token)
        .set('Idempotency-Key', '123e4567-e89b-42d3-a456-426614174000').send({ planCode: 'monthly', reason: 'Hỗ trợ', ...extra })).status).toBe(422);
    }
    expect((await request(app).post(`/admin/billing/users/${userId}/activate`).set('Authorization', token).send({ planCode: 'monthly', reason: 'Hỗ trợ' })).status).toBe(422);
    expect(activate).not.toHaveBeenCalled();
  });
  it('restricts manual activation history to admins', async () => {
    expect((await request(app).get(`/admin/billing/users/${userId}/grants`).set('Authorization', auth())).status).toBe(403);
    const response = await request(app).get(`/admin/billing/users/${userId}/grants`).set('Authorization', auth({ role: 'admin', premiumReceipts: [
      { orderCode: 123, expiresAt: new Date() }, { grantId: 'manual', reason: 'Hỗ trợ', expiresAt: new Date() },
    ] }));
    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].grantId).toBe('manual');
  });
  it('requires login for checkout and subscription', async () => {
    expect((await request(app).post('/billing/checkout').send({})).status).toBe(401);
    expect((await request(app).get('/billing/subscription')).status).toBe(401);
  });
  it('reports expiration from current DB state, not token claims', async () => {
    const response = await request(app).get('/billing/subscription').set('Authorization', auth({ premiumExpiresAt: new Date('2020-01-01') }));
    expect(response.body.data.tier).toBe('free');
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('forbids non-admin plan changes and order access', async () => {
    const token = auth();
    expect((await request(app).patch('/admin/billing/plans/monthly').set('Authorization', token).send({ price: 2000, revision: 1 })).status).toBe(403);
    expect((await request(app).get('/admin/billing/orders').set('Authorization', token)).status).toBe(403);
  });
  it('validates prices and prevents arbitrary duration edits', async () => {
    const token = auth({ role: 'admin' });
    for (const body of [{ price: -1 }, { price: 2.5 }, { durationMonths: 999 }, { price: 60000000 }]) {
      expect((await request(app).patch('/admin/billing/plans/monthly').set('Authorization', token).send({ ...body, revision: 1 })).status).toBe(422);
    }
  });
  it('updates prices with optimistic concurrency and records the admin', async () => {
    const update = vi.spyOn(PremiumPlanModel, 'findOneAndUpdate').mockReturnValue({ lean: async () => ({ code: 'monthly', price: 120000, revision: 2 }) } as never);
    const response = await request(app).patch('/admin/billing/plans/monthly').set('Authorization', auth({ role: 'admin' })).send({ price: 120000, revision: 1 });
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ code: 'monthly', revision: 1 }, { $set: { price: 120000, updatedBy: userId }, $inc: { revision: 1 } }, expect.anything());
  });
  it('rejects stale admin updates', async () => {
    vi.spyOn(PremiumPlanModel, 'findOneAndUpdate').mockReturnValue({ lean: async () => null } as never);
    const response = await request(app).patch('/admin/billing/plans/monthly').set('Authorization', auth({ role: 'admin' })).send({ price: 120000, revision: 1 });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PLAN_CONFLICT');
  });
  it('rejects missing idempotency keys and injected checkout amounts', async () => {
    const token = auth();
    expect((await request(app).post('/billing/checkout').set('Authorization', token).send({ planCode: 'monthly', expectedPrice: 99000 })).status).toBe(422);
    expect((await request(app).post('/billing/checkout').set('Authorization', token).send({ planCode: 'monthly', expectedPrice: 99000, amount: 1 })).status).toBe(422);
  });
  it('does not expose orders owned by other users', async () => {
    vi.spyOn(PaymentOrderModel, 'findOne').mockResolvedValue(null);
    const response = await request(app).get('/billing/orders/123456').set('Authorization', auth());
    expect(response.status).toBe(404);
  });
  it('cancels a pending order and returns the reconciled provider state', async () => {
    const order = { orderCode: 123, userId, status: 'PENDING', amount: 99000 };
    vi.spyOn(billing, 'ownedOrder').mockResolvedValue(order as never);
    vi.spyOn(billing, 'reconcileOrder').mockResolvedValueOnce(order as never).mockResolvedValueOnce({ ...order, status: 'CANCELLED' } as never);
    const cancel = vi.fn().mockResolvedValue({});
    vi.spyOn(payos, 'getPayOS').mockReturnValue({ paymentRequests: { cancel } } as never);
    const response = await request(app).post('/billing/orders/123/cancel').set('Authorization', auth());
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('CANCELLED');
    expect(cancel).toHaveBeenCalledWith(123, 'Nguoi dung huy thanh toan');
  });
  it('returns PAID when a successful payment wins the cancellation race', async () => {
    const order = { orderCode: 123, userId, status: 'PENDING', amount: 99000 };
    vi.spyOn(billing, 'ownedOrder').mockResolvedValue(order as never);
    vi.spyOn(billing, 'reconcileOrder').mockResolvedValueOnce(order as never).mockResolvedValue({ ...order, status: 'PAID' } as never);
    vi.spyOn(payos, 'getPayOS').mockReturnValue({ paymentRequests: { cancel: vi.fn().mockRejectedValue(new Error('already paid')) } } as never);
    const response = await request(app).post('/billing/orders/123/cancel').set('Authorization', auth());
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('PAID');
  });
  it('does not cancel another account order', async () => {
    vi.spyOn(PaymentOrderModel, 'findOne').mockResolvedValue(null);
    const provider = vi.spyOn(payos, 'getPayOS');
    expect((await request(app).post('/billing/orders/123/cancel').set('Authorization', auth())).status).toBe(404);
    expect(provider).not.toHaveBeenCalled();
  });
  it('publishes all benefits and correct price metadata', async () => {
    vi.spyOn(PremiumPlanModel, 'find').mockReturnValue({ sort: () => ({ lean: async () => [
      { code: 'monthly', name: 'Cơ bản', durationMonths: 1, price: 99000, active: true },
      { code: 'quarterly', name: 'Được yêu thích nhất', durationMonths: 3, price: 249000, active: true },
      { code: 'yearly', name: 'Tiết kiệm', durationMonths: 12, price: 699000, active: false },
    ] }) } as never);
    samples([lessonId]);
    const response = await request(app).get('/billing/plans');
    expect(response.status).toBe(200);
    expect(response.body.data.benefits).toHaveLength(8);
    expect(response.body.data.plans).toHaveLength(2);
    expect(response.body.data.plans[1]).toMatchObject({ highlighted: true, savings: 48000 });
    expect(response.body.data.freeSampleLessonIds).toEqual([String(lessonId)]);
  });
});

describe('Free/Premium access boundaries', () => {
  it('blocks video and subtitles before loading premium content', async () => {
    samples([]);
    const find = vi.spyOn(LessonModel, 'findOne').mockReturnValue({ select: () => ({ lean: async () => ({ hsk: 3 }) }) } as never);
    const token = auth();
    for (const suffix of ['', '/subtitles', '/chapters', '/progress']) {
      const response = await request(app).get(`/lessons/${lessonId}${suffix}`).set('Authorization', token);
      expect(response.status).toBe(403);
      expect(response.body.error).toMatchObject({ code: 'PREMIUM_REQUIRED', details: { upgradePath: '/premium' } });
    }
    expect(find).toHaveBeenCalledTimes(3); // Only level metadata; no protected content.
  });
  it('allows sample video subtitles for Free without login', async () => {
    samples([lessonId]);
    vi.spyOn(LessonModel, 'findOne').mockReturnValue({ select: () => ({ lean: async () => ({ _id: lessonId, activeSubtitleRevision: 1 }) }) } as never);
    vi.spyOn(SubtitleTrackModel, 'findOne').mockReturnValue({ populate: () => ({ lean: async () => ({ cues: [{ zh: '你好', pinyin: 'nǐ hǎo', vi: 'Xin chào' }] }) }) } as never);
    const response = await request(app).get(`/lessons/${lessonId}/subtitles`);
    expect(response.status).toBe(200);
    expect(response.body.data.cues[0]).toMatchObject({ zh: '你好', pinyin: 'nǐ hǎo', vi: 'Xin chào' });
  });
  it('allows Premium past the gate and still validates published content', async () => {
    vi.spyOn(LessonModel, 'findOne').mockReturnValue({ select: () => ({ lean: async () => null }) } as never);
    const response = await request(app).get(`/lessons/${lessonId}`).set('Authorization', auth({ premiumExpiresAt: new Date(Date.now() + 86400000) }));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('LESSON_NOT_FOUND');
  });
  it('requires Premium for quiz and flashcards', async () => {
    const token = auth();
    for (const path of [`/lessons/${lessonId}/quiz`, '/vocabulary/saved', '/vocabulary/due']) {
      const response = await request(app).get(path).set('Authorization', token);
      expect(response.status, path).toBe(403);
      expect(response.body.error.code).toBe('PREMIUM_REQUIRED');
    }
  });
  it('retains basic dictionary detail access for Free', async () => {
    vi.spyOn(VocabularyModel, 'findOne').mockReturnValue({ lean: async () => null } as never);
    vi.spyOn(WordModel, 'findById').mockReturnValue({ lean: async () => ({ hanzi: '你好', pinyin: 'nǐ hǎo', meaningVi: 'Xin chào' }) } as never);
    const response = await request(app).get(`/vocabulary/${new Types.ObjectId()}`);
    expect(response.status).toBe(200);
    expect(response.body.data.meaningVi).toBe('Xin chào');
  });
});


describe('customer Premium entitlement matrix', () => {
  const protectedReads = ['/grammar', '/grammar/stats', `/grammar/${lessonId}`, '/vocabulary',
    '/vocabulary?view=saved', '/vocabulary?saved=true', '/vocabulary/saved', '/vocabulary/due',
    '/learning/dashboard', '/learning/activity', '/learning/history', '/learning/roadmap',
    '/learning/recommendations', '/practice/sets', '/practice/attempts', `/lessons/${lessonId}/quiz`, `/lessons/${lessonId}/progress`];
  it.each([null, new Date('2020-01-01')])('blocks every Premium read for Free/expired accounts (%s)', async premiumExpiresAt => {
    const token = auth({ premiumExpiresAt });
    for (const path of protectedReads) {
      const response = await request(app).get(path).set('Authorization', token);
      expect(response.status, path).toBe(403);
      expect(response.body.error, path).toMatchObject({ code: 'PREMIUM_REQUIRED', details: { upgradePath: '/premium' } });
    }
  });
  it('blocks saving, practice and AI before validation or side effects for Free', async () => {
    const token = auth();
    for (const path of ['/vocabulary', '/vocabulary/practice-session', `/vocabulary/${lessonId}/review`,
      '/ai/ask', '/ai/explain', '/ai/history', '/learning/recommendations/ai', '/practice/attempts', `/lessons/${lessonId}/attempts`]) {
      const response = await request(app).post(path).set('Authorization', token).send({});
      expect(response.status, path).toBe(403);
      expect(response.body.error.code, path).toBe('PREMIUM_REQUIRED');
    }
  });
  it.each(['monthly', 'quarterly', 'yearly'])('unlocks grammar and save-word validation for every paid plan (%s)', async plan => {
    const token = auth({ premiumExpiresAt: new Date(Date.now() + 86400000), plan });
    vi.spyOn(grammarService, 'searchGrammar').mockResolvedValue({ items: [], pagination: { total: 0 } } as never);
    expect((await request(app).get('/grammar').set('Authorization', token)).status).toBe(200);
    expect((await request(app).post('/vocabulary').set('Authorization', token).send({})).status).toBe(422);
  });
  it('grants the same Premium guard access during trial and denies every protected read after expiry', async () => {
    const startedAt = new Date(Date.now() - 86400000);
    const token = auth({ premiumTrial: { startedAt, endsAt: new Date(Date.now() + 86400000), planCode: 'trial_15d' } });
    vi.spyOn(grammarService, 'searchGrammar').mockResolvedValue({ items: [], pagination: { total: 0 } } as never);
    expect((await request(app).get('/grammar').set('Authorization', token)).status).toBe(200);
    expect((await request(app).post('/vocabulary').set('Authorization', token).send({})).status).toBe(422);
    auth({ premiumTrial: { startedAt, endsAt: new Date(Date.now() - 1), planCode: 'trial_15d' } });
    for (const path of protectedReads) {
      const response = await request(app).get(path).set('Authorization', token);
      expect(response.status, path).toBe(403);
      expect(response.body.error.code, path).toBe('TRIAL_EXPIRED');
    }
  });
  it('downgrades immediately when the database expiry changes, without issuing a new access token', async () => {
    const token = auth({ premiumExpiresAt: new Date(Date.now() + 86400000) });
    vi.spyOn(grammarService, 'searchGrammar').mockResolvedValue({ items: [] } as never);
    expect((await request(app).get('/grammar').set('Authorization', token)).status).toBe(200);
    auth({ premiumExpiresAt: new Date('2020-01-01') });
    expect((await request(app).get('/grammar').set('Authorization', token)).body.error.code).toBe('PREMIUM_REQUIRED');
  });
});


it('filters the sample catalog to the same five published videos used by the access gate', async () => {
  const ids = Array.from({ length: 5 }, () => new Types.ObjectId());
  const limit = vi.fn(() => ({ select: () => ({ lean: async () => ids.map(_id => ({ _id })) }) }));
  const sampleSort = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => ids.map(_id => ({ _id })) }) }) }) }));
  const find = vi.spyOn(LessonModel, 'find')
    .mockReturnValueOnce({ sort: sampleSort } as never)
    .mockReturnValueOnce({ select } as never);
  vi.spyOn(LessonModel, 'countDocuments').mockResolvedValue(5);
  const response = await request(app).get('/lessons?sample=true');
  expect(response.status).toBe(200);
  expect(response.body.data.items).toHaveLength(5);
  expect(response.body.data.items.every((item: { isFreeSample: boolean }) => item.isFreeSample)).toBe(true);
  expect(find).toHaveBeenNthCalledWith(1, { status: 'published', contentMode: { $ne: 'podcast' } });
  expect(sampleSort).toHaveBeenCalledWith({ _id: 1 });
  expect(limit).toHaveBeenCalledWith(5);
  expect(find).toHaveBeenNthCalledWith(2, { status: 'published', _id: { $in: ids.map(String) } });
  expect(select).toHaveBeenCalledWith('-media.objectKey -lyricsRaw -chapters');
});
