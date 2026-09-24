import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getLearnerDashboard,
  getLearningActivity,
  listPublishedLessons,
  type LearnerDashboard,
  type LearningActivity,
  type LessonList,
} from '../api/learning';
import { InlineBanner } from './notifications';
import { listDueWords, listSavedWords, removeSavedWord, reviewSavedWord, saveVocabularyWord, type SavedVocabulary } from '../api/vocabulary';import AIRecommendationSection from './AIRecommendationSection';
import HanFlixLoadingScreen from './HanFlixLoadingScreen';
// Heavy sub-pages are lazy: feed/lessons are the critical path and stay
// eager, but saved/vocabulary/roadmap/history pull in sizable modules
// (SRS scheduler, flashcard modals, calendar charts) the user may never
// open in a given session.
const VocabularyPage = lazy(() => import('./vocabulary/VocabularyPage'));
const RoadmapPage = lazy(() => import('./RoadmapPage'));
const StudyHistoryPage = lazy(() => import('./history/StudyHistoryPage'));
import LessonCard from './LessonCard';
import { dashboardQueryKeys, learningQueryKeys, lessonQueryKeys, vocabularyQueryKeys } from '../api/queryKeys';
import { perfMarks } from '../lib/perfMarks';
import { awardXP } from '../lib/xp';
import { recordLearningActivity } from '../lib/streak';

import CustomSelect from './common/CustomSelect';

type Section = 'feed' | 'lessons' | 'saved' | 'vocabulary' | 'roadmap' | 'history';

const LESSONS_LIST_STALE = 60 * 1000; // 1 minute — catalog refetch tolerates a small staleness
const DASHBOARD_STALE = 30 * 1000;

const HSK_OPTIONS = [
  { value: '', label: 'Mọi cấp HSK' },
  { value: '1', label: 'HSK 1' },
  { value: '2', label: 'HSK 2' },
  { value: '3', label: 'HSK 3' },
  { value: '4', label: 'HSK 4' },
  { value: '5', label: 'HSK 5' },
  { value: '6', label: 'HSK 6' },
  { value: '7', label: 'HSK 7' },
  { value: '8', label: 'HSK 8' },
  { value: '9', label: 'HSK 9' },
];

const TOPIC_OPTIONS = [
  { value: '', label: 'Tất cả chủ đề' },
  { value: 'daily-life', label: '☕ Đời sống thường nhật' },
  { value: 'entertainment', label: '🎬 Phim ảnh & Giải trí' },
  { value: 'food', label: '🍜 Ẩm thực & Nấu ăn' },
  { value: 'business', label: '💼 Công sở & Kinh doanh' },
  { value: 'travel', label: '✈️ Du lịch & Khám phá' },
  { value: 'shopping', label: '🛍️ Mua sắm & Tiêu dùng' },
];

const TOPIC_PILLS = [
  { value: '', label: 'Tất cả', icon: '✨' },
  { value: 'daily-life', label: 'Đời sống', icon: '☕' },
  { value: 'entertainment', label: 'Giải trí', icon: '🎬' },
  { value: 'food', label: 'Ẩm thực', icon: '🍜' },
  { value: 'business', label: 'Công sở', icon: '💼' },
  { value: 'travel', label: 'Du lịch', icon: '✈️' },
  { value: 'shopping', label: 'Mua sắm', icon: '🛍️' },
];

export default function ConnectedLearner({ section, onSelectLesson, onOpenPreferences, onNavigateSection }: {
  section: Section;
  onSelectLesson: (id: string) => void;
  onOpenPreferences: () => void;
  onNavigateSection?: (section: string) => void;
}) {
  // Synchronize lessons topic, HSK level, search, and pagination with URL search params
  const [searchParams, setSearchParams] = useSearchParams();
  const search = section === 'lessons' ? searchParams.get('q') || '' : '';
  const topic = section === 'lessons' ? searchParams.get('topic') || '' : '';
  const hsk = section === 'lessons' ? searchParams.get('hsk') || '' : '';
  const page = section === 'lessons' ? Math.max(1, Number(searchParams.get('page')) || 1) : 1;

  const setTopic = (val: string) => {
    if (section !== 'lessons') return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) next.set('topic', val);
      else next.delete('topic');
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const setHsk = (val: string) => {
    if (section !== 'lessons') return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) next.set('hsk', val);
      else next.delete('hsk');
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const clearSearch = () => {
    if (section !== 'lessons') return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('q');
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const setPage = (p: number) => {
    if (section !== 'lessons') return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (p > 1) next.set('page', String(p));
      else next.delete('page');
      return next;
    });
  };

  const lessonsQuery = useQuery({
    queryKey: lessonQueryKeys.list({
      q: search || undefined,
      hsk: hsk ? Number(hsk) : undefined,
      topic: topic || undefined,
      page,
      limit: 12,
    }),
    queryFn: ({ signal }) =>
      listPublishedLessons({
        q: search || undefined,
        hsk: hsk ? Number(hsk) : undefined,
        topic: topic || undefined,
        page,
        limit: 12,
        signal,
      } as never).then((data) => data),
    enabled: section === 'lessons',
    staleTime: LESSONS_LIST_STALE,
  });

  const dashboardQuery = useQuery({
    queryKey: dashboardQueryKeys.detail(),
    queryFn: ({ signal }) => getLearnerDashboard({ signal } as never).then((data) => data),
    enabled: section === 'feed' || section === 'roadmap' || section === 'history',
    staleTime: DASHBOARD_STALE,
  });

  const activityQuery = useQuery({
    queryKey: learningQueryKeys.activity({}),
    queryFn: ({ signal }) => getLearningActivity({ signal } as never).then((data) => data),
    enabled: section === 'roadmap',
    staleTime: 5 * 60 * 1000,
  });

  const savedQuery = useQuery({
    queryKey: vocabularyQueryKeys.saved(),
    queryFn: ({ signal }) => listSavedWords({ signal }).then((data) => data.items),
    enabled: section === 'saved' || section === 'vocabulary',
    staleTime: 60 * 1000,
  });

  const dueQuery = useQuery({
    queryKey: vocabularyQueryKeys.due(),
    queryFn: ({ signal }) => listDueWords({ signal }).then((data) => data.items),
    enabled: section === 'saved' || section === 'vocabulary',
    staleTime: 30 * 1000,
  });

  // Track first feed render so perf-marks have a target.
  useEffect(() => {
    if (section === 'feed' && dashboardQuery.data) {
      perfMarks.since('feed_list:ready', 'restore_session:ready');
    }
    if (section === 'lessons' && lessonsQuery.data) {
      perfMarks.since('feed_list:ready', 'restore_session:ready');
    }
  }, [section, dashboardQuery.data, lessonsQuery.data]);

  const queryClient = useQueryClient();

  const reviewMutation = useMutation({
    mutationFn: ({ wordId, rating }: { wordId: string; rating: 'again' | 'hard' | 'good' | 'easy' }) =>
      reviewSavedWord(wordId, rating),
    onSuccess: (res) => {
      const earned = (res as { xpEarned?: number })?.xpEarned || 5;
      awardXP(earned, `Ôn tập từ vựng Flashcard (+${earned} XP)`, 'vocab');
      recordLearningActivity('review');
      void queryClient.invalidateQueries({ queryKey: vocabularyQueryKeys.saved() });
      void queryClient.invalidateQueries({ queryKey: vocabularyQueryKeys.due() });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (wordId: string) => removeSavedWord(wordId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vocabularyQueryKeys.saved() });
      void queryClient.invalidateQueries({ queryKey: vocabularyQueryKeys.due() });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (word: string) => saveVocabularyWord({ hanzi: word }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vocabularyQueryKeys.saved() });
    },
  });

  const mutate = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } finally {
      void queryClient.invalidateQueries({ queryKey: vocabularyQueryKeys.saved() });
      void queryClient.invalidateQueries({ queryKey: vocabularyQueryKeys.due() });
    }
  };

  const errorMessage =
    lessonsQuery.error?.message
    ?? dashboardQuery.error?.message
    ?? activityQuery.error?.message
    ?? savedQuery.error?.message
    ?? '';

  const isLoading =
    (section === 'lessons' && lessonsQuery.isPending)
    || (section === 'feed' && dashboardQuery.isPending)
    || (section === 'saved' && (savedQuery.isPending || dueQuery.isPending))
    || (section === 'vocabulary' && (savedQuery.isPending || dueQuery.isPending))
    || (section === 'roadmap' && (activityQuery.isPending || dashboardQuery.isPending))
    || (section === 'history' && dashboardQuery.isPending);

  const controls = (
    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
      <CustomSelect
        className="w-full sm:w-44"
        value={topic}
        onChange={(val) => {
          setTopic(val);
          setPage(1);
        }}
        options={TOPIC_OPTIONS}
        ariaLabel="Lọc chủ đề video"
      />
      <CustomSelect
        className="w-full sm:w-36"
        value={hsk}
        onChange={(val) => {
          setHsk(val);
          setPage(1);
        }}
        options={HSK_OPTIONS}
        ariaLabel="Lọc HSK"
      />
      {(topic || hsk) && (
        <button
          type="button"
          onClick={() => {
            setTopic('');
            setHsk('');
            setPage(1);
          }}
          className="text-xs font-bold text-[#B91B1C] hover:bg-[#FDF1F1] px-2.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
          title="Đặt lại bộ lọc"
        >
          Đặt lại
        </button>
      )}
    </div>
  );

  const pagination = (pages: number) =>
    pages > 1 && (
      <div className="flex items-center gap-3 justify-center pt-4">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="rounded-xl border border-[#E7E7EA] bg-white p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center disabled:opacity-40 hover:bg-[#F7F7F9] cursor-pointer"
          aria-label="Trang trước"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs sm:text-sm font-bold text-[#5F6368]">
          Trang {page}/{pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
          className="rounded-xl border border-[#E7E7EA] bg-white p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center disabled:opacity-40 hover:bg-[#F7F7F9] cursor-pointer"
          aria-label="Trang sau"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );

  const renderError = errorMessage
    ? <InlineBanner variant="error" message={errorMessage} />
    : null;

  return (
    <div className="space-y-6">
      {renderError}
      {section === 'feed' && (
        <>
          <div className="rounded-3xl bg-[#18181B] p-5 sm:p-6 md:p-8 text-white shadow-sm">
            <p className="text-xs sm:text-sm text-red-300 font-semibold">Tiếp tục hành trình tiếng Trung</p>
            <h1 className="mt-1 text-xl sm:text-2xl font-black">Bài học của bạn</h1>
            {dashboardQuery.data?.continueLearning?.lessonId?._id ? (
              <button
                type="button"
                onClick={() => onSelectLesson(dashboardQuery.data!.continueLearning!.lessonId!._id)}
                className="mt-4 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
              >
                Tiếp tục: {dashboardQuery.data.continueLearning!.lessonId!.titleVi}
              </button>
            ) : (
              <p className="mt-3 text-xs sm:text-sm text-neutral-300">Chọn một bài học đã xuất bản để bắt đầu.</p>
            )}
            {dashboardQuery.data && (
              <div className="mt-5 flex flex-wrap gap-3 sm:gap-5 text-xs sm:text-sm text-neutral-300">
                <span className="bg-white/10 px-3 py-1 rounded-full">{dashboardQuery.data.metrics.completedLessons} bài hoàn thành</span>
                <span className="bg-white/10 px-3 py-1 rounded-full">{dashboardQuery.data.metrics.savedWords} từ đã lưu</span>
                <span className="bg-white/10 px-3 py-1 rounded-full">{dashboardQuery.data.metrics.dueWords} từ cần ôn</span>
              </div>
            )}
          </div>
          <AIRecommendationSection onSelectLessonId={onSelectLesson} onOpenPreferences={onOpenPreferences} />
        </>
      )}
    {section === 'lessons' && (
      <section className="space-y-4">
        {/* Header & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#18181B]">Kho bài học đã xuất bản</h2>
            <p className="text-sm text-[#5F6368]">
              {lessonsQuery.data?.total ?? 0} bài học
              {topic && (
                <span className="ml-1 text-[#B91B1C] font-semibold">
                  · {TOPIC_OPTIONS.find((t) => t.value === topic)?.label}
                </span>
              )}
            </p>
          </div>
          {controls}
        </div>

        {/* Global Search Notice if searched from top header bar */}
        {search && (
          <div className="flex items-center gap-2 bg-[#FDF1F1] text-[#B91B1C] px-3.5 py-1.5 rounded-full border border-red-200/80 w-fit text-xs font-semibold">
            <span>Đang tìm: &ldquo;{search}&rdquo;</span>
            <button
              type="button"
              onClick={clearSearch}
              className="text-[#B91B1C] hover:text-[#18181B] font-black cursor-pointer ml-1"
              aria-label="Xóa từ khóa tìm kiếm"
            >
              ✕
            </button>
          </div>
        )}

        {/* Quick Topic Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {TOPIC_PILLS.map((pill) => {
            const isActive = topic === pill.value;
            return (
              <button
                key={pill.value}
                type="button"
                onClick={() => {
                  setTopic(pill.value);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-[#B91B1C] text-white shadow-2xs'
                    : 'bg-white hover:bg-[#F7F7F9] text-[#5F6368] hover:text-[#18181B] border border-[#E7E7EA]'
                }`}
              >
                <span>{pill.icon}</span>
                <span>{pill.label}</span>
              </button>
            );
          })}
        </div>

        {isLoading && lessonsQuery.isPending && (
          <p className="text-sm text-[#5F6368]">Đang tải bài học…</p>
        )}

        {!isLoading && (!lessonsQuery.data?.items || lessonsQuery.data.items.length === 0) ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-[#E7E7EA] p-8 max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FDF1F1] text-[#B91B1C] flex items-center justify-center mx-auto text-xl">
              🎬
            </div>
            <h3 className="font-black text-[#18181B] text-base">Không tìm thấy bài học phù hợp</h3>
            <p className="text-xs text-[#5F6368]">
              Chưa có bài học nào thuộc chủ đề hoặc cấp HSK đã chọn. Bạn hãy thử chọn chủ đề khác nhé!
            </p>
            {(topic || hsk || search) && (
              <button
                type="button"
                onClick={() => {
                  setTopic('');
                  setHsk('');
                  clearSearch();
                  setPage(1);
                }}
                className="mt-2 inline-flex items-center px-4 py-2 rounded-xl bg-[#B91B1C] text-white text-xs font-bold hover:bg-[#A3181A] transition-colors cursor-pointer"
              >
                Xem tất cả bài học
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {lessonsQuery.data?.items?.map((lesson) => (
              <LessonCard
                key={lesson._id}
                lesson={lesson}
                onClick={() => onSelectLesson(lesson._id)}
              />
            ))}
          </div>
        )}
        {pagination(lessonsQuery.data?.pages ?? 0)}
      </section>
    )}
    {(section === 'saved' || section === 'vocabulary') && (
      <Suspense fallback={<HanFlixLoadingScreen />}>
        <VocabularyPage
          initialTab={section === 'saved' ? 'saved' : undefined}
          savedWords={savedQuery.data ?? []}
          dueWords={dueQuery.data ?? []}
          onReviewWord={(wordId, rating) => mutate(() => reviewMutation.mutateAsync({ wordId, rating }))}
          onStartReviewSession={() => {}}
          onSaveWord={async (word) => {
            await mutate(() => saveMutation.mutateAsync(word.hanzi));
          }}
          onRemoveWord={(wordId) => void mutate(() => removeMutation.mutateAsync(wordId))}
        />
      </Suspense>
    )}
    {section === 'roadmap' && (
      <Suspense fallback={<HanFlixLoadingScreen />}>
        <RoadmapPage
          onSelectLesson={onSelectLesson}
          onStartPractice={() => onNavigateSection?.('lessons')}
          onNavigateToLessons={() => onNavigateSection?.('lessons')}
        />
      </Suspense>
    )}
    {section === 'history' && (
      <Suspense fallback={<HanFlixLoadingScreen />}>
        <StudyHistoryPage
          onSelectLesson={onSelectLesson}
          onNavigateToLessons={() => onNavigateSection?.('lessons')}
      />
        </Suspense>
      )}
    </div>
  );
}
