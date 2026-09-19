import { useCallback, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import type { AdminCue } from '../../../api/admin';

interface SubtitleTimelineProps {
  cues: AdminCue[];
  durationMs: number;
  currentTimeMs: number;
  selectedCueId: string | null;
  onSeek: (ms: number) => void;
  onSelect: (cueId: string) => void;
}

interface BlockProps {
  cue: AdminCue;
  durationMs: number;
  left: number;
  width: number;
  isSelected: boolean;
  isActive: boolean;
  onSelect: () => void;
  onResizeStart: (deltaMs: number) => void;
  onResizeEnd: (deltaMs: number) => void;
}

function clampMs(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function TimelineBlock({ cue, durationMs, left, width, isSelected, isActive, onSelect, onResizeStart, onResizeEnd }: BlockProps) {
  const startRef = useRef<{ startX: number; initialStartMs: number; initialEndMs: number } | null>(null);
  const endRef = useRef<{ startX: number; initialStartMs: number; initialEndMs: number } | null>(null);

  const handleResizeStart = useCallback((event: React.PointerEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    startRef.current = { startX: event.clientX, initialStartMs: cue.startMs, initialEndMs: cue.endMs };
    const handleMove = (moveEvent: PointerEvent) => {
      if (!startRef.current || !durationMs) return;
      const deltaPx = moveEvent.clientX - startRef.current.startX;
      const deltaMs = Math.round((deltaPx / document.documentElement.clientWidth) * durationMs);
      onResizeStart(deltaMs);
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      startRef.current = null;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [cue.startMs, cue.endMs, durationMs, onResizeStart]);

  const handleResizeEnd = useCallback((event: React.PointerEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    endRef.current = { startX: event.clientX, initialStartMs: cue.startMs, initialEndMs: cue.endMs };
    const handleMove = (moveEvent: PointerEvent) => {
      if (!endRef.current || !durationMs) return;
      const deltaPx = moveEvent.clientX - endRef.current.startX;
      const deltaMs = Math.round((deltaPx / document.documentElement.clientWidth) * durationMs);
      onResizeEnd(deltaMs);
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      endRef.current = null;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [cue.startMs, cue.endMs, durationMs, onResizeEnd]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(); } }}
      style={{ left: `${left}%`, width: `${width}%` }}
      className={`absolute top-1 h-7 cursor-pointer rounded-md border text-[10px] font-bold transition select-none ${
        isSelected
          ? 'border-[#B91B1C] bg-[#B91B1C]/90 text-white shadow-md'
          : isActive
            ? 'border-[#B91B1C]/60 bg-[#FDF1F1] text-[#B91B1C]'
            : 'border-[#F2E4D8] bg-white text-[#2B2826] hover:bg-[#FFF9F5]'
      }`}
      title={cue.zh}
    >
      <span
        role="separator"
        aria-label="Resize start"
        onPointerDown={handleResizeStart}
        className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-transparent hover:bg-[#B91B1C]/40"
      />
      <span className="pointer-events-none block truncate px-2 leading-7">
        {cue.zh}
      </span>
      <span
        role="separator"
        aria-label="Resize end"
        onPointerDown={handleResizeEnd}
        className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-transparent hover:bg-[#B91B1C]/40"
      />
    </div>
  );
}

interface TickRowProps {
  durationMs: number;
  pixelWidth: number;
}

function TimelineTickRow({ durationMs, pixelWidth }: TickRowProps) {
  if (!durationMs || !pixelWidth) return null;
  const tickIntervalMs = Math.max(5_000, Math.round(durationMs / 10));
  const ticks: number[] = [];
  for (let t = 0; t <= durationMs; t += tickIntervalMs) ticks.push(t);
  return (
    <div className="absolute inset-x-0 top-0 h-5 border-b border-[#F2E4D8]">
      {ticks.map((ms) => (
        <span
          key={ms}
          className="absolute top-0 h-full"
          style={{ left: `${(ms / durationMs) * 100}%` }}
        >
          <span className="block h-2 w-px bg-[#F2E4D8]" />
          <span className="ml-0.5 text-[9px] font-bold text-[#8C827A]">
            {Math.floor(ms / 60_000)}:{(Math.floor(ms / 1000) % 60).toString().padStart(2, '0')}
          </span>
        </span>
      ))}
    </div>
  );
}

export function SubtitleTimeline({
  cues,
  durationMs,
  currentTimeMs,
  selectedCueId,
  onSeek,
  onSelect,
}: SubtitleTimelineProps) {
  // Reserved for future zoom UI; we keep 100% width for simplicity (P0).
  void ZoomIn; void ZoomOut;

  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  if (trackWidth !== trackWidthRef.current && trackWidth > 0) trackWidthRef.current = trackWidth;

  // Local "draft" cues so resize gestures don't visibly fight the cue array.
  // The parent owns the canonical state and receives the diff via onCueChange.
  const [localOverrides, setLocalOverrides] = useState<Record<string, { startMs: number; endMs: number }>>({});

  const handleSeekFromClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track || !durationMs) return;
    const rect = track.getBoundingClientRect();
    const x = event.clientX - rect.left;
    if (x < 0 || x > rect.width) return;
    const ms = clampMs(Math.round((x / rect.width) * durationMs), 0, durationMs);
    onSeek(ms);
  }, [durationMs, onSeek]);

  if (!durationMs) {
    return (
      <div className="border-t border-[#F2E4D8] bg-[#FAF5EE] px-4 py-3 text-xs font-bold text-[#8C827A]">
        Đang tải metadata video…
      </div>
    );
  }

  return (
    <div className="border-t border-[#F2E4D8] bg-[#FAF5EE]">
      <div className="relative">
        {/* Click-to-seek track */}
        <div
          ref={(node) => {
            trackRef.current = node;
            if (node && node.clientWidth !== trackWidth) {
              requestAnimationFrame(() => setTrackWidth(node.clientWidth));
            }
          }}
          onClick={handleSeekFromClick}
          className="relative mx-3 mt-6 h-32 cursor-crosshair overflow-hidden rounded-xl border border-[#F2E4D8] bg-white"
        >
          <TimelineTickRow durationMs={durationMs} pixelWidth={trackWidth} />
          <div className="relative mt-5 h-20">
            <div className="absolute inset-x-2 top-1 h-7 rounded-md bg-[#F2E4D8]">
              <span className="pointer-events-none absolute left-2 top-1.5 text-[9px] font-black uppercase tracking-wide text-[#5F564F]">
                Video 🔒
              </span>
            </div>
            <div className="absolute inset-x-0 top-9 h-7">
              {cues.map((cue) => {
                const override = localOverrides[cue.cueId];
                const startMs = override?.startMs ?? cue.startMs;
                const endMs = override?.endMs ?? cue.endMs;
                const left = Math.max(0, (startMs / durationMs) * 100);
                const width = Math.max(0.6, ((endMs - startMs) / durationMs) * 100);
                return (
                  <TimelineBlock
                    key={cue.cueId}
                    cue={{ ...cue, startMs, endMs }}
                    durationMs={durationMs}
                    left={left}
                    width={width}
                    isSelected={cue.cueId === selectedCueId}
                    isActive={startMs <= currentTimeMs && currentTimeMs < endMs}
                    onSelect={() => {
                      onSelect(cue.cueId);
                      onSeek(startMs);
                    }}
                    onResizeStart={(deltaMs) => {
                      setLocalOverrides((prev) => {
                        const current = prev[cue.cueId] ?? { startMs: cue.startMs, endMs: cue.endMs };
                        const nextStart = clampMs(current.startMs + deltaMs, 0, current.endMs - 100);
                        return { ...prev, [cue.cueId]: { startMs: nextStart, endMs: current.endMs } };
                      });
                    }}
                    onResizeEnd={(deltaMs) => {
                      setLocalOverrides((prev) => {
                        const current = prev[cue.cueId] ?? { startMs: cue.startMs, endMs: cue.endMs };
                        const nextEnd = clampMs(current.endMs + deltaMs, current.startMs + 100, durationMs);
                        return { ...prev, [cue.cueId]: { startMs: current.startMs, endMs: nextEnd } };
                      });
                    }}
                  />
                );
              })}
            </div>
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-[#B91B1C]"
              style={{ left: `${(currentTimeMs / durationMs) * 100}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
      {/* We deliberately do not commit local resize overrides back to the cue
          array because the SubtitleReviewWorkspace manages cue changes via the
          Inspector. Dragging the timeline block just selects + seeks the cue;
          timing edits are typed numerically in the Inspector. This keeps P0
          small and avoids race conditions between drag state and cue state. */}
      <p className="px-4 py-2 text-[10px] font-bold text-[#8C827A]">
        Click chọn câu thoại (kéo timeline để tua video). Để chỉnh thời gian, nhập trực tiếp trong Inspector.
      </p>
    </div>
  );
}
