import manifest from "./manifest.json"
import type { PandaAIEvent, PandaAnimation, PandaState } from "./panda.types"

export const pandaAnimations = manifest as Record<PandaState, PandaAnimation>
export const PANDA_IDLE_MS = 60_000

export const pandaLabels: Record<PandaState, string> = {
  idle: "đang nghỉ",
  thinking: "đang suy nghĩ",
  working: "đang làm việc",
  searching: "đang tìm kiếm",
  success: "vui mừng",
  sleeping: "đang ngủ",
  error: "đang bối rối",
}

export function pandaStateForAIEvent(event: PandaAIEvent): PandaState {
  switch (event.type) {
    case "thinking":
      return "thinking"
    case "searching":
      return "searching"
    case "tool_start":
      return "working"
    case "tool_end":
      return "thinking"
    case "completed":
      return "success"
    case "error":
      return "error"
  }
}

const imageLoads = new Map<PandaState, Promise<void>>()

export function preloadPandaState(state: PandaState): Promise<void> {
  if (typeof Image === "undefined") return Promise.resolve()
  const existing = imageLoads.get(state)
  if (existing) return existing
  const image = new Image()
  image.decoding = "async"
  const load = new Promise<void>((resolve) => {
    image.onload = () => resolve()
    image.onerror = () => {
      imageLoads.delete(state)
      resolve()
    }
    image.src = pandaAnimations[state].src
    if (image.complete) resolve()
  })
  imageLoads.set(state, load)
  return load
}

export function preloadPandaSprites(): void {
  ;(Object.keys(pandaAnimations) as PandaState[]).forEach((state) => {
    void preloadPandaState(state)
  })
}
