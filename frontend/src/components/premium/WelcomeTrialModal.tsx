import React, { useCallback, useEffect, useRef, useState } from "react"

import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

import {
  Crown,
  Sparkles,
  Check,
  X,
  ArrowRight,
  ShieldCheck,
} from "lucide-react"

import { useI18n } from "../../i18n"

import { markTrialWelcomeSeen } from "../../api/billing"

export interface WelcomeTrialModalProps {
  isOpen: boolean

  trialEndsAt?: string | Date | null

  onClose: () => void

  onExplore?: () => void
}

interface Particle {
  id: number

  x: number

  y: number

  vx: number

  vy: number

  size: number

  color: string

  rotation: number

  vRot: number
}

export default function WelcomeTrialModal({
  isOpen,

  trialEndsAt,

  onClose,

  onExplore,
}: WelcomeTrialModalProps) {
  const { tr, locale } = useI18n()

  const [showConfetti, setShowConfetti] = useState(true)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const modalRef = useRef<HTMLDivElement | null>(null)

  const reducedMotion = useReducedMotion()

  const dismissing = useRef(false)

  const [isSaving, setIsSaving] = useState(false)

  const [saveError, setSaveError] = useState(false)

  const handleDismiss = useCallback(
    async (navigateAction?: () => void) => {
      if (dismissing.current) return

      dismissing.current = true

      setIsSaving(true)

      setSaveError(false)

      try {
        await markTrialWelcomeSeen()

        onClose()

        window.dispatchEvent(new Event("hanflix:subscription-updated"))

        navigateAction?.()
      } catch {
        setSaveError(true)
      } finally {
        dismissing.current = false

        setIsSaving(false)
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (!isOpen) return

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = "hidden"

    modalRef.current?.querySelector<HTMLButtonElement>("button")?.focus()

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return

      const buttons = modalRef.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      )

      if (!buttons?.length) {
        event.preventDefault()
        return
      }

      const first = buttons[0]

      const last = buttons[buttons.length - 1]

      if (
        !modalRef.current?.contains(document.activeElement) ||
        (event.shiftKey && document.activeElement === first)
      ) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener("keydown", trapFocus)

    return () => {
      document.body.style.overflow = previousOverflow

      window.removeEventListener("keydown", trapFocus)

      previousFocus?.focus()
    }
  }, [isOpen])

  // Keyboard accessibility: ESC to dismiss

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()

        void handleDismiss()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, handleDismiss])

  // Lightweight 1.2s hardware-accelerated confetti particle burst

  useEffect(() => {
    if (!isOpen) {
      setShowConfetti(true)

      return
    }

    if (reducedMotion) {
      setShowConfetti(false)
      return
    }

    const canvas = canvasRef.current

    if (!canvas) return

    let ctx: CanvasRenderingContext2D | null = null

    try {
      ctx = canvas.getContext("2d")
    } catch {
      return
    }

    if (!ctx) return

    let width = (canvas.width = window.innerWidth)

    let height = (canvas.height = window.innerHeight)

    const colors = [
      "#F59E0B",
      "#EF4444",
      "#EC4899",
      "#8B5CF6",
      "#10B981",
      "#3B82F6",
      "#FCD34D",
    ]

    const particles: Particle[] = Array.from({ length: 65 }, (_, i) => ({
      id: i,

      x: width / 2 + (Math.random() - 0.5) * 120,

      y: height * 0.42 + (Math.random() - 0.5) * 60,

      vx: (Math.random() - 0.5) * 16,

      vy: -Math.random() * 14 - 4,

      size: Math.random() * 7 + 4,

      color: colors[Math.floor(Math.random() * colors.length)],

      rotation: Math.random() * 360,

      vRot: (Math.random() - 0.5) * 12,
    }))

    let animationFrameId: number

    const startTime = performance.now()

    const DURATION = 1300 // Stop after 1.3 seconds to prevent battery/memory waste

    const render = (time: number) => {
      const elapsed = time - startTime

      if (elapsed > DURATION) {
        setShowConfetti(false)

        ctx.clearRect(0, 0, width, height)

        return
      }

      ctx.clearRect(0, 0, width, height)

      const alpha = Math.max(0, 1 - elapsed / DURATION)

      ctx.globalAlpha = alpha

      for (const p of particles) {
        p.x += p.vx

        p.y += p.vy

        p.vy += 0.42 // Gravity

        p.vx *= 0.98 // Air drag

        p.rotation += p.vRot

        ctx.save()

        ctx.translate(p.x, p.y)

        ctx.rotate((p.rotation * Math.PI) / 180)

        ctx.fillStyle = p.color

        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7)

        ctx.restore()
      }

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

    const handleResize = () => {
      if (!canvas) return

      width = canvas.width = window.innerWidth

      height = canvas.height = window.innerHeight
    }

    window.addEventListener("resize", handleResize)

    return () => {
      cancelAnimationFrame(animationFrameId)

      window.removeEventListener("resize", handleResize)
    }
  }, [isOpen, reducedMotion])

  const formattedDate = (() => {
    if (!trialEndsAt) {
      return ""
    }

    const d = new Date(trialEndsAt)

    return d.toLocaleDateString(locale, {
      day: "2-digit",

      month: "2-digit",

      year: "numeric",
    })
  })()

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-trial-title"
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6"
        >
          {/* Confetti Canvas */}
          {showConfetti && (
            <canvas
              ref={canvasRef}
              className="pointer-events-none fixed inset-0 z-[125] select-none"
              aria-hidden="true"
            />
          )}

          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => void handleDismiss()}
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Modal Container: Horizontal Landscape layout on sm+ screens */}
          <motion.div
            ref={modalRef}
            initial={{
              opacity: 0,
              scale: reducedMotion ? 1 : 0.94,
              y: reducedMotion ? 0 : 15,
            }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: reducedMotion ? 1 : 0.95,
              y: reducedMotion ? 0 : 10,
            }}
            transition={{
              type: "spring",

              stiffness: 350,

              damping: 28,

              mass: 0.8,
            }}
            className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-amber-200/90 overflow-y-auto sm:overflow-hidden z-[130] max-h-[92dvh] flex flex-col sm:flex-row text-left"
          >
            {/* Top Close Button (floating for easy touch) */}
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleDismiss()}
              className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-neutral-100/90 hover:bg-neutral-200/90 text-neutral-500 hover:text-neutral-800 transition-colors flex items-center justify-center cursor-pointer z-30 shadow-xs"
              aria-label={tr("Đóng")}
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* LEFT COLUMN: Visual Showcase Hero */}
            <div className="relative w-full sm:w-[42%] bg-gradient-to-br from-amber-500 via-orange-600 to-[#B91B1C] text-white p-6 sm:p-7 flex flex-col justify-between overflow-hidden shrink-0">
              {/* Ambient Glows & Background Decorative Circles */}
              <div className="absolute -top-10 -left-10 w-44 h-44 rounded-full bg-amber-300/25 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-10 -right-10 w-44 h-44 rounded-full bg-rose-400/20 blur-2xl pointer-events-none" />
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",

                  backgroundSize: "16px 16px",
                }}
              />

              {/* Top: Crown Emblem */}
              <div className="relative z-10 flex flex-col items-center sm:items-start text-center sm:text-left">
                <div className="relative mb-4">
                  <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg shadow-black/15 text-white">
                    <Crown className="w-8 h-8 sm:w-9 sm:h-9 fill-amber-300 text-amber-200 drop-shadow-sm" />
                  </div>
                  <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow-md motion-safe:animate-bounce">
                    <Sparkles className="w-3.5 h-3.5 fill-current" />
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs border border-white/25 text-[11px] font-black uppercase tracking-wider text-amber-100 mb-2">
                  <span>✨ HanFlix Premium</span>
                </div>

                <div className="font-black text-xl sm:text-2xl text-white tracking-tight drop-shadow-xs leading-tight">
                  {tr("15 NGÀY PREMIUM MIỄN PHÍ")}
                </div>
              </div>

              {/* Bottom: Expiry Date Box & Subtle Note */}
              <div className="relative z-10 mt-6 sm:mt-8 space-y-3">
                <div className="p-3 rounded-2xl bg-black/20 backdrop-blur-md border border-white/20 text-xs">
                  <p className="text-amber-100 text-[11px] font-medium">
                    {tr("Premium Trial của bạn có hiệu lực đến:")}
                  </p>
                  <p className="text-white font-black text-sm tracking-wide mt-0.5">
                    {formattedDate}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-amber-100/90 font-semibold justify-center sm:justify-start">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>{tr("Không cần thẻ • Không tự động gia hạn")}</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Benefits & Actions */}
            <div className="w-full sm:w-[58%] p-6 sm:p-7 md:p-8 flex flex-col justify-between shrink-0 sm:shrink overflow-visible sm:overflow-y-auto relative z-10 bg-white space-y-5">
              {/* Header Texts */}
              <div className="space-y-1.5 pr-8">
                <div className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/70">
                  <span>🎁</span>
                  <span>{tr("Quà tặng thành viên mới")}</span>
                </div>
                <h2
                  id="welcome-trial-title"
                  className="text-lg sm:text-xl font-black text-[#18181B] tracking-tight leading-snug"
                >
                  {tr("🎁 Chào mừng bạn đến với HanFlix!")}
                </h2>
                <p className="text-xs sm:text-sm text-[#5F6368] leading-relaxed">
                  {tr(
                    "Trải nghiệm toàn bộ tính năng Premium và học tiếng Trung qua phim cùng HanFlix.",
                  )}
                </p>
              </div>

              {/* Feature Highlights Cards */}
              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#FFF9F5] border border-[#F5E6DC]">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-neutral-900">
                      {tr("Toàn bộ tính năng Premium")}
                    </div>
                    <div className="text-[11px] sm:text-xs text-neutral-500 leading-normal mt-0.5">
                      {tr(
                        "Xem phim không giới hạn, song ngữ Pinyin, tra từ thông minh và AI phân tích ngữ pháp",
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#FFF9F5] border border-[#F5E6DC]">
                  <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-neutral-900">
                      {tr("Trải nghiệm 100% không rủi ro")}
                    </div>
                    <div className="text-[11px] sm:text-xs text-neutral-500 leading-normal mt-0.5">
                      {tr("Tự động kết thúc sau 15 ngày • Không phát sinh phí")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Button Group */}
              <div className="pt-1 space-y-2.5">
                {saveError && (
                  <p role="alert" className="text-sm text-red-700">
                    {tr("Chưa thể lưu thay đổi. Vui lòng thử lại.")}
                  </p>
                )}
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleDismiss(onExplore)}
                  className="w-full rounded-2xl bg-gradient-to-r from-[#DC2626] via-[#B91B1C] to-[#991B1B] hover:from-[#EF4444] hover:to-[#B91B1C] py-3.5 px-5 text-sm sm:text-base font-black text-white shadow-lg shadow-red-950/20 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 group"
                >
                  <span>{tr("Bắt đầu khám phá Premium")}</span>
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <ArrowRight className="w-3.5 h-3.5 text-white" />
                  </div>
                </button>

                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void handleDismiss()}
                    className="py-1.5 text-xs sm:text-sm font-bold text-[#71717A] hover:text-[#18181B] transition-colors cursor-pointer"
                  >
                    {tr("Để sau")}
                  </button>

                  <span className="text-[11px] text-[#A1A1AA] flex items-center gap-1 font-medium">
                    <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                    <span>{tr("Đã kích hoạt")}</span>
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
