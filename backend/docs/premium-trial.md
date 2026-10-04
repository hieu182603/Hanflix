# Premium Trial: first authenticated login

## Existing architecture and reuse

Express + Mongoose stores entitlement on User. Paid orders use an immutable plan/price snapshot, a unique order code, and a per-user idempotency key. payOS is verified on the server; user-document receipts make entitlement grants replay-safe even if the process stops before the order is marked PAID. React reuses its auth state, TanStack Query, the existing Premium guards, and Framer Motion.

## Business flow

Register (Free, email verification if required) → first successful password/Google login → automatic 15-day trial → welcome popup → exact expiry → Free → plan selection → payOS → server verification → paid Premium.

- Register and GET /auth/me never activate a trial.
- Only the first eligible authenticated login activates it. Google signup that authenticates the user counts as its first login.
- One trial per account, recorded permanently in `premiumTrial` and `hasUsedTrial`.
- Trial lasts exactly 15 × 24 hours (1,296,000,000 milliseconds), calculated using server UTC.
- No card, voucher, recurring payment, automatic charge, zero-value order or payOS call during activation.
- Old accounts are excluded by the explicit rollout timestamp. Active paid users, previous purchasers and unverified/locked accounts cannot receive a new trial.

## Rollout configuration

Set explicitly in the deployment environment:

```dotenv
PREMIUM_TRIAL_ENABLED=true
PREMIUM_TRIAL_DAYS=15
# Example only: choose the actual deployment cutoff, including timezone.
PREMIUM_TRIAL_ROLLOUT_AT=2026-10-04T00:00:00.000Z
```

Without configuration, the feature is disabled. Enabling it without a rollout timestamp fails startup. Invalid dates, dates without a timezone, invalid booleans and durations other than 15 fail validation. Disabling future grants does not revoke existing trials.

## Data and migration

The additive User fields are premiumTrial, hasUsedTrial, welcomeTrialPopupSeenAt, premiumStartedAt, premiumPlanCode and hasEverPurchasedPremium. Existing paid expiry and learning data are preserved. No expiration cron is necessary; every guard checks the current deadline. Do not remove trial records after expiry.

The optional `scripts/migrate-premium-history.ts` reconciles old payment receipts/orders into hasEverPurchasedPremium. It defaults to dry-run; `--apply` only sets that history flag. It does not grant trials, reset expiry or delete anything. Review unknown-history counts before rollout. It was tested on an isolated local database, not production.

Indexes: existing unique userId/idempotencyKey and orderCode indexes remain. The new userId/status index supports migration/history lookup. Activation uses the existing _id index; it does not need a low-cardinality hasUsedTrial index or a TTL index on trial expiry.

## Service boundaries and API

- `trial.service.ts`: eligibility, atomic conditional first-login grant, idempotent popup acknowledgement.
- `premium-access.ts`: shared paid/trial access, expiry and paid extension timing.
- `subscription.ts`: read-only subscription projection and paid checkout delegation. No trial branch in plan selection.
- `POST /auth/login`, `POST /auth/google`: authenticate first, grant eligible trial atomically, read the persisted result (also when another login wins).
- `GET /auth/me`, `GET /billing/subscription`: return status, hasPremiumAccess, trial dates/remainingSeconds, paid dates/plan and showWelcomeTrialPopup.
- `POST /auth/trial-welcome/seen`: authenticated, user-scoped, idempotent. Existing /user and /billing aliases remain compatible.
- `POST /billing/subscribe`: strict planCode, optional expectedPrice comparison and UUID idempotency header; returns only PAYMENT_REQUIRED with a server-priced order. The browser supplies its displayed price as an optimistic comparison, never a price override. Existing /billing/checkout remains supported.

The public premiumExpiresAt is the effective access deadline for older clients; trial.endsAt and premium.endsAt remain distinct. EXPIRED has tier=free and hasPremiumAccess=false. Expiry performs no database downgrade and no data deletion.

## Payment during trial

Append the purchase at max(now, trial end, existing paid end), then add calendar months using the existing UTC month-end clamping rule. Preserve the beginning of an already purchased continuous paid period when extending it. While the trial is running, the UI displays its deadline and the scheduled paid plan. At the trial deadline paid access continues without a gap. Admin grants use the same append rule.

The frontend never grants Premium from return URL parameters. It polls the owned order endpoint, which reconciles payOS server-side. Duplicate webhooks and recovery after a partial write reuse the embedded receipt. Missing payment-bank details are never replaced with a hardcoded recipient.

## Frontend behavior

Welcome state comes from the backend. Dismissal saves acknowledgement before closing; a failed acknowledgement offers retry. The modal traps/restores focus, supports Escape, scrolls on short screens, and disables confetti/movement for reduced motion. Confetti stops after 1.3 seconds and cancels its animation on unmount.

Every Premium-denial response requests subscription refresh and immediately closes access to protected views without clearing auth. Mutations can open the paywall; background GET requests do not repeatedly open it. Subscription refresh, focus/online events and deadline timers keep the UI current. Pricing only offers paid upgrade/renewal actions.

## Validation

MongoDB lifecycle tests are opt-in and only accept a disposable loopback URI:

```powershell
$env:SUBSCRIPTION_TEST_MONGODB_URI = 'mongodb://127.0.0.1:27119'
$env:BILLING_TEST_MONGODB_URI = 'mongodb://127.0.0.1:27119'
node node_modules/vitest/vitest.mjs run --maxWorkers=2
```

Tests create uniquely named databases and drop only their own database. Browser tests cover first login, popup persistence, mobile/tablet/desktop layouts, focus, reduced motion, expiry and the existing payment return flow. Browser API responses and the payOS provider are simulated; a real merchant checkout/webhook smoke test remains a deployment check.
