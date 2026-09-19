import { useMemo } from "react"

import type { SubtitleCue } from "../../api/learning"

/**
 * Per-lesson subtitle appearance config. Persisted in Lesson.subtitleStyle and
 * shared between the admin Subtitle Review workspace and the learner player so
 * any font-size tweak the admin makes reaches the user immediately.
 */

export interface SubtitleStyleConfig {
  chineseFontSize: number // px, default 34, valid 16..96

  pinyinFontSize: number // px, default 20, valid 12..64

  vietnameseFontSize: number // px, default 22, valid 12..64
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyleConfig = {
  chineseFontSize: 34,

  pinyinFontSize: 20,

  vietnameseFontSize: 22,
}

export type SubtitleLanguageTrack = "zh" | "pinyin" | "vi" | "off"

export type SubtitleVisualPreset = "modern" | "classic_yellow" | "netflix" | "anime"

interface PresetTokens {
  containerClass: string

  /** Visual modifier applied to each row (colors, weight, etc.). */

  textBaseClass: string

  description: string
}

const VISUAL_PRESETS: Record<SubtitleVisualPreset, PresetTokens> = {
  modern: {
    containerClass:
      "bg-black/65 text-white border border-white/10 backdrop-blur-sm shadow-2xl rounded-xl px-3.5 py-2",

    textBaseClass: "text-white font-bold",

    description: "Hiện đại · nền đen mờ",
  },

  classic_yellow: {
    containerClass:
      "bg-black/80 text-white border border-yellow-300/40 shadow-[0_0_0_2px_rgba(0,0,0,0.85)] rounded-md px-3 py-1.5",

    textBaseClass: "text-yellow-300 font-black",

    description: "Phim cổ điển · chữ vàng nổi bật",
  },

  netflix: {
    containerClass:
      "bg-zinc-900/90 text-white rounded-md px-3 py-1.5 shadow-2xl",

    textBaseClass: "text-white font-bold",

    description: "Netflix · box mờ chuyên nghiệp",
  },

  anime: {
    containerClass:
      "bg-black/85 text-white border-2 border-white rounded-lg px-4 py-2 shadow-[0_0_0_3px_rgba(0,0,0,0.95)]",

    textBaseClass: "text-white font-black",

    description: "Anime · chữ to, viền rõ",
  },
}

export interface SubtitleSharedPreviewProps {
  cues: ReadonlyArray<SharedCue>

  currentMs: number

  topTrack: SubtitleLanguageTrack

  bottomTrack: SubtitleLanguageTrack

  /** Per-lesson font sizes coming from the backend (or DEFAULT_SUBTITLE_STYLE). */

  styleConfig: SubtitleStyleConfig

  /** Container visual preset (modern / classic_yellow / netflix / anime). */

  visualPreset: SubtitleVisualPreset

  onTokenClick?: (cueId: string, wordId: string, wordText: string) => void

  onSaveWord?: (cueId: string, wordId: string) => void

  /** Override the container position class (admin uses sm:bottom-10, learner uses sm:bottom-14). */

  positionClass?: string
}

interface StackRow {
  language: Exclude<SubtitleLanguageTrack, "off">

  text: string

  pinyin?: string
}

export type SharedCue = {
  cueId: string

  startMs: number

  endMs: number

  zh: string

  pinyin?: string

  vi: string

  tokens?: SubtitleCue["tokens"]
}

function pickStackRows(
  cue: SharedCue | null,

  top: SubtitleLanguageTrack,

  bottom: SubtitleLanguageTrack,
): StackRow[] {
  if (!cue || (top === "off" && bottom === "off")) return []

  const rows: StackRow[] = []

  const push = (language: Exclude<SubtitleLanguageTrack, "off">) => {
    if (language === "zh") rows.push({ language, text: cue.zh })
    else if (language === "pinyin")
      rows.push({ language, text: cue.zh, pinyin: cue.pinyin })
    else if (language === "vi") rows.push({ language, text: cue.vi })
  }

  if (top !== "off") push(top as Exclude<SubtitleLanguageTrack, "off">)

  if (bottom !== "off" && bottom !== top)
    push(bottom as Exclude<SubtitleLanguageTrack, "off">)

  return rows
}

interface ClickableTokensProps {
  text: string

  tokens?: SubtitleCue["tokens"]

  onTokenClick?: (cueId: string, wordId: string, wordText: string) => void

  onSaveWord?: (cueId: string, wordId: string) => void

  cueId: string

  style: React.CSSProperties
}

function ClickableTokens({
  text,
  tokens,
  onTokenClick,
  onSaveWord,
  cueId,
  style,
}: ClickableTokensProps) {
  if (!tokens || tokens.length === 0 || !onTokenClick) {
    return <span style={style}>{text}</span>
  }

  return (
    <span>
      {tokens.map((token, index) => {
        const wordObject =
          token.wordId && typeof token.wordId === "object" ? token.wordId : null

        const wordIdStr = wordObject?._id ?? ""

        if (!wordObject || !wordIdStr) {
          return (
            <span
              key={`${token.text}-${index}`}
              className="font-mono"
              style={style}
            >
              {token.text}
            </span>
          )
        }

        return (
          <button
            key={`${token.text}-${index}`}
            type="button"
            className="font-hanzi underline-offset-4 transition hover:underline hover:text-yellow-200 focus:outline-none focus:underline cursor-pointer"
            onClick={(event) => {
              event.stopPropagation()

              onTokenClick(cueId, wordIdStr, token.text)
            }}
            title={`Giải thích "${token.text}"`}
            style={style}
          >
            {token.text}
          </button>
        )
      })}
    </span>
  )
}

/**
 * Shared subtitle renderer used by the admin Subtitle Review workspace and the
 * learner PublishedLessonView. Centralizing the render logic keeps the two
 * surfaces in sync — font size, color and row stacking come from the same
 * source-of-truth code path.
 */

export function SubtitleSharedPreview({
  cues,

  currentMs,

  topTrack,

  bottomTrack,

  styleConfig,

  visualPreset,

  onTokenClick,

  onSaveWord,

  positionClass,
}: SubtitleSharedPreviewProps) {
  const activeCue = useMemo(
    () =>
      cues.find((cue) => currentMs >= cue.startMs && currentMs < cue.endMs) ??
      null,

    [cues, currentMs],
  )

  const rows = useMemo(
    () => pickStackRows(activeCue, topTrack, bottomTrack),

    [activeCue, topTrack, bottomTrack],
  )

  if (rows.length === 0 || !activeCue) return null

  const preset = VISUAL_PRESETS[visualPreset]

  const effectivePosition = positionClass ?? "bottom-12 sm:bottom-14"

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-1.5 px-4 ${effectivePosition}`}
      aria-live="polite"
    >
      {rows.map((row, index) => {
        const isZh = row.language === "zh"

        const isPinyin = row.language === "pinyin"

        const isVi = row.language === "vi"

        const fontSizePx = isZh
          ? styleConfig.chineseFontSize
          : isPinyin
            ? styleConfig.pinyinFontSize
            : styleConfig.vietnameseFontSize

        const fontStyle: React.CSSProperties = {
          fontSize: `${fontSizePx}px`,
          lineHeight: 1.25,
        }

        // Inherit preset color/weight via className; font size flows from inline style.

        const baseClass = `${preset.textBaseClass} ${isPinyin ? "italic" : ""}`

        return (
          <div
            key={`${row.language}-${index}-${activeCue.cueId}`}
            className={`pointer-events-auto max-w-[88%] text-center ${preset.containerClass}`}
          >
            {isPinyin && row.pinyin ? (
              <div className={baseClass} style={fontStyle}>
                {row.pinyin}
              </div>
            ) : isZh ? (
              <div className={baseClass}>
                <ClickableTokens
                  text={row.text}
                  tokens={activeCue.tokens}
                  onTokenClick={onTokenClick}
                  onSaveWord={onSaveWord}
                  cueId={activeCue.cueId}
                  style={fontStyle}
                />
              </div>
            ) : isVi ? (
              <div className={baseClass} style={fontStyle}>
                {row.text}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Backwards-compatible wrapper so the legacy SubtitleOverlay module surface
 * stays intact for callers that still rely on the old API while the
 * admin/player migration lands.
 *
 * @deprecated Prefer SubtitleSharedPreview with explicit styleConfig. Kept
 * temporarily so the rest of the codebase can be migrated file by file.
 */

export const SUBTITLE_STYLE_DESCRIPTIONS = VISUAL_PRESETS
