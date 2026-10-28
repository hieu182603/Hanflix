import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpenCheck, Check, Sparkles, Wand2, X } from 'lucide-react';
import { Spinner } from '../notifications';
import type { ExamSkill } from '../../data/hskExamData';
import {
  generateAdminExam,
  getAdminExamList,
  type AdminExamSummary,
  type ExamCategory,
  type GenerateAdminExamResponse,
} from '../../api/exams';
import { EXAM_CATEGORY_LABELS, EXAM_SKILL_LABELS } from './AdminExamEditorModal';

const MAX_REFERENCES = 3;
const inputClass =
  'w-full px-3 py-2.5 bg-[#FFF9F5] border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] focus:bg-white transition-all text-xs text-[#2B2826]';
const labelClass = 'block font-bold text-[#2B2826] mb-1.5 text-xs';

const levelSkills = (level: number): ExamSkill[] => (level <= 2 ? ['listening', 'reading'] : ['listening', 'reading', 'writing']);

/** Mirrors the backend rule: the category fixes the sections except for mini tests. */
function sectionSkills(level: number, category: ExamCategory, chosen: ExamSkill[]): ExamSkill[] {
  if (category === 'full_mock') return levelSkills(level);
  if (category.startsWith('skill_')) return [category.slice('skill_'.length) as ExamSkill];
  return levelSkills(level).filter(skill => chosen.includes(skill));
}

interface AdminExamAiModalProps {
  defaultLevel: number;
  onClose: () => void;
  onGenerated: (result: GenerateAdminExamResponse) => void;
}

export default function AdminExamAiModal({ defaultLevel, onClose, onGenerated }: AdminExamAiModalProps) {
  const [level, setLevel] = useState(defaultLevel);
  const [category, setCategory] = useState<ExamCategory>('mini_test');
  const [chosenSkills, setChosenSkills] = useState<ExamSkill[]>(['listening', 'reading', 'writing']);
  const [questionsPerSection, setQuestionsPerSection] = useState(5);
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');

  const [exams, setExams] = useState<AdminExamSummary[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [autoReferences, setAutoReferences] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const skills = sectionSkills(level, category, chosenSkills);
  const totalQuestions = skills.length * questionsPerSection;

  useEffect(() => {
    getAdminExamList({ page: 1, limit: 100 })
      .then(res => setExams(res.items))
      .catch(() => setExams([]))
      .finally(() => setLoadingExams(false));
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      abortRef.current?.abort();
    };
  }, []);

  const requestClose = () => {
    abortRef.current?.abort();
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Same-level exams first, then the nearest levels; this is also what auto mode sends.
  const sortedExams = useMemo(
    () => [...exams].sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level) || a.code.localeCompare(b.code)),
    [exams, level],
  );
  const autoPicks = sortedExams.filter(exam => Math.abs(exam.level - level) <= 1).slice(0, MAX_REFERENCES);

  const changeLevel = (next: number) => {
    setLevel(next);
    if (next <= 2 && category === 'skill_writing') setCategory('mini_test');
  };

  const toggleSkill = (skill: ExamSkill) =>
    setChosenSkills(prev => (prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]));

  const toggleReference = (id: string) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= MAX_REFERENCES ? prev : [...prev, id]));

  const handleGenerate = async () => {
    if (!skills.length) {
      setError('Chọn ít nhất một kỹ năng cho đề.');
      return;
    }
    if (!autoReferences && !selectedIds.length) {
      setError('Chọn ít nhất một đề tham khảo hoặc bật chế độ tự động chọn.');
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateAdminExam({
        level,
        category,
        ...(category === 'mini_test' ? { skills } : {}),
        questionsPerSection,
        ...(autoReferences ? {} : { referenceExamIds: selectedIds }),
        ...(topic.trim() ? { topic: topic.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }, controller.signal);
      onGenerated(result);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Panda AI chưa tạo được đề. Hãy thử lại.');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setGenerating(false);
    }
  };

  const cancelGeneration = () => {
    abortRef.current?.abort();
    setGenerating(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-xs sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-ai-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !generating) requestClose(); }}
    >
      <div className="relative flex h-[86vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-3xl border border-[#F2E4D8] bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#F2E4D8] bg-[#FFF9F5] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FDF1F1] text-[#B91B1C] ring-1 ring-[#B91B1C]/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 id="exam-ai-title" className="text-lg font-black text-[#2B2826]">Tạo Đề Thi Bằng Panda AI</h2>
              <p className="text-[11px] text-[#8C827A]">
                AI học phong cách và độ khó từ các đề có sẵn trong kho, rồi soạn bộ câu hỏi mới. Bạn sẽ được duyệt và chỉnh sửa trước khi lưu.
              </p>
            </div>
          </div>
          <button type="button" onClick={requestClose} className="rounded-lg p-1.5 text-[#8C827A] transition-colors hover:bg-white" aria-label="Đóng">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_440px] lg:overflow-hidden">
          {/* Settings */}
          <div className="space-y-5 border-b border-[#F2E4D8] p-6 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="ai-exam-level">Cấp độ HSK</label>
                <select id="ai-exam-level" value={level} onChange={(e) => changeLevel(Number(e.target.value))} className={`${inputClass} font-bold`}>
                  {[1, 2, 3, 4, 5, 6].map(l => <option key={l} value={l}>HSK {l}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="ai-exam-category">Loại đề</label>
                <select id="ai-exam-category" value={category} onChange={(e) => setCategory(e.target.value as ExamCategory)} className={`${inputClass} font-bold`}>
                  {(Object.keys(EXAM_CATEGORY_LABELS) as ExamCategory[]).map(c => (
                    <option key={c} value={c} disabled={c === 'skill_writing' && level <= 2}>{EXAM_CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <span className={labelClass}>Các phần kỹ năng</span>
              <div className="flex flex-wrap gap-2">
                {(['listening', 'reading', 'writing'] as ExamSkill[]).map(skill => {
                  const allowed = levelSkills(level).includes(skill);
                  const active = skills.includes(skill);
                  const editable = category === 'mini_test' && allowed;
                  return (
                    <button
                      key={skill}
                      type="button"
                      disabled={!editable}
                      onClick={() => toggleSkill(skill)}
                      aria-pressed={active}
                      className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all disabled:cursor-not-allowed ${
                        active ? 'border-[#B91B1C] bg-[#FDF1F1] text-[#B91B1C]' : 'border-[#F2E4D8] bg-white text-[#8C827A]'
                      } ${!allowed ? 'opacity-40' : ''}`}
                    >
                      {active && <Check className="h-3.5 w-3.5" />}
                      {EXAM_SKILL_LABELS[skill].vi} · {EXAM_SKILL_LABELS[skill].zh}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-[#8C827A]">
                {category === 'mini_test'
                  ? 'Đề rút gọn: tự chọn kỹ năng.'
                  : 'Loại đề này cố định các phần kỹ năng.'}
                {level <= 2 && ' HSK 1–2 không có phần Viết.'}
              </p>
            </div>

            <div>
              <label className={labelClass} htmlFor="ai-exam-count">Số câu mỗi phần: <span className="text-[#B91B1C]">{questionsPerSection}</span></label>
              <input
                id="ai-exam-count"
                type="range"
                min={1}
                max={15}
                value={questionsPerSection}
                onChange={(e) => setQuestionsPerSection(Number(e.target.value))}
                className="w-full accent-[#B91B1C]"
              />
              <div className="flex justify-between text-[10px] text-[#8C827A]"><span>1</span><span>15</span></div>
            </div>

            <div>
              <label className={labelClass} htmlFor="ai-exam-topic">Chủ đề ưu tiên (tùy chọn)</label>
              <input id="ai-exam-topic" value={topic} maxLength={300} onChange={(e) => setTopic(e.target.value)} className={inputClass} placeholder="ví dụ: mua sắm, du lịch, trường học..." />
            </div>

            <div>
              <label className={labelClass} htmlFor="ai-exam-notes">Yêu cầu thêm cho AI (tùy chọn)</label>
              <textarea
                id="ai-exam-notes"
                rows={4}
                value={notes}
                maxLength={1000}
                onChange={(e) => setNotes(e.target.value)}
                className={`${inputClass} resize-none leading-relaxed`}
                placeholder="ví dụ: tập trung vào cấu trúc 把, tăng số câu đúng/sai, giải thích chi tiết hơn..."
              />
            </div>

            <div className="rounded-2xl border border-[#F2E4D8] bg-[#FFFCFA] p-4 text-xs text-[#6E655F]">
              <div className="mb-1 flex items-center gap-1.5 font-bold text-[#2B2826]"><Wand2 className="h-3.5 w-3.5 text-[#B91B1C]" /> Đề sẽ được tạo</div>
              HSK {level} · {EXAM_CATEGORY_LABELS[category]} · {skills.map(s => EXAM_SKILL_LABELS[s].vi).join(', ') || '—'} · khoảng <b>{totalQuestions}</b> câu.
              Đề lưu ở trạng thái <b>bản nháp</b>; câu nào AI tạo sai định dạng sẽ bị loại và được báo lại.
            </div>
          </div>

          {/* References */}
          <div className="flex min-h-0 flex-col bg-[#FFFCFA]">
            <div className="shrink-0 space-y-3 border-b border-[#F2E4D8] p-5">
              <div className="flex items-center gap-2">
                <BookOpenCheck className="h-4 w-4 text-[#B91B1C]" />
                <h3 className="text-sm font-black text-[#2B2826]">Đề tham khảo từ kho</h3>
              </div>
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#F2E4D8] bg-white px-3 py-2.5">
                <span>
                  <span className="block text-xs font-bold text-[#2B2826]">Tự động chọn</span>
                  <span className="text-[11px] text-[#8C827A]">Tối đa {MAX_REFERENCES} đề cùng cấp hoặc cấp lân cận</span>
                </span>
                <input type="checkbox" checked={autoReferences} onChange={(e) => setAutoReferences(e.target.checked)} className="h-4 w-4 accent-[#B91B1C]" aria-label="Tự động chọn đề tham khảo" />
              </label>
              {!autoReferences && <p className="text-[11px] text-[#8C827A]">Đã chọn {selectedIds.length}/{MAX_REFERENCES} đề.</p>}
            </div>
            <div className="min-h-[180px] flex-1 space-y-1.5 overflow-y-auto p-4">
              {loadingExams ? (
                <div className="flex items-center justify-center gap-2 p-8 text-xs text-[#8C827A]"><Spinner size="sm" tone="brand" /> Đang tải kho đề...</div>
              ) : sortedExams.length === 0 ? (
                <p className="p-8 text-center text-xs text-[#8C827A]">Kho chưa có đề nào; AI sẽ soạn theo chuẩn HSK chung.</p>
              ) : (
                sortedExams.map(exam => {
                  const picked = autoReferences ? autoPicks.some(p => p.id === exam.id) : selectedIds.includes(exam.id);
                  const disabled = autoReferences || (!picked && selectedIds.length >= MAX_REFERENCES);
                  return (
                    <button
                      key={exam.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleReference(exam.id)}
                      aria-pressed={picked}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                        picked ? 'border-[#B91B1C] bg-white ring-1 ring-[#B91B1C]/30' : 'border-[#F2E4D8] bg-white'
                      } ${disabled && !picked ? 'opacity-50' : ''} ${!disabled ? 'hover:border-[#B91B1C]/40' : 'cursor-default'}`}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${picked ? 'border-[#B91B1C] bg-[#B91B1C] text-white' : 'border-[#E5DCD3]'}`}>
                        {picked && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-black text-[#B91B1C]">{exam.code}</span>
                          <span className="rounded bg-[#F4EFEA] px-1.5 py-0.5 text-[9px] font-black text-[#6E655F]">HSK {exam.level}</span>
                          {!exam.isPublished && <span className="text-[9px] font-bold text-[#8C827A]">Nháp</span>}
                        </span>
                        <span className="block truncate text-xs font-bold text-[#2B2826]">{exam.title}</span>
                        <span className="text-[10px] text-[#8C827A]">{EXAM_CATEGORY_LABELS[exam.category]} · {exam.totalQuestions} câu</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#F2E4D8] bg-[#FFFCFA] px-6 py-3.5">
          <div className="min-w-0 text-xs font-bold text-[#B91B1C]" role="alert">{error}</div>
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={requestClose} className="rounded-xl border border-[#F2E4D8] bg-white px-4 py-2.5 text-xs font-bold text-[#8C827A] transition-all hover:bg-[#FFF9F5]">
              Hủy
            </button>
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating}
              className="flex items-center gap-2 rounded-xl bg-[#B91B1C] px-5 py-2.5 text-xs font-bold text-white shadow-2xs shadow-[#B91B1C]/25 transition-all hover:bg-[#A3181A] disabled:opacity-60 active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4" />
              Tạo đề bằng AI
            </button>
          </div>
        </div>

        {generating && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-white/85 backdrop-blur-xs" aria-live="polite">
            <Spinner size="lg" tone="brand" />
            <div className="text-center">
              <p className="text-sm font-black text-[#2B2826]">Panda AI đang soạn {totalQuestions} câu hỏi HSK {level}...</p>
              <p className="mt-1 text-xs text-[#8C827A]">Thường mất 20–50 giây. Đề mới sẽ mở trong trình soạn thảo để bạn duyệt.</p>
            </div>
            <button type="button" onClick={cancelGeneration} className="rounded-xl border border-[#F2E4D8] bg-white px-4 py-2 text-xs font-bold text-[#8C827A] hover:text-[#B91B1C]">
              Dừng tạo đề
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
