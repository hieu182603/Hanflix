import { describe, expect, it } from 'vitest';
import { hasPremium, nextPremiumStart, PREMIUM_TRIAL_DAYS, PREMIUM_TRIAL_MS, subscriptionState } from './premium-access.js';

describe('Premium access time policy', () => {
  it('configured trial duration is 15 days', () => {
    expect(PREMIUM_TRIAL_DAYS).toBe(15);
    expect(PREMIUM_TRIAL_MS).toBe(15 * 24 * 60 * 60 * 1000);
  });

  it.each(['2026-10-20T10:00:00Z', '2028-02-01T23:59:59Z', '2026-03-08T01:30:00-05:00'])('expires exactly 15 elapsed UTC days after %s', input => {
    const startedAt = new Date(input);
    const endsAt = new Date(startedAt.getTime() + PREMIUM_TRIAL_MS);
    const user = { premiumTrial: { startedAt, endsAt, planCode: 'trial_15d' } };
    expect(hasPremium(user, new Date(endsAt.getTime() - 1))).toBe(true);
    expect(hasPremium(user, endsAt)).toBe(false);
    expect(subscriptionState(user, endsAt)).toBe('EXPIRED');
    expect(nextPremiumStart(user, new Date(endsAt.getTime() + 1))).toEqual(new Date(endsAt.getTime() + 1));
  });

  it('paid/admin expiry dominates an expired trial; no cached status can revoke it', () => {
    const now = new Date('2026-11-20');
    const user = { premiumExpiresAt: new Date('2026-12-19'), premiumTrial: {
      startedAt: new Date('2026-10-20'), endsAt: new Date('2026-11-04'), planCode: 'trial_15d',
    } };
    expect(hasPremium(user, now)).toBe(true);
    expect(subscriptionState(user, now)).toBe('ACTIVE');
    expect(hasPremium({ role: 'admin' }, now)).toBe(true);
    expect(hasPremium({}, now)).toBe(false);
    expect(subscriptionState({}, now)).toBe('FREE');
  });

  it('scheduled future paid premium during trial keeps trial active and preserves trial days', () => {
    const now = new Date('2026-10-10T12:00:00.000Z');
    const trialEndsAt = new Date('2026-10-19T00:00:00.000Z');
    const user = {
      premiumTrial: {
        startedAt: new Date('2026-10-04T00:00:00.000Z'),
        endsAt: trialEndsAt,
        planCode: 'trial_15d',
      },
      premiumStartedAt: trialEndsAt,
      premiumExpiresAt: new Date('2026-11-19T00:00:00.000Z'),
    };

    expect(hasPremium(user, now)).toBe(true);
    // User is in TRIAL state during the trial window, even though paid premium is already scheduled
    expect(subscriptionState(user, now)).toBe('TRIAL');

    // After trialEndsAt, user cleanly transitions to ACTIVE paid premium
    const afterTrial = new Date('2026-10-19T00:00:01.000Z');
    expect(hasPremium(user, afterTrial)).toBe(true);
    expect(subscriptionState(user, afterTrial)).toBe('ACTIVE');
  });
});

it('does not grant future paid entitlement before its start without an active trial', () => {
  const user = { premiumStartedAt: new Date('2026-11-01'), premiumExpiresAt: new Date('2026-12-01') };
  expect(hasPremium(user, new Date('2026-10-10'))).toBe(false);
  expect(hasPremium(user, new Date('2026-11-01'))).toBe(true);
});
