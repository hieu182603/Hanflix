import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { UserModel } from '../models/user.model.js';
import { PaymentOrderModel } from '../models/payment-order.model.js';
import { PremiumPlanModel } from '../models/premium-plan.model.js';
import { ProgressModel } from '../models/progress.model.js';
import { SavedWordModel } from '../models/saved-word.model.js';
import { StudyActivityModel } from '../models/study-activity.model.js';
import { initializeBilling, grantPremium } from './premium.js';
import { getCurrentSubscription, subscribePremium } from './subscription.js';
import { ensureFirstLoginTrial } from './trial.service.js';
import { env } from '../config/env.js';
import { PREMIUM_TRIAL_MS } from './premium-access.js';
import { activateUserPremium } from './admin-premium.js';
import { handlePayOSWebhook } from './billing.js';
import { getPayOS } from './payos.js';
import { migratePremiumHistory } from './premium-history-migration.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePremium } from '../middleware/premium.js';
import { errorHandler } from '../middleware/error-handler.js';
import { signAccessToken } from './jwt.js';
import { billingRoutes } from '../routes/billing.routes.js';
import authRoutes from '../routes/auth.routes.js';

const provider = vi.hoisted(() => ({ paymentRequests: { create: vi.fn(), get: vi.fn() }, webhooks: { verify: vi.fn() } }));
vi.mock('./payos.js', () => ({ getPayOS: vi.fn(() => provider), payosConfigured: () => true }));
vi.mock('./mailer.js', () => ({ mailService: { assertConfigured: vi.fn(), sendVerificationEmail: vi.fn() } }));
vi.mock('./account-token.js', () => ({ accountTokenService: { issueWithOtp: async () => ({ token: 'test-token', code: '123456' }) } }));
vi.mock('../middleware/rate-limits.js', () => {
  const next = (_req: unknown, _res: unknown, done: () => void) => done();
  return { checkoutLimiter: next, paymentStatusLimiter: next, authLimiter: next, refreshLimiter: next };
});
const uri = process.env.SUBSCRIPTION_TEST_MONGODB_URI;
const dbName = `hanflix_subscription_test_${process.pid}_${Date.now()}`;
const userId = new Types.ObjectId();
const now = new Date('2026-10-20T10:00:00.000Z');
const trialEnd = new Date(now.getTime() + PREMIUM_TRIAL_MS);
const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/billing', billingRoutes);
app.get('/protected', requireAuth, requirePremium, (_req, res) => res.json({ ok: true }));
app.use(errorHandler);
const auth = () => `Bearer ${signAccessToken(String(userId), 'user')}`;
const subscribe = (planCode: 'monthly' | 'yearly' = 'monthly', key = randomUUID()) => subscribePremium(userId, { planCode, idempotencyKey: key });
async function paidOrder(status = 'PAID') {
  return PaymentOrderModel.create({ userId, orderCode: 123456, idempotencyKey: randomUUID(), planCode: 'monthly', planName: 'Monthly',
    planRevision: 1, durationMonths: 1, amount: 99000, status, expiresAt: trialEnd, paymentLinkId: 'test-link' });
}
async function paidWebhook() {
  provider.webhooks.verify.mockResolvedValue({ code: '00', orderCode: 123456, currency: 'VND', paymentLinkId: 'test-link' });
  provider.paymentRequests.get.mockResolvedValue({ orderCode: 123456, amount: 99000, id: 'test-link', status: 'PAID', amountPaid: 99000, amountRemaining: 0 });
  await handlePayOSWebhook({} as never);
}

describe.skipIf(!uri)('Premium trial lifecycle on MongoDB', () => {
  beforeAll(async () => {
    if (!/^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(uri!)) throw new Error('Use a disposable local MongoDB server');
    await mongoose.connect(uri!, { dbName, serverSelectionTimeoutMS: 5000 });
    await Promise.all([UserModel.createIndexes(), initializeBilling()]);
  }, 30000);
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now);
    await Promise.all([UserModel.deleteMany({}), PaymentOrderModel.deleteMany({}),
      ProgressModel.deleteMany({}), SavedWordModel.deleteMany({}), StudyActivityModel.deleteMany({})]);
    await PremiumPlanModel.updateMany({}, { $set: { active: true } });
    await UserModel.create({ _id: userId, name: 'Learner', email: 'learner@example.test',
      passwordHash: await bcrypt.hash('Password123!', 4), emailVerifiedAt: now,
      learningProfile: { currentHsk: 3 }, totalXP: 123, avatarUrl: 'https://example.test/avatar.png' });
    provider.paymentRequests.create.mockImplementation(async value => ({ orderCode: value.orderCode, amount: value.amount,
      currency: 'VND', paymentLinkId: 'test-link', checkoutUrl: 'https://pay.payos.vn/web/test-link' }));
  });
  afterAll(async () => {
    vi.useRealTimers();
    if (mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('1: signup stays Free without a trial or payment, ignoring forged client entitlement', async () => {
    const res = await request(app).post('/auth/register').send({ name: 'New learner', email: 'new@example.test', password: 'Password123!',
      premiumExpiresAt: trialEnd, premiumTrial: { endsAt: trialEnd }, hasEverPurchasedPremium: false });
    expect(res.status).toBe(201);
    const user = await UserModel.findOne({ email: 'new@example.test' }).lean();
    expect(user!.premiumTrial).toBeNull(); expect(user!.premiumExpiresAt).toBeNull();
    expect(res.body.data.user.tier).toBe('free');
    expect(provider.paymentRequests.create).not.toHaveBeenCalled();
  });
  it('2: first authenticated login starts exactly 15 days without payOS', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'learner@example.test', password: 'Password123!' });
    expect(res.status).toBe(200); expect(res.body.data.user.tier).toBe('premium');
    expect(res.body.data.subscription).toMatchObject({ status: 'TRIAL', hasPremiumAccess: true,
      trial: { startedAt: now.toISOString(), endsAt: trialEnd.toISOString(), remainingSeconds: 15 * 86400 } });
    expect(res.body.data.ui.showWelcomeTrialPopup).toBe(true);
    expect((await UserModel.findById(userId))!.hasUsedTrial).toBe(true);
    expect(getPayOS).not.toHaveBeenCalled();
    expect(await PaymentOrderModel.countDocuments()).toBe(0);
  });
  it.each(['monthly', 'quarterly', 'yearly'])('%s selection only creates payment; never trial', async planCode => {
    const res = await request(app).post('/billing/subscribe').set('Authorization', auth()).set('Idempotency-Key', randomUUID()).send({ planCode });
    expect(res.status).toBe(200); expect(res.body.data.type).toBe('PAYMENT_REQUIRED');
    expect((await UserModel.findById(userId))!.premiumTrial).toBeNull();
    expect(provider.paymentRequests.create).toHaveBeenCalledTimes(1);
  });
  it('5–8: guard allows trial, denies at exact expiry, preserves account and learning data', async () => {
    await ensureFirstLoginTrial(userId);
    const lessonId = new Types.ObjectId();
    await Promise.all([
      ProgressModel.create({ userId, lessonId, lastPositionSeconds: 120, watchedRanges: [{ start: 0, end: 120 }],
        activeStudySeconds: 120, completed: true, bestQuizScore: 90 }),
      SavedWordModel.create({ userId, wordId: new Types.ObjectId(), sourceLessonId: lessonId,
        repetitions: 3, intervalDays: 7, nextReviewAt: trialEnd }),
      StudyActivityModel.create({ userId, dateKey: '2026-10-20', activeStudySeconds: 120, quizAttempts: 1, xpEarned: 20 }),
    ]);
    const learningData = () => Promise.all([
      ProgressModel.find({ userId }).lean(), SavedWordModel.find({ userId }).lean(), StudyActivityModel.find({ userId }).lean(),
    ]);
    const savedLearningData = await learningData();
    const before = await UserModel.findById(userId).lean();
    expect((await request(app).get('/protected').set('Authorization', auth())).status).toBe(200);
    vi.setSystemTime(new Date(trialEnd.getTime() - 1));
    expect((await request(app).get('/protected').set('Authorization', auth())).status).toBe(200);
    vi.setSystemTime(trialEnd);
    const denied = await request(app).get('/protected').set('Authorization', auth());
    expect(denied.status).toBe(403); expect(denied.body.error.code).toBe('TRIAL_EXPIRED');
    const me = await request(app).get('/auth/me').set('Authorization', auth());
    expect(me.status).toBe(200); expect(me.body.data.subscription).toMatchObject({ status: 'EXPIRED', tier: 'free', trialEligible: false });
    expect(await UserModel.findById(userId).lean()).toEqual(before);
    expect(await learningData()).toEqual(savedLearningData);
    const login = await request(app).post('/auth/login').send({ email: 'learner@example.test', password: 'Password123!' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.tier).toBe('free');
  });
  it('9: a subsequent active-trial selection offers payment without restarting trial', async () => {
    await ensureFirstLoginTrial(userId);
    const before = (await UserModel.findById(userId))!.premiumTrial!.toObject();
    expect((await subscribe()).type).toBe('PAYMENT_REQUIRED');
    expect((await UserModel.findById(userId))!.premiumTrial!.toObject()).toEqual(before);
  });
  it('10: expired trial selection goes to payOS', async () => {
    await ensureFirstLoginTrial(userId); vi.setSystemTime(trialEnd);
    expect((await subscribe()).type).toBe('PAYMENT_REQUIRED');
    expect(provider.paymentRequests.create).toHaveBeenCalledTimes(1);
  });
  it('11: legacy PAID history without a user flag blocks trial', async () => {
    await paidOrder();
    await migratePremiumHistory(false);
    expect((await getCurrentSubscription(userId)).trialEligible).toBe(false);
    expect((await subscribe()).type).toBe('PAYMENT_REQUIRED');
    expect((await UserModel.findById(userId))!.premiumTrial).toBeNull();
  });
  it('12: active paid Premium cannot receive a trial', async () => {
    await grantPremium(userId, 234567, 1, now);
    expect((await subscribe()).type).toBe('PAYMENT_REQUIRED');
    expect((await UserModel.findById(userId))!.premiumTrial).toBeNull();
  });
  it('13: concurrent first logins persist and return exactly the same trial dates', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => request(app).post('/auth/login')
      .send({ email: 'learner@example.test', password: 'Password123!' })));
    for (const result of results) {
      expect(result.status).toBe(200);
      expect(result.body.data.subscription).toMatchObject({ status: 'TRIAL',
        trial: { startedAt: now.toISOString(), endsAt: trialEnd.toISOString() } });
      expect(result.body.data.user.tier).toBe('premium');
    }
    expect((await UserModel.findById(userId))!.premiumTrial!.endsAt).toEqual(trialEnd);
    expect(provider.paymentRequests.create).not.toHaveBeenCalled();
    expect(await PaymentOrderModel.countDocuments()).toBe(0);
  });
  it('14: another plan never resets the trial dates', async () => {
    await ensureFirstLoginTrial(userId); vi.setSystemTime(new Date(now.getTime() + 86400000));
    const result = await subscribe('yearly');
    expect(result.type).toBe('PAYMENT_REQUIRED');
    if (result.type === 'PAYMENT_REQUIRED') expect(result.order.amount).toBe(699000);
    expect((await UserModel.findById(userId))!.premiumTrial!.endsAt).toEqual(trialEnd);
  });
  it('15: logout/login does not reset trial', async () => {
    await ensureFirstLoginTrial(userId);
    const before = (await UserModel.findById(userId))!.premiumTrial!.toObject();
    await request(app).post('/auth/logout');
    const login = await request(app).post('/auth/login').send({ email: 'learner@example.test', password: 'Password123!' });
    expect(login.status).toBe(200); expect(login.body.data.user.tier).toBe('premium');
    expect((await UserModel.findById(userId))!.premiumTrial!.toObject()).toEqual(before);
  });
  it('16–18: delayed paid activation starts today; duplicate verified webhooks grant once', async () => {
    await ensureFirstLoginTrial(userId); await paidOrder('PENDING');
    const paymentTime = new Date('2026-11-22T10:00:00Z'); vi.setSystemTime(paymentTime);
    await paidWebhook();
    await Promise.all([paidWebhook(), paidWebhook()]);
    const state = await getCurrentSubscription(userId);
    expect(state).toMatchObject({ status: 'ACTIVE', hasUsedPremiumTrial: true, trialEligible: false,
      premium: { startedAt: paymentTime, endsAt: new Date('2026-12-22T10:00:00Z') } });
    const user = await UserModel.findById(userId).select('+premiumReceipts');
    expect(user!.premiumReceipts).toHaveLength(1);
  });
  it('19: admin activation preserves remaining trial time and survives its old expiry', async () => {
    await ensureFirstLoginTrial(userId);
    await activateUserPremium(userId, new Types.ObjectId(), { planCode: 'monthly', reason: 'Support', idempotencyKey: randomUUID() });
    vi.setSystemTime(trialEnd);
    expect(await getCurrentSubscription(userId)).toMatchObject({ status: 'ACTIVE', hasPremiumAccess: true,
      premium: { endsAt: new Date('2026-12-04T10:00:00Z') } });
  });
  it('20: current user and subscription APIs expose matching state without internal request keys', async () => {
    expect((await request(app).get('/auth/me').set('Authorization', auth())).body.data.subscription.trialEligible).toBe(true);
    await ensureFirstLoginTrial(userId);
    const me = await request(app).get('/auth/me').set('Authorization', auth());
    const state = await request(app).get('/billing/subscription').set('Authorization', auth());
    expect(me.body.data.subscription).toEqual(state.body.data);
    expect(me.body.data.user.premiumExpiresAt).toBe(trialEnd.toISOString());
    expect(JSON.stringify(me.body)).not.toContain('requestKey');
  });
  it('early payment appends its full calendar month after the remaining trial', async () => {
    await ensureFirstLoginTrial(userId); await paidOrder('PENDING'); vi.setSystemTime(new Date('2026-10-25T10:00:00Z'));
    await paidWebhook();
    expect((await getCurrentSubscription(userId)).premium).toMatchObject({ startedAt: trialEnd, endsAt: new Date('2026-12-04T10:00:00Z') });
  });
  it('renewal during trial preserves the first scheduled paid start and both paid months', async () => {
    await ensureFirstLoginTrial(userId);
    await grantPremium(userId, 111, 1, now, 'monthly');
    await grantPremium(userId, 222, 1, now, 'monthly');
    expect((await getCurrentSubscription(userId)).premium).toMatchObject({
      startedAt: trialEnd, endsAt: new Date('2027-01-04T10:00:00Z') });
    vi.setSystemTime(trialEnd);
    expect((await getCurrentSubscription(userId)).status).toBe('ACTIVE');
  });
  it('rejects inactive/missing plans and forged subscription fields before activation', async () => {
    await PremiumPlanModel.updateOne({ code: 'monthly' }, { $set: { active: false } });
    await expect(subscribe()).rejects.toMatchObject({ code: 'PLAN_INACTIVE' });
    await PremiumPlanModel.deleteOne({ code: 'monthly' });
    await expect(subscribe()).rejects.toMatchObject({ code: 'PLAN_NOT_FOUND' });
    await initializeBilling();
    const res = await request(app).post('/billing/subscribe').set('Authorization', auth()).set('Idempotency-Key', randomUUID())
      .send({ planCode: 'monthly', trialEligible: true, price: 0 });
    expect(res.status).toBe(422); expect((await UserModel.findById(userId))!.premiumTrial).toBeNull();
    expect((await request(app).post('/billing/subscribe').send({ planCode: 'monthly' })).status).toBe(401);
  });
  it('popup seen state is idempotent, persists across devices, and /me never starts trial', async () => {
    expect((await request(app).get('/auth/me').set('Authorization', auth())).body.data.subscription.status).toBe('FREE');
    await ensureFirstLoginTrial(userId);
    const seen = () => request(app).post('/auth/trial-welcome/seen').set('Authorization', auth());
    expect((await seen()).status).toBe(200);
    const before = (await UserModel.findById(userId))!.welcomeTrialPopupSeenAt;
    vi.setSystemTime(new Date(now.getTime() + 86400000));
    await Promise.all([seen(), seen()]);
    expect((await UserModel.findById(userId))!.welcomeTrialPopupSeenAt).toEqual(before);
    const login = await request(app).post('/auth/login').set('User-Agent', 'Another browser')
      .send({ email: 'learner@example.test', password: 'Password123!' });
    expect(login.body.data.ui.showWelcomeTrialPopup).toBe(false);
    expect(login.body.data.subscription.trial.endsAt).toBe(trialEnd.toISOString());
  });
  it('old users cannot receive a trial by login, /me or selecting a plan', async () => {
    await UserModel.collection.updateOne({ _id: userId }, { $set: { createdAt: new Date('2026-10-03') } });
    const login = await request(app).post('/auth/login').send({ email: 'learner@example.test', password: 'Password123!' });
    expect(login.body.data.subscription).toMatchObject({ status: 'FREE', trialEligible: false });
    await request(app).get('/auth/me').set('Authorization', auth());
    expect((await subscribe()).type).toBe('PAYMENT_REQUIRED');
    expect((await UserModel.findById(userId))!.premiumTrial).toBeNull();
  });
  it('disabled feature cannot be bypassed by login or plan selection', async () => {
    const enabled = env.PREMIUM_TRIAL_ENABLED;
    env.PREMIUM_TRIAL_ENABLED = false;
    try {
      const login = await request(app).post('/auth/login').send({ email: 'learner@example.test', password: 'Password123!' });
      expect(login.body.data.subscription.trialEligible).toBe(false);
      expect((await subscribe()).type).toBe('PAYMENT_REQUIRED');
      expect((await UserModel.findById(userId))!.premiumTrial).toBeNull();
    } finally { env.PREMIUM_TRIAL_ENABLED = enabled; }
  });
  it('unverified or wrong credentials never start trial', async () => {
    expect((await request(app).post('/auth/login').send({ email: 'learner@example.test', password: 'WrongPassword!' })).status).toBe(401);
    await UserModel.updateOne({ _id: userId }, { $set: { emailVerificationRequired: true }, $unset: { emailVerifiedAt: 1 } });
    expect((await request(app).post('/auth/login').send({ email: 'learner@example.test', password: 'Password123!' })).status).toBe(403);
    expect((await UserModel.findById(userId))!.premiumTrial).toBeNull();
  });
  it('migration is additive/idempotent and history checks work before running it', async () => {
    await paidOrder();
    const before = await UserModel.findById(userId).lean();
    expect(await migratePremiumHistory(true)).toMatchObject({ candidates: 1, updated: 0 });
    expect(await migratePremiumHistory(false)).toMatchObject({ updated: 1 });
    expect(await migratePremiumHistory(false)).toMatchObject({ updated: 0 });
    const after = await UserModel.findById(userId).lean();
    expect(after).toMatchObject({ premiumTrial: null, premiumExpiresAt: before!.premiumExpiresAt,
      learningProfile: before!.learningProfile, totalXP: 123, hasEverPurchasedPremium: true });
    expect(await PaymentOrderModel.countDocuments()).toBe(1);
  });
  it('migration preserves active paid and trial dates exactly', async () => {
    await ensureFirstLoginTrial(userId); await grantPremium(userId, 456789, 1, now, 'monthly');
    await UserModel.updateOne({ _id: userId }, { $unset: { hasEverPurchasedPremium: 1 } });
    const before = await UserModel.findById(userId).lean();
    await migratePremiumHistory(false);
    const after = await UserModel.findById(userId).lean();
    expect(after!.premiumExpiresAt).toEqual(before!.premiumExpiresAt);
    expect(after!.premiumStartedAt).toEqual(before!.premiumStartedAt);
    expect(after!.premiumTrial).toEqual(before!.premiumTrial);
    expect((await getCurrentSubscription(userId)).status).toBe('TRIAL');
  });
  it('never silently charges a changed price from a stale pricing card', async () => {
    const res = await request(app).post('/billing/subscribe').set('Authorization', auth())
      .set('Idempotency-Key', randomUUID()).send({ planCode: 'monthly', expectedPrice: 10000 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PLAN_PRICE_CHANGED');
    expect(await PaymentOrderModel.countDocuments()).toBe(0);
    expect(provider.paymentRequests.create).not.toHaveBeenCalled();
  });
  it('payment retries keep the original order snapshot and reject plan/key conflicts', async () => {
    await paidOrder();
    const key = randomUUID();
    const first = await subscribe('monthly', key);
    await PremiumPlanModel.updateOne({ code: 'monthly' }, { $set: { price: 100000, active: false } });
    const second = await subscribe('monthly', key);
    expect(second).toEqual(first);
    expect(provider.paymentRequests.create).toHaveBeenCalledTimes(1);
    await expect(subscribe('yearly', key)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await initializeBilling(true);
  });
  it('cannot grant trial after a paid receipt even if the order history is unavailable', async () => {
    await grantPremium(userId, 987654, 1, new Date('2020-01-01'));
    expect((await subscribe()).type).toBe('PAYMENT_REQUIRED');
  });
  it('does not infer eligibility from missing legacy payment history', async () => {
    await UserModel.updateOne({ _id: userId }, { $set: { premiumExpiresAt: new Date('2020-01-01') } });
    expect((await subscribe()).type).toBe('PAYMENT_REQUIRED');
  });
  it('trial and paid grant racing cannot lose purchased time or restart a trial', async () => {
    await Promise.all([ensureFirstLoginTrial(userId), grantPremium(userId, 345678, 1, now)]);
    const state = await getCurrentSubscription(userId);
    expect(state.status).toBe(state.trial ? 'TRIAL' : 'ACTIVE'); expect(state.trialEligible).toBe(false);
    expect(state.premium.endsAt).toEqual(state.trial ? new Date('2026-12-04T10:00:00Z') : new Date('2026-11-20T10:00:00Z'));
  });
});
