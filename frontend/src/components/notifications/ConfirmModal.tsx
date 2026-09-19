import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Info } from 'lucide-react';
import { NOTIFICATION_SIZING, Z_INDEX } from './notification.tokens';

export type ConfirmTone = 'default' | 'danger';

export interface ConfirmDialogState {
  title: string;
  message: React.ReactNode;
  confirmText: string;
  cancelText: string;
  tone: ConfirmTone;
  resolve: (value: boolean) => void;
}

export interface ConfirmModalViewportProps {
  state: ConfirmDialogState | null;
  onClose: (result: boolean) => void;
}

function ConfirmModal({ state, onClose }: { state: ConfirmDialogState; onClose: (result: boolean) => void }) {
  const reduce = useReducedMotion();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => cancelRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(t);
      previousActiveElement.current?.focus?.();
    };
  }, []);

  const isDanger = state.tone === 'danger';
  const Icon = isDanger ? AlertTriangle : Info;
  const confirmClass = isDanger
    ? 'bg-[#B91B1C] hover:bg-[#991314] focus-visible:ring-[#B91B1C]'
    : 'bg-[#B91B1C] hover:bg-[#991314] focus-visible:ring-[#B91B1C]';

  const backdropMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.1 } }
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } };

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

  const titleId = 'confirm-modal-title';
  const descId = 'confirm-modal-desc';

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose(false);
  };

  return (
    <div
      className={NOTIFICATION_SIZING.modal.backdrop + ' flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm'}
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
        className={`relative bg-white ${NOTIFICATION_SIZING.modal.panel} shadow-2xl`}
        style={{ zIndex: Z_INDEX.modalPanel }}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isDanger ? 'bg-[#FDF1F1] text-[#B91B1C]' : 'bg-[#EFF6FF] text-[#1D4ED8]'}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="flex-1 min-w-0">
            <h3 id={titleId} className="text-base font-black text-[#2B2826] leading-tight">
              {state.title}
            </h3>
            <div id={descId} className="mt-2 text-sm text-[#5F564F] leading-relaxed">
              {state.message}
            </div>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onClose(false)}
            className="rounded-2xl border border-[#F2E4D8] bg-white px-4 py-2 text-xs font-bold text-[#2B2826] hover:bg-[#FFF9F5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C827A]"
          >
            {state.cancelText}
          </button>
          <button
            type="button"
            onClick={() => onClose(true)}
            className={`rounded-2xl px-4 py-2 text-xs font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${confirmClass}`}
          >
            {state.confirmText}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function ConfirmModalViewport({ state, onClose }: ConfirmModalViewportProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {state && <ConfirmModal key="confirm-modal" state={state} onClose={onClose} />}
    </AnimatePresence>,
    document.body,
  );
}
