import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { Link, useLocation } from "react-router-dom"
import {
  Crown,
  Sparkles,
  Check,
  ArrowRight,
  ShieldCheck,
  X,
} from "lucide-react"
import { useI18n } from "../../i18n"
import LockedFeaturePreview from "./LockedFeaturePreview"

const PremiumContext = createContext(false)
const LearnerHskContext = createContext<{
  hsk: number | null
  isLearner: boolean
}>({ hsk: null, isLearner: false })

export function PremiumAccessProvider({
  user,
  children,
}: {
  user: {
    role?: string
    premiumExpiresAt?: string | Date | null
    hasPremiumAccess?: boolean
    subscriptionStatus?: string
    learningProfile?: { hskLevel?: number } | null
  } | null
  children: ReactNode
}) {
  const { tr } = useI18n()
  const location = useLocation()
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [isTrialExpiredNotice, setIsTrialExpiredNotice] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [serverDenied, setServerDenied] = useState(false)
  useEffect(() => {
    const denied = () => setServerDenied(true)
    window.addEventListener("hanflix:entitlement-denied", denied)
    return () =>
      window.removeEventListener("hanflix:entitlement-denied", denied)
  }, [])
  useEffect(
    () => setServerDenied(false),
    [user?.hasPremiumAccess, user?.premiumExpiresAt],
  )

  useEffect(() => {
    const handlePremiumRequired = (event: Event) => {
      const customEvent = event as CustomEvent<{ code?: string }>
      if (customEvent.detail?.code === "TRIAL_EXPIRED") {
        setIsTrialExpiredNotice(true)
      } else {
        setIsTrialExpiredNotice(false)
      }
      setShowUpgrade(true)
    }
    window.addEventListener("hanflix:premium-required", handlePremiumRequired)
    return () =>
      window.removeEventListener(
        "hanflix:premium-required",
        handlePremiumRequired,
      )
  }, [])

  useEffect(() => {
    setShowUpgrade(false)
    setIsTrialExpiredNotice(false)
  }, [location.pathname])

  const expiry = user?.premiumExpiresAt
    ? new Date(user.premiumExpiresAt).getTime()
    : 0
  useEffect(() => {
    // Close premium views at expiry even if the tab loses its connection.
    const delay = expiry - Date.now()
    if (delay <= 0) return
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(delay + 1, 2_147_483_647),
    )
    return () => window.clearTimeout(timer)
  }, [expiry, now])

  const isExpired = expiry > 0 && expiry <= Math.max(now, Date.now())
  const allowed =
    user?.role === "admin" ||
    (!serverDenied &&
      !isExpired &&
      user?.hasPremiumAccess !== false &&
      (user?.hasPremiumAccess === true || expiry > Math.max(now, Date.now())))

  const level = user?.learningProfile?.hskLevel
  const hsk =
    Number.isInteger(level) && level! >= 1 && level! <= 9 ? level! : null

  return (
    <LearnerHskContext.Provider
      value={{ hsk, isLearner: Boolean(user && user.role !== "admin") }}
    >
      <PremiumContext.Provider value={allowed}>
        {children}
        {showUpgrade && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-label={tr(
              isTrialExpiredNotice
                ? "Hết hạn dùng thử Premium"
                : "Nâng cấp HanFlix Premium",
            )}
            onClick={() => setShowUpgrade(false)}
          >
            <div
              className="relative w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <PremiumNotice
                isTrialExpired={isTrialExpiredNotice}
                onClose={() => setShowUpgrade(false)}
              />
            </div>
          </div>
        )}
      </PremiumContext.Provider>
    </LearnerHskContext.Provider>
  )
}

export function usePremiumAccess() {
  return useContext(PremiumContext)
}
export function useLearnerHsk() {
  return useContext(LearnerHskContext)
}
export function requestPremiumUpgrade(code?: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("hanflix:premium-required", { detail: { code } }),
    )
  }
}

export function PremiumNotice({
  isTrialExpired,
  onClose,
}: {
  isTrialExpired?: boolean
  onClose?: () => void
}) {
  const { tr } = useI18n()

  return (
    <section
      className="relative rounded-3xl sm:rounded-[32px] bg-white border border-[#F2E4D8] p-6 sm:p-8 shadow-2xl shadow-neutral-950/20 overflow-hidden"
      aria-label={tr("Nội dung HanFlix Premium")}
    >
      {/* Decorative ambient top glow */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-44 bg-gradient-to-b from-amber-400/20 via-[#B91B1C]/15 to-transparent blur-3xl pointer-events-none" />

      {/* Close button if inside modal/drawer */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={tr("Đóng")}
          title={tr("Đóng")}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200/80 text-[#5F6368] hover:text-[#18181B] flex items-center justify-center transition-all cursor-pointer group active:scale-95 z-10"
        >
          <X className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
          <span className="sr-only">{tr("Đóng")}</span>
        </button>
      )}

      <div className="relative space-y-5">
        {/* Top Floating Badge & Icon */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-[#B91B1C] p-0.5 shadow-lg shadow-amber-500/25 flex items-center justify-center">
            <div className="w-full h-full rounded-[14px] bg-gradient-to-br from-[#B91B1C] to-[#8C1011] flex items-center justify-center text-white">
              <Crown className="w-7 h-7 text-amber-300 fill-amber-300 drop-shadow-xs" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-extrabold uppercase tracking-wider text-amber-900">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>
              {tr(
                isTrialExpired
                  ? "Hết hạn dùng thử"
                  : "Đặc quyền HanFlix Premium",
              )}
            </span>
          </div>

          <div className="space-y-1.5 max-w-sm">
            <h2 className="text-xl sm:text-2xl font-black font-fraunces text-[#18181B] tracking-tight">
              {tr(
                isTrialExpired
                  ? "Thời gian dùng thử Premium đã kết thúc"
                  : "Nâng cấp HanFlix Premium",
              )}
            </h2>
            <p className="text-xs sm:text-sm text-[#5F6368] leading-relaxed">
              {tr(
                isTrialExpired
                  ? "Bạn vẫn có thể tiếp tục sử dụng HanFlix Free. Nâng cấp Premium để tiếp tục sử dụng toàn bộ tính năng."
                  : "Nâng cấp HanFlix Premium để mở khóa nội dung này",
              )}
            </p>
          </div>
        </div>

        {/* Premium Benefits List */}
        <div className="rounded-2xl bg-[#FFFBF8] border border-[#F2E4D8]/80 p-3.5 sm:p-4 space-y-2.5">
          <div className="flex items-center gap-3 text-xs sm:text-sm text-[#18181B] font-semibold">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shrink-0">
              <Check className="w-3.5 h-3.5" strokeWidth={3} />
            </div>
            <span>{tr("Xem video học không giới hạn")}</span>
          </div>
          <div className="flex items-center gap-3 text-xs sm:text-sm text-[#18181B] font-semibold">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shrink-0">
              <Check className="w-3.5 h-3.5" strokeWidth={3} />
            </div>
            <span>{tr("Phụ đề Chữ Hán – Pinyin – Tiếng Việt")}</span>
          </div>
          <div className="flex items-center gap-3 text-xs sm:text-sm text-[#18181B] font-semibold">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shrink-0">
              <Check className="w-3.5 h-3.5" strokeWidth={3} />
            </div>
            <span>{tr("AI Bảo Bảo sửa phát âm 24/7")}</span>
          </div>
        </div>

        {/* Free Tier Reminder */}
        {!isTrialExpired && (
          <p className="text-[11px] sm:text-xs text-center text-[#5F6368] px-2 leading-relaxed">
            {tr(
              "Free: xem 5 video mẫu, phụ đề Chữ Hán – Pinyin – Tiếng Việt và tra cứu từ vựng cơ bản.",
            )}
          </p>
        )}

        {/* CTA Button */}
        <div className="space-y-2.5 pt-1">
          <Link
            to="/premium"
            className="w-full rounded-2xl bg-[#B91B1C] hover:bg-[#991515] text-white py-3.5 px-5 text-sm sm:text-base font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-[#B91B1C]/25 active:scale-[0.98] transition-all cursor-pointer group"
          >
            <span>
              {tr(isTrialExpired ? "Xem các gói Premium" : "Nâng cấp ngay")}
            </span>
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </div>
          </Link>

          {/* Reassurance Footer */}
          <div className="flex items-center justify-center gap-4 text-[10.5px] sm:text-[11px] text-[#8B9097] font-medium pt-1">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{tr("Thanh toán PayOS an toàn")}</span>
            </span>
            <span className="text-neutral-300">•</span>
            <span>{tr("Không tự động gia hạn")}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export function PremiumGate({
  children,
  featureKey,
}: {
  children: ReactNode
  featureKey?: string
}) {
  const allowed = usePremiumAccess()
  const location = useLocation()
  const key = featureKey || location.pathname.replace(/^\//, "").split("/")[0]
  return allowed ? <>{children}</> : <LockedFeaturePreview featureKey={key} />
}
