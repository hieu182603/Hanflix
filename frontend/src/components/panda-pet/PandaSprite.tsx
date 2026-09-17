import { useEffect, useState, type CSSProperties } from "react"
import { pandaAnimations, preloadPandaState } from "./panda.config"
import type { PandaState } from "./panda.types"

interface SpriteStyle extends CSSProperties {
  "--panda-image": string
  "--panda-frames": number
  "--panda-travel": string
  "--panda-duration": string
  "--panda-iterations": string
}

export function PandaSprite({
  state,
  paused,
}: {
  state: PandaState
  paused: boolean
}) {
  const [visibleState, setVisibleState] = useState<PandaState>("idle")

  useEffect(() => {
    let cancelled = false
    void preloadPandaState(state).then(() => {
      if (!cancelled) setVisibleState(state)
    })
    return () => {
      cancelled = true
    }
  }, [state])

  const animation = pandaAnimations[visibleState]
  const style: SpriteStyle = {
    "--panda-image": `url("${animation.src}")`,
    "--panda-frames": animation.frames,
    "--panda-travel": `${-animation.frames * animation.frameWidth}px`,
    "--panda-duration": `${animation.frames / animation.fps}s`,
    "--panda-iterations": animation.loop
      ? "infinite"
      : visibleState === "success"
        ? "2"
        : "1",
  }

  return (
    <span
      key={visibleState}
      className="panda-sprite"
      data-animation={visibleState}
      data-paused={paused}
      style={style}
      aria-hidden="true"
    />
  )
}
