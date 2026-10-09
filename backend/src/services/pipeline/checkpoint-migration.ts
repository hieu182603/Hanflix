import type { ProcessingStepsState } from "./processing-steps.js"
import { Types } from "mongoose"

// Older resumes used structuredClone, which stripped BSON ObjectId prototypes.
// BSON 7 stores the 12 bytes as four 24-bit words; recover that exact ID only.
function restoreWordId(value: unknown): unknown {
  if (!value || typeof value !== "object" || value instanceof Types.ObjectId) return value
  const record = value as Record<string, unknown>
  const keys = ["i0", "i1", "i2", "i3"]
  if (Object.keys(record).length !== 4 || !keys.every(key => Number.isInteger(record[key]) && Number(record[key]) >= 0 && Number(record[key]) <= 0xffffff)) return value
  return new Types.ObjectId(keys.map(key => Number(record[key]).toString(16).padStart(6, "0")).join(""))
}

function restoreCueWordIds(value: unknown): unknown {
  if (!Array.isArray(value)) return value
  return value.map(cue => {
    if (!cue || typeof cue !== "object") return cue
    const result = { ...cue }
    for (const field of ["tokens", "karaokeTokens"]) {
      if (Array.isArray(cue[field])) result[field] = cue[field].map((token: Record<string, unknown>) =>
        token && typeof token === "object" && "wordId" in token ? { ...token, wordId: restoreWordId(token.wordId) } : token)
    }
    return result
  })
}

/** Adapt checkpoints emitted by the earlier partial V2 without discarding paid results. */
export function migrateLegacyCheckpoints(
  steps: ProcessingStepsState,
  checkpoint: Record<string, unknown>,
  artifacts: Record<string, unknown>,
) {
  const migrated: ProcessingStepsState = Object.fromEntries(Object.entries(steps).map(([name, state]) => [name, {
    ...state,
    ...(state.output && "value" in state.output ? { output: { ...state.output, value: restoreCueWordIds(state.output.value) } } : {}),
  }]))
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
