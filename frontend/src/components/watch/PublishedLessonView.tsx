import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Layers,
  Play,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  explainWord,
  submitLessonQuiz,
  updateLessonProgress,
  type LessonProgress,
  type LearningTip,
  type PublicQuestion,
  type QuizResult,
  type PublishedLesson,
  type SubtitleCue,
  type WordExplanation,
  getPublishedLesson,
  getPublishedSubtitles,
  getLessonProgress,
  getLessonQuiz,
  listPublishedLessons,
} from '../../api/learning';
import { InlineBanner } from '../notifications';
import { useNotification } from '../notifications';
import { saveSubtitleWord } from '../../api/vocabulary';
import { ApiRequestError } from '../../api/client';
import { type SubtitleLanguageTrack } from './SubtitleOverlay';
import YouTubePlayer from './YouTubePlayer';
import KaraokePlayer from './KaraokePlayer';
import PodcastPlayer from './PodcastPlayer';
import DramaPlayer from './DramaPlayer';
import LearningTipsPanel from './LearningTipsPanel';
import AiImprovedBadge from './AiImprovedBadge';
import WordExplanationPopover from './WordExplanationPopover';
import LessonQuizModal from './LessonQuizModal';
import { useSubtitlePreferences } from '../../hooks/useSubtitlePreferences';
import { cleanPinyinText, stripTrailingPunctuation } from '../../utils/text';
import { COMMON_VOCAB_DB, enrichVocabItem } from '../../utils/vocabDict';
import { lessonQueryKeys } from '../../api/queryKeys';
import { perfMarks } from '../../lib/perfMarks';
import { awardXP } from '../../lib/xp';
import { recordLearningActivity } from '../../lib/streak';

export interface PublishedLessonViewProps {
  lessonId: string;
  onBack: () => void;
  subtitlePreference?: string;
  onSelectLesson?: (id: string) => void;
  onAskAI?: (prompt: string) => void;
}

export default function PublishedLessonView({
  lessonId,
  onBack,
  onSelectLesson,
  onAskAI,
}: PublishedLessonViewProps) {
  const notify = useNotification();
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeCueRef = useRef<HTMLDivElement | null>(null);
  const hasUserInitiatedPlayRef = useRef(false);

  /**
   * Data layer (React Query):
   *   - `lessonQuery` returns the lesson doc including `media.url`. As soon
   *     as `media.url` is present we mount the `<YouTubePlayer>` and play
   *     without waiting for subtitles, progress, or quiz.
   *   - `subtitlesQuery`, `progressQuery`, `quizQuery` all run in parallel
   *     and only affect their own UI sections. Failures render a banner
   *     while the player keeps playing.
   *   - When `lessonId` changes we cancel the previous lesson's queries so
   *     a late-arriving response never lands in the new lesson's state.
   */
  const queryClient = useQueryClient();

  const lessonQuery = useQuery({
    queryKey: lessonQueryKeys.lesson(lessonId),
    queryFn: ({ signal }) => getPublishedLesson(lessonId, { signal }),
    enabled: Boolean(lessonId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const subtitlesQuery = useQuery({
    queryKey: lessonQueryKeys.subtitles(lessonId),
    queryFn: ({ signal }) => getPublishedSubtitles(lessonId, { signal }),
    enabled: Boolean(lessonId),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  const progressQuery = useQuery({
    queryKey: lessonQueryKeys.progress(lessonId),
    queryFn: ({ signal }) => getLessonProgress(lessonId, { signal }),
    enabled: Boolean(lessonId),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const quizQuery = useQuery({
    queryKey: lessonQueryKeys.quiz(lessonId),
    queryFn: ({ signal }) => getLessonQuiz(lessonId, { signal }),
    enabled: Boolean(lessonId),
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  // Cancel in-flight queries when the user navigates to a different lesson,
  // so a stale response for lesson A can never paint into lesson B.
  useEffect(() => {
    perfMarks.mark('watch_open:start', { lessonId });
    return () => {
      for (const key of [
        lessonQueryKeys.lesson(lessonId),
        lessonQueryKeys.subtitles(lessonId),
        lessonQueryKeys.progress(lessonId),
        lessonQueryKeys.quiz(lessonId),
      ]) {
        void queryClient.cancelQueries({ queryKey: key, exact: true });
      }
    };
  }, [lessonId, queryClient]);

  const lesson = lessonQuery.data ?? null;
  const subtitleTrack = subtitlesQuery.data ?? null;
  const cues: SubtitleCue[] = useMemo(() => subtitleTrack?.cues ?? [], [subtitleTrack]);
  const translationImproved = Boolean(subtitleTrack?.translationImproved);
  const learningTips: LearningTip[] = subtitleTrack?.learningTips ?? [];
  const drillWords: string[] = subtitleTrack?.drillWords ?? [];
  const progress: LessonProgress | null = progressQuery.data ?? null;
  const quiz: PublicQuestion[] = useMemo(() => quizQuery.data?.questions ?? [], [quizQuery.data]);

  // Recommendation list (Up Next) — only fires once we know the lesson's HSK.
  const recommendedQuery = useQuery({
    queryKey: ['lesson-recommendations', lesson?.hsk ?? 0, lessonId],
    queryFn: ({ signal }) =>
      listPublishedLessons({ limit: 6, hsk: lesson?.hsk, signal }).then((catalog) =>
        catalog.items.filter((item) => item._id !== lessonId),
      ),
    enabled: Boolean(lesson && Number.isFinite(lesson.hsk)),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const recommendedLessons = recommendedQuery.data ?? [];

  // Mark media ready as soon as the lesson doc has a URL.
  useEffect(() => {
    if (lesson?.media?.url) {
      perfMarks.since('lesson_media:ready', 'watch_open:start', { lessonId });
    }
  }, [lesson?.media?.url, lessonId]);

  // Record learning activity for daily streak
  useEffect(() => {
    if (lessonId) {
      recordLearningActivity('video');
    }
  }, [lessonId]);

  const [currentMs, setCurrentMs] = useState(0);
  const [loading] = useState(false); // retained for type compatibility; no longer used to gate the player
  const [error] = useState('');

  // Explanation popover state
  const [explanation, setExplanation] = useState<WordExplanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explanationError, setExplanationError] = useState('');
  const [popoverAnchor, setPopoverAnchor] = useState<{
    x: number;
    y: number;
    cueId: string;
    wordId: string;
    wordText: string;
  } | null>(null);

  // Progress and quiz state
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizBusy, setQuizBusy] = useState(false);
  const [message, setMessage] = useState('');

  // YouTube layout interaction states
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'transcript' | 'vocabulary' | 'tips'>('transcript');
  const [searchCueQuery, setSearchCueQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSavedLesson, setIsSavedLesson] = useState(false);

  // Vocabulary tab detailed state & audio pronunciation
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);
  const [searchVocabQuery, setSearchVocabQuery] = useState('');
  const [vocabFilter, setVocabFilter] = useState<'all' | 'drill'>('all');
  const [vocabViewMode, setVocabViewMode] = useState<'list' | 'flashcard'>('list');
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [masteredWords, setMasteredWords] = useState<Set<string>>(new Set());
  const [selectedHskFilter, setSelectedHskFilter] = useState<number | null>(null);

  const playPronunciation = useCallback((text: string) => {
    setSpeakingWord(text);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.85;
      utterance.onend = () => setSpeakingWord(null);
      utterance.onerror = () => setSpeakingWord(null);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setSpeakingWord(null), 1200);
    }
  }, []);

  const pendingRange = useRef<{ start: number; end: number } | null>(null);
  const lastPosition = useRef<number | null>(null);
  const lastFlush = useRef(0);
  const progressRequest = useRef<Promise<void>>(Promise.resolve());
  const quizAttemptKey = useRef(crypto.randomUUID());

  const {
    prefs: subtitlePrefs,
    setTop: setSubtitleTop,
    setBottom: setSubtitleBottom,
    setStyle: setSubtitleStyle,
    setScale: setSubtitleScale,
  } = useSubtitlePreferences();

  const setSubtitleTracks = useCallback(
    (next: { top: SubtitleLanguageTrack; bottom: SubtitleLanguageTrack }) => {
      setSubtitleTop(next.top);
      setSubtitleBottom(next.bottom);
    },
    [setSubtitleTop, setSubtitleBottom],
  );

  const flushProgress = (position: number) => {
    const range = pendingRange.current;
    pendingRange.current = null;
    lastFlush.current = Date.now();
    if (!range) return;
    const duration = lesson?.durationSeconds ?? position;
    const boundedPosition = Math.min(Math.max(position, 0), duration);
    progressRequest.current = progressRequest.current
      .catch(() => undefined)
      .then(async () => {
        const res = await updateLessonProgress(lessonId, {
          positionSeconds: boundedPosition,
          watchedRange: { start: Math.max(0, range.start), end: Math.min(range.end, duration) },
          activeStudyDeltaSeconds: Math.min(120, Math.max(0, Math.round(range.end - range.start))),
        });
        if (res?.isNewCompletion && (res.xpEarned || 50) > 0) {
          awardXP(res.xpEarned || 50, 'Hoàn thành bài học video (+50 XP)', 'lesson');
          recordLearningActivity('video');
        }
        // Refresh the cached progress in the background so coverage/completed
        // reflects the latest write, without blocking playback.
        void queryClient.invalidateQueries({ queryKey: lessonQueryKeys.progress(lessonId) });
        window.dispatchEvent(new Event('hanflix:activity-updated'));
      })
      .catch(() => setMessage('Chưa lưu được tiến độ. Hãy thử phát lại video.'));
  };

  useEffect(() => {
    perfMarks.mark('watch_open:start', { lessonId });
    // Reset transient state when navigating between lessons so we never
    // confuse lesson A's modal/quiz state with lesson B's.
    hasUserInitiatedPlayRef.current = false;
    setCurrentMs(0);
    setQuizResult(null);
    setQuizOpen(false);
    setAnswers({});
    quizAttemptKey.current = crypto.randomUUID();
  }, [lessonId]);

  const activeCue = cues.find((cue) => cue.startMs <= currentMs && currentMs < cue.endMs);

  // Close the explanation popover when the active cue changes
  const activeCueId = activeCue?.cueId;
  useEffect(() => {
    setPopoverAnchor((previous) => (previous && previous.cueId === activeCueId ? previous : null));
  }, [activeCueId]);

  // Auto-scroll transcript container to active cue
  useEffect(() => {
    if (autoScroll && activeCueRef.current) {
      activeCueRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeCueId, autoScroll]);

  const onVideoTimeUpdate = (video: HTMLVideoElement) => {
    const position = video.currentTime;
    setCurrentMs(position * 1000);
    const previous = lastPosition.current;
    lastPosition.current = position;
    if (video.paused || previous === null) return;
    const delta = position - previous;
    if (delta <= 0 || delta > 3) return;
    const pending = pendingRange.current;
    if (pending && previous - pending.end < 1) pending.end = position;
    else {
      if (pending) flushProgress(previous);
      pendingRange.current = { start: previous, end: position };
    }
    if (Date.now() - lastFlush.current > 15000) flushProgress(position);
  };

  const submitQuiz = async () => {
    if (quiz.some((question) => !answers[question.questionId]?.trim())) {
      setMessage('Hãy trả lời tất cả câu hỏi trước khi nộp.');
      return;
    }
    setQuizBusy(true);
    setMessage('');
    try {
      const result = await submitLessonQuiz(
        lessonId,
        quiz.map((question) => ({
          questionId: question.questionId,
          ...(question.type === 'multiple_choice'
            ? { selectedOptionId: answers[question.questionId] }
            : { textAnswer: answers[question.questionId] }),
        })),
        quizAttemptKey.current,
      );
      setQuizResult(result);
      const earnedXP = result.xpEarned || (result.score === 100 ? 50 : result.score >= 80 ? 40 : 25);
      awardXP(earnedXP, `Hoàn thành bài tập Quiz (+${earnedXP} XP)`, 'quiz');
      recordLearningActivity('practice');
      window.dispatchEvent(new Event('hanflix:activity-updated'));
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : 'Không thể nộp bài.');
    } finally {
      setQuizBusy(false);
    }
  };

  const saveWord = async (cueId: string, wordId: string) => {
    setMessage('');
    try {
      await saveSubtitleWord(wordId, lessonId, cueId);
      notify.success('Đã lưu từ vào sổ ôn tập.');
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : 'Không thể lưu từ.');
    }
  };

  const closePopover = () => {
    setPopoverAnchor(null);
    setExplanation(null);
    setExplanationError('');
    setExplaining(false);
  };

  const requestExplanation = async (
    cueId: string,
    wordId: string,
    wordText: string,
    event: React.MouseEvent,
  ) => {
    setPopoverAnchor({ x: event.clientX, y: event.clientY, cueId, wordId, wordText });
    setExplaining(true);
    setExplanation(null);
    setExplanationError('');
    try {
      setExplanation(await explainWord(lessonId, cueId, wordId));
    } catch (requestError) {
      setExplanationError(
        requestError instanceof ApiRequestError
          ? requestError.message
          : 'Không thể giải thích từ này lúc này.',
      );
    } finally {
      setExplaining(false);
    }
  };

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const formatTimestamp = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const filteredCues = cues.filter((cue) => {
    if (!searchCueQuery.trim()) return true;
    const query = searchCueQuery.toLowerCase().trim();
    return (
      (cue.zh && cue.zh.toLowerCase().includes(query)) ||
      (cue.pinyin && cue.pinyin.toLowerCase().includes(query)) ||
      (cue.vi && cue.vi.toLowerCase().includes(query))
    );
  });

  interface DetailedVocabItem {
    key: string;
    word: string;
    pinyin?: string;
    hanViet?: string;
    meaningVi?: string;
    partOfSpeech?: string;
    hsk?: number;
    occurrences: number;
    collocations?: string[];
    isDrill: boolean;
    cueId?: string;
    wordId?: string;
    startMs?: number;
    contextZh?: string;
    contextPinyin?: string;
    contextVi?: string;
  }

  const detailedVocabList = useMemo(() => {
    const map = new Map<string, DetailedVocabItem>();

    const enrich = (word: string, partial: Partial<DetailedVocabItem>): DetailedVocabItem => {
      const dict = enrichVocabItem(word, {
        pinyin: partial.pinyin,
        meaningVi: partial.meaningVi,
        partOfSpeech: partial.partOfSpeech,
        hanViet: partial.hanViet,
        hsk: partial.hsk,
      });
      return {
        key: word,
        word,
        pinyin: partial.pinyin || dict.pinyin,
        hanViet: partial.hanViet || dict.hanViet,
        meaningVi: partial.meaningVi || dict.meaningVi,
        partOfSpeech: partial.partOfSpeech || dict.partOfSpeech,
        hsk: partial.hsk || dict.hsk,
        collocations: dict.collocations,
        occurrences: partial.occurrences || 1,
        isDrill: Boolean(partial.isDrill || drillWords.includes(word)),
        cueId: partial.cueId,
        wordId: partial.wordId,
        startMs: partial.startMs,
        contextZh: partial.contextZh,
        contextPinyin: partial.contextPinyin,
        contextVi: partial.contextVi,
      };
    };

    // 1. Process cues with tokens that have wordId or text
    cues.forEach((cue) => {
      cue.tokens?.forEach((token) => {
        const text = token.text.trim();
        if (!text || text.length < 1) return;
        if (/^[\p{P}\p{S}]+$/u.test(text)) return;

        const isDrill = drillWords.includes(text);
        const wordId = token.wordId?._id;
        const pinyin = token.wordId?.pinyin;
        const meaningVi = token.wordId?.meaningVi;
        const partOfSpeech = token.wordId?.partOfSpeech;

        const existing = map.get(text);
        if (!existing) {
          map.set(
            text,
            enrich(text, {
              wordId,
              pinyin,
              meaningVi,
              partOfSpeech,
              isDrill,
              cueId: cue.cueId,
              startMs: cue.startMs,
              contextZh: cue.zh,
              contextPinyin: cue.pinyin,
              contextVi: cue.vi,
              occurrences: 1,
            }),
          );
        } else {
          existing.occurrences += 1;
          if (!existing.wordId && wordId) existing.wordId = wordId;
          if (!existing.pinyin && pinyin) existing.pinyin = pinyin;
          if (!existing.meaningVi && meaningVi) existing.meaningVi = meaningVi;
          if (!existing.partOfSpeech && partOfSpeech) existing.partOfSpeech = partOfSpeech;
          if (!existing.isDrill && isDrill) existing.isDrill = true;
        }
      });
    });

    // 2. Scan cue text for common vocabulary in dictionary
    Object.keys(COMMON_VOCAB_DB).forEach((dictWord) => {
      let occurrences = 0;
      let matchingCue: SubtitleCue | undefined;

      cues.forEach((c) => {
        if (c.zh && c.zh.includes(dictWord)) {
          occurrences += 1;
          if (!matchingCue) matchingCue = c;
        }
      });

      if (occurrences > 0 || drillWords.includes(dictWord)) {
        const existing = map.get(dictWord);
        if (!existing) {
          map.set(
            dictWord,
            enrich(dictWord, {
              occurrences: Math.max(occurrences, 1),
              isDrill: drillWords.includes(dictWord),
              cueId: matchingCue?.cueId,
              startMs: matchingCue?.startMs,
              contextZh: matchingCue?.zh,
              contextPinyin: matchingCue?.pinyin,
              contextVi: matchingCue?.vi,
            }),
          );
        } else {
          existing.occurrences = Math.max(existing.occurrences, occurrences);
          if (!existing.meaningVi || !existing.hanViet) {
            const enriched = enrich(dictWord, existing);
            map.set(dictWord, enriched);
          }
        }
      }
    });

    // 3. Ensure all drillWords from AI tips are included & enriched
    drillWords.forEach((word) => {
      const cue = cues.find((c) => c.zh && c.zh.includes(word));
      const existing = map.get(word);
      if (!existing) {
        map.set(
          word,
          enrich(word, {
            isDrill: true,
            cueId: cue?.cueId,
            startMs: cue?.startMs,
            contextZh: cue?.zh,
            contextPinyin: cue?.pinyin,
            contextVi: cue?.vi,
            occurrences: 1,
          }),
        );
      } else {
        existing.isDrill = true;
      }
    });

    // Sort: drill words first, then higher frequency, then alphabetical
    return Array.from(map.values()).sort((a, b) => {
      if (a.isDrill && !b.isDrill) return -1;
      if (!a.isDrill && b.isDrill) return 1;
      if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
      return a.word.localeCompare(b.word);
    });
  }, [cues, drillWords]);

  const filteredVocabList = useMemo(() => {
    return detailedVocabList.filter((item) => {
      if (vocabFilter === 'drill' && !item.isDrill) return false;
      if (selectedHskFilter !== null && item.hsk !== selectedHskFilter) return false;
      if (!searchVocabQuery.trim()) return true;
      const q = searchVocabQuery.toLowerCase().trim();
      return (
        item.word.toLowerCase().includes(q) ||
        (item.pinyin && item.pinyin.toLowerCase().includes(q)) ||
        (item.hanViet && item.hanViet.toLowerCase().includes(q)) ||
        (item.meaningVi && item.meaningVi.toLowerCase().includes(q)) ||
        (item.contextVi && item.contextVi.toLowerCase().includes(q))
      );
    });
  }, [detailedVocabList, vocabFilter, selectedHskFilter, searchVocabQuery]);


  return (
    <div className="w-full max-w-[1720px] mx-auto space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Top Breadcrumbs & Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 min-h-[44px] rounded-xl bg-white border border-[#E7E7EA] hover:border-[#B91B1C]/30 hover:bg-[#FFF5F5] text-xs sm:text-sm font-semibold text-[#18181B] shadow-2xs transition-all cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 text-[#5F6368] group-hover:-translate-x-0.5 group-hover:text-[#B91B1C] transition-transform" />
          <span>Quay lại gợi ý</span>
        </button>

        {lesson && (
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-[#18181B] text-white font-bold tracking-wide">
              HSK {lesson.hsk}
            </span>
            <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-white border border-[#E7E7EA] text-[#5F6368] font-semibold">
              Bài học đã xuất bản
            </span>
            <AiImprovedBadge visible={translationImproved} size="sm" />
          </div>
        )}
      </div>

      {lessonQuery.isPending && (
        <div className="rounded-3xl bg-white border border-[#E7E7EA] p-8 text-center shadow-xs">
          <div className="inline-block w-8 h-8 border-3 border-[#B91B1C] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-semibold text-[#5F6368]">Đang tải video bài học…</p>
        </div>
      )}

      {lessonQuery.error && (
        <div className="my-4">
          <InlineBanner variant="error" message={lessonQuery.error instanceof ApiRequestError ? lessonQuery.error.message : 'Không thể tải bài học.'} />
        </div>
      )}

      {/* Subtitle / progress / quiz banners render only AFTER the player
          has a chance to play, so a slow API never blocks the video. */}
      {lesson && subtitlesQuery.isError && (
        <div className="my-2">
          <InlineBanner variant="warning" message="Không thể tải phụ đề. Vẫn có thể xem video." />
        </div>
      )}
      {lesson && quizQuery.isError && (
        <div className="my-2">
          <InlineBanner variant="warning" message="Không thể tải bài tập. Có thể thử lại sau." />
        </div>
      )}
      {lesson && progressQuery.isError && (
        <div className="my-2">
          <InlineBanner variant="warning" message="Không thể đồng bộ tiến độ." />
        </div>
      )}

      {/* Word save notifications: now handled by global toast system */}

      {lesson && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 xl:gap-6 items-start">
          {/* ================= LEFT / THEATER COLUMN (YouTube Primary Stage) ================= */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4 min-w-0">
            {/* 1. Video Player Container — chọn player theo contentMode */}
            {lesson.media?.url ? (
              <>
                {lesson.contentMode === 'song' && (
                  <KaraokePlayer
                    src={lesson.media.url}
                    title={lesson.titleVi}
                    durationSeconds={lesson.durationSeconds}
                    cues={cues}
                    videoRef={videoRef}
                    onSeeking={() => {
                      if (videoRef.current) flushProgress(videoRef.current.currentTime);
                      lastPosition.current = null;
                    }}
                    onPause={() => { if (videoRef.current) flushProgress(videoRef.current.currentTime); }}
                    onLoadedMetadata={(event) => {
                      if (hasUserInitiatedPlayRef.current) return;
                      hasUserInitiatedPlayRef.current = true;
                      if (progress?.lastPositionSeconds && progress.lastPositionSeconds < lesson.durationSeconds - 2) event.currentTarget.currentTime = progress.lastPositionSeconds;
                    }}
                    onTimeUpdate={onVideoTimeUpdate}
                    onEnded={() => {
                      flushProgress(lesson.durationSeconds);
                      if (quiz.length) setQuizOpen(true);
                    }}
                  />
                )}
                {lesson.contentMode === 'podcast' && (
                  <PodcastPlayer
                    src={lesson.media.url}
                    posterUrl={lesson.thumbnailUrl ?? undefined}
                    title={lesson.titleVi}
                    durationSeconds={lesson.durationSeconds}
                    cues={cues}
                    chapters={lesson.chapters}
                    videoRef={videoRef}
                    onSeeking={() => {
                      if (videoRef.current) flushProgress(videoRef.current.currentTime);
                      lastPosition.current = null;
                    }}
                    onPause={() => { if (videoRef.current) flushProgress(videoRef.current.currentTime); }}
                    onLoadedMetadata={(event) => {
                      if (hasUserInitiatedPlayRef.current) return;
                      hasUserInitiatedPlayRef.current = true;
                      if (progress?.lastPositionSeconds && progress.lastPositionSeconds < lesson.durationSeconds - 2) event.currentTarget.currentTime = progress.lastPositionSeconds;
                    }}
                    onTimeUpdate={onVideoTimeUpdate}
                    onEnded={() => {
                      flushProgress(lesson.durationSeconds);
                      if (quiz.length) setQuizOpen(true);
                    }}
                  />
                )}
                {lesson.contentMode === 'drama' && (
                  <DramaPlayer
                    src={lesson.media.url}
                    title={lesson.titleVi}
                    durationSeconds={lesson.durationSeconds}
                    cues={cues}
                    characters={lesson.characters}
                    onTokenClick={(cueId, wordId, wordText, event) => void requestExplanation(cueId, wordId, wordText, event)}
                    currentMs={currentMs}
                    videoRef={videoRef}
                    onSeeking={() => {
                      if (videoRef.current) flushProgress(videoRef.current.currentTime);
                      lastPosition.current = null;
                    }}
                    onPause={() => { if (videoRef.current) flushProgress(videoRef.current.currentTime); }}
                    onLoadedMetadata={(event) => {
                      if (hasUserInitiatedPlayRef.current) return;
                      hasUserInitiatedPlayRef.current = true;
                      if (progress?.lastPositionSeconds && progress.lastPositionSeconds < lesson.durationSeconds - 2) event.currentTarget.currentTime = progress.lastPositionSeconds;
                    }}
                    onTimeUpdate={(video) => {
                      setCurrentMs(video.currentTime * 1000);
                      onVideoTimeUpdate(video);
                    }}
                    onEnded={() => {
                      flushProgress(lesson.durationSeconds);
                      if (quiz.length) setQuizOpen(true);
                    }}
                  />
                )}
                {(lesson.contentMode === 'lesson' || !lesson.contentMode) && (
                  <YouTubePlayer
                    src={lesson.media.url}
                    title={lesson.titleVi}
                    durationSeconds={lesson.durationSeconds}
                    cues={cues}
                    currentMs={currentMs}
                    topTrack={subtitlePrefs.top}
                    bottomTrack={subtitlePrefs.bottom}
                    subtitleStyle={subtitlePrefs.style}
                    subtitleScale={subtitlePrefs.scale}
                    videoRef={videoRef}
                    onSubtitleChange={(next) => {
                      setSubtitleTop(next.top);
                      setSubtitleBottom(next.bottom);
                      if (next.style) setSubtitleStyle(next.style);
                      if (next.scale) setSubtitleScale(next.scale);
                    }}
                    onTimeUpdate={onVideoTimeUpdate}
                    onSeeking={() => {
                      if (videoRef.current) {
                        flushProgress(videoRef.current.currentTime);
                        lastPosition.current = null;
                      }
                    }}
                    onPause={() => {
                      if (videoRef.current) flushProgress(videoRef.current.currentTime);
                    }}
                    onEnded={() => {
                      flushProgress(lesson.durationSeconds);
                      setQuizOpen(true);
                    }}
                    onLoadedMetadata={(event) => {
                      if (hasUserInitiatedPlayRef.current) return;
                      hasUserInitiatedPlayRef.current = true;
                      if (
                        progress?.lastPositionSeconds &&
                        progress.lastPositionSeconds > 1 &&
                        progress.lastPositionSeconds < lesson.durationSeconds - 2
                      ) {
                        event.currentTarget.currentTime = progress.lastPositionSeconds;
                      }
                    }}
                    onTokenClick={(cueId, wordId, wordText, event) =>
                      void requestExplanation(cueId, wordId, wordText, event)
                    }
                    onSaveWord={(cueId, wordId) => void saveWord(cueId, wordId)}
                  />
                )}
              </>
            ) : (
              <div className="w-full aspect-video rounded-2xl md:rounded-3xl bg-neutral-900 flex flex-col items-center justify-center p-8 text-white border border-[#E7E7EA] shadow-xl">
                <p className="text-sm font-medium">Nội dung chưa sẵn sàng để phát.</p>
              </div>
            )}

            {/* 2. Video Title & Headline */}
            <div className="space-y-1.5 pt-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#18181B] tracking-tight leading-snug">
                {lesson.titleVi}
              </h1>
              {(lesson.titleZh || lesson.pinyin) && (
                <p className="text-sm sm:text-base text-[#5F6368] font-medium flex flex-wrap items-center gap-2">
                  {lesson.titleZh && (
                    <span className="font-hanzi font-bold text-[#18181B]">{lesson.titleZh}</span>
                  )}
                  {lesson.titleZh && lesson.pinyin && <span className="text-[#8B9097]">·</span>}
                  {lesson.pinyin && (
                    <span className="font-mono text-xs sm:text-sm text-[#B91B1C]">
                      {lesson.pinyin}
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* 3. YouTube Channel Row & Pill Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E7E7EA]">
              {/* Creator / Channel info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white border border-[#E7E7EA] flex items-center justify-center shrink-0 p-1.5 shadow-2xs">
                  <img
                    src="/favicon.png"
                    alt="HanFlix Academy"
                    className="w-full h-full object-contain select-none"
                    onError={(e) => {
                      // Fallback icon if favicon isn't loaded
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="text-xs font-black text-[#B91B1C] flex items-center justify-center">
                    汉
                  </div>
                </div>
                <div>
                  <div className="font-extrabold text-sm text-[#18181B] flex items-center gap-1.5">
                    <span>HanFlix Academy</span>
                    <span
                      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#B91B1C] text-white text-[9px] font-bold"
                      title="Verified Channel"
                    >
                      ✓
                    </span>
                  </div>
                  <p className="text-xs text-[#5F6368]">
                    HSK {lesson.hsk} · Bài học tương tác
                    {progress && (
                      <span className="ml-1.5 text-[#188A5A] font-semibold">
                        · Đã xem {Math.round(progress.coverage * 100)}%
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* YouTube-style Pill Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Primary Practice Button (Opens Quiz Modal) */}
                {quiz.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setQuizOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
                  >
                    <BookOpenCheck className="w-4 h-4 text-white" />
                    <span>{quizResult ? 'Xem kết quả bài tập' : 'Làm bài luyện tập'}</span>
                    <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-white/20 text-[11px] font-mono">
                      {quiz.length}
                    </span>
                  </button>
                )}

                {/* 2. Ask AI Button */}
                <button
                  type="button"
                  onClick={() => {
                    const prompt = `Hãy giải thích ngữ pháp, từ vựng và mẹo học cho bài "${lesson.titleVi}" (${lesson.titleZh ?? ''})`;
                    if (onAskAI) {
                      onAskAI(prompt);
                    } else {
                      window.dispatchEvent(
                        new CustomEvent('hanflix:open-ai', { detail: { prompt } }),
                      );
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#F7F7F9] hover:bg-[#ECECED] border border-[#E7E7EA] text-[#18181B] text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  title="Hỏi trợ lý AI Panda"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#E7A92F]" />
                  <span>Hỏi AI</span>
                </button>

                {/* 3. Bookmark / Save Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSavedLesson((prev) => !prev);
                    notify.success(isSavedLesson ? 'Đã bỏ lưu bài học.' : 'Đã lưu bài học vào sổ tay.');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border shadow-2xs ${
                    isSavedLesson
                      ? 'bg-[#FDF1F1] text-[#B91B1C] border-[#B91B1C]/30'
                      : 'bg-[#F7F7F9] hover:bg-[#ECECED] border-[#E7E7EA] text-[#18181B]'
                  }`}
                  title={isSavedLesson ? 'Đã lưu bài học' : 'Lưu bài học'}
                >
                  <Bookmark
                    className={`w-3.5 h-3.5 ${isSavedLesson ? 'fill-current text-[#B91B1C]' : 'text-[#5F6368]'}`}
                  />
                  <span>{isSavedLesson ? 'Đã lưu' : 'Lưu bài'}</span>
                </button>

                {/* 4. Share Button */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#F7F7F9] hover:bg-[#ECECED] border border-[#E7E7EA] text-[#5F6368] hover:text-[#18181B] text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  title="Chia sẻ liên kết"
                >
                  {copiedLink ? (
                    <Check className="w-3.5 h-3.5 text-[#188A5A]" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedLink ? 'Đã sao chép' : 'Chia sẻ'}</span>
                </button>
              </div>
            </div>

            {/* 4. YouTube Collapsible Description Box */}
            <div
              onClick={() => setIsDescriptionExpanded((prev) => !prev)}
              className="p-4 rounded-2xl bg-[#F7F7F9] hover:bg-[#F2F2F5] transition-colors border border-[#E7E7EA] cursor-pointer space-y-2 text-xs"
            >
              {/* Header stats & expand toggle */}
              <div className="flex items-center justify-between font-bold text-[#18181B]">
                <div className="flex flex-wrap items-center gap-2 text-[#5F6368]">
                  <span className="font-semibold text-[#18181B]">
                    {lesson.durationSeconds
                      ? `${Math.floor(lesson.durationSeconds / 60)}:${String(lesson.durationSeconds % 60).padStart(2, '0')}`
                      : '0:00'}
                  </span>
                  <span>•</span>
                  <span>
                    {progress
                      ? `Đã học ${Math.round(progress.coverage * 100)}%`
                      : 'Chưa có tiến độ'}
                  </span>
                  <span>•</span>
                  <span className="text-[#B91B1C] font-semibold">#HSK{lesson.hsk}</span>
                  <span className="text-[#B91B1C] font-semibold">#TiengTrung</span>
                </div>

                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-bold text-[#18181B] hover:text-[#B91B1C] text-xs cursor-pointer"
                >
                  <span>{isDescriptionExpanded ? 'Rút gọn' : 'Hiện thêm'}</span>
                  {isDescriptionExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Description Content */}
              <p
                className={`text-[#5F6368] leading-relaxed ${
                  isDescriptionExpanded ? '' : 'line-clamp-2'
                }`}
              >
                {lesson.descriptionVi ||
                  'Video học tiếng Trung tương tác cùng HanFlix: luyện nghe phát âm chuẩn, ghi nhớ từ vựng qua phụ đề song ngữ và củng cố phản xạ tự nhiên.'}
              </p>

              {/* Expanded Extra Details */}
              {isDescriptionExpanded && (
                <div
                  className="pt-3 border-t border-[#E7E7EA] space-y-2 text-xs text-[#5F6368] animate-in fade-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="font-bold text-[#18181B]">💡 Hướng dẫn học tập:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Bấm vào các từ Hán tự trên phụ đề để tra cứu và xem giải thích ngữ nghĩa.</li>
                    <li>Xem chi tiết tại tab <strong>Mẹo học ({learningTips.length})</strong> ở bảng phụ đề bên phải.</li>
                    <li>Hoàn thành bài tập trắc nghiệm sau video để củng cố kiến thức và ghi nhận tiến độ.</li>
                  </ul>
                </div>
              )}
            </div>


            {message && (
              <p
                role="status"
                className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs font-semibold text-amber-900"
              >
                {message}
              </p>
            )}
          </div>

          {/* ================= RIGHT COLUMN: Subtitles & Up Next (YouTube Sidebar) ================= */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4 min-w-0">
            {/* 1. Interactive Transcript / Vocabulary Card */}
            <div className="bg-white rounded-3xl border border-[#E7E7EA] shadow-xs overflow-hidden flex flex-col">
              {/* Tabs Bar */}
              <div className="flex border-b border-[#E7E7EA] bg-[#F7F7F9]">
                <button
                  type="button"
                  onClick={() => setActiveTab('transcript')}
                  className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    activeTab === 'transcript'
                      ? 'border-[#B91B1C] text-[#B91B1C] bg-white'
                      : 'border-transparent text-[#5F6368] hover:text-[#18181B]'
                  }`}
                >
                  Phụ đề ({cues.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('vocabulary')}
                  className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    activeTab === 'vocabulary'
                      ? 'border-[#B91B1C] text-[#B91B1C] bg-white'
                      : 'border-transparent text-[#5F6368] hover:text-[#18181B]'
                  }`}
                >
                  Từ vựng ({detailedVocabList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('tips')}
                  className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    activeTab === 'tips'
                      ? 'border-[#B91B1C] text-[#B91B1C] bg-white'
                      : 'border-transparent text-[#5F6368] hover:text-[#18181B]'
                  }`}
                >
                  Mẹo học ({learningTips.length})
                </button>
              </div>

              {/* Sub-header inside transcript: Search & Auto-scroll toggle */}
              {activeTab === 'transcript' && (
                <div className="p-3 border-b border-[#E7E7EA] bg-[#FAFAFA] flex items-center justify-between gap-2 text-xs">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-[#8B9097] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchCueQuery}
                      onChange={(e) => setSearchCueQuery(e.target.value)}
                      placeholder="Tìm từ vựng, Hán tự, nghĩa…"
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-[#E7E7EA] bg-white text-xs outline-none focus:border-[#B91B1C] transition-all"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setAutoScroll((v) => !v)}
                    title={autoScroll ? 'Bật tự động cuộn' : 'Tắt tự động cuộn'}
                    className={`shrink-0 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      autoScroll
                        ? 'bg-[#FDF1F1] text-[#B91B1C] border-[#B91B1C]/30'
                        : 'bg-white text-[#5F6368] border-[#E7E7EA]'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${autoScroll ? 'bg-[#B91B1C] animate-pulse' : 'bg-neutral-400'}`}
                    />
                    <span>Cuộn tự động</span>
                  </button>
                </div>
              )}

              {/* Tab 1: Transcript View */}
              {activeTab === 'transcript' && (
                <div className="p-3 overflow-y-auto max-h-[480px] space-y-2.5">
                  {filteredCues.length === 0 ? (
                    <p className="text-xs text-[#5F6368] text-center py-6">
                      {searchCueQuery ? 'Không tìm thấy câu phù hợp.' : 'Bài học chưa có phụ đề khả dụng.'}
                    </p>
                  ) : (
                    filteredCues.map((cue) => {
                      const isActive = cue.cueId === activeCue?.cueId;
                      return (
                        <div
                          key={cue.cueId}
                          ref={isActive ? activeCueRef : null}
                          className={`p-3 rounded-2xl border transition-all ${
                            isActive
                              ? 'border-[#B91B1C] bg-[#FFF5F5] ring-2 ring-[#B91B1C]/20 shadow-2xs'
                              : 'border-[#E7E7EA] bg-[#F7F7F9] hover:bg-[#F2F2F5]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (videoRef.current) {
                                  videoRef.current.currentTime = cue.startMs / 1000;
                                  void videoRef.current.play();
                                }
                              }}
                              className="inline-flex items-center gap-1 font-mono font-bold text-[#B91B1C] hover:underline cursor-pointer"
                            >
                              <Clock className="w-3 h-3" />
                              <span>{formatTimestamp(cue.startMs)}</span>
                            </button>

                            {isActive && (
                              <span className="text-[10px] font-bold text-[#B91B1C] px-2 py-0.5 rounded-full bg-white border border-[#B91B1C]/20">
                                Đang phát
                              </span>
                            )}
                          </div>

                          {/* Chinese Text with Token explanation clickability */}
                          <p className="text-base font-bold text-[#18181B] font-hanzi leading-relaxed">
                            {cue.tokens?.length
                              ? cue.tokens.map((token, index) =>
                                  token.wordId?._id ? (
                                    <span key={`${cue.cueId}-${index}`}>
                                      <button
                                        type="button"
                                        onClick={(event) =>
                                          void requestExplanation(
                                            cue.cueId,
                                            token.wordId!._id,
                                            token.text,
                                            event,
                                          )
                                        }
                                        className="hover:text-[#B91B1C] hover:underline cursor-pointer transition-colors"
                                        title={`Bấm để xem giải thích: ${token.text}`}
                                      >
                                        {token.text}
                                      </button>
                                    </span>
                                  ) : (
                                    <span key={`${cue.cueId}-${index}`}>{token.text}</span>
                                  ),
                                )
                              : cue.zh}
                          </p>

                          {cue.pinyin && (
                            <p className="text-xs text-[#8B9097] font-mono mt-0.5">{cleanPinyinText(cue.pinyin)}</p>
                          )}
                          {cue.vi && (
                            <p className="text-xs text-[#5F6368] font-medium mt-1">
                              {stripTrailingPunctuation(cue.vi)}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tab 2: Detailed Vocabulary List & Flashcard Mode */}
              {activeTab === 'vocabulary' && (
                <div className="flex flex-col h-[520px]">
                  {/* Search and Filters inside Vocabulary tab */}
                  <div className="p-3 border-b border-[#E7E7EA] bg-[#FAFAFA] space-y-2.5 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-[#8B9097] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={searchVocabQuery}
                          onChange={(e) => setSearchVocabQuery(e.target.value)}
                          placeholder="Tìm chữ Hán, pinyin, Hán-Việt hoặc nghĩa…"
                          className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-[#E7E7EA] bg-white text-xs outline-none focus:border-[#B91B1C] transition-all"
                        />
                      </div>

                      {/* Toggle List View vs Flashcard View */}
                      <div className="flex items-center p-0.5 rounded-xl bg-neutral-200 border border-neutral-300/60 shrink-0">
                        <button
                          type="button"
                          onClick={() => setVocabViewMode('list')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            vocabViewMode === 'list'
                              ? 'bg-white text-[#18181B] shadow-3xs'
                              : 'text-neutral-600 hover:text-neutral-900'
                          }`}
                          title="Xem danh sách chi tiết"
                        >
                          <BookOpenCheck className="w-3 h-3 text-[#B91B1C]" />
                          <span>Chi tiết</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setVocabViewMode('flashcard');
                            setIsCardFlipped(false);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            vocabViewMode === 'flashcard'
                              ? 'bg-white text-[#18181B] shadow-3xs'
                              : 'text-neutral-600 hover:text-neutral-900'
                          }`}
                          title="Luyện tập với Flashcard"
                        >
                          <Layers className="w-3 h-3 text-[#B91B1C]" />
                          <span>Flashcard</span>
                        </button>
                      </div>
                    </div>

                    {/* Filter Pills: Tất cả, Trọng tâm, HSK Levels */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setVocabFilter('all');
                            setSelectedHskFilter(null);
                          }}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                            vocabFilter === 'all' && selectedHskFilter === null
                              ? 'bg-[#18181B] text-white'
                              : 'bg-white border border-[#E7E7EA] text-[#5F6368] hover:text-[#18181B]'
                          }`}
                        >
                          Tất cả ({detailedVocabList.length})
                        </button>
                        {drillWords.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setVocabFilter('drill');
                              setSelectedHskFilter(null);
                            }}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                              vocabFilter === 'drill'
                                ? 'bg-[#B91B1C] text-white'
                                : 'bg-white border border-[#E7E7EA] text-[#B91B1C] hover:bg-[#FFF5F5]'
                            }`}
                          >
                            <Sparkles className="w-3 h-3 text-[#E7A92F]" />
                            <span>Trọng tâm ({drillWords.length})</span>
                          </button>
                        )}

                        {/* Quick HSK Filters */}
                        {[1, 2, 3].map((lvl) => {
                          const count = detailedVocabList.filter((v) => v.hsk === lvl).length;
                          if (count === 0) return null;
                          return (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => {
                                setSelectedHskFilter((prev) => (prev === lvl ? null : lvl));
                                setVocabFilter('all');
                              }}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                                selectedHskFilter === lvl
                                  ? 'bg-[#1D4ED8] text-white'
                                  : 'bg-white border border-[#DBEAFE] text-[#1D4ED8] hover:bg-[#EFF6FF]'
                              }`}
                            >
                              HSK {lvl} ({count})
                            </button>
                          );
                        })}
                      </div>

                      <span className="text-[11px] text-[#8B9097] font-medium">
                        {filteredVocabList.length} từ khả dụng
                      </span>
                    </div>
                  </div>

                  {/* Mode 1: Detailed Cards List View */}
                  {vocabViewMode === 'list' && (
                    <div className="p-3 overflow-y-auto flex-1 space-y-3">
                      {filteredVocabList.length === 0 ? (
                        <p className="text-xs text-[#5F6368] text-center py-8">
                          {searchVocabQuery
                            ? 'Không tìm thấy từ vựng phù hợp với tìm kiếm.'
                            : 'Chưa có dữ liệu từ vựng cho bài học này.'}
                        </p>
                      ) : (
                        filteredVocabList.map((item) => (
                          <div
                            key={item.key}
                            className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                              item.isDrill
                                ? 'border-[#FDE68A] bg-linear-to-b from-[#FFFDF5] to-white shadow-2xs'
                                : 'border-[#E7E7EA] bg-[#FDFDFD] hover:bg-white hover:border-[#B91B1C]/40 hover:shadow-xs'
                            }`}
                          >
                            {/* Top Row: Hanzi, Pinyin, Hán-Việt, Tags, Audio & Action Buttons */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-baseline gap-2">
                                  {/* Large Chinese Character */}
                                  <span className="text-2xl font-bold font-hanzi text-[#18181B] tracking-wide">
                                    {item.word}
                                  </span>

                                  {/* Pinyin badge */}
                                  {item.pinyin && (
                                    <span className="font-mono text-xs font-bold text-[#B91B1C] bg-[#FFF5F5] px-2 py-0.5 rounded-md border border-[#F5B8B9]">
                                      {item.pinyin}
                                    </span>
                                  )}

                                  {/* Hán-Việt badge */}
                                  {item.hanViet && (
                                    <span
                                      className="text-[11px] font-bold text-[#713F12] bg-[#FEF3C7] px-2 py-0.5 rounded-md border border-[#FDE68A]"
                                      title="Âm Hán-Việt"
                                    >
                                      [{item.hanViet}]
                                    </span>
                                  )}

                                  {/* HSK badge */}
                                  {item.hsk && (
                                    <span className="text-[10px] font-bold text-[#1E40AF] bg-[#EFF6FF] px-1.5 py-0.5 rounded border border-[#DBEAFE]">
                                      HSK {item.hsk}
                                    </span>
                                  )}

                                  {/* Part of Speech badge */}
                                  {item.partOfSpeech && (
                                    <span className="text-[10px] font-semibold text-[#52525B] bg-[#F4F4F5] px-1.5 py-0.5 rounded border border-[#E4E4E7]">
                                      {item.partOfSpeech}
                                    </span>
                                  )}

                                  {/* Core AI drill badge */}
                                  {item.isDrill && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] px-2 py-0.5 rounded-full">
                                      <Sparkles className="w-2.5 h-2.5 text-[#E7A92F]" />
                                      Trọng tâm
                                    </span>
                                  )}
                                </div>

                                {/* Frequency & Status Info */}
                                <div className="text-[11px] text-[#71717A] flex items-center gap-2">
                                  <span>
                                    Xuất hiện trong bài:{' '}
                                    <strong className="text-[#18181B] font-semibold">
                                      {item.occurrences} lần
                                    </strong>
                                  </span>
                                  {masteredWords.has(item.word) && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                      <Check className="w-2.5 h-2.5" /> Đã thuộc
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Action Buttons: Audio, Save, AI Deep Explanation */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Pronunciation button */}
                                <button
                                  type="button"
                                  onClick={() => playPronunciation(item.word)}
                                  className={`p-2 rounded-full border transition-all cursor-pointer ${
                                    speakingWord === item.word
                                      ? 'bg-[#B91B1C] text-white border-[#B91B1C] scale-105 shadow-xs'
                                      : 'bg-white border-[#E7E7EA] text-[#5F6368] hover:text-[#B91B1C] hover:border-[#B91B1C]/30'
                                  }`}
                                  title={`Nghe phát âm chuẩn: ${item.word}`}
                                >
                                  <Volume2 className="w-3.5 h-3.5" />
                                </button>

                                {/* Save word button */}
                                {item.wordId && item.cueId && (
                                  <button
                                    type="button"
                                    onClick={() => void saveWord(item.cueId!, item.wordId!)}
                                    className="p-2 rounded-full bg-white border border-[#E7E7EA] text-[#5F6368] hover:text-[#B91B1C] hover:border-[#B91B1C]/30 transition-all cursor-pointer"
                                    title={`Lưu từ "${item.word}" vào sổ ôn tập`}
                                  >
                                    <Bookmark className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* AI explanation button */}
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    if (item.wordId && item.cueId) {
                                      void requestExplanation(
                                        item.cueId,
                                        item.wordId,
                                        item.word,
                                        event,
                                      );
                                    } else if (onAskAI) {
                                      onAskAI(
                                        `Hãy giải thích chi tiết từ vựng tiếng Trung: "${item.word}" (${item.pinyin || ''}) - Âm Hán-Việt: ${item.hanViet || ''}. Nghĩa là: "${item.meaningVi || ''}". Hãy phân tích cấu tạo chữ Hán, bộ thủ, cách nhớ dễ thuộc, các cụm từ phổ biến và 3 câu ví dụ giao tiếp.`,
                                      );
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#F7F7F9] hover:bg-[#FFF5F5] border border-[#E7E7EA] hover:border-[#B91B1C]/30 text-[#18181B] hover:text-[#B91B1C] text-[11px] font-bold transition-all cursor-pointer"
                                  title="Xem phân tích ngữ nghĩa, bộ thủ và cách nhớ từ AI"
                                >
                                  <Sparkles className="w-3 h-3 text-[#E7A92F]" />
                                  <span>Tra từ AI</span>
                                </button>
                              </div>
                            </div>

                            {/* Meaning in Vietnamese */}
                            <div className="bg-[#FAF9F6] px-3 py-2 rounded-xl border border-[#F0ECE1] text-xs">
                              <div className="flex items-baseline gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A16207]">
                                  Nghĩa:
                                </span>
                                <span className="text-xs font-semibold text-[#18181B]">
                                  {item.meaningVi || 'Đang cập nhật nghĩa chi tiết'}
                                </span>
                              </div>
                            </div>

                            {/* Collocations / Cụm từ hay gặp */}
                            {item.collocations && item.collocations.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                <span className="text-[11px] font-semibold text-[#71717A]">
                                  Cụm từ hay gặp:
                                </span>
                                {item.collocations.map((colloc, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[11px] font-hanzi font-medium text-[#18181B] bg-white border border-[#E4E4E7] px-2 py-0.5 rounded-lg shadow-3xs"
                                  >
                                    {colloc}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Bottom Row: Context Sentence from Lesson Video with Click-to-Jump */}
                            {item.contextZh && (
                              <div
                                onClick={() => {
                                  if (videoRef.current && item.startMs !== undefined) {
                                    videoRef.current.currentTime = item.startMs / 1000;
                                    void videoRef.current.play();
                                  }
                                }}
                                className="p-2.5 rounded-xl bg-[#F8F9FA] hover:bg-[#F2F4F7] border border-[#E5E7EB] transition-all cursor-pointer group space-y-1"
                                title="Bấm để phát lại đoạn này trong video"
                              >
                                <div className="flex items-center justify-between text-[10px] text-[#6B7280]">
                                  <span className="font-bold text-[#374151] flex items-center gap-1.5">
                                    <Play className="w-2.5 h-2.5 text-[#B91B1C] fill-[#B91B1C] group-hover:scale-110 transition-transform" />
                                    <span>Ngữ cảnh xuất hiện trong video:</span>
                                  </span>
                                  {item.startMs !== undefined && (
                                    <span className="font-mono font-bold text-[#B91B1C] bg-white px-2 py-0.5 rounded-md border border-[#E5E7EB] group-hover:border-[#B91B1C] transition-colors">
                                      {formatTimestamp(item.startMs)}
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs font-hanzi font-semibold text-[#111827]">
                                  {item.contextZh}
                                </p>

                                {item.contextPinyin && (
                                  <p className="text-[10px] font-mono text-[#6B7280]">
                                    {item.contextPinyin}
                                  </p>
                                )}

                                {item.contextVi && (
                                  <p className="text-[11px] text-[#4B5563]">
                                    {stripTrailingPunctuation(item.contextVi)}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Mode 2: Interactive Flashcard Study Mode */}
                  {vocabViewMode === 'flashcard' && (
                    <div className="p-3 overflow-y-auto flex-1 flex flex-col justify-between space-y-3">
                      {filteredVocabList.length === 0 ? (
                        <p className="text-xs text-[#5F6368] text-center py-8">
                          Không có thẻ từ vựng nào để ôn tập.
                        </p>
                      ) : (
                        (() => {
                          const currentCard =
                            filteredVocabList[
                              Math.min(flashcardIndex, filteredVocabList.length - 1)
                            ];
                          if (!currentCard) return null;

                          return (
                            <div className="flex flex-col h-full justify-between space-y-3">
                              {/* Header stats & progress */}
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-[#18181B]">
                                  Thẻ {flashcardIndex + 1} / {filteredVocabList.length}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMasteredWords((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(currentCard.word)) {
                                          next.delete(currentCard.word);
                                        } else {
                                          next.add(currentCard.word);
                                        }
                                        return next;
                                      });
                                    }}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                      masteredWords.has(currentCard.word)
                                        ? 'bg-emerald-500 text-white border-emerald-500'
                                        : 'bg-white text-neutral-600 border-[#E7E7EA] hover:border-emerald-500'
                                    }`}
                                  >
                                    <Check className="w-2.5 h-2.5" />
                                    <span>
                                      {masteredWords.has(currentCard.word)
                                        ? 'Đã thuộc'
                                        : 'Chưa thuộc'}
                                    </span>
                                  </button>
                                </div>
                              </div>

                              {/* Interactive Flip Card */}
                              <div
                                onClick={() => setIsCardFlipped((f) => !f)}
                                className={`relative min-h-[260px] flex-1 p-6 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between items-center text-center select-none ${
                                  isCardFlipped
                                    ? 'bg-linear-to-b from-[#FFF9F5] to-white border-[#B91B1C]/40 shadow-sm'
                                    : 'bg-white border-[#E7E7EA] hover:border-[#B91B1C]/30 shadow-xs'
                                }`}
                              >
                                {/* Top badges on card */}
                                <div className="w-full flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    {currentCard.hsk && (
                                      <span className="text-[10px] font-bold text-[#1E40AF] bg-[#EFF6FF] px-2 py-0.5 rounded-full border border-[#DBEAFE]">
                                        HSK {currentCard.hsk}
                                      </span>
                                    )}
                                    {currentCard.isDrill && (
                                      <span className="text-[10px] font-bold text-[#B45309] bg-[#FFFBEB] px-2 py-0.5 rounded-full border border-[#FDE68A] flex items-center gap-0.5">
                                        <Sparkles className="w-2.5 h-2.5 text-[#E7A92F]" />
                                        Trọng tâm
                                      </span>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      playPronunciation(currentCard.word);
                                    }}
                                    className="p-2 rounded-full bg-[#FDF1F1] text-[#B91B1C] hover:bg-[#B91B1C] hover:text-white transition-all cursor-pointer shadow-3xs"
                                    title="Nghe phát âm"
                                  >
                                    <Volume2 className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* Front vs Back Content */}
                                {!isCardFlipped ? (
                                  <div className="my-auto space-y-3">
                                    <h2 className="text-5xl font-bold font-hanzi text-[#18181B] tracking-wider">
                                      {currentCard.word}
                                    </h2>
                                    <p className="text-xs text-[#8B9097] flex items-center justify-center gap-1">
                                      <RotateCcw className="w-3 h-3 text-[#B91B1C]" />
                                      <span>Chạm để lật thẻ xem Pinyin & nghĩa</span>
                                    </p>
                                  </div>
                                ) : (
                                  <div className="my-auto space-y-2.5 animate-in fade-in zoom-in-95 duration-150 w-full">
                                    <h2 className="text-3xl font-bold font-hanzi text-[#18181B]">
                                      {currentCard.word}
                                    </h2>

                                    {currentCard.pinyin && (
                                      <p className="font-mono text-base font-bold text-[#B91B1C]">
                                        {currentCard.pinyin}
                                      </p>
                                    )}

                                    {currentCard.hanViet && (
                                      <p className="text-xs font-bold text-[#713F12]">
                                        Hán-Việt: [{currentCard.hanViet}]
                                      </p>
                                    )}

                                    <div className="bg-[#FAF9F6] p-2.5 rounded-xl border border-[#F0ECE1] text-xs">
                                      <p className="font-bold text-neutral-800 text-sm">
                                        {currentCard.meaningVi || 'Chưa cập nhật nghĩa'}
                                      </p>
                                      {currentCard.partOfSpeech && (
                                        <p className="text-[10px] text-neutral-500 mt-0.5">
                                          Từ loại: {currentCard.partOfSpeech}
                                        </p>
                                      )}
                                    </div>

                                    {currentCard.contextZh && (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (
                                            videoRef.current &&
                                            currentCard.startMs !== undefined
                                          ) {
                                            videoRef.current.currentTime =
                                              currentCard.startMs / 1000;
                                            void videoRef.current.play();
                                          }
                                        }}
                                        className="p-2 rounded-lg bg-neutral-50 border border-neutral-200 text-left hover:border-[#B91B1C] transition-colors"
                                        title="Bấm để phát lại trong video"
                                      >
                                        <p className="text-[11px] font-hanzi font-semibold text-neutral-800">
                                          {currentCard.contextZh}
                                        </p>
                                        {currentCard.contextVi && (
                                          <p className="text-[10px] text-neutral-500">
                                            {stripTrailingPunctuation(currentCard.contextVi)}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Bottom flip reminder */}
                                <div className="text-[10px] font-medium text-neutral-400">
                                  {isCardFlipped ? 'Chạm để lật lại' : 'Nhấn để lật thẻ'}
                                </div>
                              </div>

                              {/* Navigation Controls */}
                              <div className="flex items-center justify-between gap-2 pt-1">
                                <button
                                  type="button"
                                  disabled={flashcardIndex === 0}
                                  onClick={() => {
                                    setFlashcardIndex((i) => Math.max(0, i - 1));
                                    setIsCardFlipped(false);
                                  }}
                                  className="flex-1 py-2 rounded-xl border border-[#E7E7EA] bg-white text-xs font-bold text-[#18181B] hover:bg-[#F7F7F9] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-1"
                                >
                                  <ArrowLeft className="w-3.5 h-3.5" />
                                  <span>Trước</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setIsCardFlipped((f) => !f)}
                                  className="px-4 py-2 rounded-xl border border-[#B91B1C]/30 bg-[#FDF1F1] text-xs font-bold text-[#B91B1C] hover:bg-[#B91B1C] hover:text-white transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Lật thẻ</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={flashcardIndex >= filteredVocabList.length - 1}
                                  onClick={() => {
                                    setFlashcardIndex((i) =>
                                      Math.min(filteredVocabList.length - 1, i + 1),
                                    );
                                    setIsCardFlipped(false);
                                  }}
                                  className="flex-1 py-2 rounded-xl bg-[#18181B] hover:bg-neutral-800 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                                >
                                  <span>Tiếp theo</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  )}
                </div>
              )}


              {/* Tab 3: Mẹo học tập cho video này (Replaces Gợi ý) */}
              {activeTab === 'tips' && (
                <div className="p-3.5 overflow-y-auto max-h-[480px] space-y-3">
                  {learningTips.length > 0 || drillWords.length > 0 ? (
                    <LearningTipsPanel
                      tips={learningTips}
                      drillWords={drillWords}
                      audience="learner"
                    />
                  ) : (
                    <p className="text-xs text-[#5F6368] text-center py-8">
                      Chưa có mẹo học tập cho bài học này.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 2. YouTube "Up Next" Queue (Always visible below the tabs panel for quick continuous viewing) */}
            {recommendedLessons.length > 0 && (
              <div className="rounded-3xl border border-[#E7E7EA] bg-white p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <h3 className="font-extrabold text-sm text-[#18181B] flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-[#B91B1C]" />
                    <span>Bài học tiếp theo</span>
                  </h3>
                  <span className="text-[11px] font-bold text-[#5F6368]">Tự động phát</span>
                </div>

                <div className="space-y-2.5">
                  {recommendedLessons.slice(0, 3).map((item) => (
                    <div
                      key={item._id}
                      onClick={() => onSelectLesson?.(item._id)}
                      className="flex gap-3 p-2 rounded-2xl hover:bg-[#F7F7F9] transition-all cursor-pointer group"
                    >
                      <div className="w-24 h-15 rounded-xl bg-neutral-900 shrink-0 overflow-hidden relative border border-[#E7E7EA]">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.titleVi}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-500">
                            <Play className="w-4 h-4" />
                          </div>
                        )}
                        <span className="absolute bottom-1 right-1 bg-black/80 text-[9px] font-mono text-white px-1 py-0.2 rounded">
                          {formatTimestamp(item.durationSeconds * 1000)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#18181B] line-clamp-1 group-hover:text-[#B91B1C] transition-colors">
                          {item.titleVi}
                        </p>
                        {item.titleZh && (
                          <p className="text-[11px] text-[#5F6368] font-hanzi line-clamp-1">
                            {item.titleZh}
                          </p>
                        )}
                        <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#F7F7F9] border border-[#E7E7EA] text-[#5F6368]">
                          HSK {item.hsk}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Word explanation popover */}
      <WordExplanationPopover
        anchor={popoverAnchor ? { x: popoverAnchor.x, y: popoverAnchor.y } : null}
        wordText={popoverAnchor?.wordText ?? ''}
        loading={explaining}
        error={explanationError}
        explanation={explanation}
        onClose={closePopover}
        onSaveWord={
          popoverAnchor ? () => void saveWord(popoverAnchor.cueId, popoverAnchor.wordId) : undefined
        }
      />

      {/* Interactive Step-by-Step Lesson Quiz Popup Modal */}
      {lesson && quiz.length > 0 && (
        <LessonQuizModal
          isOpen={quizOpen}
          onClose={() => setQuizOpen(false)}
          lessonTitle={lesson.titleVi}
          hskLevel={lesson.hsk}
          quiz={quiz}
          answers={answers}
          setAnswers={setAnswers}
          quizResult={quizResult}
          quizBusy={quizBusy}
          onSubmitQuiz={submitQuiz}
          bestScore={progress?.bestQuizScore}
          onRetry={() => {
            setQuizResult(null);
            setAnswers({});
            quizAttemptKey.current = crypto.randomUUID();
          }}
        />
      )}
    </div>
  );
}
