import { useCallback, useMemo, useRef, useState, type RefObject } from "react"

/**
 * SubtitleReview sync hook.
 *
 * Single source of truth for:
 *   - playback state  (currentTimeMs, isPlaying)
 *   - selection state (selectedCueId — which cue the Inspector shows)
 *   - derived state   (activeCueId — which cue the Video Monitor plays)
 *
 * The four panels (Navigator / Video Monitor / Inspector / Timeline) all read
 * from and write to this hook. Their state stays synchronized because they all
 * call the same callbacks. The hook is intentionally small and side-effect
 * free so it's cheap to plug into any new panel.
 */

export interface SubtitleCueLike {
  cueId: string

  startMs: number

  endMs: number
}

export interface UseSubtitleSyncOptions<T extends SubtitleCueLike> {
  cues: T[]

  videoRef: RefObject<HTMLVideoElement | null>
}

export interface UseSubtitleSyncResult {
  /** Current playhead in milliseconds. */

  currentTimeMs: number

  setCurrentTimeMs: (ms: number) => void

  isPlaying: boolean

  togglePlay: () => void

  pause: () => void

  /** Total duration in milliseconds (0 until metadata loads). */

  durationMs: number

  /** Cue currently selected by the admin (Inspector target). */

  selectedCueId: string | null

  setSelectedCueId: (id: string | null) => void

  /** Cue currently playing (derived from currentTimeMs). */

  activeCueId: string | null

  /** Seek and play. Safe to call with ms outside the duration — clamped. */

  seekTo: (ms: number) => void

  goToPrevCue: () => void

  goToNextCue: () => void
}

export function useSubtitleSync<T extends SubtitleCueLike>({
  cues,

  videoRef,
}: UseSubtitleSyncOptions<T>): UseSubtitleSyncResult {
  const [currentTimeMs, setCurrentTimeMsState] = useState(0)

  const [selectedCueId, setSelectedCueId] = useState<string | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)

  const durationMsRef = useRef(0)

  const setCurrentTimeMs = useCallback(
    (ms: number, options?: { fromVideo?: boolean }) => {
      setCurrentTimeMsState(ms)

      // When the value comes from the <video> element's own timeupdate event,

      // skip the imperative seek so we don't create a feedback loop that

      // otherwise makes the timeline jitter under slow playback.

      if (options?.fromVideo) return

      const video = videoRef.current

      if (!video) return

      const duration = durationMsRef.current || video.duration * 1000 || 0

      const clamped = Math.max(0, Math.min(ms, duration || ms))

      if (Math.abs(video.currentTime * 1000 - clamped) > 80) {
        video.currentTime = clamped / 1000
      }
    },
    [videoRef],
  )

  // Keep duration in sync so setCurrentTimeMs clamps correctly before metadata loaded.

  const video = videoRef.current

  if (
    video &&
    video.duration &&
    video.duration * 1000 !== durationMsRef.current
  ) {
    durationMsRef.current = video.duration * 1000
  }

  const durationMs = durationMsRef.current

  const seekTo = useCallback(
    (ms: number) => {
      setCurrentTimeMs(ms)
    },
    [setCurrentTimeMs],
  )

  const togglePlay = useCallback(() => {
    const el = videoRef.current

    if (!el) return

    if (el.paused) {
      void el.play()

      setIsPlaying(true)
    } else {
      el.pause()

      setIsPlaying(false)
    }
  }, [videoRef])

  const pause = useCallback(() => {
    const el = videoRef.current

    if (!el) return

    el.pause()

    setIsPlaying(false)
  }, [videoRef])

  const activeCueId = useMemo(() => {
    const active = cues.find(
      (cue) => currentTimeMs >= cue.startMs && currentTimeMs < cue.endMs,
    )

    return active?.cueId ?? null
  }, [cues, currentTimeMs])

  const goToPrevCue = useCallback(() => {
    const sorted = [...cues].sort((a, b) => a.startMs - b.startMs)

    const previous = sorted.filter((c) => c.startMs < currentTimeMs).pop()

    if (previous) {
      setSelectedCueId(previous.cueId)

      setCurrentTimeMs(previous.startMs)
    }
  }, [cues, currentTimeMs, setCurrentTimeMs])

  const goToNextCue = useCallback(() => {
    const sorted = [...cues].sort((a, b) => a.startMs - b.startMs)

    const next = sorted.find((c) => c.startMs > currentTimeMs)

    if (next) {
      setSelectedCueId(next.cueId)

      setCurrentTimeMs(next.startMs)
    }
  }, [cues, currentTimeMs, setCurrentTimeMs])

  return {
    currentTimeMs,

    setCurrentTimeMs,

    isPlaying,

    togglePlay,

    pause,

    durationMs,

    selectedCueId,

    setSelectedCueId,

    activeCueId,

    seekTo,

    goToPrevCue,

    goToNextCue,
  }
}
