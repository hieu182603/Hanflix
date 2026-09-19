import { useEffect, useRef, useState } from 'react';
import { Captions, CaptionsOff, ChevronUp } from 'lucide-react';
import type { SubtitleLanguageTrack } from './SubtitleOverlay';

interface SubtitleToggleButtonProps {
  /** Current top + bottom tracks. Used to compute the "all off" state. */
  topTrack: SubtitleLanguageTrack;
  bottomTrack: SubtitleLanguageTrack;
  /** Called when the user picks a quick toggle. Receives the next pair. */
  onQuickToggle: (next: { top: SubtitleLanguageTrack; bottom: SubtitleLanguageTrack }) => void;
}

/**
 * Floating button overlaid on the video player.
 *
 * - Single tap on the icon: toggle between "current on" and "all off".
 * - Tap the chevron (or long-press): reveal a quick picker for top/bottom track.
 *
 * Always hidden behind a transparent click layer to avoid stealing focus from
 * the native <video controls>.
 */
export default function SubtitleToggleButton({
  topTrack,
  bottomTrack,
  onQuickToggle,
}: SubtitleToggleButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const allOff = topTrack === 'off' && bottomTrack === 'off';
  const anyOn = !allOff;

  // Click-outside closes the picker.
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  // Esc closes the picker.
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const handleMainClick = () => {
    if (anyOn) {
      onQuickToggle({ top: 'off', bottom: 'off' });
    } else {
      // Restore to a sensible default.
      onQuickToggle({ top: 'zh', bottom: 'pinyin' });
    }
  };

  return (
    <div
      ref={rootRef}
      className="absolute right-3 top-3 z-20 flex items-center gap-1"
      // Don't block the native controls bar at the bottom.
      // Only top-right is reserved for the overlay chrome.
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          handleMainClick();
        }}
        aria-label={anyOn ? 'Tắt phụ đề' : 'Bật phụ đề'}
        title={anyOn ? 'Tắt phụ đề (CC)' : 'Bật phụ đề (CC)'}
        className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-sm transition shadow-lg ${
          anyOn
            ? 'border-white/30 bg-black/55 text-white hover:bg-black/75'
            : 'border-white/20 bg-black/35 text-white/55 hover:text-white hover:bg-black/55'
        }`}
      >
        {anyOn ? <Captions size={16} /> : <CaptionsOff size={16} />}
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        aria-label="Chọn loại phụ đề"
        title="Chọn loại phụ đề"
        className={`flex h-9 w-7 items-center justify-center rounded-full border border-white/30 bg-black/55 text-white transition shadow-lg hover:bg-black/75 ${
          open ? 'rotate-180' : ''
        }`}
      >
        <ChevronUp size={14} />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-30 w-64 rounded-xl border border-neutral-200 bg-white/95 p-3 shadow-xl backdrop-blur">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
            Chọn dòng phụ đề
          </p>
          <TrackRow
            label="Dòng trên"
            value={topTrack}
            onChange={(track) => {
              onQuickToggle({ top: track, bottom: bottomTrack });
              setOpen(false);
            }}
          />
          <TrackRow
            label="Dòng dưới"
            value={bottomTrack}
            onChange={(track) => {
              onQuickToggle({ top: topTrack, bottom: track });
              setOpen(false);
            }}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[11px] font-bold text-neutral-600 hover:bg-neutral-100"
          >
            Đóng
          </button>
        </div>
      )}
    </div>
  );
}

const TRACK_LABELS: Record<SubtitleLanguageTrack, string> = {
  zh: 'Tiếng Trung',
  pinyin: 'Pinyin',
  vi: 'Tiếng Việt',
  off: 'Tắt',
};

const TRACK_OPTIONS: SubtitleLanguageTrack[] = ['off', 'zh', 'pinyin', 'vi'];

function TrackRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SubtitleLanguageTrack;
  onChange: (next: SubtitleLanguageTrack) => void;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="mb-1 text-[10px] font-bold text-neutral-500">{label}</p>
      <div className="flex flex-wrap gap-1">
        {TRACK_OPTIONS.map((track) => {
          const isActive = value === track;
          return (
            <button
              key={track}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChange(track);
              }}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                isActive
                  ? 'bg-[#B91B1C] text-white shadow-xs'
                  : 'border border-neutral-200 bg-white text-neutral-700 hover:border-[#B91B1C]'
              }`}
            >
              {TRACK_LABELS[track]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
