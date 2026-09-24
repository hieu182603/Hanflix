import { describe, expect, it } from "vitest"
import { detectMediaType } from "./media-type-detector.js"

describe("media type detector", () => {
  it("classifies a short video with poor speech recognition as music", () => {
    expect(
      detectMediaType({
        hasVideo: true,
        durationSeconds: 180,
        transcriptionQuality: "BAD",
      }).mediaType,
    ).toBe("MUSIC")
  })

  it("classifies clear video speech as a movie/dialogue clip", () => {
    expect(
      detectMediaType({
        hasVideo: true,
        durationSeconds: 180,
        transcriptionQuality: "GOOD",
      }).mediaType,
    ).toBe("MOVIE")
  })
})
