import { expect, it } from "vitest"
import { migrateLegacyCheckpoints } from "./checkpoint-migration.js"
import { processingStatusDto } from "./processing-status.js"
import { redactLogValue } from "../logger.js"
import { validateAndNormalizeTimestamps } from "./timestamp-validator.js"
import { evaluateTranscription } from "./asr-quality.js"
it("migrates paid legacy outputs without discarding ASR or translations", () => {
  const source = {
    PRIMARY_TRANSCRIPTION: { status: "COMPLETED" as const, attempt: 1 },
    TRANSLATE: { status: "COMPLETED" as const, attempt: 1 },
  }
  const result = migrateLegacyCheckpoints(
    source,
    {
      segments: [{ zh: "你好", startMs: 0, endMs: 1000 }],
      finalCues: [{ zh: "你好", vi: "Xin chào" }],
    },
    {},
  )
  expect(result.steps.PRIMARY_TRANSCRIPTION?.output?.value).toEqual([
    { zh: "你好", text: "你好", startMs: 0, endMs: 1000 },
  ])
  expect(result.translationMemory["你好"]).toBe("Xin chào")
  expect(source.TRANSLATE.status).toBe("COMPLETED")
})
it("redacts secrets and signed queries recursively and excludes private job state from admin DTO", () => {
  const value = {
    leaseToken: "secret",
    nested: { url: "https://r2/a?sig=secret", apiKey: "secret" },
  }
  expect(JSON.stringify(redactLogValue(value))).not.toContain("secret")
  const dto = processingStatusDto({
    status: "running",
    leaseToken: "secret",
    azureTranscriptionUrl: "private",
    processingMetrics: { legacyDebugUrl: "https://r2/a?sig=secret", apiKey: "secret" },
    checkpoint: { warnings: ["https://a?sig=secret"], raw: "secret" },
    steps: {
      PRIMARY_TRANSCRIPTION: {
        status: "COMPLETED",
        output: { value: "secret" },
      },
    },
  })
  expect(dto.status).toBe("running")
  expect(JSON.stringify(dto)).not.toContain("secret")
  expect(dto).not.toHaveProperty("checkpoint")
})
it("drops fully nested intervals and NaN without creating inverted timestamps", () => {
  const result = validateAndNormalizeTimestamps(
    [
      { text: "你好", startMs: 0, endMs: 1000 },
      { text: "错", startMs: 200, endMs: 400 },
      { text: "无效", startMs: NaN, endMs: 2000 },
    ],
    3000,
  )
  expect(result.cues).toHaveLength(1)
  expect(result.warningCount).toBe(2)
})
it("flags tiny coverage, invalid timestamps and English-only hallucinations", () => {
  expect(
    evaluateTranscription({
      segments: [{ text: "你好", startMs: 0, endMs: 200 }],
      audioDurationMs: 420000,
    }).status,
  ).toBe("BAD")
  expect(
    evaluateTranscription({
      segments: [{ text: "你好", startMs: -1, endMs: 200 }],
      audioDurationMs: 1000,
    }).reasons,
  ).toContain("INVALID_TIMESTAMPS")
  expect(
    evaluateTranscription({
      segments: [{ text: "thank you for watching", startMs: 0, endMs: 10000 }],
      audioDurationMs: 10000,
    }).status,
  ).not.toBe("GOOD")
})
