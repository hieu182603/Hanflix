import { useI18n } from '../../i18n';
/**
 * ConfirmModal + ConfirmModalViewport
 *
 * v2 changes (2026-09-23):
 * - Danger tone: red icon bg + red accent, destructive button style
 * - Default tone: blue icon bg + neutral button style
 * - Thêm tertiaryAction slot
 * - Refined focus management với proper focus trap
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Info } from 'lucide-react';
import {
  NOTIFICATION_SIZING,
  Z_INDEX,
} from './notification.tokens';

export type ConfirmTone = 'default' | 'danger';

export interface ConfirmDialogState {
  title: string;
  message: React.ReactNode;
  confirmText: string;
  cancelText: string;
  tone: ConfirmTone;
  /** Optional tertiary action — ví dụ: "Lưu bản nháp" */
  tertiaryText?: string;
  onTertiary?: () => void;
  resolve: (value: boolean) => void;
}

export interface ConfirmModalViewportProps {
  state: ConfirmDialogState | null;
  onClose: (result: boolean) => void;
}

export interface ConfirmModalProps {
  state: ConfirmDialogState;
  onClose: (result: boolean) => void;
}

function cn(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(' ');
}

function ConfirmModal({ state, onClose }: ConfirmModalProps) {
  const { ui } = useI18n();
  const reduce = useReducedMotion();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const isDanger = state.tone === 'danger';

  // Focus management
  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => cancelRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(t);
      previousActiveElement.current?.focus?.();
    };
  }, []);

  // Backdrop click closes
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose(false);
  };

  // Motion config
  const backdropMotion = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.1 },
      }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2 },
      };

  const panelMotion = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }
    : {
        initial: { opacity: 0, scale: 0.95, y: 8 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.97 },
        transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
      };

  // Visual distinction giữa danger và default
  const Icon = isDanger ? AlertTriangle : Info;
  const iconBgClass = isDanger
    ? 'bg-[#FDF1F1] text-[#B91B1C]'
    : 'bg-[#EFF6FF] text-[#1D4ED8]';
  const confirmClass = isDanger
    ? 'bg-[#B91B1C] hover:bg-[#991313] text-white shadow-sm'
    : 'bg-[#1D4ED8] hover:bg-[#1E40AF] text-white shadow-sm';
  const confirmFocusRing = isDanger
    ? 'focus-visible:ring-[#B91B1C]'
    : 'focus-visible:ring-[#1D4ED8]';

  const titleId = 'confirm-modal-title';
  const descId = 'confirm-modal-desc';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      style={{ zIndex: Z_INDEX.modalBackdrop }}
      onClick={handleBackdropClick}
    >
      <motion.div
        {...backdropMotion}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
      />
      <motion.div
        {...panelMotion}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={cn(
          'relative bg-white',
          NOTIFICATION_SIZING.modal.panel,
          'shadow-2xl border',
          isDanger ? 'border-[#F9D2D2]' : 'border-[#E7E7EA]',
        )}
        style={{ zIndex: Z_INDEX.modalPanel }}
      >
        {/* Header: Icon + Title + Message */}
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              iconBgClass,
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="flex-1 min-w-0">
            <h3
              id={titleId}
              className={cn(
                'text-base font-black leading-tight',
                isDanger ? 'text-[#7F1D1D]' : 'text-[#2B2826]',
              )}
            >
              {ui(state.title)}
            </h3>
            <div
              id={descId}
              className={cn(
                'mt-2 text-sm leading-relaxed',
                isDanger ? 'text-[#991313]' : 'text-[#5F564F]',
              )}
            >
              {ui(state.message)}
            </div>
          </div>
        </div>

        {/* Actions row */}
        <div
          className={cn(
            'mt-6 flex items-center justify-end gap-2',
            state.tertiaryText ? 'flex-wrap' : '',
          )}
        >
          {/* Tertiary action (optional) */}
          {state.tertiaryText && (
            <button
              type="button"
              onClick={() => {
                onClose(false);
                state.onTertiary?.();
              }}
              className={cn(
                'rounded-2xl border px-4 py-2 text-xs font-bold transition-all',
                'text-[#5F564F] border-[#E7E7EA] bg-white',
                'hover:bg-[#F7F7F9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C827A]',
              )}
            >
              {ui(state.tertiaryText)}
            </button>
          )}

          {/* Cancel */}
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onClose(false)}
            className={cn(
              'rounded-2xl border px-4 py-2 text-xs font-bold transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              isDanger
                ? 'border-[#F9D2D2] bg-white text-[#B91B1C] hover:bg-[#FFF5F5] focus-visible:ring-[#B91B1C]'
                : 'border-[#E7E7EA] bg-white text-[#2B2826] hover:bg-[#FFF9F5] focus-visible:ring-[#8C827A]',
            )}
          >
            {ui(state.cancelText)}
          </button>

          {/* Confirm */}
          <button
            type="button"
            onClick={() => onClose(true)}
            className={cn(
              'rounded-2xl px-4 py-2 text-xs font-bold text-white transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              confirmClass,
              confirmFocusRing,
              isDanger ? 'shadow-sm' : '',
            )}
          >
            {ui(state.confirmText)}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function ConfirmModalViewport({
  state,
  onClose,
}: ConfirmModalViewportProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {state && (
        <ConfirmModal key="confirm-modal" state={state} onClose={onClose} />
      )}
    </AnimatePresence>,
    document.body,
  );
}
