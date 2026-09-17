import React, { useState, useEffect } from 'react';
import { Play, Eye, Clock, Sparkles, BookOpenCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { VideoLesson, HERO_LESSON, RIGHT_RAIL_LESSON, RECOMMENDATION_LESSONS } from '../data/hanflixData';
import { useLanguage } from '../i18n';

interface HeroSectionProps {
  onSelectLesson: (lesson: VideoLesson) => void;
  onStartPractice?: (lesson?: VideoLesson) => void;
}

export default function HeroSection({ onSelectLesson, onStartPractice }: HeroSectionProps) {
  const { t } = useLanguage();

  // Curated spotlight lessons for hero switcher
  const spotlightLessons: VideoLesson[] = [
    HERO_LESSON,
    RECOMMENDATION_LESSONS[4] || HERO_LESSON, // Phỏng vấn xin việc
    RIGHT_RAIL_LESSON, // Đặt phòng khách sạn
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentHero = spotlightLessons[currentIndex] || HERO_LESSON;

  // Key vocabularies preview for spotlight
  const vocabMap: Record<string, string[]> = {
    '17': ['点菜 (Gọi món)', '烤鸭 (Vịt quay)', '微辣 (Cay nhẹ)', '买单 (Tính tiền)'],
    '21': ['自我介绍 (Tự giới thiệu)', '工作经验 (Kinh nghiệm)', '期望薪资 (Kỳ vọng lương)'],
    '19': ['预订 (Đặt trước)', '入住 (Check-in)', '押金 (Tiền cọc)', '护照 (Hộ chiếu)'],
  };

  const currentVocab = vocabMap[currentHero.id] || ['Từ vựng phản xạ trọng tâm'];

  // Right rail complementary lessons
  const sideLessons = spotlightLessons.filter((l) => l.id !== currentHero.id).slice(0, 2);

  // Auto cycle spotlight every 8 seconds (can be paused on hover)
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % spotlightLessons.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [isPaused, spotlightLessons.length]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
      {/* Main Hero Spotlight Showcase (~73% width = 8/12 or 9/12) */}
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="lg:col-span-8 xl:col-span-9 relative rounded-2xl md:rounded-3xl overflow-hidden group shadow-sm hover:shadow-md transition-all duration-300 min-h-[320px] md:min-h-[350px] flex flex-col justify-end bg-neutral-950 border border-[#E7E7EA]"
      >
        {/* Background Image with smooth transition */}
        <img
          key={currentHero.id}
          src={currentHero.thumbnail}
          alt={currentHero.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-103 transition-transform duration-700 opacity-75"
        />

        {/* Ambient Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent" />

        {/* Chinese Calligraphy Watermark in background */}
        <div className="absolute right-6 top-6 text-white/10 text-6xl md:text-8xl font-black pointer-events-none select-none font-mono tracking-widest hidden sm:block">
          {currentHero.chineseTitle}
        </div>

        {/* Top Badges & Spotlight Index Switcher */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#B91B1C] text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 fill-white" />
              <span>TIÊU ĐIỂM</span>
            </span>
            <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-bold">
              {currentHero.hskLevel}
            </span>
            <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-medium hidden sm:inline">
              {currentHero.category}
            </span>
          </div>

          {/* Carousel Next / Prev Controls & Indicators */}
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev - 1 + spotlightLessons.length) % spotlightLessons.length);
              }}
              aria-label="Bài trước"
              className="w-6 h-6 rounded-full hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 px-1">
              {spotlightLessons.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === currentIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'
                  }`}
                  aria-label={`Chuyển đến tiêu điểm ${idx + 1}`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev + 1) % spotlightLessons.length);
              }}
              aria-label="Bài tiếp theo"
              className="w-6 h-6 rounded-full hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Box */}
        <div className="relative z-10 p-5 md:p-7 text-white space-y-3">
          <div>
            <div className="text-amber-400 font-mono text-xs sm:text-sm font-bold tracking-wide">
              {currentHero.chineseTitle} {currentHero.pinyinTitle ? `• ${currentHero.pinyinTitle}` : ''}
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight drop-shadow-sm mt-1">
              {currentHero.title}
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-neutral-300 max-w-2xl line-clamp-2 leading-relaxed font-medium">
              {currentHero.subtitle}
            </p>
          </div>

          {/* Key Vocab Preview Tag Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-bold mr-1">
              Từ vựng trọng tâm:
            </span>
            {currentVocab.map((voc, vIdx) => (
              <span
                key={vIdx}
                className="px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-white text-xs font-medium border border-white/10"
              >
                {voc}
              </span>
            ))}
          </div>

          {/* Action Row */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              {/* Watch Video Button */}
              <button
                type="button"
                onClick={() => onSelectLesson(currentHero)}
                className="h-11 px-5 sm:px-6 rounded-full bg-white text-neutral-900 font-bold text-xs sm:text-sm flex items-center gap-2.5 hover:bg-[#FDF1F1] hover:text-[#B91B1C] transition-all shadow-md active:scale-98 cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-[#B91B1C] text-white flex items-center justify-center">
                  <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                </div>
                <span>{t.feed.watchNow}</span>
              </button>

              {/* Quick Practice Launcher Button with new Study Icon */}
              {onStartPractice && (
                <button
                  type="button"
                  onClick={() => onStartPractice(currentHero)}
                  className="h-11 px-4 sm:px-5 rounded-full bg-white/15 backdrop-blur-md hover:bg-white/25 text-white font-bold text-xs sm:text-sm flex items-center gap-2 border border-white/20 transition-all active:scale-98 cursor-pointer"
                  title="Mở bộ luyện tập Quizlet & Flashcard 3D"
                >
                  <BookOpenCheck className="w-4 h-4 text-amber-400" />
                  <span>Luyện tập Quizlet</span>
                </button>
              )}
            </div>

            {/* Video Stats */}
            <div className="flex items-center gap-4 text-xs font-medium text-neutral-300">
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-neutral-400" />
                <span>{currentHero.viewCount} {t.watch.views}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-neutral-400" />
                <span>{currentHero.duration}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Rail Next-in-Queue Mini Cards (~27% width = 3/4 cols) */}
      <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-4">
        {sideLessons.map((lesson) => (
          <div
            key={lesson.id}
            onClick={() => onSelectLesson(lesson)}
            className="flex-1 relative rounded-2xl md:rounded-3xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-md transition-all duration-200 min-h-[150px] flex flex-col justify-between p-4 bg-neutral-950 border border-[#E7E7EA]"
          >
            <img
              src={lesson.thumbnail}
              alt={lesson.title}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-70"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

            {/* Top badge */}
            <div className="relative z-10 flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-white text-[11px] font-bold">
                {lesson.hskLevel} • {lesson.category}
              </span>
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-[#B91B1C] transition-colors">
                <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
              </div>
            </div>

            {/* Bottom Content */}
            <div className="relative z-10 text-white space-y-1">
              <span className="text-[11px] text-amber-300 font-mono font-medium block">
                {lesson.chineseTitle}
              </span>
              <h3 className="text-sm font-extrabold text-white leading-snug line-clamp-1 group-hover:text-amber-200 transition-colors">
                {lesson.title}
              </h3>
              <div className="flex items-center gap-3 text-[11px] text-neutral-300">
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {lesson.viewCount}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {lesson.duration}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
