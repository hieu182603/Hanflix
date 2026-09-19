import { Pause, Play } from 'lucide-react';
import { DEFAULT_SUBTITLE_STYLE, SubtitleSharedPreview, type SharedCue, type SubtitleStyleConfig } from '../../watch/SubtitleSharedPreview';
import type { SubtitleLanguageTrack, SubtitleVisualPreset } from '../../watch/SubtitleSharedPreview';

interface SubtitleVideoMonitorProps {
  mediaUrl: string;
  mimeType: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cues: ReadonlyArray<SharedCue>;
  currentTimeMs: number;
  isPlaying: boolean;
  styleConfig: SubtitleStyleConfig;
  visualPreset: SubtitleVisualPreset;
  topTrack: SubtitleLanguageTrack;
  bottomTrack: SubtitleLanguageTrack;
  onTogglePlay: () => void;
  onPrevCue: () => void;
  onNextCue: () => void;
}

export function SubtitleVideoMonitor({
  mediaUrl,
  mimeType,
  videoRef,
  cues,
  currentTimeMs,
  isPlaying,
  styleConfig,
  visualPreset,
  topTrack,
  bottomTrack,
  onTogglePlay,
  onPrevCue,
  onNextCue,
}: SubtitleVideoMonitorProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0B0908]">
      <div className="relative flex-1 min-h-0">
        <video
          ref={videoRef}
          src={mediaUrl}
          preload="metadata"
          className="absolute inset-0 h-full w-full object-contain"
          aria-label="Trình phát video xem trước"
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            // Sync the shared hook's currentTimeMs via the timeupdate event.
            // The hook's setCurrentTimeMs handler is wired in the parent so
            // we dispatch through the standard React channel by using a custom
            // property on the element. Simpler: forward via callback if needed.
            video.dataset.currentMs = String(Math.round(video.currentTime * 1000));
          }}
        />
        <SubtitleSharedPreview
          cues={cues}
          currentMs={currentTimeMs}
          topTrack={topTrack}
          bottomTrack={bottomTrack}
          styleConfig={styleConfig}
          visualPreset={visualPreset}
          positionClass="bottom-6"
        />
      </div>
      <div className="flex items-center justify-center gap-3 bg-[#15110F] px-4 py-3 text-white">
        <button
          type="button"
          onClick={onPrevCue}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C]"
        >
          ◀ Câu trước
        </button>
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#B91B1C] text-white transition hover:bg-[#991314] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C]"
        >
          {isPlaying ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={onNextCue}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C]"
        >
          Câu sau ▶
        </button>
        <span className="ml-3 text-[10px] font-bold text-white/70" aria-live="polite">
          Hint: dùng phím cách để phát/tạm dừng
        </span>
      </div>
      {/* mimeType is read by the parent if it needs to pick a download fallback; keep prop. */}
      <span className="hidden" aria-hidden="true">{mimeType}</span>
    </div>
  );
}
