import { fileURLToPath } from "node:url"

import { expect, test, type Page } from "@playwright/test"

const userId = "507f1f77bcf86cd799439011"

const expiry = "2027-09-29T10:00:00.000Z"

const plan = {
  code: "monthly",
  name: "1 tháng",
  durationMonths: 1,
  price: 120000,
  pricePerMonth: 120000,

  approximatePricePerDay: 4000,
  savings: 0,
  savingsPercent: 0,
  active: true,
  revision: 1,
  currency: "VND",
}

const order = {
  orderCode: 123456,
  planCode: "monthly",
  planName: "1 tháng",
  durationMonths: 1,
  amount: 120000,
  currency: "VND",

  status: "PENDING",
  checkoutUrl: "https://pay.payos.vn/web/test-only",
  expiresAt: new Date(Date.now() + 1_800_000).toISOString(),

  createdAt: new Date().toISOString(),
  premiumExpiresAt: null,
}

async function setup(page: Page, role: "user" | "admin" = "user") {
  const state = {
    paid: false,
    creates: [] as string[],
    grants: [] as unknown[],
    userExpiry: null as string | null,
  }

  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "")

    let data: unknown = { items: [], total: 0, totalPages: 1 }

    if (path === "/auth/refresh") data = { accessToken: "billing-test-token" }
    else if (path === "/auth/me")
      data = {
        user: {
          id: role === "admin" ? "admin-id" : userId,
          role,
          status: "active",
          name: "Học viên",
          email: "learner@example.test",
          premiumExpiresAt: state.paid ? expiry : state.userExpiry,
          learningProfile: { surveyVersion: 1, currentHsk: 1 },
        },
      }
    else if (path === "/learning/streak")
      data = {
        streakCount: 0,
        longestStreak: 0,
        weekDays: [],
        today: "2026-09-29",
        timezone: "Asia/Ho_Chi_Minh",
        isCompletedToday: false,
        lastActiveDate: null,
      }
    else if (path === "/grammar/stats") data = { total: 0, byLevel: {} }
    else if (path === "/grammar")
      data = { items: [], pagination: { page: 1, total: 0, totalPages: 1 } }
    else if (path === "/billing/plans")
      data = {
        plans: [plan],
        benefits: ["Xem video học không giới hạn"],
        paymentAvailable: true,
        freeSampleLessonIds: [],
      }
    else if (path === "/billing/subscription")
      data = {
        tier: state.paid ? "premium" : "free",
        premiumExpiresAt: state.paid ? expiry : null,
        benefits: [],
      }
    else if (path === "/billing/subscribe") {
      state.creates.push(route.request().headers()["idempotency-key"])
      data = { type: "PAYMENT_REQUIRED", order }
    } else if (path === "/billing/orders/123456")
      data = {
        ...order,
        status: state.paid ? "PAID" : "PENDING",
        premiumExpiresAt: state.paid ? expiry : null,
      }
    else if (path === "/admin/users")
      data = {
        items: [
          {
            _id: userId,
            role: "user",
            status: "active",
            name: "Học viên",
            email: "learner@example.test",
            premiumExpiresAt: state.userExpiry,
          },
        ],
        hasMore: false,
      }
    else if (path === "/admin/billing/plans")
      data = { items: [plan], paymentAvailable: true }
    else if (path.endsWith("/grants"))
      data = { premiumExpiresAt: state.userExpiry, items: state.grants }
    else if (path.endsWith("/activate")) {
      const input = route.request().postDataJSON()

      const grant = {
        ...input,
        durationMonths: 1,
        grantId: route.request().headers()["idempotency-key"],
        grantedBy: "admin-id",
        grantedAt: new Date().toISOString(),
        expiresAt: expiry,
      }

      state.userExpiry = expiry
      state.grants.push(grant)

      data = { userId, premiumExpiresAt: expiry, grant, replayed: false }
    }

    await route.fulfill({ json: { data } })
  })

  return state
}

test("checkout survives reopening, confirms payment and updates the header", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))

  const state = await setup(page)

  await page.goto("/premium")

  await page.getByRole("button", { name: "Nâng cấp ngay" }).click()

  const dialog = page.getByRole("dialog", {
    name: "Thanh toán HanFlix Premium",
  })

  await expect(
    dialog.getByRole("link", { name: "Mở cổng payOS tab mới" }),
  ).toHaveAttribute("href", order.checkoutUrl)

  await expect(dialog.locator('img[src*="quickchart"]')).toHaveCount(0)

  const initialRequests = state.creates.length

  await dialog.getByRole("button", { name: "Đóng", exact: true }).click()

  await page.getByRole("button", { name: "Nâng cấp ngay" }).click()

  await expect.poll(() => state.creates.length).toBeGreaterThan(initialRequests)

  expect(new Set(state.creates).size).toBe(1)

  state.paid = true

  await expect(dialog).toHaveCount(0)

  await expect(page.getByRole("button", { name: /^VIP/ })).toBeVisible()

  expect(errors).toEqual([])
})

test("payment return verifies the order instead of trusting the query string on mobile", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const state = await setup(page)

  await page.goto("/premium/payment?orderCode=123456&status=PAID&cancel=false")

  await expect(
    page.getByRole("link", { name: "Mở cổng payOS tab mới" }),
  ).toBeVisible()

  await page.screenshot({ path: testInfo.outputPath("mobile-payment.png") })

  await expect(page.getByText("Thanh toán thành công!")).toHaveCount(0)

  expect(state.creates).toEqual([])

  state.paid = true

  await expect(page.getByText("Thanh toán thành công!")).toBeVisible()

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test("admin grants a package from the user detail and sees the audit record", async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))

  const state = await setup(page, "admin")

  await page.goto(`/admin/users/${userId}`)

  await expect(
    page.getByRole("heading", { name: "Kích hoạt gói Premium" }),
  ).toBeVisible()

  await page.getByLabel("Lý do kích hoạt").fill("Tặng gói học hỗ trợ")

  await page
    .getByRole("button", { name: "Kích hoạt gói cho người dùng" })
    .click()

  await expect(page.getByText(/Đã kích hoạt Premium đến/)).toBeVisible()

  await page.getByText("Lịch sử kích hoạt thủ công", { exact: true }).click()

  await expect(
    page.getByText("Tặng gói học hỗ trợ", { exact: true }),
  ).toBeVisible()

  expect(state.grants).toHaveLength(1)

  await page.screenshot({ path: testInfo.outputPath("admin-premium.png") })

  expect(errors).toEqual([])
})

test("returns to the original payment after an expired session requires login", async ({
  page,
}) => {
  const state = await setup(page)

  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: "REFRESH_REQUIRED", message: "Đăng nhập lại" } },
    }),
  )

  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      json: {
        data: {
          accessToken: "logged-in",
          user: {
            id: userId,
            role: "user",
            status: "active",
            name: "Học viên",
            email: "learner@example.test",
            learningProfile: { surveyVersion: 1 },
          },
        },
      },
    }),
  )

  await page.goto("/premium/payment?orderCode=123456&status=PAID")

  await expect(page).toHaveURL(/\/auth\/login/)

  await page.locator("#login-email").fill("learner@example.test")

  await page.locator("#login-password").fill("test-password")

  await page.getByRole("button", { name: "Đăng nhập ngay" }).click()

  await expect(page).toHaveURL(/\/premium\/payment\?orderCode=123456/)

  await expect(
    page.getByRole("link", { name: "Mở cổng payOS tab mới" }),
  ).toBeVisible()

  expect(state.creates).toHaveLength(0)
})

test("Free gates lead to pricing; a paid order unlocks grammar and expiry locks it again", async ({
  page,
}) => {
  const state = await setup(page)

  for (const path of [
    "/grammar",
    "/vocabulary",
    "/roadmap",
    "/history",
    "/exam",
  ]) {
    await page.goto(path)

    await expect(
      page.getByRole("link", { name: "Nâng cấp ngay", exact: true }),
    ).toHaveAttribute("href", "/premium")
  }

  await page.getByRole("link", { name: "Nâng cấp ngay", exact: true }).click()

  await expect(page).toHaveURL(/\/premium$/)

  await page.getByRole("button", { name: "Nâng cấp ngay" }).click()

  state.paid = true

  await expect(page.getByRole("button", { name: /^VIP/ })).toBeVisible()

  await page.goto("/grammar")

  await expect(
    page.getByRole("heading", { name: "Ngữ Pháp HSK 3.0" }),
  ).toBeVisible()

  state.paid = false

  state.userExpiry = "2020-01-01T00:00:00.000Z"

  await page.evaluate(() => window.dispatchEvent(new Event("focus")))

  await expect(
    page.getByRole("heading", { name: "Ngữ Pháp HSK 3.0" }),
  ).toHaveCount(0)

  await expect(
    page.getByRole("link", { name: "Nâng cấp ngay", exact: true }),
  ).toBeVisible()
})

test("guest returns to Premium after logging in from the pricing page", async ({
  page,
}) => {
  await setup(page)

  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: "REFRESH_REQUIRED", message: "Đăng nhập lại" } },
    }),
  )

  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      json: {
        data: {
          accessToken: "logged-in",
          user: {
            id: userId,
            role: "user",
            status: "active",
            name: "Học viên",
            email: "learner@example.test",
            learningProfile: { surveyVersion: 1 },
          },
        },
      },
    }),
  )

  await page.goto("/premium")

  await page.getByRole("button", { name: "Nâng cấp ngay", exact: true }).click()

  await expect(page).toHaveURL(/\/auth\/login/)

  await page.locator("#login-email").fill("learner@example.test")

  await page.locator("#login-password").fill("test-password")

  await page.getByRole("button", { name: "Đăng nhập ngay" }).click()

  await expect(page).toHaveURL(/\/premium$/)
})

test("pricing matches all three customer packages on desktop and mobile", async ({
  page,
}, testInfo) => {
  await setup(page)

  await page.route("**/api/v1/billing/plans", (route) =>
    route.fulfill({
      json: {
        data: {
          plans: [
            {
              ...plan,
              name: "1 tháng – Cơ bản",
              price: 99000,
              pricePerMonth: 99000,
              approximatePricePerDay: 3300,
            },

            {
              ...plan,
              code: "quarterly",
              name: "3 tháng – Được yêu thích nhất",
              durationMonths: 3,
              price: 249000,
              pricePerMonth: 83000,
              savings: 48000,
              savingsPercent: 16,
            },

            {
              ...plan,
              code: "yearly",
              name: "1 năm – Tiết kiệm",
              durationMonths: 12,
              price: 699000,
              pricePerMonth: 58250,
              savings: 489000,
              savingsPercent: 41,
            },
          ],

          benefits: [
            "Xem video học không giới hạn",
            "Phụ đề Chữ Hán – Pinyin – Tiếng Việt",
            "Tra cứu và lưu từ vựng trực tiếp trong video",

            "Mở khóa toàn bộ quiz/bài luyện tập",
            "AI cá nhân hóa & đề xuất nội dung",
            "Theo dõi tiến độ học tập",
            "Kho từ vựng & Flashcard",
            "Kho ngữ pháp",
          ],

          paymentAvailable: true,
        },
      },
    }),
  )

  await page.goto("/premium")

  await expect(page.getByText("99.000 đ", { exact: true })).toBeVisible()

  await expect(page.getByText("249.000 đ", { exact: true })).toBeVisible()

  await expect(page.getByText("699.000 đ", { exact: true })).toBeVisible()

  await expect(page.getByText("Tiết kiệm 48.000 đ (~16%)")).toBeVisible()

  await expect(page.getByText("Tiết kiệm 489.000 đ (~41%)")).toBeVisible()

  await expect(page.locator('[data-plan="quarterly"]')).toHaveClass(
    /border-\[#B91B1C\]/,
  )

  await page.screenshot({
    path: testInfo.outputPath("premium-desktop.png"),
    fullPage: true,
  })

  await page.setViewportSize({ width: 390, height: 844 })

  await page.locator('[data-plan="yearly"]').scrollIntoViewIfNeeded()

  await expect(page.getByText("58.250 đ/tháng")).toBeVisible()

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)

  await page.screenshot({
    path: testInfo.outputPath("premium-mobile.png"),
    fullPage: true,
  })
})

test("Free sample retains three subtitle tracks and basic lookup while save and quiz request an upgrade", async ({
  page,
}) => {
  const state = await setup(page)

  const sampleId = "507f1f77bcf86cd799439022"

  const wordId = "507f1f77bcf86cd799439033"

  const requests: string[] = []

  page.on("request", (request) =>
    requests.push(new URL(request.url()).pathname),
  )

  await page.route(`**/api/v1/lessons/${sampleId}`, (route) =>
    route.fulfill({
      json: {
        data: {
          _id: sampleId,
          titleVi: "Video mẫu chào hỏi",
          titleZh: "你好",
          hsk: 1,
          durationSeconds: 30,

          contentMode: "lesson",
          status: "published",
          topicIds: [],
          media: { url: "/sample-test.mp4", mimeType: "video/mp4" },
        },
      },
    }),
  )

  await page.route(`**/api/v1/lessons/${sampleId}/subtitles`, (route) =>
    route.fulfill({
      json: {
        data: {
          revision: 1,
          cues: [
            {
              cueId: "hello",
              startMs: 0,
              endMs: 30000,
              zh: "你好",
              pinyin: "nǐ hǎo",
              vi: "Xin chào",

              tokens: [
                {
                  text: "你好",
                  wordId: {
                    _id: wordId,
                    hanzi: "你好",
                    pinyin: "nǐ hǎo",
                    meaningVi: "Xin chào",
                  },
                },
              ],
            },
          ],
        },
      },
    }),
  )

  await page.route("**/sample-test.mp4", (route) =>
    route.fulfill({
      contentType: "video/mp4",
      path: fileURLToPath(
        new URL("./fixtures/premium-sample.mp4", import.meta.url),
      ),
    }),
  )

  await page.goto(`/watch/${sampleId}`)

  await expect(
    page.getByText("Video mẫu chào hỏi", { exact: true }).first(),
  ).toBeVisible()

  await expect(page.getByText("nǐ hǎo", { exact: true }).first()).toBeVisible()

  await expect(
    page.getByText("Xin chào", { exact: true }).first(),
  ).toBeVisible()

  await expect(page.locator("video")).toHaveJSProperty("readyState", 4)

  await page.getByRole("button", { name: "你好", exact: true }).last().click()

  const lookup = page.getByRole("dialog", { name: "Giải thích từ 你好" })

  await expect(lookup.getByText("Xin chào")).toBeVisible()

  await expect(lookup.getByText("nǐ hǎo")).toBeVisible()

  expect(requests.filter((path) => path === "/api/v1/ai/explain")).toHaveLength(
    0,
  )

  expect(requests.filter((path) => path.endsWith("/quiz"))).toHaveLength(0)

  await lookup.getByRole("button", { name: "Lưu vào sổ ôn tập" }).click()

  const upgrade = page.getByRole("dialog", {
    name: "Nâng cấp HanFlix Premium",
    exact: true,
  })

  await expect(
    upgrade.getByRole("link", { name: "Nâng cấp ngay" }),
  ).toBeVisible()

  expect(requests.filter((path) => path === "/api/v1/vocabulary")).toHaveLength(
    0,
  )

  await upgrade.getByRole("button", { name: "Đóng", exact: true }).click()

  await lookup.getByRole("button", { name: "Đóng", exact: true }).click()

  await page.getByRole("button", { name: /Làm bài luyện tập/ }).click()

  await expect(upgrade).toBeVisible()

  expect(state.paid).toBe(false)
})
