import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Volume2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  BookOpenCheck,
  Trophy,
  Award,
  Check,
  HelpCircle,
  Flame,
  ChevronRight,
} from 'lucide-react';
import type { PublicQuestion, QuizResult } from '../../api/learning';

export interface LessonQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonTitle: string;
  hskLevel?: number;
  quiz: PublicQuestion[];
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  quizResult: QuizResult | null;
  quizBusy: boolean;
  onSubmitQuiz: () => Promise<void>;
  bestScore?: number | null;
  onRetry: () => void;
}

export default function LessonQuizModal({
  isOpen,
  onClose,
  lessonTitle,
  hskLevel,
  quiz,
  answers,
  setAnswers,
  quizResult,
  quizBusy,
  onSubmitQuiz,
  bestScore,
  onRetry,
}: LessonQuizModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'correct' | 'wrong'>('all');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Sync index if questions change
  useEffect(() => {
    if (currentIndex >= quiz.length && quiz.length > 0) {
      setCurrentIndex(quiz.length - 1);
    }
  }, [quiz.length, currentIndex]);

  // Reset to first question when modal opens fresh without result
  useEffect(() => {
    if (isOpen && !quizResult) {
      setCurrentIndex(0);
      setValidationMsg(null);
    }
  }, [isOpen, quizResult]);

  // Speech pronunciation for question prompt
  const speakPrompt = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(true);
    // Extract Hanzi / Chinese parts
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.85;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const currentQuestion = quiz[currentIndex];
  const totalQuestions = quiz.length;
  const currentAnswer = currentQuestion ? answers[currentQuestion.questionId] : undefined;
  const isCurrentAnswered = Boolean(currentAnswer && currentAnswer.trim().length > 0);
  const isLastQuestion = currentIndex === totalQuestions - 1;

  // Count answered questions
  const answeredCount = quiz.filter((q) => answers[q.questionId]?.trim()).length;
  const progressPercent = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  // Handle select option
  const handleSelectOption = (optionId: string) => {
    if (quizResult || !currentQuestion) return;
    setValidationMsg(null);
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.questionId]: optionId,
    }));
  };

  // Move to next question
  const handleNext = () => {
    setValidationMsg(null);
    if (!isCurrentAnswered) {
      setValidationMsg('Vui lòng chọn hoặc nhập đáp án trước khi chuyển câu.');
      return;
    }
    if (currentIndex < totalQuestions - 1) {
      setDirection(1);
      setCurrentIndex((prev) => prev + 1);
    }
  };

  // Move to previous question
  const handlePrev = () => {
    setValidationMsg(null);
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Submit action
  const handleFinalSubmit = async () => {
    setValidationMsg(null);
    // Check if any question remains unanswered
    const unansweredIdx = quiz.findIndex((q) => !answers[q.questionId]?.trim());
    if (unansweredIdx !== -1) {
      setCurrentIndex(unansweredIdx);
      setValidationMsg(`Bạn chưa trả lời Câu ${unansweredIdx + 1}. Hãy hoàn thành để nộp bài.`);
      return;
    }
    await onSubmitQuiz();
  };

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Only handle quiz shortcuts when not in results view
      if (!quizResult && currentQuestion && currentQuestion.type === 'multiple_choice') {
        const keyMap: Record<string, number> = {
          '1': 0,
          a: 0,
          A: 0,
          '2': 1,
          b: 1,
          B: 1,
          '3': 2,
          c: 2,
          C: 2,
          '4': 3,
          d: 3,
          D: 3,
        };

        if (keyMap[e.key] !== undefined) {
          const opt = currentQuestion.options[keyMap[e.key]];
          if (opt) {
            handleSelectOption(opt.optionId);
          }
        } else if (e.key === 'Enter') {
          if (isLastQuestion) {
            void handleFinalSubmit();
          } else {
            handleNext();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, quizResult, currentQuestion, isLastQuestion, isCurrentAnswered]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-[#E7E7EA] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= MODAL HEADER ================= */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-[#E7E7EA] bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#FDF1F1] border border-[#F5B8B9] flex items-center justify-center text-[#B91B1C] shrink-0">
                <BookOpenCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-black text-base sm:text-lg text-[#18181B] truncate">
                    Bài luyện tập sau video
                  </h2>
                  {hskLevel && (
                    <span className="px-2 py-0.5 rounded-md bg-[#18181B] text-white text-[10px] font-extrabold shrink-0">
                      HSK {hskLevel}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#5F6368] truncate">{lessonTitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {bestScore !== null && bestScore !== undefined && (
                <div className="hidden sm:flex items-center gap-1 px-3 py-1 rounded-full bg-[#EBF5EE] text-[#1E7E44] text-xs font-bold border border-[#A4D8B6]">
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Kỷ lục: {bestScore}%</span>
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full hover:bg-neutral-100 flex items-center justify-center text-[#5F6368] hover:text-[#18181B] transition-colors cursor-pointer"
                title="Đóng (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Stepper Progress Bar (Only during active quiz) */}
          {!quizResult && totalQuestions > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-1.5 text-[#18181B]">
                  <span className="w-2 h-2 rounded-full bg-[#B91B1C] animate-pulse" />
                  <span>
                    Câu hỏi <strong className="text-[#B91B1C]">{currentIndex + 1}</strong> / {totalQuestions}
                  </span>
                </div>
                <span className="text-[#5F6368] font-mono">
                  {answeredCount}/{totalQuestions} đã trả lời
                </span>
              </div>

              {/* Progress Line */}
              <div className="relative w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#B91B1C] to-[#E02424] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Question Clickable Dots */}
              <div className="flex items-center justify-center gap-1.5 pt-1">
                {quiz.map((q, idx) => {
                  const isAnswered = Boolean(answers[q.questionId]?.trim());
                  const isCurrent = idx === currentIndex;
                  return (
                    <button
                      key={q.questionId}
                      type="button"
                      onClick={() => {
                        setDirection(idx > currentIndex ? 1 : -1);
                        setCurrentIndex(idx);
                        setValidationMsg(null);
                      }}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        isCurrent
                          ? 'w-6 bg-[#B91B1C]'
                          : isAnswered
                          ? 'w-2.5 bg-emerald-500 hover:bg-emerald-600'
                          : 'w-2 bg-neutral-200 hover:bg-neutral-300'
                      }`}
                      title={`Đến câu ${idx + 1}`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ================= MODAL BODY ================= */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {/* 1. RESULTS SCREEN */}
          {quizResult ? (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              {/* Score Showcase Hero */}
              <div
                className={`p-6 rounded-3xl text-center border relative overflow-hidden ${
                  quizResult.score >= 80
                    ? 'bg-gradient-to-b from-[#EBF5EE] to-[#D9F0E0] border-[#A4D8B6]'
                    : quizResult.score >= 50
                    ? 'bg-gradient-to-b from-[#FEF8ED] to-[#FCEECB] border-[#F9D67A]'
                    : 'bg-gradient-to-b from-[#FDF1F1] to-[#FAE4E4] border-[#F5B8B9]'
                }`}
              >
                <div className="inline-flex p-3.5 rounded-2xl bg-white shadow-md mb-3">
                  {quizResult.score >= 80 ? (
                    <Trophy className="w-10 h-10 text-emerald-600" />
                  ) : quizResult.score >= 50 ? (
                    <Award className="w-10 h-10 text-amber-500" />
                  ) : (
                    <Sparkles className="w-10 h-10 text-[#B91B1C]" />
                  )}
                </div>

                <h3 className="font-black text-xl sm:text-2xl text-[#18181B]">
                  {quizResult.score === 100
                    ? '🎉 Xuất sắc! 100% Tuyệt đối!'
                    : quizResult.score >= 80
                    ? '👏 Rất tốt! Bạn nắm rất vững bài học!'
                    : quizResult.score >= 50
                    ? '👍 Hoàn thành! Khá tốt!'
                    : '💪 Hãy ôn tập lại một chút nhé!'}
                </h3>

                <p className="text-sm font-medium text-[#5F6368] mt-1">
                  Đúng{' '}
                  <strong className="text-[#18181B]">
                    {quizResult.correctCount} / {quizResult.totalCount} câu hỏi
                  </strong>{' '}
                  ({quizResult.score}%)
                </p>

                {/* Score Pill Row */}
                <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                  <span className="px-3.5 py-1.5 rounded-full bg-white/90 font-mono font-black text-sm text-[#18181B] shadow-2xs border border-black/5">
                    Điểm: {quizResult.score}%
                  </span>
                  <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 font-black text-xs shadow-2xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 fill-amber-950" />
                    +{quizResult.xpEarned || (quizResult.score === 100 ? 50 : quizResult.score >= 80 ? 40 : 25)} XP Đấu Trường
                  </span>
                  {bestScore !== null && bestScore !== undefined && quizResult.score > bestScore && (
                    <span className="px-3.5 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-2xs flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5" />
                      Kỷ lục mới!
                    </span>
                  )}
                </div>
              </div>

              {/* Review Filter Tabs */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#E7E7EA] pb-3">
                  <h4 className="font-extrabold text-sm sm:text-base text-[#18181B] flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-[#B91B1C]" />
                    <span>Chi tiết đáp án & giải thích</span>
                  </h4>

                  <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setReviewFilter('all')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        reviewFilter === 'all'
                          ? 'bg-white text-[#18181B] shadow-2xs'
                          : 'text-[#5F6368] hover:text-[#18181B]'
                      }`}
                    >
                      Tất cả ({quiz.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewFilter('correct')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        reviewFilter === 'correct'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      Đúng ({quizResult.correctCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewFilter('wrong')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        reviewFilter === 'wrong'
                          ? 'bg-[#B91B1C] text-white shadow-2xs'
                          : 'text-[#B91B1C] hover:bg-red-50'
                      }`}
                    >
                      Sai ({quizResult.totalCount - quizResult.correctCount})
                    </button>
                  </div>
                </div>

                {/* Question Review Cards */}
                <div className="space-y-4">
                  {quiz.map((q, idx) => {
                    const ansResult = quizResult.answers[idx];
                    const isCorrect = ansResult?.correct;
                    const selectedId = answers[q.questionId];
                    const selectedOpt = q.options?.find((o) => o.optionId === selectedId);

                    if (reviewFilter === 'correct' && !isCorrect) return null;
                    if (reviewFilter === 'wrong' && isCorrect) return null;

                    return (
                      <div
                        key={q.questionId}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          isCorrect
                            ? 'bg-[#F9FDFB] border-[#A4D8B6]'
                            : 'bg-[#FFFBFB] border-[#F5B8B9]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                isCorrect
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-[#B91B1C] text-white'
                              }`}
                            >
                              {isCorrect ? '✓' : '✕'}
                            </span>
                            <span className="font-extrabold text-xs text-[#5F6368]">
                              Câu {idx + 1}
                            </span>
                          </div>

                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              isCorrect
                                ? 'bg-[#EBF5EE] text-[#1E7E44]'
                                : 'bg-[#FDF1F1] text-[#B91B1C]'
                            }`}
                          >
                            {isCorrect ? 'Chính xác' : 'Chưa đúng'}
                          </span>
                        </div>

                        <p className="font-bold text-sm sm:text-base text-[#18181B] mb-3">
                          {q.prompt}
                        </p>

                        {/* Selected Answer Review */}
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-start gap-2 text-neutral-700">
                            <span className="font-bold text-[#5F6368] shrink-0">Bạn chọn:</span>
                            <span
                              className={`font-semibold ${
                                isCorrect ? 'text-emerald-700' : 'text-[#B91B1C] line-through'
                              }`}
                            >
                              {selectedOpt?.text ?? selectedId ?? '(Chưa chọn)'}
                            </span>
                          </div>

                          {/* Explanation Card */}
                          {ansResult?.explanationVi && (
                            <div className="mt-3 p-3 rounded-xl bg-white border border-[#E7E7EA] space-y-1 text-xs">
                              <p className="font-bold text-[#18181B] flex items-center gap-1.5 text-[11px]">
                                <span>💡 Giải thích chi tiết:</span>
                              </p>
                              <p className="text-[#374151] leading-relaxed">
                                {ansResult.explanationVi}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* 2. ACTIVE STEP QUESTION SCREEN (1 QUESTION AT A TIME) */
            <div className="min-h-[280px] flex flex-col justify-between">
              {validationMsg && (
                <div className="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>{validationMsg}</span>
                </div>
              )}

              {currentQuestion ? (
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={currentQuestion.questionId}
                    custom={direction}
                    initial={{ opacity: 0, x: direction * 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -direction * 40 }}
                    transition={{ duration: 0.22 }}
                    className="space-y-5"
                  >
                    {/* Question Header & Prompt */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 rounded-full bg-neutral-100 text-[#5F6368] text-xs font-extrabold uppercase tracking-wider">
                          {currentQuestion.type === 'multiple_choice'
                            ? 'Chọn đáp án đúng'
                            : 'Điền vào chỗ trống'}
                        </span>

                        <button
                          type="button"
                          onClick={() => speakPrompt(currentQuestion.prompt)}
                          className={`p-2 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                            isSpeaking
                              ? 'bg-[#B91B1C] text-white border-[#B91B1C]'
                              : 'bg-white hover:bg-neutral-50 text-[#5F6368] hover:text-[#18181B] border-[#E7E7EA]'
                          }`}
                          title="Nghe phát âm câu hỏi"
                        >
                          <Volume2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Phát âm</span>
                        </button>
                      </div>

                      <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F7F9] border border-[#E7E7EA]">
                        <h3 className="font-black text-base sm:text-lg text-[#18181B] leading-relaxed">
                          {currentQuestion.prompt}
                        </h3>
                      </div>
                    </div>

                    {/* Question Choices (Multiple Choice) */}
                    {currentQuestion.type === 'multiple_choice' ? (
                      <div className="grid gap-2.5">
                        {currentQuestion.options.map((option, optIdx) => {
                          const isSelected = currentAnswer === option.optionId;
                          const letter = String.fromCharCode(65 + optIdx); // A, B, C, D

                          return (
                            <button
                              key={option.optionId}
                              type="button"
                              onClick={() => handleSelectOption(option.optionId)}
                              className={`w-full flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer group ${
                                isSelected
                                  ? 'bg-[#FFF5F5] border-[#B91B1C] ring-2 ring-[#B91B1C]/25 shadow-xs'
                                  : 'bg-white border-[#E7E7EA] hover:border-neutral-300 hover:bg-neutral-50/70'
                              }`}
                            >
                              {/* Option Letter Badge */}
                              <span
                                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                                  isSelected
                                    ? 'bg-[#B91B1C] text-white shadow-xs'
                                    : 'bg-neutral-100 text-[#5F6368] group-hover:bg-[#FEE2E2] group-hover:text-[#B91B1C]'
                                }`}
                              >
                                {letter}
                              </span>

                              {/* Option Text */}
                              <span
                                className={`flex-1 text-sm sm:text-base font-medium transition-colors ${
                                  isSelected
                                    ? 'font-bold text-[#18181B]'
                                    : 'text-[#374151] group-hover:text-[#18181B]'
                                }`}
                              >
                                {option.text}
                              </span>

                              {/* Selection Indicator */}
                              <div
                                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                                  isSelected
                                    ? 'border-[#B91B1C] bg-[#B91B1C] text-white'
                                    : 'border-[#D1D5DB] group-hover:border-[#9CA3AF]'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      /* Fill Blank Input */
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={currentAnswer ?? ''}
                          autoFocus
                          onChange={(e) => {
                            setValidationMsg(null);
                            setAnswers((prev) => ({
                              ...prev,
                              [currentQuestion.questionId]: e.target.value,
                            }));
                          }}
                          placeholder="Nhập câu trả lời bằng chữ Hán hoặc Pinyin…"
                          className="w-full rounded-2xl border-2 border-[#E7E7EA] bg-white p-4 text-base font-semibold text-[#18181B] focus:border-[#B91B1C] focus:ring-2 focus:ring-[#B91B1C]/20 outline-none transition-all shadow-2xs"
                        />
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="p-8 text-center text-[#5F6368] text-sm">
                  Không có câu hỏi nào trong bài luyện tập này.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= MODAL FOOTER ACTIONS ================= */}
        <div className="px-5 sm:px-6 py-4 border-t border-[#E7E7EA] bg-white sticky bottom-0 z-10">
          {quizResult ? (
            /* Results View Actions */
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  onRetry();
                  setCurrentIndex(0);
                  setValidationMsg(null);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-[#E7E7EA] hover:bg-neutral-50 text-xs sm:text-sm font-bold text-[#18181B] transition-all cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-4 h-4 text-[#5F6368]" />
                <span>Làm lại bài</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-[#18181B] hover:bg-neutral-800 text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
              >
                <span>Đóng & Tiếp tục học</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Active Quiz Step Actions */
            <div className="flex items-center justify-between gap-3">
              {/* Previous Button */}
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-[#5F6368] hover:text-[#18181B] hover:bg-neutral-100"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Câu trước</span>
              </button>

              {/* Next or Submit Button */}
              {isLastQuestion ? (
                <button
                  type="button"
                  disabled={quizBusy}
                  onClick={() => void handleFinalSubmit()}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs sm:text-sm font-black shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {quizBusy ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang chấm điểm…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Nộp bài & Xem kết quả</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer ${
                    isCurrentAnswered
                      ? 'bg-[#B91B1C] hover:bg-[#A3181A] text-white'
                      : 'bg-neutral-200 text-neutral-500 hover:bg-neutral-300'
                  }`}
                >
                  <span>Câu tiếp theo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
