import { useI18n } from "../../i18n"

import React from "react"

import QRCode from "qrcode"

import { usePaymentOrder } from "../../hooks/usePaymentOrder"

import {
  X,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  QrCode,
  ArrowRight,
  RefreshCw,
  Crown,
  Copy,
  Check,
} from "lucide-react"

import { type PaymentOrder, type PremiumPlan } from "../../api/billing"

interface PayOSCheckoutModalProps {
  plan?: PremiumPlan

  orderCode?: number

  isOpen: boolean

  onClose: () => void

  onSuccess: (order: PaymentOrder) => void
}

export default function PayOSCheckoutModal({
  plan,

  orderCode,

  isOpen,

  onClose,

  onSuccess,
}: PayOSCheckoutModalProps) {
  const { tr, ui, locale } = useI18n()

  const {
    order,
    isLoading,
    isCancelling,
    error,
    timeLeft,
    retry,
    handleCancel,
  } = usePaymentOrder(isOpen, plan, orderCode, onSuccess)

  const [copiedField, setCopiedField] = React.useState<string | null>(null)
  const [localQrDataUrl, setLocalQrDataUrl] = React.useState<string | null>(null)
  const [useFallbackQr, setUseFallbackQr] = React.useState<boolean>(false)

  // Asynchronously generate client-side QR data URL from official payOS EMVCo qrCode string
  React.useEffect(() => {
    let active = true
    setUseFallbackQr(false)

    if (order?.qrCode) {
      QRCode.toDataURL(order.qrCode, {
        margin: 1,
        width: 320,
        errorCorrectionLevel: "M",
        color: {
          dark: "#18181B",
          light: "#FFFFFF",
        },
      })
        .then((url) => {
          if (active) setLocalQrDataUrl(url)
        })
        .catch(() => {
          if (active) setLocalQrDataUrl(null)
        })
    } else {
      setLocalQrDataUrl(null)
    }

    return () => {
      active = false
    }
  }, [order?.qrCode])

  const handleCopy = (text: string, field: string) => {
    try {
      navigator.clipboard.writeText(text)

      setCopiedField(field)

      setTimeout(() => setCopiedField(null), 2000)
    } catch {}
  }

  const primaryVietQrUrl = React.useMemo(() => {
    if (!order) return null

    if (order.bin && order.accountNumber) {
      return `https://img.vietqr.io/image/${order.bin}-${order.accountNumber}-compact2.png?amount=${order.amount}&addInfo=${encodeURIComponent(order.description || `HF ${order.orderCode}`)}&accountName=${encodeURIComponent(order.accountName || "")}`
    }

    return null
  }, [order])

  const qrImageUrl = React.useMemo(() => {
    if (!order) return null

    if (useFallbackQr || !primaryVietQrUrl) {
      return (
        localQrDataUrl ||
        (order.qrCode
          ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(order.qrCode)}`
          : null)
      )
    }

    return primaryVietQrUrl
  }, [order, useFallbackQr, primaryVietQrUrl, localQrDataUrl])

  const formatMmSs = (seconds: number) => {
    const mins = Math.floor(seconds / 60)

    const secs = seconds % 60

    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr("Thanh toán HanFlix Premium")}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
    >
      <div
        className={`relative w-full transition-all duration-300 ${
          order && order.status !== "PAID" && !isLoading
            ? "max-w-3xl"
            : "max-w-md"
        } max-h-[92dvh] overflow-y-auto bg-[#FFFDFB] rounded-3xl shadow-2xl border border-[#F2E4D8]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#F2E4D8]/80 bg-white/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shadow-2xs">
              <Crown className="w-4 h-4 text-amber-600 fill-amber-500" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#18181B] tracking-tight">
                {tr("Thanh toán HanFlix Premium")}
              </h3>
              <p className="text-xs text-[#5F6368]">
                {tr("Tự động kích hoạt sau khi payOS xác nhận thanh toán")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#5F6368] hover:text-[#18181B] hover:bg-neutral-100 transition-colors cursor-pointer"
            aria-label={tr("Đóng")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nội dung bên trong Modal */}
        <div className="p-6 space-y-5">
          {/* Trạng thái Loading ban đầu */}
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#B91B1C] animate-spin" />
              <p className="font-bold text-sm text-[#18181B]">
                {orderCode
                  ? tr("Đang kiểm tra thanh toán…")
                  : tr("Đang tạo thanh toán payOS…")}
              </p>
              <p className="text-xs text-[#5F6368]">
                {tr("Vui lòng đợi trong giây lát")}
              </p>
            </div>
          )}

          {/* Trạng thái Lỗi */}
          {!isLoading && error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>
                  {order
                    ? tr("Chưa đồng bộ được trạng thái")
                    : tr("Chưa tải được thanh toán")}
                </span>
              </div>
              <p className="text-xs text-red-700 leading-relaxed">
                {ui(error)}
              </p>
              {!order && (
                <button
                  type="button"
                  onClick={retry}
                  className="mt-2 px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition-colors cursor-pointer"
                >
                  {tr("Thử lại")}
                </button>
              )}
            </div>
          )}

          {/* Trạng thái Thành Công: PAID */}
          {!isLoading && order && order.status === "PAID" && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center shadow-lg">
                  <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                </div>
                <div className="absolute -top-1 -right-1">
                  <Sparkles className="w-6 h-6 text-amber-500 fill-amber-400 animate-bounce" />
                </div>
              </div>

              <div>
                <h4 className="font-black text-xl text-[#18181B] tracking-tight">
                  {tr("Thanh toán thành công!")}
                </h4>
                <p className="text-sm text-[#5F6368] mt-1">
                  {tr("Bạn đã kích hoạt thành công")}{" "}
                  <strong>{ui(order.planName)}</strong>
                </p>
                {order.premiumExpiresAt && (
                  <p className="text-xs font-semibold text-emerald-700 mt-2 bg-emerald-50 px-3 py-1.5 rounded-full inline-block border border-emerald-200">
                    {tr("Thời hạn Premium đến:")}{" "}
                    {new Date(order.premiumExpiresAt).toLocaleDateString(
                      locale,
                    )}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose()

                  window.location.reload()
                }}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#B91B1C] to-[#8F1719] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{tr("Bắt đầu trải nghiệm ngay")}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Trạng thái Đang Chờ Thanh Toán (PENDING / CREATING / PROCESSING) */}
          {!isLoading &&
            order &&
            order.status !== "PAID" &&
            order.status !== "CANCELLED" &&
            order.status !== "EXPIRED" &&
            order.status !== "FAILED" && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                {/* CỘT TRÁI: THÔNG TIN ĐƠN HÀNG & CHUYỂN KHOẢN THỦ CÔNG */}
                <div className="md:col-span-7 flex flex-col justify-between space-y-4">
                  <div className="space-y-3.5">
                    {/* Thẻ tóm tắt gói cước */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FFF5ED] via-[#FFF9F5] to-white border border-[#F2E4D8] shadow-2xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-black uppercase tracking-wider text-[#B91B1C]">
                          {tr("Đơn hàng #")}
                          {order.orderCode}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold">
                          VietQR PayOS
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <h4 className="font-extrabold text-base text-[#18181B]">
                          {ui(order.planName)} ({order.durationMonths}{" "}
                          {tr("tháng")})
                        </h4>
                        <div className="text-right">
                          <span className="font-black text-xl text-[#B91B1C]">
                            {order.amount.toLocaleString(locale)} {tr("đ")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bảng chi tiết chuyển khoản thủ công */}
                    <div className="rounded-2xl bg-white border border-[#E7E7EA] p-3.5 space-y-2.5 shadow-2xs text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                        <span className="font-bold text-[#18181B] text-[13px]">
                          {tr("Chi tiết chuyển khoản")}
                        </span>
                        <span className="text-[11px] text-[#5F6368]">
                          {tr("Chuyển khoản 24/7")}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">
                          {tr("Ngân hàng:")}
                        </span>
                        <span className="font-semibold text-neutral-900">
                          {order.bin === "970422"
                            ? "MBBank (Quân Đội)"
                            : order.bin || "—"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">
                          {tr("Số tài khoản:")}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono font-bold text-neutral-900">
                          <span>{order.accountNumber || "—"}</span>
                          <button
                            type="button"
                            disabled={!order.accountNumber}
                            onClick={() =>
                              order.accountNumber &&
                              handleCopy(order.accountNumber, "accountNumber")
                            }
                            className="p-1 hover:bg-neutral-100 rounded transition-colors text-neutral-500 hover:text-neutral-800 cursor-pointer"
                            title={tr("Sao chép số tài khoản")}
                          >
                            {copiedField === "accountNumber" ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">
                          {tr("Chủ tài khoản:")}
                        </span>
                        <span className="font-semibold text-neutral-900 uppercase">
                          {order.accountName || "—"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">
                          {tr("Số tiền:")}
                        </span>
                        <div className="flex items-center gap-1.5 font-bold text-[#B91B1C]">
                          <span>{order.amount.toLocaleString(locale)} đ</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(String(order.amount), "amount")
                            }
                            className="p-1 hover:bg-neutral-100 rounded transition-colors text-neutral-500 hover:text-neutral-800 cursor-pointer"
                            title={tr("Sao chép số tiền")}
                          >
                            {copiedField === "amount" ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                        <span className="text-neutral-600 font-bold">
                          {tr("Nội dung CK:")}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono font-bold text-amber-950 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                          <span>
                            {order.description || `HF ${order.orderCode}`}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                order.description || `HF ${order.orderCode}`,
                                "description",
                              )
                            }
                            className="p-0.5 hover:bg-amber-100 rounded transition-colors text-amber-800 cursor-pointer"
                            title={tr("Sao chép nội dung")}
                          >
                            {copiedField === "description" ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-amber-800/90 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/50 leading-relaxed">
                      ⚠️ <strong>{tr("Lưu ý:")}</strong>{" "}
                      {tr(
                        "Vui lòng nhập chính xác nội dung chuyển khoản để đơn hàng được kích hoạt tự động tức thì.",
                      )}
                    </p>
                  </div>

                  {/* Hủy đơn & Bảo mật */}
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={isCancelling}
                      className="text-xs font-semibold text-[#5F6368] hover:text-red-600 transition-colors cursor-pointer"
                    >
                      {isCancelling
                        ? tr("Đang hủy...")
                        : tr("Hủy đơn hàng này")}
                    </button>

                    <div className="flex items-center gap-1.5 text-[11px] text-[#8B9097]">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{tr("Bảo mật qua payOS")}</span>
                    </div>
                  </div>
                </div>

                {/* CỘT PHẢI: MÃ QR THANH TOÁN & ĐỒNG HỒ ĐẾM NGƯỢC */}
                <div className="md:col-span-5 flex flex-col items-center justify-between p-4.5 rounded-2xl bg-white border border-[#E7E7EA] shadow-2xs space-y-3.5 text-center">
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-1.5 font-bold text-sm text-[#18181B]">
                      <QrCode className="w-4 h-4 text-[#B91B1C]" />
                      <span>{tr("Quét mã VietQR")}</span>
                    </div>
                    <p className="text-[11px] text-[#5F6368] leading-tight">
                      {tr("Mở app Ngân hàng hoặc Ví để quét mã")}
                    </p>
                  </div>

                  {/* Khung ảnh QR Code */}
                  <div className="p-2 bg-white border border-neutral-200/80 rounded-2xl shadow-sm flex items-center justify-center min-h-[212px]">
                    {qrImageUrl ? (
                      <div className="relative flex flex-col items-center">
                        <img
                          src={qrImageUrl}
                          alt="Mã VietQR thanh toán"
                          className="w-48 sm:w-52 h-auto object-contain rounded-xl"
                          loading="eager"
                          onError={() => {
                            if (!useFallbackQr) {
                              setUseFallbackQr(true)
                            }
                          }}
                        />
                        {useFallbackQr && (
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200/60">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            <span>{tr("Mã VietQR chính thức")}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center bg-neutral-50 rounded-lg text-neutral-400">
                        <QrCode className="w-10 h-10 animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* Thanh trạng thái Live Countdown & Pulse */}
                  <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-200/70 text-xs">
                    <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-[11px]">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span>
                        {order.status === "UNDERPAID"
                          ? tr("Đã nhận 1 phần tiền...")
                          : order.status === "PROCESSING"
                            ? tr("Đang xử lý...")
                            : tr("Chờ chuyển khoản...")}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 font-bold text-amber-800 text-[11px]">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>
                        {timeLeft > 0 ? formatMmSs(timeLeft) : tr("Hết hạn")}
                      </span>
                    </div>
                  </div>

                  {/* Nút phụ mở cổng PayOS */}
                  {order.checkoutUrl && (
                    <a
                      href={order.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-neutral-500 hover:text-[#B91B1C] font-semibold flex items-center justify-center gap-1 pt-0.5 transition-colors cursor-pointer"
                    >
                      <span>{tr("Mở cổng payOS tab mới")}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

          {/* Trạng thái Đơn đã hủy hoặc hết hạn */}
          {!isLoading &&
            order &&
            (order.status === "CANCELLED" ||
              order.status === "EXPIRED" ||
              order.status === "FAILED") && (
              <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-[#5F6368]">
                  <Clock className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-base text-[#18181B]">
                  {order.status === "CANCELLED"
                    ? tr("Đơn hàng đã được hủy")
                    : order.status === "FAILED"
                      ? tr("Không tạo được thanh toán")
                      : tr("Đơn hàng đã hết hạn")}
                </h4>
                <p className="text-xs text-[#5F6368]">
                  {tr(
                    "Bạn có thể tạo một đơn hàng mới bất cứ lúc nào để tiếp tục nâng cấp.",
                  )}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-neutral-900 text-white font-bold text-xs hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  {tr("Đóng")}
                </button>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
