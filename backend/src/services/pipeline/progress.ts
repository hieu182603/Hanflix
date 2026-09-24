import type { PipelineStage } from "../subtitle-pipeline.js"

const DEFAULT_PROGRESS: Record<PipelineStage, number> = {
  inspect_media: 10,
  transcribe_zh: 45,
  generate_pinyin: 58,
  translate_vi: 72,
  extract_vocabulary: 84,
  generate_quiz: 91,
  finalize: 97,
  parse_lyrics: 20,
  align_karaoke: 45,
  detect_chapters: 50,
  diarize_speakers: 45,
}

/** One place for UI progress semantics; callers may provide a finer value. */
export function progressForStage(
  stage: PipelineStage,
  requested?: number,
): number {
  const baseline = DEFAULT_PROGRESS[stage]
  if (requested === undefined || !Number.isFinite(requested)) return baseline
  return Math.max(0, Math.min(99, Math.round(Math.max(baseline, requested))))
}
