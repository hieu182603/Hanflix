import { useEffect, useState } from "react"
import { pandaAnimations } from "./panda.config"
import { usePandaPet } from "./PandaPetContext"
import type { PandaState } from "./panda.types"
import "./panda.css"

const states: PandaState[] = [
  "idle",
  "thinking",
  "working",
  "searching",
  "success",
  "sleeping",
  "error",
]

export function PandaPlayground() {
  const { state, setPandaState } = usePandaPet()
  const [position, setPosition] = useState("Đang khởi tạo")
  const [reducedMotion, setReducedMotion] = useState(false)
  const [runningFlow, setRunningFlow] = useState(false)

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener("change", sync)
    const syncPosition = () => {
      const pet = document.querySelector('[data-testid="panda-pet"]')
      if (pet)
        setPosition(
          `${pet.getAttribute("data-x")}, ${pet.getAttribute("data-y")}`,
        )
    }
    syncPosition()
    window.addEventListener("panda-pet:position", syncPosition)
    window.addEventListener("resize", syncPosition)
    return () => {
      media.removeEventListener("change", sync)
      window.removeEventListener("panda-pet:position", syncPosition)
      window.removeEventListener("resize", syncPosition)
    }
  }, [])

  useEffect(() => {
    if (!runningFlow) return
    const timers = [
      setTimeout(() => setPandaState("thinking"), 0),
      setTimeout(() => setPandaState("working"), 1500),
      setTimeout(() => setPandaState("searching"), 3500),
      setTimeout(() => setPandaState("success"), 5000),
      setTimeout(() => setRunningFlow(false), 7000),
    ]
    return () => timers.forEach(clearTimeout)
  }, [runningFlow, setPandaState])

  const animation = pandaAnimations[state]
  return (
    <main className="panda-playground">
      <div className="panda-playground-panel">
        <a href="/" className="panda-playground-back">
          ← HanFlix
        </a>
        <p className="panda-playground-eyebrow">Developer playground</p>
        <h1>Panda AI Pet</h1>
        <p>
          Chọn một trạng thái, kéo panda, hoặc thử luồng AI. Trang này chỉ có
          trong dev.
        </p>
        <div className="panda-playground-controls">
          {states.map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={state === item}
              onClick={() => {
                setRunningFlow(false)
                setPandaState(item)
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="panda-playground-flow"
          disabled={runningFlow}
          onClick={() => {
            setPandaState("idle")
            setRunningFlow(true)
          }}
        >
          {runningFlow ? "Đang chạy flow…" : "Test AI Flow"}
        </button>
        <dl className="panda-playground-debug">
          <div>
            <dt>Current state</dt>
            <dd data-testid="panda-state">{state}</dd>
          </div>
          <div>
            <dt>Animation</dt>
            <dd>{animation.src}</dd>
          </div>
          <div>
            <dt>Frames / FPS</dt>
            <dd>
              {animation.frames} / {animation.fps}
            </dd>
          </div>
          <div>
            <dt>Loop</dt>
            <dd>{String(animation.loop)}</dd>
          </div>
          <div>
            <dt>Position (x, y)</dt>
            <dd>{position}</dd>
          </div>
          <div>
            <dt>Reduced motion</dt>
            <dd>{reducedMotion ? "enabled" : "disabled"}</dd>
          </div>
        </dl>
      </div>
    </main>
  )
}
