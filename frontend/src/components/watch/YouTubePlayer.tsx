import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Captions,
  CaptionsOff,
  Check,
  ChevronRight,
  Maximize,
  Minimize,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  SubtitleOverlay,
  type SubtitleLanguageTrack,
  type SubtitleOverlayStyle,
} from './SubtitleOverlay';
import type { SubtitleCue } from '../../api/learning';
import { perfMarks } from '../../lib/perfMarks';

export interface YouTubePlayerProps {
  src: string;
  title: string;
  durationSeconds: number;
  cues: SubtitleCue[];
  currentMs: number;
  topTrack: SubtitleLanguageTrack;
  bottomTrack: SubtitleLanguageTrack;
  subtitleStyle: SubtitleOverlayStyle;
  subtitleScale?: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onSubtitleChange: (next: {
    top: SubtitleLanguageTrack;
    bottom: SubtitleLanguageTrack;
    style?: SubtitleOverlayStyle;
    scale?: number;
  }) => void;
  onTimeUpdate: (video: HTMLVideoElement) => void;
  onSeeking: () => void;
  onPause: () => void;
  onEnded: () => void;
  onLoadedMetadata?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onTokenClick?: (cueId: string, wordId: string, wordText: string, event: React.MouseEvent) => void;
  onSaveWord?: (cueId: string, wordId: string) => void;
}

export default function YouTubePlayer({
  src,
  title,
  durationSeconds,
  cues,
  currentMs,
  topTrack,
  bottomTrack,
  subtitleStyle,
  subtitleScale = 100,
  videoRef,
  onSubtitleChange,
  onTimeUpdate,
  onSeeking,
  onPause,
  onEnded,
  onLoadedMetadata,
  onTokenClick,
  onSaveWord,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const volumeBarRef = useRef<HTMLDivElement | null>(null);
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const firstFrameMarkedRef = useRef(false);

  const markFirstFrameIfNeeded = useCallback(() => {
    if (firstFrameMarkedRef.current) return;
    firstFrameMarkedRef.current = true;
    perfMarks.since('first_frame:rendered', 'lesson_media:ready', { lessonId: title });
  }, [title]);

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [playPulse, setPlayPulse] = useState<'play' | 'pause' | null>(null);

  // Subtitle Scale state
  const [scale, setScale] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = Number(localStorage.getItem('hanflix_subtitle_scale'));
      if (saved >= 50 && saved <= 200) return saved;
    }
    return subtitleScale ?? 100;
  });

  useEffect(() => {
    if (subtitleScale && subtitleScale >= 50 && subtitleScale <= 200) {
      setScale(subtitleScale);
    }
  }, [subtitleScale]);

  const handleScaleChange = (newScale: number) => {
    const clamped = Math.max(60, Math.min(180, Math.round(newScale)));
    setScale(clamped);
    localStorage.setItem('hanflix_subtitle_scale', String(clamped));
    onSubtitleChange({
      top: topTrack,
      bottom: bottomTrack,
      style: subtitleStyle,
      scale: clamped,
    });
  };

  // Settings menu state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSubmenu, setSettingsSubmenu] = useState<
    'main' | 'speed' | 'topTrack' | 'bottomTrack' | 'size'
  >('main');
  const [autoplayNext, setAutoplayNext] = useState(true);

  const areSubtitlesActive = topTrack !== 'off' || bottomTrack !== 'off';

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const totalSecs = Math.floor(secs);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      void video.play();
      setIsPlaying(true);
      setPlayPulse('play');
    } else {
      video.pause();
      setIsPlaying(false);
      setPlayPulse('pause');
    }
    setTimeout(() => setPlayPulse(null), 500);
  }, [videoRef]);

  // Volume & Mute
  const handleVolumeChange = useCallback((newVol: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, newVol));
    video.volume = clamped;
    setVolume(clamped);
    if (clamped === 0) {
      video.muted = true;
      setIsMuted(true);
    } else if (video.muted) {
      video.muted = false;
      setIsMuted(false);
    }
  }, [videoRef]);

  const updateVolumeFromClientX = useCallback((clientX: number) => {
    const bar = volumeBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    handleVolumeChange(ratio);
  }, [handleVolumeChange]);

  const handleVolumeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingVolume(true);
    updateVolumeFromClientX(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      updateVolumeFromClientX(moveEvent.clientX);
    };

    const onMouseUp = () => {
      setIsDraggingVolume(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleVolumeTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!e.touches[0]) return;
    setIsDraggingVolume(true);
    updateVolumeFromClientX(e.touches[0].clientX);

    const onTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches[0]) {
        updateVolumeFromClientX(moveEvent.touches[0].clientX);
      }
    };

    const onTouchEnd = () => {
      setIsDraggingVolume(false);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.muted = false;
      setIsMuted(false);
      if (volume === 0) {
        video.volume = 0.5;
        setVolume(0.5);
      }
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  };

  // Playback speed
  const changePlaybackRate = (rate: number, closeMenu = false) => {
    const video = videoRef.current;
    const rounded = Math.round(rate * 100) / 100;
    if (video) {
      video.playbackRate = rounded;
      setPlaybackRate(rounded);
      localStorage.setItem('hanflix_playback_speed', String(rounded));
    }
    if (closeMenu) {
      setSettingsSubmenu('main');
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      void container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Quick toggle Subtitles (CC)
  const toggleSubtitles = () => {
    if (areSubtitlesActive) {
      onSubtitleChange({ top: 'off', bottom: 'off' });
    } else {
      onSubtitleChange({ top: 'zh', bottom: 'vi' });
    }
  };

  // Auto-hide controls timer
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    if (isPlaying && !settingsOpen) {
      hideControlsTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 2500);
    }
  }, [isPlaying, settingsOpen]);

  // Video event handlers
  const handleTimeUpdateInternal = (video: HTMLVideoElement) => {
    setCurrentTime(video.currentTime);
    if (!duration || duration < 1) {
      setDuration(video.duration || durationSeconds);
    }
    // Calculate buffered percentage
    if (video.buffered.length > 0) {
      for (let i = video.buffered.length - 1; i >= 0; i--) {
        if (video.buffered.start(i) <= video.currentTime) {
          setBufferedEnd(video.buffered.end(i));
          break;
        }
      }
    }
    onTimeUpdate(video);
  };

  // Scrubber seeking calculations
  const seekToPosition = (clientX: number) => {
    const bar = progressBarRef.current;
    const video = videoRef.current;
    if (!bar || !video || !duration) return;

    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = ratio * duration;
    video.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsScrubbing(true);
    seekToPosition(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      seekToPosition(moveEvent.clientX);
    };

    const onMouseUp = () => {
      setIsScrubbing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleProgressMouseMove = (e: React.MouseEvent) => {
    const bar = progressBarRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    setHoverTime(ratio * duration);
    setHoverX(Math.max(20, Math.min(rect.width - 20, x)));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        toggleSubtitles();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleVolumeChange(Math.min(1, Math.round((volume + 0.05) * 100) / 100));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleVolumeChange(Math.max(0, Math.round((volume - 0.05) * 100) / 100));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, duration, videoRef, volume, handleVolumeChange]);

  // Click outside to close settings popup
  useEffect(() => {
    if (!settingsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const container = containerRef.current;
      if (container && !container.contains(e.target as Node)) {
        setSettingsOpen(false);
        setSettingsSubmenu('main');
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => {
        if (isPlaying && !settingsOpen && !isDraggingVolume) {
          setControlsVisible(false);
        }
      }}
      className="relative w-full aspect-video rounded-2xl md:rounded-3xl overflow-hidden bg-black border border-[#E7E7EA] shadow-xl group select-none flex items-center justify-center cursor-pointer"
    >
      {/* 1. Underlying Video Element */}
      <video
        ref={videoRef}
        preload="metadata"
        src={src}
        className="w-full h-full object-contain"
        aria-label={`Video ${title}`}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onPlay={() => {
          setIsPlaying(true);
          markFirstFrameIfNeeded();
        }}
        onPause={() => {
          setIsPlaying(false);
          setControlsVisible(true);
          onPause();
        }}
        onEnded={() => {
          setIsPlaying(false);
          setControlsVisible(true);
          onEnded();
        }}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || durationSeconds);
          const savedSpeed = Number(localStorage.getItem('hanflix_playback_speed') ?? 1);
          if (savedSpeed >= 0.25 && savedSpeed <= 3) {
            e.currentTarget.playbackRate = savedSpeed;
            setPlaybackRate(savedSpeed);
          }
          perfMarks.since('metadata:ready', 'lesson_media:ready', { lessonId: title });
          onLoadedMetadata?.(e);
        }}
        onTimeUpdate={(e) => handleTimeUpdateInternal(e.currentTarget)}
        onSeeking={onSeeking}
        onWaiting={() => perfMarks.mark('buffering:start', { lessonId: title })}
        onCanPlay={() => perfMarks.since('buffering:end', 'buffering:start', { lessonId: title })}
        onPlaying={() => {
          markFirstFrameIfNeeded();
        }}
      />
      {/* Invisible <video> for true first-frame measurement via rVFC.
          The browser reports a frame callback before the first decoded frame
          is painted; we mark `first_frame:rendered` only then. Falls back
          to the `playing` event when rVFC is unavailable. */}
      <FirstFrameProbe videoRef={videoRef} />

      {/* 2. Subtitle Overlay */}
      <SubtitleOverlay
        cues={cues}
        currentMs={currentMs}
        topTrack={topTrack}
        bottomTrack={bottomTrack}
        style={subtitleStyle}
        scale={scale}
        className={`pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-1 px-4 transition-all duration-300 ${
          controlsVisible || !isPlaying || isScrubbing || settingsOpen
            ? 'bottom-13 sm:bottom-14'
            : 'bottom-3 sm:bottom-4'
        }`}
        onTokenClick={onTokenClick}
        onSaveWord={onSaveWord}
      />

      {/* 3. Play / Pause Center Flash Animation on click */}
      {playPulse && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-18 h-18 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center text-white scale-110 animate-out fade-out zoom-out-95 duration-400">
            {playPulse === 'play' ? (
              <Play className="w-8 h-8 fill-white ml-1" />
            ) : (
              <Pause className="w-8 h-8 fill-white" />
            )}
          </div>
        </div>
      )}

      {/* 4. YouTube-style Bottom Control Bar Scrim & Controls Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-x-0 bottom-0 z-30 transition-opacity duration-300 ${
          controlsVisible || !isPlaying || isScrubbing || settingsOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Dark gradient backdrop behind controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none -top-12" />

        <div className="relative px-3 sm:px-4 pb-2 sm:pb-3 pt-4 space-y-1.5">
          {/* ============ A. YouTube Scrubber Bar ============ */}
          <div
            ref={progressBarRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleProgressMouseMove}
            onMouseEnter={() => setHoverTime(currentTime)}
            onMouseLeave={() => setHoverTime(null)}
            className="group/scrubber relative w-full h-1.5 hover:h-2.5 bg-white/20 hover:bg-white/30 rounded-full cursor-pointer transition-all flex items-center"
            title="Kéo hoặc bấm để tua video"
          >
            {/* Buffer progress bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/40 rounded-full pointer-events-none transition-all"
              style={{ width: `${bufferPercent}%` }}
            />

            {/* Current played progress bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-[#B91B1C] rounded-full pointer-events-none transition-all"
              style={{ width: `${progressPercent}%` }}
            />

            {/* Scrubber Knob / Handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-[#B91B1C] border-2 border-white rounded-full shadow-md scale-0 group-hover/scrubber:scale-100 transition-transform pointer-events-none"
              style={{ left: `${progressPercent}%` }}
            />

            {/* Hover timestamp tooltip */}
            {hoverTime !== null && (
              <div
                className="absolute -top-8 px-2 py-0.5 rounded-md bg-black/90 text-white font-mono text-[11px] font-bold shadow-lg pointer-events-none -translate-x-1/2 border border-white/10"
                style={{ left: `${hoverX}px` }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>

          {/* ============ B. YouTube Control Buttons Bar ============ */}
          <div className="flex items-center justify-between text-white text-xs pt-1">
            {/* Left Controls: Play/Pause, Volume, Time Pill */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Play / Pause button */}
              <button
                type="button"
                onClick={togglePlay}
                className="p-1.5 sm:p-2 rounded-full text-white/90 hover:text-white hover:bg-white/15 transition-all cursor-pointer"
                title={isPlaying ? 'Tạm dừng (k)' : 'Phát (k)'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-white" />
                ) : (
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                )}
              </button>

              {/* Volume Button & YouTube Draggable Slider Pill (Image 1 style) */}
              <div
                className={`group/vol flex items-center rounded-full transition-all duration-200 ${
                  isVolumeHovered || isDraggingVolume
                    ? 'bg-black/50 backdrop-blur-md px-1.5 py-0.5 border border-white/15'
                    : 'bg-transparent group-hover/vol:bg-black/50 group-hover/vol:backdrop-blur-md group-hover/vol:px-1.5 group-hover/vol:py-0.5 group-hover/vol:border group-hover/vol:border-white/15'
                }`}
                onMouseEnter={() => setIsVolumeHovered(true)}
                onMouseLeave={() => setIsVolumeHovered(false)}
              >
                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-1.5 rounded-full text-white hover:bg-white/15 transition-all cursor-pointer flex items-center justify-center shrink-0"
                  title={isMuted ? 'Bật âm thanh (m)' : 'Tắt âm thanh (m)'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5 text-white fill-white" />
                  ) : volume < 0.5 ? (
                    <Volume1 className="w-5 h-5 text-white fill-white" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-white fill-white" />
                  )}
                </button>

                {/* Volume slider expands smoothly on hover or while dragging */}
                <div
                  className={`overflow-hidden transition-all duration-200 flex items-center h-8 shrink-0 ${
                    isVolumeHovered || isDraggingVolume
                      ? 'w-20 sm:w-24 pl-1 pr-2 opacity-100 pointer-events-auto'
                      : 'w-0 px-0 opacity-0 pointer-events-none group-hover/vol:w-20 sm:group-hover/vol:w-24 group-hover/vol:pl-1 group-hover/vol:pr-2 group-hover/vol:opacity-100 group-hover/vol:pointer-events-auto'
                  }`}
                >
                  <div
                    ref={volumeBarRef}
                    onMouseDown={handleVolumeMouseDown}
                    onTouchStart={handleVolumeTouchStart}
                    className="relative w-full h-8 flex items-center cursor-pointer select-none"
                    title={`Âm lượng: ${Math.round((isMuted ? 0 : volume) * 100)}% (kéo để chỉnh)`}
                  >
                    {/* Background track (semi-transparent white) */}
                    <div className="w-full h-[3px] bg-white/30 rounded-full pointer-events-none" />

                    {/* Active volume line (pure solid white, as in Image 1) */}
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-[3px] bg-white rounded-full pointer-events-none"
                      style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                    />

                    {/* Pure solid white circle thumb / knob (as in Image 1) */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-md pointer-events-none"
                      style={{ left: `${(isMuted ? 0 : volume) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Time Pill Container (as seen in Image 2) */}
              <div className="bg-neutral-800/80 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-mono font-medium text-white/90 border border-white/10 tracking-wider shadow-inner">
                <span>{formatTime(currentTime)}</span>
                <span className="mx-1 text-white/50">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right Controls: Autoplay, CC Subtitles, Settings Gear, Fullscreen */}
            <div className="flex items-center gap-1 sm:gap-2 relative">
              {/* Autoplay toggle pill */}
              <button
                type="button"
                onClick={() => setAutoplayNext((prev) => !prev)}
                className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold transition-all cursor-pointer ${
                  autoplayNext
                    ? 'bg-white/20 text-white border-white/30'
                    : 'bg-black/40 text-white/50 border-white/10'
                }`}
                title={`Tự động chuyển bài tiếp: ${autoplayNext ? 'Đang bật' : 'Đang tắt'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${autoplayNext ? 'bg-[#B91B1C] animate-pulse' : 'bg-neutral-400'}`} />
                <span>Tự động phát</span>
              </button>

              {/* Subtitles / CC Button (as seen in Image 2) */}
              <button
                type="button"
                onClick={toggleSubtitles}
                className={`relative p-1.5 sm:p-2 rounded-lg transition-all cursor-pointer ${
                  areSubtitlesActive
                    ? 'text-white hover:bg-white/15'
                    : 'text-white/50 hover:text-white hover:bg-white/10'
                }`}
                title={areSubtitlesActive ? 'Tắt phụ đề (c)' : 'Bật phụ đề (c)'}
              >
                {areSubtitlesActive ? (
                  <div className="flex flex-col items-center">
                    <Captions className="w-5 h-5 text-white" />
                    <span className="w-4 h-0.5 bg-[#B91B1C] rounded-full mt-0.5 shadow-xs" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <CaptionsOff className="w-5 h-5 text-white/60" />
                    <span className="w-4 h-0.5 bg-transparent mt-0.5" />
                  </div>
                )}
              </button>

              {/* Settings Gear Button (bánh răng cưa) */}
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen((prev) => !prev);
                  setSettingsSubmenu('main');
                }}
                className={`p-1.5 sm:p-2 rounded-full transition-all cursor-pointer ${
                  settingsOpen
                    ? 'bg-white/20 text-white rotate-45'
                    : 'text-white/90 hover:text-white hover:bg-white/15'
                }`}
                title="Cài đặt phụ đề & tốc độ phát"
              >
                <Settings className="w-5 h-5 transition-transform duration-200" />
              </button>

              {/* Settings Popup Menu (YouTube Style floating menu) */}
              {settingsOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-12 right-0 z-50 w-72 rounded-2xl border border-white/15 bg-neutral-900/95 text-white p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                >
                  {/* Main Settings Menu */}
                  {settingsSubmenu === 'main' && (
                    <div className="space-y-1">
                      <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400 border-b border-white/10">
                        Cài đặt phát video
                      </p>

                      {/* Subtitle track 1 selector */}
                      <button
                        type="button"
                        onClick={() => setSettingsSubmenu('topTrack')}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-xs font-medium text-left cursor-pointer"
                      >
                        <span className="text-neutral-300">Phụ đề dòng trên</span>
                        <div className="flex items-center gap-1 text-white font-bold">
                          <span>{TRACK_LABELS[topTrack]}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                        </div>
                      </button>

                      {/* Subtitle track 2 selector */}
                      <button
                        type="button"
                        onClick={() => setSettingsSubmenu('bottomTrack')}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-xs font-medium text-left cursor-pointer"
                      >
                        <span className="text-neutral-300">Phụ đề dòng dưới</span>
                        <div className="flex items-center gap-1 text-white font-bold">
                          <span>{TRACK_LABELS[bottomTrack]}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                        </div>
                      </button>

                      {/* Subtitle Size selector */}
                      <button
                        type="button"
                        onClick={() => setSettingsSubmenu('size')}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-xs font-medium text-left cursor-pointer"
                      >
                        <span className="text-neutral-300">Cỡ chữ phụ đề</span>
                        <div className="flex items-center gap-1 text-white font-bold">
                          <span>{scale}%</span>
                          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                        </div>
                      </button>

                      {/* Playback speed selector */}
                      <button
                        type="button"
                        onClick={() => setSettingsSubmenu('speed')}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-xs font-medium text-left cursor-pointer"
                      >
                        <span className="text-neutral-300">Tốc độ phát</span>
                        <div className="flex items-center gap-1 text-white font-bold">
                          <span>{playbackRate === 1 ? 'Chuẩn' : `${playbackRate}x`}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Submenu: Top Subtitle Track */}
                  {settingsSubmenu === 'topTrack' && (
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setSettingsSubmenu('main')}
                        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-neutral-400 hover:text-white border-b border-white/10 cursor-pointer"
                      >
                        <span>← Chọn dòng phụ đề trên</span>
                      </button>
                      {(['off', 'zh', 'pinyin', 'vi'] as SubtitleLanguageTrack[]).map((track) => (
                        <button
                          key={track}
                          type="button"
                          onClick={() => {
                            onSubtitleChange({ top: track, bottom: bottomTrack });
                            setSettingsSubmenu('main');
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                            topTrack === track ? 'bg-white/20 text-white font-bold' : 'hover:bg-white/10 text-neutral-300'
                          }`}
                        >
                          <span>{TRACK_LABELS[track]}</span>
                          {topTrack === track && <Check className="w-4 h-4 text-[#B91B1C]" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Submenu: Bottom Subtitle Track */}
                  {settingsSubmenu === 'bottomTrack' && (
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setSettingsSubmenu('main')}
                        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-neutral-400 hover:text-white border-b border-white/10 cursor-pointer"
                      >
                        <span>← Chọn dòng phụ đề dưới</span>
                      </button>
                      {(['off', 'zh', 'pinyin', 'vi'] as SubtitleLanguageTrack[]).map((track) => (
                        <button
                          key={track}
                          type="button"
                          onClick={() => {
                            onSubtitleChange({ top: topTrack, bottom: track });
                            setSettingsSubmenu('main');
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                            bottomTrack === track ? 'bg-white/20 text-white font-bold' : 'hover:bg-white/10 text-neutral-300'
                          }`}
                        >
                          <span>{TRACK_LABELS[track]}</span>
                          {bottomTrack === track && <Check className="w-4 h-4 text-[#B91B1C]" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Submenu: Subtitle Size */}
                  {settingsSubmenu === 'size' && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setSettingsSubmenu('main')}
                        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-neutral-400 hover:text-white border-b border-white/10 cursor-pointer"
                      >
                        <span>← Cỡ chữ phụ đề</span>
                      </button>

                      {/* Custom Size Stepper & Slider */}
                      <div className="bg-white/5 p-3 rounded-xl space-y-2.5 border border-white/5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-300 font-medium">Tùy chỉnh</span>
                          <span className="text-[#B91B1C] font-mono font-bold">{scale}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleScaleChange(scale - 5)}
                            disabled={scale <= 60}
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            title="Giảm 5%"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="range"
                            min="60"
                            max="180"
                            step="5"
                            value={scale}
                            onChange={(e) => handleScaleChange(Number(e.target.value))}
                            className="flex-1 h-1.5 bg-white/20 accent-[#B91B1C] rounded-full cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => handleScaleChange(scale + 5)}
                            disabled={scale >= 180}
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            title="Tăng 5%"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {scale !== 100 && (
                          <button
                            type="button"
                            onClick={() => handleScaleChange(100)}
                            className="w-full text-center text-[10px] text-neutral-400 hover:text-white flex items-center justify-center gap-1 pt-1 cursor-pointer transition-colors"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Về cỡ chuẩn 100%</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Submenu: Playback Speed */}
                  {settingsSubmenu === 'speed' && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setSettingsSubmenu('main')}
                        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-neutral-400 hover:text-white border-b border-white/10 cursor-pointer"
                      >
                        <span>← Tốc độ phát video</span>
                      </button>

                      {/* Custom Speed Stepper & Slider */}
                      <div className="bg-white/5 p-2.5 rounded-xl space-y-2 border border-white/5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-300 font-medium">Tùy chỉnh tốc độ</span>
                          <span className="text-red-400 font-mono font-bold">{playbackRate.toFixed(2)}x</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => changePlaybackRate(Math.max(0.25, playbackRate - 0.05), false)}
                            disabled={playbackRate <= 0.25}
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            title="Chậm hơn 0.05x"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="range"
                            min="0.25"
                            max="2.5"
                            step="0.05"
                            value={playbackRate}
                            onChange={(e) => changePlaybackRate(Number(e.target.value), false)}
                            className="flex-1 h-1.5 bg-white/20 accent-[#B91B1C] rounded-full cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => changePlaybackRate(Math.min(2.5, playbackRate + 0.05), false)}
                            disabled={playbackRate >= 2.5}
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            title="Nhanh hơn 0.05x"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {playbackRate !== 1 && (
                          <button
                            type="button"
                            onClick={() => changePlaybackRate(1, false)}
                            className="w-full text-center text-[10px] text-neutral-400 hover:text-white flex items-center justify-center gap-1 pt-0.5 cursor-pointer"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Về tốc độ chuẩn 1.0x</span>
                          </button>
                        )}
                      </div>

                      {/* Quick speed presets */}
                      <div className="space-y-0.5">
                        {[
                          { rate: 0.5, label: '0.5x' },
                          { rate: 0.75, label: '0.75x (Luyện nghe)' },
                          { rate: 1, label: '1.0x (Chuẩn)' },
                          { rate: 1.25, label: '1.25x' },
                          { rate: 1.5, label: '1.5x' },
                          { rate: 1.75, label: '1.75x' },
                          { rate: 2, label: '2.0x' },
                        ].map((item) => (
                          <button
                            key={item.rate}
                            type="button"
                            onClick={() => changePlaybackRate(item.rate, true)}
                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                              playbackRate === item.rate
                                ? 'bg-white/20 text-white font-bold'
                                : 'hover:bg-white/10 text-neutral-300'
                            }`}
                          >
                            <span>{item.label}</span>
                            {playbackRate === item.rate && <Check className="w-4 h-4 text-[#B91B1C]" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1.5 sm:p-2 rounded-full text-white/90 hover:text-white hover:bg-white/15 transition-all cursor-pointer"
                title={isFullscreen ? 'Thoát toàn màn hình (f)' : 'Toàn màn hình (f)'}
              >
                {isFullscreen ? (
                  <Minimize className="w-5 h-5" />
                ) : (
                  <Maximize className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const TRACK_LABELS: Record<SubtitleLanguageTrack, string> = {
  zh: 'Tiếng Trung',
  pinyin: 'Pinyin',
  vi: 'Tiếng Việt',
  off: 'Tắt',
};

/**
 * Lightweight rVFC-based first-frame probe.
 *
 * `requestVideoFrameCallback` is the only API that fires once an actual
 * decoded frame is about to be painted. We subscribe as soon as the player
 * has a `src` and clear the subscription when the video changes or unmounts.
 *
 * We deliberately do NOT render anything — this component exists only to
 * schedule the callback. The render cost is one extra React node.
 *
 * When rVFC is unavailable (Safari < 16, firefox behind a flag), the
 * `onPlaying` event handler in the main `<video>` element falls back to
 * marking `first_frame:rendered` with a `approx: true` flag.
 */
function FirstFrameProbe({
  videoRef,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    if (typeof (video as HTMLVideoElement & { requestVideoFrameCallback?: unknown })
      .requestVideoFrameCallback !== 'function') {
      return undefined;
    }
    let cancelled = false;
    const rVFC = (video as HTMLVideoElement & {
      requestVideoFrameCallback: (cb: (now: number, metadata: unknown) => void) => number;
      cancelVideoFrameCallback: (handle: number) => void;
    });
    const handle = rVFC.requestVideoFrameCallback(() => {
      if (cancelled) return;
      perfMarks.since('first_frame:rendered', 'lesson_media:ready');
    });
    return () => {
      cancelled = true;
      try {
        rVFC.cancelVideoFrameCallback(handle);
      } catch {
        /* ignore */
      }
    };
  }, [videoRef]);
  return null;
}
