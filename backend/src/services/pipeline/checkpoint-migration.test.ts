import { expect, it } from "vitest"
import { Types } from "mongoose"
import { SubtitleTrackModel } from "../../models/subtitle-track.model.js"
import { migrateLegacyCheckpoints } from "./checkpoint-migration.js"

it.each([false, true])("preserves exact word references and schema validity after resume (old clone: %s)", damaged => {
  const wordId = new Types.ObjectId("6ab35d89f6eca58039bf78ad")
  const saved = damaged ? structuredClone(wordId) : wordId
  const cue = { cueId: "cue-1", zh: "大学", pinyin: "dà xué", vi: "Đại học", startMs: 0, endMs: 1000, tokens: [{ text: "大", wordId: saved }], karaokeTokens: [{ text: "大", startMs: 0, endMs: 1000, wordId: saved }] }
  const source = { BUILD_SUBTITLES: { status: "COMPLETED" as const, attempt: 2, completedAt: new Date(), output: { value: [cue] } } }
  const result = migrateLegacyCheckpoints(source, {}, {})
  const cues = result.steps.BUILD_SUBTITLES?.output?.value as Array<typeof cue>
  const track = new SubtitleTrackModel({ lessonId: new Types.ObjectId(), revision: 1, cues })
  expect(track.validateSync()).toBeUndefined()
  expect(track.cues[0]?.tokens[0]?.wordId?.toString()).toBe(wordId.toHexString())
  expect(track.cues[0]?.karaokeTokens?.[0]?.wordId?.toString()).toBe(wordId.toHexString())
  expect(result.steps.BUILD_SUBTITLES?.status).toBe("COMPLETED")
  expect(source.BUILD_SUBTITLES.output.value[0]?.tokens[0]?.wordId).toBe(saved)
  expect(result.steps.BUILD_SUBTITLES?.completedAt).toBeInstanceOf(Date)
})

it("does not fabricate an ID from an invalid checkpoint object", () => {
  const invalid = { i0: -1, i1: 1, i2: 2, i3: 3 }
  const result = migrateLegacyCheckpoints({ TRANSLATE: { status: "COMPLETED", attempt: 1, output: { value: [{ tokens: [{ wordId: invalid }] }] } } }, {}, {})
  const value = result.steps.TRANSLATE?.output?.value as Array<{ tokens: Array<{ wordId: unknown }> }>
  expect(value[0]?.tokens[0]?.wordId).toBe(invalid)
})
