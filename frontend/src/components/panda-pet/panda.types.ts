export type PandaState = "idle" | "thinking" | "working" | "searching" | "success" | "sleeping" | "error"

export type PandaAIEvent = { type: "thinking" } | { type: "searching" } | {
  type: "tool_start"
} | { type: "tool_end" } | { type: "completed" } | { type: "error" }

export interface PandaAnimation {
  src: string
  frames: number
  fps: number
  loop: boolean
  frameWidth: number
  frameHeight: number
}
