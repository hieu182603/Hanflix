import type { ProcessingStepsState } from "./processing-steps.js"

/** Adapt checkpoints emitted by the earlier partial V2 without discarding paid results. */
export function migrateLegacyCheckpoints(
  steps: ProcessingStepsState,
  checkpoint: Record<string, unknown>,
  artifacts: Record<string, unknown>,
) {
  const migrated = structuredClone(steps)
  const translations: Record<string, string> = {}
  if (Array.isArray(checkpoint.finalCues))
    for (const cue of checkpoint.finalCues) {
      if (
        typeof cue?.zh === "string" &&
        typeof cue?.vi === "string" &&
        cue.vi.trim()
      )
        translations[cue.zh] = cue.vi
    }
  for (const [name, state] of Object.entries(migrated)) {
    if (
      state.status !== "COMPLETED" ||
      (state.output && "value" in state.output) ||
      name === "DOWNLOAD_SOURCE"
    )
      continue
    if (
      name === "PRIMARY_TRANSCRIPTION" &&
      Array.isArray(checkpoint.segments) &&
      checkpoint.segments.length
    ) {
      state.output = {
        value: checkpoint.segments.map((s) => ({ ...s, text: s.text ?? s.zh })),
      }
    } else if (
      name === "EXTRACT_AUDIO" &&
      typeof artifacts.asrAudioKey === "string"
    ) {
      state.output = { value: artifacts.asrAudioKey }
    } else if (
      ![
        "PRIMARY_TRANSCRIPTION",
        "SECONDARY_TRANSCRIPTION",
        "SEPARATE_VOCALS",
      ].includes(name)
    ) {
      // Rebuild only local derived state. Translation uses exact-text memory below.
      state.status = "PENDING"
      state.metadata = { ...state.metadata, migratedFromLegacyCheckpoint: true }
    }
  }
  return { steps: migrated, translationMemory: translations }
}
