import React from 'react';
import { Play, Sparkles, Clock, CheckCircle2, RotateCcw } from 'lucide-react';
import { VideoLesson } from '../data/hanflixData';

interface VideoCardProps {
  lesson: VideoLesson;
  onSelect: (lesson: VideoLesson) => void;
}

export default function VideoCard({ lesson, onSelect }: VideoCardProps) {
  return (
    <div
      onClick={() => onSelect(lesson)}
      className="bg-white rounded-2xl border border-[#E7E7EA] overflow-hidden cursor-pointer group hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
    >
      {/* Thumbnail Container (16:9 aspect ratio) */}
      <div className="relative aspect-video w-full bg-slate-800 overflow-hidden">
        <img
          src={lesson.thumbnail}
          alt={lesson.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${lesson.id}/400/225`;
          }}
        />
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/35 transition-colors flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/90 text-[#18181B] group-hover:bg-[#B91B1C] group-hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 shadow-lg">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
          <span className="px-2 py-0.5 rounded-md bg-[#34363A]/90 text-white text-[11px] font-bold">
            {lesson.hskLevel}
          </span>

          {lesson.status === 'Đang học' && (
            <span className="px-2 py-0.5 rounded-md bg-[#FFF2C8] text-[#9A6A00] text-[11px] font-bold border border-[#E7A92F]/30 flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              <span>Đang học</span>
            </span>
          )}

          {lesson.status === 'Ôn lại' && (
            <span className="px-2 py-0.5 rounded-md bg-[#E4F6ED] text-[#188A5A] text-[11px] font-bold border border-[#188A5A]/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Ôn lại</span>
            </span>
          )}
        </div>

        {/* Bottom Right Duration Label */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-xs text-white text-[11px] font-semibold font-mono tracking-tight">
          {lesson.duration}
        </div>
      </div>

      {/* Card Info Details */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="text-xs font-semibold text-[#B91B1C] mb-1">
            {lesson.category}
          </div>

          <h3 className="font-bold text-sm text-[#18181B] group-hover:text-[#B91B1C] transition-colors line-clamp-2 leading-snug">
            {lesson.title}
          </h3>

          <div className="text-xs text-[#5F6368] font-mono mt-0.5 line-clamp-1">
            {lesson.chineseTitle} ({lesson.pinyinTitle})
          </div>
        </div>

        {/* Recommendation Reason */}
        {lesson.recommendationReason && (
          <div className="mt-3 pt-2.5 border-t border-[#E7E7EA] flex items-center gap-1.5 text-xs text-[#5F6368]">
            <Sparkles className="w-3.5 h-3.5 text-[#B91B1C] shrink-0" />
            <span className="line-clamp-1 text-[11px]">{lesson.recommendationReason}</span>
          </div>
        )}
      </div>
    </div>
  );
}
