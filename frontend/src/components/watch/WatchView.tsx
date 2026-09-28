import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize2,
  Bookmark,
  Sparkles,
  Share2,
  CheckCircle2,
  BookOpen,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  BookOpenCheck,
  GraduationCap,
  Layers,
  Copy,
  Check,
  Subtitles,
  HelpCircle,
} from 'lucide-react';
import { VideoLesson, RECOMMENDATION_LESSONS } from '../../data/hanflixData';
import { useLanguage } from '../../i18n';

interface WatchViewProps {
  lesson: VideoLesson;
  onBack: () => void;
  onSelectLesson: (lesson: VideoLesson) => void;
  onAskAI: (prompt: string) => void;
  isSaved?: boolean;
  onToggleSave?: (lesson: VideoLesson) => void;
  onStartPractice?: () => void;
  onSaveWord?: (word: string) => void;
  guestMode?: boolean;
}

export default function WatchView({
  lesson,
  onBack,
  onSelectLesson,
  onAskAI,
  isSaved = false,
  onToggleSave,
  onStartPractice,
  onSaveWord,
  guestMode = false,
}: WatchViewProps) {
  const { t } = useLanguage();
  // Player state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [progressPercent, setProgressPercent] = useState<number>(12); // Mock progress 12%
  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number>(0);
  const [subtitleMode, setSubtitleMode] = useState<'all' | 'zh-pinyin' | 'zh' | 'off'>('all');

  // Interactive sidebar tab
  const [activeTab, setActiveTab] = useState<'transcript' | 'vocabulary' | 'grammar'>('transcript');
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);
  const [savedWordToast, setSavedWordToast] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);

  // Scroll to top when lesson changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsPlaying(true);
    setProgressPercent(8);
    setActiveSubtitleIndex(0);

  }, [lesson.id]);

  // Audio pronunciation
  const playPronunciation = (text: string) => {
    setSpeakingWord(text);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = playbackSpeed;
      window.speechSynthesis.speak(utterance);
    }
    setTimeout(() => setSpeakingWord(null), 1200);
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSaveSingleWord = (word: string) => {
    if (onSaveWord) {
      onSaveWord(word);
    }
    setSavedWordToast(t.watch.savedWordToast);
    setTimeout(() => setSavedWordToast(null), 2500);
  };

  // Up Next recommendations (excluding current lesson)
  const upNextLessons = RECOMMENDATION_LESSONS.filter((l) => l.id !== lesson.id);

  return (
    <div className="w-full max-w-[1700px] mx-auto space-y-4 animate-in fade-in duration-200">
      {/* Top Breadcrumbs & Back Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl bg-white border border-[#E7E7EA] hover:border-[#D1D5DB] hover:bg-[#F7F7F9] text-xs sm:text-sm font-bold text-[#18181B] shadow-2xs transition-all cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 text-[#5F6368] group-hover:-translate-x-0.5 transition-transform" />
          <span>{t.watch.backToFeed}</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-[#5F6368]">
          <span className="hidden sm:inline">{t.watch.topic}:</span>
          <span className="px-2.5 py-1 rounded-full bg-white border border-[#E7E7EA] font-semibold text-[#18181B]">
            {lesson.category}
          </span>
          <span>·</span>
          <span className="px-2.5 py-1 rounded-full bg-[#34363A] text-white font-bold">
            {lesson.hskLevel}
          </span>
        </div>
      </div>

      {/* Guest Mode Banner */}
      {guestMode && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium">
            <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-black text-[10px] uppercase">
              {t.watch.guestBannerTitle}
            </span>
            <span>{t.watch.guestBannerDesc}</span>
          </div>
        </div>
      )}

      {/* Main 2-Column YouTube Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 xl:gap-6 items-start">
        {/* ================= LEFT COLUMN: Video Theater Stage & Details (7 cols on lg, 8 on xl) ================= */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Cinema Video Container */}
          <div className="relative w-full aspect-video rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-950 border border-[#E7E7EA] shadow-xl group select-none">
            {/* Poster / Video Frame */}
            <img
              src={lesson.thumbnail}
              alt={lesson.title}
              className="w-full h-full object-cover opacity-90 transition-opacity"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

            {/* Subtitles Overlay in Center-Bottom */}
            {subtitleMode !== 'off' && lesson.transcript && lesson.transcript.length > 0 && (
              <div className="absolute bottom-14 sm:bottom-16 md:bottom-20 inset-x-2 sm:inset-x-8 md:inset-x-12 mx-auto max-w-2xl text-center z-10 px-3 sm:px-4 py-2 sm:py-3 bg-black/75 backdrop-blur-md rounded-xl sm:rounded-2xl text-white border border-white/10 shadow-2xl transition-all">
                {/* Chinese */}
                {(subtitleMode === 'all' || subtitleMode === 'zh-pinyin' || subtitleMode === 'zh') && (
                  <div className="text-base sm:text-2xl md:text-3xl font-black font-mono tracking-wide text-yellow-300 drop-shadow">
                    {lesson.transcript[activeSubtitleIndex]?.chinese || lesson.transcript[0].chinese}
                  </div>
                )}
                {/* Pinyin */}
                {(subtitleMode === 'all' || subtitleMode === 'zh-pinyin') && (
                  <div className="text-[11px] sm:text-sm text-gray-200 font-mono mt-0.5 drop-shadow">
                    {lesson.transcript[activeSubtitleIndex]?.pinyin || lesson.transcript[0].pinyin}
                  </div>
                )}
                {/* Vietnamese */}
                {subtitleMode === 'all' && (
                  <div className="text-[11px] sm:text-sm text-white/90 font-medium mt-1 drop-shadow">
                    ({lesson.transcript[activeSubtitleIndex]?.vietnamese || lesson.transcript[0].vietnamese})
                  </div>
                )}
              </div>
            )}

            {/* Center Big Play / Pause Overlay Button */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              aria-label={isPlaying ? 'Tạm dừng video' : 'Tiếp tục phát'}
              className="absolute inset-0 m-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#B91B1C]/90 hover:bg-[#B91B1C] text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer z-20"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 sm:w-10 sm:h-10 fill-white" />
              ) : (
                <Play className="w-8 h-8 sm:w-10 sm:h-10 ml-1.5 fill-white" />
              )}
            </button>

            {/* Bottom Scrubber Timeline Bar */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-3 sm:p-4 z-20 flex flex-col gap-2">
              {/* Progress Slider Track */}
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const newPercent = Math.min(100, Math.max(0, (clickX / rect.width) * 100));
                  setProgressPercent(newPercent);
                  if (lesson.transcript && lesson.transcript.length > 1) {
                    const idx = Math.floor((newPercent / 100) * lesson.transcript.length);
                    setActiveSubtitleIndex(Math.min(idx, lesson.transcript.length - 1));
                  }
                }}
                className="w-full h-1.5 hover:h-2.5 bg-white/25 rounded-full cursor-pointer transition-all relative overflow-hidden"
              >
                <div
                  className="h-full bg-gradient-to-r from-[#E7A92F] to-[#B91B1C] rounded-full relative"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Player Controls Row */}
              <div className="flex items-center justify-between text-white text-xs">
                {/* Left Controls: Play, Time, Rewind, Forward */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="hover:text-yellow-300 p-1 cursor-pointer transition-colors"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  </button>

                  <button
                    onClick={() => {
                      setProgressPercent((prev) => Math.max(0, prev - 10));
                      setActiveSubtitleIndex((prev) => Math.max(0, prev - 1));
                    }}
                    title="Lùi 5 giây"
                    className="p-1 hover:text-yellow-300 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      setProgressPercent((prev) => Math.min(100, prev + 10));
                      if (lesson.transcript) {
                        setActiveSubtitleIndex((prev) => Math.min(lesson.transcript!.length - 1, prev + 1));
                      }
                    }}
                    title="Tiến 5 giây"
                    className="p-1 hover:text-yellow-300 transition-colors cursor-pointer"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-1 hover:text-yellow-300 transition-colors cursor-pointer"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  <span className="font-mono text-[11px] text-gray-300 ml-1">
                    0:{Math.floor((progressPercent * 2.47) / 100).toString().padStart(2, '0')} / {lesson.duration}
                  </span>
                </div>

                {/* Right Controls: Subtitle Mode, Speed, Fullscreen */}
                <div className="flex items-center gap-2">
                  {/* Subtitle Selector */}
                  <div className="relative flex items-center gap-1 bg-white/10 px-2 py-1 rounded-lg">
                    <Subtitles className="w-3.5 h-3.5 text-yellow-300" />
                    <select
                      value={subtitleMode}
                      onChange={(e) => setSubtitleMode(e.target.value as any)}
                      className="bg-transparent text-white text-[11px] font-bold outline-none cursor-pointer"
                    >
                      <option value="all" className="text-black">{t.watch.subBilingual}</option>
                      <option value="zh-pinyin" className="text-black">{t.watch.subHanPinyin}</option>
                      <option value="zh" className="text-black">{t.watch.subHanziOnly}</option>
                      <option value="off" className="text-black">{t.watch.subOff}</option>
                    </select>
                  </div>

                  {/* Playback speed */}
                  <select
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                    className="bg-white/10 text-white text-[11px] font-bold px-2 py-1 rounded-lg outline-none cursor-pointer"
                  >
                    <option value={0.75} className="text-black">0.75x</option>
                    <option value={1} className="text-black">1.0x</option>
                    <option value={1.25} className="text-black">1.25x</option>
                    <option value={1.5} className="text-black">1.5x</option>
                  </select>

                  <button
                    onClick={() => {
                      if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen?.();
                      } else {
                        document.exitFullscreen?.();
                      }
                    }}
                    title="Toàn màn hình"
                    className="p-1 hover:text-yellow-300 transition-colors cursor-pointer"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Toast Notification when word is saved */}
          {savedWordToast && (
            <div className="p-3 rounded-2xl bg-[#EBF5EE] border border-[#A4D8B6] text-[#1E7E44] text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{savedWordToast}</span>
              </div>
              <button
                onClick={() => setSavedWordToast(null)}
                className="text-[#1E7E44] hover:underline text-[11px]"
              >
                Đóng
              </button>
            </div>
          )}

          {/* Video Information Header */}
          <div className="space-y-3 pt-1">
            <h1 className="text-xl sm:text-2xl font-black text-[#18181B] tracking-tight leading-snug">
              {lesson.title}{' '}
              <span className="text-[#B91B1C] font-mono">({lesson.chineseTitle})</span>
            </h1>

            {/* Video Stats & Action Buttons (YouTube style) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#E7E7EA]">
              <div className="flex items-center gap-3 text-xs text-[#5F6368]">
                <span className="font-semibold">{lesson.viewCount} {t.watch.views}</span>
                <span>•</span>
                <span>{t.watch.interactiveLesson}</span>
                <span>•</span>
                <span className="px-2 py-0.5 rounded-md bg-[#FFF5F5] text-[#B91B1C] font-bold">
                  {lesson.category}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Save / Bookmark Button */}
                <button
                  onClick={() => onToggleSave?.(lesson)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    isSaved
                      ? 'bg-[#FDF1F1] text-[#B91B1C] border border-[#B91B1C]/30 shadow-2xs'
                      : 'bg-[#F7F7F9] text-[#18181B] border border-[#E7E7EA] hover:bg-[#ECECED]'
                  }`}
                  title={isSaved ? t.watch.saved : t.watch.save}
                >
                  <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current text-[#B91B1C]' : ''}`} />
                  <span>{isSaved ? t.watch.saved : t.watch.save}</span>
                </button>

                {/* Ask AI Button */}
                <button
                  onClick={() =>
                    onAskAI(`Phân tích ngữ pháp, từ vựng và bài học trong video "${lesson.title} (${lesson.chineseTitle})"`)
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-white" />
                  <span>{t.watch.askAi}</span>
                </button>

                {/* Practice Quiz Button */}
                <button
                  onClick={onStartPractice}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#F7F7F9] text-[#18181B] border border-[#E7E7EA] hover:bg-[#ECECED] text-xs font-bold transition-all cursor-pointer"
                >
                  <BookOpenCheck className="w-3.5 h-3.5 text-[#B91B1C]" />
                  <span className="hidden sm:inline">{t.watch.practice}</span>
                </button>

                {/* Share Button */}
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#F7F7F9] text-[#5F6368] hover:text-[#18181B] border border-[#E7E7EA] hover:bg-[#ECECED] text-xs font-bold transition-all cursor-pointer"
                  title={t.watch.share}
                >
                  {copiedLink ? <Check className="w-4 h-4 text-[#1E7E44]" /> : <Share2 className="w-4 h-4" />}
                  <span className="hidden md:inline">{copiedLink ? t.watch.copied : t.watch.share}</span>
                </button>
              </div>
            </div>

            {/* Channel / Instructor Card (YouTube style) */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#E7E7EA] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white border border-[#E7E7EA] flex items-center justify-center shrink-0 p-1">
                  <img src="/favicon.png" alt="HanFlix" className="w-full h-full object-contain select-none" />
                </div>
                <div>
                  <div className="font-extrabold text-sm text-[#18181B] flex items-center gap-1.5">
                    <span>{t.watch.academy}</span>
                    <span className="text-[#B91B1C]">✓</span>
                  </div>
                  <p className="text-xs text-[#5F6368]">{t.watch.academySub}</p>
                </div>
              </div>

              <button
                onClick={() => setIsSubscribed(!isSubscribed)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  isSubscribed
                    ? 'bg-[#F7F7F9] text-[#5F6368] border border-[#E7E7EA]'
                    : 'bg-[#18181B] hover:bg-black text-white shadow-xs'
                }`}
              >
                {isSubscribed ? t.watch.following : t.watch.follow}
              </button>
            </div>

            {/* Expandable Description Box (YouTube style) */}
            <div
              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              className="p-4 rounded-2xl bg-[#F7F7F9] hover:bg-[#F2F2F5] transition-colors border border-[#E7E7EA] cursor-pointer space-y-2 text-xs"
            >
              <div className="flex items-center justify-between text-[#18181B] font-bold">
                <span>{t.watch.infoAndContext}</span>
                <span className="text-[#B91B1C] flex items-center gap-1 font-semibold">
                  {isDescriptionExpanded ? t.watch.showLess : t.watch.showMore}
                  {isDescriptionExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
              </div>

              <p className="text-[#5F6368] leading-relaxed">
                {lesson.description ||
                  'Bài học giúp bạn tự tin ứng dụng tiếng Trung vào các tình huống thực tế: từ phát âm chuẩn, cách dùng từ vựng đúng ngữ cảnh, đến phản xạ giao tiếp tự nhiên.'}
              </p>

              {isDescriptionExpanded && (
                <div className="pt-2 border-t border-[#E7E7EA] space-y-2 text-[#5F6368] animate-in fade-in">
                  <div className="font-bold text-[#18181B]">💡 {t.watch.academicHighlights}</div>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Từ vựng trọng tâm: {lesson.vocabularyList?.map((v) => v.word).join(', ') || 'Đang cập nhật'}</li>
                    <li>Cấu trúc lịch sự trong giao tiếp thực tế với người bản xứ.</li>
                    <li>Luyện nghe giọng chuẩn Bắc Kinh với tốc độ tự nhiên.</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: Interactive Study Material & Up Next Queue (5 cols on lg, 4 on xl) ================= */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-5">
          {/* Interactive Learning Material Card */}
          <div className="bg-white rounded-3xl border border-[#E7E7EA] shadow-xs overflow-hidden flex flex-col">
            {/* Tabs Header */}
            <div className="flex border-b border-[#E7E7EA] bg-[#F7F7F9]">
              <button
                onClick={() => setActiveTab('transcript')}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  activeTab === 'transcript'
                    ? 'border-[#B91B1C] text-[#B91B1C] bg-white'
                    : 'border-transparent text-[#5F6368] hover:text-[#18181B]'
                }`}
              >
                {t.watch.transcriptTab} ({lesson.transcript?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('vocabulary')}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  activeTab === 'vocabulary'
                    ? 'border-[#B91B1C] text-[#B91B1C] bg-white'
                    : 'border-transparent text-[#5F6368] hover:text-[#18181B]'
                }`}
              >
                {t.watch.vocabularyTab} ({lesson.vocabularyList?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('grammar')}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  activeTab === 'grammar'
                    ? 'border-[#B91B1C] text-[#B91B1C] bg-white'
                    : 'border-transparent text-[#5F6368] hover:text-[#18181B]'
                }`}
              >
                {t.watch.grammarTab}
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-4 overflow-y-auto max-h-[460px] space-y-3">
              {/* TAB 1: TRANSCRIPT */}
              {activeTab === 'transcript' && (
                <div className="space-y-2.5">
                  <div className="text-[11px] text-[#8B9097] px-1 flex items-center justify-between">
                    <span>Bấm vào câu để phát âm và nhảy tới đoạn video:</span>
                  </div>

                  {lesson.transcript && lesson.transcript.length > 0 ? (
                    lesson.transcript.map((item, index) => {
                      const isActive = activeSubtitleIndex === index;
                      return (
                        <div
                          key={index}
                          onClick={() => {
                            setActiveSubtitleIndex(index);
                            setProgressPercent(((index + 1) / lesson.transcript!.length) * 100);
                          }}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                            isActive
                              ? 'bg-[#FFF5F5] border-[#B91B1C] ring-2 ring-[#B91B1C]/20 shadow-2xs'
                              : 'bg-[#F7F7F9] border-[#E7E7EA] hover:border-[#D1D5DB]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-mono text-[#8B9097]">
                            <span className="font-bold text-[#B91B1C]">{item.time}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playPronunciation(item.chinese);
                              }}
                              className={`p-1 rounded-full border transition-colors ${
                                speakingWord === item.chinese
                                  ? 'bg-[#B91B1C] text-white border-[#B91B1C]'
                                  : 'bg-white border-[#E7E7EA] text-[#5F6368] hover:text-[#B91B1C]'
                              }`}
                              title="Nghe phát âm chuẩn"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="text-base font-bold text-[#18181B] font-mono mt-1">
                            {item.chinese}
                          </div>
                          <div className="text-xs text-[#B91B1C] font-mono font-medium">
                            {item.pinyin}
                          </div>
                          <div className="text-xs text-[#5F6368] pt-1.5 mt-1 border-t border-[#E7E7EA]">
                            {item.vietnamese}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-xs text-[#8B9097]">
                      Chưa có phụ đề lời thoại cho bài học này.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: VOCABULARY */}
              {activeTab === 'vocabulary' && (
                <div className="space-y-3">
                  {lesson.vocabularyList && lesson.vocabularyList.length > 0 ? (
                    lesson.vocabularyList.map((vocab, index) => (
                      <div
                        key={index}
                        className="p-3.5 rounded-2xl bg-[#F7F7F9] border border-[#E7E7EA] hover:border-[#B91B1C]/30 transition-all space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl font-bold font-mono text-[#18181B]">
                              {vocab.word}
                            </span>
                            <span className="text-xs font-bold text-[#B91B1C] font-mono">
                              [{vocab.pinyin}]
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E7E7EA] text-[#5F6368]">
                              {vocab.type}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => playPronunciation(vocab.word)}
                              className={`p-1.5 rounded-full border transition-colors ${
                                speakingWord === vocab.word
                                  ? 'bg-[#B91B1C] text-white border-[#B91B1C]'
                                  : 'bg-white border-[#E7E7EA] text-[#5F6368] hover:text-[#B91B1C]'
                              }`}
                              title="Nghe phát âm"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSaveSingleWord(vocab.word)}
                              className="p-1.5 rounded-full bg-white border border-[#E7E7EA] text-[#5F6368] hover:text-[#B91B1C] hover:border-[#B91B1C] transition-colors"
                              title="Lưu từ vựng này"
                            >
                              <Bookmark className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="text-xs font-bold text-[#18181B]">{vocab.meaning}</div>

                        <div className="text-[11px] text-[#5F6368] pt-1.5 border-t border-[#E7E7EA] leading-relaxed">
                          <span className="font-semibold text-[#18181B]">Ví dụ: </span>
                          {vocab.example}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-[#8B9097]">
                      Chưa có danh sách từ vựng chi tiết.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: GRAMMAR */}
              {activeTab === 'grammar' && (
                <div className="space-y-3 text-xs">
                  <div className="p-4 rounded-2xl bg-[#FFF5F5] border border-[#B91B1C]/20 space-y-1">
                    <span className="text-[10px] font-bold text-[#B91B1C] uppercase tracking-wider">
                      Cấu trúc trọng tâm HSK 3
                    </span>
                    <div className="text-base font-bold font-mono text-[#18181B]">
                      请 + Động từ + 一下 (Qǐng ... yíxià)
                    </div>
                    <p className="text-[#5F6368] pt-1 leading-relaxed">
                      Dùng để đưa ra lời đề nghị lịch sự, nhẹ nhàng: &quot;Xin vui lòng làm gì đó một chút&quot;.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#F7F7F9] border border-[#E7E7EA] space-y-1.5">
                    <div className="font-bold text-[#18181B]">Mẫu câu trong video:</div>
                    <p className="text-[#5F6368]">
                      • <span className="font-mono font-semibold text-[#18181B]">请拿一下菜单。</span> (Xin cho lấy menu một chút.)
                    </p>
                    <p className="text-[#5F6368]">
                      • <span className="font-mono font-semibold text-[#18181B]">请稍等，马上就来。</span> (Xin chờ một chút, có ngay.)
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      onAskAI(`Giải thích chi tiết ngữ pháp và các ví dụ thực hành của bài "${lesson.title}"`)
                    }
                    className="w-full py-2.5 rounded-xl bg-[#FDF1F1] text-[#B91B1C] hover:bg-[#B91B1C] hover:text-white font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Hỏi AI giải thích thêm ngữ pháp</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Up Next Recommendations List (YouTube Style) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-black text-sm text-[#18181B] tracking-tight">Bài học tiếp theo</h3>
              <span className="text-xs text-[#8B9097]">{upNextLessons.length} bài gợi ý</span>
            </div>

            <div className="space-y-2.5">
              {upNextLessons.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectLesson(item)}
                  className="p-2 rounded-2xl bg-white hover:bg-[#F7F7F9] border border-[#E7E7EA] hover:border-[#B91B1C]/30 transition-all cursor-pointer flex gap-3 group"
                >
                  {/* Video Thumbnail (YouTube style compact 16:9) */}
                  <div className="relative w-28 sm:w-36 md:w-40 aspect-video rounded-xl overflow-hidden bg-slate-900 shrink-0">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[10px] font-semibold">
                      {item.duration}
                    </div>
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-[#34363A]/80 text-white text-[9px] font-bold">
                      {item.hskLevel}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h4 className="font-bold text-xs sm:text-sm text-[#18181B] group-hover:text-[#B91B1C] line-clamp-2 leading-snug transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-[#8B9097] font-mono truncate mt-0.5">
                      {item.chineseTitle}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-[#5F6368] mt-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-[#F7F7F9] border border-[#E7E7EA]">
                        {item.category}
                      </span>
                      <span>{item.viewCount} lượt xem</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
