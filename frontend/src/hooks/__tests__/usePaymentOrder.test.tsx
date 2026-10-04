import React, { StrictMode } from "react"

import { act, cleanup, renderHook } from "@testing-library/react"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../api/billing", () => ({
  subscribePremium: vi.fn(),
  getOrderDetails: vi.fn(),
  cancelOrder: vi.fn(),
}))

vi.mock("../../api/auth", () => ({ getCachedUser: () => ({ id: "learner" }) }))

import {
  subscribePremium,
  getOrderDetails,
  cancelOrder,
  type PaymentOrder,
  type PremiumPlan,
  type PremiumRegistration,
} from "../../api/billing"

import { usePaymentOrder } from "../usePaymentOrder"

const plan = { code: "monthly", price: 99000 } as PremiumPlan

const order: PaymentOrder = {
  orderCode: 123,
  planCode: "monthly",
  planName: "1 tháng",
  durationMonths: 1,
  amount: 99000,

  currency: "VND",
  status: "PENDING",
  checkoutUrl: "https://pay.payos.vn/web/link",
  expiresAt: "2026-09-29T11:00:00Z",
  paidAt: null,
  premiumExpiresAt: null,
  createdAt: "2026-09-29T10:00:00Z",
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-09-29T10:00:00Z"))

  vi.resetAllMocks()
  sessionStorage.clear()

  vi.mocked(subscribePremium).mockResolvedValue({
    type: "PAYMENT_REQUIRED",
    order,
  })

  vi.mocked(getOrderDetails).mockResolvedValue(order)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("payment lifecycle", () => {
  it("keeps one request key across StrictMode, failed creation, retry and reopening", async () => {
    vi.mocked(subscribePremium).mockRejectedValue(new Error("timeout"))

    const view = renderHook(
      ({ open }) => usePaymentOrder(open, plan, undefined, vi.fn()),
      { initialProps: { open: true }, wrapper: StrictMode },
    )

    await act(async () => {})

    act(() => view.result.current.retry())

    await act(async () => {})

    view.rerender({ open: false })
    view.rerender({ open: true })

    await act(async () => {})

    expect(subscribePremium).toHaveBeenCalledTimes(4)

    expect(
      new Set(vi.mocked(subscribePremium).mock.calls.map((call) => call[1]))
        .size,
    ).toBe(1)
  })

  it("serializes polls, reports success once and stops after PAID", async () => {
    let resolve: (value: PaymentOrder) => void

    vi.mocked(getOrderDetails).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )

    const success = vi.fn()

    renderHook(() => usePaymentOrder(true, plan, undefined, success))

    await act(async () => {})

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })

    expect(getOrderDetails).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolve({ ...order, status: "PAID" })
    })

    expect(success).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(getOrderDetails).toHaveBeenCalledTimes(1)
  })

  it("handles payment winning a cancellation and ignores an older pending response", async () => {
    let resolve: (value: PaymentOrder) => void

    vi.mocked(getOrderDetails).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )

    vi.mocked(cancelOrder).mockResolvedValue({ ...order, status: "PAID" })

    const success = vi.fn()

    const view = renderHook(() =>
      usePaymentOrder(true, plan, undefined, success),
    )

    await act(async () => {})

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    await act(async () => {
      await view.result.current.handleCancel()
    })

    await act(async () => {
      resolve(order)
    })

    expect(view.result.current.order?.status).toBe("PAID")

    expect(success).toHaveBeenCalledTimes(1)
  })

  it("looks up an existing returned order without creating another charge", async () => {
    vi.mocked(getOrderDetails).mockResolvedValue({ ...order, status: "PAID" })

    const success = vi.fn()

    renderHook(() => usePaymentOrder(true, undefined, 123, success))

    await act(async () => {})

    expect(subscribePremium).not.toHaveBeenCalled()

    expect(getOrderDetails).toHaveBeenCalledWith(123, expect.any(AbortSignal))

    expect(success).toHaveBeenCalledTimes(1)
  })

  it("does not restart an expired countdown at 30 minutes or stop checking prematurely", async () => {
    vi.mocked(subscribePremium).mockResolvedValue({
      type: "PAYMENT_REQUIRED",
      order: { ...order, expiresAt: "2026-09-29T09:00:00Z" },
    })

    const view = renderHook(() =>
      usePaymentOrder(true, plan, undefined, vi.fn()),
    )

    await act(async () => {})

    expect(view.result.current.timeLeft).toBe(0)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(getOrderDetails).toHaveBeenCalledTimes(1)
  })

  it("does not notify success from a response arriving after close", async () => {
    let resolve: (value: PremiumRegistration) => void

    vi.mocked(subscribePremium).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )

    const success = vi.fn()

    const view = renderHook(
      ({ open }) => usePaymentOrder(open, plan, undefined, success),
      { initialProps: { open: true } },
    )

    view.rerender({ open: false })

    await act(async () => {
      resolve({ type: "PAYMENT_REQUIRED", order: { ...order, status: "PAID" } })
    })

    expect(success).not.toHaveBeenCalled()
  })
})
