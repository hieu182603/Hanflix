export type TranscriptionQualityStatus = "GOOD" | "QUESTIONABLE" | "BAD"

export interface TranscriptionQuality {
  score: number
  status: TranscriptionQualityStatus
  reasons: string[]
}

const COMMON_HALLUCINATIONS = [
  "谢谢观看",
  "感谢观看",
  "感谢收看",
  "字幕由",
  "请订阅",
]
const SIGNAL_LIMITS = {
  chineseRatio: 0.25,
  coverage: 0.03,
  uniquePhraseRatio: 0.45,
  maxCharactersPerSecond: 20,
}

export function evaluateTranscription(input: {
  segments: Array<{ text: string; startMs: number; endMs: number }>
  audioDurationMs: number
  goodThreshold?: number
  retryThreshold?: number
}): TranscriptionQuality {
  const goodThreshold = input.goodThreshold ?? 0.72
  const retryThreshold = input.retryThreshold ?? 0.42
  const reasons: string[] = []
  const text = input.segments.map((segment) => segment.text.trim()).join("")
  if (!text) return { score: 0, status: "BAD", reasons: ["EMPTY_TRANSCRIPT"] }

  const chinese = (text.match(/[\u3400-\u9fff]/g) ?? []).length
  const chineseRatio = chinese / Math.max(text.length, 1)
  if (chineseRatio < SIGNAL_LIMITS.chineseRatio)
    reasons.push("LOW_CHINESE_RATIO")

  let previousEnd = 0
  let coveredMs = 0
  for (const segment of [...input.segments].sort(
    (a, b) => a.startMs - b.startMs,
  )) {
    if (
      !Number.isFinite(segment.startMs) ||
      !Number.isFinite(segment.endMs) ||
      segment.startMs < 0 ||
      segment.endMs <= segment.startMs ||
      segment.endMs > input.audioDurationMs
    ) {
      if (!reasons.includes("INVALID_TIMESTAMPS"))
        reasons.push("INVALID_TIMESTAMPS")
      continue
    }
    coveredMs += Math.max(
      0,
      segment.endMs - Math.max(previousEnd, segment.startMs),
    )
    previousEnd = Math.max(previousEnd, segment.endMs)
  }
  const coverage = coveredMs / Math.max(input.audioDurationMs, 1)
  if (coverage < SIGNAL_LIMITS.coverage) reasons.push("LOW_DURATION_COVERAGE")
  if (
    text.length / Math.max(coveredMs / 1000, 0.001) >
    SIGNAL_LIMITS.maxCharactersPerSecond
  )
    reasons.push("ABNORMAL_READING_SPEED")

  const repeated =
    input.segments.length > 2 &&
    new Set(input.segments.map((segment) => segment.text.trim())).size /
      input.segments.length <
      SIGNAL_LIMITS.uniquePhraseRatio
  if (repeated) reasons.push("REPEATED_PHRASES")
  if (COMMON_HALLUCINATIONS.some((marker) => text.includes(marker)))
    reasons.push("HALLUCINATION_PATTERN")

  let score =
    0.5 +
    Math.min(0.25, chineseRatio * 0.25) +
    Math.min(0.25, Math.min(coverage, 1) * 0.25)
  if (repeated) score -= 0.2
  if (reasons.includes("HALLUCINATION_PATTERN")) score -= 0.4
  if (reasons.includes("LOW_CHINESE_RATIO")) score -= 0.3
  if (reasons.includes("LOW_DURATION_COVERAGE")) score -= 0.35
  if (reasons.includes("INVALID_TIMESTAMPS")) score -= 0.4
  if (reasons.includes("ABNORMAL_READING_SPEED")) score -= 0.25
  score = Math.max(0, Math.min(1, score))

  return {
    score,
    status:
      score >= goodThreshold
        ? "GOOD"
        : score >= retryThreshold
          ? "QUESTIONABLE"
          : "BAD",
    reasons,
  }
}
