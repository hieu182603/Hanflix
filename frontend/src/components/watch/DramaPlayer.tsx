/**
 * CONTENT MODE (2026-09-22) - DRAMA: DramaPlayer.
 *
 * Player chuyên dụng cho clip kịch/drama:
 *  - Subtitle hiển thị với avatar/màu nền theo speaker.
 *  - Mỗi nhân vật có: displayName, color, avatarUrl.
 *  - Cue hiện tại có border màu của nhân vật.
 *
 * Đặc tính:
 *  - Tái sử dụng YouTubePlayer layout.
 *  - Overlay subtitle với speaker color + avatar.
 *  - Characters được truyền từ parent (lesson.characters).
 *  - SpeakerId → character lookup map để apply styling.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { SubtitleCue } from '../../api/learning';

export interface DramaCharacter {
  speakerId: string;
  displayName: string;
  color?: string;
  avatarUrl?: string;
  descriptionVi?: string;
}

export interface DramaPlayerProps {
  src: string;
  title: string;
  durationSeconds: number;
  cues: SubtitleCue[];
  characters?: DramaCharacter[];
  currentMs: number;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  onTimeUpdate?: (video: HTMLVideoElement) => void;
  onEnded?: () => void;
  onSeeking?: () => void;
  onPause?: () => void;
  onLoadedMetadata?: React.ReactEventHandler<HTMLVideoElement>;
  onTokenClick?: (cueId: string, wordId: string, wordText: string, event: React.MouseEvent) => void;
}

export default function DramaPlayer({
  src,
  title,
  durationSeconds,
  cues,
  characters = [],
  currentMs,
  videoRef: externalVideoRef,
  onTimeUpdate,
  onEnded,
  onSeeking,
  onPause,
  onLoadedMetadata,
  onTokenClick,
}: DramaPlayerProps) {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef ?? internalVideoRef;
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayMs, setDisplayMs] = useState(currentMs);
  useEffect(() => setDisplayMs(currentMs), [currentMs]);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Build speakerId → character map cho O(1) lookup
  const characterMap = useMemo(
    () => new Map(characters.map(c => [c.speakerId, c])),
    [characters],
  );

  const activeCue = useMemo(
    () => cues.find(c => c.startMs <= displayMs && displayMs < c.endMs),
    [cues, displayMs],
  );

  const activeCharacter = activeCue?.speakerId
    ? characterMap.get(activeCue.speakerId)
    : undefined;

  const onTimeUpdateInternal = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    setDisplayMs(event.currentTarget.currentTime * 1000);
    onTimeUpdate?.(event.currentTarget);
  }, [onTimeUpdate]);

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

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, [videoRef]);

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const value = Number(event.target.value);
    video.currentTime = value;
    setDisplayMs(value * 1000);
  };

  const totalSeconds = durationSeconds || (videoRef.current?.duration ?? 0);
  const currentSeconds = displayMs / 1000;
  const formatTime = (seconds: number) => {
    const total = Math.floor(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const speakerColor = activeCharacter?.color ?? '#B91B1C';
  const speakerInitial = activeCharacter?.displayName?.charAt(0)?.toUpperCase() ?? '?';
  const speakerName = activeCharacter?.displayName ?? '';

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video rounded-2xl md:rounded-3xl bg-black overflow-hidden shadow-xl group"
    >
      {error && <div role="alert" className="absolute z-30 inset-x-3 top-3 rounded-xl bg-black/80 p-3 text-sm text-white">{error}</div>}
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
        onVolumeChange={(event) => {
          setVolume(event.currentTarget.volume);
          setIsMuted(event.currentTarget.muted);
        }}
        onError={() => setError('Không thể tải nội dung. Vui lòng thử lại.')}
        onCanPlay={() => setError('')}
        playsInline
      />

      {/* Drama subtitle overlay */}
      {activeCue && (
        <div className="absolute inset-x-0 bottom-20 md:bottom-24 px-4">
          <div className="max-w-3xl mx-auto">
            {/* Speaker header */}
            <div className="flex items-center gap-3 mb-2">
              {/* Speaker avatar */}
              {activeCharacter?.avatarUrl ? (
                <img
                  src={activeCharacter.avatarUrl}
                  alt={speakerName}
                  className="w-8 h-8 rounded-full border-2 object-cover shrink-0"
                  style={{ borderColor: speakerColor }}
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-black text-white shrink-0"
                  style={{ backgroundColor: speakerColor, borderColor: 'transparent' }}
                >
                  {speakerInitial}
                </div>
              )}
              <div>
                <span
                  className="text-xs font-bold"
                  style={{ color: speakerColor }}
                >
                  {speakerName}
                </span>
              </div>
            </div>

            {/* Subtitle box */}
            <div
              className="bg-black/75 backdrop-blur-md rounded-2xl px-5 py-3 md:px-6 md:py-4 shadow-2xl border-2"
              style={{ borderColor: `${speakerColor}60` }}
            >
              {/* Hán tự */}
              <p className="font-hanzi font-bold text-xl md:text-3xl leading-snug text-white">
                {activeCue.tokens?.length
                  ? activeCue.tokens.map((token, index) =>
                      token.wordId?._id ? (
                        <button
                          key={index}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTokenClick?.(activeCue.cueId, token.wordId!._id, token.text, e);
                          }}
                          className="hover:underline cursor-pointer transition-colors"
                          title={`Tra từ: ${token.text}`}
                        >
                          {token.text}
                        </button>
                      ) : (
                        <span key={index}>{token.text}</span>
                      ),
                    )
                  : activeCue.zh}
              </p>
              {/* Pinyin */}
              {activeCue.pinyin && (
                <p className="font-mono text-xs md:text-sm mt-1.5" style={{ color: `${speakerColor}CC` }}>
                  {activeCue.pinyin}
                </p>
              )}
              {/* Việt nam */}
              {activeCue.vi && (
                <p className="text-xs md:text-sm text-white/80 mt-1 italic">
                  {activeCue.vi}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Character quick-nav bar */}
      {characters.length > 0 && (
        <div className="absolute top-3 right-3 flex gap-1.5">
          {characters.map((char) => {
            const isActive = activeCharacter?.speakerId === char.speakerId;
            const color = char.color ?? '#B91B1C';
            return (
              <div
                key={char.speakerId}
                title={char.displayName}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-black cursor-pointer transition-all ${
                  isActive ? 'scale-110' : 'scale-100 opacity-70 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: color,
                  borderColor: isActive ? 'white' : 'transparent',
                  color: 'white',
                }}
              >
                {char.avatarUrl ? (
                  <img
                    src={char.avatarUrl}
                    alt={char.displayName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  char.displayName.charAt(0).toUpperCase()
                )}
              </div>
            );
          })}
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
            {isPlaying ? (
              <Pause className="w-5 h-5 md:w-6 md:h-6" />
            ) : (
              <Play className="w-5 h-5 md:w-6 md:h-6" />
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
            onChange={handleSeek}
            className="flex-1 cursor-pointer"
            style={{ accentColor: speakerColor }}
          />

          <span className="text-xs font-mono text-white/80 tabular-nums">
            {formatTime(totalSeconds)}
          </span>

          <button
            type="button"
            onClick={toggleMute}
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
    </div>
  );
}
