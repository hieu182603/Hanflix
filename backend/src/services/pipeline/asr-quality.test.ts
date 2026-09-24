import { describe, expect, it } from "vitest"
import { evaluateTranscription } from "./asr-quality.js"

describe("transcription quality evaluator", () => {
  it("flags an empty transcript", () => {
    expect(
      evaluateTranscription({ segments: [], audioDurationMs: 10_000 }),
    ).toMatchObject({ status: "BAD", score: 0 })
  })

  it("flags common hallucination markers", () => {
    const result = evaluateTranscription({
      segments: [{ text: "谢谢观看", startMs: 0, endMs: 8_000 }],
      audioDurationMs: 8_000,
    })
    expect(result.reasons).toContain("HALLUCINATION_PATTERN")
    expect(result.status).not.toBe("GOOD")
  })
})
