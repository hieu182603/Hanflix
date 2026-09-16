import React, { useState } from 'react';
import { X, Zap, Volume2, CheckCircle2, XCircle, RotateCcw, Sparkles, ArrowRight, BookOpen } from 'lucide-react';

interface PracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUIZ_QUESTIONS = [
  {
    id: 'q1',
    question: "Dịch câu sau sang tiếng Trung: 'Phục vụ ơi, cho tôi gọi món.'",
    options: [
      "服务员，我们要点菜。(Fúwùyuán, wǒmen yào diǎn cài.)",
      "服务员，我要买单。(Fúwùyuán, wǒ yào mǎidān.)",
      "服务员，洗手间在哪里？(Fúwùyuán, xǐshǒujiān zài nǎlǐ?)",
      "服务员，请换一张桌子。(Fúwùyuán, qǐng huàn yì zhāng zhuōzi.)",
    ],
    correctIndex: 0,
    explanation: '"点菜 (diǎn cài)" có nghĩa là "gọi món". Đây là cách nói lịch sự nhất để kêu phục vụ vào gọi món tại nhà hàng.',
  },
  {
    id: 'q2',
    question: "Từ vựng nào có nghĩa là 'Đặt phòng trước'?",
    options: [
      "预订 (yùdìng)",
      "入住 (rùzhù)",
      "押金 (yājīn)",
      "退房 (tuìfáng)",
    ],
    correctIndex: 0,
    explanation: '"预订 (yùdìng)" nghĩa là đặt trước. "入住" là nhận phòng, "押金" là tiền cọc, "退房" là trả phòng.',
  },
];

export default function PracticeModal({ isOpen, onClose }: PracticeModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(QUIZ_QUESTIONS.length).fill(null));
  const [showResult, setShowResult] = useState(false);

  if (!isOpen) return null;

  const currentQ = QUIZ_QUESTIONS[currentStep];
  const isAnswered = selectedAnswer !== null;
  const isCorrect = selectedAnswer === currentQ.correctIndex;

  const handleSelectAnswer = (idx: number) => {
    if (selectedAnswer !== null) return; // lock after first selection
    const newAnswers = [...answers];
    newAnswers[currentStep] = idx;
    setAnswers(newAnswers);
    setSelectedAnswer(idx);
  };

  const handleNext = () => {
    if (currentStep < QUIZ_QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
      setSelectedAnswer(answers[currentStep + 1]);
    } else {
      setShowResult(true);
    }
  };

  const handleRetry = () => {
    setCurrentStep(0);
    setSelectedAnswer(null);
    setAnswers(Array(QUIZ_QUESTIONS.length).fill(null));
    setShowResult(false);
  };

  const correctCount = answers.filter((a, i) => a === QUIZ_QUESTIONS[i].correctIndex).length;
  const totalScore = (correctCount / QUIZ_QUESTIONS.length) * 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Phiên luyện tập"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-[#E7E7EA] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E7E7EA] bg-[#B91B1C] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Zap className="w-5 h-5" style={{ fill: 'white' }} />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Bài tập sau bài học</h3>
              <p className="text-xs text-white/80">HSK 3 - Gọi món ở nhà hàng</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-full hover:bg-white/20 text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Result screen */}
        {showResult ? (
          <div className="p-8 flex-1 overflow-y-auto">
            <div className="text-center mb-8">
              <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${
                correctCount === QUIZ_QUESTIONS.length ? 'bg-[#E4F6ED]' : 'bg-[#FDF1F1]'
              }`}>
                {correctCount === QUIZ_QUESTIONS.length
                  ? <CheckCircle2 className="w-8 h-8 text-[#188A5A]" />
                  : <Sparkles className="w-8 h-8 text-[#B91B1C]" />
                }
              </div>
              <h2 className="text-2xl font-black text-[#18181B] mb-2">
                {correctCount === QUIZ_QUESTIONS.length ? 'Xuất sắc!' : 'Hoàn thành bài tập'}
              </h2>
              <p className="text-sm text-[#5F6368]">
                {correctCount}/{QUIZ_QUESTIONS.length} câu đúng ({Math.round(totalScore)}%)
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <h3 className="font-bold text-sm text-[#18181B]">Giải thích từng câu</h3>
              {QUIZ_QUESTIONS.map((q, i) => {
                const userAnswer = answers[i];
                const correct = userAnswer === q.correctIndex;
                return (
                  <div key={q.id} className={`rounded-2xl p-4 border ${correct ? 'border-[#188A5A]/30 bg-[#E4F6ED]/30' : 'border-[#B91B1C]/30 bg-[#FDF1F1]/30'}`}>
                    <div className="flex items-start gap-2 mb-2">
                      {correct
                        ? <CheckCircle2 className="w-4 h-4 text-[#188A5A] shrink-0 mt-0.5" />
                        : <XCircle className="w-4 h-4 text-[#B91B1C] shrink-0 mt-0.5" />
                      }
                      <p className="text-xs font-semibold text-[#18181B]">{q.question}</p>
                    </div>
                    {!correct && userAnswer !== null && (
                      <p className="text-xs text-[#B91B1C] ml-6 mb-1">
                        Bạn chọn: {q.options[userAnswer]}
                      </p>
                    )}
                    <p className="text-xs text-[#188A5A] font-semibold ml-6 mb-2">
                      Đáp án đúng: {q.options[q.correctIndex]}
                    </p>
                    <p className="text-xs text-[#5F6368] ml-6 leading-relaxed">{q.explanation}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="flex-1 h-11 rounded-xl border border-[#E7E7EA] text-sm font-bold text-[#5F6368] hover:bg-[#F7F7F9] flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Làm lại
              </button>
              <button
                onClick={onClose}
                className="flex-1 h-11 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-sm font-bold flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                Về bảng tin
              </button>
            </div>
          </div>
        ) : (
          /* Quiz content */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 flex-1 overflow-y-auto space-y-5">
              <div className="flex items-center justify-between text-xs font-semibold text-[#8B9097]">
                <span>Câu {currentStep + 1}/{QUIZ_QUESTIONS.length}</span>
                <div className="flex gap-1">
                  {QUIZ_QUESTIONS.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i === currentStep ? 'bg-[#B91B1C]' : i < currentStep ? 'bg-[#188A5A]' : 'bg-[#E7E7EA]'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#FDF1F1] border border-[#B91B1C]/20 text-[#18181B] font-bold text-sm leading-relaxed">
                {currentQ.question}
              </div>

              <div className="space-y-2.5">
                {currentQ.options.map((opt, idx) => {
                  const isSelected = selectedAnswer === idx;
                  const correct = idx === currentQ.correctIndex;
                  let btnStyle = 'bg-[#F7F7F9] text-[#18181B] border-[#E7E7EA] hover:border-[#B91B1C] cursor-pointer';

                  if (isAnswered) {
                    if (isSelected && correct) {
                      btnStyle = 'bg-[#E4F6ED] text-[#188A5A] border-[#188A5A] font-bold cursor-default';
                    } else if (isSelected && !correct) {
                      btnStyle = 'bg-[#FDF1F1] text-[#B91B1C] border-[#B91B1C] font-bold cursor-default';
                    } else if (correct) {
                      btnStyle = 'bg-[#E4F6ED] text-[#188A5A] border-[#188A5A] font-bold cursor-default';
                    } else {
                      btnStyle = 'bg-[#F7F7F9] text-[#8B9097] border-[#E7E7EA] cursor-default opacity-60';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectAnswer(idx)}
                      disabled={isAnswered}
                      className={`w-full p-3.5 rounded-2xl border text-left text-xs md:text-sm transition-all flex items-center justify-between ${btnStyle}`}
                    >
                      <span>{opt}</span>
                      {isAnswered && correct && <CheckCircle2 className="w-4 h-4 text-[#188A5A] shrink-0" />}
                      {isAnswered && isSelected && !correct && <XCircle className="w-4 h-4 text-[#B91B1C] shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {isAnswered && (
                <div className={`p-3.5 rounded-xl text-xs leading-relaxed ${isCorrect ? 'bg-[#E4F6ED] text-[#188A5A]' : 'bg-[#FDF1F1] text-[#B91B1C]'}`}>
                  <span className="font-bold">{isCorrect ? 'Chính xác! ' : 'Chưa đúng. '}</span>
                  {currentQ.explanation}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-[#E7E7EA] bg-white flex justify-between items-center shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#5F6368] hover:bg-[#F7F7F9]"
              >
                Thoát
              </button>
              <button
                onClick={handleNext}
                disabled={!isAnswered}
                className="px-6 py-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2"
              >
                {currentStep < QUIZ_QUESTIONS.length - 1 ? 'Câu tiếp theo' : 'Xem kết quả'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
