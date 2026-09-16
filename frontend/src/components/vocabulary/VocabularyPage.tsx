import React, { useState } from 'react';
import { BookOpen, Volume2, Search, Zap, Trash2, ArrowRight, Clock } from 'lucide-react';
import { Word, SAMPLE_WORDS, SavedWord } from '../../data/hanflixData';

interface VocabularyPageProps {
  savedWords: SavedWord[];
  onStartReviewSession: () => void;
  onRemoveWord: (wordId: string) => void;
}

export default function VocabularyPage({
  savedWords,
  onStartReviewSession,
  onRemoveWord
}: VocabularyPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);

  const allWords = savedWords.map(sw => {
    const w = SAMPLE_WORDS.find(x => x.id === sw.wordId);
    return {
      id: sw.wordId,
      hanzi: w?.hanzi || '',
      pinyin: w?.pinyin || '',
      meaningVi: w?.meaningVi || '',
      partOfSpeech: w?.partOfSpeech || '',
      isDue: sw.srs.dueAt < Date.now()
    };
  });
  
  const displayWords = allWords.filter((w) =>
    w.hanzi.includes(searchQuery) ||
    w.pinyin.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.meaningVi.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const dueCount = allWords.filter(w => w.isDue).length;
  const practicingCount = Math.max(0, Math.min(3, allWords.length - dueCount));
  const masteredCount = Math.max(0, savedWords.length - dueCount - practicingCount);

  const playPronunciation = (hanzi: string) => {
    setSpeakingWord(hanzi);
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(hanzi);
      utterance.lang = 'zh-CN';
      window.speechSynthesis.speak(utterance);
    }
    setTimeout(() => setSpeakingWord(null), 1000);
  };

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#18181B] tracking-tight">Từ Vựng Đã Lưu & Lịch Ôn Tập</h1>
          <p className="text-xs text-[#5F6368] mt-1">Danh sách từ vựng tra cứu từ các bài học video, tích hợp thuật toán ôn tập lặp lại ngắt quãng (SRS)</p>
        </div>

        <button
          onClick={onStartReviewSession}
          className="h-11 px-6 rounded-2xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors shrink-0"
        >
          <Zap className="w-4 h-4 fill-white" />
          <span>Ôn tập ngay ({dueCount} từ đến hạn)</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-[#E7E7EA]">
          <div className="text-xs font-bold text-[#8B9097]">Tổng số từ đã lưu</div>
          <div className="text-xl font-black text-[#18181B] mt-1">{allWords.length} từ</div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-[#E7E7EA]">
          <div className="text-xs font-bold text-[#8B9097]">Cần ôn hôm nay</div>
          <div className="text-xl font-black text-[#B91B1C] mt-1">{dueCount} từ</div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-[#E7E7EA]">
          <div className="text-xs font-bold text-[#8B9097]">Đang luyện tập</div>
          <div className="text-xl font-black text-[#E7A92F] mt-1">{practicingCount} từ</div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-[#E7E7EA]">
          <div className="text-xs font-bold text-[#8B9097]">Đã nhớ tốt</div>
          <div className="text-xl font-black text-[#188A5A] mt-1">{masteredCount} từ</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E7E7EA]">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-[#8B9097] absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Tìm theo chữ Hán, Pinyin hoặc nghĩa tiếng Việt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl text-xs outline-none focus:border-[#B91B1C]"
          />
        </div>
      </div>

      {/* Word Table List */}
      <div className="bg-white rounded-2xl border border-[#E7E7EA] overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F7F7F9] border-b border-[#E7E7EA] text-[#8B9097] uppercase font-bold text-[10px]">
            <tr>
              <th className="p-4">Chữ Hán</th>
              <th className="p-4">Phiên âm Pinyin</th>
              <th className="p-4">Nghĩa Tiếng Việt</th>
              <th className="p-4">Loại từ</th>
              <th className="p-4">Phát âm AI</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E7EA]">
            {displayWords.map((word) => (
              <tr key={word.id} className="hover:bg-[#F7F7F9]/50 transition-colors">
                <td className="p-4 font-mono text-xl font-black text-[#18181B]">{word.hanzi}</td>
                <td className="p-4 font-mono font-bold text-[#B91B1C]">{word.pinyin}</td>
                <td className="p-4 font-bold text-[#18181B]">{word.meaningVi}</td>
                <td className="p-4 text-[#5F6368]">{word.partOfSpeech}</td>
                <td className="p-4">
                  <button
                    onClick={() => playPronunciation(word.hanzi)}
                    className={`p-1.5 rounded-full border transition-colors ${
                      speakingWord === word.hanzi
                        ? 'bg-[#B91B1C] text-white border-[#B91B1C]'
                        : 'border-[#E7E7EA] text-[#5F6368] hover:text-[#B91B1C]'
                    }`}
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => onRemoveWord(word.id)}
                    className="p-1.5 rounded-lg border border-[#E7E7EA] hover:bg-[#FDF1F1] text-[#B91B1C]"
                    title="Bỏ lưu từ vựng"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {displayWords.length === 0 && (
          <div className="p-8 text-center text-[#5F6368] text-sm">
            Chưa có từ vựng nào được lưu.
          </div>
        )}
      </div>
    </div>
  );
}
