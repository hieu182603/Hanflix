import React from "react"

import { MemoryRouter } from "react-router-dom"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../../api/billing", () => ({
  getBillingPlans: vi.fn(),

  getUserSubscription: vi.fn(),

  getUserOrders: vi.fn(),

  getOrderDetails: vi.fn(),

  createCheckout: vi.fn(),

  cancelOrder: vi.fn(),

  subscribePremium: vi.fn(),

  markTrialWelcomeSeen: vi.fn().mockResolvedValue({ success: true }),
}))

import {
  getBillingPlans,
  getUserSubscription,
  markTrialWelcomeSeen,
  type BillingPlansData,
  type UserSubscription,
} from "../../../api/billing"

import PremiumPricingPage from "../PremiumPricingPage"

import WelcomeTrialModal from "../WelcomeTrialModal"

import { PremiumAccessProvider, usePremiumAccess } from "../PremiumAccess"

const mockPlans: BillingPlansData = {
  title: "Nâng cấp HanFlix Premium",

  subtitle: "Học tiếng Trung trọn vẹn hơn qua mỗi câu chuyện.",

  description: "Cả 3 gói đều mở khóa toàn bộ quyền lợi Premium.",

  benefits: [
    "Xem video học không giới hạn",
    "Phụ đề 3 tầng",
    "Trợ lý AI Bảo Bảo",
  ],

  paymentAvailable: true,

  freeSampleLessonIds: ["sample-1"],

  plans: [
    {
      code: "monthly",

      name: "1 tháng",

      durationMonths: 1,

      price: 99000,

      currency: "VND",

      pricePerMonth: 99000,

      approximatePricePerDay: 3300,

      savings: 0,

      savingsPercent: 0,

      highlighted: false,

      badge: null,
    },

    {
      code: "quarterly",

      name: "3 tháng",

      durationMonths: 3,

      price: 249000,

      currency: "VND",

      pricePerMonth: 83000,

      approximatePricePerDay: 2700,

      savings: 48000,

      savingsPercent: 16,

      highlighted: true,

      badge: "Được yêu thích nhất",
    },

    {
      code: "yearly",

      name: "1 năm",

      durationMonths: 12,

      price: 699000,

      currency: "VND",

      pricePerMonth: 58250,

      approximatePricePerDay: 1900,

      savings: 489000,

      savingsPercent: 41,

      highlighted: false,

      badge: "Tiết kiệm nhất",
    },
  ],
}

function renderPricing(
  subscription: UserSubscription,

  currentUser: {
    id: string
    name: string
    email: string
    role: "user" | "admin"
    premiumExpiresAt?: string | null
  } | null = {
    id: "user-1",

    name: "Học viên Test",

    email: "test@hanflix.vn",

    role: "user",
  },
) {
  vi.mocked(getBillingPlans).mockResolvedValue(mockPlans)

  vi.mocked(getUserSubscription).mockResolvedValue(subscription)

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/premium"]}>
        <PremiumPricingPage currentUser={currentUser} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("Premium Trial Flow Frontend Integration", () => {
  beforeEach(() => {
    vi.resetAllMocks()

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)

    vi.mocked(markTrialWelcomeSeen).mockResolvedValue({ success: true })
  })

  afterEach(() => {
    cleanup()

    vi.restoreAllMocks()
  })

  describe("WelcomeTrialModal (First Login Trial Flow)", () => {
    it("CASE 1 & 2: renders 15-day welcome popup with official copy and expiry date", () => {
      const trialEndsAt = "2026-10-19T10:00:00.000Z"

      render(
        <MemoryRouter>
          <WelcomeTrialModal
            isOpen={true}
            trialEndsAt={trialEndsAt}
            onClose={() => {}}
            onExplore={() => {}}
          />
        </MemoryRouter>,
      )

      expect(screen.getByText("🎁 Chào mừng bạn đến với HanFlix!")).toBeTruthy()

      expect(screen.getByText("15 NGÀY PREMIUM MIỄN PHÍ")).toBeTruthy()

      expect(
        screen.getByText("Không cần thẻ • Không tự động gia hạn"),
      ).toBeTruthy()

      expect(screen.getByText("Bắt đầu khám phá Premium")).toBeTruthy()

      expect(
        screen.getByText(/Premium Trial của bạn có hiệu lực đến:/i),
      ).toBeTruthy()
    })

    it("CASE 3: clicking CTA or close calls markTrialWelcomeSeen idempotently", async () => {
      const onClose = vi.fn()

      const onExplore = vi.fn()

      render(
        <MemoryRouter>
          <WelcomeTrialModal
            isOpen={true}
            trialEndsAt="2026-10-19T10:00:00.000Z"
            onClose={onClose}
            onExplore={onExplore}
          />
        </MemoryRouter>,
      )

      const exploreBtn = screen.getByRole("button", {
        name: /Bắt đầu khám phá Premium/i,
      })

      fireEvent.click(exploreBtn)

      await waitFor(() => {
        expect(markTrialWelcomeSeen).toHaveBeenCalledTimes(1)

        expect(onClose).toHaveBeenCalled()

        expect(onExplore).toHaveBeenCalled()
      })
    })

    it("retains the popup and offers retry when saving seen state fails", async () => {
      vi.mocked(markTrialWelcomeSeen).mockRejectedValueOnce(
        new Error("offline"),
      )

      const close = vi.fn()

      render(
        <WelcomeTrialModal
          isOpen
          trialEndsAt="2026-10-19T10:00:00Z"
          onClose={close}
        />,
      )

      fireEvent.click(screen.getByRole("button", { name: "Để sau" }))

      await screen.findByRole("alert")

      expect(close).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole("button", { name: "Để sau" }))

      await waitFor(() => expect(close).toHaveBeenCalledOnce())
    })

    it('CASE 3 (Close / Để sau): clicking "Để sau" also calls markTrialWelcomeSeen and closes', async () => {
      const onClose = vi.fn()

      render(
        <MemoryRouter>
          <WelcomeTrialModal
            isOpen={true}
            trialEndsAt="2026-10-19T10:00:00.000Z"
            onClose={onClose}
          />
        </MemoryRouter>,
      )

      const laterBtn = screen.getByRole("button", { name: /Để sau/i })

      fireEvent.click(laterBtn)

      await waitFor(() => {
        expect(markTrialWelcomeSeen).toHaveBeenCalledTimes(1)

        expect(onClose).toHaveBeenCalled()
      })
    })
  })

  describe("Premium Pricing Page in new Trial Architecture", () => {
    it('CASE 8: Plan cards do NOT have "Bắt đầu dùng thử 30 ngày" CTA, all 3 show "Nâng cấp ngay"', async () => {
      renderPricing({
        status: "FREE",

        tier: "free",

        hasPremiumAccess: false,

        trialEligible: false,

        premiumExpiresAt: null,

        benefits: [],
      })

      await screen.findByText("99.000 đ")

      expect(screen.queryByText(/Bắt đầu dùng thử 30 ngày/i)).toBeNull()

      expect(screen.queryByText(/30 ngày đầu miễn phí/i)).toBeNull()

      const upgradeButtons = screen.getAllByRole("button", {
        name: /Nâng cấp ngay/i,
      })

      expect(upgradeButtons.length).toBe(3)
    })

    it("CASE 9: In Trial status, displays Trial status banner with remaining days and end date", async () => {
      renderPricing({
        status: "TRIAL",

        tier: "premium",

        hasPremiumAccess: true,

        trialEligible: false,

        premiumExpiresAt: "2026-10-19T10:00:00.000Z",

        trial: {
          startedAt: "2026-10-04T10:00:00.000Z",

          endsAt: "2026-10-19T10:00:00.000Z",

          planCode: "trial_15d",

          remainingSeconds: 15 * 86400,
        },

        benefits: [],
      })

      await screen.findByText("Bạn đang trải nghiệm HanFlix Premium miễn phí.")

      expect(screen.getByText("Còn 15 ngày")).toBeTruthy()

      expect(screen.getByText("19/10/2026")).toBeTruthy()

      // All 3 plan cards still allow upgrading

      const upgradeButtons = screen.getAllByRole("button", {
        name: /Nâng cấp ngay/i,
      })

      expect(upgradeButtons.length).toBe(3)
    })

    it("shows the paid plan scheduled after trial while retaining its trial banner", async () => {
      renderPricing({
        status: "TRIAL",
        tier: "premium",
        hasPremiumAccess: true,

        premiumExpiresAt: "2026-11-19T10:00:00Z",
        benefits: [],

        trial: {
          startedAt: "2026-10-04T10:00:00Z",
          endsAt: "2026-10-19T10:00:00Z",
          remainingSeconds: 15 * 86400,
        },

        premium: {
          startedAt: "2026-10-19T10:00:00Z",
          endsAt: "2026-11-19T10:00:00Z",
          planCode: "monthly",
        },
      })

      await screen.findByText("Premium đã được đăng ký")

      expect(
        screen.getByText("Gói 1 tháng sẽ bắt đầu từ 19/10/2026"),
      ).toBeTruthy()

      expect(screen.getByText("Còn 15 ngày")).toBeTruthy()
    })

    it("CASE 10: In Expired state, shows expired message without logging out", async () => {
      renderPricing({
        status: "EXPIRED",

        tier: "free",

        hasPremiumAccess: false,

        trialEligible: false,

        hasUsedPremiumTrial: true,

        premiumExpiresAt: null,

        benefits: [],
      })

      await screen.findByText("Thời gian dùng thử Premium đã kết thúc.")

      expect(
        screen.getByText(
          /Bạn vẫn có thể tiếp tục sử dụng HanFlix Free\. Nâng cấp Premium để tiếp tục sử dụng toàn bộ tính năng\./i,
        ),
      ).toBeTruthy()

      const upgradeButtons = screen.getAllByRole("button", {
        name: /Nâng cấp ngay/i,
      })

      expect(upgradeButtons.length).toBe(3)
    })
  })

  describe("Premium Access Provider & Feature Gates", () => {
    it("CASE 6 & 7: TRIAL user with hasPremiumAccess = true is allowed access", () => {
      function ProtectedChild() {
        const allowed = usePremiumAccess()

        return <div>{allowed ? "NỘI_DUNG_PREMIUM_MỞ" : "BỊ_CHẶN"}</div>
      }

      render(
        <MemoryRouter>
          <PremiumAccessProvider
            user={{
              role: "user",

              hasPremiumAccess: true,

              subscriptionStatus: "TRIAL",

              premiumExpiresAt: new Date(Date.now() + 86400000).toISOString(),
            }}
          >
            <ProtectedChild />
          </PremiumAccessProvider>
        </MemoryRouter>,
      )

      expect(screen.getByText("NỘI_DUNG_PREMIUM_MỞ")).toBeTruthy()
    })

    it("blocks access when trial endsAt / premiumExpiresAt has passed", () => {
      function ProtectedChild() {
        const allowed = usePremiumAccess()

        return <div>{allowed ? "NỘI_DUNG_PREMIUM_MỞ" : "BỊ_CHẶN"}</div>
      }

      render(
        <MemoryRouter>
          <PremiumAccessProvider
            user={{
              role: "user",

              hasPremiumAccess: true, // Stale flag from local cache

              subscriptionStatus: "EXPIRED",

              premiumExpiresAt: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
            }}
          >
            <ProtectedChild />
          </PremiumAccessProvider>
        </MemoryRouter>,
      )

      expect(screen.getByText("BỊ_CHẶN")).toBeTruthy()
    })

    it("CASE 11: 403 TRIAL_EXPIRED event triggers upgrade notice without logging user out", async () => {
      function ProtectedChild() {
        const allowed = usePremiumAccess()

        return <div>{allowed ? "NỘI_DUNG_PREMIUM_MỞ" : "BỊ_CHẶN"}</div>
      }

      render(
        <MemoryRouter>
          <PremiumAccessProvider
            user={{
              role: "user",

              hasPremiumAccess: false,

              subscriptionStatus: "EXPIRED",

              premiumExpiresAt: null,
            }}
          >
            <ProtectedChild />
          </PremiumAccessProvider>
        </MemoryRouter>,
      )

      expect(screen.getByText("BỊ_CHẶN")).toBeTruthy()

      act(() => {
        window.dispatchEvent(
          new CustomEvent("hanflix:premium-required", {
            detail: { code: "TRIAL_EXPIRED" },
          }),
        )
      })

      await screen.findByText("Thời gian dùng thử Premium đã kết thúc")

      expect(
        screen.getByText(
          /Bạn vẫn có thể tiếp tục sử dụng HanFlix Free\. Nâng cấp Premium để tiếp tục sử dụng toàn bộ tính năng\./i,
        ),
      ).toBeTruthy()

      expect(
        screen.getByRole("link", { name: "Xem các gói Premium" }),
      ).toBeTruthy()
    })
  })
})
