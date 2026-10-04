import type { Types } from 'mongoose';
import { env } from '../config/env.js';
import { UserModel } from '../models/user.model.js';
import { logger } from './logger.js';
import { PREMIUM_TRIAL_MS } from './premium-access.js';

export interface TrialState {
  isEligible: boolean;
  isTrialActive: boolean;
  hasUsedTrial: boolean;
  trial: {
    startedAt: Date;
    endsAt: Date;
    remainingSeconds: number;
    planCode: string;
  } | null;
  showWelcomePopup: boolean;
}

/**
 * Checks whether a user is eligible to receive the 15-day first-login trial.
 * Rules:
 * 1. PREMIUM_TRIAL_ENABLED must be true.
 * 2. User must be a standard 'user' and 'active'.
 * 3. User must have registered on or after PREMIUM_TRIAL_ROLLOUT_AT.
 * 4. User must have never received a trial (hasUsedTrial !== true and premiumTrial == null).
 * 5. User must have never purchased premium (hasEverPurchasedPremium !== true).
 * 6. User must not currently hold an active paid premium subscription.
 * 7. If email verification is required, email must be verified.
 */
export function isTrialEligible(
  user: {
    role?: string;
    status?: string;
    createdAt?: Date | string | null;
    hasUsedTrial?: boolean;
    premiumTrial?: { startedAt: Date; endsAt: Date } | null;
    hasEverPurchasedPremium?: boolean;
    premiumExpiresAt?: Date | string | null;
    emailVerificationRequired?: boolean;
    emailVerifiedAt?: Date | string | null;
  } | null | undefined,
  now = new Date(),
): boolean {
  if (!env.PREMIUM_TRIAL_ENABLED || !env.PREMIUM_TRIAL_ROLLOUT_AT) return false;
  if (!user || user.role !== 'user' || user.status !== 'active') return false;

  if (user.hasUsedTrial || user.premiumTrial) return false;
  if (user.hasEverPurchasedPremium) return false;

  // Rollout cutoff check
  if (!user.createdAt) return false;
  const userCreatedAt = new Date(user.createdAt);
  if (!Number.isFinite(userCreatedAt.getTime()) || userCreatedAt < env.PREMIUM_TRIAL_ROLLOUT_AT) return false;

  // Paid active check
  if (user.premiumExpiresAt && new Date(user.premiumExpiresAt) > now) return false;

  // Email verification check
  if (user.emailVerificationRequired && !user.emailVerifiedAt) return false;

  return true;
}

/**
 * Atomically starts a 15-day premium trial for a user upon authenticated first login.
 * This operation is fully idempotent and immune to race conditions (e.g., duplicate login
 * requests, multiple browser tabs, network retries).
 */
export async function ensureFirstLoginTrial(
  userId: Types.ObjectId,
  now = new Date(),
): Promise<{ started: boolean; endsAt?: Date }> {
  if (!env.PREMIUM_TRIAL_ENABLED || !env.PREMIUM_TRIAL_ROLLOUT_AT) {
    return { started: false };
  }

  const endsAt = new Date(now.getTime() + PREMIUM_TRIAL_MS);

  const result = await UserModel.updateOne(
    {
      _id: userId,
      role: 'user',
      status: 'active',
      createdAt: { $gte: env.PREMIUM_TRIAL_ROLLOUT_AT },
      hasUsedTrial: { $ne: true },
      premiumTrial: null,
      hasEverPurchasedPremium: { $ne: true },
      'premiumReceipts.orderCode': { $exists: false },
      $and: [
        {
          $or: [
            { premiumExpiresAt: null },
            { premiumExpiresAt: { $exists: false } },
            { premiumExpiresAt: { $lte: now } },
          ],
        },
        {
          $or: [
            { emailVerificationRequired: { $ne: true } },
            { emailVerifiedAt: { $ne: null } },
          ],
        },
      ],
    },
    {
      $set: {
        hasUsedTrial: true,
        premiumTrial: {
          startedAt: now,
          endsAt,
          planCode: 'trial_15d',
          requestKey: 'first_login',
        },
        welcomeTrialPopupSeenAt: null,
      },
    },
  );

  if (result.modifiedCount === 1) {
    logger.info(
      { userId: String(userId), endsAt: endsAt.toISOString(), trialDays: env.PREMIUM_TRIAL_DAYS },
      'FIRST_LOGIN_TRIAL_ACTIVATED',
    );
    return { started: true, endsAt };
  }

  return { started: false };
}

/**
 * Marks the welcome trial popup as seen. Idempotent.
 */
export async function markWelcomePopupSeen(
  userId: Types.ObjectId,
  now = new Date(),
): Promise<{ success: boolean }> {
  await UserModel.updateOne(
    { _id: userId, welcomeTrialPopupSeenAt: null },
    { $set: { welcomeTrialPopupSeenAt: now } },
  );
  return { success: true };
}
