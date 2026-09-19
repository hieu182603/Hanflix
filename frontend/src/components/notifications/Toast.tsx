import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { NOTIFICATION_VARIANTS, NOTIFICATION_SIZING, Z_INDEX, type NotificationVariant } from './notification.tokens';

export interface ToastItem {
  id: string;
  variant: NotificationVariant;
  message: string;
  title?: string;
  duration?: number;
  dismissible?: boolean;
}

export interface ToastViewportProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const reduce = useReducedMotion();
  const tokens = NOTIFICATION_VARIANTS[toast.variant];
  const Icon = tokens.icon;
  const effectiveDuration = toast.duration ?? 4000;

  useEffect(() => {
    if (!toast.dismissible && effectiveDuration <= 0) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), effectiveDuration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.dismissible, effectiveDuration, onDismiss]);

  const motionProps = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }
    : {
        initial: { x: 80, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { opacity: 0, scale: 0.95 },
        transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
      };

  return (
    <motion.div
      {...motionProps}
      role={tokens.ariaRole}
      aria-live={tokens.ariaLive}
      aria-atomic="true"
      className={`pointer-events-auto flex items-start ${NOTIFICATION_SIZING.toast.gap} ${NOTIFICATION_SIZING.toast.container} ${tokens.bg} ${tokens.border} ${tokens.text}`}
    >
      <Icon className={NOTIFICATION_SIZING.toast.iconWrap} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {toast.title && <div className="font-black text-[13px] leading-tight">{toast.title}</div>}
        <div className={toast.title ? 'mt-0.5 text-xs font-semibold leading-snug' : 'text-xs font-bold leading-snug'}>{toast.message}</div>
      </div>
      {toast.dismissible && (
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 -m-1 p-1 rounded-full hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C]"
          aria-label="Đóng thông báo"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </motion.div>
  );
}

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="pointer-events-none fixed right-4 top-4 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
      style={{ zIndex: Z_INDEX.toast }}
      aria-label="Thông báo"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
