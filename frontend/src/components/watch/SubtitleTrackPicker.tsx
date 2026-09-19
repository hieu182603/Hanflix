import { Subtitles, Type } from 'lucide-react';
import type { SubtitleLanguageTrack, SubtitleOverlayStyle } from './SubtitleOverlay';
import { SUBTITLE_STYLE_DESCRIPTIONS } from './SubtitleOverlay';

const TRACK_LABELS: Record<SubtitleLanguageTrack, string> = {
  zh: 'Tiếng Trung',
  pinyin: 'Pinyin',
  vi: 'Tiếng Việt',
  off: 'Tắt',
};

const STYLE_OPTIONS: SubtitleOverlayStyle[] = ['modern', 'classic_yellow', 'netflix', 'anime'];
const STYLE_LABELS: Record<SubtitleOverlayStyle, string> = {
  modern: 'Hiện đại',
  classic_yellow: 'Cổ điển',
  netflix: 'Netflix',
  anime: 'Anime',
};

export type SubtitleTrackPickerProps = {
  topTrack: SubtitleLanguageTrack;
  bottomTrack: SubtitleLanguageTrack;
  style: SubtitleOverlayStyle;
  onChangeTop: (track: SubtitleLanguageTrack) => void;
  onChangeBottom: (track: SubtitleLanguageTrack) => void;
  onChangeStyle: (style: SubtitleOverlayStyle) => void;
};

export function SubtitleTrackPicker({
  topTrack,
  bottomTrack,
  style,
  onChangeTop,
  onChangeBottom,
  onChangeStyle,
}: SubtitleTrackPickerProps) {
  const tracks: SubtitleLanguageTrack[] = ['off', 'zh', 'pinyin', 'vi'];

  return (
    <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-bold text-[#2B2826]">
        <Subtitles className="h-4 w-4 text-[#B91B1C]" />
        <span>Tuỳ chỉnh phụ đề trên video</span>
      </div>

      {/* Top track */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-[#8C827A]">Dòng trên</label>
        <div className="flex flex-wrap gap-1.5">
          {tracks.map((track) => (
            <TrackButton
              key={`top-${track}`}
              track={track}
              active={topTrack === track}
              onClick={() => onChangeTop(track)}
            />
          ))}
        </div>
      </div>

      {/* Bottom track */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-[#8C827A]">Dòng dưới</label>
        <div className="flex flex-wrap gap-1.5">
          {tracks.map((track) => (
            <TrackButton
              key={`bot-${track}`}
              track={track}
              active={bottomTrack === track}
              onClick={() => onChangeBottom(track)}
            />
          ))}
        </div>
      </div>

      {/* Style chooser */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-[#8C827A] flex items-center gap-1">
          <Type className="h-3 w-3" />
          Kiểu hiển thị
        </label>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {STYLE_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChangeStyle(s)}
              className={`rounded-xl border px-2.5 py-2 text-left transition ${
                style === s
                  ? 'border-[#B91B1C] bg-[#FDF1F1] shadow-2xs'
                  : 'border-[#F2E4D8] bg-white hover:border-[#B91B1C]/40'
              }`}
            >
              <div className="text-xs font-bold text-[#2B2826]">{STYLE_LABELS[s]}</div>
              <div className="mt-0.5 text-[10px] text-[#8C827A]">
                {SUBTITLE_STYLE_DESCRIPTIONS[s].description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrackButton({
  track,
  active,
  onClick,
}: {
  track: SubtitleLanguageTrack;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-bold transition ${
        active
          ? 'bg-[#B91B1C] text-white shadow-2xs'
          : 'border border-[#F2E4D8] bg-white text-[#2B2826] hover:border-[#B91B1C]'
      }`}
    >
      {TRACK_LABELS[track]}
    </button>
  );
}
