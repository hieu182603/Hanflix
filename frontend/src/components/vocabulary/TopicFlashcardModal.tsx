import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  RotateCcw,
  Volume2,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  BookmarkPlus,
  CheckCircle2,
  Trophy,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import type { DisplayWordItem, TopicConfig } from './VocabularyPage';
import { awardXP } from '../../lib/xp';
import { recordLearningActivity } from '../../lib/streak';

export interface TopicFlashcardModalProps {
  isOpen: boolean;
  topic: TopicConfig | null;
  words: DisplayWordItem[];
  onClose: () => void;
  onToggleSaveWord?: (word: DisplayWordItem) => Promise<void> | void;
  isWordSaved?: (word: DisplayWordItem) => boolean;
}

export default function TopicFlashcardModal({
  isOpen,
  topic,
  words,
  onClose,
  onToggleSaveWord,
  isWordSaved,
}: TopicFlashcardModalProps) {
  const [deck, setDeck] = useState<DisplayWordItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [speakingHanzi, setSpeakingHanzi] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // Initialize deck when modal opens or words change
  useEffect(() => {
    if (isOpen && words.length > 0) {
      setDeck([...words]);
      setCurrentIndex(0);
      setIsFlipped(false);
      setIsCompleted(false);
    }
  }, [isOpen, words]);

  const currentWord = deck[currentIndex] || null;
  const saved = currentWord && isWordSaved ? isWordSaved(currentWord) : false;

  // Pronunciation
  const playPronunciation = useCallback((hanzi: string) => {
    if (!hanzi) return;
    setSpeakingHanzi(hanzi);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(hanzi);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.85;
      utterance.onend = () => setSpeakingHanzi(null);
      utterance.onerror = () => setSpeakingHanzi(null);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setSpeakingHanzi(null), 1000);
    }
  }, []);

  const handleNext = useCallback(() => {
    setIsFlipped(false);
    if (currentIndex + 1 < deck.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
      awardXP(20, 'Hoàn thành bộ thẻ từ vựng (+20 XP)', 'vocab');
      recordLearningActivity('review');
    }
  }, [currentIndex, deck.length]);

  const handlePrev = useCallback(() => {
    setIsFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleShuffle = () => {
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsCompleted(false);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleNext, handlePrev]);

  if (!isOpen || !topic) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-[#E7E7EA] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#E7E7EA] bg-white">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${topic.bgLight} border border-[#E7E7EA]`}
            >
              {React.createElement(topic.icon, { className: `w-5 h-5 ${topic.color}` })}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-[#18181B] tracking-tight">
                  {topic.nameVi}
                </h3>
                <span className="text-xs font-hanzi font-semibold text-[#8B9097]">
                  {topic.nameZh}
                </span>
              </div>
              <p className="text-[11px] text-[#5F6368]">
                Luyện tập thẻ từ vựng Flashcard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShuffle}
              title="Xáo trộn thứ tự từ"
              className="p-2 rounded-xl text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9] transition-colors cursor-pointer"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              title="Đóng (Esc)"
              className="p-2 rounded-xl text-[#5F6368] hover:text-[#B91B1C] hover:bg-red-50 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#E7E7EA] h-1.5 overflow-hidden">
          <div
            className="bg-[#B91B1C] h-full transition-all duration-300 rounded-full"
            style={{
              width: `${deck.length > 0 ? ((currentIndex + 1) / deck.length) * 100 : 0}%`,
            }}
          />
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 flex flex-col justify-between space-y-4">
          {isCompleted ? (
            /* Completed Screen */
            <div className="py-10 text-center space-y-4 my-auto">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <Trophy className="w-8 h-8" />
              </div>
              <h4 className="text-xl sm:text-2xl font-black text-[#18181B]">
                Hoàn thành chủ đề {topic.nameVi}!
              </h4>
              <p className="text-xs sm:text-sm text-[#5F6368] max-w-sm mx-auto">
                Bạn đã luyện tập toàn bộ {deck.length} từ vựng trong chủ đề này. Các từ bạn đã lưu sẽ tiếp tục được nhắc lại trong mục Kho lưu trữ.
              </p>
              <div className="flex items-center justify-center gap-3 pt-3">
                <button
                  onClick={() => {
                    setCurrentIndex(0);
                    setIsFlipped(false);
                    setIsCompleted(false);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Ôn lại chủ đề này</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-[#F7F7F9] hover:bg-white text-[#18181B] border border-[#E7E7EA] text-xs sm:text-sm font-bold transition-all cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : currentWord ? (
            <>
              {/* Counter Indicator */}
              <div className="flex items-center justify-between text-xs text-[#8B9097] font-bold">
                <span className="px-2.5 py-0.5 rounded-md bg-[#F7F7F9] border border-[#E7E7EA] text-[11px] text-[#5F6368]">
                  HSK {currentWord.hskLevel}
                </span>

                <div className="font-mono">
                  <span className="text-[#B91B1C] font-extrabold text-sm">
                    {currentIndex + 1}
                  </span>{' '}
                  / {deck.length}
                </div>
              </div>

              {/* Quizlet-Style 3D Interactive Flashcard */}
              <div className="perspective-1200 w-full select-none cursor-pointer py-1">
                <div
                  onClick={() => setIsFlipped((prev) => !prev)}
                  className="relative w-full h-[360px] sm:h-[390px] transition-transform duration-700 ease-[cubic-bezier(0.34,1.15,0.64,1)] transform-style-3d group"
                  style={{
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {/* FRONT FACE (TERM SIDE) */}
                  <div
                    className="absolute inset-0 w-full h-full backface-hidden rounded-[2rem] bg-gradient-to-b from-white via-[#FCFBFB] to-[#F9F7F7] border-2 border-[#E7E7EA] group-hover:border-[#B91B1C]/50 shadow-xl group-hover:shadow-2xl transition-all duration-300 p-6 sm:p-7 flex flex-col justify-between overflow-hidden"
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(0deg)',
                    }}
                  >
                    {/* Watermark in front */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[140px] sm:text-[180px] font-serif font-black text-neutral-900/[0.03] select-none pointer-events-none transition-transform duration-500 group-hover:scale-105">
                      {currentWord.simplified?.[0]}
                    </div>

                    {/* Top Row: Eyebrow + Pronunciation Speaker */}
                    <div className="relative z-10 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F7F7F9] border border-[#E7E7EA] text-[11px] font-bold text-[#5F6368] uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#B91B1C]" />
                        <span>Mặt trước · Thuật ngữ</span>
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playPronunciation(currentWord.simplified);
                        }}
                        title="Nghe phát âm chuẩn (Giọng Bắc Kinh)"
                        className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                          speakingHanzi === currentWord.simplified
                            ? 'bg-[#B91B1C] text-white border-[#B91B1C] scale-110 shadow-md'
                            : 'bg-white hover:bg-[#FDF1F1] text-[#5F6368] hover:text-[#B91B1C] border-[#E7E7EA] hover:border-[#B91B1C]/30 group-hover:scale-105'
                        }`}
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Center Content: Huge Hanzi Character */}
                    <div className="relative z-10 text-center py-2 my-auto flex flex-col items-center justify-center">
                      <div className="text-7xl sm:text-8xl font-serif font-black text-[#18181B] tracking-wide transition-transform duration-300 group-hover:scale-105 drop-shadow-xs">
                        {currentWord.simplified}
                      </div>

                      <div className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[#8B9097] group-hover:text-[#B91B1C] bg-white group-hover:bg-[#FDF1F1] px-4 py-1.5 rounded-full border border-[#E7E7EA] group-hover:border-[#B91B1C]/30 transition-all shadow-2xs">
                        <RotateCcw className="w-3.5 h-3.5 text-[#B91B1C] transition-transform duration-500 group-hover:rotate-180" />
                        <span>Chạm để lật thẻ (Space)</span>
                      </div>
                    </div>

                    {/* Bottom Row: Save to SRS + Shortcut */}
                    <div className="relative z-10 flex items-center justify-between pt-3 border-t border-[#E7E7EA]/70 text-xs">
                      {onToggleSaveWord ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void onToggleSaveWord(currentWord);
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            saved
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-white hover:bg-[#FDF1F1] text-[#5F6368] hover:text-[#B91B1C] border border-[#E7E7EA]'
                          }`}
                        >
                          {saved ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Đã lưu vào SRS</span>
                            </>
                          ) : (
                            <>
                              <BookmarkPlus className="w-3.5 h-3.5" />
                              <span>Lưu vào SRS để ôn tập</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span />
                      )}

                      <kbd className="px-2 py-0.5 rounded-md bg-[#F7F7F9] border border-[#E7E7EA] text-[10px] font-mono text-neutral-600 font-bold">
                        Space để lật
                      </kbd>
                    </div>
                  </div>

                  {/* BACK FACE (DEFINITION & EXAMPLES SIDE) */}
                  <div
                    className="absolute inset-0 w-full h-full backface-hidden rounded-[2rem] bg-gradient-to-b from-white via-[#FFFDFD] to-[#FDF5F5] border-2 border-[#B91B1C]/40 shadow-xl group-hover:shadow-2xl transition-all duration-300 p-6 sm:p-7 flex flex-col justify-between overflow-hidden rotate-y-180"
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    {/* Watermark in back */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[140px] sm:text-[180px] font-serif font-black text-[#B91B1C]/[0.03] select-none pointer-events-none">
                      {currentWord.simplified?.[0]}
                    </div>

                    {/* Top Row: Eyebrow + Speaker */}
                    <div className="relative z-10 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDF1F1] border border-[#B91B1C]/25 text-[11px] font-bold text-[#B91B1C] uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5 fill-[#B91B1C]" />
                        <span>Mặt sau · Định nghĩa & Ví dụ</span>
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playPronunciation(currentWord.simplified);
                        }}
                        title="Nghe lại phát âm"
                        className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                          speakingHanzi === currentWord.simplified
                            ? 'bg-[#B91B1C] text-white border-[#B91B1C] scale-110 shadow-md'
                            : 'bg-white hover:bg-[#FDF1F1] text-[#B91B1C] border-[#B91B1C]/25 group-hover:scale-105'
                        }`}
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Center: Hanzi + Pinyin + Vietnamese Meaning + Example */}
                    <div className="relative z-10 text-center py-1 my-auto flex flex-col items-center justify-center space-y-1.5">
                      <div className="text-3xl sm:text-4xl font-serif font-black text-[#18181B] tracking-wide">
                        {currentWord.simplified}
                      </div>

                      <div className="text-2xl sm:text-3xl font-mono font-black text-[#B91B1C] tracking-wide">
                        {currentWord.pinyin}
                      </div>

                      <div className="text-lg sm:text-xl font-bold text-[#18181B] max-w-md mx-auto leading-relaxed pt-0.5">
                        {currentWord.meaningVi}
                      </div>

                      {currentWord.partOfSpeech && (
                        <span className="inline-block px-3 py-0.5 rounded-full bg-white border border-[#E7E7EA] text-xs font-bold text-[#5F6368] shadow-2xs">
                          {currentWord.partOfSpeech}
                        </span>
                      )}

                      {/* Example sentence */}
                      {currentWord.example && (
                        <div className="mt-2 p-2.5 bg-white/90 rounded-2xl border border-[#E7E7EA] text-left text-xs max-w-sm mx-auto shadow-2xs">
                          <div className="font-serif font-semibold text-[#18181B]">
                            {currentWord.example.chinese}
                          </div>
                          <div className="font-mono text-[11px] text-[#8B9097] mt-0.5">
                            {currentWord.example.pinyin}
                          </div>
                          <div className="text-[11px] text-[#5F6368] mt-0.5">
                            {currentWord.example.vietnamese}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Row */}
                    <div className="relative z-10 flex items-center justify-between pt-2.5 border-t border-[#E7E7EA]/70 text-xs">
                      {onToggleSaveWord ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void onToggleSaveWord(currentWord);
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            saved
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-white hover:bg-[#FDF1F1] text-[#5F6368] hover:text-[#B91B1C] border border-[#E7E7EA]'
                          }`}
                        >
                          {saved ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Đã lưu vào SRS</span>
                            </>
                          ) : (
                            <>
                              <BookmarkPlus className="w-3.5 h-3.5" />
                              <span>Lưu vào SRS để ôn tập</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span />
                      )}

                      <div className="inline-flex items-center gap-1.5 font-bold text-[#B91B1C] hover:underline">
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Lật lại mặt trước</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center justify-between pt-1">
                <button
                  disabled={currentIndex === 0}
                  onClick={handlePrev}
                  className="px-4 py-2.5 rounded-xl border border-[#E7E7EA] bg-white hover:bg-[#F7F7F9] text-[#18181B] font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-2xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Thẻ trước</span>
                </button>

                <button
                  onClick={handleNext}
                  className="px-5 py-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-md shadow-[#B91B1C]/20 cursor-pointer"
                >
                  <span>{currentIndex + 1 === deck.length ? 'Hoàn thành' : 'Thẻ tiếp theo'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
