import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ListChecks,
  Plus,
  Filter,
  Edit2,
  Trash2,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  Sparkles,
  CheckSquare,
  Square,
  Copy,
  Subtitles,
  HelpCircle,
  BookOpen,
  Check,
} from 'lucide-react';
import { useNotification } from '../notifications';
import { Spinner } from '../notifications';
import { AdminSearchBar } from './AdminSearchBar';
import {
  listAdminLessons,
  getAdminReview,
  saveAdminQuiz,
  publishAdminLesson,
  generateAdminQuiz,
  getAdminQuizAiStatus,
  regenerateAdminQuiz,
  type AdminLesson,
  type AdminQuestion,
  type AdminCue,
  type AdminQuizAiStatus,
  type GeneratedAiQuestion,
  type QuizQuestionKind,
} from '../../api/admin';
import AdminPaginationBar, { DEFAULT_ADMIN_PAGE_SIZE } from './AdminPaginationBar';

interface QuizItem {
  lesson: Pick<AdminLesson, '_id' | 'titleVi' | 'titleZh' | 'status'> & { hsk?: number; durationSeconds?: number };
  questions: AdminQuestion[];
  subtitleCues: AdminCue[];
}

const HSK_LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

const HSK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '1': { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  '2': { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  '3': { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  '4': { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  '5': { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  '6': { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  '7': { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
  '8': { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
  '9': { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
};

function formatDuration(seconds = 0): string {
  if (isNaN(seconds) || seconds <= 0) return '0:00';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatCueTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

function makeEmptyQuestion(cueId?: string): AdminQuestion {
  return {
    questionId: `q-${Date.now()}`,
    type: 'multiple_choice',
    prompt: '',
    cueId,
    options: [
      { optionId: 'a', text: '' },
      { optionId: 'b', text: '' },
      { optionId: 'c', text: '' },
      { optionId: 'd', text: '' },
    ],
    correctOptionId: 'a',
    explanationVi: '',
  };
}

const AUTO_SAVE_DEBOUNCE_MS = 800;

export default function AdminQuizManager({ lessonId: propLessonId }: { lessonId?: string } = {}) {
  const params = useParams<{ lessonId?: string }>();
  const activeParamLessonId = propLessonId || params.lessonId || '';
  const navigate = useNavigate();
  const notify = useNotification();
  const [lessons, setLessons] = useState<AdminLesson[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: DEFAULT_ADMIN_PAGE_SIZE, total: 0, totalPages: 1 });
  const [pageSize, setPageSize] = useState(DEFAULT_ADMIN_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [selectedLessonId, setSelectedLessonId] = useState(activeParamLessonId);
  const [quizData, setQuizData] = useState<QuizItem | null>(null);
  const [localQuestions, setLocalQuestions] = useState<AdminQuestion[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingLesson, setFetchingLesson] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [hskFilter, setHskFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'ready_for_review' | 'published'>('all');

  const [editorOpen, setEditorOpen] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiKinds, setAiKinds] = useState<QuizQuestionKind[]>(['comprehension', 'vocabulary']);
  const [aiCount, setAiCount] = useState(5);
  const [aiDraft, setAiDraft] = useState<GeneratedAiQuestion[]>([]);
  const [aiSelectedIds, setAiSelectedIds] = useState<Set<string>>(new Set());
  const [aiStatus, setAiStatus] = useState<AdminQuizAiStatus | null>(null);
  const [regenerateBusy, setRegenerateBusy] = useState(false);

  const loadLessons = useCallback(
    async (targetPage: number = page) => {
      setLoading(true);
      try {
        const res = await listAdminLessons({
          page: targetPage,
          limit: pageSize,
          hsk: hskFilter ? Number(hskFilter) : undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: searchQuery.trim() || undefined,
        });
        setLessons(res.items);
        setPagination(res.pagination);
        setPage(res.pagination.page);
      } catch (err) {
        console.error(err);
        notify.toast('error', 'Không thể tải danh sách bài học');
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, hskFilter, statusFilter, searchQuery, notify],
  );

  useEffect(() => {
    loadLessons(1);
  }, [hskFilter, statusFilter, pageSize]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLessons(1);
  };

  useEffect(() => {
    if (activeParamLessonId && activeParamLessonId !== selectedLessonId) {
      loadLessonQuiz(activeParamLessonId);
      setEditorOpen(true);
    }
  }, [activeParamLessonId]);

  const aiStatusTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (aiStatusTimer.current) {
      clearInterval(aiStatusTimer.current);
      aiStatusTimer.current = null;
    }
    if (!selectedLessonId) return;
    const refresh = () => {
      getAdminQuizAiStatus(selectedLessonId)
        .then((status) => {
          setAiStatus(status);
          if (status.aiGenerationStatus === 'completed') {
            void getAdminReview(selectedLessonId).then((data) => {
              setLocalQuestions(data.quiz?.questions ?? []);
              if (quizData) {
                setQuizData({ ...quizData, questions: data.quiz?.questions ?? [] });
              }
            }).catch(() => undefined);
            if (aiStatusTimer.current) {
              clearInterval(aiStatusTimer.current);
              aiStatusTimer.current = null;
            }
          }
        })
        .catch(() => undefined);
    };
    refresh();
    aiStatusTimer.current = setInterval(() => {
      if (aiStatus?.aiGenerationStatus === 'pending' || aiStatus?.aiGenerationStatus === 'running') {
        refresh();
      }
    }, 4000);
    return () => {
      if (aiStatusTimer.current) {
        clearInterval(aiStatusTimer.current);
        aiStatusTimer.current = null;
      }
    };
  }, [selectedLessonId, aiStatus?.aiGenerationStatus, quizData]);

  const loadLessonQuiz = useCallback(async (lessonId: string) => {
    setFetchingLesson(true);
    setSelectedLessonId(lessonId);
    try {
      const data = await getAdminReview(lessonId);
      const item: QuizItem = {
        lesson: data.lesson,
        questions: data.quiz?.questions ?? [],
        subtitleCues: data.subtitle?.cues ?? [],
      };
      setQuizData(item);
      setLocalQuestions(data.quiz?.questions ?? []);
      getAdminQuizAiStatus(lessonId).then(setAiStatus).catch(() => undefined);
    } catch (err) {
      console.error(err);
      notify.toast('error', 'Không thể tải bài luyện tập cho video này');
      setQuizData(null);
    } finally {
      setFetchingLesson(false);
    }
  }, [notify]);

  const openEditor = (lessonId: string) => {
    if (!quizData || quizData.lesson._id !== lessonId) {
      loadLessonQuiz(lessonId);
    }
    setSelectedLessonId(lessonId);
    setActiveQuestionId(null);
    setEditorOpen(true);
    navigate(`/admin/quiz/${lessonId}`);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setActiveQuestionId(null);
    navigate('/admin/quiz');
    loadLessons();
  };

  const handleAddNewQuestion = () => {
    const newQ = makeEmptyQuestion();
    setLocalQuestions((prev) => [...prev, newQ]);
    setActiveQuestionId(newQ.questionId);
  };

  const handleDuplicateQuestion = (idx: number) => {
    const target = localQuestions[idx];
    if (!target) return;
    const duplicated: AdminQuestion = {
      ...JSON.parse(JSON.stringify(target)),
      questionId: `q-${Date.now()}`,
    };
    setLocalQuestions((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, duplicated);
      return next;
    });
    setActiveQuestionId(duplicated.questionId);
    notify.toast('success', `Đã nhân bản câu hỏi #${idx + 1}`);
  };

  const handleRemoveQuestion = async (idx: number) => {
    if (!await notify.confirm({
      title: 'Xóa câu hỏi',
      message: `Bạn có chắc muốn xóa câu hỏi #${idx + 1}?`,
      confirmText: 'Xóa',
      tone: 'danger',
    })) return;
    const removed = localQuestions[idx];
    setLocalQuestions((prev) => prev.filter((_, i) => i !== idx));
    if (removed && removed.questionId === activeQuestionId) {
      setActiveQuestionId(null);
    }
  };

  const handleMoveQuestion = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= localQuestions.length) return;
    setLocalQuestions((prev) => {
      const arr = [...prev];
      [arr[idx], arr[targetIdx]] = [arr[targetIdx], arr[idx]];
      return arr;
    });
  };

  const openAiGenerator = () => {
    if (!selectedLessonId) return;
    setAiError('');
    setAiDraft([]);
    setAiSelectedIds(new Set());
    setAiModalOpen(true);
  };

  const handleGenerateAi = async () => {
    if (!selectedLessonId) return;
    setAiBusy(true);
    setAiError('');
    try {
      const result = await generateAdminQuiz(selectedLessonId, {
        kinds: aiKinds,
        questionCount: aiCount,
      });
      const generated = result.questions;
      setAiDraft(generated);
      setAiSelectedIds(new Set(generated.map((q) => q.questionId)));
      notify.toast('success', `AI đã sinh ${generated.length} câu hỏi. Bấm vào từng câu để chọn.`);
    } catch (err: any) {
      setAiError(err?.message || 'AI không thể sinh câu hỏi lúc này');
    } finally {
      setAiBusy(false);
    }
  };

  const handleImportAi = () => {
    if (aiDraft.length === 0) return;
    const selectedQuestions = aiDraft
      .filter((q) => aiSelectedIds.has(q.questionId))
      .map<AdminQuestion>((q) => ({
        questionId: q.questionId,
        type: q.type,
        prompt: q.prompt,
        cueId: q.cueId,
        options: q.options.length > 0 ? q.options : [
          { optionId: 'a', text: '' },
          { optionId: 'b', text: '' },
          { optionId: 'c', text: '' },
          { optionId: 'd', text: '' },
        ],
        correctOptionId: q.correctOptionId,
        acceptedAnswers: q.acceptedAnswers,
        explanationVi: q.explanationVi,
      }));
    setLocalQuestions((prev) => [...prev, ...selectedQuestions]);
    setAiModalOpen(false);
    notify.toast('success', `Đã thêm ${selectedQuestions.length} câu hỏi từ AI vào danh sách.`);
  };

  const handleRegenerate = async () => {
    if (!selectedLessonId || regenerateBusy) return;
    if (!await notify.confirm({
      title: 'Tạo lại câu hỏi bằng AI',
      message: 'Panda AI sẽ tạo lại toàn bộ câu hỏi trong bài tập nháp. Tiếp tục?',
      confirmText: 'Tạo lại',
      tone: 'default',
    })) return;
    setRegenerateBusy(true);
    try {
      await regenerateAdminQuiz(selectedLessonId);
      setAiStatus({
        aiGenerationStatus: 'pending',
        revision: aiStatus?.revision ?? null,
      });
      notify.toast('success', 'Đã yêu cầu Panda AI tạo lại bài tập. Trạng thái sẽ tự cập nhật.');
    } catch (err: any) {
      notify.toast('error', err?.message || 'Không thể tạo lại câu hỏi lúc này');
    } finally {
      setRegenerateBusy(false);
    }
  };

  const toggleAiKind = (kind: QuizQuestionKind) => {
    setAiKinds((prev) => {
      if (prev.includes(kind)) return prev.filter((k) => k !== kind);
      if (prev.length >= 4) return prev;
      return [...prev, kind];
    });
  };

  const toggleAiSelected = (id: string) => {
    setAiSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePublish = async () => {
    if (!selectedLessonId) return;
    if (localQuestions.length === 0) {
      notify.toast('error', 'Cần ít nhất 1 câu hỏi trước khi xuất bản bài luyện tập');
      return;
    }
    setSaving(true);
    try {
      await saveAdminQuiz(selectedLessonId, localQuestions);
      await publishAdminLesson(selectedLessonId);
      notify.toast('success', 'Đã xuất bản bài học và bộ bài tập trắc nghiệm!');
      await loadLessons();
      await loadLessonQuiz(selectedLessonId);
    } catch (err: any) {
      notify.toast('error', err?.message || 'Lỗi khi xuất bản bài luyện tập');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AiQuizGenerationModal
        open={aiModalOpen}
        busy={aiBusy}
        error={aiError}
        kinds={aiKinds}
        questionCount={aiCount}
        draft={aiDraft}
        selectedIds={aiSelectedIds}
        lessonTitleVi={quizData?.lesson.titleVi ?? ''}
        onChangeKinds={setAiKinds}
        onChangeCount={setAiCount}
        onGenerate={handleGenerateAi}
        onToggleSelected={(id) => {
          if (id === '__select_all__') {
            setAiSelectedIds((prev) =>
              prev.size === aiDraft.length ? new Set() : new Set(aiDraft.map((q) => q.questionId)),
            );
          } else {
            toggleAiSelected(id);
          }
        }}
        onImport={handleImportAi}
        onClose={() => setAiModalOpen(false)}
      />
      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-3xl border border-[#F2E4D8] bg-white p-6 shadow-2xs">
        <div className="pointer-events-none absolute -right-6 -bottom-8 select-none font-fraunces text-8xl font-black text-[#B91B1C]/5">
          练
        </div>
        <div className="relative z-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FDF1F1] text-[#B91B1C] shadow-2xs ring-1 ring-[#B91B1C]/20">
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-[#2B2826]">Quản Lý Bài Luyện Tập</h1>
                <span className="rounded-full border border-[#F9D2D2] bg-[#FDF1F1] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#B91B1C]">
                  HSK 1 - 9
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#8C827A]">
                Soạn thảo câu hỏi trắc nghiệm & điền từ, liên kết chính xác với phụ đề video và kiểm tra qua chế độ xem trước học viên.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <button
              onClick={() => loadLessons(1)}
              disabled={loading}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-4 text-xs font-bold text-[#2B2826] shadow-2xs transition-all hover:border-[#B91B1C]/30 hover:bg-white disabled:opacity-40 active:scale-[0.98]"
            >
              <RefreshCw className={`h-4 w-4 text-[#8C827A] ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar - 1 row */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#F2E4D8] bg-white p-3 shadow-2xs md:flex-row md:items-center md:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-md">
          <AdminSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Tìm bài học theo tên Việt, Trung hoặc mô tả..."
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 items-center gap-1.5 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-2.5 transition-colors hover:border-[#B91B1C]/40 focus-within:border-[#B91B1C] focus-within:bg-white">
            <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#8C827A]" />
            <select
              value={hskFilter}
              onChange={(e) => setHskFilter(e.target.value)}
              aria-label="Lọc theo cấp độ HSK"
              className="cursor-pointer bg-transparent text-xs font-bold text-[#2B2826] outline-none"
            >
              <option value="">Tất cả cấp độ (HSK 1–9)</option>
              {HSK_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  HSK {lvl}
                </option>
              ))}
            </select>
          </div>

          <div className="flex h-9 items-center gap-1.5 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-2.5 transition-colors hover:border-[#B91B1C]/40 focus-within:border-[#B91B1C] focus-within:bg-white">
            <Filter className="h-3.5 w-3.5 shrink-0 text-[#8C827A]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              aria-label="Lọc theo trạng thái bài học"
              className="cursor-pointer bg-transparent text-xs font-bold text-[#2B2826] outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="published">Đã xuất bản</option>
              <option value="ready_for_review">Chờ duyệt</option>
              <option value="draft">Bản nháp</option>
            </select>
          </div>

          {(searchQuery || hskFilter || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setHskFilter('');
                setStatusFilter('all');
              }}
              className="flex h-9 items-center gap-1 rounded-xl border border-[#F2E4D8] bg-[#FDF1F1] px-2.5 text-xs font-bold text-[#B91B1C] transition-colors hover:bg-[#FAD2CF]"
              title="Đặt lại bộ lọc"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Đặt lại</span>
            </button>
          )}
        </div>
      </div>

      {/* Lesson Table - list view */}
      <div className="bg-white rounded-3xl border border-[#F2E4D8] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[720px]">
            <thead className="bg-[#FFF9F5] border-b border-[#F2E4D8] text-[#8C827A] uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="p-4 w-[280px]">Bài học</th>
                <th className="p-4 w-[120px]">Thời lượng</th>
                <th className="p-4 w-[90px]">HSK</th>
                <th className="p-4 w-[140px]">Trạng thái</th>
                <th className="p-4 text-center w-[130px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2E4D8]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-[#8C827A]">
                    <div className="inline-flex items-center gap-2">
                      <Spinner size="sm" tone="brand" />
                      <span>Đang tải danh sách bài học...</span>
                    </div>
                  </td>
                </tr>
              ) : lessons.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-[#8C827A]">
                    <div className="flex flex-col items-center gap-2">
                      <BookOpen className="h-8 w-8 text-[#8C827A]/40" />
                      <p className="text-sm font-bold text-[#2B2826]">Không tìm thấy bài học nào</p>
                      <p className="text-[11px] text-[#8C827A]">Thử đổi từ khóa hoặc bộ lọc HSK.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                lessons.map((lesson) => {
                  const lvlKey = String(lesson.hsk);
                  const styling = HSK_COLORS[lvlKey] || HSK_COLORS['1'];
                  return (
                    <tr
                      key={lesson._id}
                      className="hover:bg-[#FFF9F5]/70 transition-colors group"
                    >
                      {/* Title */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <p className="font-fraunces text-sm font-bold text-[#2B2826] line-clamp-1">
                            {lesson.titleVi}
                          </p>
                          {lesson.titleZh && (
                            <p className="font-fraunces text-[11px] text-[#8C827A] line-clamp-1">
                              {lesson.titleZh}
                            </p>
                          )}
                          <p className="font-mono text-[10px] text-[#A1A1AA]">
                            {lesson._id.slice(-8)}
                          </p>
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-[#2B2826]">
                          <Clock className="h-3 w-3 text-[#8C827A]" />
                          {formatDuration(lesson.durationSeconds || 0)}
                        </span>
                      </td>

                      {/* HSK badge */}
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-md font-black text-[10px] border ${styling.bg} ${styling.text} ${styling.border}`}>
                          HSK {lesson.hsk}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase border ${
                            lesson.status === 'published'
                              ? 'bg-[#EAF5F1] text-[#188A5A] border-[#C6E7DA]'
                              : lesson.status === 'ready_for_review'
                              ? 'bg-[#FFF8EC] text-[#B45309] border-[#FDE6BA]'
                              : 'bg-[#F4EFEA] text-[#6E655F] border-[#E5DCD3]'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            lesson.status === 'published' ? 'bg-[#188A5A]' : lesson.status === 'ready_for_review' ? 'bg-[#B45309]' : 'bg-[#8C827A]'
                          }`} />
                          <span>
                            {lesson.status === 'published'
                              ? 'Đã xuất bản'
                              : lesson.status === 'ready_for_review'
                              ? 'Chờ duyệt'
                              : 'Nháp'}
                          </span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => openEditor(lesson._id)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#B91B1C] px-3.5 text-xs font-bold text-white shadow-2xs shadow-[#B91B1C]/25 hover:bg-[#A3181A] active:scale-[0.98]"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Sửa bài tập</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <AdminPaginationBar
        total={pagination.total}
        page={pagination.page}
        pageSize={pageSize}
        visibleCount={lessons.length}
        unitLabel="bài học"
        disabled={loading}
        ariaLabel="Phân trang bài luyện tập"
        onPageChange={(p) => loadLessons(p)}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      {/* Editor popup - landscape, 2 columns horizontal */}
      {editorOpen && (
        <EditorPopup
          lesson={quizData?.lesson ?? null}
          cues={quizData?.subtitleCues ?? []}
          questions={localQuestions}
          activeQuestionId={activeQuestionId}
          loading={fetchingLesson}
          saving={saving}
          aiStatus={aiStatus}
          onChangeActiveQuestion={setActiveQuestionId}
          onAddQuestion={handleAddNewQuestion}
          onUpdateQuestions={setLocalQuestions}
          onDuplicate={handleDuplicateQuestion}
          onRemove={handleRemoveQuestion}
          onMove={handleMoveQuestion}
          onOpenAi={openAiGenerator}
          onRegenerate={handleRegenerate}
          regenerateBusy={regenerateBusy}
          onPublish={handlePublish}
          onClose={closeEditor}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor Popup (landscape, 2 columns horizontal)
// ---------------------------------------------------------------------------

interface EditorPopupProps {
  lesson: Pick<AdminLesson, '_id' | 'titleVi' | 'titleZh' | 'status'> & { hsk?: number; durationSeconds?: number } | null;
  cues: AdminCue[];
  questions: AdminQuestion[];
  activeQuestionId: string | null;
  loading: boolean;
  saving: boolean;
  aiStatus: AdminQuizAiStatus | null;
  onChangeActiveQuestion: (id: string | null) => void;
  onAddQuestion: () => void;
  onUpdateQuestions: (updater: AdminQuestion[] | ((prev: AdminQuestion[]) => AdminQuestion[])) => void;
  onDuplicate: (idx: number) => void;
  onRemove: (idx: number) => void;
  onMove: (idx: number, dir: -1 | 1) => void;
  onOpenAi: () => void;
  onRegenerate: () => void;
  regenerateBusy: boolean;
  onPublish: () => void;
  onClose: () => void;
}

function EditorPopup({
  lesson,
  cues,
  questions,
  activeQuestionId,
  loading,
  saving,
  aiStatus,
  onChangeActiveQuestion,
  onAddQuestion,
  onUpdateQuestions,
  onDuplicate,
  onRemove,
  onMove,
  onOpenAi,
  onRegenerate,
  regenerateBusy,
  onPublish,
  onClose,
}: EditorPopupProps) {
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [popupSaving, setPopupSaving] = useState(false);

  // Auto-save (debounced) - persists whenever questions change
  const initialQuestionsRef = useRef<string>(JSON.stringify(questions));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    const serialized = JSON.stringify(questions);
    if (serialized === initialQuestionsRef.current) return;
    isDirtyRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (!lesson) return;
      setAutoSaving(true);
      try {
        await saveAdminQuiz(lesson._id, questions);
        setLastSavedAt(new Date());
        isDirtyRef.current = false;
        initialQuestionsRef.current = serialized;
      } catch (err: any) {
        // surface error toast
        // eslint-disable-next-line no-console
        console.error('Auto-save failed:', err);
      } finally {
        setAutoSaving(false);
      }
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [questions, lesson]);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmingClose) {
          setConfirmingClose(false);
        } else {
          attemptClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmingClose]);

  const attemptClose = () => {
    if (isDirtyRef.current) {
      setConfirmingClose(true);
    } else {
      onClose();
    }
  };

  const handleDiscardAndClose = () => {
    setConfirmingClose(false);
    onClose();
  };

  const handleSaveAndClose = async () => {
    if (!lesson) return;
    setPopupSaving(true);
    try {
      await saveAdminQuiz(lesson._id, questions);
      setLastSavedAt(new Date());
      isDirtyRef.current = false;
      onClose();
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setPopupSaving(false);
    }
  };

  const activeQuestion = questions.find((q) => q.questionId === activeQuestionId) ?? null;
  const activeIndex = activeQuestion ? questions.findIndex((q) => q.questionId === activeQuestionId) : -1;

  if (!lesson) {
    return (
      <ModalShell onBackdrop={onClose}>
        <div className="flex min-h-[300px] items-center justify-center p-12">
          <Spinner size="lg" tone="brand" />
          <p className="ml-3 text-xs font-bold text-[#8C827A]">Đang tải dữ liệu bài học...</p>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onBackdrop={attemptClose}>
      <div className="flex h-[85vh] max-h-[900px] w-full max-w-[1280px] flex-col overflow-hidden rounded-3xl border border-[#F2E4D8] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#F2E4D8] bg-[#FFF9F5] px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#FDF1F1] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#B91B1C] ring-1 ring-[#B91B1C]/20">
                Editor
              </span>
              {lesson.hsk !== undefined && (
                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${
                  (HSK_COLORS[String(lesson.hsk)] || HSK_COLORS['1']).bg
                } ${(HSK_COLORS[String(lesson.hsk)] || HSK_COLORS['1']).text} ${(HSK_COLORS[String(lesson.hsk)] || HSK_COLORS['1']).border}`}>
                  HSK {lesson.hsk}
                </span>
              )}
              {lesson.status && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black border ${
                    lesson.status === 'published'
                      ? 'border-[#C6E7DA] bg-[#EAF5F1] text-[#188A5A]'
                      : lesson.status === 'ready_for_review'
                      ? 'border-[#FDE6BA] bg-[#FFF8EC] text-[#B45309]'
                      : 'border-[#E5DCD3] bg-[#F4EFEA] text-[#6E655F]'
                  }`}
                >
                  {lesson.status === 'published' ? 'Đã xuất bản' : lesson.status === 'ready_for_review' ? 'Chờ duyệt' : 'Bản nháp'}
                </span>
              )}
              <AiStatusBadge status={aiStatus} />
            </div>
            <h2 className="mt-1 truncate text-lg font-black tracking-tight text-[#2B2826]">
              {lesson.titleVi}
            </h2>
            {lesson.titleZh && (
              <p className="truncate font-fraunces text-xs text-[#8C827A]">{lesson.titleZh}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <SaveIndicator saving={saving} autoSaving={autoSaving} lastSavedAt={lastSavedAt} />
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#8C827A] hover:bg-white hover:text-[#2B2826]"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body: 2 columns horizontal (45/55) */}
        <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[45%_55%]">
          {/* Left column: question list */}
          <div className="flex min-h-0 flex-col border-r border-[#F2E4D8] bg-[#FFFDFB]">
            <div className="flex shrink-0 items-center justify-between border-b border-[#F2E4D8] px-5 py-3">
              <div>
                <h3 className="text-xs font-black text-[#2B2826]">
                  Danh sách câu hỏi
                  <span className="ml-2 rounded-md bg-[#FFF9F5] px-2 py-0.5 font-mono text-[10px] text-[#8C827A]">
                    {questions.length}
                  </span>
                </h3>
                <p className="mt-0.5 text-[11px] text-[#8C827A]">
                  Click chọn câu để chỉnh sửa bên phải
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenAi}
                  disabled={cues.length === 0}
                  className="flex h-8 items-center gap-1 rounded-lg border border-[#B91B1C]/30 bg-white px-3 text-[11px] font-bold text-[#B91B1C] hover:bg-[#FDF1F1] active:scale-[0.98] disabled:opacity-40"
                  title="Tạo câu hỏi bằng AI"
                >
                  <Sparkles className="h-3 w-3" />
                  AI
                </button>
                <button
                  type="button"
                  onClick={onAddQuestion}
                  className="flex h-8 items-center gap-1 rounded-lg bg-[#B91B1C] px-3 text-[11px] font-bold text-white shadow-2xs shadow-[#B91B1C]/25 hover:bg-[#A3181A] active:scale-[0.98]"
                >
                  <Plus className="h-3 w-3" />
                  Thêm
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex h-full items-center justify-center p-8">
                  <Spinner size="md" tone="brand" />
                </div>
              ) : questions.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FDF1F1] text-[#B91B1C] ring-1 ring-[#B91B1C]/20">
                    <HelpCircle className="h-6 w-6" />
                  </div>
                  <p className="mb-1 text-sm font-bold text-[#2B2826]">Chưa có câu hỏi nào</p>
                  <p className="mb-4 max-w-xs text-[11px] text-[#8C827A]">
                    Bấm "Thêm" hoặc "AI" để tạo câu hỏi đầu tiên cho bài học này.
                  </p>
                  <button
                    type="button"
                    onClick={onAddQuestion}
                    className="flex h-9 items-center gap-2 rounded-xl bg-[#B91B1C] px-4 text-xs font-bold text-white hover:bg-[#A3181A] active:scale-[0.98]"
                  >
                    <Plus className="h-4 w-4" />
                    Tạo câu hỏi đầu tiên
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-[#F2E4D8]">
                  {questions.map((q, idx) => (
                    <QuestionListItem
                      key={q.questionId}
                      question={q}
                      index={idx}
                      cues={cues}
                      isActive={q.questionId === activeQuestionId}
                      onSelect={() => onChangeActiveQuestion(q.questionId)}
                      onDuplicate={() => onDuplicate(idx)}
                      onRemove={() => onRemove(idx)}
                      onMove={(dir) => onMove(idx, dir)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right column: editor for active question */}
          <div className="flex min-h-0 flex-col bg-white">
            {activeQuestion ? (
              <QuestionEditorPanel
                question={activeQuestion}
                index={activeIndex}
                cues={cues}
                onUpdate={(updated) => {
                  onUpdateQuestions((prev) =>
                    prev.map((q) => (q.questionId === updated.questionId ? updated : q))
                  );
                }}
                onClose={() => onChangeActiveQuestion(null)}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-[#F2E4D8] bg-[#FFF9F5]">
                  <Layers className="h-7 w-7 text-[#8C827A]" />
                </div>
                <h3 className="text-lg font-extrabold text-[#2B2826]">Chọn một câu hỏi để chỉnh sửa</h3>
                <p className="mt-1.5 max-w-sm text-xs text-[#8C827A]">
                  Click vào câu hỏi bất kỳ trong danh sách bên trái, hoặc thêm câu mới để bắt đầu.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#F2E4D8] bg-[#FFF9F5] px-6 py-3">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerateBusy || aiStatus?.aiGenerationStatus === 'pending' || aiStatus?.aiGenerationStatus === 'running'}
            className="flex h-9 items-center gap-2 rounded-xl border border-[#B91B1C]/25 bg-white px-3.5 text-xs font-bold text-[#B91B1C] hover:bg-[#FDF1F1] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
            title="Yêu cầu Panda AI tạo lại toàn bộ câu hỏi"
          >
            {regenerateBusy ? (
              <Spinner size="sm" tone="brand" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 text-[#B91B1C]" />
            )}
            <span>Tạo lại bằng AI</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={attemptClose}
              className="flex h-9 items-center gap-2 rounded-xl border border-[#F2E4D8] bg-white px-4 text-xs font-bold text-[#2B2826] hover:bg-[#FFF9F5] active:scale-[0.98]"
            >
              <span>Đóng</span>
            </button>
            {lesson.status === 'published' ? (
              <span className="flex h-9 items-center gap-1.5 rounded-xl border border-[#C6E7DA] bg-[#EAF5F1] px-4 text-xs font-bold text-[#188A5A]">
                <CheckCircle2 className="h-4 w-4" />
                <span>Đã xuất bản</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={onPublish}
                disabled={saving || questions.length === 0}
                className="flex h-9 items-center gap-2 rounded-xl bg-[#B91B1C] px-4 text-xs font-bold text-white shadow-2xs shadow-[#B91B1C]/25 hover:bg-[#A3181A] disabled:opacity-40 active:scale-[0.98]"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Xuất bản</span>
              </button>
            )}
          </div>
        </div>

        {/* Confirm close dialog */}
        {confirmingClose && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-confirm-title"
          >
            <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[#F2E4D8] bg-white shadow-2xl">
              <div className="p-6">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FDF1F1] text-[#B91B1C] ring-1 ring-[#B91B1C]/20">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h3 id="close-confirm-title" className="text-base font-black text-[#2B2826]">
                  Có thay đổi chưa được lưu
                </h3>
                <p className="mt-1 text-xs text-[#8C827A]">
                  Một số câu hỏi đang chờ auto-save. Bạn muốn lưu trước khi đóng, hay hủy thay đổi?
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-[#F2E4D8] bg-[#FFF9F5] px-6 py-3">
                <button
                  type="button"
                  onClick={() => setConfirmingClose(false)}
                  className="rounded-xl border border-[#F2E4D8] bg-white px-4 py-2 text-xs font-bold text-[#8C827A] hover:bg-white"
                >
                  Ở lại
                </button>
                <button
                  type="button"
                  onClick={handleDiscardAndClose}
                  className="rounded-xl border border-[#F2E4D8] bg-white px-4 py-2 text-xs font-bold text-[#B91B1C] hover:bg-[#FDF1F1]"
                >
                  Hủy thay đổi
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndClose}
                  disabled={popupSaving}
                  className="rounded-xl bg-[#B91B1C] px-4 py-2 text-xs font-bold text-white shadow-2xs shadow-[#B91B1C]/25 hover:bg-[#A3181A] disabled:opacity-40"
                >
                  {popupSaving ? 'Đang lưu...' : 'Lưu & đóng'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Modal Shell (overlay + center + ESC handled by parent)
// ---------------------------------------------------------------------------

function ModalShell({
  onBackdrop,
  children,
}: {
  onBackdrop: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={onBackdrop}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Save Indicator (live auto-save status)
// ---------------------------------------------------------------------------

function SaveIndicator({
  saving,
  autoSaving,
  lastSavedAt,
}: {
  saving: boolean;
  autoSaving: boolean;
  lastSavedAt: Date | null;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  let label = 'Đã lưu';
  let dotClass = 'bg-[#188A5A]';
  if (saving || autoSaving) {
    label = 'Đang lưu...';
    dotClass = 'bg-[#B45309] animate-pulse';
  } else if (!lastSavedAt) {
    label = 'Chưa có thay đổi';
    dotClass = 'bg-[#8C827A]';
  } else {
    const seconds = Math.floor((Date.now() - lastSavedAt.getTime()) / 1000);
    if (seconds < 60) label = 'Đã lưu vừa xong';
    else if (seconds < 3600) label = `Đã lưu ${Math.floor(seconds / 60)} phút trước`;
    else label = `Đã lưu lúc ${lastSavedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F2E4D8] bg-white px-3 py-1 text-[11px] font-bold text-[#8C827A]">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      <span>{label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Question List Item (left column row)
// ---------------------------------------------------------------------------

function QuestionListItem({
  question,
  index,
  cues,
  isActive,
  onSelect,
  onDuplicate,
  onRemove,
  onMove,
}: {
  question: AdminQuestion;
  index: number;
  cues: AdminCue[];
  isActive: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const boundCue = cues.find((c) => c.cueId === question.cueId);
  const isEmpty = !question.prompt.trim();

  return (
    <li
      className={`group transition-colors ${
        isActive
          ? 'border-l-4 border-l-[#B91B1C] bg-[#FDF1F1]'
          : 'border-l-4 border-l-transparent hover:bg-[#FFF9F5]/60'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-start gap-2.5 p-4 text-left"
      >
        <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMove(-1);
            }}
            disabled={index === 0}
            className="rounded p-0.5 text-[#8C827A] hover:text-[#2B2826] disabled:opacity-20"
            title="Di chuyển lên"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <span className="w-6 text-center font-mono text-[11px] font-black text-[#2B2826]">
            Q{index + 1}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMove(1);
            }}
            disabled={false}
            className="rounded p-0.5 text-[#8C827A] hover:text-[#2B2826] disabled:opacity-20"
            title="Di chuyển xuống"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-black border ${
                question.type === 'multiple_choice'
                  ? 'border-[#C6E7DA] bg-[#EAF5F1] text-[#188A5A]'
                  : 'border-[#FDE6BA] bg-[#FFF8EC] text-[#B45309]'
              }`}
            >
              {question.type === 'multiple_choice' ? 'TN' : 'Điền'}
            </span>
            {boundCue && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[#C6E7DA] bg-[#EAF5F1] px-1.5 py-0.5 text-[10px] font-bold text-[#188A5A]">
                <Subtitles className="h-2.5 w-2.5" />
                <span className="font-mono">{formatCueTime(boundCue.startMs)}</span>
              </span>
            )}
            {isEmpty && (
              <span className="rounded-md border border-[#FDE6BA] bg-[#FFF8EC] px-1.5 py-0.5 text-[10px] font-bold text-[#B45309]">
                Chưa nhập
              </span>
            )}
          </div>

          <p className={`line-clamp-2 text-xs leading-snug ${
            isEmpty ? 'italic text-[#8C827A]' : 'font-bold text-[#2B2826]'
          }`}>
            {question.prompt || 'Chưa nhập câu hỏi'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="rounded p-1 text-[#8C827A] hover:bg-white hover:text-[#2B2826]"
            title="Nhân bản"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="rounded p-1 text-[#8C827A] hover:bg-white hover:text-[#B91B1C]"
            title="Xóa"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Question Editor Panel (right column - inline editor)
// ---------------------------------------------------------------------------

function QuestionEditorPanel({
  question,
  index,
  cues,
  onUpdate,
  onClose,
}: {
  question: AdminQuestion;
  index: number;
  cues: AdminCue[];
  onUpdate: (q: AdminQuestion) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<AdminQuestion>({ ...question });

  // Re-sync local state when active question changes
  useEffect(() => {
    setLocal({ ...question });
  }, [question.questionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Push changes up so parent can auto-save
  useEffect(() => {
    onUpdate(local);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  const setField = <K extends keyof AdminQuestion>(key: K, value: AdminQuestion[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const handleOptionChange = (optionId: string, text: string) => {
    setLocal((prev) => ({
      ...prev,
      options: prev.options.map((o) => (o.optionId === optionId ? { ...o, text } : o)),
    }));
  };

  const handleSetCorrectOption = (optionId: string) => {
    setLocal((prev) => ({ ...prev, correctOptionId: optionId }));
  };

  const handleAddOption = () => {
    if (local.options.length >= 6) return;
    const nextId = String.fromCharCode(97 + local.options.length);
    setLocal((prev) => ({
      ...prev,
      options: [...prev.options, { optionId: nextId, text: '' }],
    }));
  };

  const handleRemoveOption = (optionId: string) => {
    if (local.options.length <= 2) return;
    const next = local.options
      .filter((o) => o.optionId !== optionId)
      .map((o, i) => ({ ...o, optionId: String.fromCharCode(97 + i) }));
    setLocal((prev) => ({
      ...prev,
      options: next,
      correctOptionId: prev.correctOptionId === optionId ? next[0].optionId : prev.correctOptionId,
    }));
  };

  const handleAcceptedAnswerChange = (idx: number, text: string) => {
    setLocal((prev) => ({
      ...prev,
      acceptedAnswers: (prev.acceptedAnswers || []).map((a, i) => (i === idx ? text : a)),
    }));
  };

  const handleAddAcceptedAnswer = () => {
    setLocal((prev) => ({
      ...prev,
      acceptedAnswers: [...(prev.acceptedAnswers || []), ''],
    }));
  };

  const handleRemoveAcceptedAnswer = (idx: number) => {
    setLocal((prev) => ({
      ...prev,
      acceptedAnswers: (prev.acceptedAnswers || []).filter((_, i) => i !== idx),
    }));
  };

  const boundCue = cues.find((c) => c.cueId === local.cueId);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-[#F2E4D8] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#B91B1C] font-mono text-[11px] font-bold text-white">
            Q{index + 1}
          </span>
          <h3 className="text-xs font-black text-[#2B2826]">Chi tiết câu hỏi</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[#8C827A] hover:bg-[#FFF9F5]"
          title="Đóng editor"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-4">
          {/* Row 1: Type & Cue Binding */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block font-bold text-[#2B2826]">Loại câu hỏi *</label>
              <select
                value={local.type}
                onChange={(e) => setField('type', e.target.value as AdminQuestion['type'])}
                className="w-full rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-3 py-2 text-xs font-bold text-[#2B2826] outline-none transition-colors focus:border-[#B91B1C]"
              >
                <option value="multiple_choice">Trắc nghiệm (4 đáp án)</option>
                <option value="fill_blank">Điền từ vào chỗ trống</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-bold text-[#2B2826]">Liên kết phụ đề (Cue)</label>
              <select
                value={local.cueId || ''}
                onChange={(e) => setField('cueId', e.target.value || undefined)}
                className="w-full rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-3 py-2 text-xs font-bold text-[#2B2826] outline-none transition-colors focus:border-[#B91B1C]"
              >
                <option value="">-- Không gắn câu thoại --</option>
                {cues.map((c) => (
                  <option key={c.cueId} value={c.cueId}>
                    [{formatCueTime(c.startMs)}] {c.zh}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bound cue preview */}
          {boundCue && (
            <div className="space-y-1 rounded-2xl border border-[#F2E4D8] bg-[#FFF9F5] p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[#188A5A]">
                <Subtitles className="h-3 w-3" />
                <span>Phụ đề [{formatCueTime(boundCue.startMs)}]</span>
              </div>
              <p className="font-fraunces text-sm font-bold text-[#2B2826]">{boundCue.zh}</p>
              <p className="text-[11px] text-[#8C827A]">{boundCue.vi}</p>
            </div>
          )}

          {/* Row 2: Prompt */}
          <div>
            <label className="mb-1 block font-bold text-[#2B2826]">
              Nội dung câu hỏi <span className="text-[#B91B1C]">*</span>
            </label>
            <textarea
              rows={2}
              value={local.prompt}
              onChange={(e) => setField('prompt', e.target.value)}
              placeholder='Ví dụ: Trong đoạn hội thoại trên, từ "服务员" có nghĩa là gì?'
              className="w-full resize-none rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] p-2.5 text-xs text-[#2B2826] outline-none transition-all placeholder:text-[#8C827A]/70 focus:border-[#B91B1C] focus:bg-white"
            />
          </div>

          {/* Options or Fill */}
          {local.type === 'multiple_choice' ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-[#2B2826]">
                  Lựa chọn <span className="font-normal text-[#8C827A]">(Bấm radio để chọn đáp án đúng)</span>
                </label>
                {local.options.length < 6 && (
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#B91B1C] hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Thêm lựa chọn
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {local.options.map((opt) => {
                  const isCorrect = opt.optionId === local.correctOptionId;
                  return (
                    <div key={opt.optionId} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSetCorrectOption(opt.optionId)}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border transition-all ${
                          isCorrect
                            ? 'border-[#188A5A] bg-[#188A5A] text-white shadow-2xs'
                            : 'border-[#F2E4D8] bg-white text-[#8C827A] hover:border-[#188A5A]'
                        }`}
                        title={isCorrect ? 'Đáp án đúng' : 'Bấm để chọn làm đáp án đúng'}
                      >
                        {isCorrect ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </button>

                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-black ${
                          isCorrect ? 'bg-[#188A5A] text-white' : 'bg-[#FFF9F5] text-[#8C827A]'
                        }`}
                      >
                        {opt.optionId.toUpperCase()}
                      </span>

                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleOptionChange(opt.optionId, e.target.value)}
                        placeholder={`Nội dung lựa chọn ${opt.optionId.toUpperCase()}`}
                        className="flex-1 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-3 py-2 text-xs text-[#2B2826] outline-none transition-all placeholder:text-[#8C827A]/70 focus:border-[#B91B1C] focus:bg-white"
                      />

                      {local.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(opt.optionId)}
                          className="rounded-lg p-1.5 text-[#8C827A] hover:bg-[#FDF1F1] hover:text-[#B91B1C]"
                          title="Xóa lựa chọn này"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-[#2B2826]">
                  Từ được chấp nhận <span className="text-[#B91B1C]">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddAcceptedAnswer}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#B91B1C] hover:underline"
                >
                  <Plus className="h-3 w-3" />
                  Thêm từ đồng nghĩa
                </button>
              </div>

              <div className="space-y-2">
                {(local.acceptedAnswers || ['']).map((ans, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#FFF9F5] font-mono text-[10px] font-bold text-[#8C827A]">
                      #{i + 1}
                    </span>
                    <input
                      type="text"
                      value={ans}
                      onChange={(e) => handleAcceptedAnswerChange(i, e.target.value)}
                      placeholder="Từ đúng (ví dụ: 服务员)"
                      className="flex-1 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-3 py-2 font-fraunces text-xs font-bold text-[#2B2826] outline-none transition-all focus:border-[#B91B1C] focus:bg-white"
                    />
                    {(local.acceptedAnswers || []).length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAcceptedAnswer(i)}
                        className="rounded-lg p-1.5 text-[#8C827A] hover:bg-[#FDF1F1] hover:text-[#B91B1C]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Row 3: Vietnamese Explanation */}
          <div>
            <label className="mb-1 block font-bold text-[#2B2826]">
              Giải thích đáp án (Tiếng Việt) <span className="text-[#B91B1C]">*</span>
            </label>
            <textarea
              rows={2}
              value={local.explanationVi}
              onChange={(e) => setField('explanationVi', e.target.value)}
              placeholder="Giải thích lý do chọn đáp án này..."
              className="w-full resize-none rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] p-2.5 text-xs text-[#2B2826] outline-none transition-all placeholder:text-[#8C827A]/70 focus:border-[#B91B1C] focus:bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Quiz Generation Modal (preview questions produced by Gemini)
// ---------------------------------------------------------------------------

const AI_KIND_LABELS: Record<QuizQuestionKind, string> = {
  comprehension: 'Hiểu nội dung',
  vocabulary: 'Từ vựng',
  grammar: 'Ngữ pháp',
  cloze: 'Điền từ',
};

const AI_STATUS_STYLES: Record<
  AdminQuizAiStatus['aiGenerationStatus'],
  { bg: string; text: string; border: string; label: string; spin: boolean }
> = {
  pending: {
    bg: 'bg-[#FFF8EC]',
    text: 'text-[#B45309]',
    border: 'border-[#FDE6BA]',
    label: 'Panda AI: Đang chờ…',
    spin: true,
  },
  running: {
    bg: 'bg-[#FFF8EC]',
    text: 'text-[#B45309]',
    border: 'border-[#FDE6BA]',
    label: 'Panda AI: Đang sinh câu hỏi…',
    spin: true,
  },
  completed: {
    bg: 'bg-[#EAF5F1]',
    text: 'text-[#188A5A]',
    border: 'border-[#C6E7DA]',
    label: 'Panda AI: Đã sinh câu hỏi',
    spin: false,
  },
  failed: {
    bg: 'bg-[#FDF1F1]',
    text: 'text-[#B91B1C]',
    border: 'border-[#F9D2D2]',
    label: 'Panda AI: Lỗi',
    spin: false,
  },
  skipped: {
    bg: 'bg-[#F4EFEA]',
    text: 'text-[#6E655F]',
    border: 'border-[#E5DCD3]',
    label: 'Panda AI: Bỏ qua',
    spin: false,
  },
  not_found: {
    bg: 'bg-[#F4EFEA]',
    text: 'text-[#6E655F]',
    border: 'border-[#E5DCD3]',
    label: 'Chưa có bài tập nháp',
    spin: false,
  },
};

function AiStatusBadge({ status }: { status: AdminQuizAiStatus | null }) {
  if (!status) return null;
  const key = status.aiGenerationStatus;
  if (!key) return null;
  const style = AI_STATUS_STYLES[key];
  if (!style) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap shadow-2xs ${style.bg} ${style.text} ${style.border}`}
      title={
        status.aiGenerationStatus === 'completed' && status.aiGenerationQuestionCount !== undefined
          ? `Panda AI đã sinh ${status.aiGenerationQuestionCount} câu hỏi`
          : style.label
      }
    >
      <Sparkles className={`h-3 w-3 shrink-0 ${style.spin ? 'animate-pulse' : ''}`} />
      <span>
        {status.aiGenerationStatus === 'completed' && status.aiGenerationQuestionCount !== undefined
          ? `AI: ${status.aiGenerationQuestionCount} câu hỏi`
          : style.label}
      </span>
    </span>
  );
}

function AiQuizGenerationModal({
  open,
  busy,
  error,
  kinds,
  questionCount,
  draft,
  selectedIds,
  lessonTitleVi,
  onChangeKinds,
  onChangeCount,
  onGenerate,
  onToggleSelected,
  onImport,
  onClose,
}: {
  open: boolean;
  busy: boolean;
  error: string;
  kinds: QuizQuestionKind[];
  questionCount: number;
  draft: GeneratedAiQuestion[];
  selectedIds: Set<string>;
  lessonTitleVi: string;
  onChangeKinds: (kinds: QuizQuestionKind[]) => void;
  onChangeCount: (count: number) => void;
  onGenerate: () => void;
  onToggleSelected: (id: string) => void;
  onImport: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  const allKinds: QuizQuestionKind[] = ['comprehension', 'vocabulary', 'grammar', 'cloze'];
  const totalSelected = Array.from(selectedIds).length;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-quiz-modal-title"
    >
      <div
        className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-[#F2E4D8] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F2E4D8] bg-[#FFF9F5] px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#FDF1F1] text-[#B91B1C] ring-1 ring-[#B91B1C]/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 id="ai-quiz-modal-title" className="text-base font-black text-[#2B2826]">
                Sinh câu hỏi bằng Panda AI
              </h2>
              <p className="text-[11px] text-[#8C827A]">
                Dựa trên phụ đề video để tạo bộ câu hỏi tự động.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8C827A] hover:bg-white hover:text-[#2B2826]"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[64vh] overflow-y-auto px-5 py-5">
          {draft.length === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#2B2826] mb-1.5">
                  Loại câu hỏi
                </label>
                <div className="flex flex-wrap gap-2">
                  {allKinds.map((kind) => {
                    const active = kinds.includes(kind);
                    return (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => {
                          const next = active
                            ? kinds.filter((k) => k !== kind)
                            : kinds.length >= 4
                              ? kinds
                              : [...kinds, kind];
                          onChangeKinds(next);
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                          active
                            ? 'bg-[#B91B1C] text-white shadow-2xs'
                            : 'border border-[#F2E4D8] bg-white text-[#2B2826] hover:border-[#B91B1C]'
                        }`}
                      >
                        {AI_KIND_LABELS[kind]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#2B2826] mb-1.5">
                  Số câu muốn sinh (1 - 15)
                </label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={questionCount}
                  onChange={(e) => onChangeCount(Math.max(1, Math.min(15, Number(e.target.value) || 1)))}
                  className="w-24 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-3 py-2 text-xs font-bold text-[#2B2826] outline-none focus:border-[#B91B1C]"
                />
              </div>
              {lessonTitleVi && (
                <div className="rounded-xl bg-[#FFF9F5] p-3 text-[11px] text-[#8C827A]">
                  Bài học: <strong className="text-[#2B2826]">{lessonTitleVi}</strong>
                </div>
              )}
              {error && (
                <div className="rounded-xl border border-[#F9D2D2] bg-[#FDF1F1] p-3 text-xs font-bold text-[#B91B1C]">
                  {error}
                </div>
              )}
              <button
                type="button"
                onClick={onGenerate}
                disabled={busy || kinds.length === 0}
                className="w-full rounded-xl bg-[#B91B1C] px-5 py-2.5 text-xs font-black text-white shadow-2xs shadow-[#B91B1C]/25 transition-all hover:bg-[#A3181A] active:scale-[0.98] disabled:opacity-40"
              >
                {busy ? 'Panda AI đang phân tích phụ đề…' : 'Sinh câu hỏi ngay'}
              </button>
            </div>
          )}

          {draft.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-[#FFF9F5] p-2.5 text-[11px]">
                <span className="font-bold text-[#2B2826]">
                  {draft.length} câu hỏi từ AI · {totalSelected} đã chọn
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => onToggleSelected('__select_all__')}
                    className="rounded-md border border-[#F2E4D8] bg-white px-2 py-1 text-[11px] font-bold text-[#2B2826] hover:bg-[#FDF1F1]"
                  >
                    {totalSelected === draft.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </button>
                  <button
                    type="button"
                    onClick={onGenerate}
                    disabled={busy}
                    className="rounded-md border border-[#F2E4D8] bg-white px-2 py-1 text-[11px] font-bold text-[#2B2826] hover:bg-[#FDF1F1] disabled:opacity-40"
                  >
                    {busy ? 'Đang tạo lại…' : 'Tạo lại'}
                  </button>
                </div>
              </div>

              {draft.map((question) => {
                const selected = selectedIds.has(question.questionId);
                return (
                  <div
                    key={question.questionId}
                    className={`rounded-2xl border p-3.5 transition ${
                      selected ? 'border-[#B91B1C] bg-[#FDF1F1]' : 'border-[#F2E4D8] bg-white hover:border-[#B91B1C]/40'
                    }`}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onToggleSelected(question.questionId)}
                        className="mt-1 h-4 w-4 cursor-pointer accent-[#B91B1C]"
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-black border ${
                              question.type === 'multiple_choice'
                                ? 'border-[#C6E7DA] bg-[#EAF5F1] text-[#188A5A]'
                                : 'border-[#FDE6BA] bg-[#FFF8EC] text-[#B45309]'
                            }`}
                          >
                            {question.type === 'multiple_choice' ? 'Trắc nghiệm' : 'Điền từ'}
                          </span>
                          {question.cueId && (
                            <span className="rounded-md border border-[#F2E4D8] bg-[#FFF9F5] px-2 py-0.5 text-[10px] font-bold text-[#8C827A]">
                              🎬 {question.cueId}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold leading-snug text-[#2B2826]">
                          {question.prompt}
                        </p>
                        {question.options.length > 0 && (
                          <ul className="space-y-0.5 pl-2 text-xs text-[#6E655F]">
                            {question.options.map((opt) => {
                              const correct = opt.optionId === question.correctOptionId;
                              return (
                                <li key={opt.optionId} className={correct ? 'font-bold text-[#188A5A]' : ''}>
                                  {opt.optionId.toUpperCase()}. {opt.text}
                                  {correct && ' ✓'}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {question.acceptedAnswers && question.acceptedAnswers.length > 0 && (
                          <div className="flex flex-wrap gap-1 text-[11px]">
                            <span className="font-bold text-[#8C827A]">Đáp án:</span>
                            {question.acceptedAnswers.map((ans, i) => (
                              <span
                                key={i}
                                className="rounded-md border border-[#C6E7DA] bg-[#EAF5F1] px-1.5 py-0.5 font-bold text-[#188A5A]"
                              >
                                {ans}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-[11px] italic text-[#8C827A]">💡 {question.explanationVi}</p>
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[#F2E4D8] bg-[#FFF9F5] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#F2E4D8] bg-white px-4 py-2 text-xs font-bold text-[#2B2826] hover:bg-[#FFF9F5] active:scale-[0.98]"
          >
            Đóng
          </button>
          {draft.length > 0 && (
            <button
              type="button"
              onClick={onImport}
              disabled={totalSelected === 0}
              className="rounded-xl bg-[#B91B1C] px-5 py-2 text-xs font-bold text-white shadow-2xs shadow-[#B91B1C]/25 transition-all hover:bg-[#A3181A] active:scale-[0.98] disabled:opacity-40"
            >
              Thêm {totalSelected} câu đã chọn
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
