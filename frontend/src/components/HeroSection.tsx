import React from 'react';
import { Play, Eye, Clock, Sparkles } from 'lucide-react';
import { VideoLesson, HERO_LESSON, RIGHT_RAIL_LESSON } from '../data/hanflixData';
import { useLanguage } from '../i18n';

interface HeroSectionProps {
  onSelectLesson: (lesson: VideoLesson) => void;
}

export default function HeroSection({ onSelectLesson }: HeroSectionProps) {
  const { t } = useLanguage();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
      {/* Main Hero Media Card (~73% width = 8.8/12 = 9 cols) */}
      <div
        onClick={() => onSelectLesson(HERO_LESSON)}
        className="lg:col-span-8 xl:col-span-9 relative rounded-2xl md:rounded-3xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-md transition-all duration-200 min-h-[290px] md:min-h-[310px] flex flex-col justify-end bg-slate-900 border border-[#E7E7EA]"
      >
        {/* Background Image */}
        <img
          src={HERO_LESSON.thumbnail}
          alt={HERO_LESSON.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        {/* Chinese character watermark background effect */}
        <div className="absolute right-8 top-4 text-white/10 text-7xl md:text-8xl font-black pointer-events-none select-none font-mono">
          在饭馆点菜
        </div>

        {/* Top Badges */}
        <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
          <span className="px-3 py-1 rounded-full bg-[#34363A]/90 backdrop-blur-md text-white text-xs font-bold tracking-wider">
            {HERO_LESSON.hskLevel}
          </span>
          <span className="px-3 py-1 rounded-full bg-[#1E4BA5]/90 backdrop-blur-md text-white text-xs font-semibold">
            {HERO_LESSON.category}
          </span>
        </div>

        {/* Content Box */}
        <div className="relative z-10 p-5 md:p-7 text-white">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight drop-shadow-sm flex items-center gap-3">
            <span>{HERO_LESSON.title}</span>
            <span className="text-sm md:text-base text-gray-300 font-normal">({HERO_LESSON.chineseTitle})</span>
          </h2>

          <p className="mt-2 text-sm text-gray-200 max-w-2xl line-clamp-2 leading-relaxed">
            {HERO_LESSON.subtitle}
          </p>

          {/* Action Row */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <button className="h-11 px-6 rounded-full bg-white text-[#18181B] font-bold text-sm flex items-center gap-2.5 hover:bg-[#FDF1F1] hover:text-[#B91B1C] transition-colors shadow-sm group-hover:scale-102 cursor-pointer">
              <div className="w-6 h-6 rounded-full bg-[#B91B1C] text-white flex items-center justify-center">
                <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
              </div>
              <span>{t.feed.watchNow}</span>
            </button>

            <div className="flex items-center gap-4 text-xs font-medium text-gray-300">
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-gray-400" />
                <span>{HERO_LESSON.viewCount} {t.watch.views}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>{HERO_LESSON.duration}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Rail Mini Card (~27% width = 3.2/12 = 3/4 cols) */}
      <div
        onClick={() => onSelectLesson(RIGHT_RAIL_LESSON)}
        className="lg:col-span-4 xl:col-span-3 relative rounded-2xl md:rounded-3xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-md transition-all duration-200 min-h-[290px] md:min-h-[310px] flex flex-col justify-between p-5 bg-slate-900 border border-[#E7E7EA]"
      >
        <img
          src={RIGHT_RAIL_LESSON.thumbnail}
          alt={RIGHT_RAIL_LESSON.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {/* Top badge */}
        <div className="relative z-10 flex items-center justify-between">
          <span className="px-3 py-1 rounded-md bg-[#1E4BA5] text-white text-[11px] font-bold tracking-wider uppercase">
            {RIGHT_RAIL_LESSON.category}
          </span>
          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-[#B91B1C] transition-colors">
            <Play className="w-4 h-4 fill-white ml-0.5" />
          </div>
        </div>

        {/* Bottom Content */}
        <div className="relative z-10 text-white">
          <span className="text-xs text-gray-300 font-mono font-medium">HSK 3 · Du lịch</span>
          <h3 className="text-lg font-bold mt-1 text-white group-hover:text-[#FFF2C8] transition-colors">
            {RIGHT_RAIL_LESSON.title}
          </h3>
          <p className="text-xs text-gray-300 mt-1 line-clamp-2">{RIGHT_RAIL_LESSON.subtitle}</p>

          <div className="mt-4 flex items-center gap-3 text-xs text-gray-300 font-medium">
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> {RIGHT_RAIL_LESSON.viewCount}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {RIGHT_RAIL_LESSON.duration}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
