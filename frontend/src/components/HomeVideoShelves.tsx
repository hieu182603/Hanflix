import React, { useState } from 'react';
import { Play, Eye, Clock, Sparkles, BookOpenCheck, Flame, ChevronRight, TrendingUp, Utensils, Briefcase, Zap } from 'lucide-react';
import { VideoLesson, RECOMMENDATION_LESSONS } from '../data/hanflixData';

interface HomeVideoShelvesProps {
  onSelectLesson: (lesson: VideoLesson) => void;
  onStartPractice?: (lesson?: VideoLesson) => void;
}

export default function HomeVideoShelves({ onSelectLesson, onStartPractice }: HomeVideoShelvesProps) {
  const [selectedHskTab, setSelectedHskTab] = useState<string>('all');

  // Categorize lessons
  const trendingLessons = [
    RECOMMENDATION_LESSONS[0], // Gọi món
    RECOMMENDATION_LESSONS[4], // Phỏng vấn
    RECOMMENDATION_LESSONS[2], // Đặt phòng
    RECOMMENDATION_LESSONS[1], // Rủ bạn xem phim
  ].filter(Boolean);

  const foodAndLifeLessons = RECOMMENDATION_LESSONS.filter(
    (l) => l.category === 'Ẩm thực' || l.category === 'Đời sống' || l.tags?.includes('Ẩm thực')
  );

  const businessLessons = RECOMMENDATION_LESSONS.filter(
    (l) => l.category === 'Kinh doanh' || l.tags?.includes('Kinh doanh')
  );

  const shortLessons = RECOMMENDATION_LESSONS.filter((l) => {
    const parts = l.duration.split(':');
    const mins = parseInt(parts[0], 10);
    return mins < 3;
  });

  const hskFilteredLessons = RECOMMENDATION_LESSONS.filter((l) => {
    if (selectedHskTab === 'all') return true;
    return l.hskLevel.toLowerCase() === selectedHskTab.toLowerCase();
  });

  const renderVideoCard = (lesson: VideoLesson, rankBadge?: number) => (
    <div
      key={lesson.id}
      onClick={() => onSelectLesson(lesson)}
      className="group relative flex flex-col bg-white rounded-2xl md:rounded-3xl border border-[#E7E7EA] overflow-hidden hover:shadow-lg hover:border-neutral-300 transition-all duration-200 cursor-pointer"
    >
      {/* Thumbnail Aspect Ratio Box */}
      <div className="relative aspect-video w-full overflow-hidden bg-neutral-900">
        <img
          src={lesson.thumbnail}
          alt={lesson.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Top Rank or HSK Badge */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
          {rankBadge != null && (
            <span
              className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shadow-md ${
                rankBadge === 1
                  ? 'bg-amber-400 text-neutral-900'
                  : rankBadge === 2
                  ? 'bg-neutral-200 text-neutral-900'
                  : rankBadge === 3
                  ? 'bg-amber-700 text-white'
                  : 'bg-black/60 backdrop-blur-md text-white'
              }`}
            >
              #{rankBadge}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-lg bg-black/65 backdrop-blur-md text-white text-[11px] font-bold">
            {lesson.hskLevel}
          </span>
        </div>

        {/* Duration badge */}
        <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-white text-[11px] font-mono font-medium">
          {lesson.duration}
        </span>

        {/* Play Overlay Button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20 backdrop-blur-[2px]">
          <div className="w-12 h-12 rounded-full bg-[#B91B1C] text-white flex items-center justify-center shadow-xl transform scale-75 group-hover:scale-100 transition-transform duration-200">
            <Play className="w-5 h-5 fill-white ml-0.5" />
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-2.5">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
            <span className="text-[#B91B1C] font-semibold">{lesson.category}</span>
            <span>•</span>
            <span className="font-mono">{lesson.chineseTitle}</span>
          </div>

          <h3 className="font-extrabold text-sm sm:text-base text-neutral-900 leading-snug line-clamp-1 mt-1 group-hover:text-[#B91B1C] transition-colors">
            {lesson.title}
          </h3>

          <p className="text-xs text-neutral-600 line-clamp-2 mt-1 leading-relaxed">
            {lesson.subtitle}
          </p>
        </div>

        {/* Footer Meta & Quick Practice Action */}
        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-neutral-400" />
              <span>{lesson.viewCount}</span>
            </span>
          </div>

          {onStartPractice && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStartPractice(lesson);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 font-bold text-[11px] transition-colors cursor-pointer"
              title="Luyện tập trắc nghiệm & flashcard"
            >
              <BookOpenCheck className="w-3.5 h-3.5 text-amber-700" />
              <span>Luyện tập</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 mt-6">
      {/* SHELF 1: TRENDING NOW (Thịnh hành) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
                Thịnh hành & Được học nhiều nhất
              </h2>
              <p className="text-xs text-neutral-500">Các video tình huống thực tế có lượt xem và ôn tập cao nhất tuần qua</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {trendingLessons.map((lesson, idx) => renderVideoCard(lesson, idx + 1))}
        </div>
      </section>

      {/* SHELF 2: BITE-SIZED SHORTS (< 3 min) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 flex items-center justify-center">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-neutral-900 tracking-tight">
                Phản xạ cấp tốc (Dưới 3 phút)
              </h2>
              <p className="text-xs text-neutral-500">Phù hợp học nhanh khi rảnh, tập trung vào cấu trúc câu phản xạ trực diện</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {shortLessons.map((lesson) => renderVideoCard(lesson))}
        </div>
      </section>

      {/* SHELF 3: FOOD & CULTURE (Ẩm thực & Đời sống) */}
      {foodAndLifeLessons.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/80 text-orange-700 flex items-center justify-center">
                <Utensils className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-neutral-900 tracking-tight">
                  Tình huống Ẩm thực & Nhà hàng
                </h2>
                <p className="text-xs text-neutral-500">Từ gọi món, dặn khẩu vị đến thanh toán hóa đơn bằng tiếng Trung bản xứ</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {foodAndLifeLessons.map((lesson) => renderVideoCard(lesson))}
          </div>
        </section>
      )}

      {/* SHELF 4: BUSINESS & WORKPLACE (Kinh doanh & Phỏng vấn) */}
      {businessLessons.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-700 flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-neutral-900 tracking-tight">
                  Tiếng Trung Thương mại & Công sở
                </h2>
                <p className="text-xs text-neutral-500">Giao tiếp đối tác, gửi email, phỏng vấn xin việc và đàm phán</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {businessLessons.map((lesson) => renderVideoCard(lesson))}
          </div>
        </section>
      )}

      {/* SHELF 5: HSK EXPLORER WITH PILL TABS */}
      <section className="space-y-4 bg-white rounded-3xl border border-[#E7E7EA] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-neutral-900 tracking-tight">
              Khám phá bài học theo chứng chỉ HSK
            </h2>
            <p className="text-xs text-neutral-500">Lựa chọn bài học video bám sát theo khung từ vựng HSK 1 đến HSK 9</p>
          </div>

          {/* Level Switcher Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto bg-neutral-100 p-1 rounded-2xl border border-neutral-200/60 no-scrollbar shrink-0">
            {['all', 'hsk 1', 'hsk 2', 'hsk 3', 'hsk 4', 'hsk 5', 'hsk 6', 'hsk 7', 'hsk 8', 'hsk 9'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setSelectedHskTab(lvl)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                  selectedHskTab === lvl
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {lvl === 'all' ? 'Tất cả' : lvl.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {hskFilteredLessons.slice(0, 4).map((lesson) => renderVideoCard(lesson))}
        </div>
      </section>
    </div>
  );
}
