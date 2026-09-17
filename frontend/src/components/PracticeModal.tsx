import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Volume2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  RotateCw,
  Star,
  Shuffle,
  Layers,
  HelpCircle,
  Flame,
  Check,
} from 'lucide-react';
import { recordLearningActivity } from '../lib/streak';
import BurningFlame from './streak/BurningFlame';

interface PracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'quiz' | 'flashcards';
}

interface QuizOption {
  text: string;
  pinyin: string;
  vi: string;
}

interface QuizItem {
  id: string;
  category: string;
  question: string;
  hanziPrompt?: string;
  options: QuizOption[];
  correctIndex: number;
  explanation: string;
}

interface PracticeFlashcard {
  id: string;
  hanzi: string;
  pinyin: string;
  meaningVi: string;
  partOfSpeech: string;
  hskLevel: number;
  exampleZh: string;
  examplePinyin: string;
  exampleVi: string;
}

const QUIZ_QUESTIONS: QuizItem[] = [
  {
    id: 'q1',
    category: 'HSK 3 • Dịch câu phản xạ',
    question: "Dịch câu sau sang tiếng Trung: 'Phục vụ ơi, cho tôi gọi món.'",
    hanziPrompt: "Phục vụ ơi, cho tôi gọi món.",
    options: [
      {
        text: '服务员，我们要点菜。',
        pinyin: 'Fúwùyuán, wǒmen yào diǎn cài.',
        vi: 'Phục vụ ơi, chúng tôi muốn gọi món.',
      },
      {
        text: '服务员，我要买单。',
        pinyin: 'Fúwùyuán, wǒ yào mǎidān.',
        vi: 'Phục vụ ơi, tôi muốn tính tiền.',
      },
      {
        text: '服务员，洗手间在哪里？',
        pinyin: 'Fúwùyuán, xǐshǒujiān zài nǎlǐ?',
        vi: 'Phục vụ ơi, nhà vệ sinh ở đâu?',
      },
      {
        text: '服务员，请换一张桌子。',
        pinyin: 'Fúwùyuán, qǐng huàn yì zhāng zhuōzi.',
        vi: 'Phục vụ ơi, xin đổi một chiếc bàn khác.',
      },
    ],
    correctIndex: 0,
    explanation:
      '"点菜 (diǎn cài)" có nghĩa là "gọi món / chọn món". Đây là cách nói tự nhiên và lịch sự nhất khi gọi phục vụ vào ghi thực đơn tại nhà hàng Trung Quốc.',
  },
  {
    id: 'q2',
    category: 'HSK 3 • Từ vựng khách sạn & nhà hàng',
    question: "Từ vựng nào sau đây mang ý nghĩa là 'Đặt phòng / Đặt bàn trước'?",
    hanziPrompt: 'Đặt phòng / Đặt bàn trước',
    options: [
      {
        text: '预订',
        pinyin: 'yùdìng',
        vi: 'Đặt trước (bàn, phòng, vé)',
      },
      {
        text: '入住',
        pinyin: 'rùzhù',
        vi: 'Làm thủ tục nhận phòng',
      },
      {
        text: '押金',
        pinyin: 'yājīn',
        vi: 'Tiền đặt cọc / Thế chân',
      },
      {
        text: '退房',
        pinyin: 'tuìfáng',
        vi: 'Trả phòng khách sạn',
      },
    ],
    correctIndex: 0,
    explanation:
      '"预订 (yùdìng)" nghĩa là đặt trước. "入住 (rùzhù)" là nhận phòng, "押金 (yājīn)" là tiền cọc, và "退房 (tuìfáng)" là trả phòng.',
  },
  {
    id: 'q3',
    category: 'Khẩu ngữ • Khẩu vị ăn uống',
    question: "Khi dặn dò đầu bếp 'Làm ít cay thôi / Cay nhẹ', bạn dùng cách nói nào?",
    hanziPrompt: 'Làm món này ít cay thôi',
    options: [
      {
        text: '这个菜请做微辣。',
        pinyin: 'Zhè ge cài qǐng zuò wēilà.',
        vi: 'Món này xin làm cay nhẹ thôi nhé.',
      },
      {
        text: '请多放一点辣椒。',
        pinyin: 'Qǐng duō fàng yìdiǎn làjiāo.',
        vi: 'Xin hãy cho thêm nhiều ớt vào.',
      },
      {
        text: '我不吃任何香菜。',
        pinyin: 'Wǒ bù chī rènhé xiāngcài.',
        vi: 'Tôi không ăn bất kỳ loại ngò rí nào.',
      },
      {
        text: '请马上给我上菜。',
        pinyin: 'Qǐng mǎshàng gěi wǒ shàng cài.',
        vi: 'Xin hãy lên món cho tôi ngay lập tức.',
      },
    ],
    correctIndex: 0,
    explanation:
      '"微辣 (wēilà)" nghĩa là cay nhẹ / ít cay. Cấu trúc "请做 + mức độ cay" là câu cửa miệng thông dụng của người bản xứ khi dặn khẩu vị.',
  },
  {
    id: 'q4',
    category: 'HSK 3 • Thanh toán hóa đơn',
    question: "Từ vựng nào đồng nghĩa với việc 'Thanh toán / Tính tiền' khi ăn xong?",
    hanziPrompt: 'Tính tiền / Thanh toán hóa đơn',
    options: [
      {
        text: '买单',
        pinyin: 'mǎidān',
        vi: 'Tính tiền / Thanh toán hóa đơn',
      },
      {
        text: '点心',
        pinyin: 'diǎnxin',
        vi: 'Điểm tâm / Đồ ăn nhẹ',
      },
      {
        text: '打包',
        pinyin: 'dǎbāo',
        vi: 'Gói đồ ăn thừa mang về',
      },
      {
        text: '发票',
        pinyin: 'fāpiào',
        vi: 'Hóa đơn tài chính / Thuế',
      },
    ],
    correctIndex: 0,
    explanation:
      '"买单 (mǎidān)" hoặc "结账 (jiézhàng)" là cách gọi tính tiền chuẩn xác nhất. "打包 (dǎbāo)" dùng khi muốn mang thức ăn thừa về.',
  },
];

const PRACTICE_FLASHCARDS: PracticeFlashcard[] = [
  {
    id: 'fc1',
    hanzi: '点菜',
    pinyin: 'diǎn cài',
    meaningVi: 'Gọi món / Chọn món ăn',
    partOfSpeech: 'Động từ',
    hskLevel: 3,
    exampleZh: '服务员，我们要点菜。',
    examplePinyin: 'Fúwùyuán, wǒmen yào diǎn cài.',
    exampleVi: 'Phục vụ ơi, chúng tôi muốn gọi món.',
  },
  {
    id: 'fc2',
    hanzi: '烤鸭',
    pinyin: 'kǎoyā',
    meaningVi: 'Vịt quay Bắc Kinh',
    partOfSpeech: 'Danh từ',
    hskLevel: 3,
    exampleZh: '北京烤鸭外脆里嫩，非常有名。',
    examplePinyin: 'Běijīng kǎoyā wài cuì lǐ nèn, fēicháng yǒumíng.',
    exampleVi: 'Vịt quay Bắc Kinh ngoài giòn trong mềm, rất nổi tiếng.',
  },
  {
    id: 'fc3',
    hanzi: '微辣',
    pinyin: 'wēilà',
    meaningVi: 'Ít cay / Cay nhẹ',
    partOfSpeech: 'Tính từ',
    hskLevel: 3,
    exampleZh: '师傅，这份麻婆豆腐做微辣就好。',
    examplePinyin: 'Shīfu, zhè fèn mápó dòufu zuò wēilà jiù hǎo.',
    exampleVi: 'Đầu bếp ơi, đĩa đậu phụ Ma Bà này làm cay nhẹ thôi nhé.',
  },
  {
    id: 'fc4',
    hanzi: '忌口',
    pinyin: 'jìkǒu',
    meaningVi: 'Kiêng ăn / Dị ứng thực phẩm',
    partOfSpeech: 'Động từ',
    hskLevel: 3,
    exampleZh: '请问各位顾客有什么忌口的吗？',
    examplePinyin: 'Qǐngwèn gèwèi gùkè yǒu shénme jìkǒu de ma?',
    exampleVi: 'Xin hỏi quý khách có kiêng ăn món gì không ạ?',
  },
  {
    id: 'fc5',
    hanzi: '买单',
    pinyin: 'mǎidān',
    meaningVi: 'Tính tiền / Thanh toán',
    partOfSpeech: 'Động từ',
    hskLevel: 3,
    exampleZh: '服务员，我们吃好了，请买单！',
    examplePinyin: 'Fúwùyuán, wǒmen chī hǎo le, qǐng mǎidān!',
    exampleVi: 'Phục vụ ơi, chúng tôi ăn xong rồi, xin tính tiền!',
  },
];

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

export default function PracticeModal({
  isOpen,
  onClose,
  initialMode = 'quiz',
}: PracticeModalProps) {
  // Mode selection: Quizlet Learn (trắc nghiệm) vs Quizlet Flashcards (thẻ ghi nhớ 3D)
  const [activeTab, setActiveTab] = useState<'quiz' | 'flashcards'>(initialMode);

  // --- Quiz State ---
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>(
    Array(QUIZ_QUESTIONS.length).fill(null)
  );
  const [showResult, setShowResult] = useState(false);
  const [streakCount, setStreakCount] = useState(0);

  // --- Flashcard State ---
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [cardsList, setCardsList] = useState<PracticeFlashcard[]>(PRACTICE_FLASHCARDS);

  // TTS speech helper
  const playAudio = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Reset states when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setSelectedAnswer(null);
      setAnswers(Array(QUIZ_QUESTIONS.length).fill(null));
      setShowResult(false);
      setStreakCount(0);
      setFlashcardIndex(0);
      setIsFlipped(false);
    }
  }, [isOpen]);

  const currentQ = QUIZ_QUESTIONS[currentStep];
  const isAnswered = selectedAnswer !== null;
  const isCorrect = isAnswered && selectedAnswer === currentQ.correctIndex;
  const currentCard = cardsList[flashcardIndex % cardsList.length];

  // Answer handler for Quiz
  const handleSelectAnswer = useCallback(
    (idx: number) => {
      if (selectedAnswer !== null) return;
      const newAnswers = [...answers];
      newAnswers[currentStep] = idx;
      setAnswers(newAnswers);
      setSelectedAnswer(idx);

      // Play audio of the selected option
      playAudio(currentQ.options[idx].text);

      if (idx === currentQ.correctIndex) {
        setStreakCount((prev) => prev + 1);
      } else {
        setStreakCount(0);
      }

      // Automatically trigger streak learning activity
      recordLearningActivity('practice');
    },
    [selectedAnswer, answers, currentStep, currentQ, playAudio]
  );

  const handleNextQuestion = useCallback(() => {
    if (currentStep < QUIZ_QUESTIONS.length - 1) {
      setCurrentStep((prev) => prev + 1);
      setSelectedAnswer(answers[currentStep + 1]);
    } else {
      setShowResult(true);
    }
  }, [currentStep, answers]);

  const handleRetryQuiz = () => {
    setCurrentStep(0);
    setSelectedAnswer(null);
    setAnswers(Array(QUIZ_QUESTIONS.length).fill(null));
    setShowResult(false);
    setStreakCount(0);
  };

  // Flashcard controls
  const handleFlipCard = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleNextCard = useCallback(() => {
    setIsFlipped(false);
    setFlashcardIndex((prev) => (prev + 1) % cardsList.length);
    recordLearningActivity('review');
  }, [cardsList.length]);

  const handlePrevCard = useCallback(() => {
    setIsFlipped(false);
    setFlashcardIndex((prev) => (prev - 1 + cardsList.length) % cardsList.length);
  }, [cardsList.length]);

  const handleToggleStar = (cardId: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const handleShuffleCards = () => {
    setIsFlipped(false);
    setCardsList((prev) => [...prev].sort(() => Math.random() - 0.5));
    setFlashcardIndex(0);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (activeTab === 'quiz') {
        if (!showResult) {
          // Keys 1-4 or A-D to select option
          if (!isAnswered) {
            const key = e.key.toUpperCase();
            if (['1', '2', '3', '4'].includes(key)) {
              const idx = parseInt(key, 10) - 1;
              if (idx < currentQ.options.length) handleSelectAnswer(idx);
            } else if (['A', 'B', 'C', 'D'].includes(key)) {
              const idx = OPTION_KEYS.indexOf(key);
              if (idx !== -1 && idx < currentQ.options.length) handleSelectAnswer(idx);
            }
          } else if (e.key === 'Enter') {
            handleNextQuestion();
          }

          // Audio shortcut
          if (e.key.toLowerCase() === 'v' || e.key.toLowerCase() === 's') {
            playAudio(currentQ.options[currentQ.correctIndex].text);
          }
        }
      } else if (activeTab === 'flashcards') {
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          handleFlipCard();
        } else if (e.key === 'ArrowRight') {
          handleNextCard();
        } else if (e.key === 'ArrowLeft') {
          handlePrevCard();
        } else if (e.key.toLowerCase() === 'v' || e.key.toLowerCase() === 's') {
          playAudio(currentCard.hanzi);
        } else if (['1', '2', '3', '4'].includes(e.key)) {
          handleNextCard();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    activeTab,
    showResult,
    isAnswered,
    currentQ,
    currentCard,
    handleSelectAnswer,
    handleNextQuestion,
    handleFlipCard,
    handleNextCard,
    handlePrevCard,
    playAudio,
    onClose,
  ]);

  if (!isOpen) return null;

  const correctCount = answers.filter(
    (a, i) => a === QUIZ_QUESTIONS[i].correctIndex
  ).length;
  const totalScore = Math.round((correctCount / QUIZ_QUESTIONS.length) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Trung tâm luyện tập Quizlet HanFlix"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-3 sm:p-4 overflow-y-auto select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 350, damping: 26 }}
        className="relative bg-[#FFFDF7] w-full max-w-3xl rounded-[2.2rem] overflow-hidden shadow-[0_30px_90px_-20px_rgba(0,0,0,0.35),0_0_0_1px_rgba(231,229,228,0.8)] border border-amber-100/90 flex flex-col max-h-[92vh]"
      >
        {/* Top App Header with Tab Switcher & Progress */}
        <div className="px-5 sm:px-7 py-4 bg-white/90 backdrop-blur-sm border-b border-amber-100/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FFFBEB] via-[#FEF3C7] to-[#FDE68A]/60 border border-amber-200/90 flex items-center justify-center shadow-xs text-amber-700 shrink-0">
              <BurningFlame size={24} showSparks={false} intensity="high" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-neutral-900 tracking-tight">
                  Luyện tập Quizlet
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100/80 text-amber-900 border border-amber-200/60">
                  HSK 3
                </span>
              </div>
              <p className="text-xs text-neutral-500 font-medium">
                Gọi món ở nhà hàng • 在饭馆点菜
              </p>
            </div>
          </div>

          {/* Mode Switcher Pill Tabs (Trắc nghiệm vs Flashcard 3D) */}
          <div className="flex items-center gap-1.5 bg-neutral-100/90 p-1 rounded-2xl border border-neutral-200/60">
            <button
              type="button"
              onClick={() => setActiveTab('quiz')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'quiz'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Trắc nghiệm</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('flashcards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'flashcards'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              <span>Flashcard 3D</span>
            </button>
          </div>

          {/* Close button with ESC indicator */}
          <button
            onClick={onClose}
            aria-label="Đóng bài tập"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Fluid Progress Bar */}
        <div className="h-1.5 w-full bg-neutral-100 overflow-hidden shrink-0">
          <motion.div
            initial={false}
            animate={{
              width:
                activeTab === 'quiz'
                  ? showResult
                    ? '100%'
                    : `${((currentStep + 1) / QUIZ_QUESTIONS.length) * 100}%`
                  : `${((flashcardIndex + 1) / cardsList.length) * 100}%`,
            }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500"
          />
        </div>

        {/* TAB 1: QUIZLET LEARN / TRẮC NGHIỆM */}
        {activeTab === 'quiz' && (
          <>
            {showResult ? (
              /* Quiz Mastery Results View */
              <div className="p-6 sm:p-8 flex-1 overflow-y-auto space-y-6">
                <div className="text-center space-y-3">
                  <div className="relative inline-flex items-center justify-center">
                    <div
                      className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg ${
                        totalScore >= 75
                          ? 'bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-300 text-emerald-600'
                          : 'bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-300 text-amber-600'
                      }`}
                    >
                      {totalScore >= 75 ? (
                        <CheckCircle2 className="w-10 h-10" />
                      ) : (
                        <Sparkles className="w-10 h-10" />
                      )}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
                      {totalScore === 100
                        ? 'Xuất Sắc! Nắm Vững 100%'
                        : totalScore >= 75
                        ? 'Rất Tốt! Đã Nắm Vững'
                        : 'Cần Luyện Tập Thêm'}
                    </h2>
                    <p className="text-sm text-neutral-600 mt-1 font-medium">
                      Đạt <strong className="text-neutral-900 font-bold">{correctCount}/{QUIZ_QUESTIONS.length}</strong> câu trả lời chính xác ({totalScore}%)
                    </p>
                  </div>

                  {/* Automatic Streak Notification Banner */}
                  <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200/90 text-amber-950 shadow-2xs">
                    <BurningFlame size={20} showSparks={false} />
                    <span className="text-xs font-bold">
                      Hệ thống đã tự động cộng chuỗi học tập hôm nay!
                    </span>
                  </div>
                </div>

                {/* Review Breakdown of each question */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-neutral-500 px-1">
                    Chi tiết lời giải từng câu
                  </h4>

                  <div className="space-y-2.5">
                    {QUIZ_QUESTIONS.map((q, idx) => {
                      const userAns = answers[idx];
                      const isQCorrect = userAns === q.correctIndex;

                      return (
                        <div
                          key={q.id}
                          className={`rounded-2xl p-4 border transition-all ${
                            isQCorrect
                              ? 'bg-emerald-50/50 border-emerald-200/80'
                              : 'bg-rose-50/50 border-rose-200/80'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              <span
                                className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                                  isQCorrect
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-rose-500 text-white'
                                }`}
                              >
                                {isQCorrect ? (
                                  <Check className="w-3 h-3 stroke-[3]" />
                                ) : (
                                  <X className="w-3 h-3 stroke-[3]" />
                                )}
                              </span>

                              <div>
                                <h5 className="text-xs sm:text-sm font-bold text-neutral-900">
                                  {q.question}
                                </h5>

                                <div className="mt-2 space-y-1">
                                  {!isQCorrect && userAns !== null && (
                                    <p className="text-xs text-rose-700">
                                      <span className="font-semibold">Bạn chọn:</span>{' '}
                                      {q.options[userAns].text} ({q.options[userAns].vi})
                                    </p>
                                  )}
                                  <p className="text-xs text-emerald-800 font-medium">
                                    <span className="font-bold text-emerald-900">Đáp án chuẩn:</span>{' '}
                                    {q.options[q.correctIndex].text} ({q.options[q.correctIndex].pinyin})
                                  </p>
                                </div>

                                <p className="text-[11px] text-neutral-500 mt-2 leading-relaxed bg-white/80 rounded-xl p-2.5 border border-neutral-200/50">
                                  {q.explanation}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => playAudio(q.options[q.correctIndex].text)}
                              className="w-8 h-8 rounded-xl bg-white border border-neutral-200 text-neutral-600 hover:text-amber-600 flex items-center justify-center shrink-0 transition-colors shadow-2xs"
                              title="Nghe phát âm"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Results Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-neutral-200/70">
                  <button
                    type="button"
                    onClick={handleRetryQuiz}
                    className="w-full sm:w-1/3 h-11 rounded-2xl border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Làm lại bài này</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('flashcards')}
                    className="w-full sm:w-1/3 h-11 rounded-2xl bg-amber-100/90 hover:bg-amber-200 text-amber-900 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-amber-700" />
                    <span>Ôn Flashcard 3D</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-1/3 h-11 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Về bài học</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Quiz Active Question View */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-3.5 sm:space-y-4">
                  {/* Question Meta Bar */}
                  <div className="flex items-center justify-between text-xs font-semibold text-neutral-500">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-700 font-bold bg-amber-50 px-2.5 py-0.5 rounded-xl border border-amber-200/60">
                        Câu {currentStep + 1} / {QUIZ_QUESTIONS.length}
                      </span>
                      <span className="text-neutral-400">•</span>
                      <span className="text-neutral-600 font-medium">{currentQ.category}</span>
                    </div>

                    {streakCount > 1 && (
                      <div className="flex items-center gap-1 text-orange-600 font-bold bg-orange-50 px-2.5 py-0.5 rounded-xl border border-orange-200/60">
                        <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-600" />
                        <span>{streakCount} câu đúng liên tiếp</span>
                      </div>
                    )}
                  </div>

                  {/* Question Prompt Card */}
                  <div className="relative rounded-2xl sm:rounded-3xl bg-white border border-neutral-200/80 p-4 sm:p-5 shadow-xs space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <h4 className="text-base sm:text-lg font-extrabold text-neutral-900 leading-snug">
                        {currentQ.question}
                      </h4>

                      {/* TTS Question Pronunciation */}
                      <button
                        type="button"
                        onClick={() => playAudio(currentQ.options[currentQ.correctIndex].text)}
                        className="w-9 h-9 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 flex items-center justify-center shrink-0 transition-colors shadow-2xs cursor-pointer"
                        title="Nghe mẫu câu (Phím V)"
                      >
                        <Volume2 className="w-4.5 h-4.5" />
                      </button>
                    </div>

                    <div className="text-[11px] text-neutral-400 font-medium flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Chọn 1 phương án đúng nhất bên dưới hoặc bấm phím số [1-4] / [A-D]</span>
                    </div>
                  </div>

                  {/* 4 Answer Choice Cards (Quizlet Style) */}
                  <div className="space-y-2 sm:space-y-2.5">
                    {currentQ.options.map((option, idx) => {
                      const isSelected = selectedAnswer === idx;
                      const isThisCorrect = idx === currentQ.correctIndex;

                      let cardStyle =
                        'bg-white border-neutral-200/90 text-neutral-900 hover:border-amber-400 hover:bg-amber-50/30 hover:shadow-xs';
                      let keycapStyle = 'bg-neutral-100 text-neutral-600 border-neutral-200';

                      if (isAnswered) {
                        if (isSelected && isThisCorrect) {
                          cardStyle = 'bg-emerald-50/90 border-emerald-500 text-emerald-950 shadow-xs';
                          keycapStyle = 'bg-emerald-500 text-white border-emerald-500';
                        } else if (isSelected && !isThisCorrect) {
                          cardStyle = 'bg-rose-50/90 border-rose-500 text-rose-950 shadow-xs';
                          keycapStyle = 'bg-rose-500 text-white border-rose-500';
                        } else if (isThisCorrect) {
                          cardStyle = 'bg-emerald-50/50 border-emerald-400 text-emerald-900';
                          keycapStyle = 'bg-emerald-100 text-emerald-700 border-emerald-300';
                        } else {
                          cardStyle = 'bg-neutral-50/60 border-neutral-200 text-neutral-400 opacity-60';
                          keycapStyle = 'bg-neutral-100 text-neutral-400 border-neutral-200';
                        }
                      }

                      return (
                        <motion.button
                          key={idx}
                          type="button"
                          disabled={isAnswered}
                          onClick={() => handleSelectAnswer(idx)}
                          whileHover={!isAnswered ? { scale: 1.008 } : {}}
                          whileTap={!isAnswered ? { scale: 0.99 } : {}}
                          className={`w-full p-3 sm:p-3.5 rounded-2xl border-2 text-left transition-all flex items-center justify-between gap-3 cursor-pointer select-none ${cardStyle}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Keycap Badge A, B, C, D */}
                            <span
                              className={`w-7 h-7 rounded-xl font-mono text-xs font-black border flex items-center justify-center shrink-0 transition-colors ${keycapStyle}`}
                            >
                              {OPTION_KEYS[idx]}
                            </span>

                            {/* Option Typography */}
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-bold text-inherit leading-snug">
                                {option.text}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span className="text-xs font-mono text-amber-700/90 font-medium">
                                  {option.pinyin}
                                </span>
                                <span className="text-[11px] text-neutral-500">
                                  • {option.vi}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Sound preview button & Status icon */}
                          <div className="flex items-center gap-2 shrink-0">
                            {isAnswered && isSelected && isThisCorrect && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xs"
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                              </motion.span>
                            )}

                            {isAnswered && isSelected && !isThisCorrect && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-2xs"
                              >
                                <X className="w-3 h-3 stroke-[3]" />
                              </motion.span>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playAudio(option.text);
                              }}
                              className="w-7 h-7 rounded-lg text-neutral-400 hover:text-amber-600 hover:bg-neutral-100 flex items-center justify-center transition-colors"
                              title="Nghe cách đọc"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Instant Explanation Drawer */}
                  <AnimatePresence>
                    {isAnswered && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className={`p-3.5 sm:p-4 rounded-2xl border ${
                          isCorrect
                            ? 'bg-emerald-50/80 border-emerald-200/90 text-emerald-950'
                            : 'bg-rose-50/80 border-rose-200/90 text-rose-950'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {isCorrect ? (
                            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
                          )}
                          <div className="space-y-0.5">
                            <h5 className="text-xs font-black uppercase tracking-wider">
                              {isCorrect ? 'Chính xác!' : 'Chưa chính xác'}
                            </h5>
                            <p className="text-xs sm:text-[13px] leading-relaxed text-inherit/90">
                              {currentQ.explanation}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer Controls & Next Button */}
                <div className="px-5 sm:px-7 py-4 bg-white/90 backdrop-blur-sm border-t border-amber-100/80 flex items-center justify-between gap-3 shrink-0">
                  <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-400 font-mono">
                    <span className="px-1.5 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 text-neutral-600">
                      1-4
                    </span>
                    <span>chọn</span>
                    <span className="text-neutral-300">•</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 text-neutral-600">
                      Enter ↵
                    </span>
                    <span>tiếp tục</span>
                  </div>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                    >
                      Thoát
                    </button>

                    <button
                      type="button"
                      disabled={!isAnswered}
                      onClick={handleNextQuestion}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                    >
                      <span>
                        {currentStep < QUIZ_QUESTIONS.length - 1 ? 'Câu tiếp theo' : 'Xem kết quả'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: FLASHCARD 3D (QUIZLET STYLE) */}
        {activeTab === 'flashcards' && (
          <div className="flex-1 flex flex-col overflow-hidden p-5 sm:p-7 space-y-4">
            {/* Flashcard Header Bar */}
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-500">
              <span className="font-mono text-amber-700 font-bold bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200/60">
                Thẻ {flashcardIndex + 1} / {cardsList.length}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShuffleCards}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition-colors cursor-pointer"
                  title="Xáo trộn thứ tự các thẻ"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Xáo thẻ</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleStar(currentCard.id)}
                  className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                    starredIds.has(currentCard.id)
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-neutral-100 text-neutral-400 hover:text-amber-500'
                  }`}
                  title="Đánh dấu từ vựng cần chú ý"
                >
                  <Star
                    className="w-4 h-4"
                    fill={starredIds.has(currentCard.id) ? 'currentColor' : 'none'}
                  />
                </button>
              </div>
            </div>

            {/* 3D Flip Card Container */}
            <div
              className="flex-1 flex items-center justify-center min-h-[300px] sm:min-h-[340px]"
              style={{ perspective: 1200 }}
            >
              <motion.div
                onClick={handleFlipCard}
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                style={{ transformStyle: 'preserve-3d' }}
                className="relative w-full max-w-xl h-full min-h-[290px] sm:min-h-[330px] rounded-3xl cursor-pointer shadow-lg hover:shadow-xl transition-shadow"
              >
                {/* FRONT FACE (Hanzi + Pronunciation prompt) */}
                <div
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                  }}
                  className="absolute inset-0 bg-white border border-amber-200/80 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-between text-center select-none"
                >
                  <div className="w-full flex items-center justify-between text-xs text-neutral-400 font-medium">
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                      HSK {currentCard.hskLevel}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playAudio(currentCard.hanzi);
                      }}
                      className="w-9 h-9 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-700 flex items-center justify-center transition-colors shadow-2xs"
                      title="Nghe phát âm"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Massive Hanzi Display */}
                  <div className="my-auto space-y-2">
                    <h2 className="text-6xl sm:text-7xl font-black text-neutral-900 tracking-wide font-sans">
                      {currentCard.hanzi}
                    </h2>
                    <p className="text-xs text-neutral-400 font-mono">
                      (Nhấn chuột hoặc phím [Space] để lật đáp án)
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-medium">
                    <RotateCw className="w-3.5 h-3.5 text-amber-600" />
                    <span>Mặt trước • Tiếng Trung</span>
                  </div>
                </div>

                {/* BACK FACE (Pinyin + Meaning + Example) */}
                <div
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                  className="absolute inset-0 bg-gradient-to-b from-[#FFFDF7] via-white to-[#FFFBEB] border border-amber-200/90 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-between text-center select-none"
                >
                  <div className="w-full flex items-center justify-between text-xs text-neutral-400 font-medium">
                    <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-semibold text-[10px]">
                      {currentCard.partOfSpeech}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playAudio(currentCard.exampleZh);
                      }}
                      className="w-9 h-9 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-700 flex items-center justify-center transition-colors shadow-2xs"
                      title="Nghe câu ví dụ"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Meaning & Pinyin */}
                  <div className="my-auto space-y-3">
                    <div className="text-2xl sm:text-3xl font-black font-mono text-amber-600">
                      {currentCard.pinyin}
                    </div>

                    <div className="text-xl sm:text-2xl font-bold text-neutral-900">
                      {currentCard.meaningVi}
                    </div>

                    {/* Example sentence */}
                    <div className="mt-4 p-3.5 rounded-2xl bg-white/90 border border-neutral-200/60 text-xs sm:text-sm text-left space-y-1">
                      <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                        <span>{currentCard.exampleZh}</span>
                      </div>
                      <div className="font-mono text-[11px] text-amber-700">
                        {currentCard.examplePinyin}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {currentCard.exampleVi}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-medium">
                    <RotateCw className="w-3.5 h-3.5 text-amber-600" />
                    <span>Mặt sau • Nghĩa & Ví dụ thực tế</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Navigation & SRS Controls */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handlePrevCard}
                className="w-10 h-10 rounded-2xl bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 flex items-center justify-center shadow-xs transition-all cursor-pointer"
                title="Thẻ trước (Phím ←)"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              {/* Flip Button */}
              <button
                type="button"
                onClick={handleFlipCard}
                className="h-10 px-5 rounded-2xl bg-white border border-amber-200 hover:bg-amber-50 text-amber-900 text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <RotateCw className="w-4 h-4 text-amber-600" />
                <span>{isFlipped ? 'Xem mặt trước' : 'Lật xem nghĩa (Space)'}</span>
              </button>

              <button
                type="button"
                onClick={handleNextCard}
                className="w-10 h-10 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white flex items-center justify-center shadow-xs transition-all cursor-pointer"
                title="Thẻ tiếp theo (Phím →)"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
