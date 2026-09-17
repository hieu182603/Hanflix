import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Volume2,
  Check,
  Sparkles,
  RotateCw,
  Star,
  Shuffle,
  ArrowRight,
  ArrowLeft,
  Flame,
  BookOpen,
} from 'lucide-react';
import { SAMPLE_WORDS, Word } from '../../data/hanflixData';
import { recordLearningActivity } from '../../lib/streak';
import BurningFlame from '../streak/BurningFlame';
import { usePandaPet } from '../panda-pet';

interface FlashcardReviewViewProps {
  onClose: () => void;
}

const RATINGS = [
  {
    key: 'again',
    label: 'Chưa nhớ',
    shortcut: '1',
    desc: '< 10 phút',
    bg: 'bg-rose-50 hover:bg-rose-100/80',
    border: 'border-rose-200 text-rose-700',
    dot: 'bg-rose-500',
  },
  {
    key: 'hard',
    label: 'Khó',
    shortcut: '2',
    desc: '1 ngày',
    bg: 'bg-amber-50 hover:bg-amber-100/80',
    border: 'border-amber-200 text-amber-800',
    dot: 'bg-amber-500',
  },
  {
    key: 'good',
    label: 'Nhớ tốt',
    shortcut: '3',
    desc: '3 ngày',
    bg: 'bg-blue-50 hover:bg-blue-100/80',
    border: 'border-blue-200 text-blue-800',
    dot: 'bg-blue-500',
  },
  {
    key: 'easy',
    label: 'Dễ',
    shortcut: '4',
    desc: '7 ngày',
    bg: 'bg-emerald-50 hover:bg-emerald-100/80',
    border: 'border-emerald-200 text-emerald-800',
    dot: 'bg-emerald-500',
  },
];

export default function FlashcardReviewView({ onClose }: FlashcardReviewViewProps) {
  const panda = usePandaPet();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionCompleted, setIsSessionCompleted] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [cards, setCards] = useState<Word[]>(SAMPLE_WORDS);

  const total = cards.length;
  const currentWord: Word = cards[currentIndex % total];
  const progress = ((currentIndex + 1) / total) * 100;

  const playPronunciation = useCallback((word: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      u.lang = 'zh-CN';
      u.rate = 0.85;
      window.speechSynthesis.speak(u);
    }
  }, []);

  const handleRating = useCallback(
    (ratingKeyOrLabel: string) => {
      setIsFlipped(false);
      recordLearningActivity('review');

      // Trigger expressive reactions based on rating difficulty
      if (ratingKeyOrLabel === 'again' || ratingKeyOrLabel === 'Chưa nhớ') {
        panda?.triggerReaction('error', 2200);
      } else if (ratingKeyOrLabel === 'hard' || ratingKeyOrLabel === 'Khó') {
        panda?.triggerReaction('thinking', 2000);
      } else {
        panda?.triggerReaction('success', 2200);
      }

      if (currentIndex < total - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setIsSessionCompleted(true);
        panda?.triggerReaction('success', 3500);
      }
    },
    [currentIndex, total, panda]
  );

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
    panda?.triggerReaction('working', 1400);
  }, [panda]);

  const handleToggleStar = (id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    setCards((prev) => [...prev].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (!sessionCompleted) {
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          handleFlip();
        } else if (e.key.toLowerCase() === 'v' || e.key.toLowerCase() === 's') {
          playPronunciation(currentWord.hanzi);
        } else if (isFlipped && ['1', '2', '3', '4'].includes(e.key)) {
          const idx = parseInt(e.key, 10) - 1;
          if (idx < RATINGS.length) handleRating(RATINGS[idx].label);
        } else if (e.key === 'ArrowRight') {
          if (currentIndex < total - 1) {
            setIsFlipped(false);
            setCurrentIndex((prev) => prev + 1);
          }
        } else if (e.key === 'ArrowLeft') {
          if (currentIndex > 0) {
            setIsFlipped(false);
            setCurrentIndex((prev) => prev - 1);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    sessionCompleted,
    isFlipped,
    currentIndex,
    total,
    currentWord,
    handleFlip,
    handleRating,
    playPronunciation,
    onClose,
  ]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Phiên ôn tập Flashcard Quizlet SRS"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-md overflow-y-auto select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 350, damping: 26 }}
        className="w-full max-w-xl bg-[#FFFDF7] rounded-[2.2rem] overflow-hidden shadow-[0_30px_90px_-20px_rgba(0,0,0,0.35),0_0_0_1px_rgba(231,229,228,0.8)] border border-amber-100/90 flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-white/90 backdrop-blur-sm border-b border-amber-100/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FFFBEB] via-[#FEF3C7] to-[#FDE68A]/60 border border-amber-200/90 flex items-center justify-center shadow-xs text-amber-700 shrink-0">
              <BurningFlame size={24} showSparks={false} intensity="high" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-neutral-900 tracking-tight">
                  Ôn tập Flashcard SRS
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100/80 text-amber-900 border border-amber-200/60">
                  HSK {currentWord.hskLevel || 3}
                </span>
              </div>
              <p className="text-xs text-neutral-500 font-medium">
                Quizlet Mode • Thẻ {currentIndex + 1} / {total}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleShuffle}
              className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition-colors cursor-pointer"
              title="Xáo trộn thẻ"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleToggleStar(currentWord.id)}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                starredIds.has(currentWord.id)
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-neutral-100 text-neutral-400 hover:text-amber-500'
              }`}
              title="Đánh dấu từ vựng quan trọng"
            >
              <Star
                className="w-4 h-4"
                fill={starredIds.has(currentWord.id) ? 'currentColor' : 'none'}
              />
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer ml-1"
              title="Đóng (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Liquid Progress bar */}
        <div className="h-1.5 w-full bg-neutral-100 overflow-hidden shrink-0">
          <motion.div
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500"
          />
        </div>

        {!sessionCompleted ? (
          <div className="p-6 flex-1 flex flex-col justify-between gap-5 overflow-y-auto">
            {/* 3D Flip Card Container */}
            <div
              className="flex-1 flex items-center justify-center min-h-[300px]"
              style={{ perspective: 1200 }}
            >
              <motion.div
                onClick={handleFlip}
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                style={{ transformStyle: 'preserve-3d' }}
                className="relative w-full h-full min-h-[290px] rounded-3xl cursor-pointer shadow-lg hover:shadow-xl transition-shadow"
              >
                {/* FRONT FACE */}
                <div
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                  }}
                  className="absolute inset-0 bg-white border border-amber-200/80 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-between text-center select-none"
                >
                  <div className="w-full flex items-center justify-between text-xs text-neutral-400">
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                      HSK {currentWord.hskLevel || 3}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playPronunciation(currentWord.hanzi);
                      }}
                      className="w-9 h-9 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-700 flex items-center justify-center transition-colors shadow-2xs"
                      title="Nghe phát âm (Phím V)"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="my-auto space-y-2">
                    <h2 className="text-6xl sm:text-7xl font-black text-neutral-900 tracking-wide font-sans">
                      {currentWord.hanzi}
                    </h2>
                    <p className="text-xs text-neutral-400 font-mono">
                      (Nhấn vào thẻ hoặc phím [Space] để lật đáp án)
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-medium">
                    <RotateCw className="w-3.5 h-3.5 text-amber-600" />
                    <span>Mặt trước • Chữ Hán</span>
                  </div>
                </div>

                {/* BACK FACE */}
                <div
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                  className="absolute inset-0 bg-gradient-to-b from-[#FFFDF7] via-white to-[#FFFBEB] border border-amber-200/90 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-between text-center select-none"
                >
                  <div className="w-full flex items-center justify-between text-xs text-neutral-400">
                    <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-semibold text-[10px]">
                      {currentWord.partOfSpeech}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playPronunciation(currentWord.hanzi);
                      }}
                      className="w-9 h-9 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-700 flex items-center justify-center transition-colors shadow-2xs"
                      title="Nghe phát âm"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="my-auto space-y-2.5">
                    <div className="text-2xl sm:text-3xl font-black font-mono text-amber-600">
                      {currentWord.pinyin}
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-neutral-900">
                      {currentWord.meaningVi}
                    </div>
                    <div className="text-xs text-neutral-500 bg-neutral-50 rounded-xl px-3 py-1.5 border border-neutral-200/60 inline-block mt-2">
                      Thuộc bài: Gọi món ở nhà hàng
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-medium">
                    <RotateCw className="w-3.5 h-3.5 text-amber-600" />
                    <span>Mặt sau • Phiên âm & Nghĩa tiếng Việt</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Actions & Rating Buttons */}
            {isFlipped ? (
              <div className="space-y-2 pt-1">
                <p className="text-center text-xs font-semibold text-neutral-500">
                  Bạn ghi nhớ từ này ở mức độ nào? (Phím số 1-4)
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {RATINGS.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => handleRating(r.label)}
                      className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-2xl border font-bold text-xs transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-2xs ${r.bg} ${r.border}`}
                    >
                      <div className="flex items-center gap-1">
                        <span className={`${r.dot} w-2 h-2 rounded-full`} />
                        <span>{r.label}</span>
                      </div>
                      <span className="text-[10px] opacity-75 font-mono">
                        [{r.shortcut}] {r.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (currentIndex > 0) {
                      setIsFlipped(false);
                      setCurrentIndex((prev) => prev - 1);
                    }
                  }}
                  disabled={currentIndex === 0}
                  className="w-10 h-10 rounded-2xl bg-white border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none text-neutral-700 flex items-center justify-center shadow-xs transition-all cursor-pointer"
                  title="Thẻ trước (Phím ←)"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleFlip}
                  className="h-11 px-8 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>Hiện đáp án (Space)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (currentIndex < total - 1) {
                      setIsFlipped(false);
                      setCurrentIndex((prev) => prev + 1);
                    }
                  }}
                  disabled={currentIndex >= total - 1}
                  className="w-10 h-10 rounded-2xl bg-white border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none text-neutral-700 flex items-center justify-center shadow-xs transition-all cursor-pointer"
                  title="Thẻ tiếp theo (Phím →)"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Completion Screen */
          <div className="p-8 sm:p-10 flex flex-col items-center text-center gap-4">
            <div className="w-18 h-18 rounded-3xl bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-300 flex items-center justify-center shadow-lg text-emerald-600">
              <Check className="w-9 h-9 stroke-[3]" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
                Hoàn Thành Phiên Ôn Tập!
              </h2>
              <p className="text-sm text-neutral-500 max-w-sm leading-relaxed">
                Bạn đã ôn luyện xong <strong className="text-neutral-900">{total} thẻ từ vựng</strong> hôm nay.
                Lịch ôn tiếp theo đã được hệ thống tự động đồng bộ theo thuật toán SRS.
              </p>
            </div>

            {/* Streak indicator */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200/90 text-amber-950 shadow-2xs mt-1">
              <BurningFlame size={22} showSparks={false} />
              <span className="text-xs font-bold">
                Chuỗi Streak của bạn đã được ghi nhận tự động!
              </span>
            </div>

            <div className="flex items-center gap-3 mt-4 w-full max-w-xs">
              <button
                type="button"
                onClick={() => {
                  setCurrentIndex(0);
                  setIsFlipped(false);
                  setIsSessionCompleted(false);
                }}
                className="flex-1 h-11 rounded-2xl border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-xs font-bold transition-all cursor-pointer"
              >
                Ôn lại bộ này
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                Về bảng tin
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
