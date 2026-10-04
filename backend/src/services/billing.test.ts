import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { PaymentOrderModel } from '../models/payment-order.model.js';
import { PremiumPlanModel } from '../models/premium-plan.model.js';
import { UserModel } from '../models/user.model.js';
import { createCheckout, handlePayOSWebhook, ownedOrder, reconcileOrder, publicOrder } from './billing.js';
import { addMonths, grantPremium, hasPremium, presentPlan } from './premium.js';

const provider = vi.hoisted(() => ({
  paymentRequests: { create: vi.fn(), get: vi.fn(), cancel: vi.fn() },
  webhooks: { verify: vi.fn() },
}));
vi.mock('./payos.js', () => ({ getPayOS: () => provider }));
const userId = new Types.ObjectId();
const now = new Date('2026-01-31T10:15:00Z');
const makeOrder = (extra = {}) => new PaymentOrderModel({
  userId, orderCode: 123456, idempotencyKey: '25357d84-e3cb-40cb-ac38-237da35e005c',
  planCode: 'quarterly', planName: 'Được yêu thích nhất', planRevision: 1,
  durationMonths: 3, amount: 249000, status: 'PENDING', paymentLinkId: 'link',
  expiresAt: new Date(Date.now() + 1800000), ...extra,
});
const input = { planCode: 'quarterly' as const, expectedPrice: 249000, idempotencyKey: '25357d84-e3cb-40cb-ac38-237da35e005c' };

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('Premium entitlement', () => {
  it('expires at the boundary and allows admins', () => {
    expect(hasPremium({ premiumExpiresAt: now }, now)).toBe(false);
    expect(hasPremium({ premiumExpiresAt: new Date(+now + 1) }, now)).toBe(true);
    expect(hasPremium({ role: 'admin' }, now)).toBe(true);
    expect(hasPremium(null, now)).toBe(false);
  });
  it('clamps calendar month ends including leap years', () => {
    expect(addMonths(now, 1).toISOString()).toBe('2026-02-28T10:15:00.000Z');
    expect(addMonths(new Date('2024-01-31T00:00:00Z'), 1).toISOString()).toBe('2024-02-29T00:00:00.000Z');
    expect(addMonths(new Date('2024-02-29T00:00:00Z'), 12).toISOString()).toBe('2025-02-28T00:00:00.000Z');
  });
  it('returns dynamic savings and highlights only quarterly', () => {
    expect(presentPlan({ code: 'quarterly', name: '', durationMonths: 3, price: 249000 }, 99000))
      .toMatchObject({ pricePerMonth: 83000, savings: 48000, savingsPercent: 16, highlighted: true });
    expect(presentPlan({ code: 'yearly', name: '', durationMonths: 12, price: 699000 }, 99000))
      .toMatchObject({ pricePerMonth: 58250, savings: 489000, savingsPercent: 41, highlighted: false });
    expect(presentPlan({ code: 'quarterly', name: '', durationMonths: 3, price: 249000 }, 100000).savings).toBe(51000);
  });
  it('atomically extends remaining time and records the order', async () => {
    vi.spyOn(UserModel, 'findById').mockReturnValue({ select: () => ({ lean: async () => ({ premiumExpiresAt: now, premiumReceipts: [] }) }) } as never);
    const update = vi.spyOn(UserModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never);
    const expiry = await grantPremium(userId, 123, 3, new Date('2026-01-01'));
    expect(expiry.toISOString()).toBe('2026-04-30T10:15:00.000Z');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ premiumExpiresAt: now, 'premiumReceipts.orderCode': { $ne: 123 } }), {
      $set: { premiumExpiresAt: expiry, premiumStartedAt: new Date('2026-01-01'), hasEverPurchasedPremium: true },
      $push: { premiumReceipts: { orderCode: 123, expiresAt: expiry, durationMonths: 3, grantedAt: new Date('2026-01-01'), planCode: undefined } },
    });
  });
  it('never grants twice after a crash or a repeated notification', async () => {
    vi.spyOn(UserModel, 'findById').mockReturnValue({ select: () => ({ lean: async () => ({ premiumReceipts: [{ orderCode: 123, expiresAt: now }] }) }) } as never);
    const update = vi.spyOn(UserModel, 'updateOne');
    expect(await grantPremium(userId, 123, 3)).toEqual(now);
    expect(update).not.toHaveBeenCalled();
  });
  it('retries a concurrent extension without losing either purchase', async () => {
    const firstExpiry = new Date('2026-04-30T10:15:00Z');
    const find = vi.spyOn(UserModel, 'findById');
    find.mockReturnValueOnce({ select: () => ({ lean: async () => ({ premiumExpiresAt: now }) }) } as never);
    find.mockReturnValueOnce({ select: () => ({ lean: async () => ({ premiumExpiresAt: firstExpiry }) }) } as never);
    vi.spyOn(UserModel, 'updateOne').mockResolvedValueOnce({ modifiedCount: 0 } as never).mockResolvedValueOnce({ modifiedCount: 1 } as never);
    expect((await grantPremium(userId, 124, 3, now)).toISOString()).toBe('2026-07-30T10:15:00.000Z');
  });
  it('starts expired subscriptions from payment confirmation time', async () => {
    vi.spyOn(UserModel, 'findById').mockReturnValue({ select: () => ({ lean: async () => ({ premiumExpiresAt: new Date('2020-01-01') }) }) } as never);
    vi.spyOn(UserModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never);
    expect((await grantPremium(userId, 125, 1, now)).toISOString()).toBe('2026-02-28T10:15:00.000Z');
  });
});

describe('checkout and provider verification', () => {
  it.each(['PAID', 'CANCELLED', 'EXPIRED', 'FAILED'])('does not expose a payable URL for %s orders', status => {
    expect(publicOrder(makeOrder({ status, checkoutUrl: 'https://pay.payos.vn/web/link' })).checkoutUrl).toBeNull();
  });
  it.each([undefined, NaN, -1, 0, 249000.5])('rejects invalid PAID totals (%s)', async amountPaid => {
    provider.paymentRequests.get.mockResolvedValue({ orderCode: 123456, amount: 249000, id: 'link', status: 'PAID', amountPaid, amountRemaining: 0 });
    const write = vi.spyOn(UserModel, 'updateOne');
    await expect(reconcileOrder(makeOrder())).rejects.toMatchObject({ code: 'PAYMENT_MISMATCH' });
    expect(write).not.toHaveBeenCalled();
  });
  it('does not treat a network failure after the local deadline as proof of expiration', async () => {
    vi.spyOn(PaymentOrderModel, 'findOne').mockResolvedValue(makeOrder({ status: 'CREATING', expiresAt: new Date('2020-01-01') }));
    provider.paymentRequests.get.mockRejectedValue(new Error('timeout'));
    await expect(createCheckout(userId, input)).rejects.toMatchObject({ code: 'PAYOS_UNAVAILABLE' });
    expect(provider.paymentRequests.create).not.toHaveBeenCalled();
  });
  it('rejects unrecognized provider states without mutating the order', async () => {
    provider.paymentRequests.get.mockResolvedValue({ orderCode: 123456, amount: 249000, id: 'link', status: 'UNKNOWN' });
    const update = vi.spyOn(PaymentOrderModel, 'updateOne');
    await expect(reconcileOrder(makeOrder())).rejects.toMatchObject({ code: 'PAYMENT_MISMATCH' });
    expect(update).not.toHaveBeenCalled();
  });
  it('rejects an outdated price before creating an order or link', async () => {
    vi.spyOn(PaymentOrderModel, 'findOne').mockResolvedValue(null);
    vi.spyOn(PremiumPlanModel, 'findOne').mockReturnValue({ lean: async () => ({ price: 299000 }) } as never);
    const create = vi.spyOn(PaymentOrderModel, 'create');
    await expect(createCheckout(userId, input)).rejects.toMatchObject({ code: 'PLAN_PRICE_CHANGED' });
    expect(create).not.toHaveBeenCalled();
    expect(provider.paymentRequests.create).not.toHaveBeenCalled();
  });
  it('rejects disabled or missing plans', async () => {
    vi.spyOn(PaymentOrderModel, 'findOne').mockResolvedValue(null);
    vi.spyOn(PremiumPlanModel, 'findOne').mockReturnValue({ lean: async () => null } as never);
    await expect(createCheckout(userId, input)).rejects.toMatchObject({ code: 'PLAN_UNAVAILABLE' });
  });
  it('reuses an order and its price snapshot even after prices change', async () => {
    vi.spyOn(PaymentOrderModel, 'findOne').mockResolvedValue(makeOrder());
    const planLookup = vi.spyOn(PremiumPlanModel, 'findOne');
    expect(await createCheckout(userId, input)).toMatchObject({ orderCode: 123456, amount: 249000 });
    expect(planLookup).not.toHaveBeenCalled();
    expect(provider.paymentRequests.create).not.toHaveBeenCalled();
  });
  it('rejects reusing an idempotency key for another purchase', async () => {
    vi.spyOn(PaymentOrderModel, 'findOne').mockResolvedValue(makeOrder());
    await expect(createCheckout(userId, { ...input, expectedPrice: 999000 })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
  it('recovers a link after the create response is lost', async () => {
    const order = makeOrder({ status: 'CREATING', paymentLinkId: undefined });
    vi.spyOn(PaymentOrderModel, 'findOne').mockResolvedValue(order);
    const update = vi.spyOn(PaymentOrderModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never);
    provider.paymentRequests.create.mockRejectedValue(new Error('timeout'));
    provider.paymentRequests.get.mockResolvedValue({ orderCode: order.orderCode, amount: order.amount, id: 'recovered', status: 'PENDING' });
    await createCheckout(userId, input);
    expect(provider.paymentRequests.get).toHaveBeenCalledWith(order.orderCode);
    expect(update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ $set: expect.objectContaining({ paymentLinkId: 'recovered' }) }));
  });
  it('never trusts a mismatched provider amount', async () => {
    const order = makeOrder();
    provider.paymentRequests.get.mockResolvedValue({ orderCode: order.orderCode, amount: 1, id: 'link', status: 'PAID' });
    const userUpdate = vi.spyOn(UserModel, 'updateOne');
    await expect(reconcileOrder(order)).rejects.toMatchObject({ code: 'PAYMENT_MISMATCH' });
    expect(userUpdate).not.toHaveBeenCalled();
  });
  it('rejects mismatched provider order/link and incomplete PAID totals', async () => {
    const order = makeOrder();
    for (const override of [{ orderCode: 9 }, { id: 'other' }, { amountPaid: 1 }]) {
      provider.paymentRequests.get.mockResolvedValue({ orderCode: order.orderCode, amount: order.amount, id: 'link', status: 'PAID', amountPaid: order.amount, amountRemaining: 0, ...override });
      await expect(reconcileOrder(order)).rejects.toMatchObject({ code: 'PAYMENT_MISMATCH' });
    }
  });
  it('does not grant Premium for underpayment', async () => {
    const order = makeOrder();
    vi.spyOn(PaymentOrderModel, 'findOne').mockResolvedValue(order);
    vi.spyOn(PaymentOrderModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never);
    const userUpdate = vi.spyOn(UserModel, 'updateOne');
    provider.paymentRequests.get.mockResolvedValue({ orderCode: order.orderCode, amount: order.amount, id: 'link', status: 'UNDERPAID' });
    await reconcileOrder(order);
    expect(userUpdate).not.toHaveBeenCalled();
  });
  it('accepts a verified overpayment without making the learner pay again', async () => {
    const order = makeOrder();
    vi.spyOn(PaymentOrderModel, 'findOne').mockResolvedValue(order);
    const update = vi.spyOn(PaymentOrderModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never);
    vi.spyOn(UserModel, 'findById').mockReturnValue({ select: () => ({ lean: async () => ({ premiumReceipts: [{ orderCode: order.orderCode, expiresAt: now }] }) }) } as never);
    provider.paymentRequests.get.mockResolvedValue({ orderCode: order.orderCode, amount: order.amount, id: 'link', status: 'PAID', amountPaid: order.amount + 1000, amountRemaining: -1000 });
    await reconcileOrder(order);
    expect(update).toHaveBeenCalledWith(expect.anything(), { $set: expect.objectContaining({ status: 'PAID' }) });
  });
  it('grants only after a verified paid total and cannot downgrade PAID', async () => {
    const order = makeOrder();
    vi.spyOn(PaymentOrderModel, 'findOne').mockResolvedValue(order);
    const update = vi.spyOn(PaymentOrderModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never);
    vi.spyOn(UserModel, 'findById').mockReturnValue({ select: () => ({ lean: async () => ({ premiumReceipts: [{ orderCode: order.orderCode, expiresAt: now }] }) }) } as never);
    provider.paymentRequests.get.mockResolvedValue({ orderCode: order.orderCode, amount: order.amount, id: 'link', status: 'PAID', amountPaid: order.amount, amountRemaining: 0 });
    await reconcileOrder(order);
    expect(update).toHaveBeenCalledWith({ _id: order._id, status: { $ne: 'PAID' } }, { $set: expect.objectContaining({ status: 'PAID', premiumExpiresAt: now }) });
    provider.paymentRequests.get.mockClear();
    await reconcileOrder(makeOrder({ status: 'PAID' }));
    expect(provider.paymentRequests.get).not.toHaveBeenCalled();
  });
  it('scopes order access to the authenticated owner', async () => {
    const find = vi.spyOn(PaymentOrderModel, 'findOne').mockResolvedValue(null);
    await expect(ownedOrder(userId, 123456)).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
    expect(find).toHaveBeenCalledWith({ userId, orderCode: 123456 });
  });
  it('rejects a forged webhook before any database lookup', async () => {
    provider.webhooks.verify.mockRejectedValue(new Error('invalid signature'));
    const find = vi.spyOn(PaymentOrderModel, 'findOne');
    await expect(handlePayOSWebhook({} as never)).rejects.toMatchObject({ code: 'INVALID_WEBHOOK_SIGNATURE' });
    expect(find).not.toHaveBeenCalled();
  });
  it('acknowledges signed registration probes without creating subscriptions', async () => {
    provider.webhooks.verify.mockResolvedValue({ orderCode: 123, code: '00' });
    vi.spyOn(PaymentOrderModel, 'findOne').mockResolvedValue(null);
    await handlePayOSWebhook({} as never);
    expect(provider.paymentRequests.get).not.toHaveBeenCalled();
  });
});
