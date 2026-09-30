import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { UserModel } from '../models/user.model.js';
import { PaymentOrderModel } from '../models/payment-order.model.js';
import { PremiumPlanModel } from '../models/premium-plan.model.js';
import { activateUserPremium } from './admin-premium.js';
import { createCheckout, handlePayOSWebhook, reconcileOrder } from './billing.js';
import { initializeBilling } from './premium.js';

const provider = vi.hoisted(() => ({ paymentRequests: { create: vi.fn(), get: vi.fn() }, webhooks: { verify: vi.fn() } }));
vi.mock('./payos.js', () => ({ getPayOS: () => provider }));
const uri = process.env.BILLING_TEST_MONGODB_URI;
const databaseName = `hanflix_billing_test_${process.pid}_${Date.now()}`;
const userId = new Types.ObjectId();
const adminId = new Types.ObjectId();
const now = new Date('2026-01-15T10:00:00Z');
const input = { planCode: 'monthly' as const, reason: 'Tặng gói học', idempotencyKey: '123e4567-e89b-42d3-a456-426614174000' };

// Opt-in only; always use a disposable database on the local test server.
describe.skipIf(!uri)('billing with real MongoDB atomic writes', () => {
  beforeAll(async () => {
    if (!/^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(uri!)) throw new Error('Use a local disposable MongoDB server without a database name');
    await mongoose.connect(uri!, { dbName: databaseName, serverSelectionTimeoutMS: 5000 });
    await Promise.all([UserModel.createIndexes(), initializeBilling()]);
  }, 30_000);
  beforeEach(async () => {
    vi.clearAllMocks();
    await Promise.all([UserModel.deleteMany({}), PaymentOrderModel.deleteMany({})]);
    await UserModel.create({ _id: userId, name: 'Billing test', email: 'billing@example.test', role: 'user', status: 'active' });
  });
  afterAll(async () => {
    if (mongoose.connection.name === databaseName) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  it('persists only one entitlement and audit receipt for simultaneous admin retries', async () => {
    await Promise.all(Array.from({ length: 5 }, () => activateUserPremium(userId, adminId, input, now)));
    const user = await UserModel.findById(userId).select('+premiumReceipts').lean();
    expect(user!.premiumExpiresAt?.toISOString()).toBe('2026-02-15T10:00:00.000Z');
    expect(user!.premiumReceipts).toHaveLength(1);
    expect(String(user!.premiumReceipts[0]!.grantedBy)).toBe(String(adminId));
    expect(user!.premiumReceipts[0]!.reason).toBe(input.reason);
    expect(await PaymentOrderModel.countDocuments()).toBe(0);
  });
  it('creates one checkout snapshot even when creation is retried concurrently', async () => {
    provider.paymentRequests.create.mockImplementation(async value => ({ orderCode: value.orderCode, amount: value.amount,
      currency: 'VND', paymentLinkId: 'test-link', checkoutUrl: 'https://pay.payos.vn/web/test-link' }));
    const checkout = { planCode: 'monthly' as const, expectedPrice: 99000, idempotencyKey: input.idempotencyKey };
    const results = await Promise.all([createCheckout(userId, checkout), createCheckout(userId, checkout)]);
    expect(new Set(results.map(result => result.orderCode)).size).toBe(1);
    expect(await PaymentOrderModel.countDocuments()).toBe(1);
    expect(results[0]).toMatchObject({ status: 'PENDING', amount: 99000 });
  });
  it('handles duplicate verified webhooks and concurrent manual activation without losing time', async () => {
    const current = new Date(); current.setUTCFullYear(current.getUTCFullYear() + 1); current.setUTCMonth(0, 15);
    await UserModel.updateOne({ _id: userId }, { $set: { premiumExpiresAt: current } });
    const order = await PaymentOrderModel.create({ userId, orderCode: 123456, idempotencyKey: 'payment-key', planCode: 'quarterly',
      planName: '3 tháng', planRevision: 1, durationMonths: 3, amount: 249000, status: 'PENDING', paymentLinkId: 'link', expiresAt: new Date(Date.now() + 60_000) });
    provider.webhooks.verify.mockResolvedValue({ code: '00', orderCode: order.orderCode, currency: 'VND', paymentLinkId: 'link' });
    provider.paymentRequests.get.mockResolvedValue({ orderCode: order.orderCode, amount: 249000, id: 'link', status: 'PAID', amountPaid: 249000, amountRemaining: 0 });
    await Promise.all([handlePayOSWebhook({} as never), handlePayOSWebhook({} as never), activateUserPremium(userId, adminId, input)]);
    const user = await UserModel.findById(userId).select('+premiumReceipts').lean();
    const expected = new Date(current); expected.setUTCMonth(expected.getUTCMonth() + 4);
    expect(user!.premiumExpiresAt).toEqual(expected);
    expect(user!.premiumReceipts).toHaveLength(2);
    expect((await PaymentOrderModel.findById(order._id))!.status).toBe('PAID');
    await reconcileOrder((await PaymentOrderModel.findById(order._id))!);
    expect((await UserModel.findById(userId).select('+premiumReceipts').lean())!.premiumReceipts).toHaveLength(2);
  });
});
