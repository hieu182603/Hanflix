import { useI18n } from "../../i18n"
import React from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import PayOSCheckoutModal from "./PayOSCheckoutModal"

export default function PaymentReturnPage() {
  const { tr } = useI18n()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const rawCode = params.get("orderCode") ?? ""
  const orderCode = Number(rawCode)
  if (
    !/^\d+$/.test(rawCode) ||
    !Number.isSafeInteger(orderCode) ||
    orderCode <= 0
  ) {
    return (
      <main className="mx-auto max-w-xl p-8 space-y-4">
        <h1 className="text-xl font-bold">
          {tr("Không tìm thấy mã đơn thanh toán")}
        </h1>
        <p>{tr("Bạn có thể mở lại đơn từ lịch sử thanh toán để kiểm tra.")}</p>
        <Link to="/premium" className="underline">
          {tr("Về trang Premium")}
        </Link>
      </main>
    )
  }
  // URL status/cancel flags are untrusted. Only the authenticated API decides.
  return (
    <PayOSCheckoutModal
      isOpen
      orderCode={orderCode}
      onClose={() => navigate("/premium", { replace: true })}
      onSuccess={() => {
        void queryClient.invalidateQueries()
      }}
    />
  )
}
