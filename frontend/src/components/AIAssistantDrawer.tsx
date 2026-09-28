import { useEffect, useRef, useState } from "react"
import {
  BookOpen,
  BookOpenText,
  ChevronDown,
  Languages,
  MessageCircleMore,
  Mic,
  Paperclip,
  PenLine,
  Send,
  X,
} from "lucide-react"
import { askPanda, getPandaHistory, clearPandaHistory, type LessonAiContext, type PandaReply, type AiCitation } from "../api/learning"
import { ApiRequestError } from "../api/client"
import { useLearningAI, formatAiTime, type LearningAISource } from "./ai/LearningAIContext"
import { usePandaPet } from "./panda-pet"

interface AIAssistantDrawerProps {
  isOpen: boolean
  onClose: () => void
  initialPrompt?: string
  onPromptConsumed?: () => void
  currentUser?: {
    name: string
    learningProfile?: {
      hskLevel?: number
      goal?: string
      topics?: string[]
    } | null
  } | null

}

interface ChatMessage {
  id: string
  sender: "ai" | "user"
  text: string
  time: string
  isError?: boolean
  reply?: PandaReply
  snapshot?: LessonAiContext
  retryQuestion?: string
}

const QUICK_ACTIONS = [
  {
    label: "Giải thích từ",
    prompt: "Giải thích từ vựng quan trọng trong bài học này",
    icon: BookOpenText,
  },
  {
    label: "Luyện ngữ pháp",
    prompt: "Giải thích ngữ pháp trong bài học này và cho ví dụ dễ hiểu",
    icon: PenLine,
  },
  {
    label: "Tạo ví dụ",
    prompt: "Tạo 5 câu ví dụ thực tế dựa trên nội dung bài học này",
    icon: Languages,
  },
  {
    label: "Luyện hội thoại",
    prompt: "Hãy luyện một đoạn hội thoại ngắn với tôi theo chủ đề bài học này",
    icon: MessageCircleMore,
  },
] as const

function PandaAvatar({
  size = 36,
  className = "",
}: {
  size?: number
  className?: string
}) {
  return (
    <img
      src="/assets/panda-chat-icon.png"
      alt="Panda AI"
      width={size}
      height={size}
      className={`block shrink-0 object-cover ${className}`}
      style={{
        width: size,
        height: size,
      }}
    />
  )
}

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-end gap-2.5" role="status" aria-label={label}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#F0D4D4] bg-[#FFF7F5]">
        <PandaAvatar size={32} className="h-full w-full object-cover" />
      </div>
      <div className="rounded-2xl rounded-bl-md border border-[#E9E3DF] bg-white px-3.5 py-2.5 shadow-[0_8px_22px_rgba(89,48,42,0.06)]">
        <div className="flex h-4 items-center gap-1.5">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="ai-typing-dot block h-1.5 w-1.5 rounded-full bg-[#B91B1C]"
              style={{ animationDelay: `${index * 160}ms` }}
            />
          ))}
          <span className="ml-1 text-[11px] font-medium text-[#6F6663]">
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function AIAssistantDrawer(props: AIAssistantDrawerProps) {
  const { source } = useLearningAI()
  const [general, setGeneral] = useState(false)
  const useGeneral = general && !props.initialPrompt
  useEffect(() => {
    if (props.initialPrompt && source) setGeneral(false)
  }, [props.initialPrompt, source?.lessonId])
  return <PandaChat key={useGeneral ? 'general' : `${source?.lessonId ?? 'general'}:${source?.revision ?? 0}`}
    {...props} source={useGeneral ? null : source} availableSource={source}
    onToggleGeneral={() => setGeneral(value => !value)} />
}

function PandaChat({
  isOpen, onClose, initialPrompt, onPromptConsumed, currentUser, source, availableSource, onToggleGeneral,
}: AIAssistantDrawerProps & {
  source: LearningAISource | null; availableSource: LearningAISource | null; onToggleGeneral: () => void;
}) {
  const panda = usePandaPet()
  const { selected } = useLearningAI()
  const sourceRef = useRef(source)
  sourceRef.current = source
  const learnerName = currentUser?.name?.split(" ").pop() || "bạn"
  const greeting = `Chào ${learnerName}! Mình là Panda AI. ${source ? 'Mình sẽ dựa trên phụ đề của bài này để giải thích.' : 'Hỏi mình về từ vựng, ngữ pháp hoặc cách dùng tiếng Trung nhé.'}`
  const contextTitle = source?.title || "Hỏi tiếng Trung chung"
  const hskLevel = source?.hskLevel ?? currentUser?.learningProfile?.hskLevel
  const [scope, setScope] = useState<LessonAiContext['scope']>('current_segment')
  const [pinned, setPinned] = useState<{ context: LessonAiContext; cue?: AiCitation } | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [historyVersion, setHistoryVersion] = useState(0)
  const requestRef = useRef<AbortController | null>(null)
  const clearRef = useRef<AbortController | null>(null)
  const workTimer = useRef<number | undefined>(undefined)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "ai",
      text: greeting,
      time: "Vừa xong",
    },
  ])
  const [inputText, setInputText] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)


  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 280)
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleEscape)
    panda.triggerReaction("thinking", 1000)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  const handleScroll = () => {
    const element = scrollRef.current
    if (!element) return
    setShowScrollButton(
      element.scrollHeight - element.scrollTop - element.clientHeight > 120,
    )
  }

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    if (!isOpen || !initialPrompt) return
    setInputText(initialPrompt.slice(0, 500))
    onPromptConsumed?.()
  }, [isOpen, initialPrompt, onPromptConsumed])

  useEffect(() => {
    if (selected && selected.lessonId === source?.lessonId) {
      if (!selected.cue) { setPinned(null); setScope('current_segment'); return }
      setPinned({ context: { ...source.snapshot(), playbackMs: selected.cue.startMs,
        cueId: selected.cue.cueId, scope: 'current_cue' }, cue: selected.cue })
      setScope('current_cue')
    }
  }, [selected, source?.lessonId])

  useEffect(() => {
    if (!isOpen) return
    const controller = new AbortController()
    setHistoryLoading(true)
    setHistoryError('')
    getPandaHistory(sourceRef.current?.snapshot(), controller.signal).then(data => {
      if (controller.signal.aborted) return
      setMessages([{ id: 'welcome', sender: 'ai', text: greeting, time: 'Vừa xong' },
        ...(data.messages ?? []).flatMap(turn => {
          const time = new Date(turn.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          return [
            { id: `${turn.id}-user`, sender: 'user' as const, text: turn.question, time, snapshot: turn.response.context },
            { id: `${turn.id}-ai`, sender: 'ai' as const, text: turn.response.answerVi, time, reply: turn.response },
          ]
        })])
    }).catch(error => {
      if (!controller.signal.aborted) setHistoryError(error instanceof ApiRequestError ? error.message : 'Chưa tải được lịch sử hội thoại.')
    }).finally(() => { if (!controller.signal.aborted) setHistoryLoading(false) })
    return () => controller.abort()
  }, [isOpen, historyVersion])

  useEffect(() => {
    if (!isOpen) {
      requestRef.current?.abort()
      requestRef.current = null
      window.clearTimeout(workTimer.current)
      setIsTyping(false)
    }
    return () => {
      requestRef.current?.abort()
      clearRef.current?.abort()
      requestRef.current = null
      window.clearTimeout(workTimer.current)
    }
  }, [isOpen])

  const clearHistory = async () => {
    if (requestRef.current || historyLoading) return
    const controller = new AbortController()
    clearRef.current = controller
    setHistoryLoading(true)
    try {
      await clearPandaHistory(sourceRef.current?.snapshot(), controller.signal)
      if (!controller.signal.aborted) setHistoryVersion(value => value + 1)
    } catch (error) {
      if (!controller.signal.aborted) setHistoryError(error instanceof ApiRequestError ? error.message : 'Chưa xóa được hội thoại.')
    } finally {
      if (!controller.signal.aborted) setHistoryLoading(false)
    }
  }

  const handleSend = async (textToSend?: string, retrySnapshot?: LessonAiContext) => {
    const query = (textToSend ?? inputText).trim()
    if (!query || query.length > 500 || requestRef.current || historyLoading) return
    const live = sourceRef.current
    const snapshot = retrySnapshot ?? (live ? { ...(pinned?.context ?? live.snapshot()), scope } : undefined)
    const id = crypto.randomUUID()
    const controller = new AbortController()
    requestRef.current = controller
    setMessages(previous => [...previous, { id: `${id}-user`, sender: 'user', text: query,
      time: 'Vừa xong', snapshot }])
    setInputText('')
    setIsTyping(true)
    panda.handlePandaAIEvent({ type: 'thinking' })
    workTimer.current = window.setTimeout(() => panda.setPandaState('working'), 1200)
    try {
      const reply = await askPanda({ question: query, lessonContext: snapshot, clientMessageId: id }, controller.signal)
      if (controller.signal.aborted || requestRef.current !== controller) return
      setMessages(previous => [...previous, { id: `${id}-ai`, sender: 'ai', text: reply.answerVi,
        time: 'Vừa xong', reply }])
      panda.handlePandaAIEvent({ type: 'completed' })
    } catch (error) {
      if (controller.signal.aborted || requestRef.current !== controller) return
      setMessages(previous => [...previous, { id: `${id}-error`, sender: 'ai', isError: true,
        text: error instanceof ApiRequestError ? error.message : 'Chưa thể kết nối với Panda. Hãy thử lại.',
        time: 'Vừa xong', retryQuestion: query, snapshot }])
      panda.handlePandaAIEvent({ type: 'error' })
    } finally {
      if (requestRef.current === controller) {
        window.clearTimeout(workTimer.current)
        requestRef.current = null
        setIsTyping(false)
      }
    }
  }

  const pandaStatus =
    panda.state === "thinking"
      ? "Panda đang suy nghĩ"
      : panda.state === "working"
        ? "Panda đang soạn câu trả lời"
        : panda.state === "searching"
          ? "Panda đang tìm nội dung phù hợp"
          : "Panda đang giải thích"

  if (!isOpen) return null

  return (
    <>
      <style>{`
        @keyframes ai-drawer-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes ai-message-in {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes ai-typing {
          0%, 100% { transform: translateY(0); opacity: .35; }
          50% { transform: translateY(-3px); opacity: 1; }
        }
        .ai-drawer { animation: ai-drawer-in 280ms cubic-bezier(.16,1,.3,1) both; }
        .ai-message { animation: ai-message-in 220ms cubic-bezier(.16,1,.3,1) both; }
        .ai-typing-dot { animation: ai-typing 1.1s ease-in-out infinite; }
        .ai-chat-scroll::-webkit-scrollbar { width: 5px; }
        .ai-chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .ai-chat-scroll::-webkit-scrollbar-thumb { background: #DCCFCA; border-radius: 999px; }
        @media (prefers-reduced-motion: reduce) {
          .ai-drawer, .ai-message, .ai-typing-dot { animation: none !important; }
          .ai-chat-scroll { scroll-behavior: auto !important; }
        }
      `}</style>

      <button
        type="button"
        className="fixed inset-0 z-50 cursor-default bg-[#211A1A]/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Đóng Panda AI"
      />

      <aside
        className="ai-drawer fixed inset-y-0 right-0 z-50 flex w-full max-w-[500px] flex-col overflow-hidden border-l border-[#EADFDB] bg-[#FFFCFA] shadow-[-24px_0_70px_rgba(55,31,28,0.18)]"
        aria-label="Trợ lý Panda AI"
      >
        <div className="h-1 shrink-0 bg-[#B91B1C]" />

        <header className="flex shrink-0 items-center gap-3 border-b border-[#EEE4E0] bg-[#FFFCFA] px-4 py-3.5 sm:px-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#F0D4D4] bg-[#FFF3F0] shadow-[0_7px_18px_rgba(119,45,38,0.10)]">
            <PandaAvatar size={48} className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-extrabold tracking-[-0.02em] text-[#18181B]">
              Trợ lý Panda AI
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-[#6F6663]">
              <span>Trợ giảng tiếng Trung</span>
              <span className="flex items-center gap-1.5 text-[#2F6E62]">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#4FA489]"
                  aria-hidden="true"
                />
                Sẵn sàng
              </span>
            </div>
          </div>
          <button type="button" onClick={() => void clearHistory()} disabled={isTyping || historyLoading}
            className="text-[11px] text-[#706764] underline disabled:opacity-40" title="Xóa lịch sử hỏi đáp trong bài hoặc chế độ hiện tại">
            Xóa hội thoại
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-transparent text-[#706764] transition-colors hover:border-[#E8DBD6] hover:bg-[#F8EFEC] hover:text-[#18181B] active:scale-[0.98]"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </header>

        <section
          className="shrink-0 border-b border-[#EEDFDA] bg-[#FFF4F2] px-4 py-3 sm:px-5"
          aria-label="Ngữ cảnh học tập"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#B91B1C] shadow-[0_3px_12px_rgba(119,45,38,0.07)]">
              <BookOpen className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </div>
            <p className="min-w-0 flex-1 truncate text-[12px] text-[#6B5E5A]">
              Đang học:{" "}
              <span className="font-bold text-[#8F1719]">{contextTitle}</span>
            </p>
            {hskLevel && (
              <span className="shrink-0 rounded-lg border border-[#ECCBC7] bg-white px-2.5 py-1 text-[11px] font-bold text-[#A3181A]">
                HSK {hskLevel}
              </span>
            )}
          </div>
          {availableSource && <div className="mt-2 flex items-center gap-2 text-xs">
            {source && <select aria-label="Phạm vi câu hỏi" value={scope}
              onChange={event => { setScope(event.target.value as LessonAiContext['scope']); setPinned(null) }}
              className="rounded-lg border border-[#E9DEDA] bg-white px-2 py-1.5">
              <option value="current_segment">Đoạn đang xem</option>
              <option value="current_cue">Câu đang xem</option>
              <option value="whole_lesson">Toàn bài</option>
            </select>}
            <button type="button" onClick={onToggleGeneral} className="text-[#8F1719] underline">
              {source ? 'Hỏi tiếng Trung chung' : 'Quay lại bài đang xem'}
            </button>
          </div>}
          {source && <div className="mt-2 text-xs text-[#6B5E5A]">
            {source.status === 'loading' ? 'Đang tải phụ đề…' : source.status === 'missing'
              ? 'Chưa có phụ đề khả dụng. Panda sẽ kiểm tra lại khi bạn gửi câu hỏi.'
              : <>
                <p>Dựa trên phụ đề · {scope === 'whole_lesson' ? 'Toàn bộ bài học' : `${pinned ? 'Đã ghim' : 'Đang xem'} ${formatAiTime(pinned?.context.playbackMs ?? source.activeCue?.startMs ?? 0)}`}</p>
                {scope !== 'whole_lesson' && <>
                  <p className="mt-1 line-clamp-2 text-[#262120]">{(pinned?.cue ?? source.activeCue)?.zh ?? 'Chọn câu trong bản chép lời để hỏi cụ thể.'}</p>
                  <button type="button" className="mt-1 underline text-[#8F1719]" onClick={() => {
                    if (pinned) setPinned(null)
                    else setPinned({ context: { ...source.snapshot(), scope }, cue: source.activeCue })
                  }}>{pinned ? 'Theo dõi video tiếp' : 'Ghim đoạn này để hỏi tiếp'}</button>
                </>}
              </>}
          </div>}
        </section>

        <section
          className="shrink-0 border-b border-[#EEE4E0] bg-[#FFFCFA] px-4 py-3.5 sm:px-5"
          aria-labelledby="quick-actions-title"
        >
          <h3
            id="quick-actions-title"
            className="mb-2.5 text-[12px] font-bold text-[#4E4542]"
          >
            Gợi ý nhanh
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map(({ label, prompt, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => void handleSend(source ? prompt.replace('bài học này', scope === 'whole_lesson' ? 'bài học này' : 'đoạn phụ đề đang chọn') : prompt.replace('trong bài học này', 'tiếng Trung').replace('dựa trên nội dung bài học này', 'bằng tiếng Trung').replace('theo chủ đề bài học này', 'về sinh hoạt hằng ngày'))}
                disabled={isTyping || historyLoading || source?.status === 'loading'}
                className="group flex min-h-11 items-center gap-2.5 rounded-xl border border-[#E9DEDA] bg-white px-3 py-2 text-left text-[12px] font-semibold text-[#433B39] shadow-[0_4px_14px_rgba(89,48,42,0.04)] transition-[border-color,background-color,color,transform] hover:border-[#DDA7A4] hover:bg-[#FFF7F5] hover:text-[#A3181A] active:scale-[0.98] disabled:cursor-wait disabled:opacity-50"
              >
                <Icon
                  className="h-4 w-4 shrink-0 text-[#B91B1C]"
                  strokeWidth={1.8}
                />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="ai-chat-scroll h-full overflow-y-auto bg-[#F8F5F3] px-4 py-5 sm:px-5"
            aria-live="polite"
          >
            <div className="space-y-5">
              {historyLoading && <p className="text-xs text-[#6F6663]" role="status">Đang tải hội thoại…</p>}
              {historyError && <p className="text-xs text-[#7E2728]" role="alert">{historyError}{' '}
                <button type="button" disabled={isTyping} onClick={() => setHistoryVersion(value => value + 1)} className="underline">Tải lại hội thoại</button>
              </p>}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`ai-message flex items-end gap-2.5 ${
                    message.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.sender === "ai" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#F0D4D4] bg-[#FFF7F5]">
                      <PandaAvatar size={32} className="h-full w-full object-cover" />
                    </div>
                  )}

                  <div
                    className={`flex max-w-[84%] flex-col ${
                      message.sender === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`whitespace-pre-wrap px-4 py-3 text-[13px] leading-[1.65] shadow-[0_8px_24px_rgba(76,42,37,0.06)] ${
                        message.sender === "user"
                          ? "rounded-2xl rounded-br-md bg-[#B91B1C] text-white"
                          : message.isError
                            ? "rounded-2xl rounded-bl-md border border-[#E5B4B0] bg-[#FFF2F0] text-[#7E2728]"
                            : "rounded-2xl rounded-bl-md border border-[#E7DEDA] bg-white text-[#262120]"
                      }`}
                    >
                      <span>{message.text}</span>
                      {message.snapshot && message.sender === 'user' && <p className="mt-2 text-[10px] opacity-80">
                        {message.snapshot.scope === 'whole_lesson' ? 'Toàn bài' : `Đoạn hỏi: ${formatAiTime(message.snapshot.playbackMs)}`}
                      </p>}
                      {!!message.reply?.citations?.length && <div className="mt-3 space-y-2 border-t border-[#E9DEDA] pt-2">
                        <p className="text-[11px] font-semibold text-[#6B5E5A]">Nguồn phụ đề</p>
                        {message.reply.citations.map(citation => <button type="button" key={citation.cueId}
                          className="block w-full rounded-lg bg-[#FFF4F2] p-2 text-left hover:bg-[#FBE3DF]"
                          disabled={!source || message.reply?.context?.lessonId !== source.lessonId || message.reply?.context?.subtitleRevision !== source.revision}
                          onClick={() => { source?.seek(citation.startMs); onClose() }}>
                          <span className="text-[11px] font-bold text-[#8F1719]">Xem lại {formatAiTime(citation.startMs)}–{formatAiTime(citation.endMs)}</span>
                          <span className="mt-1 block">{citation.zh}</span>
                          <span className="block text-[11px] text-[#6B5E5A]">{citation.pinyin}</span>
                          <span className="block text-[11px]">{citation.vi}</span>
                        </button>)}
                      </div>}
                      {message.retryQuestion && <button type="button" disabled={isTyping || historyLoading}
                        onClick={() => void handleSend(message.retryQuestion, message.snapshot)} className="mt-2 block text-xs underline">
                        Thử lại câu hỏi
                      </button>}
                    </div>
                    <span className="mt-1 px-1 text-[10px] font-medium text-[#6F6663]">
                      {message.time}
                    </span>
                  </div>
                </div>
              ))}

              {isTyping && <TypingIndicator label={pandaStatus} />}
              <div ref={bottomRef} />
            </div>
          </div>

          {showScrollButton && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="absolute bottom-3 left-1/2 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-xl border border-[#E3D7D2] bg-white px-3 text-[11px] font-bold text-[#5C524F] shadow-[0_8px_22px_rgba(76,42,37,0.12)] transition-colors hover:bg-[#FFF7F5] active:scale-[0.98]"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Tin nhắn mới
            </button>
          )}
        </div>

        <footer className="shrink-0 border-t border-[#E9DEDA] bg-[#FFFCFA] px-3.5 pb-3 pt-3 sm:px-5 safe-area-bottom">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void handleSend()
            }}
            className="flex items-center gap-1.5 rounded-2xl border border-[#DDCFCA] bg-white p-2 shadow-[0_8px_26px_rgba(89,48,42,0.07)] transition-[border-color,box-shadow] focus-within:border-[#C95B5C] focus-within:shadow-[0_0_0_3px_rgba(185,27,28,0.09)]"
          >
            <button
              type="button"
              disabled
              title="Đính kèm tệp sẽ sớm được hỗ trợ"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#A0938F] disabled:cursor-not-allowed disabled:opacity-55"
              aria-label="Đính kèm tệp, sắp được hỗ trợ"
            >
              <Paperclip className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
            <label htmlFor="panda-ai-input" className="sr-only">
              Nhập câu hỏi cho Panda AI
            </label>
            <input
              id="panda-ai-input"
              ref={inputRef}
              type="text"
              placeholder="Hỏi Panda về bài học này..."
              maxLength={500}
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              className="min-w-0 flex-1 bg-transparent px-1.5 py-2 text-[13px] text-[#211D1C] outline-none placeholder:text-[#756B68]"
            />
            <button
              type="button"
              disabled
              title="Nhập bằng giọng nói sẽ sớm được hỗ trợ"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#A0938F] disabled:cursor-not-allowed disabled:opacity-55"
              aria-label="Nhập bằng giọng nói, sắp được hỗ trợ"
            >
              <Mic className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
            <button
              type="submit"
              disabled={!inputText.trim() || isTyping || historyLoading || source?.status === 'loading'}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#B91B1C] text-white shadow-[0_7px_16px_rgba(185,27,28,0.24)] transition-[background-color,transform,opacity] hover:bg-[#A3181A] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none"
              aria-label="Gửi câu hỏi"
            >
              <Send className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] font-medium text-[#6F6663]">
            Panda có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.
          </p>
        </footer>
      </aside>
    </>
  )
}
