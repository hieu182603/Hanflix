import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react"
import { pandaLabels } from "./panda.config"
import { usePandaPet } from "./PandaPetContext"
import { PandaSprite } from "./PandaSprite"
import "./panda.css"

const STORAGE_KEY = "panda-pet-position"

type Position = {
  x: number
  y: number
}
type Drag = {
  pointerId: number
  startX: number
  startY: number
  origin: Position
  moved: boolean
}

function petSize(): number {
  return window.innerWidth <= 600 ? 72 : window.innerWidth <= 1024 ? 88 : 104
}

function clampPosition(position: Position): Position {
  return {
    x: Math.min(
      Math.max(0, position.x),
      Math.max(0, window.innerWidth - petSize()),
    ),
    y: Math.min(
      Math.max(0, position.y),
      Math.max(0, window.innerHeight - petSize()),
    ),
  }
}

function defaultPosition(): Position {
  const margin = window.innerWidth <= 600 ? 12 : 24
  const bottom = window.innerWidth <= 600 ? 80 : 24
  return clampPosition({
    x: window.innerWidth - petSize() - margin,
    y: window.innerHeight - petSize() - bottom,
  })
}

function savedPosition(): Position {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "null",
    ) as Position | null
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y))
      return clampPosition(saved)
  } catch {
    /* Ignore malformed or blocked storage. */
  }
  return defaultPosition()
}

export interface PandaPetProps {
  onOpenAI?: () => void
}

export function PandaPet({ onOpenAI }: PandaPetProps = {}) {
  const { state } = usePandaPet()
  const [position, setPosition] = useState<Position>(savedPosition)
  const [bubbleOpen, setBubbleOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [pageHidden, setPageHidden] = useState(document.hidden)
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const positionRef = useRef(position)
  positionRef.current = position

  useEffect(() => {
    const onResize = () => setPosition((current) => clampPosition(current))
    const onVisibility = () => setPageHidden(document.hidden)
    window.addEventListener("resize", onResize)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("resize", onResize)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  useEffect(() => {
    if (!bubbleOpen) return
    const onOutside = (event: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setBubbleOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBubbleOpen(false)
    }
    window.addEventListener("pointerdown", onOutside)
    window.addEventListener("keydown", onEscape)
    return () => {
      window.removeEventListener("pointerdown", onOutside)
      window.removeEventListener("keydown", onEscape)
    }
  }, [bubbleOpen])

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: positionRef.current,
      moved: false,
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) > 7) {
      drag.moved = true
      setDragging(true)
      setBubbleOpen(false)
    }
    if (drag.moved)
      setPosition(
        clampPosition({ x: drag.origin.x + dx, y: drag.origin.y + dy }),
      )
  }

  const endPointer = (
    event: PointerEvent<HTMLButtonElement>,
    cancelled = false,
  ) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    if (drag.moved) {
      setDragging(false)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(positionRef.current))
      } catch {
        /* Storage optional. */
      }
      window.dispatchEvent(
        new CustomEvent("panda-pet:position", { detail: positionRef.current }),
      )
    } else if (!cancelled) {
      if (onOpenAI) {
        onOpenAI()
      } else {
        setBubbleOpen((open) => !open)
      }
    }
  }

  const size = petSize()
  const bubbleWidth = Math.min(280, window.innerWidth - 24)
  const bubbleLeft = Math.min(
    Math.max(12, position.x + size / 2 - bubbleWidth / 2),
    window.innerWidth - bubbleWidth - 12,
  )
  const bubbleTop =
    position.y >= 150
      ? position.y - 126
      : Math.min(window.innerHeight - 118, position.y + size + 12)
  const bubbleStyle: CSSProperties = {
    left: bubbleLeft,
    top: bubbleTop,
    width: bubbleWidth,
  }

  return (
    <div
      ref={rootRef}
      className="panda-pet-layer"
      data-testid="panda-pet"
      data-state={state}
      data-x={Math.round(position.x)}
      data-y={Math.round(position.y)}
    >
      {bubbleOpen && (
        <div
          id="panda-pet-bubble"
          className="panda-bubble"
          role="status"
          style={bubbleStyle}
        >
          <button
            type="button"
            className="panda-bubble-close"
            aria-label="Đóng lời chào của Panda"
            onClick={() => setBubbleOpen(false)}
          >
            ×
          </button>
          <p className="panda-bubble-title">Xin chào 👋</p>
          <p>
            Tôi là Panda AI.{" "}
            {state === "sleeping"
              ? "Tôi vừa chợp mắt một chút."
              : "Tôi có thể giúp gì cho bạn?"}
          </p>
        </div>
      )}
      <button
        type="button"
        className="panda-pet-button group"
        data-dragging={dragging}
        style={{ left: position.x, top: position.y }}
        aria-label="Mở trợ lý Panda AI"
        aria-expanded={bubbleOpen}
        aria-controls="panda-pet-bubble"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => endPointer(event)}
        onPointerCancel={(event) => endPointer(event, true)}
        onClick={(event) => {
          if (event.detail === 0) {
            if (onOpenAI) onOpenAI()
            else setBubbleOpen((open) => !open)
          }
        }}
      >
        <PandaSprite state={state} paused={pageHidden} />
      </button>
    </div>
  )
}
