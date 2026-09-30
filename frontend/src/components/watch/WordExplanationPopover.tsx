import { useI18n } from '../../i18n';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { WordExplanation } from '../../api/learning';

export type WordExplanationPopoverProps = {
  anchor: { x: number; y: number } | null;
  wordText: string;
  loading: boolean;
  error: string;
  explanation: WordExplanation | null;
  onClose: () => void;
  onSaveWord?: () => void;
};

const POPOVER_WIDTH = 320;
const POPOVER_MAX_HEIGHT = 280;
const VIEWPORT_PADDING = 12;

type Position = { top: number; left: number; placement: 'above' | 'below' };

function computePosition(anchor: { x: number; y: number }): Position {
  if (typeof window === 'undefined') return { top: anchor.y, left: anchor.x, placement: 'below' };
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const preferBelow = anchor.y + POPOVER_MAX_HEIGHT + VIEWPORT_PADDING > viewportHeight;
  const placement: 'above' | 'below' = preferBelow ? 'above' : 'below';

  const top = preferBelow
    ? Math.max(VIEWPORT_PADDING, anchor.y - POPOVER_MAX_HEIGHT - 12)
    : Math.min(viewportHeight - POPOVER_MAX_HEIGHT - VIEWPORT_PADDING, anchor.y + 12);

  const left = Math.max(
    VIEWPORT_PADDING,
    Math.min(viewportWidth - POPOVER_WIDTH - VIEWPORT_PADDING, anchor.x - POPOVER_WIDTH / 2),
  );

  return { top, left, placement };
}

export default function WordExplanationPopover({
  anchor,
  wordText,
  loading,
  error,
  explanation,
  onClose,
  onSaveWord,
}: WordExplanationPopoverProps) {
  const { tr, ui } = useI18n();
  const [position, setPosition] = useState<Position | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!anchor) {
      setPosition(null);
      return;
    }
    setPosition(computePosition(anchor));
  }, [anchor]);

  useEffect(() => {
    if (!anchor) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const handleScroll = () => {
      // Close on scroll to avoid the popover drifting away from the token,
      // which gets unmounted as the active cue changes.
      onClose();
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [anchor, onClose]);

  if (!anchor) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-transparent"
        onClick={onClose}
      />
      {position && (
        <div
          ref={containerRef}
          role="dialog"
          aria-live="polite"
          aria-label={tr("Giải thích từ {0}", { 0: wordText })}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: `${POPOVER_WIDTH}px`,
            maxHeight: `${POPOVER_MAX_HEIGHT}px`,
          }}
          className="fixed z-50 rounded-2xl border border-neutral-200 bg-white shadow-2xl overflow-hidden animate-in fade-in duration-150"
        >
          <div className="flex items-start justify-between gap-2 border-b border-neutral-100 bg-gradient-to-br from-red-50 to-white px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 shrink-0 text-[#B91B1C]" />
              <p className="font-black text-base truncate text-[#18181B]">{wordText}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
              aria-label={tr("Đóng")}
              title={tr("Đóng (ESC)")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 px-4 py-3 text-sm overflow-y-auto" style={{ maxHeight: `${POPOVER_MAX_HEIGHT - 60}px` }}>
            {loading && <p className="text-neutral-600">{tr("Panda AI đang phân tích từ…")}</p>}
            {error && <p className="text-red-700">{ui(error)}</p>}
            {explanation && (
              <>
                <p><strong className="text-neutral-900">{tr("Nghĩa:")}</strong> <span className="text-neutral-700">{explanation.meaningVi}</span></p>
                {explanation.pinyin && <p className="text-neutral-700">{explanation.pinyin}</p>}
                {explanation.usageVi && <p><strong className="text-neutral-900">{tr("Cách dùng:")}</strong> <span className="text-neutral-700">{explanation.usageVi}</span></p>}
                {explanation.exampleZh && <p><strong className="text-neutral-900">{tr("Ví dụ:")}</strong> <span className="text-neutral-700">{explanation.exampleZh} ({explanation.examplePinyin}) — {explanation.exampleVi}</span></p>}
                {explanation.cautionVi && <p><strong className="text-neutral-900">{tr("Lưu ý:")}</strong> <span className="text-neutral-700">{explanation.cautionVi}</span></p>}
                {onSaveWord && (
                  <button
                    type="button"
                    onClick={onSaveWord}
                    className="mt-2 w-full rounded-lg bg-[#B91B1C] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700"
                  >{tr("Lưu vào sổ ôn tập")}</button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
