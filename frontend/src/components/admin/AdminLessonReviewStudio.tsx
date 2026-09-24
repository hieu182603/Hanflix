import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNotification } from '../notifications';
import { AdminSearchBar } from './AdminSearchBar';
import {
  Video,
  Play,
  Pause,
  Subtitles,
  HelpCircle,
  Save,
  CheckCircle2,
  RotateCcw,
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
import { SubtitleOverlay } from '../watch/SubtitleOverlay';
import LearningTipsPanel from '../watch/LearningTipsPanel';
import AiImprovedBadge from '../watch/AiImprovedBadge';
import type { AdminCue, AdminLesson, AdminQuestion, AdminReview, LearningTip } from '../../api/admin';

const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const HSK_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  2: { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  3: { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  4: { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  5: { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  6: { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  7: { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
  8: { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
  9: { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
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
  /** True when Gemini polished the .vi of the subtitle cues (Azure → Gemini). */
  translationImproved: boolean;
  /** AI-generated study tips tailored to this lesson. */
  learningTips: LearningTip[];
  /** Words worth drilling after watching this lesson. */
  drillWords: string[];
  dirty: { metadata: boolean; subtitles: boolean; quiz: boolean };
  busy: boolean;
  titleVi: string;
  setTitleVi: (v: string) => void;
  titleZh: string;
  setTitleZh: (v: string) => void;
  descriptionVi: string;
  setDescriptionVi: (v: string) => void;
  characters: NonNullable<AdminLesson['characters']>;
  onCharactersChange: (characters: NonNullable<AdminLesson['characters']>) => void;
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
  translationImproved,
  learningTips,
  drillWords,
  dirty,
  busy,
  titleVi,
  setTitleVi,
  titleZh,
  setTitleZh,
  descriptionVi,
  setDescriptionVi,
  characters,
  onCharactersChange,
  onCuesChange,
  onQuestionsChange,
  onSaveMetadata,
  onSaveSubtitles,
  onSaveQuiz,
  onPublishAll,
  onReload,
  onBackToVideos,
}: AdminLessonReviewStudioProps) {
  const notify = useNotification();
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

  const handleRemoveCue = async (index: number) => {
    if (!await notify.confirm({
      title: 'Xóa câu thoại',
      message: `Xóa câu thoại #${index + 1}?`,
      confirmText: 'Xóa',
      tone: 'danger',
    })) return;
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
      <div className="bg-white rounded-3xl p-6 border border-[#F2E4D8] flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs relative overflow-hidden">
        <div className="absolute -right-4 -top-8 text-8xl font-serif font-black text-[#B91B1C]/[0.03] select-none pointer-events-none">
          录
        </div>
        <div className="flex items-center gap-3.5 relative z-10">
          <button
            type="button"
            onClick={onBackToVideos}
            className="p-2.5 rounded-2xl border border-[#F2E4D8] bg-[#FFF9F5] hover:bg-[#FFF0EB] text-[#5F6368] hover:text-[#B91B1C] transition-all cursor-pointer shadow-2xs"
            title="Quay lại danh sách video"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-md font-black text-[10px] font-mono bg-[#B91B1C] text-white shadow-2xs">
                HSK {lesson.hsk}
              </span>
              <span
                className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                  lesson.status === 'published'
                    ? 'bg-[#EAF5F1] text-[#188A5A] border-[#C6E7DA]'
                    : lesson.status === 'ready_for_review'
                    ? 'bg-[#FFF8EC] text-[#B45309] border-[#FDE6BA]'
                    : 'bg-[#FFF9F5] text-[#5F6368] border-[#F2E4D8]'
                }`}
              >
                {lesson.status === 'published'
                  ? 'Đã xuất bản'
                  : lesson.status === 'ready_for_review'
                  ? 'Chờ duyệt nội dung'
                  : 'Bản nháp'}
              </span>

              {hasAnyDirty && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#FFF8EC] text-[#B45309] text-[10px] font-extrabold animate-pulse border border-[#FDE6BA]">
                  Chưa lưu thay đổi
                </span>
              )}
            </div>

            <h1 className="text-2xl font-black text-[#18181B] tracking-tight">{lesson.titleVi}</h1>
          </div>
        </div>

        {/* Global Studio Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 relative z-10">
          <button
            type="button"
            onClick={onReload}
            disabled={busy}
            className="h-10 px-4 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] hover:bg-[#FFF0EB] hover:text-[#B91B1C] text-[#5F6368] text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-40 cursor-pointer shadow-2xs"
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
            className="h-10 px-4 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] hover:bg-[#FFF0EB] text-[#18181B] hover:text-[#B91B1C] text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-40 shadow-2xs cursor-pointer"
          >
            <Save className="w-4 h-4 text-[#B91B1C]" />
            <span>Lưu bản nháp</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={onPublishAll}
            className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#188A5A] to-[#13734B] hover:from-[#13734B] hover:to-[#0F5A3B] text-white text-xs font-black flex items-center gap-2 transition-all shadow-xs disabled:opacity-40 cursor-pointer active:scale-[0.98]"
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
          <div className="bg-white rounded-3xl border border-[#F2E4D8] overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-[#F2E4D8] flex items-center justify-between bg-[#FFF9F5]">
              <span className="font-extrabold text-xs text-[#18181B] flex items-center gap-1.5">
                <Video className="w-4 h-4 text-[#B91B1C]" />
                Xem trước video & phụ đề trực tiếp
              </span>
              <span className="font-mono text-xs font-bold text-[#8B9097] bg-white px-2 py-0.5 rounded-md border border-[#F2E4D8]">
                {formatMs(currentTimeMs)}
              </span>
            </div>

            <div className="relative aspect-video bg-[#121214] ring-1 ring-[#222226] flex items-center justify-center">
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
                  <div className="inline-block bg-[#18181B]/90 backdrop-blur-sm px-4 py-2 rounded-2xl border border-[#F2E4D8]/25 text-white max-w-md shadow-lg">
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
          <div className="bg-white rounded-3xl p-6 border border-[#F2E4D8] shadow-2xs space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#F2E4D8]">
              <span className="font-black text-sm text-[#18181B]">Thông tin chung bài học</span>
              {dirty.metadata && (
                <span className="text-[10px] text-[#B45309] font-extrabold px-2 py-0.5 rounded-full bg-[#FFF8EC] border border-[#FDE6BA]">
                  Chưa lưu metadata
                </span>
              )}
            </div>

            <div>
              <label className="block font-bold text-[#18181B] mb-1">Tiêu đề tiếng Việt</label>
              <input
                value={titleVi}
                onChange={(e) => setTitleVi(e.target.value)}
                className="w-full px-3 py-2 bg-[#FFF9F5] border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] font-bold text-xs text-[#18181B] transition-colors"
              />
            </div>

            <div>
              <label className="block font-bold text-[#18181B] mb-1">Tiêu đề tiếng Trung</label>
              <input
                value={titleZh}
                onChange={(e) => setTitleZh(e.target.value)}
                className="w-full px-3 py-2 bg-[#FFF9F5] border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] font-bold text-xs text-[#18181B] transition-colors"
              />
            </div>

            <div>
              <label className="block font-bold text-[#18181B] mb-1">Mô tả bài học</label>
              <textarea
                rows={3}
                value={descriptionVi}
                onChange={(e) => setDescriptionVi(e.target.value)}
                className="w-full p-2.5 bg-[#FFF9F5] border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] resize-none leading-relaxed text-xs text-[#18181B] transition-colors"
              />
            </div>

            {lesson.contentMode === 'drama' && characters.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="font-bold mb-2">Nhân vật / người nói</legend>
                {characters.map((character, index) => (
                  <div key={character.speakerId} className="flex gap-2 items-center">
                    <input type="color" aria-label={`Màu ${character.speakerId}`}
                      value={/^#[0-9a-f]{6}$/i.test(character.color ?? '') ? character.color : '#B91B1C'}
                      onChange={e => onCharactersChange(characters.map((item, i) => i === index ? { ...item, color: e.target.value } : item))}
                      className="w-8 h-8 shrink-0" />
                    <input aria-label={`Tên ${character.speakerId}`} value={character.displayName} maxLength={100}
                      onChange={e => onCharactersChange(characters.map((item, i) => i === index ? { ...item, displayName: e.target.value } : item))}
                      className="min-w-0 flex-1 rounded-xl border border-[#F2E4D8] p-2 text-xs" />
                  </div>
                ))}
              </fieldset>
            )}

            <button
              type="button"
              disabled={busy || !dirty.metadata}
              onClick={onSaveMetadata}
              className="px-4 py-2 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] hover:bg-[#FFF0EB] hover:text-[#B91B1C] text-[#18181B] font-bold disabled:opacity-40 transition-colors shadow-2xs cursor-pointer"
            >
              Lưu thông tin bài học
            </button>
          </div>
        </div>

        {/* Right Column: Studio Workspace (Subtitles & Quiz Tabs) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-3xl border border-[#F2E4D8] overflow-hidden shadow-2xs">
            {/* Studio Workspace Header & Tab Toggle */}
            <div className="p-4 border-b border-[#F2E4D8] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFF9F5]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('subtitles')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border ${
                    activeTab === 'subtitles'
                      ? 'bg-[#B91B1C] text-white border-[#B91B1C] shadow-xs'
                      : 'bg-white text-[#5F6368] border-[#F2E4D8] hover:text-[#B91B1C] hover:bg-[#FFF0EB]'
                  }`}
                >
                  <Subtitles className="w-3.5 h-3.5" />
                  <span>Phụ đề song ngữ ({cues.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('quiz')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border ${
                    activeTab === 'quiz'
                      ? 'bg-[#B91B1C] text-white border-[#B91B1C] shadow-xs'
                      : 'bg-white text-[#5F6368] border-[#F2E4D8] hover:text-[#B91B1C] hover:bg-[#FFF0EB]'
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
                    className="h-8 px-3 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-[11px] font-bold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm câu thoại</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy || !dirty.subtitles}
                    onClick={onSaveSubtitles}
                    className="h-8 px-3 rounded-xl border border-[#F2E4D8] bg-white hover:bg-[#FFF0EB] hover:text-[#B91B1C] text-xs font-bold disabled:opacity-40 cursor-pointer transition-colors shadow-2xs"
                  >
                    Lưu phụ đề
                  </button>
                </div>
              )}
            </div>

            {/* TAB 1: SUBTITLE CUE EDITOR */}
            {activeTab === 'subtitles' && (
              <div className="p-5 space-y-4">
                {/* AI metadata badges + learning tips for this track */}
                <div className="flex flex-wrap items-center gap-2">
                  <AiImprovedBadge visible={translationImproved} size="sm" />
                  {(learningTips.length > 0 || drillWords.length > 0) && (
                    <span className="rounded-full bg-[#EAF5F1] px-2 py-0.5 text-[10px] font-bold text-[#188A5A] ring-1 ring-[#C6E7DA]">
                      {learningTips.length} mẹo AI · {drillWords.length} từ ôn tập
                    </span>
                  )}
                </div>

                {learningTips.length > 0 && (
                  <LearningTipsPanel tips={learningTips} drillWords={drillWords} audience="admin" />
                )}

                {/* Search cues */}
                <div className="relative">
                  <AdminSearchBar
                    value={cueSearch}
                    onChange={setCueSearch}
                    onChangeExtra={() => setCuePage(1)}
                    placeholder="Tìm câu thoại theo chữ Hán, Pinyin hoặc nghĩa tiếng Việt..."
                    inputClassName="!py-2 !text-xs"
                    containerClassName="!rounded-xl !border-[#F2E4D8]"
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
                            ? 'bg-[#FFF8EC] border-[#E7A92F] ring-1 ring-[#E7A92F]/40 shadow-xs'
                            : 'bg-white border-[#F2E4D8] hover:border-[#B91B1C]/40 shadow-2xs'
                        }`}
                      >
                        {/* Cue Header (Timestamp + Actions) */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-[#8B9097] text-[11px]">
                              #{realIndex + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => jumpToTime(cue.startMs)}
                              className="px-2.5 py-1 rounded-lg bg-[#FFF9F5] hover:bg-[#B91B1C] hover:text-white text-[#18181B] font-mono text-[11px] font-bold border border-[#F2E4D8] flex items-center gap-1 transition-colors cursor-pointer"
                              title="Nhảy tới mốc video này"
                            >
                              <Play className="w-3 h-3" />
                              <span>
                                {formatMs(cue.startMs)} – {formatMs(cue.endMs)}
                              </span>
                            </button>
                            <span className="text-[10px] text-[#8B9097] font-mono">
                              ({((cue.endMs - cue.startMs) / 1000).toFixed(1)}s)
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => playTTS(cue.zh)}
                              className="p-1 rounded-lg border border-[#F2E4D8] hover:bg-[#FFF0EB] text-[#5F6368] hover:text-[#B91B1C] cursor-pointer"
                              title="Nghe phát âm Hán tự"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateCue(realIndex)}
                              className="p-1 rounded-lg border border-[#F2E4D8] hover:bg-[#FFF0EB] text-[#5F6368] hover:text-[#B91B1C] cursor-pointer"
                              title="Sao chép câu thoại này"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveCue(realIndex)}
                              className="p-1 rounded-lg border border-[#FECACA] hover:bg-red-50 text-red-600 cursor-pointer"
                              title="Xóa câu thoại"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Cue Input Fields */}
                        <div className="space-y-2">
                          {/* Chinese Text */}
                          <input
                            type="text"
                            value={cue.zh}
                            onChange={(e) => handlePatchCue(realIndex, { zh: e.target.value })}
                            placeholder="Chữ Hán giản thể..."
                            className="w-full px-3 py-1.5 bg-[#FFF9F5] border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] font-serif font-black text-sm text-[#18181B]"
                          />

                          {/* Pinyin */}
                          <input
                            type="text"
                            value={cue.pinyin}
                            onChange={(e) => handlePatchCue(realIndex, { pinyin: e.target.value })}
                            placeholder="Phiên âm Pinyin..."
                            className="w-full px-3 py-1.5 bg-[#FFF9F5] border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] font-mono text-xs text-[#B91B1C]"
                          />

                          {/* Vietnamese Translation */}
                          <input
                            type="text"
                            value={cue.vi}
                            onChange={(e) => handlePatchCue(realIndex, { vi: e.target.value })}
                            placeholder="Bản dịch nghĩa tiếng Việt..."
                            className="w-full px-3 py-1.5 bg-[#FFF9F5] border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] text-xs text-[#18181B]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Subtitles Pagination */}
                {totalCuePages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-[#F2E4D8] text-xs text-[#5F6368]">
                    <span>
                      Trang <strong className="text-[#18181B]">{cuePage}</strong> / {totalCuePages}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={cuePage <= 1}
                        onClick={() => setCuePage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] hover:bg-[#FFF0EB] hover:text-[#B91B1C] font-bold disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        Trước
                      </button>
                      <button
                        type="button"
                        disabled={cuePage >= totalCuePages}
                        onClick={() => setCuePage((p) => Math.min(totalCuePages, p + 1))}
                        className="px-3 py-1 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] hover:bg-[#FFF0EB] hover:text-[#B91B1C] font-bold disabled:opacity-40 transition-colors cursor-pointer"
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
                <div className="flex items-center justify-between pb-2 border-b border-[#F2E4D8]">
                  <div>
                    <h4 className="font-extrabold text-sm text-[#18181B]">Câu hỏi củng cố bài học ({questions.length})</h4>
                    <p className="text-[11px] text-[#8B9097]">
                      Câu hỏi được tự động hiển thị cho học viên sau khi hoàn thành xem video.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy || !dirty.quiz}
                    onClick={onSaveQuiz}
                    className="h-8 px-3 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] hover:bg-[#FFF0EB] hover:text-[#B91B1C] text-xs font-bold disabled:opacity-40 cursor-pointer shadow-2xs transition-colors"
                  >
                    Lưu câu hỏi
                  </button>
                </div>

                {questions.length === 0 ? (
                  <div className="p-8 text-center text-[#8B9097] bg-[#FFFDFB] rounded-2xl border border-dashed border-[#F2E4D8]">
                    <HelpCircle className="w-8 h-8 mx-auto mb-2 text-[#CBD5E1]" />
                    <p className="font-bold text-xs text-[#18181B]">Bài học này chưa có câu hỏi luyện tập</p>
                    <p className="text-[11px] mt-0.5">
                      Bạn có thể chuyển sang mục "Bài Luyện Tập" trên menu bên trái để soạn thảo chuyên sâu.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[640px] overflow-y-auto">
                    {questions.map((q, idx) => (
                      <div key={q.questionId || idx} className="p-4 rounded-2xl border border-[#F2E4D8] bg-[#FFF9F5] space-y-2.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[#18181B]">Câu hỏi #{idx + 1}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white text-[#5F6368] border border-[#F2E4D8]">
                            {q.type === 'multiple_choice' ? 'Trắc nghiệm' : 'Điền từ'}
                          </span>
                        </div>
                        <p className="font-bold text-xs text-[#18181B]">{q.prompt}</p>
                        {q.type === 'multiple_choice' && (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            {q.options.map((opt) => (
                              <div
                                key={opt.optionId}
                                className={`px-3 py-1.5 rounded-xl text-[11px] border flex items-center gap-2 transition-all ${
                                  opt.optionId === q.correctOptionId
                                    ? 'bg-[#EAF5F1] border-[#188A5A] text-[#188A5A] font-extrabold shadow-2xs'
                                    : 'bg-white border-[#F2E4D8] text-[#5F6368]'
                                }`}
                              >
                                <span className="font-mono">{opt.optionId.toUpperCase()}.</span>
                                <span className="truncate">{opt.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {q.explanationVi && (
                          <p className="text-[11px] text-[#5F6368] bg-white p-2.5 rounded-xl border border-[#F2E4D8]">
                            <strong className="text-[#18181B]">Giải thích:</strong> {q.explanationVi}
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
