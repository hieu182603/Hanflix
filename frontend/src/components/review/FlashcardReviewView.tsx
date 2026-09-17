import React, { useState } from 'react';
import { X, Volume2, Check, Sparkles } from 'lucide-react';
import { SAMPLE_WORDS, Word } from '../../data/hanflixData';
import { recordLearningActivity } from '../../lib/streak';

interface FlashcardReviewViewProps {
  onClose: () => void;
}

const RATINGS = [
  { label: 'Chưa nhớ', desc: '< 10 phút', bg: '#FFF0F0', border: '#F5CACA', color: '#B91B1C', dot: '#B91B1C' },
  { label: 'Khó', desc: '1 ngày', bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', dot: '#D97706' },
  { label: 'Nhớ', desc: '3 ngày', bg: '#EFF6FF', border: '#BFDBFE', color: '#1E40AF', dot: '#3B82F6' },
  { label: 'Dễ', desc: '7 ngày', bg: '#ECFDF5', border: '#A7F3D0', color: '#065F46', dot: '#10B981' },
];

export default function FlashcardReviewView({ onClose }: FlashcardReviewViewProps) {
  const [currentIndex, setCurrentStep] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionCompleted, setIsSessionCompleted] = useState(false);
  const total = 3;

  const currentWord: Word = SAMPLE_WORDS[currentIndex % SAMPLE_WORDS.length];
  const progress = ((currentIndex) / total) * 100;

  const handleRating = (label: string) => {
    setIsFlipped(false);
    recordLearningActivity('review');
    if (currentIndex < total - 1) {
      setCurrentStep(currentIndex + 1);
    } else {
      setIsSessionCompleted(true);
    }
  };

  const playPronunciation = (word: string) => {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(word);
      u.lang = 'zh-CN';
      window.speechSynthesis.speak(u);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,5,5,0.75)', backdropFilter: 'blur(8px)' }}>
      <style>{`
        @keyframes cardFlipIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .card-in { animation: cardFlipIn 0.22s ease both; }
      `}</style>

      <div className="w-full max-w-lg flex flex-col gap-0 rounded-3xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.5)]"
        style={{ background: '#FAFAF8', border: '1.5px solid #EDE8E3' }}>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between"
          style={{ borderBottom: '1.5px solid #EDE8E3', background: '#fff' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #B91B1C, #D94040)', boxShadow: '0 3px 10px rgba(185,27,28,0.3)' }}>
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <span className="text-sm font-black text-[#1A0A0A]">Ôn Tập SRS</span>
              <span className="ml-2 text-xs text-[#B0A89E] font-medium">{currentIndex + 1} / {total}</span>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-[#F0EBE8]"
            style={{ border: '1.5px solid #EDE8E3', color: '#9A8878' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-[#F0EBE8]">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #B91B1C, #D94040)' }} />
        </div>

        {!sessionCompleted ? (
          <div className="p-6 flex flex-col gap-5">
            {/* Card */}
            <div onClick={() => setIsFlipped(!isFlipped)} className="card-in cursor-pointer rounded-2xl p-8 flex flex-col items-center text-center relative transition-all hover:shadow-md select-none"
              style={{ background: '#fff', border: '1.5px solid #EDE8E3', minHeight: 220, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>

              {/* Sound button */}
              <button type="button" onClick={e => { e.stopPropagation(); playPronunciation(currentWord.hanzi); }}
                className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-[#FFF0F0]"
                style={{ background: '#F8F5F2', border: '1.5px solid #EDE8E3', color: '#9A8878' }}>
                <Volume2 className="w-4 h-4" />
              </button>

              {/* HSK badge */}
              <span className="absolute top-4 left-4 text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: '#FFF0F0', color: '#B91B1C', border: '1px solid #F5CACA' }}>
                HSK {currentWord.hskLevel || 3}
              </span>

              {/* Hanzi */}
              <div className="text-[64px] font-black text-[#1A0A0A] leading-none mt-4 mb-2"
                style={{ fontFamily: 'serif', textShadow: '0 2px 8px rgba(185,27,28,0.08)' }}>
                {currentWord.hanzi}
              </div>

              {/* Flip content */}
              {isFlipped ? (
                <div className="card-in w-full pt-4 flex flex-col items-center gap-1.5" style={{ borderTop: '1.5px dashed #EDE8E3' }}>
                  <div className="text-lg font-black text-[#B91B1C]">{currentWord.pinyin}</div>
                  <div className="text-base font-bold text-[#1A0A0A]">{currentWord.meaningVi}</div>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold mt-0.5"
                    style={{ background: '#F8F5F2', color: '#9A8878', border: '1px solid #EDE8E3' }}>
                    {currentWord.partOfSpeech}
                  </span>
                  <p className="text-xs text-[#B0A89E] mt-1">Nguồn: Gọi món ở nhà hàng</p>
                </div>
              ) : (
                <div className="text-xs font-semibold text-[#C0B4AC] mt-3">Nhấn để xem nghĩa</div>
              )}
            </div>

            {/* Action area */}
            {isFlipped ? (
              <div>
                <p className="text-center text-xs font-semibold text-[#B0A89E] mb-3">Bạn nhớ từ này ở mức nào?</p>
                <div className="grid grid-cols-4 gap-2">
                  {RATINGS.map(r => (
                    <button key={r.label} onClick={() => handleRating(r.label)}
                      className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl font-bold text-xs transition-all hover:scale-[1.04] active:scale-[0.97]"
                      style={{ background: r.bg, border: `1.5px solid ${r.border}`, color: r.color }}>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: r.dot }} />
                      <span>{r.label}</span>
                      <span className="text-[10px] opacity-70 font-mono">{r.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button onClick={() => setIsFlipped(true)}
                className="w-full py-3.5 rounded-2xl font-black text-sm text-white transition-all hover:scale-[1.02] active:scale-[0.99]"
                style={{ background: 'linear-gradient(135deg, #B91B1C, #D94040)', boxShadow: '0 5px 18px rgba(185,27,28,0.32)' }}>
                Hiện đáp án
              </button>
            )}
          </div>
        ) : (
          <div className="p-10 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
              style={{ background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)', border: '2px solid #A7F3D0' }}>
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-black text-[#1A0A0A]" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
              Hoàn Thành!
            </h2>
            <p className="text-sm text-[#9A8878] max-w-xs leading-relaxed">
              Bạn đã ôn xong {total} từ hôm nay. Lịch ôn tiếp theo được cập nhật tự động theo SRS.
            </p>
            <button onClick={onClose}
              className="mt-2 px-8 py-3 rounded-2xl font-black text-sm text-white transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #1A0A0A, #3A1A1A)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
              Về Bảng Tin
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
