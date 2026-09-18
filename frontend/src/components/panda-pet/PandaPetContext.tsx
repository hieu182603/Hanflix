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
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  stateRef.current = snapshot.state

  const setPandaState = useCallback((state: PandaState) => {
    if (reactionTimer.current) {
      clearTimeout(reactionTimer.current)
      reactionTimer.current = null
    }
    stateRef.current = state
    setSnapshot((previous) => ({ state, version: previous.version + 1 }))
  }, [])

  const triggerReaction = useCallback(
    (targetState: PandaState, durationMs: number = 2500) => {
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

  useEffect(() => {
    preloadPandaSprites()
  }, [])

  useEffect(() => {
    if (snapshot.state === "idle") {
      scheduleIdle()
    } else {
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [snapshot.state, scheduleIdle])

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
      }
    }
    const onVisibility = () => {
      if (document.hidden) {
        if (idleTimer.current) clearTimeout(idleTimer.current)
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
      if (reactionTimer.current) clearTimeout(reactionTimer.current)
    }
  }, [scheduleIdle, setPandaState])

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
