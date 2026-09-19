import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Sparkles, Clock } from 'lucide-react';
import type { PublishedLesson } from '../api/learning';
import { formatDuration } from '../utils/text';
import { useLessonPrefetchController } from '../hooks/useLessonPrefetchController';
import { perfMarks } from '../lib/perfMarks';

/**
 * Hover/focus dwell threshold. We never prefetch on a fast pass-by — only
 * after the user's pointer or focus has actually settled. 220ms is the
 * sweet spot: long enough to ignore accidental hover, short enough that
 * it still pays off before a click. See doc/video-performance.md.
 */
const PREFETCH_HOVER_MS = 220;

interface Connection {
  effectiveType?: string;
  saveData?: boolean;
}

function isConnectionConstrained(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as Navigator & { connection?: Connection }).connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  if (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') return true;
  return false;
}

export interface LessonCardProps {
  lesson: PublishedLesson;
  onClick: () => void;
  reasonVi?: string;
  badgeText?: string;
  className?: string;
}

export default function LessonCard({
  lesson,
  onClick,
  reasonVi,
  badgeText,
  className = '',
}: LessonCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const prefetcher = useLessonPrefetchController();
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceKey = `card:${lesson._id}`;

  useEffect(() => {
    setImageFailed(false);
  }, [lesson.thumbnailUrl]);

  // Cancel any pending hover timer if the user navigates away or the card
  // unmounts. The prefetcher's `release()` will also abort the in-flight
  // request when intent dissipates.
  useEffect(() => {
    return () => {
      if (hoverTimer.current) {
        clearTimeout(hoverTimer.current);
        hoverTimer.current = null;
      }
      prefetcher.release(sourceKey);
    };
  }, [prefetcher, sourceKey]);

  const onThumbnailLoad = () => {
    perfMarks.since('thumbnail:first', 'feed_list:ready', { lessonId: lesson._id });
  };

  /**
   * Trigger a debounced prefetch. We wait PREFETCH_HOVER_MS of dwell before
   * firing so passing over a card doesn't burn an HTTP request. When
   * Save-Data is set or the connection is slow, we skip the prefetch
   * entirely (the click path still works — it just won't be warm).
   */
  const schedulePrefetch = useCallback(() => {
    if (isConnectionConstrained()) return;
    if (hoverTimer.current) return;
    hoverTimer.current = setTimeout(() => {
      hoverTimer.current = null;
      prefetcher.acquire({ lessonId: lesson._id, source: sourceKey });
    }, PREFETCH_HOVER_MS);
  }, [prefetcher, lesson._id, sourceKey]);

  const cancelPrefetch = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    prefetcher.release(sourceKey);
  }, [prefetcher, sourceKey]);

  return (
    <div
      onClick={onClick}
      onMouseEnter={schedulePrefetch}
      onFocus={schedulePrefetch}
      onMouseLeave={cancelPrefetch}
      onBlur={cancelPrefetch}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group relative flex flex-col bg-white rounded-2xl border border-[#E7E7EA] p-2.5 sm:p-3 shadow-2xs hover:shadow-lg hover:border-[#B91B1C]/40 transition-all duration-200 text-left cursor-pointer hover:-translate-y-0.5 w-full max-w-[300px] ${className}`}
    >
      {/* 16:9 Thumbnail Box */}
      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-neutral-900 border border-black/5 shrink-0 select-none">
        {lesson.thumbnailUrl && !imageFailed ? (
          <img
            src={lesson.thumbnailUrl}
            alt={lesson.titleVi}
            onError={() => setImageFailed(true)}
            onLoad={onThumbnailLoad}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          /* Fallback Poster if thumbnail is unavailable or loading fails */
          <div className="w-full h-full bg-gradient-to-br from-[#1F1F23] via-[#2D1517] to-[#121214] flex flex-col items-center justify-center p-3 relative overflow-hidden">
            {/* Background Hanzi Watermark */}
            <span className="absolute -right-3 -bottom-4 text-5xl font-black text-white/5 font-hanzi select-none pointer-events-none">
              {lesson.titleZh ? lesson.titleZh.slice(0, 2) : '汉字'}
            </span>

            <div className="w-9 h-9 rounded-full bg-[#B91B1C]/20 border border-[#B91B1C]/40 flex items-center justify-center text-[#B91B1C] mb-1.5 shadow-inner">
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </div>
            <p className="text-[11px] font-bold text-white/80 text-center line-clamp-1 px-2">
              {lesson.titleVi}
            </p>
          </div>
        )}

        {/* Play Hover Overlay */}
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-[#B91B1C] text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-200">
            <Play className="w-4 h-4 fill-white ml-0.5" />
          </div>
        </div>

        {/* Top Badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
          <span className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-white/15 text-white text-[10px] font-black flex items-center gap-1 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B91B1C]" />
            HSK {lesson.hsk}
          </span>
          {badgeText && (
            <span className="px-1.5 py-0.5 rounded bg-[#B91B1C] text-white text-[9px] font-extrabold shadow-sm">
              {badgeText}
            </span>
          )}
        </div>

        <div className="absolute top-2 right-2 z-10">
          <span className="px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-md border border-white/10 text-white/90 text-[9px] font-bold shadow-sm">
            Song ngữ
          </span>
        </div>

        {/* Bottom Duration Badge */}
        <div className="absolute bottom-2 right-2 z-10">
          <span className="px-1.5 py-0.5 rounded bg-black/85 backdrop-blur-md border border-white/15 text-white font-mono text-[10px] font-bold shadow-sm flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 text-neutral-300" />
            {formatDuration(lesson.durationSeconds)}
          </span>
        </div>
      </div>

      {/* Card Info Content */}
      <div className="pt-2.5 px-0.5 pb-0.5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start gap-2.5">
            {/* Channel Logo / Avatar */}
            <div className="w-7 h-7 rounded-full bg-[#FDF1F1] border border-[#F5B8B9] flex items-center justify-center text-[#B91B1C] font-black text-[10px] shrink-0 select-none overflow-hidden mt-0.5 shadow-2xs">
              <img
                src="/favicon.png"
                alt="HanFlix"
                className="w-full h-full object-contain p-0.5"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="text-[10px] font-black text-[#B91B1C]">汉</span>
            </div>

            <div className="flex-1 min-w-0">
              {/* Vietnamese Title */}
              <h3 className="font-bold text-xs sm:text-sm text-[#18181B] line-clamp-1 leading-snug group-hover:text-[#B91B1C] transition-colors">
                {lesson.titleVi}
              </h3>

              {/* Chinese Title & Pinyin */}
              {lesson.titleZh && (
                <p className="text-[11px] text-[#5F6368] font-medium mt-0.5 line-clamp-1 font-hanzi">
                  {lesson.titleZh}
                  {lesson.pinyin ? ` · ${lesson.pinyin}` : ''}
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          {lesson.descriptionVi && (
            <p className="text-[11px] text-neutral-600 mt-2 line-clamp-2 leading-relaxed">
              {lesson.descriptionVi}
            </p>
          )}

          {/* AI Recommendation Reason */}
          {reasonVi && (
            <div className="mt-2 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200/60 text-[10px] font-semibold text-amber-900 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
              <span className="line-clamp-1">{reasonVi}</span>
            </div>
          )}
        </div>

        {/* Footer Meta Row */}
        <div className="mt-2.5 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-[#5F6368]">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-[#18181B]">HanFlix</span>
            <span
              className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-[#B91B1C] text-white text-[8px] font-bold"
              title="Verified"
            >
              ✓
            </span>
          </div>

          <span className="font-bold text-[#B91B1C] flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform text-[11px]">
            Xem bài học →
          </span>
        </div>
      </div>
    </div>
  );
}
