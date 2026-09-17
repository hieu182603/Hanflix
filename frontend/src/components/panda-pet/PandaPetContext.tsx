import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  PANDA_IDLE_MS,
  pandaStateForAIEvent,
  preloadPandaSprites,
} from "./panda.config"
import type { PandaAIEvent, PandaState } from "./panda.types"

interface PandaPetContextValue {
  state: PandaState
  setPandaState: (state: PandaState) => void
  handlePandaAIEvent: (event: PandaAIEvent) => void
  triggerReaction: (state: PandaState, durationMs?: number) => void
}

const PandaPetContext = createContext<PandaPetContextValue | null>(null)

export function PandaPetProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<{
    state: PandaState
    version: number
  }>({ state: "idle", version: 0 })
  const stateRef = useRef(snapshot.state)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const randomActionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  stateRef.current = snapshot.state

  const setPandaState = useCallback((state: PandaState) => {
    stateRef.current = state
    setSnapshot((previous) => ({ state, version: previous.version + 1 }))
  }, [])

  const triggerReaction = useCallback(
    (targetState: PandaState, durationMs: number = 2500) => {
      if (reactionTimer.current) clearTimeout(reactionTimer.current)
      if (randomActionTimer.current) clearTimeout(randomActionTimer.current)
      setPandaState(targetState)
      reactionTimer.current = setTimeout(() => {
        if (stateRef.current === targetState) {
          setPandaState("idle")
        }
      }, durationMs)
    },
    [setPandaState],
  )

  const handlePandaAIEvent = useCallback(
    (event: PandaAIEvent) => {
      setPandaState(pandaStateForAIEvent(event))
    },
    [setPandaState],
  )

  // Sleep timer after prolonged inactivity (60s)
  const scheduleIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    if (stateRef.current === "idle" && !document.hidden) {
      idleTimer.current = setTimeout(() => {
        if (stateRef.current === "idle" && !document.hidden) {
          setPandaState("sleeping")
        }
      }, PANDA_IDLE_MS)
    }
  }, [setPandaState])

  // Random idle micro-actions (every 16-24s, do searching / thinking / working for 3.5s)
  const scheduleRandomIdle = useCallback(() => {
    if (randomActionTimer.current) clearTimeout(randomActionTimer.current)
    if (stateRef.current !== "idle" || document.hidden) return

    const delay = 16000 + Math.random() * 8000 // 16s - 24s
    randomActionTimer.current = setTimeout(() => {
      if (stateRef.current === "idle" && !document.hidden) {
        const playfulActions: PandaState[] = ["searching", "thinking", "working"]
        const nextAction = playfulActions[Math.floor(Math.random() * playfulActions.length)]
        setPandaState(nextAction)

        reactionTimer.current = setTimeout(() => {
          if (stateRef.current === nextAction) {
            setPandaState("idle")
          }
        }, 3600)
      }
    }, delay)
  }, [setPandaState])

  useEffect(() => {
    preloadPandaSprites()
  }, [])

  useEffect(() => {
    if (snapshot.state === "idle") {
      scheduleIdle()
      scheduleRandomIdle()
    } else {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      if (randomActionTimer.current) clearTimeout(randomActionTimer.current)
    }
  }, [snapshot.state, scheduleIdle, scheduleRandomIdle])

  useEffect(() => {
    let lastPointerMove = 0
    const activity = (event: Event) => {
      if (document.hidden) return
      if (event.type === "pointermove") {
        const now = Date.now()
        if (now - lastPointerMove < 1000) return
        lastPointerMove = now
      }
      if (stateRef.current === "sleeping") {
        setPandaState("idle")
      } else if (stateRef.current === "idle") {
        scheduleIdle()
        scheduleRandomIdle()
      }
    }
    const onVisibility = () => {
      if (document.hidden) {
        if (idleTimer.current) clearTimeout(idleTimer.current)
        if (randomActionTimer.current) clearTimeout(randomActionTimer.current)
      } else {
        activity(new Event("visibilitychange"))
      }
    }
    const events = [
      "pointermove",
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
    ] as const
    events.forEach((event) =>
      window.addEventListener(event, activity, { passive: true }),
    )
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      events.forEach((event) => window.removeEventListener(event, activity))
      document.removeEventListener("visibilitychange", onVisibility)
      if (idleTimer.current) clearTimeout(idleTimer.current)
      if (randomActionTimer.current) clearTimeout(randomActionTimer.current)
      if (reactionTimer.current) clearTimeout(reactionTimer.current)
    }
  }, [scheduleIdle, scheduleRandomIdle, setPandaState])

  useEffect(() => {
    if (snapshot.state !== "success" && snapshot.state !== "error") return
    const timeout = setTimeout(
      () => setPandaState("idle"),
      snapshot.state === "success" ? 2200 : 2500,
    )
    return () => clearTimeout(timeout)
  }, [snapshot.state, snapshot.version, setPandaState])

  const value = useMemo(
    () => ({
      state: snapshot.state,
      setPandaState,
      handlePandaAIEvent,
      triggerReaction,
    }),
    [snapshot.state, setPandaState, handlePandaAIEvent, triggerReaction],
  )
  return (
    <PandaPetContext.Provider value={value}>
      {children}
    </PandaPetContext.Provider>
  )
}

export function usePandaPet(): PandaPetContextValue {
  const context = useContext(PandaPetContext)
  if (!context)
    throw new Error("usePandaPet must be used within PandaPetProvider")
  return context
}
