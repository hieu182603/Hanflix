import React, { useEffect, useState } from 'react';
import { Sparkles, SlidersHorizontal, RefreshCw, Filter } from 'lucide-react';
import { getAiRecommendations, type PublishedLesson } from '../api/learning';
import { ApiRequestError } from '../api/client';
import { useLanguage } from '../i18n';

interface AIRecommendationSectionProps {
  onSelectLessonId: (id: string) => void;
  onOpenPreferences: () => void;
}

export default function AIRecommendationSection({
  onSelectLessonId,
  onOpenPreferences
}: AIRecommendationSectionProps) {
  const { t } = useLanguage();
  const [lessons, setLessons] = useState<Array<{ lesson: PublishedLesson; reasonVi: string }>>([]);
  const [activeChip, setActiveChip] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(true);
  const [error, setError] = useState('');

  const loadRecommendations = async () => {
    setIsRefreshing(true);
    setError('');
    try {
      setLessons(await getAiRecommendations());
    } catch (requestError) {
      setLessons([]);
      setError(requestError instanceof ApiRequestError ? requestError.message : 'Không thể tải gợi ý lúc này.');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => { void loadRecommendations(); }, []);

  const filterChips = [
    { id: 'all', label: t.feed.filterAll },
    { id: 'HSK 3', label: t.feed.filterHsk3, isLevel: true },
    { id: 'business', label: t.feed.filterBusiness },
    { id: 'travel', label: t.feed.filterTravel },
    { id: 'food', label: t.feed.filterFood },
  ];

  const filteredLessons = lessons.filter(({ lesson }) => {
    if (activeChip === 'all') return true;
    if (activeChip === 'HSK 3') return lesson.hsk === 3;
    return lesson.topicIds.includes(activeChip);
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
                {t.feed.recommendedForYou}
              </h2>
              <span className="px-3 py-0.5 rounded-full bg-[#34363A] text-white text-xs font-semibold">
                {t.feed.basedOnProfile}
              </span>
            </div>
            <p className="text-xs md:text-sm text-[#5F6368] mt-1">
              Bài học đã xuất bản, được xếp theo trình độ, sở thích và mục tiêu học tập của bạn.
            </p>
          </div>
        </div>

        {/* Right Header Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
          <button
            onClick={onOpenPreferences}
            className="h-10 px-4 rounded-xl border border-[#E7E7EA] bg-white hover:bg-[#F7F7F9] hover:border-[#D1D5DB] text-[#18181B] text-xs md:text-sm font-semibold flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#5F6368]" />
            <span>{t.feed.preferences}</span>
          </button>

          <button
            onClick={() => void loadRecommendations()}
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
      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800" role="alert">{error}</div>}
      {!error && !isRefreshing && lessons.length === 0 && <p className="py-6 text-sm text-neutral-600">Chưa có bài học đã xuất bản để gợi ý.</p>}
      {!error && isRefreshing && lessons.length === 0 && <p className="py-6 text-sm text-neutral-600">Đang tìm bài học phù hợp…</p>}
      {!error && lessons.length > 0 && filteredLessons.length === 0 && <p className="py-6 text-sm text-neutral-600">Không có bài học phù hợp với bộ lọc này.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-2">
        {!error && filteredLessons.map(({ lesson, reasonVi }) => (
          <button key={lesson._id} type="button" onClick={() => onSelectLessonId(lesson._id)}
            className="text-left bg-white rounded-2xl border border-[#E7E7EA] p-5 hover:border-[#B91B1C] hover:shadow-md transition-all">
            <span className="inline-block rounded-md bg-[#34363A] text-white text-xs font-bold px-2 py-1 mb-3">HSK {lesson.hsk}</span>
            <h3 className="font-bold text-[#18181B] leading-snug">{lesson.titleVi}</h3>
            {lesson.titleZh && <p className="text-sm text-neutral-500 mt-1">{lesson.titleZh} {lesson.pinyin && `· ${lesson.pinyin}`}</p>}
            <p className="text-xs text-neutral-600 mt-3">{reasonVi}</p>
            <p className="text-xs text-[#B91B1C] font-semibold mt-3">Xem bài học · {Math.ceil(lesson.durationSeconds / 60)} phút</p>
          </button>
        ))}
      </div>
    </section>
  );
}
