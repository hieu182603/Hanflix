'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  ChevronRight,
  BookOpenCheck,
  Volume2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getLearnerGrammarList, getLearnerGrammarStats, type GrammarItem } from '../../api/grammar';
import { Spinner } from '../notifications';
import AdminPaginationBar, { ADMIN_PAGE_SIZE_OPTIONS } from '../admin/AdminPaginationBar';

// HSK Level config matching admin style
const HSK_LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

const HSK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '1': { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  '2': { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  '3': { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  '4': { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  '5': { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  '6': { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  '7': { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
  '8': { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
  '9': { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
  '7-9': { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
};

interface GrammarPageProps {
  onStartPractice?: () => void;
}

interface GrammarStats {
  total: number;
  byLevel: Record<string, number>;
}

export default function GrammarPage({ onStartPractice }: GrammarPageProps) {
  const [selectedHsk, setSelectedHsk] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedGrammar, setSelectedGrammar] = useState<GrammarItem | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(ADMIN_PAGE_SIZE_OPTIONS[1]); // default 8
  const [speakingText, setSpeakingText] = useState<string | null>(null);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch stats
  const statsQuery = useQuery<GrammarStats, Error>({
    queryKey: ['grammar-stats'],
    queryFn: getLearnerGrammarStats,
  });

  // Fetch grammar list - use a stable query by removing placeholderData so filter changes refetch fresh
  const grammarQuery = useQuery({
    queryKey: ['grammar-list', page, pageSize, selectedHsk, debouncedSearch],
    queryFn: () => getLearnerGrammarList({
      page,
      limit: pageSize,
      hskLevel: selectedHsk || undefined,
      search: debouncedSearch || undefined,
    }),
    staleTime: 0, // always consider stale so new filter triggers refetch
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const playAudio = (text: string) => {
    if (!text || !('speechSynthesis' in window)) return;
    setSpeakingText(text);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
    setTimeout(() => setSpeakingText(null), 1400);
  };

  const handleHskFilter = (level: string) => {
    setSelectedHsk(prev => prev === level ? '' : level);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    // Scroll to table top on page change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header - Matching Admin Style */}
      <div className="bg-white border-b border-[#F2E4D8]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
          {/* Top Banner */}
          <div className="relative overflow-hidden rounded-3xl border border-[#F2E4D8] bg-white p-6 shadow-2xs mb-6">
            <div className="absolute -right-6 -bottom-8 select-none font-serif text-8xl font-black text-[#B91B1C]/5">
              法
            </div>
            <div className="relative z-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FDF1F1] text-[#B91B1C] shadow-2xs ring-1 ring-[#B91B1C]/20">
                  <BookOpenCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-black tracking-tight text-[#2B2826]">Ngữ Pháp HSK 3.0</h1>
                    <span className="rounded-full border border-[#F9D2D2] bg-[#FDF1F1] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#B91B1C]">
                      HSK 1 - 9
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#8C827A]">
                    Hệ thống cấu trúc câu và công thức ngữ pháp chuẩn từ HSK 1 đến HSK 9.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* HSK Filter Bento - Matching Admin */}
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2.5 mb-4">
            <button
              onClick={() => handleHskFilter('')}
              className={`p-3 rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer ${
                selectedHsk === ''
                  ? 'bg-[#2B2826] text-white border-[#2B2826] shadow-2xs'
                  : 'bg-white border-[#F2E4D8] hover:border-[#B91B1C]/40'
              }`}
            >
              <div className={`text-[10px] font-extrabold uppercase ${selectedHsk === '' ? 'text-[#E5DCD3]' : 'text-[#8C827A]'}`}>
                Tất cả
              </div>
              <div className="text-lg font-black mt-0.5">{statsQuery.data?.total ?? '—'}</div>
            </button>

            {HSK_LEVELS.map((lvl) => {
              const count = statsQuery.data?.byLevel[lvl] || (lvl === '7' || lvl === '8' || lvl === '9' ? statsQuery.data?.byLevel['7-9'] : 0) || 0;
              const isSelected = selectedHsk === lvl;
              const styling = HSK_COLORS[lvl] || HSK_COLORS['1'];

              return (
                <button
                  key={lvl}
                  onClick={() => handleHskFilter(lvl)}
                  className={`p-3 rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-[#B91B1C] bg-[#FDF1F1]/50 border-transparent shadow-xs'
                      : 'bg-white border-[#F2E4D8] hover:border-[#B91B1C]/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black border ${styling.bg} ${styling.text} ${styling.border}`}>
                      HSK {lvl}
                    </span>
                  </div>
                  <div className="text-lg font-black text-[#2B2826] mt-1">{count || '—'}</div>
                </button>
              );
            })}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8C827A]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm cấu trúc, công thức hoặc giải thích nghĩa..."
              className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-[#F2E4D8] bg-[#FFF9F5] text-sm font-medium text-[#2B2826] placeholder:text-[#8C827A] focus:border-[#B91B1C] focus:ring-2 focus:ring-[#B91B1C]/10 focus:bg-white outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#FFF9F5] hover:bg-[#F2E4D8] flex items-center justify-center text-[#8C827A] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Grammar Table - Matching Admin Style */}
        <div className="bg-white rounded-3xl border border-[#F2E4D8] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead className="bg-[#FFF9F5] border-b border-[#F2E4D8] text-[#8C827A] uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="p-4 w-[200px]">Cấu trúc</th>
                  <th className="p-4 w-[200px]">Công thức</th>
                  <th className="p-4">Giải thích</th>
                  <th className="p-4 w-[100px]">Cấp độ</th>
                  <th className="p-4 w-[60px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2E4D8]">
                {grammarQuery.isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-[#8C827A]">
                      <div className="inline-flex items-center gap-2">
                        <Spinner size="sm" tone="brand" />
                        <span>Đang tải danh sách ngữ pháp...</span>
                      </div>
                    </td>
                  </tr>
                ) : grammarQuery.data?.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-[#8C827A]">
                      Không tìm thấy điểm ngữ pháp nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  grammarQuery.data?.items.map((item) => {
                    const lvlKey = String(item.hskLevel);
                    const styling = HSK_COLORS[lvlKey] || HSK_COLORS['1'];

                    return (
                      <tr
                        key={item._id}
                        className="hover:bg-[#FFF9F5]/70 transition-colors cursor-pointer group"
                        onClick={() => setSelectedGrammar(item)}
                      >
                        {/* Structure */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="font-serif text-base font-black text-[#2B2826] tracking-wide">
                              {item.structure}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); playAudio(item.structure); }}
                              className={`p-1 rounded-lg border transition-all opacity-0 group-hover:opacity-100 ${
                                speakingText === item.structure
                                  ? 'bg-[#B91B1C] text-white border-[#B91B1C]'
                                  : 'bg-white text-[#8C827A] border-[#F2E4D8] hover:border-[#B91B1C] hover:text-[#B91B1C]'
                              }`}
                              title="Nghe phát âm"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {item.group && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFF9F5] text-[#8C827A] border border-[#F2E4D8]">
                              {item.group}
                            </span>
                          )}
                        </td>

                        {/* Pattern */}
                        <td className="p-4">
                          {item.pattern ? (
                            <div className="font-mono text-[11px] font-bold text-[#2B2826] bg-[#FFF9F5] px-2.5 py-1.5 rounded-xl border border-[#F2E4D8] max-w-[190px] truncate">
                              {item.pattern}
                            </div>
                          ) : (
                            <span className="text-[#8C827A] text-[11px] italic">—</span>
                          )}
                        </td>

                        {/* Explanation */}
                        <td className="p-4">
                          <div className="text-[#2B2826] font-semibold text-xs leading-relaxed max-w-[300px] line-clamp-2">
                            {item.explanationVi}
                          </div>
                        </td>

                        {/* HSK Level */}
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-md font-black text-[10px] border ${styling.bg} ${styling.text} ${styling.border}`}>
                            HSK {item.hskLevel}
                          </span>
                        </td>

                        {/* Expand */}
                        <td className="p-4 text-center">
                          <ChevronRight className="w-4 h-4 text-[#8C827A] group-hover:text-[#B91B1C] transition-colors inline" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Admin-style Pagination Bar */}
        {grammarQuery.data && (
          <div className="mt-4">
            <AdminPaginationBar
              total={grammarQuery.data.pagination.total}
              page={page}
              pageSize={pageSize}
              visibleCount={grammarQuery.data.items.length}
              unitLabel="điểm ngữ pháp"
              disabled={grammarQuery.isLoading}
              ariaLabel="Phân trang ngữ pháp"
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedGrammar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setSelectedGrammar(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-[#F2E4D8]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 pt-6 pb-4 border-b border-[#F2E4D8] bg-[#FFF9F5]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {selectedGrammar.code && (
                      <span className="px-3 py-1 rounded-lg bg-white text-[#8C827A] text-xs font-mono font-bold border border-[#F2E4D8]">
                        {selectedGrammar.code}
                      </span>
                    )}
                    <span className={`px-3 py-1 rounded-full text-xs font-black border ${HSK_COLORS[String(selectedGrammar.hskLevel)]?.bg || 'bg-[#FDF1F1]'} ${HSK_COLORS[String(selectedGrammar.hskLevel)]?.text || 'text-[#B91B1C]'} ${HSK_COLORS[String(selectedGrammar.hskLevel)]?.border || 'border-[#F9D2D2]'}`}>
                      HSK {selectedGrammar.hskLevel}
                    </span>
                    {selectedGrammar.group && (
                      <span className="px-2.5 py-1 rounded-lg bg-white text-[#8C827A] text-xs font-bold border border-[#F2E4D8]">
                        {selectedGrammar.group}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedGrammar(null)}
                    className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center text-[#8C827A] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Structure with Audio */}
                <div className="mb-6 flex items-start gap-3">
                  <div className="flex-1">
                    <h2 className="font-serif text-2xl lg:text-3xl font-black text-[#2B2826] leading-tight">
                      {selectedGrammar.structure}
                    </h2>
                    {selectedGrammar.pattern && (
                      <p className="text-sm text-[#8C827A] font-mono mt-1">{selectedGrammar.pattern}</p>
                    )}
                  </div>
                  <button
                    onClick={() => playAudio(selectedGrammar.structure)}
                    className={`p-3 rounded-2xl border transition-all ${
                      speakingText === selectedGrammar.structure
                        ? 'bg-[#B91B1C] text-white border-[#B91B1C]'
                        : 'bg-[#FFF9F5] text-[#8C827A] border-[#F2E4D8] hover:border-[#B91B1C] hover:text-[#B91B1C]'
                    }`}
                    title="Nghe phát âm"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Explanation */}
                <div className="mb-6">
                  <h3 className="text-[10px] font-extrabold uppercase text-[#8C827A] tracking-wider mb-2">Giải thích</h3>
                  <p className="text-sm text-[#2B2826] leading-relaxed font-medium">
                    {selectedGrammar.explanationVi}
                  </p>
                  {selectedGrammar.explanationEn && (
                    <p className="text-xs text-[#8C827A] mt-2 italic">
                      {selectedGrammar.explanationEn}
                    </p>
                  )}
                </div>

                {/* Examples */}
                {selectedGrammar.examples && selectedGrammar.examples.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-extrabold uppercase text-[#8C827A] tracking-wider mb-3">Ví dụ</h3>
                    <div className="space-y-3">
                      {selectedGrammar.examples.map((example, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-2xl bg-[#FFF9F5] border border-[#F2E4D8] group"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-serif text-base font-black text-[#2B2826]">
                                  {example.chinese}
                                </span>
                                <button
                                  onClick={() => speakChinese(example.chinese)}
                                  className="p-1.5 rounded-lg border border-[#F2E4D8] bg-white text-[#8C827A] hover:text-[#B91B1C] hover:border-[#B91B1C] transition-colors opacity-0 group-hover:opacity-100"
                                  title="Nghe phát âm"
                                >
                                  <Volume2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {example.pinyin && (
                                <p className="text-xs text-[#8C827A] font-mono mb-1">{example.pinyin}</p>
                              )}
                              {(example.vietnamese || example.english) && (
                                <p className="text-xs text-[#2B2826]">{example.vietnamese || example.english}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {selectedGrammar.tags && selectedGrammar.tags.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-[#F2E4D8]">
                    <div className="flex flex-wrap gap-2">
                      {selectedGrammar.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-3 py-1.5 rounded-full bg-[#FDF1F1] text-[#B91B1C] text-xs font-bold border border-[#F9D2D2]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-[#F2E4D8] bg-[#FFF9F5] flex items-center justify-end">
                <button
                  onClick={() => setSelectedGrammar(null)}
                  className="px-6 py-2.5 rounded-xl bg-[#2B2826] text-white text-xs font-bold hover:bg-[#1a1917] transition-colors"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper function for examples audio
function speakChinese(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}
