import { AppError } from "../../errors/app-error.js"
import { pinyinService } from "../pinyin.js"
import type { SubtitleCueInput } from "../revision-commit.js"
import type { SpeechSegment } from "../speech/speech-to-text.service.js"
import { splitLongPhraseIntoCues } from "../subtitle-splitter.js"

export interface TimedToken {
  text: string
  pinyin: string
  startMs: number
  endMs: number
  timingSource: "AZURE" | "INTERPOLATED" | "ALIGNED"
  approximate: boolean
}
export interface PreparedCue {
  cueId: string
  startMs: number
  endMs: number
  zh: string
  rawText: string
  normalizedText: string
  pinyin: string
  karaokeTokens: TimedToken[]
  needsFineAlignment: boolean
}
export function prepareCues(
  segments: SpeechSegment[],
  durationMs: number,
  allowApproximate = true,
): PreparedCue[] {
  const cues: PreparedCue[] = []
  let previousEnd = 0
  for (const segment of [...segments].sort((a, b) => a.startMs - b.startMs)) {
    const normalizedText = segment.text
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
    const parts = splitLongPhraseIntoCues({ ...segment, text: normalizedText })
    for (const part of parts) {
      const startMs = Math.max(previousEnd, 0, Math.round(part.startMs))
      const endMs = Math.min(durationMs, Math.round(part.endMs))
      if (
        !Number.isFinite(startMs) ||
        !Number.isFinite(endMs) ||
        endMs <= startMs ||
        !part.zh.trim()
      )
        continue
      const tokens = Array.from(part.zh).map((text) => ({ text, pinyin: "" }))
      const karaokeTokens: TimedToken[] = tokens.map((token, index) => {
        const exact = segment.words?.find(
          (word) =>
            word.text === token.text &&
            Array.from(word.text).length === 1 &&
            word.startMs >= startMs &&
            word.endMs <= endMs,
        )
        // Repeated characters cannot be mapped by text alone.
        const unique =
          tokens.filter((other) => other.text === token.text).length === 1
        return {
          ...token,
          startMs:
            exact && unique
              ? exact.startMs
              : startMs + ((endMs - startMs) * index) / tokens.length,
          endMs:
            exact && unique
              ? exact.endMs
              : startMs + ((endMs - startMs) * (index + 1)) / tokens.length,
          timingSource: exact && unique ? "AZURE" : "INTERPOLATED",
          approximate: !(exact && unique),
        }
      })
      // Mixing interpolation and exact units can produce overlaps. Fall back coherently.
      if (
        karaokeTokens.some(
          (t, i) => i > 0 && t.startMs < karaokeTokens[i - 1]!.endMs,
        )
      ) {
        karaokeTokens.forEach((t, i) =>
          Object.assign(t, {
            startMs: startMs + ((endMs - startMs) * i) / tokens.length,
            endMs: startMs + ((endMs - startMs) * (i + 1)) / tokens.length,
            timingSource: "INTERPOLATED",
            approximate: true,
          }),
        )
      }
      const needsFineAlignment = karaokeTokens.some((t) => t.approximate)
      cues.push({
        cueId: `cue-${cues.length + 1}`,
        startMs,
        endMs,
        zh: part.zh,
        rawText: segment.text,
        normalizedText: part.zh,
        pinyin: "",
        karaokeTokens:
          !allowApproximate && needsFineAlignment ? [] : karaokeTokens,
        needsFineAlignment,
      })
      previousEnd = endMs
    }
  }
  if (!cues.length)
    throw new AppError(
      422,
      "CONTENT_INCOMPLETE",
      "Không có phụ đề hợp lệ để duyệt",
    )
  return cues
}
export function enrichPreparedCues(cues: PreparedCue[]): PreparedCue[] {
  return cues.map((cue) => {
    const mapped = pinyinService.tokenize(cue.zh)
    return {
      ...cue,
      pinyin: pinyinService.convert(cue.zh),
      karaokeTokens: cue.karaokeTokens.map((token, i) => {
        if (mapped[i]?.text !== token.text)
          throw new AppError(
            422,
            "PINYIN_MAPPING_MISMATCH",
            "Pinyin token không khớp phụ đề",
          )
        return { ...token, pinyin: mapped[i]!.pinyin }
      }),
    }
  })
}
export function validateFinalCues(
  cues: SubtitleCueInput[],
  durationMs: number,
) {
  if (!cues.length)
    throw new AppError(422, "CONTENT_INCOMPLETE", "Phụ đề trống")
  if (!cues.some((cue) => /[\p{Script=Han}]/u.test(cue.zh)))
    throw new AppError(
      422,
      "INVALID_SUBTITLE_TEXT",
      "Transcript không có tiếng Trung",
    )
  let end = 0
  for (const cue of cues) {
    if (!cue.zh.trim() || !cue.vi.trim() || !cue.pinyin.trim())
      throw new AppError(
        422,
        "INVALID_SUBTITLE_TEXT",
        "Phụ đề thiếu văn bản, Pinyin hoặc bản dịch",
      )
    if (
      !Number.isFinite(cue.startMs) ||
      !Number.isFinite(cue.endMs) ||
      cue.startMs < end ||
      cue.endMs <= cue.startMs ||
      cue.endMs > durationMs
    )
      throw new AppError(
        422,
        "INVALID_CUE_TIME",
        "Phụ đề chồng lấn hoặc vượt thời lượng",
      )
    let tokenEnd = cue.startMs
    for (const token of cue.karaokeTokens ?? []) {
      if (
        !Number.isFinite(token.startMs) ||
        !Number.isFinite(token.endMs) ||
        token.startMs < tokenEnd ||
        token.endMs <= token.startMs ||
        token.endMs > cue.endMs
      )
        throw new AppError(422, "INVALID_TOKEN_TIME", "Token ngoài biên phụ đề")
      tokenEnd = token.endMs
    }
    if (
      cue.karaokeTokens?.map((t) => t.text).join("") !== cue.zh &&
      cue.karaokeTokens?.length
    )
      throw new AppError(422, "INVALID_TOKEN_MAPPING", "Token không khớp câu")
    end = cue.endMs
  }
  return {
    cueCount: cues.length,
    approximateTokenCount: cues.reduce(
      (n, c) => n + (c.karaokeTokens?.filter((t) => t.approximate).length ?? 0),
      0,
    ),
  }
}
export function estimateProcessingUsage(
  durationSeconds: number,
  musicFallback = false,
) {
  return {
    azureAsrRequests: musicFallback ? 2 : 1,
    azureAsrAudioSeconds: durationSeconds * (musicFallback ? 2 : 1),
    demucsRuns: musicFallback ? 1 : 0,
    alignmentRuns: 0,
  }
}
