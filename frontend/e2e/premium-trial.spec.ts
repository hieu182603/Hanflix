import { expect, test, type Page } from "@playwright/test"

async function setup(page: Page) {
  const start = Date.now()

  const end = new Date(start + 15 * 86400000).toISOString()

  const state = {
    authenticated: false,
    seen: false,
    seenCalls: 0,
    subscriptionReads: 0,
    paymentCalls: 0,
    expired: false,
  }

  const subscription = () => ({
    status: state.expired ? "EXPIRED" : "TRIAL",
    tier: state.expired ? "free" : "premium",

    hasPremiumAccess: !state.expired,
    hasUsedPremiumTrial: true,
    trialEligible: false,

    premiumExpiresAt: state.expired
      ? new Date(start - 1000).toISOString()
      : end,

    showWelcomeTrialPopup: !state.seen && !state.expired,
    benefits: [],

    trial: {
      startedAt: new Date(start).toISOString(),
      endsAt: end,
      remainingSeconds: state.expired ? 0 : 15 * 86400,
    },

    premium: { startedAt: null, endsAt: null },
  })

  const user = () => ({
    id: "trial-user",
    name: "Trial learner",
    email: "trial@example.test",
    role: "user",
    status: "active",

    premiumExpiresAt: subscription().premiumExpiresAt,
    learningProfile: { currentHsk: 1, surveyVersion: 1 },
  })

  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "")

    let data: unknown = { items: [], total: 0, totalPages: 1 }

    if (path === "/auth/refresh") {
      if (!state.authenticated)
        return route.fulfill({
          status: 401,
          json: { error: { code: "REFRESH_REQUIRED" } },
        })

      data = { accessToken: "trial-test-token" }
    } else if (path === "/auth/login") {
      state.authenticated = true

      data = {
        accessToken: "trial-test-token",
        user: user(),
        subscription: subscription(),
        ui: { showWelcomeTrialPopup: !state.seen },
      }
    } else if (path === "/auth/me")
      data = {
        user: user(),
        subscription: subscription(),
        ui: { showWelcomeTrialPopup: !state.seen && !state.expired },
      }
    else if (path === "/auth/providers") data = { googleClientId: null }
    else if (path === "/auth/trial-welcome/seen") {
      state.seen = true
      state.seenCalls++
      data = { success: true }
    } else if (path === "/billing/subscription") {
      state.subscriptionReads++
      data = subscription()
    } else if (path === "/billing/plans")
      data = {
        paymentAvailable: true,
        benefits: [],
        plans: [
          {
            code: "monthly",
            name: "1 tháng",

            durationMonths: 1,
            price: 99000,
            pricePerMonth: 99000,
            approximatePricePerDay: 3300,
            currency: "VND",
            savings: 0,
            savingsPercent: 0,
          },
        ],
      }
    else if (path === "/billing/subscribe" || path === "/billing/checkout")
      state.paymentCalls++
    else if (path === "/learning/streak")
      data = {
        streakCount: 0,
        longestStreak: 0,
        weekDays: [],
        today: "2026-10-04",
        isCompletedToday: false,
      }

    await route.fulfill({ json: { data } })
  })

  return state
}

async function firstLogin(page: Page) {
  await page.goto("/premium")

  await page.getByRole("button", { name: "Nâng cấp ngay", exact: true }).click()

  await expect(page).toHaveURL(/auth\/login/)

  await page.locator("#login-email").fill("trial@example.test")

  await page.locator("#login-password").fill("Password123!")

  await page.getByRole("button", { name: "Đăng nhập ngay" }).click()

  await expect(
    page.getByRole("dialog", { name: /Chào mừng bạn đến với HanFlix/ }),
  ).toBeVisible()
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
]) {
  test(`first-login popup, focus, dismissal and cache clearing at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)

    const state = await setup(page)

    await firstLogin(page)

    const dialog = page.getByRole("dialog", {
      name: /Chào mừng bạn đến với HanFlix/,
    })

    await expect(dialog.getByText("15 NGÀY PREMIUM MIỄN PHÍ")).toBeVisible()

    await expect(
      dialog.getByText("Không cần thẻ • Không tự động gia hạn"),
    ).toBeVisible()

    await expect(
      dialog.getByRole("button", { name: "Đóng", exact: true }),
    ).toBeFocused()

    await page.keyboard.press("Shift+Tab")

    await expect(dialog.getByRole("button", { name: "Để sau" })).toBeFocused()

    await page.keyboard.press("Tab")

    await expect(
      dialog.getByRole("button", { name: "Đóng", exact: true }),
    ).toBeFocused()

    expect(
      await dialog.evaluate((el) => {
        const r = el.getBoundingClientRect()
        return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight
      }),
    ).toBe(true)

    await page.screenshot({ path: testInfo.outputPath("welcome.png") })

    await page.keyboard.press("Escape")

    await expect(dialog).toHaveCount(0)

    expect(state.seenCalls).toBe(1)

    expect(state.paymentCalls).toBe(0)

    await page.evaluate(() => localStorage.clear())

    await page.reload()

    await expect(
      page.getByText("Bạn đang trải nghiệm HanFlix Premium miễn phí."),
    ).toBeVisible()

    await expect(dialog).toHaveCount(0)

    expect(state.seenCalls).toBe(1)
  })
}

test("reduced motion disables confetti; expiry refresh retains authenticated session", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })

  const state = await setup(page)

  await firstLogin(page)

  const dialog = page.getByRole("dialog", {
    name: /Chào mừng bạn đến với HanFlix/,
  })

  await expect(dialog.locator("canvas")).toHaveCount(0)

  await dialog.getByRole("button", { name: "Để sau" }).click()

  await expect(dialog).toHaveCount(0)

  state.expired = true

  const reads = state.subscriptionReads

  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("hanflix:entitlement-denied", {
        detail: { code: "TRIAL_EXPIRED" },
      }),
    ),
  )

  await expect(
    page.getByText("Thời gian dùng thử Premium đã kết thúc.", { exact: true }),
  ).toBeVisible()

  expect(state.subscriptionReads).toBeGreaterThan(reads)

  await expect(page).toHaveURL(/\/premium$/)

  expect(state.authenticated).toBe(true)
})
