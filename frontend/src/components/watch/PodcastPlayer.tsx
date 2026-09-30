import { useI18n } from '../../i18n';
/**
 * CONTENT MODE (2026-09-22) - PODCAST: PodcastPlayer.
 *
 * Player chuyên dụng cho podcast:
 *  - Sidebar trái: danh sách chapters (click để seek).
 *  - Giữa: audio phát với poster image (không cần video).
 *  - Top bar: chapter hiện tại.
 *  - Bottom bar: progress timeline.
 *
 * Đặc tính:
 *  - Dùng <video> element nhưng ẩn visual (poster mode).
 *  - Chapters được truyền từ parent (lesson.chapters).
 *  - `currentChapter` derived từ currentMs.
 *  - Click chapter → seek video.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpenCheck,
  ChevronLeft,
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { SubtitleCue } from '../../api/learning';

export interface PodcastChapter {
  chapterId: string;
  title: string;
  startMs: number;
  endMs: number;
  summary?: string;
}

export interface PodcastPlayerProps {
  src: string;
  posterUrl?: string;
  title: string;
  durationSeconds: number;
  cues: SubtitleCue[];
  chapters?: PodcastChapter[];
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  onTimeUpdate?: (video: HTMLVideoElement) => void;
  onEnded?: () => void;
  onSeeking?: () => void;
  onPause?: () => void;
  onLoadedMetadata?: React.ReactEventHandler<HTMLVideoElement>;
  onChapterClick?: (chapter: PodcastChapter) => void;
}

export default function PodcastPlayer({
  src,
  posterUrl,
  title,
  durationSeconds,
  cues,
  chapters = [],
  videoRef: externalVideoRef,
  onTimeUpdate,
  onEnded,
  onSeeking,
  onPause,
  onLoadedMetadata,
  onChapterClick,
}: PodcastPlayerProps) {
  const { tr, ui } = useI18n();
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef ?? internalVideoRef;
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChapters, setShowChapters] = useState(true);

  const activeChapter = useMemo(
    () => chapters.find(c => currentMs >= c.startMs && currentMs < c.endMs),
    [chapters, currentMs],
  );

  const onTimeUpdateInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    setCurrentMs(video.currentTime * 1000);
    onTimeUpdate?.(video);
  }, [onTimeUpdate]);

  const seekTo = useCallback((ms: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = ms / 1000;
    setCurrentMs(ms);
  }, [videoRef]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => { setIsPlaying(false); setError('Không thể phát nội dung. Vui lòng thử lại.'); });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [videoRef]);

  const handleChapterClick = useCallback((chapter: PodcastChapter) => {
    seekTo(chapter.startMs);
    onChapterClick?.(chapter);
  }, [seekTo, onChapterClick]);

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      void container.requestFullscreen?.().catch(() => undefined);
    } else {
      void document.exitFullscreen?.().catch(() => undefined);
    }
  }, []);



  const totalSeconds = durationSeconds || (videoRef.current?.duration ?? 0);
  const currentSeconds = currentMs / 1000;
  const formatTime = (seconds: number) => {
    const total = Math.floor(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };
  const formatTimeFull = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="w-full flex flex-col-reverse xl:flex-row gap-4">
      {/* Chapter sidebar */}
      {showChapters && chapters.length > 0 && (
        <aside className="w-full xl:w-56 shrink-0 bg-white rounded-2xl border border-[#E7E7EA] overflow-y-auto max-h-[520px] shadow-xs">
          <div className="sticky top-0 bg-white border-b border-[#E7E7EA] px-4 py-3">
            <h3 className="font-extrabold text-sm text-[#18181B] flex items-center gap-2">
              <BookOpenCheck className="w-4 h-4 text-[#B91B1C]" />
              <span>{tr("Mục lục (")}{chapters.length})</span>
            </h3>
          </div>
          <div className="p-2 space-y-1">
            {chapters.map((chapter) => {
              const isActive = activeChapter?.chapterId === chapter.chapterId;
              const progress = totalSeconds > 0
                ? Math.min(100, Math.max(0, ((currentMs - chapter.startMs) / Math.max(1, chapter.endMs - chapter.startMs)) * 100))
                : 0;
              return (
                <button
                  key={chapter.chapterId}
                  type="button"
                  onClick={() => handleChapterClick(chapter)}
                  className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer group ${
                    isActive
                      ? 'bg-[#FFF5F5] border border-[#B91B1C]/30'
                      : 'hover:bg-[#F7F7F9] border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold leading-tight ${isActive ? 'text-[#B91B1C]' : 'text-[#18181B] group-hover:text-[#B91B1C]'} transition-colors`}>
                        {chapter.title}
                      </p>
                      {chapter.summary && (
                        <p className="text-[10px] text-[#5F6368] mt-1 line-clamp-2">
                          {chapter.summary}
                        </p>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-[#5F6368] shrink-0 mt-0.5">
                      {formatTimeFull(chapter.startMs)}
                    </span>
                  </div>
                  {isActive && (
                    <div className="mt-2 h-1 rounded-full bg-[#E7E7EA] overflow-hidden">
                      <div
                        className="h-full bg-[#B91B1C] rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </aside>
      )}

      {/* Main player */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {/* Chapter header */}
        {activeChapter && (
          <div className="px-4 py-3 rounded-2xl bg-[#F7F7F9] border border-[#E7E7EA]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#5F6368] mb-1">{tr("Đang phát")}</p>
            <p className="text-sm font-bold text-[#18181B]">{activeChapter.title}</p>
          </div>
        )}

        {/* Audio / Poster stage */}
        <div
          ref={containerRef}
          className="relative aspect-video min-h-64 rounded-2xl md:rounded-3xl overflow-hidden shadow-xl bg-neutral-900 group"
        >
          {/* Poster image hoặc fallback gradient */}
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover opacity-60"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#18181B] to-neutral-800 flex items-center justify-center">
              <div className="text-center text-white/40">
                <BookOpenCheck className="w-16 h-16 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">{title}</p>
              </div>
            </div>
          )}

          {/* Subtitle overlay */}
          {(() => {
            const activeCue = cues.find(c => c.startMs <= currentMs && currentMs < c.endMs);
            if (!activeCue) return null;
            return (
              <div className="absolute z-10 inset-x-0 bottom-16 px-4 pointer-events-none">
                <div className="max-w-2xl mx-auto bg-black/70 backdrop-blur-md rounded-2xl px-4 py-3 text-center">
                  <p className="font-hanzi font-bold text-lg text-white leading-relaxed">
                    {activeCue.zh}
                  </p>
                  {activeCue.pinyin && (
                    <p className="font-mono text-xs text-white/70 mt-1">{activeCue.pinyin}</p>
                  )}
                  {activeCue.vi && (
                    <p className="text-xs text-white/80 mt-1 italic">{activeCue.vi}</p>
                  )}
                </div>
              </div>
            );
          })()}

      {error && <div role="alert" className="absolute z-30 inset-x-3 top-3 rounded-xl bg-black/80 p-3 text-sm text-white">{ui(error)}</div>}
          <video
            ref={videoRef}
            src={src}
            poster={posterUrl}
            title={title}
            className="absolute inset-0 w-full h-full object-contain"
            onTimeUpdate={onTimeUpdateInternal}
            onPlay={() => setIsPlaying(true)}
            onPause={() => { setIsPlaying(false); onPause?.(); }}
        onSeeking={onSeeking}
        onLoadedMetadata={onLoadedMetadata}
            onEnded={() => {
              setIsPlaying(false);
              onEnded?.();
            }}
            onVolumeChange={(event) => {
              setVolume(event.currentTarget.volume);
              setIsMuted(event.currentTarget.muted);
            }}
            onError={() => setError('Không thể tải nội dung. Vui lòng thử lại.')}
        onCanPlay={() => setError('')}
        playsInline
          />

          {/* Controls */}
          <div className="absolute z-20 inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? tr("Tạm dừng") : tr("Phát")}
                className="text-white hover:text-[#FFD700] transition-colors cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" />
                )}
              </button>

              <span className="text-xs font-mono text-white/80 tabular-nums">
                {formatTime(currentSeconds)}
              </span>

              <input
                type="range"
                min={0}
                max={Math.max(1, totalSeconds)}
                step={0.1}
                value={currentSeconds}
                onChange={(e) => {
                  const video = videoRef.current;
                  if (!video) return;
                  const val = Number(e.target.value);
                  video.currentTime = val;
                  setCurrentMs(val * 1000);
                }}
                className="min-w-0 flex-1 accent-[#FFD700] cursor-pointer"
              />

              <span className="text-xs font-mono text-white/80 tabular-nums">
                {formatTime(totalSeconds)}
              </span>

              <button
                type="button"
                onClick={() => { const video = videoRef.current; if (video) { video.muted = !video.muted; setIsMuted(video.muted); } }}
                className="text-white hover:text-[#FFD700] transition-colors cursor-pointer"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="text-white hover:text-[#FFD700] transition-colors cursor-pointer"
              >
                {isFullscreen ? (
                  <Minimize className="w-5 h-5" />
                ) : (
                  <Maximize className="w-5 h-5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowChapters(s => !s)}
                className={`text-white hover:text-[#FFD700] transition-colors cursor-pointer ${
                  showChapters ? 'opacity-100' : 'opacity-50'
                }`}
                title={showChapters ? tr("Ẩn mục lục") : tr("Hiện mục lục")}
              >
                <BookOpenCheck className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
