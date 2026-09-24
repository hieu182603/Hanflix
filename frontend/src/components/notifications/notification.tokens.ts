/**
 * HanFlix Notification Design Tokens v2
 *
 * Single source of truth cho mọi notification/banner/toast/modal/spinner trong app.
 * KHONG su dung hard-code hex/color/class o noi khac - moi component notification
 * phai import tu day.
 *
 * Z-index scale (giữ đồng bộ với các modal khác trong app):
 *   - Toast viewport:          z-[100]
 *   - Confirm modal backdrop:  z-[110]
 *   - Confirm modal panel:     z-[111]
 *   - (Modal khác trong app phải >= 120 để đè lên confirm modal)
 *
 * Design philosophy:
 *   - Variants đủ gradient từ "soft" (info/success) → "medium" (warning) → "hard" (error/destructive)
 *   - Destructive = critical system failure (mất kết nối, lỗi nghiêm trọng) — viết hoa + shake icon
 *   - Error = operation failed (validate fail, save fail) — không shake, chỉ solid
 *   - Error dùng assert live (screen reader phải đọc ngay)
 *   - Success/info dùng polite (screen reader đọc khi idle)
 */

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

// ─── Variant Definitions ─────────────────────────────────────────────────────

export type NotificationVariant =
  | 'success'
  | 'info'
  | 'warning'
  | 'error'
  | 'destructive'
  | 'neutral';

export interface NotificationVariantTokens {
  bg: string;
  border: string;
  text: string;
  icon: LucideIcon;
  solidBg: string;
  /** Đổ background cho icon container */
  iconBg: string;
  /** Icon color khi solid bg */
  iconColor: string;
  ariaRole: 'alert' | 'status';
  ariaLive: 'polite' | 'assertive';
  /** Độ ưu tiên: 1 (lowest) → 5 (highest). Dùng cho toast stacking. */
  priority: number;
  /** Default auto-dismiss ms. 0 = no auto-dismiss (sticky). */
  defaultDuration: number;
  /** Toast entry motion direction */
  entryFrom: 'right' | 'left' | 'bottom' | 'top';
  /** Toast exit motion direction */
  exitTo: 'right' | 'left' | 'bottom' | 'top' | 'fade';
  /** Shake icon on mount (destructive/critical) */
  shakeIcon: boolean;
}

/**
 * Priority map dùng trong NotificationProvider.pushToast.
 * Thứ tự: destructive(6) > error(5) > warning(4) > info(3) > success(2) > neutral(1)
 */
export const NOTIFICATION_PRIORITY: Record<NotificationVariant, number> = {
  destructive: 6,
  error: 5,
  warning: 4,
  info: 3,
  success: 2,
  neutral: 1,
};

/** Default durations per variant (ms). 0 = sticky. */
export const NOTIFICATION_DURATION: Record<NotificationVariant, number> = {
  destructive: 0,   // Sticky — user phải đọc và tắt tay
  error: 0,         // Sticky — lỗi phải được acknowledge
  warning: 6000,    // 6s
  info: 4000,       // 4s
  success: 3000,    // 3s
  neutral: 5000,    // 5s
};

export const NOTIFICATION_VARIANTS: Record<NotificationVariant, NotificationVariantTokens> = {
  success: {
    bg: 'bg-[#EAF5F1]',
    border: 'border-[#C6E7DA]',
    text: 'text-[#188A5A]',
    solidBg: 'bg-[#188A5A]',
    iconBg: 'bg-[#188A5A]',
    iconColor: 'text-white',
    icon: CheckCircle2,
    ariaRole: 'status',
    ariaLive: 'polite',
    priority: 2,
    defaultDuration: 3000,
    entryFrom: 'bottom',
    exitTo: 'bottom',
    shakeIcon: false,
  },
  info: {
    bg: 'bg-[#EFF6FF]',
    border: 'border-[#BFDBFE]',
    text: 'text-[#1D4ED8]',
    solidBg: 'bg-[#1D4ED8]',
    iconBg: 'bg-[#1D4ED8]',
    iconColor: 'text-white',
    icon: Info,
    ariaRole: 'status',
    ariaLive: 'polite',
    priority: 3,
    defaultDuration: 4000,
    entryFrom: 'right',
    exitTo: 'fade',
    shakeIcon: false,
  },
  warning: {
    bg: 'bg-[#FFF8EC]',
    border: 'border-[#FDE6BA]',
    text: 'text-[#B45309]',
    solidBg: 'bg-[#B45309]',
    iconBg: 'bg-[#B45309]',
    iconColor: 'text-white',
    icon: AlertTriangle,
    ariaRole: 'alert',
    ariaLive: 'assertive',
    priority: 4,
    defaultDuration: 6000,
    entryFrom: 'right',
    exitTo: 'fade',
    shakeIcon: false,
  },
  error: {
    bg: 'bg-[#FDF1F1]',
    border: 'border-[#F9D2D2]',
    text: 'text-[#B91B1C]',
    solidBg: 'bg-[#B91B1C]',
    iconBg: 'bg-[#B91B1C]',
    iconColor: 'text-white',
    icon: AlertCircle,
    ariaRole: 'alert',
    ariaLive: 'assertive',
    priority: 5,
    defaultDuration: 0,
    entryFrom: 'left',
    exitTo: 'left',
    shakeIcon: false,
  },
  /** Destructive = critical system failure. Khác với error ở chỗ: icon XCircle,
   *  shake animation, toàn bộ visual nặng hơn. */
  destructive: {
    bg: 'bg-[#FDF1F1]',
    border: 'border-[#B91B1C]',
    text: 'text-[#7F1D1D]',
    solidBg: 'bg-[#B91B1C]',
    iconBg: 'bg-[#B91B1C]',
    iconColor: 'text-white',
    icon: XCircle,
    ariaRole: 'alert',
    ariaLive: 'assertive',
    priority: 6,
    defaultDuration: 0,
    entryFrom: 'left',
    exitTo: 'left',
    shakeIcon: true,
  },
  neutral: {
    bg: 'bg-white',
    border: 'border-[#F2E4D8]',
    text: 'text-[#8C827A]',
    solidBg: 'bg-[#8C827A]',
    iconBg: 'bg-[#8C827A]',
    iconColor: 'text-white',
    icon: Info,
    ariaRole: 'status',
    ariaLive: 'polite',
    priority: 1,
    defaultDuration: 5000,
    entryFrom: 'right',
    exitTo: 'fade',
    shakeIcon: false,
  },
};

// ─── Z-Index ────────────────────────────────────────────────────────────────

export const Z_INDEX = {
  toast: 100,
  modalBackdrop: 110,
  modalPanel: 111,
} as const;

// ─── Sizing Tokens ──────────────────────────────────────────────────────────

export const NOTIFICATION_SIZING = {
  banner: {
    container: 'rounded-2xl p-3.5 text-xs font-bold',
    iconWrap:
      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white',
    iconWrapSolid: 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black',
    gap: 'gap-2.5',
    shadow: 'shadow-2xs',
  },
  toast: {
    container:
      'rounded-2xl border p-4 text-xs font-bold shadow-lg',
    containerWithAction:
      'rounded-2xl border p-3 text-xs font-bold shadow-lg',
    iconWrap: 'h-5 w-5 shrink-0',
    iconWrapSolid: 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black',
    gap: 'gap-3',
    progressBar: 'h-0.5 rounded-full',
  },
  badge: {
    container:
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black tracking-wide uppercase transition-all',
    iconWrap: 'h-3 w-3 shrink-0',
  },
  modal: {
    panel: 'rounded-3xl max-w-md w-full p-6',
    backdrop: 'fixed inset-0',
    dangerPanel: 'rounded-3xl max-w-md w-full p-6',
    dangerBackdrop: 'fixed inset-0',
  },
  spinner: {
    sm: 'h-4 w-4 border-2',
    md: 'h-5 w-5 border-2',
    lg: 'h-8 w-8 border-[3px]',
  },
} as const;

// ─── Toast Viewport Positions ────────────────────────────────────────────────

export type ToastPosition =
  | 'top-right'
  | 'top-center'
  | 'bottom-center';

export const TOAST_POSITIONS: Record<
  ToastPosition,
  { container: string; itemEntry: string }
> = {
  'top-right': {
    container:
      'fixed right-4 top-4 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2',
    itemEntry: '',
  },
  'top-center': {
    container:
      'fixed left-1/2 top-4 -translate-x-1/2 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2',
    itemEntry: '',
  },
  'bottom-center': {
    container:
      'fixed bottom-6 left-1/2 -translate-x-1/2 flex w-[calc(100vw-3rem)] max-w-sm flex-col gap-2',
    itemEntry: '',
  },
};

// ─── Animation Presets (per-variant override) ────────────────────────────────

type Easing = readonly [number, number, number, number];

/** Per-variant animation configs for toast entry/exit */
export const TOAST_ANIMATIONS: Record<
  NotificationVariant,
  {
    entry: { initial: Record<string, number>; animate: Record<string, number> };
    exit: Record<string, number>;
    transition: { duration: number; ease: Easing };
    iconShake?: boolean;
  }
> = {
  success: {
    entry: {
      initial: { y: 24, opacity: 0 },
      animate: { y: 0, opacity: 1 },
    },
    exit: { opacity: 0, y: 16, scale: 0.96 },
    transition: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] as Easing },
  },
  info: {
    entry: {
      initial: { x: 80, opacity: 0 },
      animate: { x: 0, opacity: 1 },
    },
    exit: { opacity: 0, scale: 0.97 },
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as Easing },
  },
  warning: {
    entry: {
      initial: { x: 80, opacity: 0 },
      animate: { x: 0, opacity: 1 },
    },
    exit: { opacity: 0, scale: 0.97 },
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as Easing },
  },
  error: {
    entry: {
      initial: { x: -60, opacity: 0 },
      animate: { x: 0, opacity: 1 },
    },
    exit: { opacity: 0, x: -40, scale: 0.97 },
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as Easing },
  },
  destructive: {
    entry: {
      initial: { x: -60, opacity: 0 },
      animate: { x: 0, opacity: 1 },
    },
    exit: { opacity: 0, x: -40, scale: 0.97 },
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as Easing },
    iconShake: true,
  },
  neutral: {
    entry: {
      initial: { x: 80, opacity: 0 },
      animate: { x: 0, opacity: 1 },
    },
    exit: { opacity: 0, scale: 0.97 },
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as Easing },
  },
};

export const ANIMATION_PRESETS = {
  toastEntry: {
    initial: { x: 100, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as Easing },
  },
  modalEntry: {
    backdrop: { duration: 0.2 },
    panel: { type: 'spring' as const, stiffness: 300, damping: 30 },
  },
} as const;
