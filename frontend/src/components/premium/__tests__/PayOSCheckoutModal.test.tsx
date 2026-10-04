import React from "react"
import { MemoryRouter } from "react-router-dom"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import PayOSCheckoutModal from "../PayOSCheckoutModal"
import * as usePaymentOrderModule from "../../../hooks/usePaymentOrder"
import type { PaymentOrder } from "../../../api/billing"

describe("PayOSCheckoutModal QR Code Resilience", () => {
  const mockOrder: PaymentOrder = {
    orderCode: 62595676242468,
    planCode: "monthly",
    planName: "Cơ bản",
    durationMonths: 1,
    amount: 99000,
    currency: "VND",
    status: "PENDING",
    bin: "970422",
    accountNumber: "VQRQAMNLQ9188",
    accountName: "MAI VAN NGHIA",
    description: "HF 62595676242468",
    checkoutUrl: "https://pay.payos.vn/web/test",
    qrCode: "00020101021238570010A000000727012700069704220113VQRQAMNLQ91880208QRIBFTTA53037045405990005802VN62210817HF 6259567624246863041848",
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    createdAt: new Date().toISOString(),
  }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(usePaymentOrderModule, "usePaymentOrder").mockReturnValue({
      order: mockOrder,
      isLoading: false,
      isCancelling: false,
      error: null,
      timeLeft: 600,
      retry: vi.fn(),
      handleCancel: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("renders order bank details and starts with VietQR image URL", async () => {
    render(
      <MemoryRouter>
        <PayOSCheckoutModal
          isOpen={true}
          orderCode={mockOrder.orderCode}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(screen.getByText("VQRQAMNLQ9188")).toBeTruthy()
    expect(screen.getByText("MAI VAN NGHIA")).toBeTruthy()
    expect(screen.getAllByText(/99\.000/).length).toBeGreaterThan(0)

    const img = screen.getByAltText("Mã VietQR thanh toán") as HTMLImageElement
    expect(img).toBeTruthy()
    expect(img.src).toContain("https://img.vietqr.io/image/970422-VQRQAMNLQ9188-compact2.png")
  })

  it("falls back to local in-browser QR code data URL when external VietQR image fails to load", async () => {
    render(
      <MemoryRouter>
        <PayOSCheckoutModal
          isOpen={true}
          orderCode={mockOrder.orderCode}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      </MemoryRouter>
    )

    const img = screen.getByAltText("Mã VietQR thanh toán") as HTMLImageElement

    // Simulate external image failure (e.g., CSP blocked, offline, adblocker)
    await act(async () => {
      fireEvent.error(img)
    })

    await waitFor(() => {
      const updatedImg = screen.getByAltText("Mã VietQR thanh toán") as HTMLImageElement
      // Should now use in-browser generated data URL (data:image/png;base64,...)
      expect(updatedImg.src).toMatch(/^data:image\/png;base64,/)
    })

    expect(screen.getByText("Mã VietQR chính thức")).toBeTruthy()
  })
})
