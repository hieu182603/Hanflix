import { useMemo } from 'react';
import type { SubtitleCue } from '../../api/learning';
import { cleanPinyinText, cleanSubtitleText, stripTrailingPunctuation } from '../../utils/text';

export type SubtitleOverlayStyle = 'modern' | 'classic_yellow' | 'netflix' | 'anime';

export type SubtitleLanguageTrack = 'zh' | 'pinyin' | 'vi' | 'off';

const STYLE_PRESETS: Record<
  SubtitleOverlayStyle,
  {
    containerClass: string;
    textClass: string;
    pinyinClass: string;
    translationClass: string;
    description: string;
  }
> = {
  modern: {
    containerClass:
      'bg-black/75 text-white border border-white/10 backdrop-blur-sm shadow-2xl rounded-xl px-4 py-2 sm:px-5 sm:py-2.5',
    textClass: 'text-white font-bold text-lg sm:text-xl md:text-2xl tracking-wide',
    pinyinClass: 'text-white/90 italic text-sm sm:text-base md:text-lg font-medium tracking-wide',
    translationClass: 'text-white/95 text-sm sm:text-base md:text-lg font-medium',
    description: 'Hiện đại · nền đen mờ',
  },
  classic_yellow: {
    containerClass:
      'bg-black/85 text-white border border-yellow-300/40 shadow-[0_0_0_2px_rgba(0,0,0,0.85)] rounded-lg px-4 py-2 sm:px-5 sm:py-2.5',
    textClass: 'text-yellow-300 font-black text-lg sm:text-xl md:text-2xl tracking-wide',
    pinyinClass: 'text-white italic text-sm sm:text-base md:text-lg font-medium tracking-wide',
    translationClass: 'text-white text-sm sm:text-base md:text-lg font-medium',
    description: 'Phim cổ điển · chữ vàng nổi bật',
  },
  netflix: {
    containerClass:
      'bg-zinc-900/95 text-white rounded-lg px-4 py-2 sm:px-5 sm:py-2.5 shadow-2xl',
    textClass: 'text-white font-bold text-lg sm:text-xl md:text-2xl tracking-wide',
    pinyinClass: 'text-zinc-300 italic text-sm sm:text-base md:text-lg font-medium tracking-wide',
    translationClass: 'text-zinc-100 text-sm sm:text-base md:text-lg font-medium',
    description: 'Netflix · box mờ chuyên nghiệp',
  },
  anime: {
    containerClass:
      'bg-black/90 text-white border-2 border-white rounded-xl px-5 py-2.5 sm:px-6 sm:py-3 shadow-[0_0_0_3px_rgba(0,0,0,0.95)]',
    textClass: 'text-white font-black text-2xl sm:text-3xl md:text-4xl tracking-wide',
    pinyinClass: 'text-yellow-200 italic text-base sm:text-lg md:text-xl font-bold tracking-wide',
    translationClass: 'text-white text-base sm:text-lg md:text-xl font-semibold',
    description: 'Anime · chữ to, viền rõ',
  },
};

export type StackRow = {
  language: Exclude<SubtitleLanguageTrack, 'off'>;
  text: string;
  pinyin?: string;
};

export type SubtitleOverlayProps = {
  cues: SubtitleCue[];
  currentMs: number;
  topTrack: SubtitleLanguageTrack;
  bottomTrack: SubtitleLanguageTrack;
  style: SubtitleOverlayStyle;
  scale?: number;
  className?: string;
  onTokenClick?: (cueId: string, wordId: string, wordText: string, event: React.MouseEvent) => void;
  onSaveWord?: (cueId: string, wordId: string) => void;
};

function pickStackRows(
  cue: SubtitleCue | null,
  top: SubtitleLanguageTrack,
  bottom: SubtitleLanguageTrack,
): StackRow[] {
  if (!cue || (top === 'off' && bottom === 'off')) return [];
  const rows: StackRow[] = [];
  const push = (language: Exclude<SubtitleLanguageTrack, 'off'>) => {
    if (language === 'zh') rows.push({ language, text: cleanSubtitleText(cue.zh) });
    else if (language === 'pinyin')
      rows.push({
        language,
        text: cleanSubtitleText(cue.zh),
        pinyin: cleanPinyinText(cue.pinyin),
      });
    else if (language === 'vi') rows.push({ language, text: stripTrailingPunctuation(cue.vi) });
  };
  if (top !== 'off') push(top as Exclude<SubtitleLanguageTrack, 'off'>);
  if (bottom !== 'off' && bottom !== top) push(bottom as Exclude<SubtitleLanguageTrack, 'off'>);
  return rows;
}

function ClickableTokens({
  text,
  tokens,
  onTokenClick,
  cueId,
}: {
  text: string;
  tokens?: SubtitleCue['tokens'];
  onTokenClick?: (cueId: string, wordId: string, wordText: string, event: React.MouseEvent) => void;
  cueId: string;
}) {
  const cleanedFullText = cleanSubtitleText(text);

  if (!tokens || tokens.length === 0 || !onTokenClick) {
    return <span className="font-hanzi">{cleanedFullText}</span>;
  }

  return (
    <span className="font-hanzi">
      {tokens.map((token, index) => {
        const rawText = token.text;
        if (!rawText) return null;

        const displayText = cleanSubtitleText(rawText);
        if (!displayText) return null;

        const wordObject = token.wordId && typeof token.wordId === 'object' ? token.wordId : null;
        const wordIdStr = wordObject?._id ?? '';

        // If it's punctuation or has no wordId, render clean text
        if (!wordObject || !wordIdStr || /^[\p{P}\p{S}\s]+$/u.test(displayText)) {
          return <span key={`${token.text}-${index}`}>{displayText}</span>;
        }

        return (
          <button
            key={`${token.text}-${index}`}
            type="button"
            className="hover:underline hover:text-yellow-200 underline-offset-4 transition-colors focus:outline-none cursor-pointer"
            onClick={(event) => {
              event.stopPropagation();
              onTokenClick(cueId, wordIdStr, token.text, event);
            }}
            title={`Bấm để xem giải thích: ${token.text}`}
          >
            {displayText}
          </button>
        );
      })}
    </span>
  );
}

export function SubtitleOverlay({
  cues,
  currentMs,
  topTrack,
  bottomTrack,
  style,
  scale = 100,
  className,
  onTokenClick,
}: SubtitleOverlayProps) {
  const activeCue = useMemo(
    () => cues.find((cue) => currentMs >= cue.startMs && currentMs < cue.endMs) ?? null,
    [cues, currentMs],
  );

  const rows = useMemo(
    () => pickStackRows(activeCue, topTrack, bottomTrack),
    [activeCue, topTrack, bottomTrack],
  );

  if (rows.length === 0 || !activeCue) return null;

  const preset = STYLE_PRESETS[style];
  const scaleRatio = Math.max(0.6, Math.min(2.0, (scale ?? 100) / 100));

  return (
    <div
      className={
        className ||
        'pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-1 px-4 sm:bottom-6'
      }
      aria-live="polite"
    >
      {rows.map((row, index) => {
        const isZh = row.language === 'zh';
        const isPinyin = row.language === 'pinyin';
        const isVi = row.language === 'vi';

        return (
          <div
            key={`${row.language}-${index}-${activeCue.cueId}`}
            className={`pointer-events-auto max-w-[90%] text-center origin-bottom transition-transform duration-150 ${preset.containerClass}`}
            style={{
              transform: scaleRatio !== 1 ? `scale(${scaleRatio})` : undefined,
            }}
          >
            {isPinyin && row.pinyin ? (
              <div className={preset.pinyinClass}>{row.pinyin}</div>
            ) : isZh ? (
              <div className={preset.textClass}>
                <ClickableTokens
                  text={row.text}
                  tokens={activeCue.tokens}
                  onTokenClick={onTokenClick}
                  cueId={activeCue.cueId}
                />
              </div>
            ) : isVi ? (
              <div className={preset.translationClass}>{row.text}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}


export const SUBTITLE_STYLE_DESCRIPTIONS = STYLE_PRESETS;
