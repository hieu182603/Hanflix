/**
 * CONTENT MODE (2026-09-22) - SONG: KaraokePlayer.
 *
 * Player chuyên dụng cho bài hát:
 *  - Tái sử dụng <video> HTML5 element (giống YouTubePlayer).
 *  - Overlay word-by-word highlight dựa trên `karaokeTokens`.
 *  - Cue hiện tại được hiển thị dưới dạng karaoke band:
 *      [Từ1] [Từ2] [Từ3]  →  Từ1 highlight khi currentMs nằm trong khoảng token.
 *  - Click vào từ để jump đến thời điểm token đó.
 *
 * Đặc tính:
 *  - Không phụ thuộc YouTubePlayer — đơn giản hơn vì không cần transcript panel.
 *  - State `currentMs` derive từ video.currentTime qua `timeupdate` event.
 *  - Không lạm dụng useMemo: token lookup là O(cue), chấp nhận được.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { SubtitleCue } from '../../api/learning';

export interface KaraokePlayerProps {
  src: string;
  title: string;
  durationSeconds: number;
  cues: SubtitleCue[];
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  onTimeUpdate?: (video: HTMLVideoElement) => void;
  onEnded?: () => void;
  onSeeking?: () => void;
  onPause?: () => void;
  onLoadedMetadata?: React.ReactEventHandler<HTMLVideoElement>;
  /** Optional callback khi user click vào 1 token trong karaoke band. */
  onTokenClick?: (cueId: string, text: string, startMs: number) => void;
}

export default function KaraokePlayer({
  src,
  title,
  durationSeconds,
  cues,
  videoRef: externalVideoRef,
  onTimeUpdate,
  onEnded,
  onSeeking,
  onPause,
  onLoadedMetadata,
  onTokenClick,
}: KaraokePlayerProps) {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef ?? internalVideoRef;
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    const update = () => {
      if (videoRef.current) setCurrentMs(videoRef.current.currentTime * 1000);
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, videoRef]);

  // Cue hiện tại dựa trên currentMs
  const activeCue = useMemo(
    () => cues.find(c => c.startMs <= currentMs && currentMs < c.endMs),
    [cues, currentMs],
  );

  const onTimeUpdateInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    setCurrentMs(video.currentTime * 1000);
    onTimeUpdate?.(video);
  }, [onTimeUpdate]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [videoRef]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, [videoRef]);

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

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const value = Number(event.target.value);
    video.currentTime = value;
    setCurrentMs(value * 1000);
  };

  const handleTokenClick = (cue: SubtitleCue, tokenStartMs: number, tokenText: string) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = tokenStartMs / 1000;
    setCurrentMs(tokenStartMs);
    onTokenClick?.(cue.cueId, tokenText, tokenStartMs);
  };

  const totalSeconds = durationSeconds || (videoRef.current?.duration ?? 0);
  const currentSeconds = currentMs / 1000;
  const formatTime = (seconds: number) => {
    const total = Math.floor(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video rounded-2xl md:rounded-3xl bg-black overflow-hidden shadow-xl group"
    >
      <video
        ref={videoRef}
        src={src}
        title={title}
        className="w-full h-full object-contain bg-black"
        onTimeUpdate={onTimeUpdateInternal}
        onPlay={() => setIsPlaying(true)}
        onPause={() => { setIsPlaying(false); onPause?.(); }}
        onSeeking={onSeeking}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={() => {
          setIsPlaying(false);
          onEnded?.();
        }}
        onError={() => setError('Không thể tải bài hát. Vui lòng thử lại.')}
        onVolumeChange={(event) => {
          setVolume(event.currentTarget.volume);
          setIsMuted(event.currentTarget.muted);
        }}
        playsInline
      />

      {/* Karaoke band overlay */}
      {activeCue && (
        <div className="absolute inset-x-0 bottom-20 md:bottom-24 px-4 pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto">
            <div className="bg-black/70 backdrop-blur-md rounded-2xl px-4 py-3 md:px-6 md:py-4 shadow-2xl">
              {/* Hán tự line */}
              <div className="font-hanzi font-bold text-2xl md:text-4xl leading-snug text-white flex flex-wrap gap-x-2 md:gap-x-3 gap-y-2 justify-center">
                {(activeCue.karaokeTokens && activeCue.karaokeTokens.length > 0
                  ? activeCue.karaokeTokens.map((token) => token.text)
                  : activeCue.zh.split(/\s+/).filter(Boolean)
                ).map((text, index, arr) => {
                  // Lấy timing từ karaokeTokens nếu có, fallback chia đều cue
                  const token = activeCue.karaokeTokens?.[index];
                  const tokenStart = token?.startMs ?? activeCue.startMs + (index * (activeCue.endMs - activeCue.startMs)) / arr.length;
                  const tokenEnd = token?.endMs ?? activeCue.startMs + ((index + 1) * (activeCue.endMs - activeCue.startMs)) / arr.length;
                  const isPast = currentMs >= tokenEnd;
                  const isActive = currentMs >= tokenStart && currentMs < tokenEnd;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleTokenClick(activeCue, tokenStart, text)}
                      className={`transition-all duration-150 ease-out cursor-pointer px-1 rounded-md ${
                        isActive
                          ? 'text-[#FFD700] scale-110 drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]'
                          : isPast
                            ? 'text-[#E7E7EA]/70 hover:text-white'
                            : 'text-white/95 hover:text-white'
                      }`}
                      style={{ transformOrigin: 'center' }}
                    >
                      {text}
                    </button>
                  );
                })}
              </div>
              {/* Pinyin + Vi */}
              <div className="mt-2 text-center space-y-0.5">
                {activeCue.pinyin && (
                  <p className="font-mono text-xs md:text-sm text-[#FFD700]/80">
                    {activeCue.pinyin}
                  </p>
                )}
                {activeCue.vi && (
                  <p className="text-xs md:text-sm text-white/80 italic">
                    {activeCue.vi}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 md:px-4 py-2 md:py-3">
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
            className="text-white hover:text-[#FFD700] transition-colors p-1 cursor-pointer"
          >
            {isPlaying ? <Pause className="w-5 h-5 md:w-6 md:h-6" /> : <Play className="w-5 h-5 md:w-6 md:h-6" />}
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
            onChange={handleSeek}
            className="flex-1 accent-[#FFD700] cursor-pointer"
            aria-label="Thanh tua"
          />

          <span className="text-xs font-mono text-white/80 tabular-nums">
            {formatTime(totalSeconds)}
          </span>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Bật tiếng' : 'Tắt tiếng'}
            className="text-white hover:text-[#FFD700] transition-colors p-1 cursor-pointer"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 md:w-5 md:h-5" />
            ) : volume < 0.5 ? (
              <Volume1 className="w-4 h-4 md:w-5 md:h-5" />
            ) : (
              <Volume2 className="w-4 h-4 md:w-5 md:h-5" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            className="text-white hover:text-[#FFD700] transition-colors p-1 cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4 md:w-5 md:h-5" />
            ) : (
              <Maximize className="w-4 h-4 md:w-5 md:h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span>{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
