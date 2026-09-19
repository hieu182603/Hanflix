/**
 * HanFlix Notification Design Tokens
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
 */

import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react';

export type NotificationVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral';

export interface NotificationVariantTokens {
  bg: string;
  border: string;
  text: string;
  icon: LucideIcon;
  solidBg: string;
  ariaRole: 'alert' | 'status';
  ariaLive: 'polite' | 'assertive';
}

export const NOTIFICATION_VARIANTS: Record<NotificationVariant, NotificationVariantTokens> = {
  success: {
    bg: 'bg-[#EAF5F1]',
    border: 'border-[#C6E7DA]',
    text: 'text-[#188A5A]',
    solidBg: 'bg-[#188A5A]',
    icon: CheckCircle2,
    ariaRole: 'status',
    ariaLive: 'polite',
  },
  error: {
    bg: 'bg-[#FDF1F1]',
    border: 'border-[#F9D2D2]',
    text: 'text-[#B91B1C]',
    solidBg: 'bg-[#B91B1C]',
    icon: AlertCircle,
    ariaRole: 'alert',
    ariaLive: 'assertive',
  },
  warning: {
    bg: 'bg-[#FFF8EC]',
    border: 'border-[#FDE6BA]',
    text: 'text-[#B45309]',
    solidBg: 'bg-[#B45309]',
    icon: AlertTriangle,
    ariaRole: 'alert',
    ariaLive: 'assertive',
  },
  info: {
    bg: 'bg-[#EFF6FF]',
    border: 'border-[#BFDBFE]',
    text: 'text-[#1D4ED8]',
    solidBg: 'bg-[#1D4ED8]',
    icon: Info,
    ariaRole: 'status',
    ariaLive: 'polite',
  },
  neutral: {
    bg: 'bg-white',
    border: 'border-[#F2E4D8]',
    text: 'text-[#8C827A]',
    solidBg: 'bg-[#8C827A]',
    icon: Info,
    ariaRole: 'status',
    ariaLive: 'polite',
  },
};

export const Z_INDEX = {
  toast: 100,
  modalBackdrop: 110,
  modalPanel: 111,
} as const;

export const NOTIFICATION_SIZING = {
  banner: {
    container: 'rounded-2xl p-3.5 text-xs font-bold',
    iconWrap: 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white',
    gap: 'gap-2.5',
    shadow: 'shadow-2xs',
  },
  toast: {
    container: 'rounded-2xl border p-4 text-xs font-bold shadow-lg',
    iconWrap: 'h-5 w-5 shrink-0',
    gap: 'gap-3',
  },
  badge: {
    container: 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black tracking-wide uppercase transition-all',
    iconWrap: 'h-3 w-3 shrink-0',
  },
  modal: {
    panel: 'rounded-3xl max-w-md w-full p-6',
    backdrop: 'fixed inset-0',
  },
  spinner: {
    sm: 'h-4 w-4 border-2',
    md: 'h-5 w-5 border-2',
    lg: 'h-8 w-8 border-[3px]',
  },
} as const;

export const ANIMATION_PRESETS = {
  toastEntry: {
    initial: { x: 100, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
  },
  modalEntry: {
    backdrop: { duration: 0.2 },
    panel: { type: 'spring' as const, stiffness: 300, damping: 30 },
  },
} as const;
