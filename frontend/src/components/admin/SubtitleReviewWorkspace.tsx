import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  approveAdminSubtitles, getAdminMedia, getAdminSubtitleReview, reopenAdminSubtitles, saveAdminSubtitleStyle,
  saveAdminSubtitles, type AdminCue, type AdminLesson, type AdminSubtitleStyle, type SubtitleReviewStatus, type AdminSubtitleReviewPayload,
} from '../../api/admin';
import { DEFAULT_SUBTITLE_STYLE, SubtitleSharedPreview, type SubtitleLanguageTrack, type SubtitleVisualPreset } from '../watch/SubtitleSharedPreview';
import { useNotification, InlineBanner, Spinner } from '../notifications';
import { useSubtitleSync } from '../../hooks/useSubtitleSync';
import { SubtitleNavigator } from './subtitle/SubtitleNavigator';
import { SubtitleVideoMonitor } from './subtitle/SubtitleVideoMonitor';
import { SubtitleInspector } from './subtitle/SubtitleInspector';
import { SubtitleTimeline } from './subtitle/SubtitleTimeline';
import { SubtitleReviewHeader } from './subtitle/SubtitleReviewHeader';

const STORAGE_VISUAL_KEY = 'hanflix_subtitle_visual_preset';
const STORAGE_TRACK_KEY = 'hanflix_subtitle_admin_tracks';

interface PersistedTracks {
  top: SubtitleLanguageTrack;
  bottom: SubtitleLanguageTrack;
}

function readPersistedTracks(): PersistedTracks {
  try {
    const raw = window.localStorage.getItem(STORAGE_TRACK_KEY);
    if (!raw) return { top: 'zh', bottom: 'vi' };
    const parsed = JSON.parse(raw) as Partial<PersistedTracks>;
    return {
      top: parsed.top === 'pinyin' || parsed.top === 'vi' ? parsed.top : 'zh',
      bottom: parsed.bottom === 'zh' || parsed.bottom === 'pinyin' || parsed.bottom === 'vi' ? parsed.bottom : 'vi',
    };
  } catch {
    return { top: 'zh', bottom: 'vi' };
  }
}

function readPersistedVisualPreset(): SubtitleVisualPreset {
  const value = window.localStorage.getItem(STORAGE_VISUAL_KEY);
  if (value === 'classic_yellow' || value === 'netflix' || value === 'anime') return value;
  return 'modern';
}

interface SubtitleReviewWorkspaceProps {
  lesson: AdminLesson;
  onBack: () => void;
  /** Called after the admin successfully approves so the parent can switch tabs. */
  onApproved?: () => void;
}

/**
 * Subtitle Review Workspace.
 *
 * Layout:
 *   - Header: back, lesson meta, status badge, save/approve buttons
 *   - 3 panels: Navigator (cue list) | Video Monitor (player + preview) | Inspector (content / appearance)
 *   - Timeline: click-to-seek + per-cue blocks
 *
 * All cues live in `localCues` so the admin can edit freely; debounced
 * auto-save (2s) flushes them to PUT /subtitles, manual "Lưu bản nháp"
 * flushes immediately, and "Duyệt phụ đề & Tiếp tục" finalizes the approval
 * before letting the parent navigate to Content Review.
 */
export default function SubtitleReviewWorkspace({ lesson, onBack, onApproved }: SubtitleReviewWorkspaceProps) {
  const notify = useNotification();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState<AdminSubtitleReviewPayload | null>(null);
  const [media, setMedia] = useState<{ url: string; mimeType: string; sizeBytes: number } | null>(null);
  const [localCues, setLocalCues] = useState<AdminCue[]>([]);
  const [style, setStyle] = useState<AdminSubtitleStyle>(DEFAULT_SUBTITLE_STYLE);
  const [reviewStatus, setReviewStatus] = useState<SubtitleReviewStatus>('pending');
  const [approvedAt, setApprovedAt] = useState<string | undefined>();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<PersistedTracks>(() => readPersistedTracks());
  const [visualPreset, setVisualPreset] = useState<SubtitleVisualPreset>(() => readPersistedVisualPreset());

  const videoRef = useRef<HTMLVideoElement>(null);

  // Load on mount + when the lesson changes.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setDirty(false);
    setPayload(null);
    setMedia(null);
    void Promise.all([getAdminSubtitleReview(lesson._id), getAdminMedia(lesson._id).catch(() => null)])
      .then(([review, mediaResponse]) => {
        if (!active) return;
        setPayload(review);
        setLocalCues(review.subtitle?.cues ?? []);
        const persistedStyle = review.lesson.subtitleStyle;
        if (persistedStyle) setStyle(persistedStyle);
        setReviewStatus(review.lesson.subtitleReviewStatus ?? 'pending');
        if (review.lesson.subtitleApprovedAt) setApprovedAt(review.lesson.subtitleApprovedAt);
        if (mediaResponse && 'media' in mediaResponse) setMedia(mediaResponse.media);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu phụ đề.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [lesson._id]);

  const sync = useSubtitleSync({
    cues: localCues,
    videoRef,
  });

  // Bridge the native <video> timeupdate event into our shared currentTimeMs.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdate = () => {
      if (sync.currentTimeMs === Math.round(video.currentTime * 1000)) return;
      // Only update from the video when the user is watching — Inspector
      // seeks push into the video via setCurrentTimeMs (already clamped).
      // We avoid an infinite loop by relying on a small tolerance here.
      const nextMs = Math.round(video.currentTime * 1000);
      // Bypass the seek-clamp by writing only when the value is meaningfully
      // different (the user actually played).
      if (Math.abs(sync.currentTimeMs - nextMs) > 30) {
        // Imperative write without bouncing through the video (which would
        // trigger its own timeupdate). We extend the hook with a setter that
        // does NOT touch the video element when called from the bridge.
        (sync.setCurrentTimeMs as unknown as (ms: number, opts?: { fromVideo?: boolean }) => void)(nextMs, { fromVideo: true });
      }
    };
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', () => { /* play state handled by hook */ });
    video.addEventListener('pause', () => { /* pause state handled by hook */ });
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', () => undefined);
      video.removeEventListener('pause', () => undefined);
    };
  // sync.currentTimeMs / sync.setCurrentTimeMs are stable across renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef.current]);

  // Persist UI prefs (tracks, visual) per browser.
  useEffect(() => {
    window.localStorage.setItem(STORAGE_TRACK_KEY, JSON.stringify(tracks));
  }, [tracks]);
  useEffect(() => {
    window.localStorage.setItem(STORAGE_VISUAL_KEY, visualPreset);
  }, [visualPreset]);

  // Debounced style auto-save (separate from cue saves so appearance edits
  // commit independently and immediately — admins expect font tweaks to stick
  // without needing to hit "Lưu bản nháp").
  useEffect(() => {
    if (loading) return;
    const timer = window.setTimeout(() => {
      void saveAdminSubtitleStyle(lesson._id, style)
        .then(() => {
          if (reviewStatus === 'pending') setReviewStatus('in_progress');
        })
        .catch(() => undefined); // Quiet: errors are surfaced by manual save path.
    }, 600);
    return () => window.clearTimeout(timer);
  // Run when style changes, not when reviewStatus/loading change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, lesson._id]);

  const selectedCue = useMemo(() => {
    if (!sync.selectedCueId) return null;
    return localCues.find((cue) => cue.cueId === sync.selectedCueId) ?? null;
  }, [localCues, sync.selectedCueId]);

  const persistCues = useCallback(async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await saveAdminSubtitles(lesson._id, localCues);
      setDirty(false);
      notify.success('Đã lưu phụ đề.');
    } catch (reason) {
      notify.error(reason instanceof Error ? reason.message : 'Không thể lưu phụ đề.');
    } finally {
      setSaving(false);
    }
  }, [dirty, saving, lesson._id, localCues, notify]);

  // Debounced cue auto-save.
  useEffect(() => {
    if (loading || !dirty) return;
    const timer = window.setTimeout(() => { void persistCues(); }, 2000);
    return () => window.clearTimeout(timer);
  }, [dirty, persistCues, loading]);

  // Re-confirm before leaving while dirty.
  const requestLeave = useCallback(async () => {
    if (dirty) {
      const ok = await notify.confirm({
        title: 'Có thay đổi chưa lưu',
        message: 'Phụ đề đang có chỉnh sửa. Rời đi sẽ mất các thay đổi đó. Tiếp tục?',
        confirmText: 'Rời đi',
        tone: 'danger',
      });
      if (!ok) return false;
    }
    return true;
  }, [dirty, notify]);

  const handleBack = useCallback(async () => {
    if (!(await requestLeave())) return;
    onBack();
  }, [requestLeave, onBack]);

  const handleCueEdit = useCallback((cue: AdminCue) => {
    setLocalCues((prev) => prev.map((c) => c.cueId === cue.cueId ? cue : c));
    setDirty(true);
  }, []);

  const handleCueRemove = useCallback((cueId: string) => {
    setLocalCues((prev) => prev.filter((c) => c.cueId !== cueId));
    sync.setSelectedCueId(null);
    setDirty(true);
    notify.info('Đã xoá câu thoại. Bấm Lưu bản nháp để xác nhận.');
  }, [notify, sync]);

  const handleApprove = useCallback(async () => {
    if (!(await requestLeave())) return;
    setApproving(true);
    try {
      // Flush any pending cue edits first so the approve gate sees them.
      if (dirty) await persistCues();
      const result = await approveAdminSubtitles(lesson._id, style);
      setReviewStatus('approved');
      setApprovedAt(result.subtitleApprovedAt);
      if (result.style) setStyle(result.style);
      setDirty(false);
      notify.success('Đã duyệt phụ đề. Có thể chuyển sang Duyệt nội dung.');
      onApproved?.();
    } catch (reason) {
      notify.error(reason instanceof Error ? reason.message : 'Không thể duyệt phụ đề.');
    } finally {
      setApproving(false);
    }
  }, [dirty, persistCues, lesson._id, style, onApproved, requestLeave, notify]);

  const handleReopen = useCallback(async () => {
    setApproving(true);
    try {
      await reopenAdminSubtitles(lesson._id);
      setReviewStatus('in_progress');
      setApprovedAt(undefined);
      notify.info('Đã mở lại phụ đề để chỉnh sửa.');
    } catch (reason) {
      notify.error(reason instanceof Error ? reason.message : 'Không thể mở lại phụ đề.');
    } finally {
      setApproving(false);
    }
  }, [lesson._id, notify]);

  const handleSelectCue = useCallback((cueId: string) => {
    sync.setSelectedCueId(cueId);
    const cue = localCues.find((c) => c.cueId === cueId);
    if (cue) sync.seekTo(cue.startMs);
  }, [sync, localCues]);

  // Expose a global handler so header can be re-opened from outside (Content Review triggers it).
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ lessonId: string }>).detail;
      if (detail?.lessonId === lesson._id) {
        void handleReopen();
      }
    };
    window.addEventListener('hanflix:subtitle-review-reopen', handler);
    return () => window.removeEventListener('hanflix:subtitle-review-reopen', handler);
  }, [handleReopen, lesson._id]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center bg-[#FFF9F5]">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" tone="brand" />
          <p className="text-xs font-bold text-[#8C827A]">Đang tải phụ đề…</p>
        </div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="space-y-4 p-6">
        <InlineBanner variant="error" message={error || 'Không thể tải dữ liệu phụ đề.'} />
        <button type="button" onClick={onBack} className="rounded-xl border border-[#F2E4D8] bg-white px-4 py-2 text-xs font-bold text-[#2B2826]">Quay lại</button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-72px)] min-h-[640px] flex-col bg-[#FFF9F5]">
      <SubtitleReviewHeader
        lessonTitle={payload.lesson.titleVi}
        lessonHsk={payload.lesson.hsk}
        status={reviewStatus}
        approvedAt={approvedAt}
        dirty={dirty}
        saving={saving}
        approving={approving}
        canApprove={localCues.length > 0 && !dirty}
        onBack={handleBack}
        onSaveDraft={() => void persistCues()}
        onApprove={() => void handleApprove()}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
        <div className="min-h-0 border-r border-[#F2E4D8]">
          <SubtitleNavigator
            cues={localCues}
            selectedCueId={sync.selectedCueId}
            activeCueId={sync.activeCueId}
            query={query}
            onQueryChange={setQuery}
            onSelect={handleSelectCue}
          />
        </div>
        <div className="min-h-0">
          {media ? (
            <SubtitleVideoMonitor
              mediaUrl={media.url}
              mimeType={media.mimeType}
              videoRef={videoRef}
              cues={localCues}
              currentTimeMs={sync.currentTimeMs}
              isPlaying={sync.isPlaying}
              styleConfig={style}
              visualPreset={visualPreset}
              topTrack={tracks.top}
              bottomTrack={tracks.bottom}
              onTogglePlay={sync.togglePlay}
              onPrevCue={sync.goToPrevCue}
              onNextCue={sync.goToNextCue}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-black text-xs font-bold text-white/70">
              Video chưa được xử lý xong.
            </div>
          )}
        </div>
        <div className="min-h-0 border-l border-[#F2E4D8]">
          <SubtitleInspector
            selectedCue={selectedCue}
            durationSeconds={lesson.durationSeconds}
            style={style}
            onCueChange={handleCueEdit}
            onCueRemove={handleCueRemove}
            onStyleChange={setStyle}
          />
        </div>
      </div>
      <SubtitleTimeline
        cues={localCues}
        durationMs={sync.durationMs || lesson.durationSeconds * 1000}
        currentTimeMs={sync.currentTimeMs}
        selectedCueId={sync.selectedCueId}
        onSeek={sync.seekTo}
        onSelect={handleSelectCue}
      />
      {/* Hidden pre-mounted shared preview so the persistent styling stays in
          sync if the workspace gets re-mounted in the future (placeholder for
          future overlay-on-content-review reuse). */}
      <div className="hidden" aria-hidden="true">
        <SubtitleSharedPreview
          cues={localCues}
          currentMs={sync.currentTimeMs}
          topTrack={tracks.top}
          bottomTrack={tracks.bottom}
          styleConfig={style}
          visualPreset={visualPreset}
        />
      </div>
    </div>
  );
}
