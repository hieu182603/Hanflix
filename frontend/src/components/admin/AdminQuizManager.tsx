import React, { useState, useEffect, useCallback } from 'react';
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
import {
  listAdminLessons,
  getAdminReview,
  saveAdminQuiz,
  publishAdminLesson,
  type AdminLesson,
  type AdminQuestion,
  type AdminCue,
} from '../../api/admin';

interface QuizItem {
  lesson: Pick<AdminLesson, '_id' | 'titleVi' | 'titleZh' | 'status'> & { hsk?: number; durationSeconds?: number };
  questions: AdminQuestion[];
  subtitleCues: AdminCue[];
}

const HSK_LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

const HSK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '1': { bg: 'bg-[#E6F4EA]', text: 'text-[#137333]', border: 'border-[#CEEAD6]' },
  '2': { bg: 'bg-[#E8F0FE]', text: 'text-[#1A73E8]', border: 'border-[#D2E3FC]' },
  '3': { bg: 'bg-[#F3E8FD]', text: 'text-[#9334E6]', border: 'border-[#E9D5FF]' },
  '4': { bg: 'bg-[#FEF7E0]', text: 'text-[#B06000]', border: 'border-[#FEEFC3]' },
  '5': { bg: 'bg-[#FFF0E6]', text: 'text-[#EA580C]', border: 'border-[#FED7AA]' },
  '6': { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#FAD2CF]' },
  '7': { bg: 'bg-[#F1F5F9]', text: 'text-[#475569]', border: 'border-[#CBD5E1]' },
  '8': { bg: 'bg-[#F8FAFC]', text: 'text-[#334155]', border: 'border-[#94A3B8]' },
  '9': { bg: 'bg-[#0F172A]', text: 'text-white', border: 'border-[#1E293B]' },
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

export default function AdminQuizManager() {
  const [lessons, setLessons] = useState<AdminLesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [quizData, setQuizData] = useState<QuizItem | null>(null);
  const [localQuestions, setLocalQuestions] = useState<AdminQuestion[]>([]);

  // State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingLesson, setFetchingLesson] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [hskFilter, setHskFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'ready_for_review' | 'published'>('all');

  // Question editing / view modes
  const [previewMode, setPreviewMode] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Load lesson list on mount
  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    setLoading(true);
    try {
      const items = await listAdminLessons();
      setLessons(items);
      // Auto-select first lesson if none selected
      if (!selectedLessonId && items.length > 0) {
        loadLessonQuiz(items[0]._id);
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
    setStatusMsg(null);
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
    } catch (err) {
      console.error(err);
      showMsg('error', 'Không thể tải bài luyện tập cho video này');
      setQuizData(null);
    } finally {
      setFetchingLesson(false);
    }
  }, []);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 4000);
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

  const handleRemoveQuestion = (idx: number) => {
    if (!window.confirm(`Bạn có chắc muốn xóa câu hỏi #${idx + 1}?`)) return;
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
    setStatusMsg(null);
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
      {/* Top Banner & Header */}
      <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FDF1F1] text-[#B91B1C] flex items-center justify-center font-bold">
            <ListChecks className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-[#18181B] tracking-tight">Quản Lý Bài Luyện Tập</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-[#FDF1F1] text-[#B91B1C] text-[11px] font-black uppercase tracking-wider">
                HSK 1 - 9
              </span>
            </div>
            <p className="text-xs text-[#5F6368] mt-0.5">
              Soạn thảo câu hỏi trắc nghiệm & điền từ, liên kết chính xác với phụ đề video và kiểm tra qua chế độ xem trước học viên.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={loadLessons}
            disabled={loading}
            className="h-10 px-4 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] hover:bg-white text-[#18181B] text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-40 shadow-2xs"
          >
            <RefreshCw className={`w-4 h-4 text-[#5F6368] ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          {selectedLessonId && (
            <>
              <button
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
                className={`h-10 px-4 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all shadow-2xs ${
                  hasUnsavedChanges
                    ? 'border-[#B91B1C] bg-[#FDF1F1] text-[#B91B1C] hover:bg-[#FCE8E8]'
                    : 'border-[#E7E7EA] bg-[#F7F7F9] text-[#5F6368] opacity-50 cursor-not-allowed'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Đang lưu...' : hasUnsavedChanges ? 'Lưu thay đổi *' : 'Đã lưu'}</span>
              </button>

              <button
                onClick={handlePublish}
                disabled={saving || localQuestions.length === 0}
                className="h-10 px-4 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-2xs disabled:opacity-40"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Xuất bản</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {statusMsg && (
        <div
          className={`rounded-2xl p-4 flex items-center gap-3 text-xs font-bold border animate-in fade-in slide-in-from-top-2 duration-200 ${
            statusMsg.type === 'success'
              ? 'bg-[#E6F4EA] border-[#CEEAD6] text-[#137333]'
              : 'bg-[#FDF1F1] border-[#FAD2CF] text-[#B91B1C]'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Lesson Selector */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          {/* Search & Filters */}
          <div className="bg-white p-4 rounded-3xl border border-[#E7E7EA] space-y-3 shadow-2xs">
            <div className="relative">
              <Search className="w-4 h-4 text-[#8B9097] absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Tìm bài học theo tên..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl text-xs outline-none focus:border-[#B91B1C] transition-colors"
              />
            </div>

            {/* Quick HSK Level Selector */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-[#8B9097] mb-1.5">
                <span>Cấp độ HSK:</span>
                {hskFilter && (
                  <button onClick={() => setHskFilter('')} className="text-[#B91B1C] hover:underline text-[10px]">
                    Xóa lọc
                  </button>
                )}
              </div>
              <div className="grid grid-cols-5 gap-1">
                <button
                  onClick={() => setHskFilter('')}
                  className={`py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    hskFilter === '' ? 'bg-[#18181B] text-white' : 'bg-[#F7F7F9] text-[#5F6368] hover:bg-[#E7E7EA]'
                  }`}
                >
                  Tất cả
                </button>
                {HSK_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setHskFilter(hskFilter === lvl ? '' : lvl)}
                    className={`py-1 rounded-lg text-[11px] font-bold transition-colors ${
                      hskFilter === lvl
                        ? 'bg-[#B91B1C] text-white'
                        : 'bg-[#F7F7F9] text-[#5F6368] hover:bg-[#E7E7EA]'
                    }`}
                  >
                    H{lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 pt-1 border-t border-[#E7E7EA]">
              <span className="text-[11px] font-bold text-[#8B9097]">Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="flex-1 h-7 px-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-lg text-xs font-bold text-[#18181B] outline-none"
              >
                <option value="all">Tất cả</option>
                <option value="published">Đã xuất bản</option>
                <option value="ready_for_review">Chờ duyệt</option>
                <option value="draft">Bản nháp</option>
              </select>
            </div>
          </div>

          {/* Lesson List */}
          <div className="bg-white rounded-3xl border border-[#E7E7EA] overflow-hidden divide-y divide-[#E7E7EA] shadow-2xs max-h-[680px] overflow-y-auto">
            {loading ? (
              <div className="p-10 text-center text-[#8B9097]">
                <RefreshCw className="w-5 h-5 animate-spin text-[#B91B1C] mx-auto mb-2" />
                <p className="text-xs">Đang tải danh sách bài học...</p>
              </div>
            ) : filteredLessons.length === 0 ? (
              <div className="p-8 text-center text-[#8B9097]">
                <BookOpen className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                <p className="text-xs font-bold text-[#18181B]">Không tìm thấy bài học nào</p>
                <p className="text-[11px] text-[#8B9097] mt-0.5">Thử đổi từ khóa hoặc bộ lọc HSK.</p>
              </div>
            ) : (
              filteredLessons.map((lesson) => {
                const isSelected = lesson._id === selectedLessonId;
                const lvlKey = String(lesson.hsk);
                const styling = HSK_COLORS[lvlKey] || HSK_COLORS['1'];

                return (
                  <button
                    key={lesson._id}
                    onClick={() => loadLessonQuiz(lesson._id)}
                    className={`w-full text-left p-4 transition-all flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#FDF1F1] border-l-4 border-l-[#B91B1C]'
                        : 'hover:bg-[#F7F7F9]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${styling.bg} ${styling.text} ${styling.border}`}>
                          HSK {lesson.hsk}
                        </span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            lesson.status === 'published'
                              ? 'bg-[#E6F4EA] text-[#137333]'
                              : lesson.status === 'ready_for_review'
                              ? 'bg-[#FEF7E0] text-[#B06000]'
                              : 'bg-[#F1F3F4] text-[#5F6368]'
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
                        className={`text-sm font-bold line-clamp-1 leading-snug ${
                          isSelected ? 'text-[#B91B1C]' : 'text-[#18181B]'
                        }`}
                      >
                        {lesson.titleVi}
                      </p>
                      {lesson.titleZh && (
                        <p className="text-xs text-[#8B9097] mt-0.5 font-serif line-clamp-1">
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
            <div className="bg-white rounded-3xl border border-[#E7E7EA] p-12 flex flex-col items-center justify-center text-center min-h-[420px] shadow-2xs">
              <div className="w-16 h-16 rounded-3xl bg-[#F7F7F9] border border-[#E7E7EA] flex items-center justify-center mb-4">
                <Layers className="w-7 h-7 text-[#8B9097]" />
              </div>
              <h3 className="text-lg font-extrabold text-[#18181B]">Chọn một bài học để soạn câu hỏi</h3>
              <p className="text-xs text-[#5F6368] mt-1.5 max-w-sm">
                Danh sách bài học ở cột bên trái phân loại theo chuẩn HSK 1 đến 9. Bấm chọn bài học để bắt đầu.
              </p>
            </div>
          ) : fetchingLesson ? (
            <div className="bg-white rounded-3xl border border-[#E7E7EA] p-12 flex flex-col items-center justify-center min-h-[420px] shadow-2xs">
              <RefreshCw className="w-8 h-8 animate-spin text-[#B91B1C] mb-3" />
              <p className="text-xs font-bold text-[#8B9097]">Đang tải dữ liệu câu hỏi bài tập...</p>
            </div>
          ) : quizData ? (
            <div className="space-y-4">
              {/* Lesson Meta Card & Mode Switcher */}
              <div className="bg-white rounded-3xl border border-[#E7E7EA] p-5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded font-black text-[10px] bg-[#18181B] text-white">
                        HSK {quizData.lesson.hsk}
                      </span>
                      <span className="text-xs text-[#8B9097]">
                        Thời lượng: {formatDuration(quizData.lesson.durationSeconds || 0)}
                      </span>
                      <span className="text-xs text-[#8B9097]">·</span>
                      <span className="text-xs text-[#8B9097] flex items-center gap-1">
                        <Subtitles className="w-3.5 h-3.5" />
                        {quizData.subtitleCues.length} câu thoại
                      </span>
                    </div>

                    <h2 className="text-xl font-black text-[#18181B] tracking-tight">
                      {quizData.lesson.titleVi}
                    </h2>
                    {quizData.lesson.titleZh && (
                      <p className="text-xs text-[#8B9097] mt-0.5 font-serif">
                        {quizData.lesson.titleZh}
                      </p>
                    )}
                  </div>

                  {/* Toggle Mode: Editor vs Learner Preview */}
                  <div className="flex items-center gap-3 bg-[#F7F7F9] p-1.5 rounded-2xl border border-[#E7E7EA] shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewMode(false)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        !previewMode
                          ? 'bg-white text-[#18181B] shadow-2xs'
                          : 'text-[#5F6368] hover:text-[#18181B]'
                      }`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Biên tập ({localQuestions.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode(true)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        previewMode
                          ? 'bg-[#B91B1C] text-white shadow-2xs'
                          : 'text-[#5F6368] hover:text-[#B91B1C]'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xem trước học viên</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Mode 1: Learner Preview Mode */}
              {previewMode ? (
                <LearnerQuizPreview
                  questions={localQuestions}
                  cues={quizData.subtitleCues}
                  onExit={() => setPreviewMode(false)}
                />
              ) : (
                /* Mode 2: Quiz Builder / Editor Mode */
                <div className="bg-white rounded-3xl border border-[#E7E7EA] overflow-hidden shadow-2xs">
                  <div className="px-5 py-4 border-b border-[#E7E7EA] flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-[#18181B]">Danh sách câu hỏi bài tập</h3>
                      <p className="text-[11px] text-[#8B9097]">
                        Mỗi bài học nên có từ 3 đến 7 câu hỏi để củng cố từ vựng và ngữ pháp.
                      </p>
                    </div>
                    <button
                      onClick={handleAddNewQuestion}
                      className="h-9 px-4 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Thêm câu hỏi mới</span>
                    </button>
                  </div>

                  {localQuestions.length === 0 ? (
                    <div className="p-12 flex flex-col items-center text-center">
                      <div className="w-12 h-12 rounded-2xl bg-[#FDF1F1] text-[#B91B1C] flex items-center justify-center mb-3">
                        <HelpCircle className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-[#18181B] mb-1">Chưa có câu hỏi nào cho bài học này</p>
                      <p className="text-xs text-[#8B9097] max-w-sm mb-4">
                        Bấm nút bên dưới để thêm câu hỏi trắc nghiệm hoặc điền từ vào chỗ trống liên kết với phụ đề phim.
                      </p>
                      <button
                        onClick={handleAddNewQuestion}
                        className="h-9 px-4 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-2xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tạo câu hỏi đầu tiên</span>
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#E7E7EA]">
                      {localQuestions.map((question, idx) => {
                        const isEditing = editingIndex === idx;
                        const boundCue = quizData.subtitleCues.find((c) => c.cueId === question.cueId);

                        if (isEditing) {
                          return (
                            <div key={`edit-${question.questionId || idx}`} className="p-5 bg-[#FDFBF7]">
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
                            className="p-5 hover:bg-[#F7F7F9]/50 transition-colors group"
                          >
                            <div className="flex items-start gap-3">
                              {/* Move Controls & Index */}
                              <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleMoveQuestion(idx, -1)}
                                  disabled={idx === 0}
                                  className="p-0.5 rounded text-[#8B9097] hover:text-[#18181B] disabled:opacity-20"
                                  title="Di chuyển lên"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-xs font-mono font-black text-[#18181B] w-6 text-center">
                                  Q{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleMoveQuestion(idx, 1)}
                                  disabled={idx === localQuestions.length - 1}
                                  className="p-0.5 rounded text-[#8B9097] hover:text-[#18181B] disabled:opacity-20"
                                  title="Di chuyển xuống"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Question Details */}
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                                      question.type === 'multiple_choice'
                                        ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                                        : 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]'
                                    }`}
                                  >
                                    {question.type === 'multiple_choice' ? 'Trắc nghiệm (4 đáp án)' : 'Điền từ'}
                                  </span>

                                  {/* Bound Cue Tag */}
                                  {boundCue ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]">
                                      <Subtitles className="w-3 h-3" />
                                      <span>
                                        [{formatCueTime(boundCue.startMs)}] {boundCue.zh}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-[#8B9097] italic">Chưa gắn phụ đề</span>
                                  )}
                                </div>

                                {/* Prompt */}
                                <p className="text-sm font-bold text-[#18181B] leading-relaxed">
                                  {question.prompt || <span className="text-[#8B9097] italic">Chưa nhập câu hỏi</span>}
                                </p>

                                {/* Options Preview */}
                                {question.type === 'multiple_choice' ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                    {question.options.map((opt) => {
                                      const isCorrect = opt.optionId === question.correctOptionId;
                                      return (
                                        <div
                                          key={opt.optionId}
                                          className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-2 transition-all ${
                                            isCorrect
                                              ? 'bg-[#E6F4EA] border-[#188A5A] text-[#137333] font-bold shadow-2xs'
                                              : 'bg-white border-[#E7E7EA] text-[#5F6368]'
                                          }`}
                                        >
                                          <span
                                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                                              isCorrect ? 'bg-[#188A5A] text-white' : 'bg-[#F7F7F9] text-[#8B9097]'
                                            }`}
                                          >
                                            {opt.optionId.toUpperCase()}
                                          </span>
                                          <span className="flex-1 truncate">{opt.text || '...'}</span>
                                          {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-[#188A5A]" />}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    <span className="text-[11px] font-bold text-[#8B9097]">Đáp án đúng:</span>
                                    {(question.acceptedAnswers || []).map((ans, i) => (
                                      <span
                                        key={i}
                                        className="px-2.5 py-0.5 rounded-md bg-[#E6F4EA] border border-[#CEEAD6] text-[#137333] font-mono font-bold text-xs"
                                      >
                                        {ans}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Explanation snippet */}
                                {question.explanationVi && (
                                  <div className="text-[11px] text-[#5F6368] bg-[#F7F7F9] p-2 rounded-xl border border-[#E7E7EA] flex items-start gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-[#E7A92F] shrink-0 mt-0.5" />
                                    <span>
                                      <strong>Giải thích:</strong> {question.explanationVi}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Row Actions */}
                              <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingIndex(idx)}
                                  className="p-1.5 rounded-lg border border-[#E7E7EA] bg-white text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9] transition-colors"
                                  title="Chỉnh sửa câu hỏi"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateQuestion(idx)}
                                  className="p-1.5 rounded-lg border border-[#E7E7EA] bg-white text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9] transition-colors"
                                  title="Nhân bản câu hỏi"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveQuestion(idx)}
                                  className="p-1.5 rounded-lg border border-[#E7E7EA] bg-white text-[#5F6368] hover:text-[#B91B1C] hover:bg-[#FDF1F1] transition-colors"
                                  title="Xóa câu hỏi"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
    <div className="bg-white rounded-2xl p-5 border border-[#E7E7EA] shadow-sm space-y-4 text-xs">
      <div className="flex items-center justify-between pb-3 border-b border-[#E7E7EA]">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-[#B91B1C] text-white flex items-center justify-center font-mono font-bold text-[11px]">
            Q{index + 1}
          </span>
          <h4 className="font-black text-[#18181B] text-sm">Chỉnh Sửa Nội Dung Câu Hỏi</h4>
        </div>
        <button onClick={onCancel} className="p-1 rounded-lg hover:bg-[#F7F7F9] text-[#8B9097]">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Row 1: Type & Cue Binding */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block font-bold text-[#18181B] mb-1">Loại câu hỏi *</label>
          <select
            value={local.type}
            onChange={(e) => setField('type', e.target.value as AdminQuestion['type'])}
            className="w-full px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl font-bold text-xs outline-none focus:border-[#B91B1C]"
          >
            <option value="multiple_choice">Trắc nghiệm (4 đáp án)</option>
            <option value="fill_blank">Điền từ vào chỗ trống</option>
          </select>
        </div>

        <div>
          <label className="block font-bold text-[#18181B] mb-1">Liên kết phụ đề trong phim (Cue)</label>
          <select
            value={local.cueId || ''}
            onChange={(e) => setField('cueId', e.target.value || undefined)}
            className="w-full px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl font-bold text-xs outline-none focus:border-[#B91B1C]"
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
        <label className="block font-bold text-[#18181B] mb-1">
          Nội dung câu hỏi <span className="text-[#B91B1C]">*</span>
        </label>
        <textarea
          rows={2}
          value={local.prompt}
          onChange={(e) => setField('prompt', e.target.value)}
          placeholder='Ví dụ: Trong đoạn hội thoại trên, từ "服务员" có nghĩa là gì?'
          className="w-full p-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] text-xs resize-none"
        />
      </div>

      {/* Multiple Choice Options */}
      {local.type === 'multiple_choice' ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="block font-bold text-[#18181B]">
              Danh sách lựa chọn <span className="text-[#8B9097] font-normal">(Bấm radio để chọn đáp án đúng)</span>
            </label>
            {local.options.length < 6 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="text-[#B91B1C] hover:underline font-bold text-[11px] flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
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
                    className={`w-7 h-7 rounded-xl border flex items-center justify-center transition-all ${
                      isCorrect
                        ? 'bg-[#188A5A] border-[#188A5A] text-white shadow-2xs'
                        : 'bg-white border-[#E7E7EA] text-[#8B9097] hover:border-[#188A5A]'
                    }`}
                    title={isCorrect ? 'Đáp án đúng' : 'Bấm để chọn làm đáp án đúng'}
                  >
                    {isCorrect ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>

                  <span
                    className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center ${
                      isCorrect ? 'bg-[#188A5A] text-white' : 'bg-[#F7F7F9] text-[#8B9097]'
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
                    className="flex-1 px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] text-xs"
                  />

                  {local.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(opt.optionId)}
                      className="p-1.5 rounded-lg text-[#8B9097] hover:text-[#B91B1C] hover:bg-[#FDF1F1]"
                      title="Xóa lựa chọn này"
                    >
                      <X className="w-3.5 h-3.5" />
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
            <label className="block font-bold text-[#18181B]">
              Danh sách từ được chấp nhận <span className="text-[#B91B1C]">*</span>
            </label>
            <button
              type="button"
              onClick={handleAddAcceptedAnswer}
              className="text-[#B91B1C] hover:underline font-bold text-[11px] flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Thêm từ đồng nghĩa
            </button>
          </div>

          <div className="space-y-2">
            {(local.acceptedAnswers || ['']).map((ans, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-[#F7F7F9] text-[#8B9097] text-[10px] font-bold flex items-center justify-center">
                  #{i + 1}
                </span>
                <input
                  type="text"
                  value={ans}
                  onChange={(e) => handleAcceptedAnswerChange(i, e.target.value)}
                  placeholder="Từ đúng (ví dụ: 服务员)"
                  className="flex-1 px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] font-serif font-bold text-xs"
                />
                {(local.acceptedAnswers || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAcceptedAnswer(i)}
                    className="p-1.5 rounded-lg text-[#8B9097] hover:text-[#B91B1C] hover:bg-[#FDF1F1]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Row 3: Vietnamese Explanation */}
      <div>
        <label className="block font-bold text-[#18181B] mb-1">
          Giải thích đáp án (Tiếng Việt) <span className="text-[#B91B1C]">*</span>
        </label>
        <textarea
          rows={2}
          value={local.explanationVi}
          onChange={(e) => setField('explanationVi', e.target.value)}
          placeholder="Giải thích lý do chọn đáp án này, dịch nghĩa từ vựng hoặc ngữ pháp liên quan..."
          className="w-full p-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] text-xs resize-none"
        />
      </div>

      {/* Form Buttons */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E7E7EA]">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] hover:bg-white text-[#5F6368] font-bold"
        >
          Hủy bỏ
        </button>
        <button
          type="button"
          onClick={() => onSave(local)}
          disabled={!isValid}
          className="px-5 py-2 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white font-bold disabled:opacity-40 shadow-2xs"
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
      <div className="bg-white rounded-3xl border border-[#E7E7EA] p-8 text-center shadow-2xs">
        <p className="text-xs text-[#8B9097]">Không có câu hỏi nào để xem trước.</p>
        <button
          onClick={onExit}
          className="mt-3 px-4 py-2 bg-[#18181B] text-white rounded-xl text-xs font-bold"
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
    <div className="bg-white rounded-3xl border border-[#E7E7EA] p-6 shadow-2xs space-y-5 animate-in fade-in duration-200">
      {/* Top Banner for Preview Mode */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E7E7EA]">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-[#B91B1C] text-white text-[10px] font-black uppercase tracking-wider">
            Learner Preview
          </span>
          <span className="text-xs font-bold text-[#5F6368]">
            Mô phỏng trải nghiệm học viên trên HanFlix
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg border border-[#E7E7EA] text-[#5F6368] hover:bg-[#F7F7F9]"
            title="Làm lại từ đầu"
          >
            <RotateCcw className="w-3.5 h-3.5" />
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
        <span className="text-xs font-black text-[#18181B]">
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
                  : 'w-2 bg-[#E7E7EA] hover:bg-[#8B9097]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Cue Video Context Quote (if bound) */}
      {boundCue && (
        <div className="p-3.5 rounded-2xl bg-[#F7F7F9] border border-[#E7E7EA] space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-black text-[#137333] uppercase">
            <Subtitles className="w-3 h-3" />
            <span>Dòng thoại trong phim [{formatCueTime(boundCue.startMs)}]</span>
          </div>
          <p className="font-serif text-base font-bold text-[#18181B]">{boundCue.zh}</p>
          <p className="text-xs text-[#5F6368]">{boundCue.vi}</p>
        </div>
      )}

      {/* Prompt */}
      <div className="py-2">
        <h3 className="text-base font-black text-[#18181B] leading-snug">{q.prompt}</h3>
      </div>

      {/* Interactive Options or Fill Input */}
      {isMultiple ? (
        <div className="space-y-2.5">
          {q.options.map((opt) => {
            const isSelected = selectedOption === opt.optionId;
            const isThisCorrect = opt.optionId === q.correctOptionId;

            let btnStyle = 'bg-white border-[#E7E7EA] hover:border-[#18181B]/40 text-[#18181B]';
            if (isAnswered) {
              if (isThisCorrect) {
                btnStyle = 'bg-[#E6F4EA] border-[#188A5A] text-[#137333] font-bold ring-2 ring-[#188A5A]';
              } else if (isSelected && !isThisCorrect) {
                btnStyle = 'bg-[#FDF1F1] border-[#B91B1C] text-[#B91B1C] line-through';
              } else {
                btnStyle = 'bg-[#F7F7F9] border-[#E7E7EA] text-[#8B9097] opacity-60';
              }
            } else if (isSelected) {
              btnStyle = 'bg-[#18181B] text-white border-[#18181B] font-bold shadow-2xs';
            }

            return (
              <button
                key={opt.optionId}
                disabled={isAnswered}
                onClick={() => setSelectedOption(opt.optionId)}
                className={`w-full p-3.5 rounded-2xl border text-left text-xs flex items-center gap-3 transition-all ${btnStyle}`}
              >
                <span
                  className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center shrink-0 ${
                    isSelected && !isAnswered
                      ? 'bg-white text-[#18181B]'
                      : isAnswered && isThisCorrect
                      ? 'bg-[#188A5A] text-white'
                      : 'bg-[#F7F7F9] text-[#8B9097]'
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
          <label className="block text-xs font-bold text-[#18181B]">Nhập câu trả lời của bạn:</label>
          <input
            type="text"
            disabled={isAnswered}
            value={fillAnswer}
            onChange={(e) => setFillAnswer(e.target.value)}
            placeholder="Gõ từ tiếng Trung..."
            className="w-full px-4 py-3 bg-[#F7F7F9] border border-[#E7E7EA] rounded-2xl outline-none font-serif text-sm font-bold text-[#18181B]"
          />
        </div>
      )}

      {/* Feedback Banner after Check */}
      {isAnswered && (
        <div
          className={`p-4 rounded-2xl border text-xs space-y-1 animate-in fade-in duration-150 ${
            isCorrect
              ? 'bg-[#E6F4EA] border-[#CEEAD6] text-[#137333]'
              : 'bg-[#FDF1F1] border-[#FAD2CF] text-[#B91B1C]'
          }`}
        >
          <div className="font-black text-sm flex items-center gap-1.5">
            {isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{isCorrect ? 'Chính xác! Làm rất tốt.' : 'Chưa đúng rồi!'}</span>
          </div>
          {q.explanationVi && (
            <p className="text-xs text-[#18181B] mt-1 bg-white/70 p-2.5 rounded-xl">
              <strong>Giải thích:</strong> {q.explanationVi}
            </p>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-3 border-t border-[#E7E7EA]">
        <button
          onClick={handlePrevQuestion}
          disabled={currentIdx === 0}
          className="px-4 py-2 rounded-xl border border-[#E7E7EA] bg-white text-xs font-bold disabled:opacity-30 hover:bg-[#F7F7F9]"
        >
          Câu trước
        </button>

        {!isAnswered ? (
          <button
            onClick={handleCheckAnswer}
            disabled={isMultiple ? !selectedOption : !fillAnswer.trim()}
            className="px-5 py-2 rounded-xl bg-[#18181B] text-white text-xs font-bold disabled:opacity-40 hover:bg-black"
          >
            Kiểm tra đáp án
          </button>
        ) : (
          <button
            onClick={handleNextQuestion}
            disabled={currentIdx === questions.length - 1}
            className="px-5 py-2 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold disabled:opacity-40"
          >
            {currentIdx < questions.length - 1 ? 'Câu kế tiếp' : 'Hoàn thành xem trước'}
          </button>
        )}
      </div>
    </div>
  );
}
