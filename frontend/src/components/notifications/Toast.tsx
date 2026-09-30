import { useI18n } from '../../i18n';
/**
 * Toast component + ToastViewport
 *
 * v2 changes (2026-09-23):
 * - Progress bar countdown (bottom edge, per-toast)
 * - Action slot (optional button inside toast)
 * - Variant-specific entry/exit animation from design tokens
 * - Icon shake for destructive variant
 * - Fixed duration=0 semantics (sticky = no auto-dismiss)
 * - Position prop: top-right | top-center | bottom-center
 * - Mobile-safe positioning
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import {
  NOTIFICATION_VARIANTS,
  NOTIFICATION_SIZING,
  Z_INDEX,
  TOAST_POSITIONS,
  TOAST_ANIMATIONS,
  type NotificationVariant,
  type ToastPosition,
} from './notification.tokens';

export interface ToastItem {
  id: string;
  variant: NotificationVariant;
  message: string;
  title?: string;
  /** Auto-dismiss duration in ms. 0 = sticky (no auto-dismiss). */
  duration?: number;
  dismissible?: boolean;
  /** Optional action button inside the toast */
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastViewportProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  /** Default position for all toasts. Default: 'top-right' */
  position?: ToastPosition;
}

function cn(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(' ');
}

/** ─── Single Toast ─────────────────────────────────────────────────────────── */
function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const { tr, ui } = useI18n();
  const reduce = useReducedMotion();
  const tokens = NOTIFICATION_VARIANTS[toast.variant];
  const Icon = tokens.icon;
  const animConfig = TOAST_ANIMATIONS[toast.variant];

  // Sticky = duration is 0 OR dismissible is explicitly false
  const isSticky = toast.duration === 0 || toast.dismissible === false;
  // Effective duration: use explicit duration, or variant default if not set
  const effectiveDuration = toast.duration !== undefined ? toast.duration : tokens.defaultDuration;

  // Progress bar state
  const [progress, setProgress] = useState(100);
  const progressRafRef = useRef<number | null>(null);
  const progressStartRef = useRef<number | null>(null);

  // Start countdown progress bar
  const startCountdown = useCallback(() => {
    if (isSticky || effectiveDuration <= 0 || reduce) return;
    progressStartRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - (progressStartRef.current ?? now);
      const pct = Math.max(0, 100 - (elapsed / effectiveDuration) * 100);
      setProgress(pct);
      if (pct > 0) {
        progressRafRef.current = requestAnimationFrame(tick);
      }
    };
    progressRafRef.current = requestAnimationFrame(tick);
  }, [isSticky, effectiveDuration, reduce]);

  // Auto-dismiss timer
  useEffect(() => {
    if (isSticky || effectiveDuration <= 0) return;
    startCountdown();
    const timer = window.setTimeout(() => onDismiss(toast.id), effectiveDuration);
    return () => {
      window.clearTimeout(timer);
      if (progressRafRef.current) {
        cancelAnimationFrame(progressRafRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id, effectiveDuration, isSticky]);

  // Framer Motion config
  const motionProps = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }
    : {
        initial: animConfig.entry.initial,
        animate: animConfig.entry.animate,
        exit: animConfig.exit,
        transition: animConfig.transition,
      };

  // Icon shake keyframes via CSS animation class
  const iconShakeClass =
    animConfig.iconShake && !reduce
      ? 'animate-[icon-shake_0.5s_ease-in-out_0.3s]'
      : '';

  return (
    <motion.div
      {...motionProps}
      role={tokens.ariaRole}
      aria-live={tokens.ariaLive}
      aria-atomic="true"
      className={cn(
        'group relative overflow-hidden pointer-events-auto',
        NOTIFICATION_SIZING.toast.container,
        tokens.bg,
        tokens.border,
        tokens.text,
        // Subtle hover lift
        'hover:shadow-xl transition-shadow duration-200',
      )}
    >
      {/* Progress bar — bottom edge, shrinks over duration */}
      {!isSticky && effectiveDuration > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/10"
          aria-hidden="true"
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-100 ease-linear',
              // Color the progress bar matching the variant accent
              toast.variant === 'success' && 'bg-[#188A5A]',
              toast.variant === 'info' && 'bg-[#1D4ED8]',
              toast.variant === 'warning' && 'bg-[#B45309]',
              toast.variant === 'error' && 'bg-[#B91B1C]',
              toast.variant === 'destructive' && 'bg-[#B91B1C]',
              toast.variant === 'neutral' && 'bg-[#8C827A]',
            )}
            style={{ width: reduce ? '100%' : `${progress}%` }}
          />
        </div>
      )}

      {/* Main content row */}
      <div className={cn('flex items-start', NOTIFICATION_SIZING.toast.gap)}>
        {/* Icon */}
        <div
          className={cn(
            NOTIFICATION_SIZING.toast.iconWrapSolid,
            tokens.iconBg,
            tokens.iconColor,
            iconShakeClass,
          )}
          aria-hidden="true"
        >
          <Icon className={cn(NOTIFICATION_SIZING.toast.iconWrap)} />
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          {toast.title && (
            <div className="font-black text-[13px] leading-tight">{ui(toast.title)}</div>
          )}
          <div
            className={cn(
              toast.title
                ? 'mt-0.5 text-xs font-semibold leading-snug'
                : 'text-xs font-bold leading-snug',
              // Word-break for long messages
              'break-words',
            )}
          >
            {ui(toast.message)}
          </div>

          {/* Action button */}
          {toast.action && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toast.action!.onClick();
                onDismiss(toast.id);
              }}
              className={cn(
                'mt-2 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer',
                'border border-current/20 hover:bg-white/20 active:scale-[0.97]',
              )}
            >
              {ui(toast.action.label)}
            </button>
          )}
        </div>

        {/* Dismiss button */}
        {toast.dismissible !== false && (
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className={cn(
              'shrink-0 -m-1 p-1 rounded-full transition-all cursor-pointer',
              'hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C]',
              'opacity-0 group-hover:opacity-100 focus:opacity-100',
              'text-current',
            )}
            aria-label={tr("Đóng thông báo")}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

/** ─── Toast Viewport ───────────────────────────────────────────────────────── */
export function ToastViewport({
  toasts,
  onDismiss,
  position = 'top-right',
}: ToastViewportProps) {
  const { tr } = useI18n();
  if (typeof document === 'undefined') return null;

  const posConfig = TOAST_POSITIONS[position];

  return createPortal(
    <div
      className={cn(
        'pointer-events-none',
        posConfig.container,
        // Mobile safe: account for notch + status bar
        'safe-area-top',
      )}
      style={{ zIndex: Z_INDEX.toast }}
      aria-label={tr("Thông báo")}
    >
      <style>{`
        @keyframes icon-shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }
      `}</style>

      <AnimatePresence initial={false} mode="popLayout">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
