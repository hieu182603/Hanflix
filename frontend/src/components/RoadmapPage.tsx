import React, { useState } from 'react';
import {
  Map,
  CheckCircle2,
  Lock,
  ArrowRight,
  Zap,
  Target,
  Clock,
  Flame,
  BookOpen,
  Sparkles,
  Calendar,
  ChevronRight,
  Play,
  Award,
} from 'lucide-react';

export interface RoadmapPageProps {
  onSelectLesson?: (lessonId: string) => void;
  onStartPractice?: () => void;
}

interface ModuleTopic {
  id: string;
  nameVi: string;
  progress: number;
  status: 'completed' | 'in_progress' | 'not_started';
}

interface RoadmapStage {
  id: string;
  level: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'locked';
  progress: number;
  wordCount: string;
  grammarCount: string;
  topics: ModuleTopic[];
}

export default function RoadmapPage({
  onSelectLesson,
  onStartPractice,
}: RoadmapPageProps) {
  const [selectedStageId, setSelectedStageId] = useState<string>('hsk3');

  // Realistic Roadmap Stages adhering strictly to HanFlix guidelines
  const stages: RoadmapStage[] = [
    {
      id: 'hsk1',
      level: 'HSK 1',
      title: 'Nhập môn Giao tiếp & Pinyin',
      description: 'Làm quen bảng chữ cái Pinyin, phát âm chuẩn thanh điệu, chào hỏi và xưng hô thường nhật.',
      status: 'completed',
      progress: 100,
      wordCount: '150 từ',
      grammarCount: '15 cấu trúc',
      topics: [
        { id: 't1-1', nameVi: 'Chào hỏi & Giới thiệu bản thân', progress: 100, status: 'completed' },
        { id: 't1-2', nameVi: 'Con số, Mua sắm cơ bản & Hỏi giá', progress: 100, status: 'completed' },
        { id: 't1-3', nameVi: 'Thời gian, Lịch hẹn & Thời tiết', progress: 100, status: 'completed' },
      ],
    },
    {
      id: 'hsk2',
      level: 'HSK 2',
      title: 'Sơ cấp Đời sống & Du lịch',
      description: 'Giao tiếp tình huống hàng ngày, đi lại phương tiện công cộng, gọi món và sở thích cá nhân.',
      status: 'completed',
      progress: 100,
      wordCount: '300 từ',
      grammarCount: '28 cấu trúc',
      topics: [
        { id: 't2-1', nameVi: 'Giao thông, Đi tàu cao tốc & Sân bay', progress: 100, status: 'completed' },
        { id: 't2-2', nameVi: 'Thói quen sinh hoạt & Hoạt động cuối tuần', progress: 100, status: 'completed' },
        { id: 't2-3', nameVi: 'Ăn uống, Gọi món tại quán ăn bình dân', progress: 100, status: 'completed' },
      ],
    },
    {
      id: 'hsk3',
      level: 'HSK 3',
      title: 'Trung cấp Thương mại & Du lịch',
      description: 'Nắm vững đàm phán nhẹ, xử lý đặt phòng khách sạn, giao tiếp công sở và phỏng vấn xin việc.',
      status: 'in_progress',
      progress: 71,
      wordCount: '600 từ',
      grammarCount: '45 cấu trúc',
      topics: [
        { id: 't3-1', nameVi: 'Gọi món nhà hàng đặc sản & Phong vị vùng miền', progress: 100, status: 'completed' },
        { id: 't3-2', nameVi: 'Đặt phòng, Check-in & Yêu cầu dịch vụ khách sạn', progress: 100, status: 'completed' },
        { id: 't3-3', nameVi: 'Phỏng vấn xin việc & Viết email công việc', progress: 50, status: 'in_progress' },
        { id: 't3-4', nameVi: 'Thương lượng giá cả & Hợp đồng cơ bản', progress: 0, status: 'not_started' },
      ],
    },
    {
      id: 'hsk4',
      level: 'HSK 4',
      title: 'Cao cấp Công việc & Doanh nghiệp',
      description: 'Tranh luận chủ đề phức tạp, thuyết trình báo cáo kinh doanh, trao đổi chuyên sâu với đối tác.',
      status: 'locked',
      progress: 0,
      wordCount: '1.200 từ',
      grammarCount: '65 cấu trúc',
      topics: [
        { id: 't4-1', nameVi: 'Thuyết trình kế hoạch kinh doanh', progress: 0, status: 'not_started' },
        { id: 't4-2', nameVi: 'Đàm phán điều khoản hợp đồng thương mại', progress: 0, status: 'not_started' },
        { id: 't4-3', nameVi: 'Xử lý tình huống phát sinh & Khủng hoảng', progress: 0, status: 'not_started' },
      ],
    },
    {
      id: 'hsk5',
      level: 'HSK 5',
      title: 'Chuyên sâu Văn hóa & Báo chí',
      description: 'Đọc hiểu báo chí Trung văn, xem phim truyền hình không cần phụ đề, viết luận văn chuyên ngành.',
      status: 'locked',
      progress: 0,
      wordCount: '2.500 từ',
      grammarCount: '80 cấu trúc',
      topics: [
        { id: 't5-1', nameVi: 'Điện ảnh & Nghệ thuật biểu diễn Trung Hoa', progress: 0, status: 'not_started' },
        { id: 't5-2', nameVi: 'Phân tích báo cáo tài chính & Thị trường', progress: 0, status: 'not_started' },
      ],
    },
    {
      id: 'hsk6',
      level: 'HSK 6',
      title: 'Thành thạo Toàn diện & Luận thuyết',
      description: 'Diễn đạt tự nhiên như người bản xứ trong mọi hoàn cảnh, đọc hiểu tác phẩm văn học cổ điển và hiện đại.',
      status: 'locked',
      progress: 0,
      wordCount: '5.000 từ',
      grammarCount: '100 cấu trúc',
      topics: [
        { id: 't6-1', nameVi: 'Văn học cổ điển & Thành ngữ Hán tự', progress: 0, status: 'not_started' },
        { id: 't6-2', nameVi: 'Diễn thuyết & Phản biện học thuật chuyên sâu', progress: 0, status: 'not_started' },
      ],
    },
    {
      id: 'hsk7',
      level: 'HSK 7',
      title: 'Biên phiên dịch & Chuyên gia Học thuật',
      description: 'Thuộc phân cấp HSK 3.0 cao cấp, làm chủ các chủ đề liên ngành: ngoại giao, luật pháp, khoa học kỹ thuật.',
      status: 'locked',
      progress: 0,
      wordCount: '8.000 từ',
      grammarCount: '120 cấu trúc',
      topics: [
        { id: 't7-1', nameVi: 'Dịch thuật văn bản pháp quy & Ngoại giao', progress: 0, status: 'not_started' },
        { id: 't7-2', nameVi: 'Hội thảo khoa học công nghệ quốc tế', progress: 0, status: 'not_started' },
      ],
    },
    {
      id: 'hsk8',
      level: 'HSK 8',
      title: 'Nghiên cứu Sâu & Bậc thầy Ngôn ngữ',
      description: 'Phân tích tư tưởng triết học, phong tục cổ truyền, khả năng đối thoại song phương cấp cao.',
      status: 'locked',
      progress: 0,
      wordCount: '10.000 từ',
      grammarCount: '140 cấu trúc',
      topics: [
        { id: 't8-1', nameVi: 'Triết học cổ đại & Văn học đương đại', progress: 0, status: 'not_started' },
        { id: 't8-2', nameVi: 'Đàm phán đa phương cấp cao', progress: 0, status: 'not_started' },
      ],
    },
    {
      id: 'hsk9',
      level: 'HSK 9',
      title: 'Đỉnh cao Học thuật & Bản địa hóa Toàn diện',
      description: 'Cấp độ cao nhất của hệ thống HSK 3.0, năng lực sử dụng tiếng Trung hoàn mỹ ở tầm chuyên gia quốc tế.',
      status: 'locked',
      progress: 0,
      wordCount: '11.000+ từ',
      grammarCount: '160 cấu trúc',
      topics: [
        { id: 't9-1', nameVi: 'Xuất bản công trình nghiên cứu tiếng Trung', progress: 0, status: 'not_started' },
        { id: 't9-2', nameVi: 'Phiên dịch cabin đồng thời cấp nguyên thủ', progress: 0, status: 'not_started' },
      ],
    },
  ];

  // Days of week tracking data
  const weekDays = [
    { day: 'T2', name: 'Thứ 2', done: true },
    { day: 'T3', name: 'Thứ 3', done: true },
    { day: 'T4', name: 'Thứ 4', done: true },
    { day: 'T5', name: 'Thứ 5', done: true },
    { day: 'T6', name: 'Thứ 6', done: true },
    { day: 'T7', name: 'Thứ 7', done: false, isToday: true },
    { day: 'CN', name: 'Chủ nhật', done: false },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Banner — Crisp White with HanFlix Styling */}
      <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA] shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#B91B1C] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Map className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-black text-[#18181B] tracking-tight">
                  Lộ Trình Học Cá Nhân Hóa
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-[#FDF1F1] text-[#B91B1C] text-[11px] font-black uppercase tracking-wider">
                  Chinh phục HSK 3
                </span>
              </div>
              <p className="text-xs text-[#5F6368] mt-1.5 max-w-2xl leading-relaxed">
                Kế hoạch học tập từng chặng bài bản theo mục tiêu tiếng Trung Thương mại & Giao tiếp đời sống của bạn.
              </p>
            </div>
          </div>

          {/* Quick Metrics Indicators */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 bg-[#F7F7F9] px-3.5 py-2 rounded-2xl border border-[#E7E7EA] text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[#18181B]">
                <Target className="w-4 h-4 text-[#B91B1C]" />
                <span>Mục tiêu:</span>
                <span className="text-[#B91B1C]">HSK 3</span>
              </div>
              <div className="w-px h-4 bg-[#E7E7EA]" />
              <div className="flex items-center gap-1.5 font-bold text-[#18181B]">
                <Clock className="w-4 h-4 text-[#188A5A]" />
                <span>Tiến độ:</span>
                <span className="text-[#188A5A]">71%</span>
              </div>
              <div className="w-px h-4 bg-[#E7E7EA]" />
              <div className="flex items-center gap-1.5 font-bold text-[#18181B]">
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                <span>Chuỗi:</span>
                <span className="text-orange-600">12 ngày</span>
              </div>
            </div>

            <button
              onClick={() => {
                if (onSelectLesson) onSelectLesson('17');
                else if (onStartPractice) onStartPractice();
              }}
              className="h-10 px-5 rounded-2xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Tiếp tục học</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Workspace Layout: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Columns: Vertical Stage Progression Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-black text-[#18181B] flex items-center gap-2">
              <span>Các Chặng Chinh Phục</span>
              <span className="text-xs font-semibold text-[#8B9097]">(2/9 chặng hoàn thành)</span>
            </h2>
          </div>

          <div className="relative pl-6 sm:pl-8 space-y-4">
            {/* Continuous Vertical Timeline Line */}
            <div className="absolute left-2.5 sm:left-3.5 top-5 bottom-6 w-0.5 bg-[#E7E7EA]" />

            {stages.map((stage) => {
              const isCompleted = stage.status === 'completed';
              const isInProgress = stage.status === 'in_progress';
              const isLocked = stage.status === 'locked';

              return (
                <div key={stage.id} className="relative">
                  {/* Timeline Milestone Dot */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-5 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                      isCompleted
                        ? 'bg-[#188A5A] border-[#188A5A] text-white'
                        : isInProgress
                        ? 'bg-white border-[#B91B1C] text-[#B91B1C] shadow-sm'
                        : 'bg-[#F7F7F9] border-[#E7E7EA] text-[#8B9097]'
                    }`}
                  >
                    {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {isInProgress && <div className="w-2 h-2 rounded-full bg-[#B91B1C]" />}
                    {isLocked && <Lock className="w-2.5 h-2.5 text-[#8B9097]" />}
                  </div>

                  {/* Stage Card */}
                  <div
                    onClick={() => {
                      if (!isLocked) setSelectedStageId(stage.id);
                    }}
                    className={`rounded-3xl p-5 sm:p-6 transition-all bg-white border ${
                      isInProgress
                        ? 'border-[#B91B1C] shadow-md ring-1 ring-[#B91B1C]/20'
                        : isCompleted
                        ? 'border-[#E7E7EA] hover:border-[#188A5A]/50'
                        : 'border-[#E7E7EA] opacity-75 bg-[#F7F7F9]/60'
                    }`}
                  >
                    {/* Top Row: Title, Level & Status Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                              isCompleted
                                ? 'bg-[#E4F6ED] text-[#188A5A]'
                                : isInProgress
                                ? 'bg-[#FDF1F1] text-[#B91B1C]'
                                : 'bg-[#E7E7EA] text-[#5F6368]'
                            }`}
                          >
                            {stage.level}
                          </span>
                          <h3 className="text-lg font-black text-[#18181B] tracking-tight">
                            {stage.title}
                          </h3>
                        </div>
                        <p className="text-xs text-[#5F6368] mt-1 leading-relaxed">
                          {stage.description}
                        </p>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0 flex items-center gap-2">
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E4F6ED] text-[#188A5A]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>100% Hoàn thành</span>
                          </span>
                        )}
                        {isInProgress && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FDF1F1] text-[#B91B1C]">
                            <Zap className="w-3.5 h-3.5 fill-[#B91B1C]" />
                            <span>{stage.progress}% Đang học</span>
                          </span>
                        )}
                        {isLocked && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#F7F7F9] border border-[#E7E7EA] text-[#8B9097]">
                            <Lock className="w-3 h-3" />
                            <span>Chưa mở</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar (Visible for In-Progress) */}
                    {isInProgress && (
                      <div className="mt-4 pt-4 border-t border-[#E7E7EA]">
                        <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                          <span className="text-[#5F6368]">Tiến độ bài học chặng này:</span>
                          <span className="text-[#B91B1C]">{stage.progress}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#F7F7F9] border border-[#E7E7EA] overflow-hidden">
                          <div
                            className="h-full bg-[#B91B1C] rounded-full transition-all duration-500"
                            style={{ width: `${stage.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Topics / Modules Breakdown */}
                    <div className="mt-4 pt-4 border-t border-[#E7E7EA] space-y-2.5">
                      <div className="text-[11px] font-bold text-[#8B9097] uppercase tracking-wider">
                        Chủ đề trọng tâm ({stage.wordCount} · {stage.grammarCount})
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {stage.topics.map((topic) => (
                          <div
                            key={topic.id}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-colors ${
                              topic.status === 'completed'
                                ? 'bg-[#F7F7F9]/80 border-[#E7E7EA] text-[#18181B]'
                                : topic.status === 'in_progress'
                                ? 'bg-[#FDF1F1]/50 border-[#B91B1C]/30 text-[#18181B]'
                                : 'bg-transparent border-[#E7E7EA] text-[#8B9097]'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              {topic.status === 'completed' ? (
                                <CheckCircle2 className="w-4 h-4 text-[#188A5A] shrink-0" />
                              ) : topic.status === 'in_progress' ? (
                                <span className="w-2 h-2 rounded-full bg-[#B91B1C] shrink-0" />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-[#8B9097] shrink-0" />
                              )}
                              <span className="truncate font-medium">{topic.nameVi}</span>
                            </div>

                            <span
                              className={`text-[10px] font-bold shrink-0 ${
                                topic.status === 'completed'
                                  ? 'text-[#188A5A]'
                                  : topic.status === 'in_progress'
                                  ? 'text-[#B91B1C]'
                                  : 'text-[#8B9097]'
                              }`}
                            >
                              {topic.progress}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Active Action Button */}
                    {isInProgress && (
                      <div className="mt-5 flex justify-end">
                        <button
                          onClick={() => {
                            if (onSelectLesson) onSelectLesson('17');
                            else if (onStartPractice) onStartPractice();
                          }}
                          className="h-10 px-5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                        >
                          <span>Tiếp tục bài học</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Column: Clean Sidebar Widgets */}
        <div className="space-y-6">
          {/* Widget 1: Kế hoạch học tập tuần này */}
          <div className="bg-white rounded-3xl p-5 border border-[#E7E7EA] shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#B91B1C]" />
                <h3 className="text-sm font-black text-[#18181B]">Kế hoạch học tuần này</h3>
              </div>
              <span className="text-[11px] font-bold text-[#188A5A] bg-[#E4F6ED] px-2 py-0.5 rounded-full">
                5/7 ngày
              </span>
            </div>

            {/* Days row */}
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {weekDays.map((w) => (
                <div
                  key={w.day}
                  className={`p-2 rounded-xl flex flex-col items-center gap-1 border transition-all ${
                    w.done
                      ? 'bg-[#E4F6ED]/70 border-[#188A5A]/30 text-[#188A5A]'
                      : w.isToday
                      ? 'bg-[#FDF1F1] border-[#B91B1C] text-[#B91B1C] font-bold'
                      : 'bg-[#F7F7F9] border-[#E7E7EA] text-[#8B9097]'
                  }`}
                >
                  <span className="text-[10px] font-bold">{w.day}</span>
                  {w.done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#188A5A]" />
                  ) : w.isToday ? (
                    <div className="w-2 h-2 rounded-full bg-[#B91B1C]" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E7E7EA]" />
                  )}
                </div>
              ))}
            </div>

            {/* Daily Goal Status */}
            <div className="pt-3 border-t border-[#E7E7EA] flex items-center justify-between text-xs">
              <span className="text-[#5F6368]">Mục tiêu hôm nay:</span>
              <span className="font-bold text-[#188A5A]">15 / 15 phút (Đạt)</span>
            </div>
          </div>

          {/* Widget 2: Kỹ năng trọng tâm HSK 3 */}
          <div className="bg-white rounded-3xl p-5 border border-[#E7E7EA] shadow-2xs space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#B91B1C]" />
              <h3 className="text-sm font-black text-[#18181B]">Kỹ năng trọng tâm HSK 3</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-bold text-[#18181B] mb-1">
                  <span>Nghe hiểu video hội thoại</span>
                  <span className="text-[#188A5A]">80%</span>
                </div>
                <div className="w-full h-1.5 bg-[#F7F7F9] rounded-full overflow-hidden border border-[#E7E7EA]">
                  <div className="h-full bg-[#188A5A] rounded-full" style={{ width: '80%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-bold text-[#18181B] mb-1">
                  <span>Từ vựng thương mại & du lịch</span>
                  <span className="text-[#B91B1C]">71%</span>
                </div>
                <div className="w-full h-1.5 bg-[#F7F7F9] rounded-full overflow-hidden border border-[#E7E7EA]">
                  <div className="h-full bg-[#B91B1C] rounded-full" style={{ width: '71%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-bold text-[#18181B] mb-1">
                  <span>Ngữ pháp & Mẫu câu ghép</span>
                  <span className="text-amber-600">65%</span>
                </div>
                <div className="w-full h-1.5 bg-[#F7F7F9] rounded-full overflow-hidden border border-[#E7E7EA]">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '65%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-bold text-[#18181B] mb-1">
                  <span>Phản xạ đàm thoại tình huống</span>
                  <span className="text-blue-600">60%</span>
                </div>
                <div className="w-full h-1.5 bg-[#F7F7F9] rounded-full overflow-hidden border border-[#E7E7EA]">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '60%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Widget 3: Gợi ý bài học tiếp theo (Next Up) */}
          <div className="bg-white rounded-3xl p-5 border border-[#E7E7EA] shadow-2xs space-y-3">
            <div className="text-[11px] font-bold text-[#8B9097] uppercase tracking-wider">
              Bài học đề xuất tiếp theo
            </div>

            <div className="rounded-2xl overflow-hidden border border-[#E7E7EA] group">
              <div
                className="h-32 bg-cover bg-center relative"
                style={{
                  backgroundImage: `url('https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=600&auto=format&fit=crop&q=80')`,
                }}
              >
                <div className="absolute inset-0 bg-black/35 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-[#B91B1C] text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                </div>
                <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-bold">
                  3:45
                </span>
              </div>

              <div className="p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#B91B1C]">
                  <span>HSK 3</span>
                  <span>•</span>
                  <span>Ẩm thực & Nhà hàng</span>
                </div>
                <h4 className="text-xs font-black text-[#18181B] line-clamp-1 group-hover:text-[#B91B1C] transition-colors">
                  Gọi món đặc sản tại nhà hàng Bắc Kinh
                </h4>
                <p className="text-[11px] text-[#5F6368] line-clamp-1">
                  Cách dùng từ 服务员, 点菜, 烤鸭 trong thực tế
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (onSelectLesson) onSelectLesson('17');
                else if (onStartPractice) onStartPractice();
              }}
              className="w-full h-9 rounded-xl border border-[#E7E7EA] hover:border-[#B91B1C] bg-[#F7F7F9] hover:bg-[#FDF1F1] text-xs font-bold text-[#18181B] hover:text-[#B91B1C] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Vào học ngay</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
