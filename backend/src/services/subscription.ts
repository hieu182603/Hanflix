import type { Types } from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { UserModel, type User } from '../models/user.model.js';
import { PaymentOrderModel } from '../models/payment-order.model.js';
import { PremiumPlanModel } from '../models/premium-plan.model.js';
import { createCheckout } from './billing.js';
import { hasPremium, premiumAccessEndsAt, subscriptionState } from './premium-access.js';
import { PREMIUM_BENEFITS } from './premium.js';
import { logger } from './logger.js';
import { isTrialEligible } from './trial.service.js';

type SubscriptionUser = Pick<User, 'role' | 'status' | 'createdAt' | 'hasUsedTrial' | 'hasEverPurchasedPremium' | 'premiumTrial' | 'premiumStartedAt' | 'premiumExpiresAt' | 'premiumPlanCode' | 'welcomeTrialPopupSeenAt' | 'emailVerifiedAt' | 'emailVerificationRequired'>;

async function loadUser(userId: Types.ObjectId) {
  const user = await UserModel.findById(userId).select('+emailVerificationRequired').lean();
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản');
  return user;
}

export async function getCurrentSubscription(userId: Types.ObjectId, now = new Date(), cachedUser?: SubscriptionUser) {
  const user = cachedUser ?? await loadUser(userId);
  const status = subscriptionState(user, now);
  const access = hasPremium(user, now);
  // Expiry is derived, never a destructive downgrade write. Log observation
  // on a subscription read; guards enforce deadlines even without this read.
  if (status === 'EXPIRED') logger.info({ userId: String(userId) }, user.premiumExpiresAt ? 'PREMIUM_EXPIRED' : 'PREMIUM_TRIAL_EXPIRED');
  return {
    status, tier: access ? 'premium' as const : 'free' as const,
    hasPremiumAccess: access,
    // Legacy clients consume this as the effective access deadline.
    premiumExpiresAt: premiumAccessEndsAt(user),
    planCode: status === 'TRIAL' ? user.premiumTrial!.planCode : user.premiumPlanCode ?? user.premiumTrial?.planCode ?? null,
    hasUsedPremiumTrial: Boolean(user.premiumTrial || user.hasUsedTrial),
    trialEligible: isTrialEligible(user, now),
    showWelcomeTrialPopup: Boolean(status === 'TRIAL' && user.welcomeTrialPopupSeenAt == null),
    trial: user.premiumTrial ? {
      startedAt: user.premiumTrial.startedAt, endsAt: user.premiumTrial.endsAt,
      planCode: user.premiumTrial.planCode,
      remainingSeconds: Math.max(0, Math.ceil((user.premiumTrial.endsAt.getTime() - now.getTime()) / 1000)),
    } : null,
    premium: { startedAt: user.premiumStartedAt ?? null, endsAt: user.premiumExpiresAt ?? null, planCode: user.premiumPlanCode ?? null },
    benefits: access ? PREMIUM_BENEFITS : ['5 video mẫu', 'Phụ đề Chữ Hán – Pinyin – Tiếng Việt', 'Tra cứu từ vựng cơ bản'],
  };
}

export async function subscribePremium(userId: Types.ObjectId, input: {
  planCode: 'monthly' | 'quarterly' | 'yearly'; idempotencyKey: string; expectedPrice?: number;
}) {
  const user = await loadUser(userId);
  if (user.status !== 'active') throw new AppError(401, 'ACCOUNT_UNAVAILABLE', 'Tài khoản không khả dụng');
  // Recover an earlier payment snapshot before looking at today's price/status.
  const existingOrder = await PaymentOrderModel.findOne({ userId, idempotencyKey: input.idempotencyKey }).lean();
  if (existingOrder) return {
    type: 'PAYMENT_REQUIRED' as const,
    order: await createCheckout(userId, { ...input, expectedPrice: input.expectedPrice ?? existingOrder.amount }),
  };
  const plan = await PremiumPlanModel.findOne({ code: input.planCode }).lean();
  if (!plan) throw new AppError(404, 'PLAN_NOT_FOUND', 'Không tìm thấy gói Premium');
  if (!plan.active) throw new AppError(409, 'PLAN_INACTIVE', 'Gói này hiện không được mở bán');

  return { type: 'PAYMENT_REQUIRED' as const, order: await createCheckout(userId, { ...input, expectedPrice: input.expectedPrice ?? plan.price }) };
}
