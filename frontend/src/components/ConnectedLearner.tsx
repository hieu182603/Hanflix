import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, ChevronLeft, ChevronRight, Clock3, Search } from 'lucide-react';
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
const SavedWordsPage = lazy(() => import('./vocabulary/SavedWordsPage'));
const RoadmapPage = lazy(() => import('./RoadmapPage'));
const StudyHistoryPage = lazy(() => import('./history/StudyHistoryPage'));
import LessonCard from './LessonCard';
import { dashboardQueryKeys, learningQueryKeys, lessonQueryKeys, vocabularyQueryKeys } from '../api/queryKeys';
import { perfMarks } from '../lib/perfMarks';
import { awardXP } from '../lib/xp';
import { recordLearningActivity } from '../lib/streak';

type Section = 'feed' | 'lessons' | 'saved' | 'vocabulary' | 'roadmap' | 'history';

const LESSONS_LIST_STALE = 60 * 1000; // 1 minute — catalog refetch tolerates a small staleness
const DASHBOARD_STALE = 30 * 1000;

export default function ConnectedLearner({ section, onSelectLesson, onOpenPreferences, onNavigateSection }: {
  section: Section;
  onSelectLesson: (id: string) => void;
  onOpenPreferences: () => void;
  onNavigateSection?: (section: string) => void;
}) {
  // Synchronize lessons search, HSK level, and pagination with URL search params
  const [searchParams, setSearchParams] = useSearchParams();
  const search = section === 'lessons' ? searchParams.get('q') || '' : '';
  const hsk = section === 'lessons' ? searchParams.get('hsk') || '' : '';
  const page = section === 'lessons' ? Math.max(1, Number(searchParams.get('page')) || 1) : 1;

  const setSearch = (val: string) => {
    if (section !== 'lessons') return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) next.set('q', val);
      else next.delete('q');
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
    queryKey: lessonQueryKeys.list({ q: search || undefined, hsk: hsk ? Number(hsk) : undefined, page, limit: 12 }),
    queryFn: ({ signal }) => listPublishedLessons({ q: search || undefined, hsk: hsk ? Number(hsk) : undefined, page, limit: 12, signal } as never).then((data) => data),
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
    enabled: section === 'saved',
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
    || (section === 'vocabulary' && savedQuery.isPending)
    || (section === 'roadmap' && (activityQuery.isPending || dashboardQuery.isPending))
    || (section === 'history' && dashboardQuery.isPending);

  const controls = <div className="flex flex-wrap gap-2">
    <label className="flex items-center gap-2 rounded-xl border bg-white px-3"><Search className="w-4 h-4" /><input className="p-2 text-sm outline-none" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm kiếm" /></label>
    <select className="rounded-xl border bg-white p-2 text-sm" value={hsk} onChange={event => { setHsk(event.target.value); setPage(1); }} aria-label="Lọc HSK"><option value="">Mọi cấp HSK</option>{[1,2,3,4,5,6,7,8,9].map(level => <option key={level} value={level}>HSK {level}</option>)}</select>
  </div>;

  const pagination = (pages: number) => pages > 1 && <div className="flex items-center gap-3 justify-center pt-3">
    <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border bg-white p-2 disabled:opacity-40" aria-label="Trang trước"><ChevronLeft className="w-4 h-4" /></button>
    <span className="text-sm">Trang {page}/{pages}</span>
    <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg border bg-white p-2 disabled:opacity-40" aria-label="Trang sau"><ChevronRight className="w-4 h-4" /></button>
  </div>;

  const renderError = errorMessage
    ? <InlineBanner variant="error" message={errorMessage} />
    : null;

  return <div className="space-y-6">
    {renderError}
    {section === 'feed' && (
      <>
        <div className="rounded-3xl bg-[#18181B] p-6 text-white md:p-8">
          <p className="text-sm text-red-300">Tiếp tục hành trình tiếng Trung</p>
          <h1 className="mt-1 text-2xl font-black">Bài học của bạn</h1>
          {dashboardQuery.data?.continueLearning?.lessonId?._id ? (
            <button type="button" onClick={() => onSelectLesson(dashboardQuery.data!.continueLearning!.lessonId!._id)} className="mt-4 rounded-xl bg-[#B91B1C] px-4 py-2 text-sm font-bold">Tiếp tục: {dashboardQuery.data.continueLearning!.lessonId!.titleVi}</button>
          ) : (
            <p className="mt-3 text-sm text-neutral-300">Chọn một bài học đã xuất bản để bắt đầu.</p>
          )}
          {dashboardQuery.data && (
            <div className="mt-5 flex flex-wrap gap-5 text-sm">
              <span>{dashboardQuery.data.metrics.completedLessons} bài hoàn thành</span>
              <span>{dashboardQuery.data.metrics.savedWords} từ đã lưu</span>
              <span>{dashboardQuery.data.metrics.dueWords} từ cần ôn</span>
            </div>
          )}
        </div>
        <AIRecommendationSection onSelectLessonId={onSelectLesson} onOpenPreferences={onOpenPreferences} />
      </>
    )}
    {section === 'lessons' && (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Kho bài học đã xuất bản</h2>
            <p className="text-sm text-neutral-500">{lessonsQuery.data?.total ?? 0} bài học</p>
          </div>
          {controls}
        </div>
        {isLoading && lessonsQuery.isPending && (
          <p className="text-sm">Đang tải bài học…</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {lessonsQuery.data?.items?.map((lesson) => (
            <LessonCard
              key={lesson._id}
              lesson={lesson}
              onClick={() => onSelectLesson(lesson._id)}
            />
          ))}
        </div>
        {pagination(lessonsQuery.data?.pages ?? 0)}
      </section>
    )}
    {section === 'saved' && (
      <Suspense fallback={<HanFlixLoadingScreen />}>
        <SavedWordsPage
          savedWords={savedQuery.data ?? []}
          dueWords={dueQuery.data ?? []}
          onReviewWord={(wordId, rating) => mutate(() => reviewMutation.mutateAsync({ wordId, rating }))}
          onRemoveWord={(wordId) => mutate(() => removeMutation.mutateAsync(wordId))}
          onNavigateToVocabulary={() => onNavigateSection?.('vocabulary')}
          busy={reviewMutation.isPending || removeMutation.isPending}
        />
      </Suspense>
    )}
    {section === 'vocabulary' && (
      <Suspense fallback={<HanFlixLoadingScreen />}>
        <VocabularyPage
          savedWords={savedQuery.data ?? []}
        onStartReviewSession={() => onNavigateSection?.('saved')}
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
  </div>;
}
