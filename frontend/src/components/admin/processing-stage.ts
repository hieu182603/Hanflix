/** Use the actual pipeline step; percentages do not identify a processing stage. */
export function processingStageIndex(step: string | undefined, progress: number): number {
  if (step === "DOWNLOAD_SOURCE") return 0
  if (step === "EXTRACT_AUDIO") return 1
  if (["PRIMARY_TRANSCRIPTION", "EVALUATE_TRANSCRIPTION", "SEPARATE_VOCALS", "SECONDARY_TRANSCRIPTION"].includes(step ?? "")) return 2
  if (["NORMALIZE_TRANSCRIPT", "VALIDATE_TIMESTAMPS", "ALIGN_TIMESTAMPS", "SEGMENT_SUBTITLES", "GENERATE_PINYIN", "TRANSLATE", "EXTRACT_VOCABULARY"].includes(step ?? "")) return 3
  if (step === "BUILD_SUBTITLES") return 4
  if (["VALIDATE_RESULT", "CLEANUP", "READY_FOR_REVIEW"].includes(step ?? "")) return 5
  return progress < 10 ? 0 : progress < 35 ? 1 : progress < 60 ? 2 : 3
}

export function processingErrorMessage(step: string | undefined, code: string | undefined, message: string | undefined): string | undefined {
  // Older worker versions persisted inspect_media even when playback was the failing step.
  if (code === "STAGE_DEADLINE_EXCEEDED" && step === "BUILD_SUBTITLES") {
    return "Tạo video phát lại / hoàn thiện phụ đề vượt quá thời gian xử lý cho phép."
  }
  return message
}
