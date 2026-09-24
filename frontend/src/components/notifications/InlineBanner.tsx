/**
 * InlineBanner + SectionBanner
 *
 * v2 changes (2026-09-23):
 * - Framer-motion animation thay vì animate-in utility classes
 * - Fixed auto-dismiss: dùng useCallback để parent có thể clear state
 * - Icon slot: cho phép override icon (dùng cho upload error, network error, etc.)
 * - Action slot cải tiến
 * - SectionBanner: semantic wrapper cho in-page banners (không dismissible, không auto-dismiss)
 * - InlineBanner: backward-compatible (dismissible, auto-dismiss tùy chọn)
 */
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import {
  NOTIFICATION_VARIANTS,
  type NotificationVariant,
} from './notification.tokens';

function cn(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(' ');
}

/** ─── Shared Banner Layout ─────────────────────────────────────────────── */
function BannerLayout({
  variant,
  title,
  message,
  icon,
  action,
  dismissible,
  onDismiss,
  className,
}: {
  variant: NotificationVariant;
  title?: React.ReactNode;
  message: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const tokens = NOTIFICATION_VARIANTS[variant];
  const IconComponent = tokens.icon;

  const motionProps = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }
    : {
        initial: { opacity: 0, y: -8, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -4, scale: 0.99 },
        transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const },
      };

  return (
    <motion.div
      {...motionProps}
      role={tokens.ariaRole}
      aria-live={tokens.ariaLive}
      aria-atomic="true"
      className={cn(
        'flex items-start gap-2.5 rounded-2xl border p-3.5 text-xs font-bold shadow-2xs',
        tokens.bg,
        tokens.border,
        tokens.text,
        className,
      )}
    >
      {/* Icon */}
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
          tokens.iconBg,
          tokens.iconColor,
        )}
        aria-hidden="true"
      >
        {icon ?? <IconComponent className="h-4 w-4" />}
      </span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        {title && <div className="font-black text-[13px] leading-tight">{title}</div>}
        <div
          className={cn(
            title ? 'mt-0.5 text-xs font-semibold leading-snug' : 'text-xs font-bold leading-snug',
            'break-words',
          )}
        >
          {message}
        </div>
        {action && <div className="mt-2">{action}</div>}
      </div>

      {/* Dismiss */}
      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          className={cn(
            'shrink-0 -m-1 p-1 rounded-full transition-colors cursor-pointer',
            'hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C]',
            'text-current opacity-60 hover:opacity-100',
          )}
          aria-label="Đóng thông báo"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </motion.div>
  );
}

/** ─── InlineBanner (legacy API — backward compatible) ──────────────────── */
export interface InlineBannerProps {
  variant: NotificationVariant;
  title?: React.ReactNode;
  message: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /**
   * Auto-dismiss sau N ms. Mặc định: 0 (không auto-dismiss).
   * Khi dismiss, gọi onDismiss callback để parent clear state.
   */
  autoDismissMs?: number;
}

export function InlineBanner({
  variant,
  title,
  message,
  dismissible = false,
  onDismiss,
  icon,
  action,
  className,
  autoDismissMs = 0,
}: InlineBannerProps) {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss
  useEffect(() => {
    if (autoDismissMs <= 0) return;
    const t = window.setTimeout(() => {
      setVisible(false);
    }, autoDismissMs);
    return () => window.clearTimeout(t);
  }, [autoDismissMs]);

  // Gọi parent callback sau khi exit animation
  useEffect(() => {
    if (!visible && onDismiss) {
      const t = window.setTimeout(() => {
        onDismiss();
      }, 250); // chờ exit animation
      return () => window.clearTimeout(t);
    }
  }, [visible, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <BannerLayout
          variant={variant}
          title={title}
          message={message}
          icon={icon}
          action={action}
          dismissible={dismissible}
          onDismiss={() => setVisible(false)}
          className={className}
        />
      )}
    </AnimatePresence>
  );
}

/** ─── SectionBanner ──────────────────────────────────────────────────────
 * Dùng cho banners trong flow page (không có nút X, không auto-dismiss).
 * Semantic: đây là thông tin cố định của page section.
 *
 * Usage:
 *   <SectionBanner variant="warning" title="Lưu ý" message="..." />
 */
export interface SectionBannerProps {
  variant: NotificationVariant;
  title?: React.ReactNode;
  message: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function SectionBanner({
  variant,
  title,
  message,
  icon,
  action,
  className,
}: SectionBannerProps) {
  return (
    <BannerLayout
      variant={variant}
      title={title}
      message={message}
      icon={icon}
      action={action}
      dismissible={false}
      onDismiss={undefined}
      className={className}
    />
  );
}
