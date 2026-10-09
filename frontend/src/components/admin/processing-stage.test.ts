import { expect, it } from "vitest"
import { processingErrorMessage, processingStageIndex } from "./processing-stage"

it("shows playback instead of translation for the failed videos at 73 percent", () => {
  expect(processingStageIndex("BUILD_SUBTITLES", 73)).toBe(4)
  expect(processingStageIndex("TRANSLATE", 61)).toBe(3)
})
it("uses checkpoints rather than percentage boundaries for transcription and finalization", () => {
  expect(processingStageIndex("PRIMARY_TRANSCRIPTION", 11)).toBe(2)
  expect(processingStageIndex("EXTRACT_AUDIO", 6)).toBe(1)
  expect(processingStageIndex("READY_FOR_REVIEW", 89)).toBe(5)
})
it("keeps the legacy progress fallback for jobs without named steps", () => {
  expect(processingStageIndex(undefined, 45)).toBe(2)
})

it("corrects the misleading stored timeout without hiding unrelated provider errors", () => {
  expect(processingErrorMessage("BUILD_SUBTITLES", "STAGE_DEADLINE_EXCEEDED", 'Stage "inspect_media" vượt deadline')).toContain("Tạo video phát lại")
  expect(processingErrorMessage("TRANSLATE", "FAILED_TRANSLATION", "Azure Translator HTTP 429")).toBe("Azure Translator HTTP 429")
})
