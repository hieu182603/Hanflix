import { useI18n } from '../../i18n';
import React, { useState, useEffect, useMemo, useCallback } from "react"

import {
  Volume2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Bookmark,
  Search,
  Trash2,
  ArrowRight,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
} from "lucide-react"

import type { SavedVocabulary } from "../../api/vocabulary"

import AdminPaginationBar, {
  DEFAULT_ADMIN_PAGE_SIZE,
} from "../admin/AdminPaginationBar"

export interface SavedWordsPageProps {
  savedWords: SavedVocabulary[]

  dueWords: SavedVocabulary[]

  onReviewWord: (
    wordId: string,
    rating: "again" | "hard" | "good" | "easy",
  ) => Promise<unknown>

  onRemoveWord: (wordId: string) => Promise<unknown>

  onNavigateToVocabulary?: () => void

  busy?: boolean

  hideTopBanner?: boolean
}

export default function SavedWordsPage({
  savedWords = [],

  dueWords = [],

  onReviewWord,

  onRemoveWord,

  onNavigateToVocabulary,

  busy = false,

  hideTopBanner = false,
}: SavedWordsPageProps) {
  const { tr } = useI18n();
  // Flashcard state (rendered directly on page)

  const [currentIndex, setCurrentIndex] = useState(0)

  const [isFlipped, setIsFlipped] = useState(false)

  const [speakingHanzi, setSpeakingHanzi] = useState<string | null>(null)

  // Word List search & delete state

  const [searchQuery, setSearchQuery] = useState("")

  const [deletingId, setDeletingId] = useState<string | null>(null)

  // User marked status map ('learned' = thuộc | 'unlearned' = chưa thuộc)

  const [wordStatusMap, setWordStatusMap] =
    useState<Record<string, "learned" | "unlearned">>(() => {
      try {
        const saved = localStorage.getItem("hanflix_saved_words_status")

        return saved ? JSON.parse(saved) : {}
      } catch {
        return {}
      }
    })

  // Filter state for status ('all' | 'learned' | 'unlearned')

  const [statusFilter, setStatusFilter] =
    useState<"all" | "learned" | "unlearned">("all")

  // Pagination state (identical to Admin pagination)

  const [page, setPage] = useState(1)

  const [pageSize, setPageSize] = useState<number>(DEFAULT_ADMIN_PAGE_SIZE)

  // Calculate stats

  const totalSavedCount = savedWords.length

  // Active flashcard deck (all saved words)

  const activeDeck = useMemo(() => {
    return savedWords.filter((w) => w.wordId && w.wordId.hanzi)
  }, [savedWords])

  // Keep index in bound

  useEffect(() => {
    if (currentIndex >= activeDeck.length && activeDeck.length > 0) {
      setCurrentIndex(0)
    }

    setIsFlipped(false)
  }, [activeDeck.length, currentIndex])

  const currentWord = activeDeck[currentIndex] || null

  // Toggle word status (Thuộc / Chưa thuộc)

  const handleToggleWordStatus = useCallback(
    async (item: SavedVocabulary, targetStatus: "learned" | "unlearned") => {
      const id = item.wordId?._id || item._id

      const currentStatus = wordStatusMap[id]

      const nextStatus = currentStatus === targetStatus ? null : targetStatus

      setWordStatusMap((prev) => {
        const updated = { ...prev }

        if (nextStatus) {
          updated[id] = nextStatus
        } else {
          delete updated[id]
        }

        try {
          localStorage.setItem(
            "hanflix_saved_words_status",
            JSON.stringify(updated),
          )
        } catch (e) {
          console.error("Failed to save word status", e)
        }

        return updated
      })

      // Synchronize with backend SRS

      try {
        if (nextStatus === "learned") {
          await onReviewWord(id, "good")
        } else if (nextStatus === "unlearned") {
          await onReviewWord(id, "again")
        }
      } catch (err) {
        console.error("Failed to sync SRS review", err)
      }
    },

    [wordStatusMap, onReviewWord],
  )

  // Audio pronunciation

  const playPronunciation = useCallback((hanzi: string) => {
    if (!hanzi) return

    setSpeakingHanzi(hanzi)

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(hanzi)

      utterance.lang = "zh-CN"

      utterance.rate = 0.85

      utterance.onend = () => setSpeakingHanzi(null)

      utterance.onerror = () => setSpeakingHanzi(null)

      window.speechSynthesis.speak(utterance)
    } else {
      setTimeout(() => setSpeakingHanzi(null), 1000)
    }
  }, [])

  // Keyboard navigation for on-page flashcard (Space to flip, arrows to navigate)

  useEffect(() => {
    if (!currentWord) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in search input

      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        )
      ) {
        return
      }

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault()

        setIsFlipped((prev) => !prev)
      } else if (e.key === "ArrowRight") {
        e.preventDefault()

        setIsFlipped(false)

        setCurrentIndex((prev) => (prev + 1) % Math.max(1, activeDeck.length))
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()

        setIsFlipped(false)

        setCurrentIndex((prev) => Math.max(0, prev - 1))
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentWord, activeDeck.length])

  // Reset page when filter or search changes

  useEffect(() => {
    setPage(1)
  }, [searchQuery, statusFilter])

  // Count statistics

  const learnedCount = useMemo(() => {
    return savedWords.filter((w) => {
      const id = w.wordId?._id || w._id

      return wordStatusMap[id] === "learned"
    }).length
  }, [savedWords, wordStatusMap])

  const unlearnedCount = useMemo(() => {
    return savedWords.filter((w) => {
      const id = w.wordId?._id || w._id

      return wordStatusMap[id] === "unlearned"
    }).length
  }, [savedWords, wordStatusMap])

  // Filtered saved words for list view

  const filteredList = useMemo(() => {
    return savedWords.filter((item) => {
      const id = item.wordId?._id || item._id

      const status = wordStatusMap[id]

      // Filter by status

      if (statusFilter === "learned" && status !== "learned") return false

      if (statusFilter === "unlearned" && status !== "unlearned") return false

      // Filter by search query

      const hanzi = item.wordId?.hanzi || ""

      const pinyin = item.wordId?.pinyin || ""

      const meaning = item.wordId?.meaningVi || ""

      const matchSearch =
        !searchQuery.trim() ||
        hanzi.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        pinyin.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        meaning.toLowerCase().includes(searchQuery.trim().toLowerCase())

      return matchSearch
    })
  }, [savedWords, searchQuery, statusFilter, wordStatusMap])

  // Pagination slice

  const paginatedList = useMemo(() => {
    const startIndex = (page - 1) * pageSize

    return filteredList.slice(startIndex, startIndex + pageSize)
  }, [filteredList, page, pageSize])

  const handleDelete = async (item: SavedVocabulary) => {
    const id = item.wordId?._id || item._id

    setDeletingId(id)

    try {
      await onRemoveWord(id)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Overview (No buttons) */}
      {!hideTopBanner && (
        <div className="relative overflow-hidden rounded-3xl bg-white p-6 md:p-8 border border-[#E7E7EA] shadow-xs">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#B91B1C] via-[#E85D5D] to-[#B91B1C]" />
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#B91B1C]/5 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FDF1F1] border border-[#B91B1C]/15 text-[#B91B1C] text-xs font-bold mb-2">
              <Bookmark className="w-3.5 h-3.5 fill-[#B91B1C]" />
              <span>{tr("Sổ Từ & Luyện Tập SRS")}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[#18181B] tracking-tight">{tr("Kho Lưu Trữ Từ Vựng")}</h1>
            <p className="text-xs md:text-sm text-[#5F6368] mt-1.5 max-w-2xl leading-relaxed">{tr("Hệ thống ôn tập ngắt quãng (SRS) tự động tính toán thời điểm vàng để đưa từ vựng trở lại bộ nhớ, giúp bạn nhớ từ sâu và lâu bền nhất.")}</p>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ON-PAGE QUIZLET 3D FLASHCARD STATION (NGAY TRÊN TÌM KIẾM) */}
      {/* ========================================================= */}
      {totalSavedCount > 0 && activeDeck.length > 0 && (
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-[#E7E7EA] shadow-xs space-y-4">
          {/* Quizlet-Style 3D Flip Card */}
          <div className="perspective-1200 w-full select-none cursor-pointer">
            <div
              onClick={() => setIsFlipped((prev) => !prev)}
              className="relative w-full h-[400px] sm:h-[460px] md:h-[480px] transition-transform duration-700 ease-[cubic-bezier(0.34,1.15,0.64,1)] transform-style-3d group"
              style={{
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",

                transformStyle: "preserve-3d",
              }}
            >
              {/* FRONT FACE (TERM SIDE) */}
              <div
                className="absolute inset-0 w-full h-full backface-hidden rounded-[2rem] bg-gradient-to-b from-white via-[#FCFBFB] to-[#F9F7F7] border-2 border-[#E7E7EA] group-hover:border-[#B91B1C]/50 shadow-md group-hover:shadow-xl transition-all duration-300 p-6 sm:p-8 md:p-10 flex flex-col justify-between overflow-hidden"
                style={{
                  backfaceVisibility: "hidden",

                  WebkitBackfaceVisibility: "hidden",

                  transform: "rotateY(0deg)",
                }}
              >
                {/* Watermark in front */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[180px] sm:text-[240px] font-serif font-black text-neutral-900/[0.03] select-none pointer-events-none transition-transform duration-500 group-hover:scale-105">
                  {currentWord?.wordId?.hanzi?.[0]}
                </div>

                {/* Top Row: Eyebrow + Pronunciation Speaker */}
                <div className="relative z-10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F7F7F9] border border-[#E7E7EA] text-[11px] font-bold text-[#5F6368] uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#B91B1C]" />
                      <span>{tr("Mặt trước · Thuật ngữ")}</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-neutral-100 text-[10px] font-medium text-[#5F6368]">{tr("Lặp")} {currentWord?.repetitions ?? 0} {tr("lần")}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()

                      playPronunciation(currentWord?.wordId?.hanzi || "")
                    }}
                    title={tr("Nghe phát âm chuẩn (Giọng Bắc Kinh)")}
                    className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                      speakingHanzi === currentWord?.wordId?.hanzi
                        ? "bg-[#B91B1C] text-white border-[#B91B1C] scale-110 shadow-md"
                        : "bg-white hover:bg-[#FDF1F1] text-[#5F6368] hover:text-[#B91B1C] border-[#E7E7EA] hover:border-[#B91B1C]/30 group-hover:scale-105"
                    }`}
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Center: Massive Hanzi Character + Flip Cue */}
                <div className="relative z-10 text-center py-2 my-auto flex flex-col items-center justify-center">
                  <div className="text-7xl sm:text-8xl font-serif font-black text-[#18181B] tracking-wide transition-transform duration-300 group-hover:scale-105 drop-shadow-xs">
                    {currentWord?.wordId?.hanzi}
                  </div>

                  <div className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#8B9097] group-hover:text-[#B91B1C] bg-white group-hover:bg-[#FDF1F1] px-4 py-1.5 rounded-full border border-[#E7E7EA] group-hover:border-[#B91B1C]/30 transition-all shadow-2xs">
                    <RotateCcw className="w-3.5 h-3.5 text-[#B91B1C] transition-transform duration-500 group-hover:rotate-180" />
                    <span>{tr("Chạm để lật xem định nghĩa & phát âm")}</span>
                  </div>
                </div>

                {/* Bottom Row: Context + Space shortcut */}
                <div className="relative z-10 flex items-center justify-between text-xs text-[#8B9097] border-t border-[#E7E7EA]/70 pt-3">
                  <span className="truncate max-w-[200px]">
                    {currentWord?.sourceLessonId?.titleVi ||
                      tr("Từ vựng lưu từ bài học")}
                  </span>
                  <kbd className="px-2 py-0.5 rounded-md bg-[#F7F7F9] border border-[#E7E7EA] text-[10px] font-mono text-neutral-600 font-bold">{tr("Space để lật thẻ")}</kbd>
                </div>
              </div>

              {/* BACK FACE (DEFINITION & EXAMPLES SIDE) */}
              <div
                className="absolute inset-0 w-full h-full backface-hidden rounded-[2rem] bg-gradient-to-b from-white via-[#FFFDFD] to-[#FDF5F5] border-2 border-[#B91B1C]/40 shadow-md group-hover:shadow-xl transition-all duration-300 p-6 sm:p-8 md:p-10 flex flex-col justify-between overflow-hidden rotate-y-180"
                style={{
                  backfaceVisibility: "hidden",

                  WebkitBackfaceVisibility: "hidden",

                  transform: "rotateY(180deg)",
                }}
              >
                {/* Watermark in back */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[180px] sm:text-[240px] font-serif font-black text-[#B91B1C]/[0.03] select-none pointer-events-none">
                  {currentWord?.wordId?.hanzi?.[0]}
                </div>

                {/* Top Row: Eyebrow + Speaker */}
                <div className="relative z-10 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDF1F1] border border-[#B91B1C]/25 text-[11px] font-bold text-[#B91B1C] uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 fill-[#B91B1C]" />
                    <span>{tr("Mặt sau · Định nghĩa & Phát âm")}</span>
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()

                      playPronunciation(currentWord?.wordId?.hanzi || "")
                    }}
                    title={tr("Nghe lại phát âm")}
                    className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                      speakingHanzi === currentWord?.wordId?.hanzi
                        ? "bg-[#B91B1C] text-white border-[#B91B1C] scale-110 shadow-md"
                        : "bg-white hover:bg-[#FDF1F1] text-[#B91B1C] border-[#B91B1C]/25 group-hover:scale-105"
                    }`}
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Center: Hanzi + Pinyin + Vietnamese Meaning + Part of Speech */}
                <div className="relative z-10 text-center py-2 my-auto flex flex-col items-center justify-center space-y-2">
                  <div className="text-3xl sm:text-4xl font-serif font-black text-[#18181B] tracking-wide">
                    {currentWord?.wordId?.hanzi}
                  </div>

                  <div className="text-2xl sm:text-3xl font-mono font-black text-[#B91B1C] tracking-wide">
                    {currentWord?.wordId?.pinyin}
                  </div>

                  <div className="text-lg sm:text-xl font-bold text-[#18181B] max-w-md mx-auto leading-relaxed pt-1">
                    {currentWord?.wordId?.meaningVi}
                  </div>

                  {currentWord?.wordId?.partOfSpeech && (
                    <span className="inline-block px-3 py-1 rounded-full bg-[#F7F7F9] border border-[#E7E7EA] text-xs font-bold text-[#5F6368] shadow-2xs">
                      {currentWord.wordId.partOfSpeech}
                    </span>
                  )}
                </div>

                {/* Bottom Row: Tip + Flip back hint */}
                <div className="relative z-10 flex items-center justify-between text-xs text-[#8B9097] border-t border-[#E7E7EA]/70 pt-3">
                  <span>{tr("Mặt sau định nghĩa & phát âm")}</span>
                  <div className="inline-flex items-center gap-1.5 font-bold text-[#B91B1C] hover:underline">
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{tr("Lật lại mặt trước")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Controls (Thẻ trước / Nút tích Chưa thuộc - Thuộc / Bộ đếm thẻ / Thẻ sau) */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => {
                setIsFlipped(false)

                setCurrentIndex((prev) => Math.max(0, prev - 1))
              }}
              className="h-11 px-4 sm:px-5 rounded-2xl border border-[#E7E7EA] bg-white hover:bg-[#F7F7F9] text-[#18181B] font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-xs hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{tr("Thẻ trước")}</span>
            </button>

            {/* Center: 2 Nút tích Thuộc & Chưa thuộc + Card Counter */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
              <button
                type="button"
                onClick={() =>
                  currentWord &&
                  handleToggleWordStatus(currentWord, "unlearned")
                }
                className={`h-10 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow-xs active:scale-95 ${
                  currentWord &&
                  wordStatusMap[currentWord.wordId?._id || currentWord._id] ===
                    "unlearned"
                    ? "bg-red-600 text-white border-red-600 shadow-sm"
                    : "bg-white hover:bg-red-50 text-red-600 border-red-200 hover:border-red-300"
                }`}
                title={tr("Đánh dấu từ này là Chưa thuộc")}
              >
                <XCircle className="w-4 h-4" />
                <span>{tr("Chưa thuộc")}</span>
              </button>

              <span className="font-mono text-xs sm:text-sm font-bold text-[#8B9097] bg-[#F7F7F9] px-3.5 py-2 rounded-xl border border-[#E7E7EA]">
                <span className="text-[#B91B1C] font-black text-sm">
                  {currentIndex + 1}
                </span>{" "}
                / {activeDeck.length}
              </span>

              <button
                type="button"
                onClick={() =>
                  currentWord && handleToggleWordStatus(currentWord, "learned")
                }
                className={`h-10 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow-xs active:scale-95 ${
                  currentWord &&
                  wordStatusMap[currentWord.wordId?._id || currentWord._id] ===
                    "learned"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-white hover:bg-emerald-50 text-emerald-600 border-emerald-200 hover:border-emerald-300"
                }`}
                title={tr("Đánh dấu từ này là Đã thuộc")}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{tr("Thuộc")}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsFlipped(false)

                if (currentIndex + 1 < activeDeck.length) {
                  setCurrentIndex((prev) => prev + 1)
                } else {
                  setCurrentIndex(0)
                }
              }}
              className="h-11 px-4 sm:px-6 rounded-2xl bg-[#B91B1C] hover:bg-[#A3181A] text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-lg shadow-[#B91B1C]/20 active:scale-95"
            >
              <span>
                {currentIndex + 1 === activeDeck.length
                  ? tr("Bắt đầu lại")
                  : tr("Thẻ tiếp theo")}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SAVED WORDS DIRECTORY / LIST VIEW (DẠNG DANH SÁCH)        */}
      {/* ========================================================= */}
      <div className="space-y-4">
        {/* Search & Filter Toolbar (Directly under Flashcard) */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#E7E7EA] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#8B9097] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={tr("Tìm từ theo chữ Hán, Pinyin hoặc nghĩa tiếng Việt...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl text-xs font-medium text-[#18181B] placeholder-[#8B9097] outline-none focus:border-[#B91B1C] focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-0.5 cursor-pointer"
                title={tr("Xóa tìm kiếm")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills for Each Type */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-[#18181B] text-white shadow-xs"
                  : "bg-[#F7F7F9] text-[#5F6368] hover:text-[#18181B] hover:bg-[#EFEFF2]"
              }`}
            >{tr("Tất cả (")}{totalSavedCount})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("learned")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                statusFilter === "learned"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{tr("Thuộc (")}{learnedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("unlearned")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                statusFilter === "unlearned"
                  ? "bg-red-600 text-white border-red-600 shadow-xs"
                  : "bg-white hover:bg-red-50 text-red-700 border-red-200"
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>{tr("Chưa thuộc (")}{unlearnedCount})</span>
            </button>
          </div>
        </div>

        {/* Empty State */}
        {totalSavedCount === 0 ? (
          <div className="bg-white rounded-3xl p-10 md:p-16 border border-[#E7E7EA] text-center max-w-2xl mx-auto shadow-2xs">
            <div className="w-16 h-16 rounded-3xl bg-[#FDF1F1] text-[#B91B1C] flex items-center justify-center mx-auto mb-4 border border-[#B91B1C]/15 shadow-inner">
              <Bookmark className="w-8 h-8 fill-[#B91B1C]" />
            </div>
            <h2 className="text-xl font-black text-[#18181B]">{tr("Chưa có từ vựng nào trong kho lưu trữ")}</h2>
            <p className="text-xs sm:text-sm text-[#5F6368] mt-2 max-w-md mx-auto leading-relaxed">{tr("Khi xem video bài học hoặc khám phá danh mục từ vựng theo chủ đề, hãy bấm biểu tượng lưu từ để thêm vào sổ tay luyện tập SRS.")}</p>
            {onNavigateToVocabulary && (
              <button
                onClick={onNavigateToVocabulary}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs sm:text-sm font-bold shadow-md shadow-[#B91B1C]/20 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 fill-white" />
                <span>{tr("Khám phá Kho Từ Vựng ngay")}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : filteredList.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-[#E7E7EA] text-center">
            <p className="text-sm font-bold text-[#18181B]">{tr("Không tìm thấy từ vựng nào")}</p>
            <p className="text-xs text-[#8B9097] mt-1">{tr("Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.")}</p>
          </div>
        ) : (
          /* List View (Dạng Danh Sách Hàng Ngang có đổi màu khi tích Thuộc / Chưa thuộc) */

          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-[#E7E7EA] overflow-hidden shadow-2xs divide-y divide-[#E7E7EA]/80">
              {paginatedList.map((item, index) => {
                const hanzi = item.wordId?.hanzi || "—"

                const pinyin = item.wordId?.pinyin || "—"

                const meaning = item.wordId?.meaningVi || "—"

                const id = item.wordId?._id || item._id

                const isSpeaking = speakingHanzi === hanzi

                const status = wordStatusMap[id]

                return (
                  <div
                    key={item._id || index}
                    className={`p-4 sm:p-5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group border-l-4 ${
                      status === "learned"
                        ? "bg-emerald-50/70 hover:bg-emerald-100/50 border-l-emerald-500"
                        : status === "unlearned"
                          ? "bg-red-50/70 hover:bg-red-100/50 border-l-red-500"
                          : "bg-white hover:bg-[#FDFBFB] border-l-transparent"
                    }`}
                  >
                    {/* Left: Hanzi + Pinyin + Meaning */}
                    <div className="flex items-start sm:items-center gap-4 min-w-0">
                      {/* Big Hanzi Character */}
                      <div className="min-w-[70px] sm:min-w-[85px] shrink-0">
                        <span className="text-2xl sm:text-3xl font-serif font-black text-[#18181B] group-hover:text-[#B91B1C] transition-colors">
                          {hanzi}
                        </span>
                      </div>

                      {/* Pinyin + Context + Meaning */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm text-[#B91B1C]">
                            {pinyin}
                          </span>
                          <span className="text-[11px] text-[#8B9097] px-2.5 py-0.5 rounded-full bg-[#F7F7F9] border border-[#E7E7EA]/70">
                            {item.sourceLessonId?.titleVi || tr("Từ vựng chủ đề")}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-[#3F3F46] font-medium mt-1 line-clamp-2">
                          {meaning}
                        </p>
                      </div>
                    </div>

                    {/* Right: 2 Nút tích Thuộc / Chưa thuộc + Audio + Delete */}
                    <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E7E7EA]/40">
                      {/* 2 Nút tích Thuộc và Chưa thuộc */}
                      <div className="inline-flex items-center gap-1 bg-white/90 p-1 rounded-xl border border-[#E7E7EA] shadow-2xs">
                        <button
                          type="button"
                          onClick={() =>
                            void handleToggleWordStatus(item, "unlearned")
                          }
                          title={
                            status === "unlearned"
                              ? tr("Bỏ tích chưa thuộc")
                              : tr("Tích chưa thuộc (đổi màu đỏ nhạt)")
                          }
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            status === "unlearned"
                              ? "bg-red-600 text-white shadow-2xs"
                              : "text-neutral-500 hover:text-red-600 hover:bg-red-50"
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{tr("Chưa thuộc")}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void handleToggleWordStatus(item, "learned")
                          }
                          title={
                            status === "learned"
                              ? tr("Bỏ tích đã thuộc")
                              : tr("Tích đã thuộc (đổi màu xanh nhạt)")
                          }
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            status === "learned"
                              ? "bg-emerald-600 text-white shadow-2xs"
                              : "text-neutral-500 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{tr("Thuộc")}</span>
                        </button>
                      </div>

                      {/* Audio + Delete */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => playPronunciation(hanzi)}
                          title={tr("Nghe phát âm chuẩn")}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            isSpeaking
                              ? "bg-[#B91B1C] text-white border-[#B91B1C]"
                              : "border-[#E7E7EA] bg-[#F7F7F9] hover:bg-white text-[#5F6368] hover:text-[#B91B1C]"
                          }`}
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          disabled={deletingId === id || busy}
                          onClick={() => void handleDelete(item)}
                          title={tr("Bỏ lưu khỏi sổ tay")}
                          className="p-2 rounded-xl border border-transparent hover:border-[#E7E7EA] text-neutral-400 hover:text-[#B91B1C] hover:bg-red-50 transition-all cursor-pointer disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination bar (Admin standard) */}
            <AdminPaginationBar
              total={filteredList.length}
              page={page}
              pageSize={pageSize}
              visibleCount={paginatedList.length}
              unitLabel="từ vựng"
              ariaLabel={tr("Phân trang kho từ vựng")}
              onPageChange={(newPage) => setPage(newPage)}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize)

                setPage(1)
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
