import { env } from '../config/env.js';

// One access policy for middleware, user responses and subscription services.
export const PREMIUM_TRIAL_DAYS = env.PREMIUM_TRIAL_DAYS;
export const PREMIUM_TRIAL_MS = PREMIUM_TRIAL_DAYS * 24 * 60 * 60 * 1000;

export interface PremiumEntitlement {
  role?: string;
  premiumExpiresAt?: Date | null;
  premiumStartedAt?: Date | null;
  premiumPlanCode?: string | null;
  premiumTrial?: { startedAt: Date; endsAt: Date; planCode: string } | null;
}

export function premiumAccessEndsAt(user?: PremiumEntitlement | null): Date | null {
  const paid = user?.premiumExpiresAt;
  const trial = user?.premiumTrial?.endsAt;
  if (!paid) return trial ?? null;
  return trial && trial > paid ? trial : paid;
}

export function hasPremium(user?: PremiumEntitlement | null, now = new Date()) {
  return user?.role === 'admin' || Boolean(user && (paidActive(user, now) || trialActive(user, now)));
}

function paidActive(user: PremiumEntitlement, now: Date) {
  return Boolean(user.premiumExpiresAt && user.premiumExpiresAt > now && (!user.premiumStartedAt || user.premiumStartedAt <= now));
}

function trialActive(user: PremiumEntitlement, now: Date) {
  return Boolean(user.premiumTrial && user.premiumTrial.startedAt <= now && user.premiumTrial.endsAt > now);
}

export function subscriptionState(user: PremiumEntitlement, now = new Date()) {
  if (user.role === 'admin') return 'ACTIVE';

  // Active paid premium currently running
  if (paidActive(user, now)) return 'ACTIVE';

  // Active trial currently running (even if future paid is scheduled)
  if (trialActive(user, now)) return 'TRIAL';

  return user.premiumTrial || user.premiumExpiresAt ? 'EXPIRED' : 'FREE';
}

export function nextPremiumStart(user: PremiumEntitlement, now: Date) {
  const end = premiumAccessEndsAt(user);
  return end && end > now ? end : now;
}

// Extensions append at the end, but must retain the beginning of the paid period.
export function paidPeriodStart(user: PremiumEntitlement, extensionStart: Date, now: Date) {
  if (user.premiumExpiresAt && user.premiumExpiresAt > now) {
    return user.premiumStartedAt ?? (user.premiumTrial && user.premiumTrial.endsAt > now ? user.premiumTrial.endsAt : now);
  }
  return extensionStart;
}
