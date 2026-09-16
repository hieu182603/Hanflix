import React, { useState } from 'react';
import { Sparkles, SlidersHorizontal, RefreshCw, Filter } from 'lucide-react';
import VideoCard from './VideoCard';
import { VideoLesson, RECOMMENDATION_LESSONS } from '../data/hanflixData';

interface AIRecommendationSectionProps {
  onSelectLesson: (lesson: VideoLesson) => void;
  onOpenPreferences: () => void;
}

export default function AIRecommendationSection({
  onSelectLesson,
  onOpenPreferences
}: AIRecommendationSectionProps) {
  const [lessons, setLessons] = useState<VideoLesson[]>(RECOMMENDATION_LESSONS);
  const [activeChip, setActiveChip] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const filterChips = [
    { id: 'all', label: 'Tất cả' },
    { id: 'HSK 3', label: 'HSK 3', isLevel: true },
    { id: 'Kinh doanh', label: 'Mục tiêu: Kinh doanh' },
    { id: 'Du lịch', label: 'Du lịch' },
    { id: 'Ẩm thực', label: 'Ẩm thực' },
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      // Shuffle recommendation order for demo feel
      const shuffled = [...lessons].sort(() => Math.random() - 0.5);
      setLessons(shuffled);
      setIsRefreshing(false);
    }, 400);
  };

  const filteredLessons = lessons.filter((lesson) => {
    if (activeChip === 'all') return true;
    if (activeChip === 'HSK 3') return lesson.hskLevel === 'HSK 3';
    return lesson.category === activeChip || lesson.tags.includes(activeChip);
  });

  return (
    <section className="bg-white rounded-2xl md:rounded-3xl border border-[#E7E7EA] p-5 md:p-7 shadow-xs">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#E7E7EA]">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-[#B91B1C] text-white flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="w-5 h-5 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl md:text-2xl font-extrabold text-[#18181B] tracking-tight">
                AI gợi ý cho bạn
              </h2>
              <span className="px-3 py-0.5 rounded-full bg-[#34363A] text-white text-xs font-semibold">
                Theo hồ sơ học
              </span>
            </div>
            <p className="text-xs md:text-sm text-[#5F6368] mt-1">
              Gợi ý theo trình độ HSK 3, mục tiêu tiếng Trung kinh doanh, sở thích du lịch, ẩm thực.
            </p>
          </div>
        </div>

        {/* Right Header Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
          <button
            onClick={onOpenPreferences}
            className="h-10 px-4 rounded-xl border border-[#E7E7EA] bg-white hover:bg-[#F7F7F9] hover:border-[#D1D5DB] text-[#18181B] text-xs md:text-sm font-semibold flex items-center gap-2 transition-all shadow-2xs"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#5F6368]" />
            <span>Sở thích</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-10 h-10 rounded-xl border border-[#E7E7EA] bg-white hover:bg-[#F7F7F9] hover:border-[#D1D5DB] text-[#5F6368] hover:text-[#18181B] flex items-center justify-center transition-all shadow-2xs active:scale-95"
            title="Làm mới gợi ý"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#B91B1C]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex items-center gap-2 overflow-x-auto py-4 no-scrollbar">
        <Filter className="w-4 h-4 text-[#8B9097] mr-1 shrink-0" />
        {filterChips.map((chip) => {
          const isActive = activeChip === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => setActiveChip(chip.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#B91B1C] text-white shadow-xs'
                  : chip.isLevel
                  ? 'bg-[#34363A] text-white hover:bg-[#18181B]'
                  : 'bg-[#F7F7F9] text-[#5F6368] hover:bg-[#E7E7EA] hover:text-[#18181B]'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Video Lesson Grid (4 cols >= 1366px, 3 cols 1024-1365px, 2 cols tablet, 1 col mobile) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-2">
        {filteredLessons.map((lesson) => (
          <VideoCard key={lesson.id} lesson={lesson} onSelect={onSelectLesson} />
        ))}
      </div>
    </section>
  );
}
