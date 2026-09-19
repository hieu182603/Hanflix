import { useEffect, useRef, useState } from 'react';
import { Sparkles, SlidersHorizontal, RefreshCw, Filter } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAiRecommendations, getRuleBasedRecommendations, type PublishedLesson } from '../api/learning';
import { InlineBanner } from './notifications';
import { ApiRequestError } from '../api/client';
import { useLanguage } from '../i18n';
import LessonCard from './LessonCard';
import { learningQueryKeys } from '../api/queryKeys';
import { perfMarks } from '../lib/perfMarks';

interface AIRecommendationSectionProps {
  onSelectLessonId: (id: string) => void;
  onOpenPreferences: () => void;
}

const RULE_STALE = 10 * 60 * 1000; // 10 min — recommendations re-shuffle quickly otherwise
const AI_STALE = 30 * 60 * 1000; // AI is expensive; cache for 30 minutes
const AI_TIMEOUT_MS = 8000;

interface RecItem {
  lesson: PublishedLesson;
  reasonVi: string;
}

/**
 * Two-tier rec strategy:
 *   1. Rule-based recs are CHEAP, fully derived from the user's HSK + saved
 *      words + preferences. They render immediately from the React Query
 *      cache when one is available, otherwise the first request is
 *      background. AI recs layer on top once they return.
 *   2. AI recs are gated behind an explicit request (button or automatic
 *      one-shot). They NEVER block the rule-based feed, and any AI failure
 *      leaves the rule-based list untouched.
 *
 * Both query keys are namespaced (`learningQueryKeys.recsRule()` /
 * `learningQueryKeys.recsAi()`) so other views can subscribe to the same
 * cached entries without firing duplicate requests.
 */
export default function AIRecommendationSection({
  onSelectLessonId,
  onOpenPreferences,
}: AIRecommendationSectionProps) {
  const { t } = useLanguage();
  const [activeChip, setActiveChip] = useState<string>('all');
  const queryClient = useQueryClient();
  const hasReportedFeedReady = useRef(false);

  const ruleQuery = useQuery({
    queryKey: learningQueryKeys.recsRule(),
    queryFn: ({ signal }) => getRuleBasedRecommendations({ signal } as never).then((data) => data),
    staleTime: RULE_STALE,
    retry: 1,
  });

  const aiQuery = useQuery({
    queryKey: learningQueryKeys.recsAi(),
    queryFn: ({ signal }) =>
      getAiRecommendations({ signal, timeoutMs: AI_TIMEOUT_MS } as never).then((data) => data),
    staleTime: AI_STALE,
    retry: 0,
  });

  useEffect(() => {
    // Mark feed_list:ready exactly once, the first time EITHER source
    // produces data. Doing this in render body (the previous bug) would
    // overwrite the mark on every render and taint the perf trace.
    if (hasReportedFeedReady.current) return;
    if (aiQuery.data || ruleQuery.data) {
      hasReportedFeedReady.current = true;
      perfMarks.since('feed_list:ready', 'restore_session:ready');
    }
  }, [aiQuery.data, ruleQuery.data]);

  const refetchAll = async () => {
    await queryClient.invalidateQueries({ queryKey: learningQueryKeys.recsRule() });
    await queryClient.invalidateQueries({ queryKey: learningQueryKeys.recsAi() });
  };

  const lessons: RecItem[] = (() => {
    if (aiQuery.data && aiQuery.data.length > 0) {
      return aiQuery.data;
    }
    if (ruleQuery.data && ruleQuery.data.length > 0) {
      return ruleQuery.data;
    }
    return [];
  })();

  const isRefreshing = ruleQuery.isFetching && !ruleQuery.data;
  const error = (() => {
    if (aiQuery.error && ruleQuery.data && ruleQuery.data.length > 0) {
      // AI failed but rule list works — surface as a soft banner
      return aiQuery.error instanceof ApiRequestError ? aiQuery.error.message : 'Không thể tải gợi ý AI lúc này.';
    }
    if (ruleQuery.error && !ruleQuery.data) {
      return ruleQuery.error instanceof ApiRequestError ? ruleQuery.error.message : 'Không thể tải gợi ý lúc này.';
    }
    return '';
  })();

  const filterChips = [
    { id: 'all', label: t.feed.filterAll },
    { id: 'HSK 3', label: t.feed.filterHsk3, isLevel: true },
    { id: 'HSK 6', label: 'HSK 6' },
    { id: 'business', label: t.feed.filterBusiness },
    { id: 'travel', label: t.feed.filterTravel },
    { id: 'food', label: t.feed.filterFood },
  ];

  const filteredLessons = lessons.filter(({ lesson }) => {
    if (activeChip === 'all') return true;
    if (activeChip === 'HSK 3') return lesson.hsk === 3;
    if (activeChip === 'HSK 6') return lesson.hsk === 6;
    return lesson.topicIds.includes(activeChip);
  });

  return (
    <section className="bg-white rounded-2xl md:rounded-3xl border border-[#E7E7EA] p-5 md:p-7 shadow-xs">
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
              {aiQuery.isFetching && (
                <span className="px-3 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">AI đang tải…</span>
              )}
              {aiQuery.data && aiQuery.data.length > 0 && (
                <span className="px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">Cá nhân hoá bởi AI</span>
              )}
            </div>
            <p className="text-xs md:text-sm text-[#5F6368] mt-1">
              Bài học đã xuất bản, được xếp theo trình độ, sở thích và mục tiêu học tập của bạn.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
          <button
            onClick={onOpenPreferences}
            className="h-10 px-4 rounded-xl border border-[#E7E7EA] bg-white hover:bg-[#F7F7F9] hover:border-[#D1D5DB] text-[#18181B] text-xs md:text-sm font-semibold flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#5F6368]" />
            <span>{t.feed.preferences}</span>
          </button>

          <button
            onClick={() => void refetchAll()}
            disabled={isRefreshing}
            className="w-10 h-10 rounded-xl border border-[#E7E7EA] bg-white hover:bg-[#F7F7F9] hover:border-[#D1D5DB] text-[#5F6368] hover:text-[#18181B] flex items-center justify-center transition-all shadow-2xs active:scale-95"
            title="Làm mới gợi ý"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#B91B1C]' : ''}`} />
          </button>
        </div>
      </div>

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

      {error && <InlineBanner variant="warning" message={error} className="mb-4" />}
      {!error && !isRefreshing && lessons.length === 0 && <p className="py-6 text-sm text-neutral-600">Chưa có bài học đã xuất bản để gợi ý.</p>}
      {!error && isRefreshing && lessons.length === 0 && <p className="py-6 text-sm text-neutral-600">Đang tìm bài học phù hợp…</p>}
      {!error && lessons.length > 0 && filteredLessons.length === 0 && <p className="py-6 text-sm text-neutral-600">Không có bài học phù hợp với bộ lọc này.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-2">
        {!error &&
          filteredLessons.map(({ lesson, reasonVi }) => (
            <LessonCard
              key={lesson._id}
              lesson={lesson}
              reasonVi={reasonVi}
              onClick={() => onSelectLessonId(lesson._id)}
            />
          ))}
      </div>
    </section>
  );
}
