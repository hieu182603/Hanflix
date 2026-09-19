import { useMemo } from 'react';
import type { SubtitleCue } from '../../api/learning';

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
      'bg-black/65 text-white border border-white/10 backdrop-blur-sm shadow-2xl rounded-xl px-3.5 py-2',
    textClass: 'text-white font-bold',
    pinyinClass: 'text-white/80 italic text-sm',
    translationClass: 'text-white/95 text-sm',
    description: 'Hiện đại · nền đen mờ',
  },
  classic_yellow: {
    containerClass:
      'bg-black/80 text-white border border-yellow-300/40 shadow-[0_0_0_2px_rgba(0,0,0,0.85)] rounded-md px-3 py-1.5',
    textClass: 'text-yellow-300 font-black',
    pinyinClass: 'text-white italic text-sm',
    translationClass: 'text-white text-sm',
    description: 'Phim cổ điển · chữ vàng nổi bật',
  },
  netflix: {
    containerClass:
      'bg-zinc-900/90 text-white rounded-md px-3 py-1.5 shadow-2xl',
    textClass: 'text-white font-bold',
    pinyinClass: 'text-zinc-300 italic text-sm',
    translationClass: 'text-zinc-100 text-sm',
    description: 'Netflix · box mờ chuyên nghiệp',
  },
  anime: {
    containerClass:
      'bg-black/85 text-white border-2 border-white rounded-lg px-4 py-2 shadow-[0_0_0_3px_rgba(0,0,0,0.95)]',
    textClass: 'text-white font-black text-2xl',
    pinyinClass: 'text-yellow-200 italic text-sm',
    translationClass: 'text-white text-sm',
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
  onTokenClick?: (cueId: string, wordId: string, wordText: string) => void;
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
    if (language === 'zh') rows.push({ language, text: cue.zh });
    else if (language === 'pinyin') rows.push({ language, text: cue.zh, pinyin: cue.pinyin });
    else if (language === 'vi') rows.push({ language, text: cue.vi });
  };
  if (top !== 'off') push(top as Exclude<SubtitleLanguageTrack, 'off'>);
  if (bottom !== 'off' && bottom !== top) push(bottom as Exclude<SubtitleLanguageTrack, 'off'>);
  return rows;
}

function ClickableTokens({
  text,
  tokens,
  onTokenClick,
  onSaveWord,
  cueId,
}: {
  text: string;
  tokens?: SubtitleCue['tokens'];
  onTokenClick?: (cueId: string, wordId: string, wordText: string) => void;
  onSaveWord?: (cueId: string, wordId: string) => void;
  cueId: string;
}) {
  if (!tokens || tokens.length === 0 || !onTokenClick) {
    return <span>{text}</span>;
  }
  return (
    <span>
      {tokens.map((token, index) => {
        const wordObject = token.wordId && typeof token.wordId === 'object' ? token.wordId : null;
        const wordIdStr = wordObject?._id ?? '';
        if (!wordObject || !wordIdStr) {
          return (
            <span key={`${token.text}-${index}`} className="font-mono">
              {token.text}
            </span>
          );
        }
        return (
          <span key={`${token.text}-${index}`} className="inline-flex items-baseline">
            <button
              type="button"
              className="font-mono underline-offset-4 transition hover:underline hover:text-yellow-200 focus:outline-none focus:underline"
              onClick={(event) => {
                event.stopPropagation();
                onTokenClick(cueId, wordIdStr, token.text);
              }}
              title={`Giải thích "${token.text}"`}
            >
              {token.text}
            </button>
            {onSaveWord && (
              <button
                type="button"
                className="ml-0.5 text-[0.7em] font-bold text-yellow-200/90 transition hover:text-yellow-100"
                onClick={(event) => {
                  event.stopPropagation();
                  onSaveWord(cueId, wordIdStr);
                }}
                title={`Lưu "${token.text}" vào sổ từ`}
              >
                ＋
              </button>
            )}
          </span>
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
  onTokenClick,
  onSaveWord,
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

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-12 z-20 flex flex-col items-center gap-1.5 px-4 sm:bottom-14"
      aria-live="polite"
    >
      {rows.map((row, index) => {
        const isZh = row.language === 'zh';
        const isPinyin = row.language === 'pinyin';
        const isVi = row.language === 'vi';

        return (
          <div
            key={`${row.language}-${index}-${activeCue.cueId}`}
            className={`pointer-events-auto max-w-[88%] text-center ${preset.containerClass}`}
          >
            {isPinyin && row.pinyin ? (
              <div className={preset.pinyinClass}>{row.pinyin}</div>
            ) : isZh ? (
              <div className={preset.textClass}>
                <ClickableTokens
                  text={row.text}
                  tokens={activeCue.tokens}
                  onTokenClick={onTokenClick}
                  onSaveWord={onSaveWord}
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
