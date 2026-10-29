import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Braces,
  CheckCircle2,
  Copy,
  Edit2,
  FileQuestion,
  LayoutPanelLeft,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Spinner, useNotification } from '../notifications';
import type { ExamSkill, QuestionType } from '../../data/hskExamData';
import type {
  AdminExamInput,
  AdminExamQuestion,
  AdminExamSection,
  ExamCategory,
} from '../../api/exams';

export const EXAM_CATEGORY_LABELS: Record<ExamCategory, string> = {
  full_mock: 'Đề thi thử đầy đủ',
  mini_test: 'Đề rút gọn',
  skill_listening: 'Luyện Nghe',
  skill_reading: 'Luyện Đọc',
  skill_writing: 'Luyện Viết',
};

export const EXAM_SKILL_LABELS: Record<ExamSkill, { vi: string; zh: string }> = {
  listening: { vi: 'Nghe', zh: '听力' },
  reading: { vi: 'Đọc', zh: '阅读' },
  writing: { vi: 'Viết', zh: '书写' },
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: 'Trắc nghiệm',
  true_false: 'Đúng / Sai',
  sentence_ordering: 'Sắp xếp câu',
  fill_in_blank: 'Điền từ',
};

const SKILLS: ExamSkill[] = ['listening', 'reading', 'writing'];
const letter = (index: number) => String.fromCharCode(65 + index);
const newId = () => `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Full mocks have a fixed pass mark per HSK band; other categories are free. */
const fullMockPassingScore = (level: number) => (level <= 2 ? 120 : 180);

const inputClass =
  'w-full px-3 py-2 bg-[#FFF9F5] border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] focus:bg-white transition-all text-xs text-[#2B2826]';
const labelClass = 'block font-bold text-[#2B2826] mb-1.5 text-xs';

export function emptyExam(level = 1): AdminExamInput {
  return {
    code: '',
    title: '',
    level,
    category: 'mini_test',
    durationMinutes: 30,
    totalQuestions: 0,
    totalScore: 200,
    passingScore: fullMockPassingScore(level),
    description: '',
    isPublished: false,
    sections: [emptySection('listening'), emptySection('reading')],
  };
}

function emptySection(skill: ExamSkill): AdminExamSection {
  return {
    skill,
    title: `Phần ${EXAM_SKILL_LABELS[skill].vi} (${EXAM_SKILL_LABELS[skill].zh})`,
    totalQuestions: 0,
    durationMinutes: 10,
    instructions: `Hoàn thành các câu hỏi phần ${EXAM_SKILL_LABELS[skill].vi.toLowerCase()}.`,
    questions: [],
  };
}

function emptyQuestion(skill: ExamSkill): AdminExamQuestion {
  return {
    id: newId(),
    order: 1,
    type: 'single_choice',
    skill,
    part: 1,
    instruction: 'Chọn đáp án phù hợp nhất.',
    promptText: '',
    options: ['', '', ''],
    correctAnswer: 'A',
    explanationVi: '',
  };
}

const DEFAULT_INSTRUCTIONS: Record<QuestionType, string> = {
  single_choice: 'Chọn đáp án phù hợp nhất.',
  true_false: 'Xác định đúng hoặc sai.',
  sentence_ordering: 'Sắp xếp các cụm từ.',
  fill_in_blank: 'Điền từ thích hợp vào chỗ trống.',
};

/** Fields that depend on the question type; everything else carries over unchanged. */
type TypeFields = Pick<AdminExamQuestion, 'type' | 'instruction' | 'options' | 'sentenceChunks' | 'correctAnswer' | 'acceptedAnswers'>;
const typeFields = (q: AdminExamQuestion): TypeFields => ({
  type: q.type, instruction: q.instruction, options: q.options,
  sentenceChunks: q.sentenceChunks, correctAnswer: q.correctAnswer, acceptedAnswers: q.acceptedAnswers,
});

/**
 * Reshape a question for a new type without discarding what can carry over:
 * choice options survive between choice-based types, a typed answer seeds the first
 * option, and only an untouched default instruction is replaced.
 */
export function retypeQuestion(q: AdminExamQuestion, type: QuestionType): AdminExamQuestion {
  const isDefaultInstruction = !q.instruction.trim() || Object.values(DEFAULT_INSTRUCTIONS).includes(q.instruction.trim());
  const instruction = isDefaultInstruction ? DEFAULT_INSTRUCTIONS[type] : q.instruction;
  const filled = q.options?.filter(o => o.trim()) ?? [];
  const selectedIndex = q.options?.findIndex((o, i) => q.correctAnswer === String.fromCharCode(65 + i) || (o !== '' && q.correctAnswer === o)) ?? -1;
  const selectedText = selectedIndex >= 0 ? q.options![selectedIndex]! : '';
  const base = { ...q, type, instruction, acceptedAnswers: undefined, sentenceChunks: undefined };

  if (type === 'true_false') return { ...base, options: undefined, correctAnswer: 'True' };
  if (type === 'sentence_ordering') {
    return { ...base, options: undefined, sentenceChunks: q.sentenceChunks ?? ['', ''], correctAnswer: '' };
  }
  if (type === 'single_choice') {
    if (filled.length) return { ...base, options: q.options, correctAnswer: selectedIndex >= 0 ? String.fromCharCode(65 + selectedIndex) : 'A' };
    const typed = q.type === 'fill_in_blank' ? q.correctAnswer.trim() : '';
    return { ...base, options: [typed, '', ''], correctAnswer: 'A' };
  }
  // fill_in_blank: keep a choice list (answer stored as option text), else a free-text answer.
  if (filled.length) return { ...base, options: q.options, correctAnswer: selectedText };
  return { ...base, options: undefined, correctAnswer: '' };
}

const optional = (value?: string) => (value && value.trim() ? value.trim() : undefined);
const optionalList = (values?: string[]) => {
  const cleaned = values?.map(v => v.trim()).filter(Boolean);
  return cleaned?.length ? cleaned : undefined;
};

/**
 * Derive the counters the backend validates (orders, totals, score) and drop empty
 * optional fields, so admins only edit content.
 */
export function normalizeExam(exam: AdminExamInput): AdminExamInput {
  let order = 0;
  const sections = exam.sections.map(section => {
    const questions = section.questions.map(q => {
      order += 1;
      const dialogue = q.dialogue?.filter(line => line.text.trim())
        .map(line => ({ speaker: line.speaker.trim(), text: line.text.trim(), ...(optional(line.pinyin) ? { pinyin: line.pinyin!.trim() } : {}) }));
      const cleaned: AdminExamQuestion = {
        id: q.id,
        order,
        type: q.type,
        skill: section.skill,
        part: Math.max(1, Math.round(Number(q.part) || 1)),
        instruction: q.instruction.trim(),
        promptText: optional(q.promptText),
        dialogue: dialogue?.length ? dialogue : undefined,
        audioUrl: optional(q.audioUrl),
        imageUrl: optional(q.imageUrl),
        options: optionalList(q.options),
        sentenceChunks: q.type === 'sentence_ordering' ? optionalList(q.sentenceChunks) : undefined,
        correctAnswer: q.correctAnswer.trim(),
        acceptedAnswers: q.type === 'sentence_ordering' ? optionalList(q.acceptedAnswers) : undefined,
        explanationVi: q.explanationVi.trim(),
        pinyinScript: optional(q.pinyinScript),
        translationVi: optional(q.translationVi),
        grammarPoint: optional(q.grammarPoint),
        recommendedLessonTitle: optional(q.recommendedLessonTitle),
        recommendedLessonId: optional(q.recommendedLessonId),
      };
      return Object.fromEntries(Object.entries(cleaned).filter(([, v]) => v !== undefined)) as AdminExamQuestion;
    });
    return {
      skill: section.skill,
      title: section.title.trim(),
      totalQuestions: questions.length,
      durationMinutes: Math.max(1, Math.round(Number(section.durationMinutes) || 1)),
      ...(optional(section.audioUrl) ? { audioUrl: section.audioUrl!.trim() } : {}),
      instructions: section.instructions.trim(),
      questions,
    };
  });
  return {
    code: exam.code.trim(),
    title: exam.title.trim(),
    level: exam.level,
    category: exam.category,
    durationMinutes: Math.max(1, Math.round(Number(exam.durationMinutes) || 1)),
    totalQuestions: order,
    totalScore: sections.length * 100,
    passingScore: exam.category === 'full_mock' ? fullMockPassingScore(exam.level) : Math.max(0, Math.round(Number(exam.passingScore) || 0)),
    description: exam.description ?? '',
    isPublished: exam.isPublished,
    sections,
  };
}

function questionIssues(q: AdminExamQuestion): string[] {
  const issues: string[] = [];
  if (!q.instruction.trim()) issues.push('Thiếu yêu cầu đề bài');
  if (!q.explanationVi.trim()) issues.push('Thiếu giải thích đáp án');
  if (!q.correctAnswer.trim()) issues.push('Chưa có đáp án đúng');
  const options = q.options?.map(o => o.trim()).filter(Boolean) ?? [];
  if (q.type === 'single_choice' && options.length < 2) issues.push('Cần ít nhất 2 lựa chọn');
  if (q.options && new Set(options).size !== options.length) issues.push('Lựa chọn bị trùng');
  if (q.type === 'sentence_ordering' && (q.sentenceChunks?.filter(c => c.trim()).length ?? 0) < 2) issues.push('Cần ít nhất 2 cụm từ');
  return issues;
}

function examIssues(exam: AdminExamInput): string[] {
  const issues: string[] = [];
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(exam.code.trim())) issues.push('Mã đề chỉ gồm chữ, số, "-" hoặc "_"');
  if (!exam.title.trim()) issues.push('Thiếu tên đề thi');
  if (!exam.sections.length) issues.push('Đề thi cần ít nhất 1 phần kỹ năng');
  if (exam.level <= 2 && exam.sections.some(s => s.skill === 'writing')) issues.push('HSK 1–2 không có phần Viết');
  if (exam.category.startsWith('skill_') && (exam.sections.length !== 1 || `skill_${exam.sections[0]?.skill}` !== exam.category)) {
    issues.push('Đề luyện kỹ năng chỉ có đúng 1 phần cùng kỹ năng');
  }
  if (exam.category === 'full_mock') {
    const need = exam.level <= 2 ? 2 : 3;
    if (exam.sections.length !== need) issues.push(`Đề đầy đủ HSK ${exam.level} cần ${need} phần kỹ năng`);
  }
  if (exam.passingScore > exam.sections.length * 100) issues.push('Điểm đạt vượt quá tổng điểm');
  for (const section of exam.sections) {
    if (!section.title.trim() || !section.instructions.trim()) issues.push(`Phần ${EXAM_SKILL_LABELS[section.skill].vi}: thiếu tiêu đề hoặc hướng dẫn`);
    if (!section.questions.length) issues.push(`Phần ${EXAM_SKILL_LABELS[section.skill].vi}: chưa có câu hỏi`);
  }
  return issues;
}

interface AdminExamEditorModalProps {
  mode: 'create' | 'edit';
  initial: AdminExamInput;
  attemptCount?: number;
  saving: boolean;
  /** Shown above the editor, e.g. for AI drafts; such drafts count as unsaved work on close. */
  notice?: { title: string; items: string[] };
  onClose: () => void;
  onSave: (exam: AdminExamInput) => void;
}

export default function AdminExamEditorModal({ mode, initial, attemptCount = 0, saving, notice, onClose, onSave }: AdminExamEditorModalProps) {
  const notify = useNotification();
  const [exam, setExam] = useState<AdminExamInput>(initial);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [view, setView] = useState<'editor' | 'json'>('editor');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const initialSnapshot = useMemo(() => JSON.stringify(normalizeExam(initial)), [initial]);

  const section = exam.sections[sectionIndex];
  const question = section?.questions[questionIndex];
  const totalQuestions = exam.sections.reduce((sum, s) => sum + s.questions.length, 0);
  const totalScore = exam.sections.length * 100;
  const issues = useMemo(() => {
    const list = examIssues(exam);
    exam.sections.forEach(s => s.questions.forEach((q, i) => {
      const found = questionIssues(q);
      if (found.length) list.push(`${EXAM_SKILL_LABELS[s.skill].vi} · Câu ${i + 1}: ${found[0]}`);
    }));
    return list;
  }, [exam]);

  const requestClose = async () => {
    if (saving) return;
    const dirty = Boolean(notice) || view === 'json' ? jsonText !== JSON.stringify(normalizeExam(exam), null, 2) || JSON.stringify(normalizeExam(exam)) !== initialSnapshot
      : JSON.stringify(normalizeExam(exam)) !== initialSnapshot;
    if (dirty && !await notify.confirm({
      title: 'Bỏ thay đổi?',
      message: 'Các chỉnh sửa chưa lưu của đề thi sẽ bị mất.',
      confirmText: 'Bỏ thay đổi',
      tone: 'danger',
    })) return;
    onClose();
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void requestClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const patchExam = (patch: Partial<AdminExamInput>) => setExam(prev => ({ ...prev, ...patch }));
  const patchSection = (patch: Partial<AdminExamSection>) => setExam(prev => ({
    ...prev,
    sections: prev.sections.map((s, i) => (i === sectionIndex ? { ...s, ...patch } : s)),
  }));
  const setQuestions = (updater: (questions: AdminExamQuestion[]) => AdminExamQuestion[]) => setExam(prev => ({
    ...prev,
    sections: prev.sections.map((s, i) => (i === sectionIndex ? { ...s, questions: updater(s.questions) } : s)),
  }));
  const patchQuestion = (patch: Partial<AdminExamQuestion>) =>
    setQuestions(questions => questions.map((q, i) => (i === questionIndex ? { ...q, ...patch } : q)));

  const selectSection = (index: number) => { setSectionIndex(index); setQuestionIndex(0); };

  const addSection = (skill: ExamSkill) => {
    const order = SKILLS.indexOf(skill);
    setExam(prev => {
      const sections = [...prev.sections, emptySection(skill)].sort((a, b) => SKILLS.indexOf(a.skill) - SKILLS.indexOf(b.skill));
      return { ...prev, sections };
    });
    setSectionIndex(exam.sections.filter(s => SKILLS.indexOf(s.skill) < order).length);
    setQuestionIndex(0);
  };

  const removeSection = async () => {
    if (!section) return;
    if (section.questions.length && !await notify.confirm({
      title: 'Xóa phần kỹ năng',
      message: `Xóa phần ${EXAM_SKILL_LABELS[section.skill].vi} cùng ${section.questions.length} câu hỏi?`,
      confirmText: 'Xóa phần',
      tone: 'danger',
    })) return;
    setExam(prev => ({ ...prev, sections: prev.sections.filter((_, i) => i !== sectionIndex) }));
    selectSection(Math.max(0, sectionIndex - 1));
  };

  const addQuestion = () => {
    if (!section) return;
    const last = section.questions[section.questions.length - 1];
    setQuestions(questions => [...questions, { ...emptyQuestion(section.skill), part: last?.part ?? 1 }]);
    setQuestionIndex(section.questions.length);
  };

  const duplicateQuestion = () => {
    if (!question) return;
    setQuestions(questions => [...questions.slice(0, questionIndex + 1), { ...question, id: newId() }, ...questions.slice(questionIndex + 1)]);
    setQuestionIndex(questionIndex + 1);
  };

  const removeQuestion = () => {
    setQuestions(questions => questions.filter((_, i) => i !== questionIndex));
    setQuestionIndex(Math.max(0, questionIndex - 1));
  };

  const moveQuestion = (delta: -1 | 1) => {
    const target = questionIndex + delta;
    if (!section || target < 0 || target >= section.questions.length) return;
    setQuestions(questions => {
      const next = [...questions];
      [next[questionIndex], next[target]] = [next[target]!, next[questionIndex]!];
      return next;
    });
    setQuestionIndex(target);
  };

  const switchView = (next: 'editor' | 'json') => {
    if (next === view) return;
    if (next === 'json') {
      setJsonText(JSON.stringify(normalizeExam(exam), null, 2));
      setJsonError(null);
      setView('json');
      return;
    }
    if (!applyJson()) return;
    setView('editor');
  };

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText) as AdminExamInput;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sections)) throw new Error('JSON phải là một đề thi có mảng "sections".');
      setExam({ ...emptyExam(), ...parsed, description: parsed.description ?? '', isPublished: parsed.isPublished ?? false });
      setSectionIndex(0);
      setQuestionIndex(0);
      setJsonError(null);
      return true;
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'JSON không hợp lệ');
      return false;
    }
  };

  const handleSave = () => {
    if (view === 'json' && !applyJson()) return;
    const source = view === 'json' ? (JSON.parse(jsonText) as AdminExamInput) : exam;
    const pending = view === 'json' ? examIssues({ ...emptyExam(), ...source }) : issues;
    if (pending.length) {
      notify.warning(`Đề thi chưa hợp lệ: ${pending[0]}${pending.length > 1 ? ` (và ${pending.length - 1} lỗi khác)` : ''}`);
      return;
    }
    onSave(normalizeExam({ ...emptyExam(), ...source }));
  };

  const unusedSkills = SKILLS.filter(skill => !exam.sections.some(s => s.skill === skill) && !(skill === 'writing' && exam.level <= 2));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-xs sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-editor-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) void requestClose(); }}
    >
      <div className="flex h-[92vh] w-full max-w-[1480px] flex-col overflow-hidden rounded-3xl border border-[#F2E4D8] bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#F2E4D8] px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FDF1F1] text-[#B91B1C] ring-1 ring-[#B91B1C]/20">
              {mode === 'edit' ? <Edit2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <h2 id="exam-editor-title" className="truncate text-lg font-black text-[#2B2826]">
                {mode === 'edit' ? 'Chỉnh Sửa Đề Thi' : 'Tạo Đề Thi Mới'}
                {exam.code && <span className="ml-2 font-mono text-sm text-[#B91B1C]">{exam.code}</span>}
              </h2>
              <p className="text-[11px] text-[#8C827A]">
                HSK {exam.level} · {EXAM_CATEGORY_LABELS[exam.category]} · {totalQuestions} câu · {totalScore} điểm
                {mode === 'edit' && attemptCount > 0 && ` · ${attemptCount} lượt đã làm`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] p-1 text-xs font-bold">
              {([['editor', 'Trình soạn thảo', LayoutPanelLeft], ['json', 'JSON', Braces]] as const).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => switchView(id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${view === id ? 'bg-white text-[#B91B1C] shadow-2xs' : 'text-[#8C827A] hover:text-[#2B2826]'}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => void requestClose()} className="rounded-lg p-1.5 text-[#8C827A] transition-colors hover:bg-[#FFF9F5]" aria-label="Đóng">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {notice && (
          <div className="flex shrink-0 items-start gap-2.5 border-b border-[#FDE6BA] bg-[#FFF8EC] px-6 py-2.5 text-xs text-[#8A4B0A]">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" />
            <div className="min-w-0">
              <span className="font-bold">{notice.title}</span>
              {notice.items.length > 0 && <span className="ml-1 text-[#B45309]">{notice.items.join(' · ')}</span>}
            </div>
          </div>
        )}

        {/* Body */}
        {view === 'json' ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-6">
            <p className="text-xs text-[#8C827A]">
              Dán hoặc chỉnh sửa toàn bộ đề thi dưới dạng JSON (cùng định dạng với API import). Các trường tổng số câu, thứ tự và tổng điểm sẽ được tính lại khi lưu.
            </p>
            <textarea
              value={jsonText}
              onChange={(e) => { setJsonText(e.target.value); setJsonError(null); }}
              spellCheck={false}
              className="min-h-0 flex-1 resize-none rounded-2xl border border-[#F2E4D8] bg-[#FFF9F5] p-4 font-mono text-xs leading-relaxed text-[#2B2826] outline-none focus:border-[#B91B1C] focus:bg-white"
              aria-label="JSON đề thi"
            />
            {jsonError && (
              <div className="flex items-center gap-2 rounded-xl border border-[#F9D2D2] bg-[#FDF1F1] px-3 py-2 text-xs font-bold text-[#B91B1C]">
                <AlertTriangle className="h-4 w-4" /> {jsonError}
              </div>
            )}
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[340px_320px_minmax(0,1fr)] lg:overflow-hidden">
            {/* Column 1: exam metadata */}
            <div className="space-y-4 border-b border-[#F2E4D8] bg-[#FFFCFA] p-5 lg:overflow-y-auto lg:border-b-0 lg:border-r">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-[#8C827A]">Thông tin đề thi</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Mã đề <span className="text-[#B91B1C]">*</span></label>
                  <input value={exam.code} onChange={(e) => patchExam({ code: e.target.value.toUpperCase() })} className={`${inputClass} font-mono font-bold`} placeholder="H31002" autoFocus={mode === 'create'} />
                </div>
                <div>
                  <label className={labelClass}>Cấp độ</label>
                  <select
                    value={exam.level}
                    onChange={(e) => {
                      const level = Number(e.target.value);
                      patchExam({ level, ...(exam.category === 'full_mock' ? { passingScore: fullMockPassingScore(level) } : {}) });
                    }}
                    className={`${inputClass} font-bold`}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => <option key={l} value={l}>HSK {l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Tên đề thi <span className="text-[#B91B1C]">*</span></label>
                <input value={exam.title} onChange={(e) => patchExam({ title: e.target.value })} className={`${inputClass} font-bold`} placeholder="HSK 3 — Đề luyện số 2" />
              </div>
              <div>
                <label className={labelClass}>Loại đề</label>
                <select
                  value={exam.category}
                  onChange={(e) => {
                    const category = e.target.value as ExamCategory;
                    patchExam({ category, ...(category === 'full_mock' ? { passingScore: fullMockPassingScore(exam.level) } : {}) });
                  }}
                  className={`${inputClass} font-bold`}
                >
                  {(Object.keys(EXAM_CATEGORY_LABELS) as ExamCategory[]).map(c => <option key={c} value={c}>{EXAM_CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Thời gian (phút)</label>
                  <input type="number" min={1} max={300} value={exam.durationMinutes} onChange={(e) => patchExam({ durationMinutes: Number(e.target.value) })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Điểm đạt / {totalScore}</label>
                  <input
                    type="number"
                    min={0}
                    max={totalScore}
                    value={exam.category === 'full_mock' ? fullMockPassingScore(exam.level) : exam.passingScore}
                    disabled={exam.category === 'full_mock'}
                    onChange={(e) => patchExam({ passingScore: Number(e.target.value) })}
                    className={`${inputClass} disabled:opacity-60`}
                    title={exam.category === 'full_mock' ? 'Đề đầy đủ dùng điểm đạt chuẩn của cấp HSK' : undefined}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Mô tả</label>
                <textarea rows={4} value={exam.description} onChange={(e) => patchExam({ description: e.target.value })} className={`${inputClass} resize-none leading-relaxed`} placeholder="Giới thiệu ngắn về đề thi..." />
              </div>
              <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-[#F2E4D8] bg-white px-3.5 py-3">
                <span>
                  <span className="block text-xs font-bold text-[#2B2826]">Xuất bản cho học viên</span>
                  <span className="text-[11px] text-[#8C827A]">{exam.isPublished ? 'Học viên có thể làm đề này' : 'Đang ẩn (bản nháp)'}</span>
                </span>
                <input type="checkbox" checked={exam.isPublished} onChange={(e) => patchExam({ isPublished: e.target.checked })} className="h-4 w-4 accent-[#B91B1C]" />
              </label>

              <div className="space-y-2 rounded-2xl border border-[#F2E4D8] bg-white p-3.5">
                <div className="text-[11px] font-black uppercase tracking-wider text-[#8C827A]">Tổng quan</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><div className="text-lg font-black text-[#2B2826]">{exam.sections.length}</div><div className="text-[10px] text-[#8C827A]">Phần</div></div>
                  <div><div className="text-lg font-black text-[#2B2826]">{totalQuestions}</div><div className="text-[10px] text-[#8C827A]">Câu hỏi</div></div>
                  <div><div className="text-lg font-black text-[#2B2826]">{totalScore}</div><div className="text-[10px] text-[#8C827A]">Tổng điểm</div></div>
                </div>
                <p className="text-[10px] leading-relaxed text-[#8C827A]">Mỗi kỹ năng chấm trên thang 100 điểm. Số câu, thứ tự câu và tổng điểm được tính tự động.</p>
              </div>
            </div>

            {/* Column 2: sections + question list */}
            <div className="flex min-h-0 flex-col border-b border-[#F2E4D8] lg:border-b-0 lg:border-r">
              <div className="shrink-0 space-y-3 border-b border-[#F2E4D8] p-4">
                <div className="flex flex-wrap gap-1.5">
                  {exam.sections.map((s, i) => (
                    <button
                      key={s.skill}
                      type="button"
                      onClick={() => selectSection(i)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${i === sectionIndex ? 'border-[#B91B1C] bg-[#B91B1C] text-white' : 'border-[#F2E4D8] bg-white text-[#2B2826] hover:border-[#B91B1C]/40'}`}
                    >
                      {EXAM_SKILL_LABELS[s.skill].vi} <span className="opacity-70">({s.questions.length})</span>
                    </button>
                  ))}
                  {unusedSkills.map(skill => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => addSection(skill)}
                      className="flex items-center gap-1 rounded-xl border border-dashed border-[#E5DCD3] px-2.5 py-1.5 text-xs font-bold text-[#8C827A] hover:border-[#B91B1C]/40 hover:text-[#B91B1C]"
                    >
                      <Plus className="h-3 w-3" /> {EXAM_SKILL_LABELS[skill].vi}
                    </button>
                  ))}
                </div>
                {section && (
                  <div className="space-y-2">
                    <input value={section.title} onChange={(e) => patchSection({ title: e.target.value })} className={`${inputClass} font-bold`} placeholder="Tiêu đề phần" aria-label="Tiêu đề phần" />
                    <textarea rows={2} value={section.instructions} onChange={(e) => patchSection({ instructions: e.target.value })} className={`${inputClass} resize-none`} placeholder="Hướng dẫn làm bài của phần" aria-label="Hướng dẫn phần" />
                    <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-2">
                      <input type="number" min={1} value={section.durationMinutes} onChange={(e) => patchSection({ durationMinutes: Number(e.target.value) })} className={inputClass} title="Thời gian phần (phút)" aria-label="Thời gian phần (phút)" />
                      <input value={section.audioUrl ?? ''} onChange={(e) => patchSection({ audioUrl: e.target.value })} className={inputClass} placeholder="Audio phần (https://...)" aria-label="Audio của phần" />
                    </div>
                    <button type="button" onClick={() => void removeSection()} className="flex items-center gap-1 text-[11px] font-bold text-[#8C827A] hover:text-[#B91B1C]">
                      <Trash2 className="h-3 w-3" /> Xóa phần {EXAM_SKILL_LABELS[section.skill].vi}
                    </button>
                  </div>
                )}
              </div>

              <div className="min-h-[200px] flex-1 space-y-1.5 overflow-y-auto p-3">
                {!section ? (
                  <p className="p-6 text-center text-xs text-[#8C827A]">Thêm một phần kỹ năng để bắt đầu soạn câu hỏi.</p>
                ) : section.questions.length === 0 ? (
                  <p className="p-6 text-center text-xs text-[#8C827A]">Phần này chưa có câu hỏi.</p>
                ) : (
                  section.questions.map((q, i) => {
                    const hasIssue = questionIssues(q).length > 0;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setQuestionIndex(i)}
                        className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all ${i === questionIndex ? 'border-[#B91B1C] bg-[#FDF1F1]/60 ring-1 ring-[#B91B1C]/30' : 'border-[#F2E4D8] bg-white hover:border-[#B91B1C]/30'}`}
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-black ${i === questionIndex ? 'bg-[#B91B1C] text-white' : 'bg-[#F4EFEA] text-[#6E655F]'}`}>{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#8C827A]">
                            {QUESTION_TYPE_LABELS[q.type]} · Phần {q.part}
                            {hasIssue && <AlertTriangle className="h-3 w-3 text-[#B45309]" aria-label="Câu hỏi chưa đầy đủ" />}
                          </span>
                          <span className="block truncate font-['Noto_Sans_SC',sans-serif] text-xs font-semibold text-[#2B2826]">
                            {q.promptText || q.instruction || 'Câu hỏi trống'}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              {section && (
                <div className="shrink-0 border-t border-[#F2E4D8] p-3">
                  <button type="button" onClick={addQuestion} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#B91B1C]/40 py-2 text-xs font-bold text-[#B91B1C] hover:bg-[#FDF1F1]">
                    <Plus className="h-3.5 w-3.5" /> Thêm câu hỏi
                  </button>
                </div>
              )}
            </div>

            {/* Column 3: question detail */}
            <div className="min-h-0 p-5 lg:overflow-y-auto">
              {question && section ? (
                <QuestionEditor
                  key={question.id}
                  question={question}
                  index={questionIndex}
                  count={section.questions.length}
                  onChange={patchQuestion}
                  onMove={moveQuestion}
                  onDuplicate={duplicateQuestion}
                  onRemove={removeQuestion}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-[#8C827A]">
                  <FileQuestion className="h-10 w-10 opacity-40" />
                  <p className="text-xs">Chọn hoặc thêm một câu hỏi để chỉnh sửa chi tiết.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#F2E4D8] bg-[#FFFCFA] px-6 py-3.5">
          <div className="min-w-0 text-xs">
            {view === 'editor' && (issues.length ? (
              <span className="flex items-center gap-1.5 font-bold text-[#B45309]" title={issues.join('\n')}>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="truncate">{issues.length} vấn đề cần xử lý — {issues[0]}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-bold text-[#188A5A]">
                <CheckCircle2 className="h-4 w-4" /> Đề thi hợp lệ, sẵn sàng lưu
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => void requestClose()} disabled={saving} className="rounded-xl border border-[#F2E4D8] bg-white px-4 py-2.5 text-xs font-bold text-[#8C827A] transition-all hover:bg-[#FFF9F5] disabled:opacity-50">
              Hủy
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-xl bg-[#B91B1C] px-5 py-2.5 text-xs font-bold text-white shadow-2xs shadow-[#B91B1C]/25 transition-all hover:bg-[#A3181A] disabled:opacity-60 active:scale-[0.98]">
              {saving && <Spinner size="sm" tone="white" />}
              {mode === 'edit' ? 'Lưu thay đổi' : 'Tạo đề thi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface QuestionEditorProps {
  question: AdminExamQuestion;
  index: number;
  count: number;
  onChange: (patch: Partial<AdminExamQuestion>) => void;
  onMove: (delta: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

function QuestionEditor({ question: q, index, count, onChange, onMove, onDuplicate, onRemove }: QuestionEditorProps) {
  // Remember each type's content so clicking back to a previous type restores it.
  const variants = useRef<Partial<Record<QuestionType, TypeFields>>>({});
  const onRetype = (type: QuestionType) => {
    variants.current[q.type] = typeFields(q);
    onChange(variants.current[type] ?? typeFields(retypeQuestion(q, type)));
  };

  const usesOptions = q.type === 'single_choice' || (q.options !== undefined && q.type !== 'sentence_ordering');
  const isSelected = (option: string, i: number) => q.correctAnswer === letter(i) || (option !== '' && q.correctAnswer === option);
  // Single choice stores the letter; true/false and fill-in validate against the option text.
  const answerFor = (option: string, i: number) => (q.type === 'single_choice' ? letter(i) : option);

  const updateOption = (i: number, value: string) => {
    const old = q.options?.[i] ?? '';
    const options = (q.options ?? []).map((o, j) => (j === i ? value : o));
    onChange({ options, ...(q.correctAnswer === old && old !== '' ? { correctAnswer: value } : {}) });
  };
  const removeOption = (i: number) => {
    const options = (q.options ?? []).filter((_, j) => j !== i);
    const selected = (q.options ?? []).findIndex((o, j) => isSelected(o, j));
    let correctAnswer = q.correctAnswer;
    if (selected === i) correctAnswer = '';
    else if (q.type === 'single_choice' && selected > i) correctAnswer = letter(selected - 1);
    onChange({ options, correctAnswer });
  };

  const iconButton = 'rounded-lg border border-[#F2E4D8] bg-white p-1.5 text-[#8C827A] transition-colors hover:bg-[#FFF9F5] hover:text-[#2B2826] disabled:opacity-30';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-[#2B2826] px-2.5 py-1 font-mono text-xs font-black text-white">Câu {index + 1}</span>
          <span className="font-mono text-[10px] text-[#8C827A]">ID: {q.id}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className={iconButton} title="Lên trên" aria-label="Di chuyển câu lên"><ArrowUp className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} className={iconButton} title="Xuống dưới" aria-label="Di chuyển câu xuống"><ArrowDown className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={onDuplicate} className={iconButton} title="Nhân bản câu hỏi" aria-label="Nhân bản câu hỏi"><Copy className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={onRemove} className={`${iconButton} hover:!bg-[#FDF1F1] hover:!text-[#B91B1C]`} title="Xóa câu hỏi" aria-label="Xóa câu hỏi"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_120px]">
        <div>
          <label className={labelClass}>Dạng câu hỏi</label>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => type !== q.type && onRetype(type)}
                className={`rounded-xl border px-2 py-2 text-xs font-bold transition-all ${q.type === type ? 'border-[#B91B1C] bg-[#FDF1F1] text-[#B91B1C]' : 'border-[#F2E4D8] bg-white text-[#6E655F] hover:border-[#B91B1C]/40'}`}
              >
                {QUESTION_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>Phần số</label>
          <input type="number" min={1} value={q.part} onChange={(e) => onChange({ part: Number(e.target.value) })} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Yêu cầu đề bài <span className="text-[#B91B1C]">*</span></label>
            <input value={q.instruction} onChange={(e) => onChange({ instruction: e.target.value })} className={inputClass} placeholder="Chọn đáp án phù hợp nhất." />
          </div>
          <div>
            <label className={labelClass}>Nội dung câu hỏi</label>
            <textarea rows={4} value={q.promptText ?? ''} onChange={(e) => onChange({ promptText: e.target.value })} className={`${inputClass} resize-y font-['Noto_Sans_SC',sans-serif] text-sm leading-relaxed`} placeholder="他想喝什么？" />
          </div>

          {/* Dialogue / listening script */}
          <div className="space-y-2 rounded-2xl border border-[#F2E4D8] bg-[#FFF9F5] p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#2B2826]">Hội thoại / lời thoại nghe</span>
              <button type="button" onClick={() => onChange({ dialogue: [...(q.dialogue ?? []), { speaker: '', text: '' }] })} className="flex items-center gap-1 text-[11px] font-bold text-[#B91B1C] hover:underline">
                <Plus className="h-3 w-3" /> Thêm lời
              </button>
            </div>
            {(q.dialogue ?? []).length === 0 && <p className="text-[11px] text-[#8C827A]">Không có hội thoại. Phần nghe sẽ dùng giọng đọc trình duyệt nếu chưa có audio.</p>}
            {(q.dialogue ?? []).map((line, i) => (
              <div key={i} className="grid grid-cols-[70px_minmax(0,1fr)_auto] gap-1.5">
                <input value={line.speaker} onChange={(e) => onChange({ dialogue: q.dialogue!.map((l, j) => (j === i ? { ...l, speaker: e.target.value } : l)) })} className="rounded-lg border border-[#F2E4D8] bg-white px-2 py-1.5 text-xs outline-none focus:border-[#B91B1C]" placeholder="男" aria-label="Người nói" />
                <div className="space-y-1">
                  <input value={line.text} onChange={(e) => onChange({ dialogue: q.dialogue!.map((l, j) => (j === i ? { ...l, text: e.target.value } : l)) })} className="w-full rounded-lg border border-[#F2E4D8] bg-white px-2 py-1.5 font-['Noto_Sans_SC',sans-serif] text-xs outline-none focus:border-[#B91B1C]" placeholder="我想喝茶。" aria-label="Lời thoại" />
                  <input value={line.pinyin ?? ''} onChange={(e) => onChange({ dialogue: q.dialogue!.map((l, j) => (j === i ? { ...l, pinyin: e.target.value } : l)) })} className="w-full rounded-lg border border-[#F2E4D8] bg-white px-2 py-1 font-mono text-[11px] text-[#B91B1C] outline-none focus:border-[#B91B1C]" placeholder="Pinyin (tùy chọn)" aria-label="Pinyin lời thoại" />
                </div>
                <button type="button" onClick={() => onChange({ dialogue: q.dialogue!.filter((_, j) => j !== i) })} className="self-start rounded-lg p-1.5 text-[#8C827A] hover:bg-white hover:text-[#B91B1C]" aria-label="Xóa lời thoại"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {/* Answer area by type */}
          <div className="space-y-2.5 rounded-2xl border border-[#C6E7DA] bg-[#F5FBF8] p-3.5">
            <span className="block text-xs font-bold text-[#188A5A]">Đáp án <span className="text-[#B91B1C]">*</span></span>

            {q.type === 'true_false' && q.options === undefined && (
              <div className="grid grid-cols-2 gap-2">
                {(['True', 'False'] as const).map(value => (
                  <button key={value} type="button" onClick={() => onChange({ correctAnswer: value })} className={`rounded-xl border py-2.5 text-xs font-black transition-all ${q.correctAnswer === value ? 'border-[#188A5A] bg-[#188A5A] text-white' : 'border-[#C6E7DA] bg-white text-[#2B2826]'}`}>
                    {value === 'True' ? 'Đúng (True)' : 'Sai (False)'}
                  </button>
                ))}
              </div>
            )}

            {q.type === 'fill_in_blank' && (
              <label className="flex items-center gap-2 text-[11px] font-bold text-[#6E655F]">
                <input
                  type="checkbox"
                  checked={q.options !== undefined}
                  onChange={(e) => onChange(e.target.checked ? { options: ['', ''], correctAnswer: '' } : { options: undefined })}
                  className="accent-[#188A5A]"
                />
                Cho chọn từ danh sách
              </label>
            )}

            {usesOptions && (
              <div className="space-y-1.5">
                {(q.options ?? []).map((option, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onChange({ correctAnswer: answerFor(option, i) })}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-black transition-all ${isSelected(option, i) ? 'bg-[#188A5A] text-white' : 'border border-[#C6E7DA] bg-white text-[#6E655F] hover:border-[#188A5A]'}`}
                      title="Đặt làm đáp án đúng"
                      aria-label={`Chọn ${letter(i)} là đáp án đúng`}
                      aria-pressed={isSelected(option, i)}
                    >
                      {letter(i)}
                    </button>
                    <input value={option} onChange={(e) => updateOption(i, e.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#C6E7DA] bg-white px-2.5 py-1.5 font-['Noto_Sans_SC',sans-serif] text-xs outline-none focus:border-[#188A5A]" placeholder={`Lựa chọn ${letter(i)}`} aria-label={`Lựa chọn ${letter(i)}`} />
                    <button type="button" onClick={() => removeOption(i)} disabled={(q.options?.length ?? 0) <= 2} className="rounded-lg p-1.5 text-[#8C827A] hover:bg-white hover:text-[#B91B1C] disabled:opacity-30" aria-label={`Xóa lựa chọn ${letter(i)}`}><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                {(q.options?.length ?? 0) < 8 && (
                  <button type="button" onClick={() => onChange({ options: [...(q.options ?? []), ''] })} className="flex items-center gap-1 text-[11px] font-bold text-[#188A5A] hover:underline">
                    <Plus className="h-3 w-3" /> Thêm lựa chọn
                  </button>
                )}
                <p className="text-[10px] text-[#8C827A]">Bấm vào chữ cái để chọn đáp án đúng. Trang làm bài tự hiển thị A/B/C, không cần gõ tiền tố.</p>
              </div>
            )}

            {q.type === 'sentence_ordering' && (
              <div className="space-y-2">
                <span className="block text-[11px] font-bold text-[#6E655F]">Các cụm từ (hiển thị xáo trộn cho học viên)</span>
                {(q.sentenceChunks ?? []).map((chunk, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input value={chunk} onChange={(e) => onChange({ sentenceChunks: q.sentenceChunks!.map((c, j) => (j === i ? e.target.value : c)) })} className="min-w-0 flex-1 rounded-lg border border-[#C6E7DA] bg-white px-2.5 py-1.5 font-['Noto_Sans_SC',sans-serif] text-xs outline-none focus:border-[#188A5A]" placeholder={`Cụm ${i + 1}`} aria-label={`Cụm từ ${i + 1}`} />
                    <button type="button" onClick={() => onChange({ sentenceChunks: q.sentenceChunks!.filter((_, j) => j !== i) })} disabled={(q.sentenceChunks?.length ?? 0) <= 2} className="rounded-lg p-1.5 text-[#8C827A] hover:bg-white hover:text-[#B91B1C] disabled:opacity-30" aria-label={`Xóa cụm ${i + 1}`}><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => onChange({ sentenceChunks: [...(q.sentenceChunks ?? []), ''] })} className="flex items-center gap-1 text-[11px] font-bold text-[#188A5A] hover:underline">
                  <Plus className="h-3 w-3" /> Thêm cụm từ
                </button>
              </div>
            )}

            {(q.type === 'sentence_ordering' || (q.type === 'fill_in_blank' && q.options === undefined)) && (
              <div>
                <span className="mb-1 block text-[11px] font-bold text-[#6E655F]">{q.type === 'sentence_ordering' ? 'Câu đúng hoàn chỉnh' : 'Từ cần điền'}</span>
                <input value={q.correctAnswer} onChange={(e) => onChange({ correctAnswer: e.target.value })} className="w-full rounded-lg border border-[#C6E7DA] bg-white px-2.5 py-2 font-['Noto_Sans_SC',sans-serif] text-sm font-bold outline-none focus:border-[#188A5A]" placeholder={q.type === 'sentence_ordering' ? '他已经把信寄出去了' : '思路'} />
              </div>
            )}

            {q.type === 'sentence_ordering' && (
              <div>
                <span className="mb-1 block text-[11px] font-bold text-[#6E655F]">Đáp án chấp nhận khác (mỗi dòng một câu)</span>
                <textarea rows={2} value={(q.acceptedAnswers ?? []).join('\n')} onChange={(e) => onChange({ acceptedAnswers: e.target.value.split('\n') })} className="w-full resize-none rounded-lg border border-[#C6E7DA] bg-white px-2.5 py-1.5 font-['Noto_Sans_SC',sans-serif] text-xs outline-none focus:border-[#188A5A]" />
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>Giải thích đáp án (tiếng Việt) <span className="text-[#B91B1C]">*</span></label>
            <textarea rows={3} value={q.explanationVi} onChange={(e) => onChange({ explanationVi: e.target.value })} className={`${inputClass} resize-y leading-relaxed`} placeholder="Giải thích vì sao đáp án đúng..." />
          </div>
        </div>
      </div>

      {/* Supplementary fields */}
      <div className="space-y-3 rounded-2xl border border-[#F2E4D8] p-4">
        <span className="block text-[11px] font-black uppercase tracking-wider text-[#8C827A]">Thông tin bổ sung</span>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className={labelClass}>Pinyin đề bài</label>
            <input value={q.pinyinScript ?? ''} onChange={(e) => onChange({ pinyinScript: e.target.value })} className={`${inputClass} font-mono text-[#B91B1C]`} placeholder="Chỉ hiển thị cho HSK 1–2" />
          </div>
          <div>
            <label className={labelClass}>Bản dịch tiếng Việt</label>
            <input value={q.translationVi ?? ''} onChange={(e) => onChange({ translationVi: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Audio câu hỏi (URL)</label>
            <input value={q.audioUrl ?? ''} onChange={(e) => onChange({ audioUrl: e.target.value })} className={inputClass} placeholder="https://..." />
          </div>
          <div>
            <label className={labelClass}>Hình ảnh (URL)</label>
            <input value={q.imageUrl ?? ''} onChange={(e) => onChange({ imageUrl: e.target.value })} className={inputClass} placeholder="https://..." />
          </div>
          <div>
            <label className={labelClass}>Điểm ngữ pháp liên quan</label>
            <input value={q.grammarPoint ?? ''} onChange={(e) => onChange({ grammarPoint: e.target.value })} className={inputClass} placeholder="把 字句" />
          </div>
          <div>
            <label className={labelClass}>Bài học gợi ý</label>
            <div className="grid grid-cols-2 gap-1.5">
              <input value={q.recommendedLessonTitle ?? ''} onChange={(e) => onChange({ recommendedLessonTitle: e.target.value })} className={inputClass} placeholder="Tên bài học" aria-label="Tên bài học gợi ý" />
              <input value={q.recommendedLessonId ?? ''} onChange={(e) => onChange({ recommendedLessonId: e.target.value })} className={`${inputClass} font-mono`} placeholder="ID bài học" aria-label="ID bài học gợi ý" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
