import { describe, expect, it } from "vitest"
import {
  getSubscriptionViewState,
  formatTrialRemaining,
  isTrialExpiringSoon,
  formatTrialEndDate,
} from "../subscriptionState"
import type { UserSubscription } from "../../../api/billing"

describe("subscriptionState - getSubscriptionViewState", () => {
  it("returns PREMIUM_ACTIVE when user is admin regardless of subscription", () => {
    expect(getSubscriptionViewState(null, { role: "admin" })).toBe(
      "PREMIUM_ACTIVE",
    )
    expect(
      getSubscriptionViewState(
        {
          status: "FREE",
          trialEligible: true,
          tier: "free",
          premiumExpiresAt: null,
          benefits: [],
        },
        { role: "admin" },
      ),
    ).toBe("PREMIUM_ACTIVE")
  })

  it("returns FREE_TRIAL_ELIGIBLE when status is FREE and trialEligible is true", () => {
    const sub: UserSubscription = {
      status: "FREE",
      tier: "free",
      trialEligible: true,
      hasPremiumAccess: false,
      premiumExpiresAt: null,
      trial: null,
      benefits: [],
    }
    expect(getSubscriptionViewState(sub, { role: "user" })).toBe(
      "FREE_TRIAL_ELIGIBLE",
    )
  })

  it("returns TRIAL_ACTIVE when status is TRIAL and hasPremiumAccess is true", () => {
    const sub: UserSubscription = {
      status: "TRIAL",
      tier: "premium",
      hasPremiumAccess: true,
      trialEligible: false,
      premiumExpiresAt: "2026-11-01T00:00:00.000Z",
      trial: {
        startedAt: "2026-10-01T00:00:00.000Z",
        endsAt: "2026-11-01T00:00:00.000Z",
        planCode: "monthly",
        remainingSeconds: 2400000,
      },
      benefits: [],
    }
    expect(getSubscriptionViewState(sub, { role: "user" })).toBe("TRIAL_ACTIVE")
  })

  it("returns TRIAL_EXPIRED when status is TRIAL but hasPremiumAccess is false", () => {
    const sub: UserSubscription = {
      status: "TRIAL",
      tier: "free",
      hasPremiumAccess: false,
      trialEligible: false,
      premiumExpiresAt: "2026-10-01T00:00:00.000Z",
      trial: {
        startedAt: "2026-09-01T00:00:00.000Z",
        endsAt: "2026-10-01T00:00:00.000Z",
        planCode: "monthly",
        remainingSeconds: 0,
      },
      benefits: [],
    }
    expect(getSubscriptionViewState(sub, { role: "user" })).toBe(
      "TRIAL_EXPIRED",
    )
  })

  it("returns TRIAL_EXPIRED when status is EXPIRED", () => {
    const sub: UserSubscription = {
      status: "EXPIRED",
      tier: "free",
      hasPremiumAccess: false,
      trialEligible: false,
      hasUsedPremiumTrial: true,
      premiumExpiresAt: null,
      trial: null,
      benefits: [],
    }
    expect(getSubscriptionViewState(sub, { role: "user" })).toBe(
      "TRIAL_EXPIRED",
    )
  })

  it("returns FREE_NOT_ELIGIBLE when status is FREE and trialEligible is false without trial history", () => {
    const sub: UserSubscription = {
      status: "FREE",
      tier: "free",
      hasPremiumAccess: false,
      trialEligible: false,
      hasUsedPremiumTrial: false,
      premiumExpiresAt: null,
      trial: null,
      benefits: [],
    }
    expect(getSubscriptionViewState(sub, { role: "user" })).toBe(
      "FREE_NOT_ELIGIBLE",
    )
  })

  it("returns TRIAL_EXPIRED when status is FREE, trialEligible is false and hasUsedPremiumTrial is true", () => {
    const sub: UserSubscription = {
      status: "FREE",
      tier: "free",
      hasPremiumAccess: false,
      trialEligible: false,
      hasUsedPremiumTrial: true,
      premiumExpiresAt: null,
      trial: null,
      benefits: [],
    }
    expect(getSubscriptionViewState(sub, { role: "user" })).toBe(
      "TRIAL_EXPIRED",
    )
  })

  it("returns PREMIUM_ACTIVE when status is ACTIVE", () => {
    const sub: UserSubscription = {
      status: "ACTIVE",
      tier: "premium",
      hasPremiumAccess: true,
      trialEligible: false,
      premiumExpiresAt: "2027-01-01T00:00:00.000Z",
      trial: null,
      benefits: [],
    }
    expect(getSubscriptionViewState(sub, { role: "user" })).toBe(
      "PREMIUM_ACTIVE",
    )
  })
})

describe("subscriptionState - formatTrialRemaining", () => {
  it("formats remaining seconds > 1 day", () => {
    expect(formatTrialRemaining(null, 25 * 86400)).toBe("Còn 25 ngày")
    expect(formatTrialRemaining(null, 10 * 86400)).toBe("Còn 10 ngày")
    expect(formatTrialRemaining(null, 2 * 86400)).toBe("Còn 2 ngày")
  })

  it("formats remaining seconds around 1 day", () => {
    expect(formatTrialRemaining(null, 86400)).toBe("Còn 1 ngày")
  })

  it("formats remaining seconds < 1 day", () => {
    expect(formatTrialRemaining(null, 3600)).toBe("Còn dưới 1 ngày")
    expect(formatTrialRemaining(null, 60)).toBe("Còn dưới 1 ngày")
  })

  it("formats 0 or negative seconds as ended", () => {
    expect(formatTrialRemaining(null, 0)).toBe("Đã kết thúc")
    expect(formatTrialRemaining(null, -10)).toBe("Đã kết thúc")
  })
})

describe("subscriptionState - isTrialExpiringSoon", () => {
  it("returns true when remaining time <= 7 days and > 0", () => {
    expect(isTrialExpiringSoon(null, 7 * 86400)).toBe(true)
    expect(isTrialExpiringSoon(null, 5 * 86400)).toBe(true)
    expect(isTrialExpiringSoon(null, 86400)).toBe(true)
  })

  it("returns false when remaining time > 7 days or <= 0", () => {
    expect(isTrialExpiringSoon(null, 8 * 86400)).toBe(false)
    expect(isTrialExpiringSoon(null, 30 * 86400)).toBe(false)
    expect(isTrialExpiringSoon(null, 0)).toBe(false)
  })
})

describe("subscriptionState - formatTrialEndDate", () => {
  it("formats valid date string", () => {
    const formatted = formatTrialEndDate("2026-11-19T00:00:00.000Z", "vi-VN")
    expect(formatted).toMatch(/19\/11\/2026/)
  })

  it("returns empty string for null or invalid date", () => {
    expect(formatTrialEndDate(null)).toBe("")
    expect(formatTrialEndDate("invalid")).toBe("")
  })
})
