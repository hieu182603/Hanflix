import { describe, expect, it } from "vitest"
import { validateAndNormalizeTimestamps } from "./timestamp-validator.js"

describe("timestamp validator", () => {
  it("clamps timestamps to the audio duration", () => {
    const result = validateAndNormalizeTimestamps(
      [{ text: "你好", startMs: -100, endMs: 9_999 }],
      5_000,
    )
    expect(result.cues[0]).toMatchObject({
      startMs: 0,
      endMs: 5_000,
      approximate: false,
    })
  })

  it("drops invalid cues and rejects when none remain", () => {
    try {
      validateAndNormalizeTimestamps(
        [{ text: "x", startMs: 5, endMs: 5 }],
        1000,
      )
      throw new Error("expected validator to throw")
    } catch (error) {
      expect(error).toMatchObject({ code: "AZURE_ASR_EMPTY_TRANSCRIPT" })
    }
  })
})
