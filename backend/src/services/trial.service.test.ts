import { describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { UserModel } from '../models/user.model.js';
import { isTrialEligible, ensureFirstLoginTrial, markWelcomePopupSeen } from './trial.service.js';

describe('TrialService Unit Tests', () => {
  const rolloutDate = env.PREMIUM_TRIAL_ROLLOUT_AT;
  const now = new Date('2026-10-05T10:00:00.000Z');

  describe('isTrialEligible', () => {
    it('CASE 1: New user created after rollout with no prior trial/paid is eligible', () => {
      const user = {
        role: 'user',
        status: 'active',
        createdAt: new Date('2026-10-05T09:00:00.000Z'),
        hasUsedTrial: false,
        premiumTrial: null,
        hasEverPurchasedPremium: false,
        premiumExpiresAt: null,
      };

      expect(isTrialEligible(user, now)).toBe(true);
    });

    it('CASE 2: User registered before rollout is NOT eligible', () => {
      const user = {
        role: 'user',
        status: 'active',
        createdAt: new Date(rolloutDate.getTime() - 1000), // before rollout
        hasUsedTrial: false,
        premiumTrial: null,
        hasEverPurchasedPremium: false,
        premiumExpiresAt: null,
      };

      expect(isTrialEligible(user, now)).toBe(false);
    });

    it('CASE 3: User who has already used trial is NOT eligible', () => {
      const userWithFlag = {
        role: 'user',
        status: 'active',
        createdAt: new Date('2026-10-05T09:00:00.000Z'),
        hasUsedTrial: true,
        premiumTrial: null,
      };
      expect(isTrialEligible(userWithFlag, now)).toBe(false);

      const userWithObject = {
        role: 'user',
        status: 'active',
        createdAt: new Date('2026-10-05T09:00:00.000Z'),
        hasUsedTrial: false,
        premiumTrial: {
          startedAt: new Date('2026-10-01'),
          endsAt: new Date('2026-10-16'),
        },
      };
      expect(isTrialEligible(userWithObject, now)).toBe(false);
    });

    it('CASE 4: User who has purchased premium before or currently active is NOT eligible', () => {
      const purchasedUser = {
        role: 'user',
        status: 'active',
        createdAt: new Date('2026-10-05T09:00:00.000Z'),
        hasEverPurchasedPremium: true,
      };
      expect(isTrialEligible(purchasedUser, now)).toBe(false);

      const activePaidUser = {
        role: 'user',
        status: 'active',
        createdAt: new Date('2026-10-05T09:00:00.000Z'),
        premiumExpiresAt: new Date('2026-11-01'),
      };
      expect(isTrialEligible(activePaidUser, now)).toBe(false);
    });

    it('CASE 5: User with unverified email when required is NOT eligible', () => {
      const unverifiedUser = {
        role: 'user',
        status: 'active',
        createdAt: new Date('2026-10-05T09:00:00.000Z'),
        emailVerificationRequired: true,
        emailVerifiedAt: null,
      };
      expect(isTrialEligible(unverifiedUser, now)).toBe(false);

      const verifiedUser = {
        role: 'user',
        status: 'active',
        createdAt: new Date('2026-10-05T09:00:00.000Z'),
        emailVerificationRequired: true,
        emailVerifiedAt: new Date('2026-10-05T09:05:00.000Z'),
      };
      expect(isTrialEligible(verifiedUser, now)).toBe(true);
    });

    it('Admin or non-active accounts are NOT eligible', () => {
      expect(isTrialEligible({ role: 'admin', status: 'active', createdAt: now }, now)).toBe(false);
      expect(isTrialEligible({ role: 'user', status: 'locked', createdAt: now }, now)).toBe(false);
    });
  });

  describe('ensureFirstLoginTrial', () => {
    it('CASE 6: Calls atomic updateOne with strict rollout, trial, and email conditions', async () => {
      const updateSpy = vi.spyOn(UserModel, 'updateOne').mockResolvedValueOnce({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0,
        upsertedId: null,
      } as any);

      const testUserId = new Types.ObjectId();
      const result = await ensureFirstLoginTrial(testUserId, now);

      expect(result.started).toBe(true);
      expect(result.endsAt).toEqual(new Date(now.getTime() + env.PREMIUM_TRIAL_DAYS * 24 * 60 * 60 * 1000));
      expect(updateSpy).toHaveBeenCalledTimes(1);

      const [filter, update] = updateSpy.mock.calls[0] as any;
      expect(filter._id).toEqual(testUserId);
      expect(filter.role).toBe('user');
      expect(filter.status).toBe('active');
      expect(filter.createdAt).toEqual({ $gte: env.PREMIUM_TRIAL_ROLLOUT_AT });
      expect(filter.hasUsedTrial).toEqual({ $ne: true });
      expect(filter.premiumTrial).toBeNull();
      expect(filter.hasEverPurchasedPremium).toEqual({ $ne: true });

      expect(update.$set.hasUsedTrial).toBe(true);
      expect(update.$set.premiumTrial.planCode).toBe('trial_15d');
      expect(update.$set.welcomeTrialPopupSeenAt).toBeNull();

      updateSpy.mockRestore();
    });

    it('CASE 7: Concurrent duplicate login attempts only start trial once', async () => {
      // First call updates 1 doc, second concurrent call updates 0 docs
      const updateSpy = vi.spyOn(UserModel, 'updateOne')
        .mockResolvedValueOnce({ acknowledged: true, matchedCount: 1, modifiedCount: 1 } as any)
        .mockResolvedValueOnce({ acknowledged: true, matchedCount: 0, modifiedCount: 0 } as any);

      const testUserId = new Types.ObjectId();
      const [res1, res2] = await Promise.all([
        ensureFirstLoginTrial(testUserId, now),
        ensureFirstLoginTrial(testUserId, now),
      ]);

      expect(res1.started).toBe(true);
      expect(res2.started).toBe(false);

      updateSpy.mockRestore();
    });
  });

  describe('markWelcomePopupSeen', () => {
    it('CASE 18: Updates welcomeTrialPopupSeenAt idempotently', async () => {
      const updateSpy = vi.spyOn(UserModel, 'updateOne').mockResolvedValueOnce({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1,
      } as any);

      const testUserId = new Types.ObjectId();
      const res = await markWelcomePopupSeen(testUserId, now);

      expect(res.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        { _id: testUserId, welcomeTrialPopupSeenAt: null },
        { $set: { welcomeTrialPopupSeenAt: now } },
      );

      updateSpy.mockRestore();
    });
  });
});
