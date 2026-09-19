import { Trash2 } from 'lucide-react';
import type { AdminCue, AdminSubtitleStyle } from '../../../api/admin';

interface SubtitleContentEditorProps {
  cue: AdminCue | null;
  durationSeconds: number;
  onChange: (cue: AdminCue) => void;
  onRemove: () => void;
}

function parseTimeToMs(value: string): number | null {
  const match = /^(?:(\d+):)?(\d{1,2})(?:\.(\d{1,3}))?$/.exec(value.trim());
  if (!match) return null;
  const minutes = match[1] ? Number(match[1]) : 0;
  const seconds = Number(match[2]);
  const millis = match[3] ? Number(match[3].padEnd(3, '0').slice(0, 3)) : 0;
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || !Number.isFinite(millis)) return null;
  return minutes * 60_000 + seconds * 1000 + millis;
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.round(ms % 1000);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

function msInputClass(): string {
  return 'w-full rounded-lg border border-[#F2E4D8] bg-white px-2.5 py-2 text-xs font-bold text-[#2B2826] outline-none transition focus:border-[#B91B1C] focus:ring-2 focus:ring-[#B91B1C]/10';
}

export function SubtitleContentEditor({ cue, durationSeconds, onChange, onRemove }: SubtitleContentEditorProps) {
  if (!cue) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-xs font-bold text-[#8C827A]">
        Chọn một câu thoại trong Navigator hoặc trên Timeline để chỉnh sửa.
      </div>
    );
  }

  const durationMs = Math.max(1, durationSeconds * 1000);
  const invalidStart = cue.startMs < 0 || cue.startMs > durationMs;
  const invalidEnd = cue.endMs <= cue.startMs || cue.endMs > durationMs;

  const apply = (patch: Partial<AdminCue>) => onChange({ ...cue, ...patch });

  return (
    <div className="space-y-4 p-4">
      <div>
        <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#8C827A]" htmlFor="cue-zh">
          Hán tự
        </label>
        <textarea
          id="cue-zh"
          value={cue.zh}
          onChange={(event) => apply({ zh: event.target.value })}
          rows={2}
          className="w-full resize-none rounded-lg border border-[#F2E4D8] bg-white px-3 py-2 text-sm font-bold text-[#2B2826] outline-none transition focus:border-[#B91B1C] focus:ring-2 focus:ring-[#B91B1C]/10"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#8C827A]" htmlFor="cue-pinyin">
          Pinyin
        </label>
        <textarea
          id="cue-pinyin"
          value={cue.pinyin}
          onChange={(event) => apply({ pinyin: event.target.value })}
          rows={2}
          className="w-full resize-none rounded-lg border border-[#F2E4D8] bg-white px-3 py-2 text-xs italic text-[#2B2826] outline-none transition focus:border-[#B91B1C] focus:ring-2 focus:ring-[#B91B1C]/10"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#8C827A]" htmlFor="cue-vi">
          Tiếng Việt
        </label>
        <textarea
          id="cue-vi"
          value={cue.vi}
          onChange={(event) => apply({ vi: event.target.value })}
          rows={2}
          className="w-full resize-none rounded-lg border border-[#F2E4D8] bg-white px-3 py-2 text-xs text-[#2B2826] outline-none transition focus:border-[#B91B1C] focus:ring-2 focus:ring-[#B91B1C]/10"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#8C827A]" htmlFor="cue-start">
            Bắt đầu
          </label>
          <input
            id="cue-start"
            type="text"
            inputMode="numeric"
            value={formatMs(cue.startMs)}
            onChange={(event) => {
              const parsed = parseTimeToMs(event.target.value);
              if (parsed === null) return;
              apply({ startMs: Math.max(0, Math.min(parsed, cue.endMs - 100)) });
            }}
            className={msInputClass()}
            aria-invalid={invalidStart}
          />
          {invalidStart && <p className="mt-1 text-[10px] font-bold text-[#B91B1C]">Thời gian không hợp lệ</p>}
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#8C827A]" htmlFor="cue-end">
            Kết thúc
          </label>
          <input
            id="cue-end"
            type="text"
            inputMode="numeric"
            value={formatMs(cue.endMs)}
            onChange={(event) => {
              const parsed = parseTimeToMs(event.target.value);
              if (parsed === null) return;
              apply({ endMs: Math.max(cue.startMs + 100, Math.min(parsed, durationMs)) });
            }}
            className={msInputClass()}
            aria-invalid={invalidEnd}
          />
          {invalidEnd && <p className="mt-1 text-[10px] font-bold text-[#B91B1C]">End phải lớn hơn Start và không vượt {formatMs(durationMs)}</p>}
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#F9D2D2] bg-[#FDF1F1] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#B91B1C] transition hover:bg-[#F9D2D2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C]"
      >
        <Trash2 className="h-3 w-3" aria-hidden="true" />
        Xóa câu thoại này
      </button>
    </div>
  );
}

interface SubtitleAppearanceControlsProps {
  style: AdminSubtitleStyle;
  onChange: (next: AdminSubtitleStyle) => void;
}

const FONT_BOUNDS = {
  chinese: { min: 16, max: 96 },
  pinyin: { min: 12, max: 64 },
  vietnamese: { min: 12, max: 64 },
} as const;

interface FontSliderProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function FontSlider({ label, description, value, min, max, onChange }: FontSliderProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-wide text-[#8C827A]">{label}</span>
        <span className="rounded-md bg-[#F2E4D8] px-1.5 py-0.5 text-[10px] font-black text-[#2B2826]">{value}px</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={`${label} font size`}
        className="w-full accent-[#B91B1C]"
      />
      <p className="mt-1 text-[10px] font-bold text-[#8C827A]">{description}</p>
    </div>
  );
}

export function SubtitleAppearanceControls({ style, onChange }: SubtitleAppearanceControlsProps) {
  return (
    <div className="space-y-5 p-4">
      <FontSlider
        label="Hán tự"
        description="Cỡ chữ cho câu tiếng Trung"
        value={style.chineseFontSize}
        min={FONT_BOUNDS.chinese.min}
        max={FONT_BOUNDS.chinese.max}
        onChange={(value) => onChange({ ...style, chineseFontSize: value })}
      />
      <FontSlider
        label="Pinyin"
        description="Cỡ chữ cho phiên âm"
        value={style.pinyinFontSize}
        min={FONT_BOUNDS.pinyin.min}
        max={FONT_BOUNDS.pinyin.max}
        onChange={(value) => onChange({ ...style, pinyinFontSize: value })}
      />
      <FontSlider
        label="Tiếng Việt"
        description="Cỡ chữ cho bản dịch"
        value={style.vietnameseFontSize}
        min={FONT_BOUNDS.vietnamese.min}
        max={FONT_BOUNDS.vietnamese.max}
        onChange={(value) => onChange({ ...style, vietnameseFontSize: value })}
      />
      <p className="rounded-xl bg-[#FFF9F5] p-3 text-[10px] font-bold text-[#5F564F]">
        Tinh chỉnh áp dụng cho cả bản xem trước trong Admin và người học khi mở bài.
      </p>
    </div>
  );
}
