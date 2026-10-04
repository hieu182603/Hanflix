import React from "react"

import { useNavigate } from "react-router-dom"

import { useQuery } from "@tanstack/react-query"

import {
  Crown,
  Sparkles,
  Play,
  ArrowRight,
  Zap,
  Film,
  Languages,
} from "lucide-react"

import { useI18n } from "../i18n"

import { listPublishedLessons } from "../api/learning"

import { lessonQueryKeys } from "../api/queryKeys"

import LessonCard from "./LessonCard"

interface FreeFeedViewProps {
  onSelectLesson: (id: string) => void

  onNavigateSection?: (section: string) => void
}

export default function FreeFeedView({
  onSelectLesson,
  onNavigateSection,
}: FreeFeedViewProps) {
  const { tr } = useI18n()

  const navigate = useNavigate()

  const sampleLessonsQuery = useQuery({
    queryKey: lessonQueryKeys.list({ sample: true, limit: 6 }),

    queryFn: ({ signal }) =>
      listPublishedLessons({ sample: true, limit: 6, signal } as never).then(
        (data) => data,
      ),

    staleTime: 60 * 1000,
  })

  const handleUpgradeClick = () => {
    navigate("/premium")
  }

  return (
    <div className="space-y-7 pb-10">
      {/* 1. Cinematic Hero Welcome & Info Banner */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#1C1917] via-[#242429] to-[#18181B] text-white p-5 sm:p-7 md:p-8 shadow-xl border border-white/10">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-red-600/15 blur-3xl pointer-events-none rounded-full" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 blur-3xl pointer-events-none rounded-full" />

        <div className="relative z-10 max-w-3xl">
          {/* Badge Chips */}
          <div className="flex flex-wrap items-center gap-2 mb-3.5">
            <button
              type="button"
              onClick={handleUpgradeClick}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/30 text-amber-300 hover:text-amber-200 hover:border-amber-400/50 text-xs font-black tracking-wide uppercase transition-all cursor-pointer group"
            >
              <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
              <span>{tr("Đặc quyền HanFlix Premium")}</span>
              <ArrowRight className="w-3 h-3 text-amber-400/60 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Heading & Subtitle */}
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-snug">
            {tr("Bứt phá tiếng Trung qua video & phim ảnh thực tế")}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-2xl">
            {tr(
              "Khám phá phương pháp học ngôn ngữ tự nhiên và hiệu quả nhất. Không học vẹt, nhớ từ vựng sâu qua ngữ cảnh phim sinh động.",
            )}
          </p>

          {/* Core Benefit Micro-cards */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs sm:text-sm text-neutral-200">
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <Film className="w-4 h-4 text-red-400 shrink-0" />
              <span>{tr("Xem video học không giới hạn")} (HSK 1 - 9)</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <Languages className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{tr("Phụ đề Chữ Hán – Pinyin – Tiếng Việt")}</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
              <span>{tr("AI Bảo Bảo sửa phát âm 24/7")}</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{tr("Hệ thống ôn tập từ vựng SRS thông minh")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Free Sample Lessons Showcase */}
      <section id="free-sample-lessons" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-100 text-[#B91B1C]">
                <Play className="w-4 h-4 fill-current" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#18181B] tracking-tight">
                {tr("Video học thử miễn phí")}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                {tr("5 video mẫu")}
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-[#5F6368]">
              {tr(
                "Trải nghiệm phương pháp học qua video có phụ đề tương tác và tra từ trực tiếp.",
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateSection?.("lessons?sample=true")}
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-[#B91B1C] hover:underline self-start sm:self-auto cursor-pointer"
          >
            <span>{tr("Xem tất cả")}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {sampleLessonsQuery.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-64 rounded-2xl bg-neutral-200 animate-pulse"
              />
            ))}
          </div>
        ) : sampleLessonsQuery.data?.items &&
          sampleLessonsQuery.data.items.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {sampleLessonsQuery.data.items.slice(0, 6).map((lesson) => (
              <LessonCard
                key={lesson._id}
                lesson={lesson}
                badgeText={tr("Miễn phí")}
                onClick={() => onSelectLesson(lesson._id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#E7E7EA] bg-white p-8 text-center space-y-3">
            <Film className="w-10 h-10 text-neutral-400 mx-auto" />
            <p className="text-sm font-bold text-[#18181B]">
              {tr("Danh sách video mẫu đang được cập nhật")}
            </p>
            <p className="text-xs text-[#5F6368] max-w-md mx-auto">
              {tr(
                "Bạn có thể khám phá danh mục bài học đầy đủ của HanFlix ngay bây giờ.",
              )}
            </p>
            <button
              type="button"
              onClick={() => onNavigateSection?.("lessons")}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all cursor-pointer"
            >
              <span>{tr("Xem danh mục bài học")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
