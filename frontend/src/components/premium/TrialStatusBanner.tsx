import React from "react"

import { Crown, Sparkles, Clock, AlertTriangle, ArrowRight } from "lucide-react"

import { useI18n } from "../../i18n"

import type { UserSubscription } from "../../api/billing"

import {
  formatTrialRemaining,
  formatTrialEndDate,
  isTrialExpiringSoon,
} from "./subscriptionState"

interface TrialStatusBannerProps {
  subscription?: UserSubscription | null

  onNavigateLessons?: () => void
}

export default function TrialStatusBanner({
  subscription,

  onNavigateLessons,
}: TrialStatusBannerProps) {
  const { tr, locale } = useI18n()

  const trial = subscription?.trial

  const endsAt = trial?.endsAt ?? subscription?.premiumExpiresAt

  const remainingText = formatTrialRemaining(endsAt, trial?.remainingSeconds)

  const endDateText = formatTrialEndDate(endsAt, locale)

  const expiringSoon = isTrialExpiringSoon(endsAt, trial?.remainingSeconds)

  const paidStart = subscription?.premium?.startedAt

  const scheduled = Boolean(
    paidStart &&
      subscription?.premium?.endsAt &&
      subscription.status === "TRIAL",
  )

  const paidPlan = subscription?.premium?.planCode

  const planLabel =
    paidPlan === "quarterly"
      ? tr("3 tháng")
      : paidPlan === "yearly"
        ? tr("1 năm")
        : tr("1 tháng")

  return (
    <section
      aria-label={tr("Thông tin dùng thử HanFlix Premium")}
      className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border-2 border-amber-300 shadow-sm relative overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-md shrink-0">
            <Crown className="w-6 h-6 fill-white" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-base text-[#18181B] tracking-tight">
                {tr("Premium Trial")}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-extrabold text-[10px] uppercase tracking-wider shadow-2xs">
                {tr("Dùng thử 15 ngày")}
              </span>
              {expiringSoon && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 border border-red-200 text-[#B91B1C] font-bold text-[10px]">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{tr("Sắp hết thời gian dùng thử")}</span>
                </span>
              )}
            </div>

            <p className="text-sm font-semibold text-[#18181B]">
              {tr("Bạn đang trải nghiệm HanFlix Premium miễn phí.")}
            </p>

            {scheduled && (
              <div className="text-sm text-emerald-800" role="status">
                <p className="font-bold">{tr("Premium đã được đăng ký")}</p>
                <p>
                  {tr("Gói {0} sẽ bắt đầu từ {1}", {
                    0: planLabel,
                    1: formatTrialEndDate(paidStart, locale),
                  })}
                </p>
              </div>
            )}
            <div className="flex items-center gap-4 text-xs text-[#5F6368] flex-wrap pt-0.5">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-bold text-amber-900">
                  {remainingText}
                </span>
              </div>
              {endDateText && (
                <>
                  <span className="text-neutral-300">·</span>
                  <div>
                    <span>{tr("Kết thúc vào")} </span>
                    <strong className="text-[#18181B]">{endDateText}</strong>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {onNavigateLessons && (
          <div className="shrink-0 flex items-center">
            <button
              type="button"
              onClick={onNavigateLessons}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all shadow-sm hover:shadow active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{tr("Bắt đầu học")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
