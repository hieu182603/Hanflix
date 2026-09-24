export type DetectedMediaType = "AUTO" | "MOVIE" | "PODCAST" | "MUSIC"

export interface MediaTypeDetection {
  mediaType: DetectedMediaType
  confidence: number
  reasons: string[]
}

/** Cheap, explainable classification. AUTO remains safe when signals conflict. */
export function detectMediaType(input: {
  requested?: DetectedMediaType
  contentMode?: string
  hasVideo: boolean
  durationSeconds: number
  transcriptionQuality?: "GOOD" | "QUESTIONABLE" | "BAD"
}): MediaTypeDetection {
  if (input.requested && input.requested !== "AUTO") {
    return {
      mediaType: input.requested,
      confidence: 1,
      reasons: ["EXPLICIT_MEDIA_TYPE"],
    }
  }
  if (input.contentMode === "podcast")
    return {
      mediaType: "PODCAST",
      confidence: 0.98,
      reasons: ["CONTENT_MODE_PODCAST"],
    }
  if (input.contentMode === "song")
    return {
      mediaType: "MUSIC",
      confidence: 0.98,
      reasons: ["CONTENT_MODE_SONG"],
    }
  if (input.contentMode === "drama")
    return {
      mediaType: "MOVIE",
      confidence: 0.98,
      reasons: ["CONTENT_MODE_DRAMA"],
    }
  if (!input.hasVideo) {
    return input.durationSeconds >= 120
      ? {
          mediaType: "PODCAST",
          confidence: 0.7,
          reasons: ["AUDIO_ONLY_LONG_FORM"],
        }
      : {
          mediaType: "MUSIC",
          confidence: 0.55,
          reasons: ["AUDIO_ONLY_SHORT_FORM"],
        }
  }
  if (input.transcriptionQuality === "BAD")
    return {
      mediaType: "MUSIC",
      confidence: 0.65,
      reasons: ["VIDEO_WITH_LOW_SPEECH_RECOGNITION"],
    }
  if (input.transcriptionQuality === "GOOD")
    return {
      mediaType: "MOVIE",
      confidence: 0.8,
      reasons: ["VIDEO_WITH_CLEAR_SPEECH"],
    }
  return {
    mediaType: "AUTO",
    confidence: 0.35,
    reasons: ["INSUFFICIENT_SIGNALS"],
  }
}
