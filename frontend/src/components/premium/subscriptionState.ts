import type { UserSubscription } from "../../api/billing"

export type SubscriptionViewState = "FREE_TRIAL_ELIGIBLE" | "TRIAL_ACTIVE" | "TRIAL_EXPIRED" | "PREMIUM_ACTIVE" | "FREE_NOT_ELIGIBLE"

/**
 * Pure selector that computes UI-derived state from backend subscription data.
 * Backend is the absolute source of truth.
 */
export function getSubscriptionViewState(
  subscription?: UserSubscription | null,
  currentUser?: {
    role?: string
    premiumExpiresAt?: Date | string | null
    subscriptionStatus?: string
    hasPremiumAccess?: boolean
  } | null,
): SubscriptionViewState {
  if (currentUser?.role === "admin") {
    return "PREMIUM_ACTIVE"
  }

  if (subscription) {
    const expiry =
      subscription.premiumExpiresAt &&
      new Date(subscription.premiumExpiresAt).getTime()
    if (expiry && expiry <= Date.now())
      return subscription.hasUsedPremiumTrial || subscription.trial
        ? "TRIAL_EXPIRED"
        : "FREE_NOT_ELIGIBLE"
    if (subscription.status === "ACTIVE") {
      return subscription.hasPremiumAccess === false
        ? "FREE_NOT_ELIGIBLE"
        : "PREMIUM_ACTIVE"
    }

    if (subscription.status === "TRIAL") {
      if (
        subscription.premium?.startedAt &&
        new Date(subscription.premium.startedAt).getTime() <= Date.now() &&
        subscription.hasPremiumAccess
      )
        return "PREMIUM_ACTIVE"
      return subscription.hasPremiumAccess ? "TRIAL_ACTIVE" : "TRIAL_EXPIRED"
    }

    if (subscription.status === "EXPIRED") {
      return "TRIAL_EXPIRED"
    }

    if (subscription.status === "FREE") {
      if (subscription.trialEligible) {
        return "FREE_TRIAL_ELIGIBLE"
      }
      if (subscription.hasUsedPremiumTrial) {
        return "TRIAL_EXPIRED"
      }
      return "FREE_NOT_ELIGIBLE"
    }

    // Fallback if status field is missing (legacy backend mocks)
    if (subscription.tier === "premium") {
      return "PREMIUM_ACTIVE"
    }
    if (subscription.trialEligible) {
      return "FREE_TRIAL_ELIGIBLE"
    }
    if (subscription.hasUsedPremiumTrial) {
      return "TRIAL_EXPIRED"
    }
    return "FREE_NOT_ELIGIBLE"
  }

  // Fallback when only currentUser is available before subscription query resolves
  if (currentUser?.hasPremiumAccess === false) return "FREE_NOT_ELIGIBLE"
  if (currentUser?.premiumExpiresAt) {
    const expiresAt = new Date(currentUser.premiumExpiresAt)
    if (expiresAt > new Date()) {
      return currentUser.subscriptionStatus === "TRIAL"
        ? "TRIAL_ACTIVE"
        : "PREMIUM_ACTIVE"
    }
    return "TRIAL_EXPIRED"
  }

  return "FREE_NOT_ELIGIBLE"
}

/**
 * Calculates user-friendly remaining trial time:
 * - "Còn X ngày" (nếu > 1 ngày)
 * - "Còn 1 ngày"
 * - "Còn dưới 1 ngày"
 */
export function formatTrialRemaining(
  endsAt?: string | Date | null,
  remainingSeconds?: number | null,
): string {
  let seconds = 0
  if (typeof remainingSeconds === "number") {
    seconds = remainingSeconds
  } else if (endsAt) {
    const endMs = new Date(endsAt).getTime()
    seconds = Math.max(0, Math.ceil((endMs - Date.now()) / 1000))
  }

  if (seconds <= 0) {
    return "Đã kết thúc"
  }

  const days = Math.ceil(seconds / 86400)
  if (days > 1) {
    return `Còn ${days} ngày`
  }
  if (days === 1 && seconds >= 86400) {
    return "Còn 1 ngày"
  }
  return "Còn dưới 1 ngày"
}

/**
 * Returns true if trial has <= 7 days remaining.
 */
export function isTrialExpiringSoon(
  endsAt?: string | Date | null,
  remainingSeconds?: number | null,
): boolean {
  let seconds = 0
  if (typeof remainingSeconds === "number") {
    seconds = remainingSeconds
  } else if (endsAt) {
    const endMs = new Date(endsAt).getTime()
    seconds = Math.max(0, Math.ceil((endMs - Date.now()) / 1000))
  }
  return seconds > 0 && seconds <= 7 * 86400
}

/**
 * Format end date to DD/MM/YYYY
 */
export function formatTrialEndDate(
  endsAt?: string | Date | null,
  locale = "vi-VN",
): string {
  if (!endsAt) return ""
  const d = new Date(endsAt)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleDateString(locale)
}
