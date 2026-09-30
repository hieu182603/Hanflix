import { useI18n } from '../../i18n';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import { pandaLabels } from "./panda.config"
import { usePandaPet } from "./PandaPetContext"
import { PandaSprite } from "./PandaSprite"
import "./panda.css"

type Position = {
  x: number
  y: number
}

function petSize(): number {
  return window.innerWidth <= 600 ? 72 : window.innerWidth <= 1024 ? 88 : 104
}

function defaultPosition(): Position {
  const margin = window.innerWidth <= 600 ? 12 : 24
  const bottom = window.innerWidth <= 600 ? 80 : 24
  return {
    x: window.innerWidth - petSize() - margin,
    y: window.innerHeight - petSize() - bottom,
  }
}

export interface PandaPetProps {
  onOpenAI?: () => void
  isAIOpen?: boolean
}

const BUBBLE_MESSAGES: Record<import("./panda.types").PandaState, {
  title: string
  body: string
}> = {
  idle: {
    title: "Xin chào 👋",
    body: "Tôi là Panda AI. Tôi có thể giúp gì cho bạn trong hành trình học tiếng Trung?",
  },
  sleeping: {
    title: "Khò khò... 💤",
    body: "Tôi vừa chợp mắt một chút. Bấm vào tôi để cùng học tiếp nhé!",
  },
  thinking: {
    title: "Đang suy nghĩ... 🤔",
    body: "Đợi tôi một chút, đang phân tích cấu trúc ngữ pháp và từ vựng cho bạn!",
  },
  working: {
    title: "Đang biên soạn ⚡",
    body: "Panda đang chăm chỉ tra cứu và soạn nội dung chi tiết cho bạn đây!",
  },
  searching: {
    title: "Đang tìm kiếm 🔍",
    body: "Đang tra cứu từ điển và kho bài học HanFlix phù hợp nhất...",
  },
  success: {
    title: "Tuyệt vời quá! 🎉",
    body: "Bạn làm rất tốt! Cùng giữ vững ngọn lửa học tập mỗi ngày nhé!",
  },
  error: {
    title: "Bối rối một xíu... 😅",
    body: "Không sao cả, sai sót là một phần tự nhiên khi học một ngôn ngữ mới!",
  },
}

export function PandaPet({ onOpenAI, isAIOpen = false }: PandaPetProps = {}) {
  const { tr, ui } = useI18n();
  const { state, triggerReaction } = usePandaPet()
  const [position, setPosition] = useState<Position>(defaultPosition)
  const [bubbleOpen, setBubbleOpen] = useState(false)
  const [pageHidden, setPageHidden] = useState(document.hidden)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onResize = () => {
      // Recompute fixed bottom-right anchor on resize
      const margin = window.innerWidth <= 600 ? 12 : 24
      const bottom = window.innerWidth <= 600 ? 80 : 24
      const size = petSize()
      setPosition({
        x: window.innerWidth - size - margin,
        y: window.innerHeight - size - bottom,
      })
    }
    const onVisibility = () => setPageHidden(document.hidden)
    onResize()
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

  const size = petSize()
  const isDesktop = typeof window !== "undefined" && window.innerWidth > 640
  // Keep Panda next to the 500px AI drawer instead of underneath it.
  const effectiveX =
    isAIOpen && isDesktop
      ? Math.min(position.x, window.innerWidth - 500 - size - 20)
      : position.x

  const bubbleWidth = Math.min(280, window.innerWidth - 24)
  const bubbleLeft = Math.min(
    Math.max(12, effectiveX + size / 2 - bubbleWidth / 2),
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

  const currentMsg = BUBBLE_MESSAGES[state] || BUBBLE_MESSAGES.idle
  const showActionStatus =
    isAIOpen && !bubbleOpen && state !== "idle" && state !== "sleeping"
  const statusWidth = 150
  const statusStyle: CSSProperties = {
    left: Math.min(
      Math.max(12, effectiveX + size / 2 - statusWidth / 2),
      window.innerWidth - statusWidth - 12,
    ),
    top:
      position.y >= 48
        ? position.y - 38
        : Math.min(window.innerHeight - 34, position.y + size + 6),
    width: statusWidth,
  }
  const statusLabel = ui(pandaLabels[state]).replace(/^./, (letter) =>
    letter.toUpperCase(),
  )

  return (
    <div
      ref={rootRef}
      className="panda-pet-layer"
      data-testid="panda-pet"
      data-state={state}
      data-x={Math.round(effectiveX)}
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
            aria-label={tr("Đóng lời chào của Panda")}
            onClick={() => setBubbleOpen(false)}
          >×</button>
          <p className="panda-bubble-title">{ui(currentMsg.title)}</p>
          <p>{ui(currentMsg.body)}</p>
        </div>
      )}
      {showActionStatus && (
        <div className="panda-state-chip" role="status" style={statusStyle}>
          {ui(statusLabel)}
        </div>
      )}
      <button
        type="button"
        className="panda-pet-button group"
        data-dragging="false"
        style={{ left: effectiveX, top: position.y }}
        aria-label={
          isAIOpen
            ? tr("Trợ lý Panda AI ({0})", { 0: ui(pandaLabels[state]) })
            : tr("Mở trợ lý Panda AI")
        }
        aria-expanded={bubbleOpen}
        aria-controls="panda-pet-bubble"
        onClick={() => {
          if (onOpenAI) {
            if (!isAIOpen) {
              triggerReaction("thinking", 1000)
              onOpenAI()
            } else {
              setBubbleOpen((open) => !open)
            }
          } else {
            setBubbleOpen((open) => !open)
          }
        }}
      >
        <PandaSprite state={state} paused={pageHidden} />
      </button>
    </div>
  )
}
