import React, { useState } from 'react';
import { Bookmark, BookMarked, Trash2, Volume2, RotateCcw } from 'lucide-react';
import { VideoLesson, SavedWord, SAMPLE_WORDS } from '../data/hanflixData';
import VideoCard from './VideoCard';

interface SavedPageProps {
  onSelectLesson: (lesson: VideoLesson) => void;
  savedWords?: SavedWord[];
  savedLessons?: VideoLesson[];
  onRemoveWord?: (wordId: string) => void;
  onRemoveSavedLesson?: (id: string) => void;
}

export default function SavedPage({ onSelectLesson, savedWords = [], savedLessons = [], onRemoveWord, onRemoveSavedLesson }: SavedPageProps) {
  const [activeTab, setActiveTab] = useState<'lessons' | 'vocab'>('lessons');
  const [undoId, setUndoId] = useState<string | null>(null); // Real undo would re-add it

  const handleRemoveWord = (wordId: string) => {
    onRemoveWord?.(wordId);
  };

  const playPronunciation = (word: string) => {
    if ('speechSynthesis' in window) {
      const utt = new SpeechSynthesisUtterance(word);
      utt.lang = 'zh-CN';
      window.speechSynthesis.speak(utt);
    }
  };

  const displayWords = savedWords.map(sw => {
    const w = SAMPLE_WORDS.find(x => x.id === sw.wordId);
    return {
      wordId: sw.wordId,
      hanzi: w?.hanzi || '',
      pinyin: w?.pinyin || '',
      meaningVi: w?.meaningVi || '',
      lessonTitle: 'Bài học',
      nextReview: sw.srs.dueAt < Date.now() ? 'Hôm nay' : 'Ngày mai'
    };
  });

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="bg-white rounded-3xl p-5 border border-[#E7E7EA]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FDF1F1] text-[#B91B1C] flex items-center justify-center">
            <Bookmark className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#18181B]">Kho lưu trữ</h1>
            <p className="text-sm text-[#5F6368]">Bài học và từ vựng bạn đã lưu</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex border-b border-[#E7E7EA]">
          <button
            onClick={() => setActiveTab('lessons')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors -mb-px ${
              activeTab === 'lessons'
                ? 'border-[#B91B1C] text-[#B91B1C]'
                : 'border-transparent text-[#5F6368] hover:text-[#18181B]'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            Bài học đã lưu ({savedLessons.length})
          </button>

          <button
            onClick={() => setActiveTab('vocab')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors -mb-px ${
              activeTab === 'vocab'
                ? 'border-[#B91B1C] text-[#B91B1C]'
                : 'border-transparent text-[#5F6368] hover:text-[#18181B]'
            }`}
          >
            <BookMarked className="w-4 h-4" />
            Từ vựng đã lưu ({displayWords.length})
          </button>
        </div>
      </div>

      {/* Saved lessons tab */}
      {activeTab === 'lessons' && (
        savedLessons.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {savedLessons.map((lesson) => (
              <div key={lesson.id} className="relative group">
                <VideoCard lesson={lesson} onSelect={onSelectLesson} />
                <button
                  onClick={() => onRemoveSavedLesson?.(lesson.id)}
                  className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/90 border border-[#E7E7EA] text-[#8B9097] hover:text-[#B91B1C] hover:bg-[#FDF1F1] opacity-0 group-hover:opacity-100 transition-all shadow-xs"
                  title="Bỏ lưu bài học"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-12 border border-[#E7E7EA] text-center">
            <Bookmark className="w-10 h-10 text-[#E7E7EA] mx-auto mb-3" />
            <h3 className="font-bold text-[#18181B] mb-1">Chưa có bài học nào được lưu</h3>
            <p className="text-sm text-[#5F6368] mb-4">Nhấn biểu tượng bookmark khi xem bài học để lưu vào đây.</p>
            <button className="h-10 px-6 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] text-white text-sm font-bold shadow-xs transition-colors" onClick={() => document.getElementById('feed-nav')?.click()}>
              Khám phá bài học
            </button>
          </div>
        )
      )}

      {/* Vocabulary tab */}
      {activeTab === 'vocab' && (
        <div className="bg-white rounded-3xl border border-[#E7E7EA] overflow-hidden">
          {displayWords.length > 0 ? (
            <>
              <div className="hidden sm:grid grid-cols-[2fr_1fr_2fr_1fr_auto] gap-4 px-5 py-3 bg-[#F7F7F9] border-b border-[#E7E7EA] text-xs font-bold text-[#8B9097] uppercase tracking-wide">
                <span>Từ</span>
                <span>Pinyin</span>
                <span>Nghĩa</span>
                <span>Ôn tập</span>
                <span></span>
              </div>

              <div className="divide-y divide-[#E7E7EA]">
                {displayWords.map((word) => (
                  <div key={word.wordId} className="px-5 py-4 flex flex-col sm:grid sm:grid-cols-[2fr_1fr_2fr_1fr_auto] gap-2 sm:gap-4 items-start sm:items-center hover:bg-[#F7F7F9] transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-[#18181B]" lang="zh">{word.hanzi}</span>
                      <button
                        onClick={() => playPronunciation(word.hanzi)}
                        aria-label={`Phát âm ${word.hanzi}`}
                        className="p-1.5 rounded-full hover:bg-[#FDF1F1] text-[#5F6368] hover:text-[#B91B1C] transition-colors"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-sm text-[#B91B1C] font-mono">{word.pinyin}</span>
                    <div>
                      <span className="text-sm text-[#18181B] font-semibold">{word.meaningVi}</span>
                      <div className="text-[11px] text-[#8B9097] mt-0.5">Nguồn: {word.lessonTitle}</div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[#5F6368]">
                      <RotateCcw className="w-3 h-3" />
                      {word.nextReview}
                    </div>
                    <button
                      onClick={() => handleRemoveWord(word.wordId)}
                      aria-label={`Xóa từ ${word.hanzi}`}
                      className="p-1.5 rounded-full hover:bg-[#FDF1F1] text-[#8B9097] hover:text-[#B91B1C] transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-12 text-center">
              <BookMarked className="w-10 h-10 text-[#E7E7EA] mx-auto mb-3" />
              <h3 className="font-bold text-[#18181B] mb-1">Chưa có từ vựng nào được lưu</h3>
              <p className="text-sm text-[#5F6368]">Chạm vào từ trong video để tra nghĩa và lưu vào danh sách ôn tập.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
