import { AppError } from "../../errors/app-error.js"

export interface NormalizedTimestamp {
  text: string
  startMs: number
  endMs: number
  approximate?: boolean
  timingSource?: "AZURE" | "ALIGNED" | "INTERPOLATED"
}

export interface TimestampValidationResult {
  cues: NormalizedTimestamp[]
  warningCount: number
  needsFineAlignment: boolean
}

export function validateAndNormalizeTimestamps(
  input: Array<{ text: string; startMs: number; endMs: number }>,
  durationMs: number,
): TimestampValidationResult {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new AppError(
      422,
      "INVALID_MEDIA_DURATION",
      "Thời lượng audio không hợp lệ",
    )
  }

  let previousEnd = 0
  let warningCount = 0
  let needsFineAlignment = false
  const cues: NormalizedTimestamp[] = []

  for (const item of input) {
    const text = item.text.trim()
    if (!text) continue
    if (!Number.isFinite(item.startMs) || !Number.isFinite(item.endMs)) {
      warningCount += 1
      continue
    }
    const startMs = Math.max(0, Math.min(durationMs, Math.round(item.startMs)))
    const endMs = Math.max(0, Math.min(durationMs, Math.round(item.endMs)))
    if (endMs <= Math.max(previousEnd, startMs)) {
      warningCount += 1
      continue
    }
    if (startMs < previousEnd) {
      warningCount += 1
      needsFineAlignment = true
    }
    cues.push({
      text,
      startMs: Math.max(previousEnd, startMs),
      endMs,
      timingSource: "AZURE",
      approximate: false,
    })
    previousEnd = endMs
  }

  if (!cues.length)
    throw new AppError(
      502,
      "AZURE_ASR_EMPTY_TRANSCRIPT",
      "Không nhận được câu thoại hợp lệ từ audio",
    )
  return { cues, warningCount, needsFineAlignment }
}
