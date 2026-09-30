import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { UserModel } from '../models/user.model.js';
import { PremiumPlanModel } from '../models/premium-plan.model.js';
import { PaymentOrderModel } from '../models/payment-order.model.js';
import { activateUserPremium } from './admin-premium.js';
import { grantPremium, initializeBilling } from './premium.js';

const userId = new Types.ObjectId();
const adminId = new Types.ObjectId();
const now = new Date('2026-01-15T10:00:00Z');
const input = { planCode: 'monthly' as const, reason: 'Tặng gói hỗ trợ', idempotencyKey: '123e4567-e89b-42d3-a456-426614174000' };
type Receipt = { orderCode?: number; grantId?: string; grantedBy?: Types.ObjectId; planCode?: string; reason?: string; expiresAt: Date };
let user: { role: string; status: string; premiumExpiresAt: Date | null; premiumReceipts: Receipt[] } | null;
beforeEach(() => {
  user = { role: 'user', status: 'active', premiumExpiresAt: null, premiumReceipts: [] };
  vi.spyOn(UserModel, 'findById').mockImplementation(() => ({ select: () => ({ lean: async () => user && { ...user, premiumReceipts: [...user.premiumReceipts] } }) }) as never);
  vi.spyOn(UserModel, 'updateOne').mockImplementation(async (filter: any, update: any) => {
    if (!user || Number(filter.premiumExpiresAt) !== Number(user.premiumExpiresAt)
      || user.premiumReceipts.some(receipt => filter['premiumReceipts.grantId'] ? receipt.grantId === filter['premiumReceipts.grantId'].$ne : receipt.orderCode === filter['premiumReceipts.orderCode'].$ne)) return { modifiedCount: 0 } as never;
    user.premiumExpiresAt = update.$set.premiumExpiresAt;
    user.premiumReceipts.push(update.$push.premiumReceipts);
    return { modifiedCount: 1 } as never;
  });
  vi.spyOn(PremiumPlanModel, 'findOne').mockReturnValue({ lean: async () => ({ durationMonths: 1, active: false }) } as never);
});
afterEach(() => vi.restoreAllMocks());

describe('admin Premium activation', () => {
  it('starts a free user now and atomically stores who granted it and why', async () => {
    const orders = vi.spyOn(PaymentOrderModel, 'create');
    const result = await activateUserPremium(userId, adminId, input, now);
    expect(result.premiumExpiresAt.toISOString()).toBe('2026-02-15T10:00:00.000Z');
    expect(result.grant).toMatchObject({ grantId: input.idempotencyKey, grantedBy: adminId, reason: input.reason, planCode: 'monthly', durationMonths: 1, grantedAt: now });
    expect(user!.premiumReceipts).toHaveLength(1);
    expect(orders).not.toHaveBeenCalled();
  });
  it('extends remaining time instead of replacing it', async () => {
    user!.premiumExpiresAt = new Date('2026-01-31T10:00:00Z');
    expect((await activateUserPremium(userId, adminId, input, now)).premiumExpiresAt.toISOString()).toBe('2026-02-28T10:00:00.000Z');
  });
  it('starts an expired subscription from activation time', async () => {
    user!.premiumExpiresAt = new Date('2020-01-01');
    expect((await activateUserPremium(userId, adminId, input, now)).premiumExpiresAt.toISOString()).toBe('2026-02-15T10:00:00.000Z');
  });
  it('deduplicates parallel clicks and a retry after a lost response', async () => {
    await Promise.all([activateUserPremium(userId, adminId, input, now), activateUserPremium(userId, adminId, input, now)]);
    const retried = await activateUserPremium(userId, adminId, input, now);
    expect(retried.replayed).toBe(true);
    expect(user!.premiumReceipts).toHaveLength(1);
    expect(user!.premiumExpiresAt?.toISOString()).toBe('2026-02-15T10:00:00.000Z');
  });
  it('does not lose time when a payment arrives alongside an admin grant', async () => {
    await Promise.all([activateUserPremium(userId, adminId, input, now), grantPremium(userId, 12345, 3, now)]);
    expect(user!.premiumReceipts).toHaveLength(2);
    expect(user!.premiumExpiresAt?.toISOString()).toBe('2026-05-15T10:00:00.000Z');
  });
  it('rejects a key reused for another plan, reason or admin', async () => {
    await activateUserPremium(userId, adminId, input, now);
    await expect(activateUserPremium(userId, adminId, { ...input, planCode: 'yearly' }, now)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(activateUserPremium(userId, adminId, { ...input, reason: 'Khác' }, now)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(activateUserPremium(userId, new Types.ObjectId(), input, now)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
  it.each([{ role: 'admin' }, { status: 'locked' }])('rejects ineligible accounts %j', async extra => {
    Object.assign(user!, extra);
    await expect(activateUserPremium(userId, adminId, input, now)).rejects.toMatchObject({ code: 'USER_NOT_ELIGIBLE' });
    expect(UserModel.updateOne).not.toHaveBeenCalled();
  });
  it('rejects a missing user or plan', async () => {
    user = null;
    await expect(activateUserPremium(userId, adminId, input, now)).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
    user = { role: 'user', status: 'active', premiumExpiresAt: null, premiumReceipts: [] };
    vi.mocked(PremiumPlanModel.findOne).mockReturnValue({ lean: async () => null } as never);
    await expect(activateUserPremium(userId, adminId, input, now)).rejects.toMatchObject({ code: 'PLAN_UNAVAILABLE' });
  });
  it('never resets the optimistic revision when restoring plan defaults', async () => {
    vi.spyOn(PremiumPlanModel, 'createIndexes').mockResolvedValue([]);
    vi.spyOn(PaymentOrderModel, 'createIndexes').mockResolvedValue([]);
    const update = vi.spyOn(PremiumPlanModel, 'updateOne').mockResolvedValue({} as never);
    await initializeBilling(true);
    expect(update).toHaveBeenCalledTimes(3);
    for (const [, change] of update.mock.calls) {
      expect(change).toMatchObject({ $inc: { revision: 1 } });
      expect(change?.$set).not.toHaveProperty('revision');
    }
  });
});
