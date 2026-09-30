import { useI18n } from '../i18n';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  Headphones,
  BookOpen,
  PenLine,
  Sparkles,
  ListChecks,
  Clock,
  ChevronRight,
  ShieldCheck,
  Target,
  TrendingUp,
  Award,
  Filter,
  CheckCircle2,
  Lock,
  Play,
  RotateCcw,
  Users,
  Calendar,
  Star,
  Flame,
} from 'lucide-react';
import LeaderboardView, { LeaderboardViewProps } from './leaderboard/LeaderboardView';
import { OFFLINE_EXAM_CATALOG, type HskExam, type ExamMetadata } from '../data/hskExamData';
import { fetchExams, fetchExamById, fetchMyExamHistory, fetchExamAttempt, type ExamHistory } from '../services/exam.service';
import ExamRunner, { ExamSubmission } from './exam/ExamRunner';
import ExamResultView from './exam/ExamResultView';
import {
  examStorageKeys,
  saveLastResultId,
  loadLastResultId,
  clearLastResultId,
  loadActiveExamId,
  clearActiveExam,
} from './exam/exam-storage';

interface ExamPrepPageProps {
  onStartPractice?: () => void;
  onNavigateLesson?: (lessonId: string) => void;
}

const HSK_LEVELS = [1, 2, 3, 4, 5, 6];

export function ExamPrepPage({ onStartPractice, onNavigateLesson }: ExamPrepPageProps) {
  const { tr, locale } = useI18n();
  // Trạng thái phòng thi
  const [activeExam, setActiveExam] = useState<HskExam | null>(null);
  const [submission, setSubmission] = useState<ExamSubmission | null>(null);
  const [restoringResult, setRestoringResult] = useState(false);

  // Bộ lọc
  const [selectedLevel, setSelectedLevel] = useState<number>(3);
  const [filterCategory, setFilterCategory] = useState<'all' | 'full_mock' | 'skill_drills'>('all');

  const [exams, setExams] = useState<ExamMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [startError, setStartError] = useState('');
  const [starting, setStarting] = useState(false);
  const [reload, setReload] = useState(0);
  const [history, setHistory] = useState<ExamHistory | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const startInFlight = useRef(false);
  const startExam = useCallback(async (id: string) => {
    if (startInFlight.current) return;
    startInFlight.current = true;
    setStarting(true);
    setStartError('');
    try {
      const exam = await fetchExamById(id);
      if (!exam.sections.some(section => section.questions.length > 0)) throw new Error('Đề thi chưa có câu hỏi.');
      setSubmission(null);
      clearLastResultId();
      setActiveExam(exam);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'Chưa tải được đề thi. Vui lòng thử lại.');
    } finally {
      setStarting(false);
      startInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCatalogError('');
    fetchExams().then(items => { if (!cancelled) setExams(items); }).catch(() => {
      if (!cancelled) {
        setExams(OFFLINE_EXAM_CATALOG);
        setCatalogError('Chưa kết nối được kho đề. Đang hiển thị danh mục ngoại tuyến; cần kết nối để bắt đầu thi.');
      }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload, submission]);

  useEffect(() => {
    let cancelled = false;
    setHistory(null);
    setHistoryError('');
    fetchMyExamHistory(historyPage).then(value => { if (!cancelled) setHistory(value); }).catch(error => {
      if (!cancelled) setHistoryError(error instanceof Error ? error.message : 'Chưa tải được lịch sử thi.');
    });
    return () => { cancelled = true; };
  }, [historyPage, submission, reload]);

  const filteredExams = useMemo(() => exams.filter(exam => {
    if (exam.level !== selectedLevel) return false;
    if (filterCategory === 'full_mock') return exam.category === 'full_mock';
    if (filterCategory === 'skill_drills') return exam.category.startsWith('skill_') || exam.category === 'mini_test';
    return true;
  }), [exams, selectedLevel, filterCategory]);

  useEffect(() => {
    try {
      const resultId = loadLastResultId();
      if (resultId) {
        setRestoringResult(true);
        fetchExamAttempt(resultId)
          .then(setSubmission)
          .catch(() => {
            clearLastResultId();
            const savedActiveId = loadActiveExamId();
            if (savedActiveId) void startExam(savedActiveId);
            else setStartError('Chưa tải được kết quả trước đó. Bạn có thể mở lại trong lịch sử thi.');
          })
          .finally(() => {
            setRestoringResult(false);
          });
      } else {
        const savedId = loadActiveExamId();
        if (savedId) void startExam(savedId);
      }
    } catch { /* Storage is optional. */ }
  }, [startExam]);

  const startSkill = (skill: 'listening' | 'reading' | 'writing') => {
    const exam = exams.find(item => item.level === selectedLevel && item.category === `skill_${skill}`);
    if (exam && !catalogError) void startExam(exam.id);
    else setStartError('Chưa có đề riêng cho kỹ năng này ở cấp độ đã chọn. Bạn có thể chọn đề mẫu trong danh sách.');
  };

  // Đang khôi phục kết quả thi sau reload
  if (restoringResult) {
    return (
      <div className="py-24 text-center space-y-3 animate-in fade-in duration-200">
        <div className="w-10 h-10 border-4 border-[#B91B1C] border-t-transparent rounded-full animate-spin mx-auto" />
        <p role="status" className="text-base font-bold text-[#18181B]">{tr('Đang tải lại kết quả thi…')}</p>
        <p className="text-xs text-[#5F6368]">{tr('Vui lòng đợi trong giây lát.')}</p>
      </div>
    );
  }

  // Nếu đang trong phòng thi -> Render ExamRunner (Có chống F12 / DevTools)
  if (activeExam) {
    return (
      <ExamRunner
        exam={activeExam}
        onExit={() => {
          clearActiveExam(activeExam.id);
          setActiveExam(null);
        }}
        onFinish={(sub) => {
          clearActiveExam(sub.exam?.id);
          saveLastResultId(sub.id);
          setSubmission(sub);
          setActiveExam(null);
        }}
      />
    );
  }

  // Nếu vừa nộp bài -> Render ExamResultView (Bảng điểm & Gợi ý bài học)
  if (submission) {
    return (
      <>
      {startError && <p role="alert" className="p-3 text-red-700">{startError}</p>}
      {starting && <p role="status">Đang tải đề thi…</p>}
      <ExamResultView
        submission={submission}
        onRetake={() => {
          clearLastResultId();
          void startExam(submission.exam.id);
        }}
        onBackToList={() => {
          clearLastResultId();
          setSubmission(null);
        }}
        onNavigateLesson={onNavigateLesson || onStartPractice}
      />
      </>
    );
  }

  return (
    <div className="space-y-7 animate-in fade-in duration-200">
      {(loading || starting) && <p role="status" className="text-sm text-[#5F6368]">{starting ? 'Đang tải đề thi…' : 'Đang tải kho đề…'}</p>}
      {(catalogError || startError) && <div role="alert" className="p-4 rounded-2xl bg-amber-50 text-amber-900 text-sm">
        {startError || catalogError} <button type="button" onClick={() => { setStartError(''); setReload(value => value + 1); }} className="font-bold underline ml-2">Thử lại</button>
      </div>}
      {/* HERO BANNER: TRUNG TÂM LUYỆN THI HSK */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden bg-white rounded-3xl border border-[#E7E7EA] p-6 md:p-8 shadow-2xs"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#18181B] text-white text-[11px] font-black tracking-wider uppercase font-mono">
                <GraduationCap className="w-3.5 h-3.5" />
                HSK Exam Center
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-extrabold border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />{tr("Khóa F12 · Phòng thi bảo mật")}</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-[#18181B] tracking-tight">{tr("Luyện thi HSK Chuẩn Quốc Tế")}</h1>

            <p className="text-xs md:text-sm text-[#5F6368] leading-relaxed">{tr("Mô phỏng 100% giao diện thi HSK trên máy tính (HSK 机考). Luyện đề thi thật có bấm giờ, âm thanh chuẩn Bắc Kinh, lời giải thích chi tiết và gợi ý bài học HanFlix bù đắp lỗ hổng kiến thức.")}</p>
          </div>

          {/* Hộp Thống kê nhanh */}
          <div className="flex items-center gap-4 bg-[#F7F7F9] p-4 rounded-2xl border border-[#E7E7EA] shrink-0">
            <div className="text-center px-2">
              <div className="text-2xl font-black text-[#B91B1C]">6/6</div>
              <span className="text-[10px] font-bold text-[#8B9097] uppercase tracking-wider">{tr("Cấp HSK 1 - 6")}</span>
            </div>
            <div className="h-8 w-px bg-[#E7E7EA]" />
            <div className="text-center px-2">
              <div className="text-2xl font-black text-[#18181B]">100%</div>
              <span className="text-[10px] font-bold text-[#8B9097] uppercase tracking-wider">{tr("Chuẩn Hanban")}</span>
            </div>
            <div className="h-8 w-px bg-[#E7E7EA]" />
            <div className="text-center px-2">
              <div className="text-2xl font-black text-emerald-700">机考</div>
              <span className="text-[10px] font-bold text-[#8B9097] uppercase tracking-wider">{tr("Mô phỏng máy")}</span>
            </div>
          </div>
        </div>

        {/* CẢNH BÁO BẢO MẬT PHÒNG THI */}
        <div className="mt-6 flex items-center gap-2.5 rounded-2xl bg-[#FFF9F5] border border-[#FCE9E1] p-3.5 px-4 text-xs text-[#5F6368]">
          <ShieldCheck className="w-4 h-4 text-[#B91B1C] shrink-0" />
          <p className="leading-relaxed">
            <strong className="text-[#18181B]">{tr("Lưu ý phòng thi:")}</strong> {tr("Khi bắt đầu làm bài, hệ thống sẽ tự động khóa phím")} <strong>F12</strong>{tr(", phím tắt mở DevTools và menu chuột phải nhằm mô phỏng điều kiện thi thật nghiêm túc và công bằng.")}</p>
        </div>
      </motion.section>

      {/* BỘ LỌC CẤP HSK (TABS 1 -> 6) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Selector cấp độ HSK 1 - 6 */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white border border-[#E7E7EA] shadow-2xs overflow-x-auto max-w-full">
          {HSK_LEVELS.map((lvl) => {
            const isSelected = selectedLevel === lvl;
            return (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={`px-4 py-2 rounded-xl text-xs font-black tracking-tight transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#B91B1C] text-white shadow-xs scale-102'
                    : 'text-[#5F6368] hover:text-[#18181B] hover:bg-neutral-100'
                }`}
              >
                <span>HSK {lvl}</span>
                {lvl === 3 && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>{tr("Có đề mẫu")}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Lọc thể loại */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-[#E7E7EA] text-xs font-bold shadow-2xs">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
              filterCategory === 'all' ? 'bg-[#18181B] text-white' : 'text-[#5F6368] hover:text-[#18181B]'
            }`}
          >{tr("Tất cả đề")}</button>
          <button
            onClick={() => setFilterCategory('full_mock')}
            className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
              filterCategory === 'full_mock' ? 'bg-[#18181B] text-white' : 'text-[#5F6368] hover:text-[#18181B]'
            }`}
          >{tr("Thi thử toàn diện (Full Mock)")}</button>
        </div>
      </div>

      {/* DANH SÁCH ĐỀ THI (EXAM CARDS GRID) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-[#18181B] tracking-tight flex items-center gap-2">
            <span>{tr("Danh sách đề thi HSK")} {selectedLevel}</span>
            <span className="text-xs font-mono font-bold text-[#8B9097] bg-white px-2 py-0.5 rounded-full border border-[#E7E7EA]">
              {filteredExams.length} {tr("bộ đề")}</span>
          </h2>
        </div>

        {!loading && filteredExams.length === 0 && <p className="text-sm text-[#5F6368]">Chưa có đề phù hợp với bộ lọc này.</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExams.map((exam) => {
            const hasQuestions = !catalogError && exam.totalQuestions > 0;

            return (
              <motion.div
                key={exam.id}
                whileHover={{ y: -3 }}
                className={`p-6 rounded-3xl border bg-white flex flex-col justify-between shadow-2xs transition-all relative overflow-hidden ${
                  hasQuestions
                    ? 'border-[#E7E7EA] hover:border-[#B91B1C]/50 hover:shadow-md'
                    : 'border-[#E7E7EA] opacity-80'
                }`}
              >
                {/* Header card */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-xl bg-[#18181B] text-white font-mono font-black text-xs">
                        HSK {exam.level}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#8B9097]">
                        {exam.code}
                      </span>
                    </div>

                    {hasQuestions ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200">{tr("SẴN SÀNG THI")}</span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-[10px] font-bold">{tr("ĐANG NẠP ĐỀ")}</span>
                    )}
                  </div>

                  <h3 className="text-base font-black text-[#18181B] tracking-tight leading-snug line-clamp-2">
                    {exam.title}
                  </h3>

                  <p className="text-xs text-[#5F6368] line-clamp-2 leading-relaxed">
                    {exam.description}
                  </p>

                  {/* Thông số đề thi */}
                  <div className="grid grid-cols-3 gap-2 pt-2 pb-1 border-t border-b border-neutral-100 text-xs">
                    <div>
                      <span className="text-[10px] text-[#8B9097] block font-semibold">{tr("Thời gian")}</span>
                      <strong className="text-[#18181B] font-mono">{exam.durationMinutes}p</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8B9097] block font-semibold">{tr("Số câu")}</span>
                      <strong className="text-[#18181B] font-mono">{exam.totalQuestions} {tr("câu")}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8B9097] block font-semibold">{tr("Điểm đỗ")}</span>
                      <strong className="text-emerald-700 font-mono">{exam.passingScore} {tr("đ")}</strong>
                    </div>
                  </div>
                </div>

                {/* Footer card */}
                <div className="pt-5 flex items-center justify-between">
                  <span className="text-[11px] text-[#8B9097]">
                    {exam.attemptCount.toLocaleString(locale)} {tr("lượt thi")}</span>

                  {hasQuestions ? (
                    <button
                      disabled={starting}
                      onClick={() => void startExam(exam.id)}
                      className="px-4 py-2 rounded-xl bg-[#B91B1C] hover:bg-[#991516] text-white text-xs font-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>{tr("Vào phòng thi")}</span>
                    </button>
                  ) : (
                    <button
                      disabled
                      className="px-3.5 py-2 rounded-xl bg-neutral-100 text-neutral-400 text-xs font-bold cursor-not-allowed flex items-center gap-1"
                    >
                      <Lock className="w-3 h-3" />
                      <span>{tr("Sắp mở")}</span>
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* CÁC DẠNG BÀI LUYỆN TẬP CHUYÊN ĐỀ (SKILL DRILLS) */}
      <section className="bg-white rounded-3xl border border-[#E7E7EA] p-6 md:p-8 shadow-2xs space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#8B9097]">{tr("Luyện chuyên đề HSK")}</span>
            <h2 className="text-lg font-black text-[#18181B] tracking-tight mt-0.5">{tr("Tách nhỏ kỹ năng để ôn tập không áp lực")}</h2>
          </div>
          <span className="text-xs text-[#5F6368] hidden sm:inline">{tr("Tự do làm từng phần có lời giải ngay lập tức")}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => startSkill('listening')}
            className="p-5 rounded-2xl bg-[#F7F7F9] hover:bg-[#FDF1F1] border border-[#E7E7EA] hover:border-[#B91B1C]/40 transition-all cursor-pointer space-y-3 group"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#B91B1C] text-white flex items-center justify-center shadow-xs">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#18181B] group-hover:text-[#B91B1C] transition-colors">{tr("Luyện Nghe HSK {0} (听力)", { 0: selectedLevel })}</h3>
              <p className="text-xs text-[#5F6368] mt-1 leading-relaxed">{tr("Luyện phản xạ nghe hội thoại 2-4 lượt, nhận diện từ khóa và bẫy phát âm.")}</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-[#B91B1C]">
              <span>{tr("Làm bài nghe ngay")}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div
            onClick={() => startSkill('reading')}
            className="p-5 rounded-2xl bg-[#F7F7F9] hover:bg-[#EBF7F0] border border-[#E7E7EA] hover:border-[#188A5A]/40 transition-all cursor-pointer space-y-3 group"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#188A5A] text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#18181B] group-hover:text-[#188A5A] transition-colors">{tr("Luyện Đọc hiểu HSK {0} (阅读)", { 0: selectedLevel })}</h3>
              <p className="text-xs text-[#5F6368] mt-1 leading-relaxed">{tr("Đọc hiểu nhanh đoạn văn, ghép câu đối thoại và điền từ vào chỗ trống.")}</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-[#188A5A]">
              <span>{tr("Làm bài đọc ngay")}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div
            onClick={() => startSkill('writing')}
            className="p-5 rounded-2xl bg-[#F7F7F9] hover:bg-[#EEF2FF] border border-[#E7E7EA] hover:border-[#2563EB]/40 transition-all cursor-pointer space-y-3 group"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shadow-xs">
              <PenLine className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#18181B] group-hover:text-[#2563EB] transition-colors">{tr("Luyện Viết & Sắp xếp câu (书写)")}</h3>
              <p className="text-xs text-[#5F6368] mt-1 leading-relaxed">{tr("Tương tác kéo thả cụm từ, làm chủ trật tự câu chữ 把, câu so sánh 比.")}</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-[#2563EB]">
              <span>{tr("Làm bài viết ngay")}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </section>
      <section className="bg-white rounded-3xl border border-[#E7E7EA] p-6 space-y-4">
        <h2 className="text-base font-black text-[#18181B]">Lịch sử thi của bạn</h2>
        {historyError && <p role="alert" className="text-sm text-[#5F6368]">{historyError}</p>}
        {!history && !historyError && <p role="status" className="text-sm">Đang tải lịch sử…</p>}
        {history?.items.length === 0 && <p className="text-sm text-[#5F6368]">Bạn chưa nộp bài thi nào.</p>}
        {history?.items.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 py-3 text-sm">
          <button className="font-bold underline" onClick={() => {
            fetchExamAttempt(item.id).then(result => {
              setSubmission(result);
              try { localStorage.setItem(examStorageKeys().lastResultKey, result.id); } catch {}
            }).catch(error => setHistoryError(error instanceof Error ? error.message : 'Chưa tải được bài làm.'));
          }}>{item.examCode} · HSK {item.level}</button>
          <span>{new Date(item.submittedAt).toLocaleString(locale)}</span>
          <span className={item.isPassed ? 'text-emerald-700' : 'text-rose-700'}>{item.score}/{item.totalScore} · {item.isPassed ? 'Đạt' : 'Chưa đạt'}</span>
        </div>)}
        {history && history.total > history.limit && <div className="flex items-center gap-4 text-sm">
          <button disabled={historyPage === 1} onClick={() => setHistoryPage(page => page - 1)}>Trang trước</button>
          <span>{historyPage} / {Math.ceil(history.total / history.limit)}</span>
          <button disabled={historyPage * history.limit >= history.total} onClick={() => setHistoryPage(page => page + 1)}>Trang sau</button>
        </div>}
      </section>
    </div>
  );
}

export function LeaderboardPage(props: LeaderboardViewProps) {
  return <LeaderboardView {...props} />;
}

export function CommunityPage() {
  const { tr, ui } = useI18n();
  const features = [
    { icon: '💬', title: 'Diễn đàn hỏi đáp', desc: 'Đặt câu hỏi về bài tập, nhận phản hồi từ cộng đồng và giáo viên' },
    { icon: '🎤', title: 'Luyện nói 1-1', desc: 'Kết nối với học viên khác qua video call ngắn để luyện tiếng Trung thực tế' },
    { icon: '📚', title: 'Chia sẻ ghi chú', desc: 'Đăng và download ghi chú từ vựng, mẹo học của cộng đồng' },
    { icon: '🏆', title: 'Thử thách nhóm', desc: 'Tham gia các thử thách học tập hàng tuần, thi đua cùng bạn bè' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl overflow-hidden border border-[#E7E7EA]">
        <div className="bg-gradient-to-br from-[#B91B1C] to-[#7F1D1D] p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-white/20 border border-white/30 mb-4">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white" style={{ fontFamily: 'Fraunces, serif' }}>{tr("Cộng Đồng HanFlix")}</h2>
          <p className="text-white/80 text-sm mt-2 max-w-md mx-auto">{tr("Kết nối với hàng nghìn người học tiếng Trung. Hỏi đáp, luyện nói và thi đua cùng nhau.")}</p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 text-white text-xs font-bold border border-white/30">
            <Calendar className="w-3.5 h-3.5" />{tr("Sắp ra mắt · Q1 2027")}</div>
        </div>

        <div className="p-6">
          <p className="text-center text-sm text-[#5F6368] mb-5">{tr("Tính năng đang được phát triển. Đây là những gì đang đến:")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((f, i) => (
              <div key={i} className="p-4 rounded-2xl bg-[#F7F7F9] border border-[#E7E7EA] flex gap-3">
                <span className="text-2xl shrink-0">{f.icon}</span>
                <div>
                  <div className="font-bold text-sm text-[#18181B]">{ui(f.title)}</div>
                  <div className="text-xs text-[#5F6368] mt-0.5 leading-relaxed">{ui(f.desc)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 border border-[#E7E7EA] flex flex-col sm:flex-row items-center gap-4">
        <Star className="w-8 h-8 text-[#E7A92F] fill-[#E7A92F] shrink-0" />
        <div className="flex-1 text-center sm:text-left">
          <div className="font-bold text-[#18181B] text-sm">{tr("Đăng ký nhận thông báo sớm")}</div>
          <div className="text-xs text-[#5F6368] mt-0.5">{tr("Bạn sẽ là người đầu tiên trải nghiệm khi cộng đồng ra mắt.")}</div>
        </div>
        <button className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#B91B1C] text-white font-bold text-sm hover:bg-[#A3181A] transition-colors shrink-0 cursor-pointer">{tr("Nhận thông báo")}</button>
      </div>

    </div>
  );
}

export function SettingsPage() {
  const { tr } = useI18n();
  return (
    <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA] space-y-6">
      <h2 className="text-2xl font-extrabold text-[#18181B]">{tr("Cài Đặt Tài Khoản")}</h2>
      <div className="space-y-4 max-w-xl">
        <div className="p-4 rounded-2xl bg-[#F7F7F9] border border-[#E7E7EA]">
          <label className="text-xs font-bold text-[#18181B]">{tr("Họ và tên")}</label>
          <input type="text" defaultValue="Nguyễn Minh Anh" className="w-full mt-1.5 p-2.5 rounded-xl border border-[#E7E7EA] bg-white text-sm" />
        </div>
        <div className="p-4 rounded-2xl bg-[#F7F7F9] border border-[#E7E7EA]">
          <label className="text-xs font-bold text-[#18181B]">{tr("Tự động phát phụ đề Pinyin")}</label>
          <input type="checkbox" defaultChecked className="mt-2 ml-2 scale-125" />
        </div>
      </div>
    </div>
  );
}
