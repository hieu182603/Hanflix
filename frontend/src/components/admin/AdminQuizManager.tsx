import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ListChecks,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  X,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Save,
  Clock,
  Layers,
  Sparkles,
  CheckSquare,
  Square,
  Copy,
  Subtitles,
  HelpCircle,
  Play,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import { useNotification } from '../notifications';
import { Spinner } from '../notifications';
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
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
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

export default function AdminQuizManager({ lessonId: propLessonId }: { lessonId?: string } = {}) {
  const params = useParams<{ lessonId?: string }>();
  const activeParamLessonId = propLessonId || params.lessonId || '';
  const navigate = useNavigate();
  const notify = useNotification();
  const [lessons, setLessons] = useState<AdminLesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState(activeParamLessonId);
  const [quizData, setQuizData] = useState<QuizItem | null>(null);
  const [localQuestions, setLocalQuestions] = useState<AdminQuestion[]>([]);

  // State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingLesson, setFetchingLesson] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [hskFilter, setHskFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'ready_for_review' | 'published'>('all');

  // Question editing / view modes
  const [previewMode, setPreviewMode] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // AI generation state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiKinds, setAiKinds] = useState<QuizQuestionKind[]>(['comprehension', 'vocabulary']);
  const [aiCount, setAiCount] = useState(5);
  const [aiDraft, setAiDraft] = useState<GeneratedAiQuestion[]>([]);
  const [aiSelectedIds, setAiSelectedIds] = useState<Set<string>>(new Set());
  const [aiStatus, setAiStatus] = useState<AdminQuizAiStatus | null>(null);
  const [regenerateBusy, setRegenerateBusy] = useState(false);

  // Load lesson list on mount
  useEffect(() => {
    loadLessons();
  }, []);

  // Sync with route param if it changes
  useEffect(() => {
    if (activeParamLessonId && activeParamLessonId !== selectedLessonId) {
      loadLessonQuiz(activeParamLessonId);
    }
  }, [activeParamLessonId]);

  // F-load AI generation status: refresh whenever the selected lesson changes,
  // and poll every 4s while the background job is pending/running so the badge
  // updates without manual reload.
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
          // If the job finished, refresh the quiz questions too so the new
          // AI-generated questions appear in the editor.
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

  const loadLessons = async () => {
    setLoading(true);
    try {
      const items = await listAdminLessons();
      setLessons(items);
      // Auto-select param lesson or first lesson if none selected
      const targetId = activeParamLessonId || selectedLessonId || (items.length > 0 ? items[0]._id : '');
      if (targetId) {
        loadLessonQuiz(targetId);
      }
    } catch (err) {
      console.error(err);
      showMsg('error', 'Không thể tải danh sách bài học');
    } finally {
      setLoading(false);
    }
  };

  const loadLessonQuiz = useCallback(async (lessonId: string) => {
    setFetchingLesson(true);
    setSelectedLessonId(lessonId);
    setEditingIndex(null);
    setIsAddingNew(false);
    setPreviewMode(false);
    try {
      const data = await getAdminReview(lessonId);
      const item: QuizItem = {
        lesson: data.lesson,
        questions: data.quiz?.questions ?? [],
        subtitleCues: data.subtitle?.cues ?? [],
      };
      setQuizData(item);
      setLocalQuestions(data.quiz?.questions ?? []);
      // F-load AI status in the background; failure is non-blocking.
      getAdminQuizAiStatus(lessonId).then(setAiStatus).catch(() => undefined);
    } catch (err) {
      console.error(err);
      showMsg('error', 'Không thể tải bài luyện tập cho video này');
      setQuizData(null);
    } finally {
      setFetchingLesson(false);
    }
  }, []);

  const showMsg = (type: 'success' | 'error', text: string) => {
    notify.toast(type, text);
  };

  // Question CRUD
  const handleAddNewQuestion = () => {
    const newQ = makeEmptyQuestion();
    setLocalQuestions((prev) => [...prev, newQ]);
    setEditingIndex(localQuestions.length);
    setIsAddingNew(true);
  };

  const handleUpdateQuestion = (idx: number, updated: AdminQuestion) => {
    setLocalQuestions((prev) => prev.map((q, i) => (i === idx ? updated : q)));
    setEditingIndex(null);
    setIsAddingNew(false);
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
    showMsg('success', `Đã nhân bản câu hỏi #${idx + 1}`);
  };

  const handleRemoveQuestion = async (idx: number) => {
    if (!await notify.confirm({
      title: 'Xóa câu hỏi',
      message: `Bạn có chắc muốn xóa câu hỏi #${idx + 1}?`,
      confirmText: 'Xóa',
      tone: 'danger',
    })) return;
    setLocalQuestions((prev) => prev.filter((_, i) => i !== idx));
    if (editingIndex === idx) setEditingIndex(null);
  };

  const handleMoveQuestion = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= localQuestions.length) return;
    setLocalQuestions((prev) => {
      const arr = [...prev];
      [arr[idx], arr[targetIdx]] = [arr[targetIdx], arr[idx]];
      return arr;
    });
    if (editingIndex === idx) setEditingIndex(targetIdx);
  };

  // Save changes
  const handleSave = async () => {
    if (!selectedLessonId) return;
    setSaving(true);
    try {
      await saveAdminQuiz(selectedLessonId, localQuestions);
      showMsg('success', 'Đã lưu danh sách câu hỏi thành công!');
      if (quizData) {
        setQuizData({ ...quizData, questions: localQuestions });
      }
    } catch (err: any) {
      showMsg('error', err?.message || 'Lỗi khi lưu bài luyện tập');
    } finally {
      setSaving(false);
    }
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
      showMsg('success', `AI đã sinh ${generated.length} câu hỏi. Bấm vào từng câu để chọn.`);
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
    showMsg('success', `Đã thêm ${selectedQuestions.length} câu hỏi từ AI vào danh sách. Nhớ bấm "Lưu thay đổi".`);
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
      showMsg('success', 'Đã yêu cầu Panda AI tạo lại bài tập. Trạng thái sẽ tự cập nhật.');
    } catch (err: any) {
      showMsg('error', err?.message || 'Không thể tạo lại câu hỏi lúc này');
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
      showMsg('error', 'Cần ít nhất 1 câu hỏi trước khi xuất bản bài luyện tập');
      return;
    }
    setSaving(true);
    try {
      await saveAdminQuiz(selectedLessonId, localQuestions);
      await publishAdminLesson(selectedLessonId);
      showMsg('success', 'Đã xuất bản bài học và bộ bài tập trắc nghiệm!');
      await loadLessons();
      await loadLessonQuiz(selectedLessonId);
    } catch (err: any) {
      showMsg('error', err?.message || 'Lỗi khi xuất bản bài luyện tập');
    } finally {
      setSaving(false);
    }
  };

  // Filter lessons
  const filteredLessons = lessons.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (hskFilter && String(l.hsk) !== hskFilter) return false;
    if (
      searchQuery &&
      !(l.titleVi + (l.titleZh || '') + (l.pinyin || '')).toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const selectedLesson = lessons.find((l) => l._id === selectedLessonId);
  const hasUnsavedChanges = JSON.stringify(localQuestions) !== JSON.stringify(quizData?.questions ?? []);

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
        <div className="pointer-events-none absolute -right-6 -bottom-8 select-none font-serif text-8xl font-black text-[#B91B1C]/5">
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
              onClick={loadLessons}
              disabled={loading}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-4 text-xs font-bold text-[#2B2826] shadow-2xs transition-all hover:border-[#B91B1C]/30 hover:bg-white disabled:opacity-40 active:scale-[0.98]"
            >
              <RefreshCw className={`h-4 w-4 text-[#8C827A] ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>

            {selectedLessonId && (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving || !hasUnsavedChanges}
                  className={`flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-bold shadow-2xs transition-all active:scale-[0.98] ${
                    hasUnsavedChanges
                      ? 'border-[#B91B1C] bg-[#FDF1F1] text-[#B91B1C] hover:bg-[#FCE8E8]'
                      : 'cursor-not-allowed border-[#F2E4D8] bg-[#FFF9F5] text-[#8C827A] opacity-50'
                  }`}
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? 'Đang lưu...' : hasUnsavedChanges ? 'Lưu thay đổi *' : 'Đã lưu'}</span>
                </button>

                {quizData?.lesson.status === 'published' ? (
                  <span className="flex h-10 items-center gap-1.5 rounded-xl border border-[#C6E7DA] bg-[#EAF5F1] px-4 text-xs font-bold text-[#188A5A]">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Đã xuất bản</span>
                  </span>
                ) : (
                  <button
                    onClick={handlePublish}
                    disabled={saving || localQuestions.length === 0}
                    className="flex h-10 items-center gap-2 rounded-xl bg-[#B91B1C] px-4 text-xs font-bold text-white shadow-2xs shadow-[#B91B1C]/25 transition-all hover:bg-[#A3181A] disabled:opacity-40 active:scale-[0.98]"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Xuất bản</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar - 1 row */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-[#F2E4D8] bg-white p-3 shadow-2xs overflow-x-auto">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C827A]" />
          <input
            type="text"
            placeholder="Tìm bài học theo tên Việt, Trung hoặc mô tả..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] pl-9 pr-8 text-xs text-[#2B2826] outline-none transition-all placeholder:text-[#8C827A]/70 focus:border-[#B91B1C] focus:bg-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C827A] hover:text-[#2B2826] transition-colors"
              title="Xóa tìm kiếm"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* HSK Level Filter */}
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

          {/* Status Filter */}
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

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Lesson Selector */}
        <div className="space-y-4 lg:col-span-5 xl:col-span-4">
          {/* Lesson List */}
          <div className="max-h-[680px] overflow-y-auto overflow-hidden rounded-3xl border border-[#F2E4D8] bg-white shadow-2xs divide-y divide-[#F2E4D8]">
            {loading ? (
              <div className="p-10 text-center text-[#8C827A]">
                <Spinner size="md" tone="brand" className="mx-auto mb-2" />
                <p className="text-xs">Đang tải danh sách bài học...</p>
              </div>
            ) : filteredLessons.length === 0 ? (
              <div className="p-8 text-center text-[#8C827A]">
                <BookOpen className="mx-auto mb-2 h-8 w-8 text-[#8C827A]/40" />
                <p className="text-xs font-bold text-[#2B2826]">Không tìm thấy bài học nào</p>
                <p className="mt-0.5 text-[11px] text-[#8C827A]">Thử đổi từ khóa hoặc bộ lọc HSK.</p>
              </div>
            ) : (
              filteredLessons.map((lesson) => {
                const isSelected = lesson._id === selectedLessonId;
                const lvlKey = String(lesson.hsk);
                const styling = HSK_COLORS[lvlKey] || HSK_COLORS['1'];

                return (
                  <button
                    key={lesson._id}
                    onClick={() => {
                      navigate(`/admin/quiz/${lesson._id}`);
                      loadLessonQuiz(lesson._id);
                    }}
                    className={`flex w-full items-start justify-between gap-3 p-4 text-left transition-all ${
                      isSelected
                        ? 'border-l-4 border-l-[#B91B1C] bg-[#FDF1F1]'
                        : 'hover:bg-[#FFF9F5]/70'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-black border ${styling.bg} ${styling.text} ${styling.border}`}>
                          HSK {lesson.hsk}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black border ${
                            lesson.status === 'published'
                              ? 'border-[#C6E7DA] bg-[#EAF5F1] text-[#188A5A]'
                              : lesson.status === 'ready_for_review'
                              ? 'border-[#FDE6BA] bg-[#FFF8EC] text-[#B45309]'
                              : 'border-[#E5DCD3] bg-[#F4EFEA] text-[#6E655F]'
                          }`}
                        >
                          {lesson.status === 'published'
                            ? 'Đã xuất bản'
                            : lesson.status === 'ready_for_review'
                            ? 'Chờ duyệt'
                            : 'Nháp'}
                        </span>
                      </div>

                      <p
                        className={`line-clamp-1 text-sm font-bold leading-snug ${
                          isSelected ? 'text-[#B91B1C]' : 'text-[#2B2826]'
                        }`}
                      >
                        {lesson.titleVi}
                      </p>
                      {lesson.titleZh && (
                        <p className="mt-0.5 line-clamp-1 font-serif text-xs text-[#8C827A]">
                          {lesson.titleZh}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Quiz Builder & Learner Preview */}
        <div className="lg:col-span-7 xl:col-span-8">
          {!selectedLessonId ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-[#F2E4D8] bg-white p-12 text-center shadow-2xs">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-[#F2E4D8] bg-[#FFF9F5]">
                <Layers className="h-7 w-7 text-[#8C827A]" />
              </div>
              <h3 className="text-lg font-extrabold text-[#2B2826]">Chọn một bài học để soạn câu hỏi</h3>
              <p className="mt-1.5 max-w-sm text-xs text-[#8C827A]">
                Danh sách bài học ở cột bên trái phân loại theo chuẩn HSK 1 đến 9. Bấm chọn bài học để bắt đầu.
              </p>
            </div>
          ) : fetchingLesson ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-[#F2E4D8] bg-white p-12 shadow-2xs">
              <Spinner size="lg" tone="brand" className="mb-3" />
              <p className="text-xs font-bold text-[#8C827A]">Đang tải dữ liệu câu hỏi bài tập...</p>
            </div>
          ) : quizData ? (
            <div className="space-y-4">
              {/* Lesson Meta Card & Mode Switcher */}
              {(() => {
                const lvlKey = String(quizData.lesson.hsk || 1);
                const hskStyle = HSK_COLORS[lvlKey] || HSK_COLORS['1'];
                return (
                  <div className="rounded-3xl border border-[#F2E4D8] bg-white p-5 sm:p-6 shadow-2xs">
                    {/* Row 1: Metadata Badges */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-black tracking-wide border whitespace-nowrap shadow-2xs ${hskStyle.bg} ${hskStyle.text} ${hskStyle.border}`}>
                        HSK {quizData.lesson.hsk}
                      </span>

                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#FFF9F5] border border-[#F2E4D8] text-[11px] font-semibold text-[#5F6368] whitespace-nowrap shadow-2xs">
                        <Clock className="h-3 w-3 text-[#8C827A]" />
                        <span>Thời lượng: {formatDuration(quizData.lesson.durationSeconds || 0)}</span>
                      </span>

                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#FFF9F5] border border-[#F2E4D8] text-[11px] font-semibold text-[#5F6368] whitespace-nowrap shadow-2xs">
                        <Subtitles className="h-3 w-3 text-[#8C827A]" />
                        <span>{quizData.subtitleCues.length} câu thoại</span>
                      </span>

                      <AiStatusBadge status={aiStatus} />

                      {quizData.lesson.status && (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold border whitespace-nowrap shadow-2xs ${
                            quizData.lesson.status === 'published'
                              ? 'border-[#C6E7DA] bg-[#EAF5F1] text-[#188A5A]'
                              : quizData.lesson.status === 'ready_for_review'
                              ? 'border-[#FDE6BA] bg-[#FFF8EC] text-[#B45309]'
                              : 'border-[#E5DCD3] bg-[#F4EFEA] text-[#6E655F]'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            quizData.lesson.status === 'published' ? 'bg-[#188A5A]' : quizData.lesson.status === 'ready_for_review' ? 'bg-[#B45309]' : 'bg-[#8C827A]'
                          }`} />
                          <span>
                            {quizData.lesson.status === 'published' ? 'Đã xuất bản' : quizData.lesson.status === 'ready_for_review' ? 'Chờ duyệt' : 'Bản nháp'}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Row 2: Title & Actions Toolbar */}
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between pt-1">
                      {/* Left: Lesson Titles */}
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#18181B] leading-snug">
                          {quizData.lesson.titleVi}
                        </h2>
                        {quizData.lesson.titleZh && (
                          <p className="mt-1 font-serif text-sm font-semibold text-[#8C827A] tracking-wide">
                            {quizData.lesson.titleZh}
                          </p>
                        )}
                        {aiStatus?.aiGenerationError && aiStatus.aiGenerationStatus !== 'completed' && (
                          <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-[#F9D2D2] bg-[#FDF1F1] px-3 py-2 text-xs font-bold text-[#B91B1C]">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>Panda AI: {aiStatus.aiGenerationError}</span>
                          </div>
                        )}
                      </div>

                      {/* Right: Actions Toolbar */}
                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={handleRegenerate}
                          disabled={regenerateBusy || aiStatus?.aiGenerationStatus === 'pending' || aiStatus?.aiGenerationStatus === 'running'}
                          className="flex h-10 items-center gap-2 rounded-xl border border-[#B91B1C]/25 bg-white px-3.5 text-xs font-bold text-[#B91B1C] shadow-2xs transition-all hover:bg-[#FDF1F1] hover:border-[#B91B1C]/50 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                          title="Yêu cầu Panda AI tạo lại toàn bộ câu hỏi"
                        >
                          {regenerateBusy ? (
                            <Spinner size="sm" tone="brand" />
                          ) : (
                            <RefreshCw className="h-4 w-4 text-[#B91B1C]" />
                          )}
                          <span>Tạo lại bằng AI</span>
                        </button>

                        {/* Toggle Mode: Editor vs Learner Preview */}
                        <div className="flex items-center rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] p-1 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setPreviewMode(false)}
                            className={`flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold transition-all cursor-pointer ${
                              !previewMode
                                ? 'border border-[#F2E4D8]/80 bg-white text-[#18181B] shadow-2xs'
                                : 'text-[#8C827A] hover:text-[#18181B]'
                            }`}
                          >
                            <Edit2 className={`h-3.5 w-3.5 ${!previewMode ? 'text-[#B91B1C]' : ''}`} />
                            <span>Biên tập ({localQuestions.length})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewMode(true)}
                            className={`flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold transition-all cursor-pointer ${
                              previewMode
                                ? 'bg-[#B91B1C] text-white shadow-2xs shadow-[#B91B1C]/20'
                                : 'text-[#8C827A] hover:text-[#B91B1C]'
                            }`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Xem trước học viên</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Mode 1: Learner Preview Mode */}
              {previewMode ? (
                <LearnerQuizPreview
                  questions={localQuestions}
                  cues={quizData.subtitleCues}
                  onExit={() => setPreviewMode(false)}
                />
              ) : (
                /* Mode 2: Quiz Builder / Editor Mode */
                <div className="overflow-hidden rounded-3xl border border-[#F2E4D8] bg-white shadow-2xs">
                  <div className="flex items-center justify-between border-b border-[#F2E4D8] bg-[#FFF9F5]/40 px-5 py-4">
                    <div>
                      <h3 className="text-sm font-black text-[#2B2826]">Danh sách câu hỏi bài tập</h3>
                      <p className="text-[11px] text-[#8C827A]">
                        Mỗi bài học nên có từ 3 đến 7 câu hỏi để củng cố từ vựng và ngữ pháp.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={openAiGenerator}
                        disabled={fetchingLesson || quizData.subtitleCues.length === 0}
                        className="flex h-9 items-center gap-1.5 rounded-xl border border-[#B91B1C]/30 bg-white px-4 text-xs font-bold text-[#B91B1C] shadow-2xs transition-all hover:bg-[#FDF1F1] active:scale-[0.98] disabled:opacity-40"
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>Tạo bằng AI</span>
                      </button>
                      <button
                        onClick={handleAddNewQuestion}
                        className="flex h-9 items-center gap-1.5 rounded-xl bg-[#B91B1C] px-4 text-xs font-bold text-white shadow-2xs shadow-[#B91B1C]/25 transition-all hover:bg-[#A3181A] active:scale-[0.98]"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Thêm câu hỏi mới</span>
                      </button>
                    </div>
                  </div>

                  {localQuestions.length === 0 ? (
                    <div className="flex flex-col items-center p-12 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FDF1F1] text-[#B91B1C] ring-1 ring-[#B91B1C]/20 shadow-2xs">
                        <HelpCircle className="h-6 w-6" />
                      </div>
                      <p className="mb-1 text-sm font-bold text-[#2B2826]">Chưa có câu hỏi nào cho bài học này</p>
                      <p className="mb-4 max-w-sm text-xs text-[#8C827A]">
                        Bấm nút bên dưới để thêm câu hỏi trắc nghiệm hoặc điền từ vào chỗ trống liên kết với phụ đề phim.
                      </p>
                      <button
                        onClick={handleAddNewQuestion}
                        className="flex h-9 items-center gap-2 rounded-xl bg-[#B91B1C] px-4 text-xs font-bold text-white shadow-2xs shadow-[#B91B1C]/25 transition-all hover:bg-[#A3181A] active:scale-[0.98]"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Tạo câu hỏi đầu tiên</span>
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#F2E4D8]">
                      {localQuestions.map((question, idx) => {
                        const isEditing = editingIndex === idx;
                        const boundCue = quizData.subtitleCues.find((c) => c.cueId === question.cueId);

                        if (isEditing) {
                          return (
                            <div key={`edit-${question.questionId || idx}`} className="bg-[#FFFDFB] p-5">
                              <QuestionForm
                                question={question}
                                cues={quizData.subtitleCues}
                                index={idx}
                                onSave={(updated) => handleUpdateQuestion(idx, updated)}
                                onCancel={() => {
                                  if (isAddingNew && idx === localQuestions.length - 1 && !question.prompt) {
                                    setLocalQuestions((prev) => prev.filter((_, i) => i !== idx));
                                  }
                                  setEditingIndex(null);
                                  setIsAddingNew(false);
                                }}
                              />
                            </div>
                          );
                        }

                        return (
                          <div
                            key={`row-${question.questionId || idx}`}
                            className="group p-5 transition-colors hover:bg-[#FFF9F5]/60"
                          >
                            <div className="flex items-start gap-3">
                              {/* Move Controls & Index */}
                              <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleMoveQuestion(idx, -1)}
                                  disabled={idx === 0}
                                  className="rounded p-0.5 text-[#8C827A] hover:text-[#2B2826] disabled:opacity-20"
                                  title="Di chuyển lên"
                                >
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-6 text-center font-mono text-xs font-black text-[#2B2826]">
                                  Q{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleMoveQuestion(idx, 1)}
                                  disabled={idx === localQuestions.length - 1}
                                  className="rounded p-0.5 text-[#8C827A] hover:text-[#2B2826] disabled:opacity-20"
                                  title="Di chuyển xuống"
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              {/* Question Details */}
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded-md px-2 py-0.5 text-[10px] font-black border ${
                                      question.type === 'multiple_choice'
                                        ? 'border-[#C6E7DA] bg-[#EAF5F1] text-[#188A5A]'
                                        : 'border-[#FDE6BA] bg-[#FFF8EC] text-[#B45309]'
                                    }`}
                                  >
                                    {question.type === 'multiple_choice' ? 'Trắc nghiệm (4 đáp án)' : 'Điền từ'}
                                  </span>

                                  {/* Bound Cue Tag */}
                                  {boundCue ? (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-[#C6E7DA] bg-[#EAF5F1] px-2 py-0.5 text-[10px] font-bold text-[#188A5A]">
                                      <Subtitles className="h-3 w-3" />
                                      <span>
                                        [{formatCueTime(boundCue.startMs)}] {boundCue.zh}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] italic text-[#8C827A]">Chưa gắn phụ đề</span>
                                  )}
                                </div>

                                {/* Prompt */}
                                <p className="text-sm font-bold leading-relaxed text-[#2B2826]">
                                  {question.prompt || <span className="italic text-[#8C827A]">Chưa nhập câu hỏi</span>}
                                </p>

                                {/* Options Preview */}
                                {question.type === 'multiple_choice' ? (
                                  <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                                    {question.options.map((opt) => {
                                      const isCorrect = opt.optionId === question.correctOptionId;
                                      return (
                                        <div
                                          key={opt.optionId}
                                          className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-all ${
                                            isCorrect
                                              ? 'border-[#188A5A] bg-[#EAF5F1] font-bold text-[#188A5A] shadow-2xs'
                                              : 'border-[#F2E4D8] bg-white text-[#6E655F]'
                                          }`}
                                        >
                                          <span
                                            className={`flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-black ${
                                              isCorrect ? 'bg-[#188A5A] text-white' : 'bg-[#FFF9F5] text-[#8C827A]'
                                            }`}
                                          >
                                            {opt.optionId.toUpperCase()}
                                          </span>
                                          <span className="flex-1 truncate">{opt.text || '...'}</span>
                                          {isCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-[#188A5A]" />}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    <span className="text-[11px] font-bold text-[#8C827A]">Đáp án đúng:</span>
                                    {(question.acceptedAnswers || []).map((ans, i) => (
                                      <span
                                        key={i}
                                        className="rounded-md border border-[#C6E7DA] bg-[#EAF5F1] px-2.5 py-0.5 font-mono text-xs font-bold text-[#188A5A]"
                                      >
                                        {ans}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Explanation snippet */}
                                {question.explanationVi && (
                                  <div className="flex items-start gap-1.5 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] p-2 text-[11px] text-[#6E655F]">
                                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B45309]" />
                                    <span>
                                      <strong className="text-[#2B2826]">Giải thích:</strong> {question.explanationVi}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Row Actions */}
                              <div className="flex shrink-0 items-center gap-1 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingIndex(idx)}
                                  className="rounded-lg border border-[#F2E4D8] bg-white p-1.5 text-[#8C827A] transition-colors hover:bg-[#FFF9F5] hover:text-[#2B2826]"
                                  title="Chỉnh sửa câu hỏi"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateQuestion(idx)}
                                  className="rounded-lg border border-[#F2E4D8] bg-white p-1.5 text-[#8C827A] transition-colors hover:bg-[#FFF9F5] hover:text-[#2B2826]"
                                  title="Nhân bản câu hỏi"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveQuestion(idx)}
                                  className="rounded-lg border border-[#F2E4D8] bg-white p-1.5 text-[#8C827A] transition-colors hover:bg-[#FDF1F1] hover:text-[#B91B1C]"
                                  title="Xóa câu hỏi"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Question Form (Inline Editor for a single question)
// ---------------------------------------------------------------------------

function QuestionForm({
  question,
  cues,
  index,
  onSave,
  onCancel,
}: {
  question: AdminQuestion;
  cues: AdminCue[];
  index: number;
  onSave: (q: AdminQuestion) => void;
  onCancel: () => void;
}) {
  const [local, setLocal] = useState<AdminQuestion>({ ...question });

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

  // Accepted answers for fill_blank
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

  const isValid =
    local.prompt.trim() !== '' &&
    local.explanationVi.trim() !== '' &&
    (local.type === 'multiple_choice'
      ? local.options.every((o) => o.text.trim() !== '') && !!local.correctOptionId
      : (local.acceptedAnswers || []).some((a) => a.trim() !== ''));

  return (
    <div className="space-y-4 rounded-2xl border border-[#F2E4D8] bg-white p-5 text-xs shadow-xs">
      <div className="flex items-center justify-between border-b border-[#F2E4D8] pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#B91B1C] font-mono text-[11px] font-bold text-white shadow-2xs">
            Q{index + 1}
          </span>
          <h4 className="text-sm font-black text-[#2B2826]">Chỉnh Sửa Nội Dung Câu Hỏi</h4>
        </div>
        <button onClick={onCancel} className="rounded-lg p-1 text-[#8C827A] hover:bg-[#FFF9F5]">
          <X className="h-4 w-4" />
        </button>
      </div>

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
          <label className="mb-1 block font-bold text-[#2B2826]">Liên kết phụ đề trong phim (Cue)</label>
          <select
            value={local.cueId || ''}
            onChange={(e) => setField('cueId', e.target.value || undefined)}
            className="w-full rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-3 py-2 text-xs font-bold text-[#2B2826] outline-none transition-colors focus:border-[#B91B1C]"
          >
            <option value="">-- Không gắn câu thoại cụ thể --</option>
            {cues.map((c) => (
              <option key={c.cueId} value={c.cueId}>
                [{formatCueTime(c.startMs)}] {c.zh} ({c.vi})
              </option>
            ))}
          </select>
        </div>
      </div>

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

      {/* Multiple Choice Options */}
      {local.type === 'multiple_choice' ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="block font-bold text-[#2B2826]">
              Danh sách lựa chọn <span className="font-normal text-[#8C827A]">(Bấm radio để chọn đáp án đúng)</span>
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
                    className={`flex h-7 w-7 items-center justify-center rounded-xl border transition-all ${
                      isCorrect
                        ? 'border-[#188A5A] bg-[#188A5A] text-white shadow-2xs'
                        : 'border-[#F2E4D8] bg-white text-[#8C827A] hover:border-[#188A5A]'
                    }`}
                    title={isCorrect ? 'Đáp án đúng' : 'Bấm để chọn làm đáp án đúng'}
                  >
                    {isCorrect ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>

                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-black ${
                      isCorrect ? 'bg-[#188A5A] text-white' : 'bg-[#FFF9F5] text-[#8C827A]'
                    }`}
                  >
                    {opt.optionId.toUpperCase()}
                  </span>

                  <input
                    type="text"
                    required
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
        /* Fill in the blank answers */
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="block font-bold text-[#2B2826]">
              Danh sách từ được chấp nhận <span className="text-[#B91B1C]">*</span>
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
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#FFF9F5] font-mono text-[10px] font-bold text-[#8C827A]">
                  #{i + 1}
                </span>
                <input
                  type="text"
                  value={ans}
                  onChange={(e) => handleAcceptedAnswerChange(i, e.target.value)}
                  placeholder="Từ đúng (ví dụ: 服务员)"
                  className="flex-1 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-3 py-2 font-serif text-xs font-bold text-[#2B2826] outline-none transition-all focus:border-[#B91B1C] focus:bg-white"
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
          placeholder="Giải thích lý do chọn đáp án này, dịch nghĩa từ vựng hoặc ngữ pháp liên quan..."
          className="w-full resize-none rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] p-2.5 text-xs text-[#2B2826] outline-none transition-all placeholder:text-[#8C827A]/70 focus:border-[#B91B1C] focus:bg-white"
        />
      </div>

      {/* Form Buttons */}
      <div className="flex items-center justify-end gap-2 border-t border-[#F2E4D8] pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-4 py-2 font-bold text-[#8C827A] hover:bg-white active:scale-[0.98]"
        >
          Hủy bỏ
        </button>
        <button
          type="button"
          onClick={() => onSave(local)}
          disabled={!isValid}
          className="rounded-xl bg-[#B91B1C] px-5 py-2 font-bold text-white shadow-2xs shadow-[#B91B1C]/25 transition-all hover:bg-[#A3181A] disabled:opacity-40 active:scale-[0.98]"
        >
          Lưu câu hỏi
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Learner Quiz Preview (Simulates student interaction)
// ---------------------------------------------------------------------------

function LearnerQuizPreview({
  questions,
  cues,
  onExit,
}: {
  questions: AdminQuestion[];
  cues: AdminCue[];
  onExit: () => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [fillAnswer, setFillAnswer] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);

  const q = questions[currentIdx];
  const boundCue = q ? cues.find((c) => c.cueId === q.cueId) : undefined;

  const handleCheckAnswer = () => {
    setIsAnswered(true);
  };

  const handleNextQuestion = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((prev) => prev + 1);
      setSelectedOption(null);
      setFillAnswer('');
      setIsAnswered(false);
    }
  };

  const handlePrevQuestion = () => {
    if (currentIdx > 0) {
      setCurrentIdx((prev) => prev - 1);
      setSelectedOption(null);
      setFillAnswer('');
      setIsAnswered(false);
    }
  };

  const handleReset = () => {
    setCurrentIdx(0);
    setSelectedOption(null);
    setFillAnswer('');
    setIsAnswered(false);
  };

  if (!q) {
    return (
      <div className="rounded-3xl border border-[#F2E4D8] bg-white p-8 text-center shadow-2xs">
        <p className="text-xs text-[#8C827A]">Không có câu hỏi nào để xem trước.</p>
        <button
          onClick={onExit}
          className="mt-3 rounded-xl bg-[#2B2826] px-4 py-2 text-xs font-bold text-white hover:bg-[#1C1A19]"
        >
          Quay lại biên tập
        </button>
      </div>
    );
  }

  const isMultiple = q.type === 'multiple_choice';
  const isCorrect = isAnswered
    ? isMultiple
      ? selectedOption === q.correctOptionId
      : (q.acceptedAnswers || []).some(
          (ans) => ans.trim().toLowerCase() === fillAnswer.trim().toLowerCase()
        )
    : false;

  return (
    <div className="space-y-5 rounded-3xl border border-[#F2E4D8] bg-white p-6 shadow-2xs animate-in fade-in duration-200">
      {/* Top Banner for Preview Mode */}
      <div className="flex items-center justify-between border-b border-[#F2E4D8] pb-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#B91B1C] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-2xs shadow-[#B91B1C]/25">
            Learner Preview
          </span>
          <span className="text-xs font-bold text-[#8C827A]">
            Mô phỏng trải nghiệm học viên trên HanFlix
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="rounded-lg border border-[#F2E4D8] p-1.5 text-[#8C827A] hover:bg-[#FFF9F5]"
            title="Làm lại từ đầu"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onExit}
            className="text-xs font-bold text-[#B91B1C] hover:underline"
          >
            Đóng xem trước
          </button>
        </div>
      </div>

      {/* Progress Dots */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-black text-[#2B2826]">
          Câu hỏi {currentIdx + 1} / {questions.length}
        </span>
        <div className="flex items-center gap-1.5">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setCurrentIdx(i);
                setSelectedOption(null);
                setFillAnswer('');
                setIsAnswered(false);
              }}
              className={`h-2 rounded-full transition-all ${
                i === currentIdx
                  ? 'w-6 bg-[#B91B1C]'
                  : 'w-2 bg-[#F2E4D8] hover:bg-[#8C827A]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Cue Video Context Quote (if bound) */}
      {boundCue && (
        <div className="space-y-1 rounded-2xl border border-[#F2E4D8] bg-[#FFF9F5] p-3.5">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[#188A5A]">
            <Subtitles className="h-3 w-3" />
            <span>Dòng thoại trong phim [{formatCueTime(boundCue.startMs)}]</span>
          </div>
          <p className="font-serif text-base font-bold text-[#2B2826]">{boundCue.zh}</p>
          <p className="text-xs text-[#8C827A]">{boundCue.vi}</p>
        </div>
      )}

      {/* Prompt */}
      <div className="py-2">
        <h3 className="text-base font-black leading-snug text-[#2B2826]">{q.prompt}</h3>
      </div>

      {/* Interactive Options or Fill Input */}
      {isMultiple ? (
        <div className="space-y-2.5">
          {q.options.map((opt) => {
            const isSelected = selectedOption === opt.optionId;
            const isThisCorrect = opt.optionId === q.correctOptionId;

            let btnStyle = 'bg-white border-[#F2E4D8] hover:border-[#B91B1C]/40 text-[#2B2826]';
            if (isAnswered) {
              if (isThisCorrect) {
                btnStyle = 'bg-[#EAF5F1] border-[#188A5A] text-[#188A5A] font-bold ring-2 ring-[#188A5A]';
              } else if (isSelected && !isThisCorrect) {
                btnStyle = 'bg-[#FDF1F1] border-[#B91B1C] text-[#B91B1C] line-through';
              } else {
                btnStyle = 'bg-[#FFF9F5] border-[#F2E4D8] text-[#8C827A] opacity-60';
              }
            } else if (isSelected) {
              btnStyle = 'bg-[#2B2826] text-white border-[#2B2826] font-bold shadow-2xs';
            }

            return (
              <button
                key={opt.optionId}
                disabled={isAnswered}
                onClick={() => setSelectedOption(opt.optionId)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left text-xs transition-all ${btnStyle}`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-black ${
                    isSelected && !isAnswered
                      ? 'bg-white text-[#2B2826]'
                      : isAnswered && isThisCorrect
                      ? 'bg-[#188A5A] text-white'
                      : 'bg-[#FFF9F5] text-[#8C827A]'
                  }`}
                >
                  {opt.optionId.toUpperCase()}
                </span>
                <span className="flex-1 font-medium">{opt.text}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-xs font-bold text-[#2B2826]">Nhập câu trả lời của bạn:</label>
          <input
            type="text"
            disabled={isAnswered}
            value={fillAnswer}
            onChange={(e) => setFillAnswer(e.target.value)}
            placeholder="Gõ từ tiếng Trung..."
            className="w-full rounded-2xl border border-[#F2E4D8] bg-[#FFF9F5] px-4 py-3 font-serif text-sm font-bold text-[#2B2826] outline-none transition-all focus:border-[#B91B1C] focus:bg-white"
          />
        </div>
      )}

      {/* Feedback Banner after Check */}
      {isAnswered && (
        <div
          className={`space-y-1 rounded-2xl border p-4 text-xs animate-in fade-in duration-150 ${
            isCorrect
              ? 'border-[#C6E7DA] bg-[#EAF5F1] text-[#188A5A]'
              : 'border-[#F9D2D2] bg-[#FDF1F1] text-[#B91B1C]'
          }`}
        >
          <div className="flex items-center gap-1.5 text-sm font-black">
            {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{isCorrect ? 'Chính xác! Làm rất tốt.' : 'Chưa đúng rồi!'}</span>
          </div>
          {q.explanationVi && (
            <p className="mt-1 rounded-xl bg-white/70 p-2.5 text-xs text-[#2B2826]">
              <strong>Giải thích:</strong> {q.explanationVi}
            </p>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between border-t border-[#F2E4D8] pt-3">
        <button
          onClick={handlePrevQuestion}
          disabled={currentIdx === 0}
          className="rounded-xl border border-[#F2E4D8] bg-white px-4 py-2 text-xs font-bold text-[#8C827A] disabled:opacity-30 hover:bg-[#FFF9F5] active:scale-[0.98]"
        >
          Câu trước
        </button>

        {!isAnswered ? (
          <button
            onClick={handleCheckAnswer}
            disabled={isMultiple ? !selectedOption : !fillAnswer.trim()}
            className="rounded-xl bg-[#2B2826] px-5 py-2 text-xs font-bold text-white disabled:opacity-40 hover:bg-[#1C1A19] active:scale-[0.98]"
          >
            Kiểm tra đáp án
          </button>
        ) : (
          <button
            onClick={handleNextQuestion}
            disabled={currentIdx === questions.length - 1}
            className="rounded-xl bg-[#B91B1C] px-5 py-2 text-xs font-bold text-white shadow-2xs shadow-[#B91B1C]/25 transition-all hover:bg-[#A3181A] disabled:opacity-40 active:scale-[0.98]"
          >
            {currentIdx < questions.length - 1 ? 'Câu kế tiếp' : 'Hoàn thành xem trước'}
          </button>
        )}
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
  // Defensive: backend may return partial data, a `not_found` shorthand, or
  // unset the field on legacy rows. Guard every step so a malformed payload
  // can never crash the admin screen with a whitescreen.
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
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
                Dựa trên phụ đề video để tạo bộ câu hỏi tự động. Bạn có thể chọn/bỏ trước khi thêm vào.
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
          {/* Config Panel (only before generation) */}
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

          {/* Preview Panel */}
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
