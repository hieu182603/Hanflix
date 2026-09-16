import React, { useState } from 'react';
import { X, Play, Pause, Bookmark, Sparkles, Volume2, CheckCircle2, RotateCcw, MessageSquare, BookOpen, Share2 } from 'lucide-react';
import { VideoLesson } from '../data/hanflixData';

interface VideoPlayerModalProps {
  lesson: VideoLesson | null;
  onClose: () => void;
  onAskAI: (prompt: string) => void;
  isSaved?: boolean;
  onToggleSave?: (lesson: VideoLesson) => void;
  guestMode?: boolean;
}

export default function VideoPlayerModal({ lesson, onClose, onAskAI, isSaved = false, onToggleSave, guestMode = false }: VideoPlayerModalProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'vocabulary' | 'transcript' | 'grammar'>('vocabulary');
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);

  if (!lesson) return null;

  const playPronunciation = (word: string) => {
    setSpeakingWord(word);
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'zh-CN';
      window.speechSynthesis.speak(utterance);
    }
    setTimeout(() => setSpeakingWord(null), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl border border-[#E7E7EA] my-auto max-h-[92vh] flex flex-col">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-[#E7E7EA] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            {guestMode && (
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                Đang xem bài mẫu
              </span>
            )}
            <span className="px-3 py-1 rounded-full bg-[#34363A] text-white text-xs font-bold">
              {lesson.hskLevel}
            </span>
            <span className="px-3 py-1 rounded-full bg-[#FDF1F1] text-[#B91B1C] text-xs font-bold">
              {lesson.category}
            </span>
            <h2 className="text-lg font-extrabold text-[#18181B] line-clamp-1">
              {lesson.title} ({lesson.chineseTitle})
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => lesson && onToggleSave?.(lesson)}
              className={`p-2 rounded-full border transition-colors ${
                isSaved ? 'bg-[#FDF1F1] border-[#B91B1C] text-[#B91B1C]' : 'border-[#E7E7EA] text-[#5F6368] hover:bg-[#F7F7F9]'
              }`}
              title={isSaved ? 'Đã lưu' : 'Lưu bài học'}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-full border border-[#E7E7EA] text-[#5F6368] hover:bg-[#F7F7F9] hover:text-[#18181B] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 overflow-y-auto flex-1">
          {/* Left Video Player area (7 cols) */}
          <div className="lg:col-span-7 bg-slate-950 p-4 flex flex-col justify-center items-center relative min-h-[320px] lg:min-h-[440px]">
            {/* Mock Video Container */}
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-inner flex items-center justify-center group">
              <img
                src={lesson.thumbnail}
                alt={lesson.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Subtitles Overlay */}
              {lesson.transcript && lesson.transcript.length > 0 && (
                <div className="absolute bottom-12 left-4 right-4 text-center z-10 px-4 py-2 bg-black/70 backdrop-blur-md rounded-xl text-white border border-white/10">
                  <div className="text-xl md:text-2xl font-bold font-mono tracking-wide text-yellow-300">
                    {lesson.transcript[0].chinese}
                  </div>
                  <div className="text-xs text-gray-300 font-mono mt-0.5">
                    {lesson.transcript[0].pinyin}
                  </div>
                  <div className="text-xs text-white font-medium mt-1">
                    ({lesson.transcript[0].vietnamese})
                  </div>
                </div>
              )}

              {/* Center Play/Pause button */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-[#B91B1C] text-white flex items-center justify-center shadow-2xl hover:scale-105 transition-transform z-20"
              >
                {isPlaying
                  ? <Pause className="w-8 h-8" style={{ fill: 'white', stroke: 'white' }} />
                  : <Play className="w-8 h-8 ml-1" style={{ fill: 'white', stroke: 'white' }} />}
              </button>
            </div>

            {/* Video Control Bar */}
            <div className="w-full mt-4 flex items-center justify-between text-white text-xs px-2">
              <span className="font-mono text-gray-400">0:08 / {lesson.duration}</span>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => onAskAI(`Giải thích ngữ pháp và từ vựng trong bài "${lesson.title}"`)}
                  className="px-3.5 py-1.5 rounded-full bg-[#B91B1C] text-white font-semibold flex items-center gap-1.5 hover:bg-[#A3181A] transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-white" />
                  <span>Hỏi AI về bài này</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Learning Material Sidebar (5 cols) */}
          <div className="lg:col-span-5 bg-white border-l border-[#E7E7EA] flex flex-col h-full">
            {/* Tabs Header */}
            <div className="flex border-b border-[#E7E7EA] bg-[#F7F7F9]">
              <button
                onClick={() => setActiveTab('vocabulary')}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                  activeTab === 'vocabulary'
                    ? 'border-[#B91B1C] text-[#B91B1C] bg-white'
                    : 'border-transparent text-[#5F6368] hover:text-[#18181B]'
                }`}
              >
                Từ vựng cốt lõi ({lesson.vocabularyList?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('transcript')}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                  activeTab === 'transcript'
                    ? 'border-[#B91B1C] text-[#B91B1C] bg-white'
                    : 'border-transparent text-[#5F6368] hover:text-[#18181B]'
                }`}
              >
                Lời thoại song ngữ
              </button>
              <button
                onClick={() => setActiveTab('grammar')}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                  activeTab === 'grammar'
                    ? 'border-[#B91B1C] text-[#B91B1C] bg-white'
                    : 'border-transparent text-[#5F6368] hover:text-[#18181B]'
                }`}
              >
                Ngữ pháp
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4 max-h-[380px] lg:max-h-[480px]">
              {activeTab === 'vocabulary' && (
                <div className="space-y-3">
                  {lesson.vocabularyList?.map((vocab, index) => (
                    <div
                      key={index}
                      className="p-3.5 rounded-2xl bg-[#F7F7F9] border border-[#E7E7EA] hover:border-[#B91B1C]/30 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-bold font-mono text-[#18181B]">
                            {vocab.word}
                          </span>
                          <span className="text-xs font-semibold text-[#B91B1C] font-mono">
                            [{vocab.pinyin}]
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-gray-200 text-[#5F6368]">
                            {vocab.type}
                          </span>
                        </div>

                        <button
                          onClick={() => playPronunciation(vocab.word)}
                          className={`p-1.5 rounded-full border transition-colors ${
                            speakingWord === vocab.word
                              ? 'bg-[#B91B1C] text-white border-[#B91B1C]'
                              : 'bg-white border-[#E7E7EA] text-[#5F6368] hover:text-[#B91B1C]'
                          }`}
                          title="Nghe phát âm AI"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-sm font-bold text-[#18181B] mt-1">
                        {vocab.meaning}
                      </div>

                      <div className="text-xs text-[#5F6368] mt-1.5 pt-1.5 border-t border-[#E7E7EA]">
                        <span className="font-semibold text-gray-700">Ví dụ: </span>
                        {vocab.example}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'grammar' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-[#FDF6F5] border border-[#B91B1C]/15">
                    <div className="text-xs font-bold text-[#B91B1C] mb-1.5">Điểm ngữ pháp chính</div>
                    <div className="text-lg font-bold text-[#18181B] font-mono mb-1">请 + Động từ + 一下</div>
                    <div className="text-xs text-[#5F6368]">Cấu trúc lịch sự: "Xin vui lòng làm gì đó một chút"</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#F7F7F9] border border-[#E7E7EA]">
                    <div className="text-xs font-bold text-[#18181B] mb-2">Ví dụ từ bài học</div>
                    {(lesson.transcript || []).slice(0, 3).map((item, i) => (
                      <div key={i} className="text-xs text-[#5F6368] mb-1.5 pb-1.5 border-b border-[#E7E7EA] last:border-0">
                        <span className="text-[#18181B] font-mono font-semibold">{item.chinese}</span>
                        <span className="mx-1 text-[#8B9097]">—</span>
                        {item.vietnamese}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => onAskAI(`Giải thích ngữ pháp chi tiết trong bài "${lesson.title}"`)}
                    className="w-full py-2.5 rounded-xl bg-[#FDF1F1] text-[#B91B1C] font-bold text-xs hover:bg-[#B91B1C] hover:text-white transition-colors flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Hỏi AI giải thích thêm
                  </button>
                </div>
              )}

              {activeTab === 'transcript' && (
                <div className="space-y-3">
                  {lesson.transcript?.map((item, index) => (
                    <div
                      key={index}
                      className="p-3.5 rounded-2xl bg-[#F7F7F9] border border-[#E7E7EA] space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs font-mono text-[#8B9097]">
                        <span>Thời gian {item.time}</span>
                        <button
                          onClick={() => playPronunciation(item.chinese)}
                          className="text-[#B91B1C] hover:underline flex items-center gap-1 text-[11px]"
                        >
                          <Volume2 className="w-3 h-3" /> Nghe câu
                        </button>
                      </div>

                      <div className="text-base font-bold text-[#18181B] font-mono">
                        {item.chinese}
                      </div>
                      <div className="text-xs text-[#B91B1C] font-mono font-medium">
                        {item.pinyin}
                      </div>
                      <div className="text-xs text-[#5F6368] pt-1 border-t border-[#E7E7EA]">
                        {item.vietnamese}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Actions inside player */}
            <div className="p-4 border-t border-[#E7E7EA] bg-white flex items-center justify-between gap-3">
              <button
                onClick={() => onAskAI(`Tạo 3 câu trắc nghiệm thực hành dựa trên từ vựng bài "${lesson.title}"`)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#FDF1F1] text-[#B91B1C] font-bold text-xs hover:bg-[#B91B1C] hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Tạo câu hỏi ôn tập</span>
              </button>

              <button
                onClick={onClose}
                className="py-2.5 px-5 rounded-xl bg-[#18181B] text-white font-bold text-xs hover:bg-black transition-colors"
              >
                Hoàn thành
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
