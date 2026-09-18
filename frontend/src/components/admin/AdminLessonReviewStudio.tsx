import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Video,
  Play,
  Pause,
  Subtitles,
  HelpCircle,
  Save,
  CheckCircle2,
  RotateCcw,
  Search,
  Plus,
  Copy,
  Trash2,
  Volume2,
  Clock,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Edit2,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';
import type { AdminCue, AdminLesson, AdminQuestion, AdminReview } from '../../api/admin';

const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const HSK_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-[#E6F4EA]', text: 'text-[#137333]', border: 'border-[#CEEAD6]' },
  2: { bg: 'bg-[#E8F0FE]', text: 'text-[#1A73E8]', border: 'border-[#D2E3FC]' },
  3: { bg: 'bg-[#F3E8FD]', text: 'text-[#9334E6]', border: 'border-[#E9D5FF]' },
  4: { bg: 'bg-[#FEF7E0]', text: 'text-[#B06000]', border: 'border-[#FEEFC3]' },
  5: { bg: 'bg-[#FFF0E6]', text: 'text-[#EA580C]', border: 'border-[#FED7AA]' },
  6: { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#FAD2CF]' },
  7: { bg: 'bg-[#F1F5F9]', text: 'text-[#475569]', border: 'border-[#CBD5E1]' },
  8: { bg: 'bg-[#F8FAFC]', text: 'text-[#334155]', border: 'border-[#94A3B8]' },
  9: { bg: 'bg-[#0F172A]', text: 'text-white', border: 'border-[#1E293B]' },
};

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

export interface AdminLessonReviewStudioProps {
  lesson: AdminLesson;
  media: { url: string; mimeType: string; sizeBytes: number } | null;
  review: AdminReview | null;
  cues: AdminCue[];
  questions: AdminQuestion[];
  dirty: { metadata: boolean; subtitles: boolean; quiz: boolean };
  busy: boolean;
  titleVi: string;
  setTitleVi: (v: string) => void;
  titleZh: string;
  setTitleZh: (v: string) => void;
  descriptionVi: string;
  setDescriptionVi: (v: string) => void;
  onCuesChange: (cues: AdminCue[]) => void;
  onQuestionsChange: (questions: AdminQuestion[]) => void;
  onSaveMetadata: () => Promise<void>;
  onSaveSubtitles: () => Promise<void>;
  onSaveQuiz: () => Promise<void>;
  onPublishAll: () => Promise<void>;
  onReload: () => Promise<void>;
  onBackToVideos: () => void;
}

export default function AdminLessonReviewStudio({
  lesson,
  media,
  review,
  cues,
  questions,
  dirty,
  busy,
  titleVi,
  setTitleVi,
  titleZh,
  setTitleZh,
  descriptionVi,
  setDescriptionVi,
  onCuesChange,
  onQuestionsChange,
  onSaveMetadata,
  onSaveSubtitles,
  onSaveQuiz,
  onPublishAll,
  onReload,
  onBackToVideos,
}: AdminLessonReviewStudioProps) {
  // Tabs: 'subtitles' vs 'quiz'
  const [activeTab, setActiveTab] = useState<'subtitles' | 'quiz'>('subtitles');

  // Video playback sync
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Subtitle cue search & pagination
  const [cueSearch, setCueSearch] = useState('');
  const [cuePage, setCuePage] = useState(1);
  const CUE_PAGE_SIZE = 20;

  // Audio test
  const [speakingText, setSpeakingText] = useState<string | null>(null);

  const hasAnyDirty = dirty.metadata || dirty.subtitles || dirty.quiz;

  // Track video time update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTimeMs(Math.round(videoRef.current.currentTime * 1000));
    }
  };

  const jumpToTime = (ms: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = ms / 1000;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // Active cue for video overlay
  const activeCue = useMemo(() => {
    return cues.find((c) => currentTimeMs >= c.startMs && currentTimeMs <= c.endMs);
  }, [cues, currentTimeMs]);

  // Filtered cues
  const filteredCues = useMemo(() => {
    const q = cueSearch.trim().toLowerCase();
    if (!q) return cues;
    return cues.filter(
      (c) =>
        c.zh.toLowerCase().includes(q) ||
        c.vi.toLowerCase().includes(q) ||
        c.pinyin.toLowerCase().includes(q)
    );
  }, [cues, cueSearch]);

  const totalCuePages = Math.max(1, Math.ceil(filteredCues.length / CUE_PAGE_SIZE));
  const pagedCues = useMemo(() => {
    const start = (cuePage - 1) * CUE_PAGE_SIZE;
    return filteredCues.slice(start, start + CUE_PAGE_SIZE);
  }, [filteredCues, cuePage, CUE_PAGE_SIZE]);

  const handlePatchCue = (index: number, patch: Partial<AdminCue>) => {
    const updated = cues.map((c, i) => (i === index ? { ...c, ...patch } : c));
    onCuesChange(updated);
  };

  const handleDuplicateCue = (index: number) => {
    const src = cues[index];
    if (!src) return;
    const duration = Math.max(1500, src.endMs - src.startMs);
    const newCue: AdminCue = {
      cueId: `cue-${Date.now().toString(36)}`,
      startMs: src.endMs,
      endMs: src.endMs + duration,
      zh: src.zh,
      pinyin: src.pinyin,
      vi: src.vi,
    };
    const next = [...cues.slice(0, index + 1), newCue, ...cues.slice(index + 1)];
    onCuesChange(next);
  };

  const handleRemoveCue = (index: number) => {
    if (!window.confirm(`Xóa câu thoại #${index + 1}?`)) return;
    onCuesChange(cues.filter((_, i) => i !== index));
  };

  const handleAddCue = () => {
    const lastCue = cues[cues.length - 1];
    const startMs = lastCue ? lastCue.endMs : 0;
    const newCue: AdminCue = {
      cueId: `cue-${Date.now().toString(36)}`,
      startMs,
      endMs: startMs + 3000,
      zh: '',
      pinyin: '',
      vi: '',
    };
    onCuesChange([...cues, newCue]);
  };

  const playTTS = (text: string) => {
    if (!text) return;
    setSpeakingText(text);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 0.85;
      window.speechSynthesis.speak(u);
    }
    setTimeout(() => setSpeakingText(null), 1200);
  };

  return (
    <div className="space-y-6">
      {/* Studio Header Bar */}
      <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA] flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToVideos}
            className="p-2.5 rounded-2xl border border-[#E7E7EA] bg-[#F7F7F9] hover:bg-white text-[#5F6368] hover:text-[#18181B] transition-colors"
            title="Quay lại danh sách video"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded font-black text-[10px] bg-[#18181B] text-white">
                HSK {lesson.hsk}
              </span>
              <span
                className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  lesson.status === 'published'
                    ? 'bg-[#E6F4EA] text-[#137333]'
                    : lesson.status === 'ready_for_review'
                    ? 'bg-[#FEF7E0] text-[#B06000]'
                    : 'bg-[#F1F3F4] text-[#5F6368]'
                }`}
              >
                {lesson.status === 'published'
                  ? 'Đã xuất bản'
                  : lesson.status === 'ready_for_review'
                  ? 'Chờ duyệt nội dung'
                  : 'Bản nháp'}
              </span>

              {hasAnyDirty && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#FEF7E0] text-[#B06000] text-[10px] font-bold animate-pulse border border-[#FEEFC3]">
                  Chưa lưu thay đổi
                </span>
              )}
            </div>

            <h1 className="text-2xl font-black text-[#18181B] tracking-tight">{lesson.titleVi}</h1>
          </div>
        </div>

        {/* Global Studio Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onReload}
            disabled={busy}
            className="h-10 px-4 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] hover:bg-white text-[#5F6368] text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-40"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Tải lại từ máy chủ</span>
          </button>

          <button
            type="button"
            disabled={busy || !hasAnyDirty}
            onClick={async () => {
              if (dirty.metadata) await onSaveMetadata();
              if (dirty.subtitles) await onSaveSubtitles();
              if (dirty.quiz) await onSaveQuiz();
            }}
            className="h-10 px-4 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] hover:bg-white text-[#18181B] text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-40 shadow-2xs"
          >
            <Save className="w-4 h-4 text-[#5F6368]" />
            <span>Lưu bản nháp</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={onPublishAll}
            className="h-10 px-5 rounded-xl bg-[#188A5A] hover:bg-[#137333] text-white text-xs font-black flex items-center gap-2 transition-colors shadow-2xs disabled:opacity-40"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Lưu & Xuất Bản Bài Học</span>
          </button>
        </div>
      </div>

      {/* Main Studio 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Video Preview Player + Synced Subtitles + Metadata Form */}
        <div className="lg:col-span-5 space-y-6">
          {/* Video Player Card with Live Subtitle Overlay */}
          <div className="bg-white rounded-3xl border border-[#E7E7EA] overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-[#E7E7EA] flex items-center justify-between">
              <span className="font-bold text-xs text-[#18181B] flex items-center gap-1.5">
                <Video className="w-4 h-4 text-[#B91B1C]" />
                Xem trước video & phụ đề trực tiếp
              </span>
              <span className="font-mono text-xs font-bold text-[#8B9097]">
                {formatMs(currentTimeMs)}
              </span>
            </div>

            <div className="relative aspect-video bg-black flex items-center justify-center">
              {media?.url ? (
                <video
                  ref={videoRef}
                  src={media.url}
                  controls
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="w-full h-full object-contain"
                  preload="metadata"
                />
              ) : (
                <div className="text-center text-[#8B9097] text-xs p-8">
                  <Video className="w-8 h-8 mx-auto mb-2 text-[#5F6368]" />
                  <span>Chưa có tệp video hoặc video đang được xử lý</span>
                </div>
              )}

              {/* Real-time Subtitle Overlay (Chinese on top, Vietnamese below) */}
              {activeCue && isPlaying && (
                <div className="absolute bottom-12 inset-x-4 pointer-events-none text-center animate-in fade-in duration-100">
                  <div className="inline-block bg-black/80 backdrop-blur-xs px-4 py-2 rounded-2xl border border-white/10 text-white max-w-md">
                    <p className="font-serif text-base font-black text-amber-300 tracking-wide drop-shadow-md">
                      {activeCue.zh}
                    </p>
                    <p className="text-xs text-neutral-200 mt-0.5 font-medium drop-shadow-sm">
                      {activeCue.vi}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Lesson Metadata Form */}
          <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA] shadow-2xs space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E7E7EA]">
              <span className="font-black text-sm text-[#18181B]">Thông tin chung bài học</span>
              {dirty.metadata && (
                <span className="text-[10px] text-[#B06000] font-bold">Chưa lưu metadata</span>
              )}
            </div>

            <div>
              <label className="block font-bold text-[#18181B] mb-1">Tiêu đề tiếng Việt</label>
              <input
                value={titleVi}
                onChange={(e) => setTitleVi(e.target.value)}
                className="w-full px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] font-bold text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-[#18181B] mb-1">Tiêu đề tiếng Trung</label>
              <input
                value={titleZh}
                onChange={(e) => setTitleZh(e.target.value)}
                className="w-full px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] font-serif font-bold text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-[#18181B] mb-1">Mô tả bài học</label>
              <textarea
                rows={3}
                value={descriptionVi}
                onChange={(e) => setDescriptionVi(e.target.value)}
                className="w-full p-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] resize-none leading-relaxed"
              />
            </div>

            <button
              type="button"
              disabled={busy || !dirty.metadata}
              onClick={onSaveMetadata}
              className="px-4 py-2 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] hover:bg-white text-[#18181B] font-bold disabled:opacity-40 transition-colors"
            >
              Lưu thông tin bài học
            </button>
          </div>
        </div>

        {/* Right Column: Studio Workspace (Subtitles & Quiz Tabs) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-3xl border border-[#E7E7EA] overflow-hidden shadow-2xs">
            {/* Studio Workspace Header & Tab Toggle */}
            <div className="p-4 border-b border-[#E7E7EA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('subtitles')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                    activeTab === 'subtitles'
                      ? 'bg-[#18181B] text-white shadow-2xs'
                      : 'text-[#5F6368] hover:text-[#18181B]'
                  }`}
                >
                  <Subtitles className="w-3.5 h-3.5" />
                  <span>Phụ đề song ngữ ({cues.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('quiz')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                    activeTab === 'quiz'
                      ? 'bg-[#18181B] text-white shadow-2xs'
                      : 'text-[#5F6368] hover:text-[#18181B]'
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Bộ câu hỏi luyện tập ({questions.length})</span>
                </button>
              </div>

              {activeTab === 'subtitles' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddCue}
                    className="h-8 px-3 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-[11px] font-bold flex items-center gap-1 transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm câu thoại</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy || !dirty.subtitles}
                    onClick={onSaveSubtitles}
                    className="h-8 px-3 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] hover:bg-white text-xs font-bold disabled:opacity-40"
                  >
                    Lưu phụ đề
                  </button>
                </div>
              )}
            </div>

            {/* TAB 1: SUBTITLE CUE EDITOR */}
            {activeTab === 'subtitles' && (
              <div className="p-5 space-y-4">
                {/* Search cues */}
                <div className="relative">
                  <Search className="w-4 h-4 text-[#8B9097] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Tìm câu thoại theo chữ Hán, Pinyin hoặc nghĩa tiếng Việt..."
                    value={cueSearch}
                    onChange={(e) => {
                      setCueSearch(e.target.value);
                      setCuePage(1);
                    }}
                    className="w-full pl-9 pr-4 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl text-xs outline-none focus:border-[#B91B1C]"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#8B9097]">
                  <span>
                    Hiển thị {pagedCues.length} / {filteredCues.length} câu thoại
                  </span>
                  <span>Bấm nút mốc thời gian để nhảy video tới đoạn thoại đó</span>
                </div>

                {/* Cue List Cards */}
                <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                  {pagedCues.map((cue, idx) => {
                    const realIndex = cues.indexOf(cue);
                    const isCueActive = currentTimeMs >= cue.startMs && currentTimeMs <= cue.endMs;

                    return (
                      <div
                        key={cue.cueId}
                        className={`p-4 rounded-2xl border transition-all text-xs space-y-2.5 ${
                          isCueActive
                            ? 'bg-[#FFFAF0] border-[#E7A92F] shadow-xs'
                            : 'bg-white border-[#E7E7EA] hover:border-[#CBD5E1]'
                        }`}
                      >
                        {/* Cue Header (Timestamp + Actions) */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#8B9097] text-[11px]">
                              #{realIndex + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => jumpToTime(cue.startMs)}
                              className="px-2.5 py-1 rounded-lg bg-[#F7F7F9] hover:bg-[#18181B] hover:text-white text-[#18181B] font-mono text-[11px] font-bold border border-[#E7E7EA] flex items-center gap-1 transition-colors"
                              title="Nhảy tới mốc video này"
                            >
                              <Play className="w-3 h-3" />
                              <span>
                                {formatMs(cue.startMs)} – {formatMs(cue.endMs)}
                              </span>
                            </button>
                            <span className="text-[10px] text-[#8B9097]">
                              ({((cue.endMs - cue.startMs) / 1000).toFixed(1)}s)
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => playTTS(cue.zh)}
                              className="p-1 rounded-lg border border-[#E7E7EA] hover:bg-[#F7F7F9] text-[#5F6368]"
                              title="Nghe phát âm Hán tự"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateCue(realIndex)}
                              className="p-1 rounded-lg border border-[#E7E7EA] hover:bg-[#F7F7F9] text-[#5F6368]"
                              title="Sao chép câu thoại này"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveCue(realIndex)}
                              className="p-1 rounded-lg border border-[#E7E7EA] hover:bg-[#FDF1F1] text-[#B91B1C]"
                              title="Xóa câu thoại"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Input Fields (Zh, Pinyin, Vi) */}
                        <div className="space-y-1.5">
                          {/* Chinese Hanzi */}
                          <div className="relative">
                            <input
                              type="text"
                              value={cue.zh}
                              onChange={(e) => handlePatchCue(realIndex, { zh: e.target.value })}
                              placeholder="Câu thoại chữ Hán..."
                              className="w-full px-3 py-1.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] font-serif font-bold text-sm text-[#18181B]"
                            />
                          </div>

                          {/* Pinyin */}
                          <input
                            type="text"
                            value={cue.pinyin}
                            onChange={(e) => handlePatchCue(realIndex, { pinyin: e.target.value })}
                            placeholder="Phiên âm Pinyin..."
                            className="w-full px-3 py-1.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] font-mono text-xs text-[#B91B1C]"
                          />

                          {/* Vietnamese Translation */}
                          <input
                            type="text"
                            value={cue.vi}
                            onChange={(e) => handlePatchCue(realIndex, { vi: e.target.value })}
                            placeholder="Bản dịch nghĩa tiếng Việt..."
                            className="w-full px-3 py-1.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] text-xs text-[#18181B]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Subtitles Pagination */}
                {totalCuePages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-[#E7E7EA] text-xs text-[#5F6368]">
                    <span>
                      Trang {cuePage} / {totalCuePages}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={cuePage <= 1}
                        onClick={() => setCuePage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1 rounded-lg border border-[#E7E7EA] bg-white font-bold disabled:opacity-40"
                      >
                        Trước
                      </button>
                      <button
                        type="button"
                        disabled={cuePage >= totalCuePages}
                        onClick={() => setCuePage((p) => Math.min(totalCuePages, p + 1))}
                        className="px-3 py-1 rounded-lg border border-[#E7E7EA] bg-white font-bold disabled:opacity-40"
                      >
                        Tiếp
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: QUIZ QUESTIONS REVIEW */}
            {activeTab === 'quiz' && (
              <div className="p-5 space-y-4 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-[#E7E7EA]">
                  <div>
                    <h4 className="font-bold text-sm text-[#18181B]">Câu hỏi củng cố bài học ({questions.length})</h4>
                    <p className="text-[11px] text-[#8B9097]">
                      Câu hỏi được tự động hiển thị cho học viên sau khi hoàn thành xem video.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy || !dirty.quiz}
                    onClick={onSaveQuiz}
                    className="h-8 px-3 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] hover:bg-white text-xs font-bold disabled:opacity-40"
                  >
                    Lưu câu hỏi
                  </button>
                </div>

                {questions.length === 0 ? (
                  <div className="p-8 text-center text-[#8B9097]">
                    <HelpCircle className="w-8 h-8 mx-auto mb-2 text-[#CBD5E1]" />
                    <p className="font-bold text-xs text-[#18181B]">Bài học này chưa có câu hỏi luyện tập</p>
                    <p className="text-[11px] mt-0.5">
                      Bạn có thể chuyển sang mục "Bài Luyện Tập" trên menu bên trái để soạn thảo chuyên sâu.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[640px] overflow-y-auto">
                    {questions.map((q, idx) => (
                      <div key={q.questionId || idx} className="p-4 rounded-2xl border border-[#E7E7EA] bg-[#F7F7F9] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#18181B]">Câu hỏi #{idx + 1}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-[#5F6368] border border-[#E7E7EA]">
                            {q.type === 'multiple_choice' ? 'Trắc nghiệm' : 'Điền từ'}
                          </span>
                        </div>
                        <p className="font-semibold text-xs text-[#18181B]">{q.prompt}</p>
                        {q.type === 'multiple_choice' && (
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            {q.options.map((opt) => (
                              <div
                                key={opt.optionId}
                                className={`px-2.5 py-1 rounded-lg text-[11px] border flex items-center gap-1.5 ${
                                  opt.optionId === q.correctOptionId
                                    ? 'bg-[#E6F4EA] border-[#188A5A] text-[#137333] font-bold'
                                    : 'bg-white border-[#E7E7EA] text-[#5F6368]'
                                }`}
                              >
                                <span>{opt.optionId.toUpperCase()}.</span>
                                <span className="truncate">{opt.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {q.explanationVi && (
                          <p className="text-[11px] text-[#5F6368] bg-white p-2 rounded-xl border border-[#E7E7EA]">
                            <strong>Giải thích:</strong> {q.explanationVi}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
