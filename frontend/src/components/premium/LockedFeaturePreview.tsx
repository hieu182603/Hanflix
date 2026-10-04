import React from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  Crown,
  ArrowRight,
  Check,
  ShieldCheck,
  BookOpen,
  GraduationCap,
  Clock,
  Volume2,
  BookMarked,
  Map,
  History,
  TrendingUp,
  Award,
  FileCheck2,
  X,
} from "lucide-react"
import { useI18n } from "../../i18n"

export interface LockedFeaturePreviewProps {
  featureKey?: string
  onNavigateFeed?: () => void
}

interface FeatureMeta {
  subtitle: string
  benefits: [string, string, string]
  icon: React.ElementType
}

export default function LockedFeaturePreview({
  featureKey,
  onNavigateFeed,
}: LockedFeaturePreviewProps) {
  const { tr } = useI18n()
  const navigate = useNavigate()

  const normalizedKey = (featureKey || "").toLowerCase()

  const meta: FeatureMeta = (() => {
    if (normalizedKey === "vocabulary" || normalizedKey === "saved") {
      return {
        subtitle: tr(
          "Nâng cấp HanFlix Premium để lưu từ vựng không giới hạn, kích hoạt thuật toán ôn tập SRS ngắt quãng và luyện flashcard phát âm chuẩn bản xứ.",
        ),
        benefits: [
          tr("Lưu từ vựng không giới hạn từ mọi video"),
          tr("Thuật toán ngắt quãng Spaced Repetition (SRS)"),
          tr("Flashcard phát âm chuẩn & ví dụ song ngữ"),
        ],
        icon: BookMarked,
      }
    }
    if (normalizedKey === "grammar") {
      return {
        subtitle: tr(
          "Nâng cấp HanFlix Premium để làm chủ toàn bộ ngữ pháp HSK qua các đoạn hội thoại thực tế trong phim ảnh có phân tích ngữ cảnh chi tiết.",
        ),
        benefits: [
          tr("Đầy đủ điểm ngữ pháp HSK 1 đến HSK 6"),
          tr("Ví dụ trích đoạn trực tiếp từ phim ảnh"),
          tr("Bài tập phân tích cấu trúc câu tương tác"),
        ],
        icon: BookOpen,
      }
    }
    if (normalizedKey === "roadmap") {
      return {
        subtitle: tr(
          "Nâng cấp HanFlix Premium để định hướng lộ trình học tập cá nhân hóa theo cấp độ HSK và theo dõi sát sao tiến độ mỗi ngày.",
        ),
        benefits: [
          tr("Lộ trình thiết kế riêng theo cấp độ HSK"),
          tr("Đề xuất bài học thông minh theo sở thích"),
          tr("Theo dõi trực quan tiến độ chinh phục mục tiêu"),
        ],
        icon: Map,
      }
    }
    if (normalizedKey === "history") {
      return {
        subtitle: tr(
          "Nâng cấp HanFlix Premium để theo dõi chi tiết báo cáo giờ học, biểu đồ chuỗi streak và mức độ nắm vững từ vựng.",
        ),
        benefits: [
          tr("Thống kê chi tiết giờ học & từ vựng tích lũy"),
          tr("Biểu đồ chuỗi ngày học liên tục (Streak)"),
          tr("Phân tích điểm mạnh và kỹ năng cần cải thiện"),
        ],
        icon: History,
      }
    }
    if (normalizedKey === "exam") {
      return {
        subtitle: tr(
          "Nâng cấp HanFlix Premium để mở khóa trọn bộ ngân hàng đề thi thử HSK chuẩn cấu trúc mới, có bấm giờ và chấm điểm tự động.",
        ),
        benefits: [
          tr("Đề thi thử chuẩn cấu trúc HSK mới nhất"),
          tr("Chấm điểm tự động và xếp loại ngay lập tức"),
          tr("Giải thích chi tiết từng câu hỏi & ngữ pháp"),
        ],
        icon: GraduationCap,
      }
    }
    return {
      subtitle: tr(
        "Nâng cấp HanFlix Premium để mở khóa nội dung này, học qua video không giới hạn và nhận trợ giúp từ AI Bảo Bảo.",
      ),
      benefits: [
        tr("Xem video học không giới hạn"),
        tr("Phụ đề Chữ Hán – Pinyin – Tiếng Việt"),
        tr("AI Bảo Bảo sửa phát âm 24/7"),
      ],
      icon: Crown,
    }
  })()

  const renderGhostPreview = () => {
    if (normalizedKey === "vocabulary" || normalizedKey === "saved") {
      return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="h-6 w-48 bg-neutral-300 rounded-lg" />
              <div className="h-4 w-72 bg-neutral-200 rounded-md" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-24 bg-neutral-200 rounded-xl" />
              <div className="h-9 w-32 bg-[#B91B1C]/30 rounded-xl" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="h-24 rounded-2xl bg-white border border-[#E7E7EA] p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400 font-bold">
                  TỔNG TỪ ĐÃ LƯU
                </span>
                <BookMarked className="w-4 h-4 text-neutral-400" />
              </div>
              <span className="text-2xl font-black text-neutral-600">148</span>
            </div>
            <div className="h-24 rounded-2xl bg-white border border-[#E7E7EA] p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400 font-bold">
                  CẦN ÔN TẬP SRS
                </span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <span className="text-2xl font-black text-amber-600">18</span>
            </div>
            <div className="h-24 rounded-2xl bg-white border border-[#E7E7EA] p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400 font-bold">
                  ĐÃ THÀNH THẠO
                </span>
                <Check className="w-4 h-4 text-emerald-500" />
              </div>
              <span className="text-2xl font-black text-emerald-600">92</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              {
                hanzi: "高兴",
                pinyin: "gāoxìng",
                mean: "Vui vẻ, phấn khởi",
                level: "HSK 1",
                tag: "Stage 4",
              },
              {
                hanzi: "准备",
                pinyin: "zhǔnbèi",
                mean: "Chuẩn bị, dự định",
                level: "HSK 2",
                tag: "Stage 2",
              },
              {
                hanzi: "习惯",
                pinyin: "xíguàn",
                mean: "Thói quen, quen thuộc",
                level: "HSK 3",
                tag: "Stage 5",
              },
              {
                hanzi: "精彩",
                pinyin: "jīngcǎi",
                mean: "Đặc sắc, tuyệt vời",
                level: "HSK 4",
                tag: "Stage 3",
              },
              {
                hanzi: "深刻",
                pinyin: "shēnkè",
                mean: "Sâu sắc, ấn tượng sâu",
                level: "HSK 5",
                tag: "Stage 1",
              },
              {
                hanzi: "克服",
                pinyin: "kèfú",
                mean: "Khắc phục khó khăn",
                level: "HSK 5",
                tag: "Stage 4",
              },
            ].map((card, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[#E7E7EA] bg-white p-5 space-y-3 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-600">
                    {card.level}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                    {card.tag}
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-black text-neutral-800">
                    {card.hanzi}
                  </div>
                  <div className="text-xs text-red-700 font-medium">
                    {card.pinyin}
                  </div>
                </div>
                <div className="text-xs text-neutral-600 font-medium border-t border-neutral-100 pt-2 flex items-center justify-between">
                  <span>{card.mean}</span>
                  <Volume2 className="w-3.5 h-3.5 text-neutral-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (normalizedKey === "grammar") {
      return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="h-6 w-52 bg-neutral-300 rounded-lg" />
              <div className="h-4 w-80 bg-neutral-200 rounded-md" />
            </div>
            <div className="h-9 w-32 bg-[#B91B1C]/30 rounded-xl" />
          </div>

          <div className="flex gap-2 overflow-x-hidden">
            {[
              "Tất cả",
              "HSK 1",
              "HSK 2",
              "HSK 3",
              "HSK 4",
              "HSK 5",
              "HSK 6",
            ].map((lvl, i) => (
              <div
                key={i}
                className={`h-8 px-4 rounded-xl flex items-center text-xs font-bold ${
                  i === 0
                    ? "bg-neutral-800 text-white"
                    : "bg-neutral-200 text-neutral-600"
                }`}
              >
                {lvl}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                title: "Cấu trúc câu chữ 把 (Câu xử trí)",
                formula: "Chủ ngữ + 把 + Tân ngữ + Động từ + Thành phần khác",
                hsk: "HSK 3",
              },
              {
                title: "Phân biệt 刚 và 刚才 (Vừa mới)",
                formula: "Phó từ thời gian 刚 vs Danh từ thời gian 刚才",
                hsk: "HSK 3",
              },
              {
                title: "Câu bị động với 被 / 叫 / 让",
                formula: "Chủ ngữ + 被/叫/让 + Tân ngữ tác nhân + Động từ",
                hsk: "HSK 4",
              },
              {
                title: "Cấu trúc 连...也/都... (Ngay cả... cũng...)",
                formula: "连 + Thành phần nhấn mạnh + 也/都 + Vị ngữ",
                hsk: "HSK 4",
              },
            ].map((gm, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[#E7E7EA] bg-white p-5 space-y-2.5 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                    {gm.hsk}
                  </span>
                  <BookOpen className="w-4 h-4 text-neutral-400" />
                </div>
                <h4 className="text-base font-bold text-neutral-800">
                  {gm.title}
                </h4>
                <p className="text-xs text-neutral-500 font-mono bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                  {gm.formula}
                </p>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (normalizedKey === "roadmap") {
      return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
          <div className="h-6 w-48 bg-neutral-300 rounded-lg" />
          <div className="h-32 rounded-3xl bg-neutral-200 border border-neutral-300 flex items-center justify-around p-6">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center font-black text-neutral-500">
                  {step}
                </div>
                <div className="h-3 w-16 bg-neutral-300 rounded-full" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-44 rounded-2xl bg-white border border-[#E7E7EA] p-4" />
            <div className="h-44 rounded-2xl bg-white border border-[#E7E7EA] p-4" />
          </div>
        </div>
      )
    }

    if (normalizedKey === "history") {
      return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="h-6 w-48 bg-neutral-300 rounded-lg" />
            <div className="h-8 w-28 bg-neutral-200 rounded-xl" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="h-28 rounded-2xl bg-white border border-[#E7E7EA] p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400 font-bold">
                  THỜI GIAN ĐÃ HỌC
                </span>
                <Clock className="w-4 h-4 text-neutral-400" />
              </div>
              <span className="text-2xl font-black text-neutral-700">
                18.5 giờ
              </span>
            </div>
            <div className="h-28 rounded-2xl bg-white border border-[#E7E7EA] p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400 font-bold">
                  TỪ ĐÃ NẮM VỮNG
                </span>
                <Award className="w-4 h-4 text-amber-500" />
              </div>
              <span className="text-2xl font-black text-amber-600">340 từ</span>
            </div>
            <div className="h-28 rounded-2xl bg-white border border-[#E7E7EA] p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400 font-bold">
                  CHUỖI NGÀY HỌC
                </span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <span className="text-2xl font-black text-emerald-600">
                14 ngày
              </span>
            </div>
          </div>
          <div className="h-48 rounded-2xl bg-white border border-[#E7E7EA] p-5 shadow-xs flex items-end gap-3 justify-between">
            {[40, 65, 80, 50, 95, 85, 70].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-[#B91B1C]/20 rounded-t-lg transition-all"
                  style={{ height: `${h}%` }}
                />
                <span className="text-[10px] text-neutral-400 font-bold">
                  T{i + 2}
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (normalizedKey === "exam") {
      return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="h-6 w-52 bg-neutral-300 rounded-lg" />
            <div className="h-8 w-32 bg-neutral-200 rounded-xl" />
          </div>
          <div className="flex gap-2">
            {["HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"].map(
              (lvl, i) => (
                <div
                  key={i}
                  className={`h-8 px-4 rounded-xl flex items-center text-xs font-bold ${
                    i === 3
                      ? "bg-neutral-800 text-white"
                      : "bg-neutral-200 text-neutral-600"
                  }`}
                >
                  {lvl}
                </div>
              ),
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                name: "Đề thi thử HSK 4 - Đề số 01",
                time: "105 phút",
                questions: "100 câu",
                pass: "180/300",
              },
              {
                name: "Đề thi thử HSK 4 - Đề số 02",
                time: "105 phút",
                questions: "100 câu",
                pass: "180/300",
              },
            ].map((ex, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[#E7E7EA] bg-white p-5 space-y-3 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-700">
                    Chuẩn cấu trúc mới
                  </span>
                  <FileCheck2 className="w-4 h-4 text-neutral-400" />
                </div>
                <h4 className="text-base font-bold text-neutral-800">
                  {ex.name}
                </h4>
                <div className="flex items-center gap-4 text-xs text-neutral-500">
                  <span>{ex.time}</span>
                  <span>•</span>
                  <span>{ex.questions}</span>
                  <span>•</span>
                  <span>Điểm đạt: {ex.pass}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    // Default ghost UI
    return (
      <div className="p-6 space-y-5 max-w-5xl mx-auto">
        <div className="h-8 w-60 bg-neutral-300 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-32 rounded-2xl bg-white border border-[#E7E7EA]" />
          <div className="h-32 rounded-2xl bg-white border border-[#E7E7EA]" />
          <div className="h-32 rounded-2xl bg-white border border-[#E7E7EA]" />
        </div>
        <div className="h-64 rounded-3xl bg-white border border-[#E7E7EA]" />
      </div>
    )
  }

  const FeatureIcon = meta.icon

  return (
    <div className="relative w-full min-h-[calc(100vh-140px)] flex items-center justify-center overflow-hidden rounded-3xl">
      {/* 1. Feature Ghost Mockup in the background */}
      <div
        className="absolute inset-0 select-none pointer-events-none filter blur-[5px] opacity-25 overflow-hidden"
        aria-hidden="true"
      >
        {renderGhostPreview()}
      </div>

      {/* 2. Lớp đen mờ (Dark translucent backdrop with blur) */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer"
        onClick={() => {
          if (onNavigateFeed) onNavigateFeed()
          else navigate("/feed")
        }}
        aria-label={tr("Đóng")}
      />

      {/* 3. Centerpiece Modal Popup */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr("Cần nâng cấp tài khoản để sử dụng tính năng này")}
        className="relative z-10 w-full max-w-lg mx-4 my-6 sm:my-10 p-6 sm:p-8 rounded-[28px] bg-white border border-neutral-200/80 shadow-2xl shadow-black/50 text-center animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Close Button X */}
        <button
          type="button"
          onClick={() => {
            if (onNavigateFeed) onNavigateFeed()
            else navigate("/feed")
          }}
          aria-label={tr("Đóng")}
          title={tr("Đóng")}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-800 flex items-center justify-center transition-all cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Ambient Top Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/15 blur-2xl pointer-events-none rounded-full" />

        {/* Crown Jewel Icon */}
        <div className="relative mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFF5EB] via-[#FEE8D1] to-[#FED7AA] border-2 border-white shadow-md flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-amber-400/10 animate-ping opacity-25" />
          <Crown className="w-8 h-8 text-[#B45309] fill-[#B45309]/20" />
        </div>

        {/* Badge Pill - No trial mention */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[#B45309] text-xs font-black tracking-wider uppercase mb-3">
          <FeatureIcon className="w-3.5 h-3.5" />
          <span>{tr("Đặc quyền HanFlix Premium")}</span>
        </div>

        {/* Title: Cần nâng cấp tài khoản để sử dụng tính năng này */}
        <h2 className="text-xl sm:text-2xl font-black text-[#18181B] tracking-tight leading-snug">
          {tr("Cần nâng cấp tài khoản để sử dụng tính năng này")}
        </h2>

        {/* Subtitle */}
        <p className="mt-2.5 text-xs sm:text-sm text-[#5F6368] leading-relaxed max-w-md mx-auto">
          {meta.subtitle}
        </p>

        {/* 3 Key Feature Bullets */}
        <div className="mt-5 space-y-2.5 text-left bg-[#FBFBFC] rounded-2xl border border-[#E7E7EA] p-4 text-xs sm:text-sm text-[#3F3F46]">
          {meta.benefits.map((benefit, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </div>
              <span className="font-semibold text-neutral-800">{benefit}</span>
            </div>
          ))}
        </div>

        {/* CTA Button Row */}
        <div className="mt-6 space-y-3">
          <Link
            to="/premium"
            className="w-full rounded-2xl bg-gradient-to-r from-[#DC2626] via-[#B91B1C] to-[#991B1B] hover:from-[#EF4444] hover:to-[#B91B1C] py-3.5 px-5 text-sm sm:text-base font-black text-white shadow-lg shadow-red-950/25 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 group"
          >
            <span>{tr("Nâng cấp ngay")}</span>
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </div>
          </Link>

          <button
            type="button"
            onClick={() => {
              if (onNavigateFeed) onNavigateFeed()
              else navigate("/feed")
            }}
            className="text-xs font-bold text-[#5F6368] hover:text-[#18181B] transition-colors py-1 cursor-pointer"
          >
            {tr("Quay lại Bảng tin")}
          </button>
        </div>

        {/* Reassurance Footer */}
        <div className="mt-4 pt-3 border-t border-[#F0F0F2] flex items-center justify-center gap-4 text-[11px] text-[#8B9097] font-medium">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{tr("Thanh toán PayOS an toàn")}</span>
          </span>
          <span className="text-neutral-300">•</span>
          <span>{tr("Không tự động gia hạn")}</span>
        </div>
      </div>
    </div>
  )
}
