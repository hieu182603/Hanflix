import { useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  cancelVideoUpload, confirmVideo, createAdminLesson, getAdminMedia, getAdminReview, getProcessingStatus,
  deleteAdminLesson, hideAdminLesson, listAllAdminLessons, listAdminUsers, listProcessingJobs, patchAdminLesson,
  presignVideo, publishAdminLesson, restoreAdminLesson, retryProcessing, saveAdminQuiz,
  saveAdminSubtitles, setAdminUserStatus, uploadVideoToR2,
  type AdminCue, type AdminLesson, type AdminQuestion, type AdminReview, type AdminUser, type LearningTip,
  type ProcessingJob, type ProcessingStatus, type UploadProgressEvent,
} from '../../api/admin';
import AdminQuizManager from './AdminQuizManager';
import AdminOverviewDashboard from './AdminOverviewDashboard';
import AdminVideoList from './AdminVideoList';
import AdminUserManager from './AdminUserManager';
import AdminVideoUploader, { formatDurationMmSs } from './AdminVideoUploader';
import AdminLessonReviewStudio from './AdminLessonReviewStudio';
import AdminBillingManager from './AdminBillingManager';
import { useNotification } from '../notifications';
import { InlineBanner } from '../notifications';
import { Spinner } from '../notifications';
import { ApiRequestError } from '../../api/client';

type AdminTab = 'overview' | 'videos' | 'upload' | 'processing' | 'editor' | 'users' | 'quiz' | 'vocabulary' | 'grammar' | 'billing';

function errorText(error: unknown): string { return error instanceof Error ? error.message : 'Thao tác thất bại.'; }

/**
 * F01 fix (2026-09-18): dirty-state tracking for editor sections.
 *
 * Background: previously every save action called reload() which re-fetched `lessons`,
 * which triggered the editor effect (deps include `lessons`), which re-loaded cues/
 * questions/title from the server and overwrote in-progress edits. A user editing
 * subtitles who then clicked "Save metadata" would silently lose their subtitle edits.
 *
 * Fix:
 *   - Each section (metadata / subtitles / quiz) tracks a dirty flag.
 *   - Server data is only loaded when (a) the editingId changes, or (b) the user
 *     explicitly clicks "Tải lại". This prevents accidental overwrites.
 *   - Before navigating away or switching lessons, we warn the user if there are
 *     unsaved changes.
 *   - The dirty flags are reset individually after each successful save of that
 *     section, so an unrelated save does not affect other dirty states.
 */
type DirtyMap = { metadata: boolean; subtitles: boolean; quiz: boolean };

export default function ConnectedAdmin({
  tab,
  setTab,
  editingId,
  processingId,
  setEditingId,
  onSelectProcessingLesson,
}: {
  tab: AdminTab;
  setTab: (tab: AdminTab) => void;
  editingId: string | null;
  processingId?: string | null;
  setEditingId: (id: string | null) => void;
  onSelectProcessingLesson?: (id: string | null) => void;
}) {
  const notify = useNotification();
  const [lessons, setLessons] = useState<AdminLesson[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [processing, setProcessing] = useState<ProcessingStatus | null>(null);
  const [lastUploadedLesson, setLastUploadedLesson] = useState<AdminLesson | null>(null);
  const [review, setReview] = useState<AdminReview | null>(null);
  const [media, setMedia] = useState<{ url: string; mimeType: string; sizeBytes: number } | null>(null);
  const [cues, setCues] = useState<AdminCue[]>([]);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [translationImproved, setTranslationImproved] = useState(false);
  const [learningTips, setLearningTips] = useState<LearningTip[]>([]);
  const [drillWords, setDrillWords] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [titleVi, setTitleVi] = useState('');
  const [titleZh, setTitleZh] = useState('');
  const [descriptionVi, setDescriptionVi] = useState('');
  const [hsk, setHsk] = useState(3);
  const [autoGenerateQuizCount, setAutoGenerateQuizCount] = useState<number | ''>('');
  const [characters, setCharacters] = useState<NonNullable<AdminLesson['characters']>>([]);
  const [lyricsRaw, setLyricsRaw] = useState('');
  const [contentMode, setContentMode] = useState<'lesson' | 'song' | 'podcast' | 'drama'>('lesson');
  const [topic, setTopic] = useState('daily-life');
  const [duration, setDuration] = useState(120);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // F01: per-section dirty tracking. Saved status only resets the affected section.
  const [dirty, setDirty] = useState<DirtyMap>({ metadata: false, subtitles: false, quiz: false });
  const initialLoadDone = useRef<string | null>(null);

  // F08 fix (2026-09-18): upload progress + abort state.
  //   - uploadProgress: { percent, bytesSent, totalBytes } reported by the streaming
  //     uploadVideoToR2(). 0..100; -1 means "idle".
  //   - uploadController: AbortController wired to the in-flight PUT to R2. The user
  //     can press "Hủy tải lên" while the upload is in flight and we abort the request
  //     BEFORE calling /upload/cancel (so we don't pay for orphaned bytes).
  const [uploadProgress, setUploadProgress] = useState<{ percent: number; bytesSent: number; totalBytes: number }>({ percent: 0, bytesSent: 0, totalBytes: 0 });
  const [uploadStage, setUploadStage] = useState<'idle' | 'presigning' | 'uploading' | 'confirming'>('idle');
  const uploadControllerRef = useRef<AbortController | null>(null);
  const [uploadError, setUploadError] = useState<string>('');
  // Throttle progress UI updates: emit at most every 200ms to avoid 60fps re-renders.
  const lastProgressEmitRef = useRef<number>(0);

  // F10 fix (2026-09-18): cue editor viewport state for virtualized rendering.
  //   - cueQuery: filter cues by zh/vi/pinyin text.
  //   - cueExpanded: cueIds that are expanded. Collapsed by default for >20 cues.
  //   - cueSort: by start time (default) or by duration.
  const [cueQuery, setCueQuery] = useState('');
  const [cueExpanded, setCueExpanded] = useState<Set<string>>(new Set());
  // Snapshot timer for non-blocking "X giây trước" display
  const [tickNow, setTickNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setTickNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const reload = async () => {
    const [lessonItems, userItems, jobItems] = await Promise.all([listAllAdminLessons(), listAdminUsers(), listProcessingJobs()]);
    setLessons(lessonItems.items); setUsers(userItems); setJobs(jobItems.items);
  };

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void Promise.all([listAllAdminLessons(), listAdminUsers(), listProcessingJobs()]).then(([lessonItems, userItems, jobItems]) => {
      if (active) { setLessons(lessonItems.items); setUsers(userItems); setJobs(jobItems.items); }
    }).catch(reason => { if (active) setError(errorText(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  /**
   * F01: editor effect — only refetch when (a) we switch to editor tab AND
   * (b) the editingId has changed since last successful load. The `lessons` array
   * no longer triggers a refetch. Each `action()` that previously called reload()
   * no longer overwrites in-progress edits.
   */
  useEffect(() => {
    if (tab !== 'editor' || !editingId) return;
    // Skip if we already loaded this lesson and the user hasn't requested a refresh
    if (initialLoadDone.current === editingId) return;
    let active = true;
    setReview(null); setMedia(null); setError('');
    // Reset dirty when switching lessons
    setDirty({ metadata: false, subtitles: false, quiz: false });
    setTranslationImproved(false);
    setLearningTips([]);
    setDrillWords([]);
    void getAdminReview(editingId).then(data => {
      if (!active) return;
      setReview(data);
      const subtitle = data.subtitle;
      setCues(subtitle?.cues ?? []);
      setTranslationImproved(Boolean(subtitle?.translationImproved));
      setLearningTips(subtitle?.learningTips ?? []);
      setDrillWords(subtitle?.drillWords ?? []);
      setQuestions(data.quiz?.questions ?? []);
      const lesson = lessons.find(item => item._id === editingId);
      if (lesson) {
        setTitleVi(lesson.titleVi);
        setTitleZh(lesson.titleZh ?? '');
        setDescriptionVi(lesson.descriptionVi);
        setHsk(lesson.hsk);
        setCharacters(lesson.characters ?? []);
        setAutoGenerateQuizCount(lesson.autoGenerateQuizCount ?? '');
      }
      initialLoadDone.current = editingId;
    }).catch(reason => { if (active) setError(errorText(reason)); });

    void getAdminMedia(editingId).then(data => {
      if (active) setMedia(data.media);
    }).catch(() => {
      if (active) setMedia(null);
    });

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, editingId]);

  // Background quiz generation may finish after the editor loaded its draft.
  // Refresh only the quiz and never replace the administrator's unsaved edits.
  useEffect(() => {
    if (tab !== 'editor' || !editingId || dirty.quiz) return;
    let active = true;
    let loading = false;
    const timer = window.setInterval(async () => {
      if (loading) return;
      loading = true;
      try {
        const latest = await getAdminReview(editingId);
        if (active) {
          setQuestions(latest.quiz?.questions ?? []);
          setReview(previous => previous ? { ...previous, quiz: latest.quiz } : previous);
        }
      } catch { /* Keep the current draft on transient polling failures. */ }
      finally { loading = false; }
    }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [tab, editingId, dirty.quiz]);

  /**
   * F01: explicit "Tải lại" button allows the user to discard local edits and
   * pull fresh data from the server.
   */
  const reloadEditor = async () => {
    if (!editingId) return;
    if (dirty.metadata || dirty.subtitles || dirty.quiz) {
      const confirmed = await notify.confirm({
        title: 'Có thay đổi chưa lưu',
        message: 'Tải lại sẽ mất các thay đổi đó. Tiếp tục?',
        confirmText: 'Tải lại',
        tone: 'danger',
      });
      if (!confirmed) return;
    }
    initialLoadDone.current = null;
    setError('');
    try {
      const [reviewData, mediaData] = await Promise.all([getAdminReview(editingId), getAdminMedia(editingId)]);
      setReview(reviewData);
      const subtitle = reviewData.subtitle;
      setCues(subtitle?.cues ?? []);
      setTranslationImproved(Boolean(subtitle?.translationImproved));
      setLearningTips(subtitle?.learningTips ?? []);
      setDrillWords(subtitle?.drillWords ?? []);
      setQuestions(reviewData.quiz?.questions ?? []);
      setMedia(mediaData.media);
      const lesson = lessons.find(item => item._id === editingId);
      if (lesson) {
        setTitleVi(lesson.titleVi);
        setTitleZh(lesson.titleZh ?? '');
        setDescriptionVi(lesson.descriptionVi);
        setHsk(lesson.hsk);
        setCharacters(lesson.characters ?? []);
        setAutoGenerateQuizCount(lesson.autoGenerateQuizCount ?? '');
      }
      setDirty({ metadata: false, subtitles: false, quiz: false });
      initialLoadDone.current = editingId;
      setMessage('Đã tải lại nội dung.');
      notify.success('Đã tải lại nội dung bài học.');
    } catch (reason) {
      const err = errorText(reason);
      setError(err);
      notify.error(err);
    }
  };

  /**
   * F01: navigate-with-warning. Before switching lessons while edits exist, prompt
   * the user to confirm.
   */
  const requestSwitchLesson = async (newId: string | null) => {
    if (!newId || newId === editingId) {
      setEditingId(newId);
      return;
    }
    if (dirty.metadata || dirty.subtitles || dirty.quiz) {
      const confirmed = await notify.confirm({
        title: 'Có thay đổi chưa lưu',
        message: 'Rời đi sẽ mất các thay đổi đó. Tiếp tục?',
        confirmText: 'Rời đi',
        tone: 'danger',
      });
      if (!confirmed) return;
    }
    initialLoadDone.current = null;
    setEditingId(newId);
  };

  const activeProcessingLessonId =
    processingId ||
    editingId ||
    lastUploadedLesson?._id ||
    (jobs.length > 0 ? jobs[0].lessonId : null);

  useEffect(() => {
    if (tab !== 'processing' || !activeProcessingLessonId) return;
    let active = true;
    // Never carry the previous lesson's stage/progress into a newly selected
    // lesson while the first poll is in flight.
    setProcessing(null);
    const poll = async () => {
      try {
        const [status, lessonItems, jobItems] = await Promise.all([
          getProcessingStatus(activeProcessingLessonId),
          listAllAdminLessons(),
          listProcessingJobs(),
        ]);
        if (active) {
          setProcessing(status);
          setLessons(lessonItems.items);
          setJobs(jobItems.items);
        }
      } catch (reason) {
        // Polling is background synchronization. A transient failure must not
        // replace the upload/progress UI with a false action error; keep the
        // last known snapshot and let the next poll repair it.
        const isMissingJob = reason instanceof ApiRequestError
          && reason.code === 'PROCESSING_JOB_NOT_FOUND';
        if (active && !isMissingJob && !(reason instanceof Error && /Không tìm thấy tiến trình xử lý/i.test(reason.message))) {
          // Network/provider hiccups during polling are non-blocking. Explicit
          // lesson errors are still surfaced by the lesson/job snapshot.
          if (reason instanceof ApiRequestError && reason.code === 'LESSON_NOT_FOUND') setError(errorText(reason));
        }
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [tab, activeProcessingLessonId]);

  /**
   * F01: action() no longer calls reload() globally. It only refreshes the lessons
   * list (so the user sees status changes in the sidebar) but does NOT touch the
   * editor state. The user must click "Tải lại" to pull fresh editor data.
   */
  const action = async (task: () => Promise<unknown>, success: string, options?: { refreshEditor?: boolean }) => {
    // Clear stale message khi bắt đầu action mới → tránh hiện message cũ khi action mới fail.
    setBusy(true); setError(''); setMessage('');
    try {
      await task();
      // Refresh lessons list (sidebar) but keep editor state intact.
      const [lessonItems, jobItems] = await Promise.all([listAllAdminLessons(), listProcessingJobs()]);
      setLessons(lessonItems.items); setJobs(jobItems.items);
      if (options?.refreshEditor && editingId) {
        initialLoadDone.current = null;
        // Trigger editor effect to refetch on next render.
        setEditingId(editingId);
      }
      setMessage(success);
      notify.success(success);
    }
    catch (reason) {
      const err = errorText(reason);
      setError(err);
      notify.error(err);
    }
    finally { setBusy(false); }
  };

  const submitUpload = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!file) {
      const msg = 'Hãy chọn video MP4 hoặc WebM.';
      setError(msg);
      notify.warning(msg);
      return;
    }
    if (!['video/mp4', 'video/webm', ...(['song', 'podcast'].includes(contentMode) ? ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav'] : [])].includes(file.type)) {
      const msg = 'Định dạng tệp không phù hợp với loại nội dung đã chọn.';
      setError(msg);
      notify.error(msg);
      return;
    }
    if (duration < 60) {
      const msg = `Thời lượng video quá ngắn (${formatDurationMmSs(duration)}). Video phải có độ dài từ 1 phút đến 10 phút (1:00 – 10:00).`;
      setError(msg);
      setUploadError(msg);
      notify.warning(msg);
      return;
    }
    if (contentMode !== 'podcast' && duration > 600) {
      const msg = `Thời lượng video quá dài (${formatDurationMmSs(duration)}). Video phải có độ dài tối đa 10 phút (10:00).`;
      setError(msg);
      setUploadError(msg);
      notify.warning(msg);
      return;
    }
    setBusy(true); setError(''); setMessage(''); setUploadError('');
    let lessonId: string | null = null;
    let uploadStarted = false;
    uploadControllerRef.current = new AbortController();
    try {
      const slug = titleVi.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'bai-hoc';
      setUploadStage('presigning');
      const draft = await createAdminLesson({
        slug: `${slug}-${crypto.randomUUID().slice(0, 8)}`,
        titleVi,
        titleZh,
        descriptionVi,
        hsk,
        topicIds: [topic],
        goalTags: [],
        durationSeconds: duration,
        pinyin: '',
        autoGenerateQuizCount: typeof autoGenerateQuizCount === 'number' ? autoGenerateQuizCount : undefined,
        contentMode,
        mediaType: 'AUTO',
        ...(contentMode === 'song' && lyricsRaw.trim() ? { lyricsRaw, lyricsSource: 'lrc' as const } : {}),
      });
      lessonId = draft._id;

      // Immediately switch to the processing tab & select the new draft!
      const initialDraft: AdminLesson = {
        ...draft,
        status: 'uploading',
        processingStatus: 'UPLOADED',
        processingStep: 'UPLOADING',
        processingProgress: 0,
      };
      setLastUploadedLesson(initialDraft);
      setLessons(prev => [initialDraft, ...prev.filter(l => l._id !== draft._id)]);
      if (onSelectProcessingLesson) {
        onSelectProcessingLesson(draft._id);
      } else {
        setEditingId(draft._id);
        setTab('processing');
      }

      // Reset the upload input fields so the upload tab is clean
      setFile(null);
      initialLoadDone.current = null;

      const signed = await presignVideo(draft._id, file);
      uploadStarted = true;
      const totalBytes = signed.clientByteSize ?? file.size;
      setUploadProgress({ percent: 0, bytesSent: 0, totalBytes });
      setUploadStage('uploading');

      // Stream upload to R2
      await uploadVideoToR2(signed.uploadUrl, file, signed.requiredHeaders['Content-Type'], {
        signal: uploadControllerRef.current?.signal,
        onProgress: (event: UploadProgressEvent) => {
          const now = Date.now();
          if (now - lastProgressEmitRef.current < 200 && event.percent < 100) return;
          lastProgressEmitRef.current = now;
          setUploadProgress({ percent: event.percent, bytesSent: event.bytesSent, totalBytes: event.totalBytes });
        },
      });

      if (uploadControllerRef.current?.signal.aborted) {
        throw new Error('Đã hủy tải lên.');
      }

      setUploadStage('confirming');
      await confirmVideo(draft._id, signed.objectKey);
      setUploadStage('idle');
      const okMsg = 'Video đã tải lên Cloudflare R2 thành công. Đang tiến hành bóc tách âm thanh & AI.';
      setMessage(okMsg);
      notify.success(okMsg);
      void reload();
    } catch (reason) {
      if (lessonId && uploadStarted) {
        try { await cancelVideoUpload(lessonId); } catch { /* Leave the draft visible for manual recovery. */ }
      }
      setUploadStage('idle');
      const msg = errorText(reason);
      setUploadError(msg);
      setError(msg);
      notify.error(msg);
      // Clear success message khi upload fail — tránh hiển thị 2 banner cùng lúc.
      setMessage('');
      void reload();
    } finally {
      setBusy(false);
      uploadControllerRef.current = null;
    }
  };

  /**
   * F08 fix (2026-09-18): abort the in-flight upload and free the R2 presigned
   * object. Cancelling before the request completes saves the user's bandwidth
   * and prevents orphaned objects accumulating in R2.
   */
  const cancelInFlightUpload = () => {
    if (uploadControllerRef.current) {
      uploadControllerRef.current.abort();
    }
  };

  const selected = lessons.find(item => item._id === editingId) || (lastUploadedLesson && lastUploadedLesson._id === editingId ? lastUploadedLesson : undefined);
  const statusLabel: Record<string, string> = { draft: 'Bản nháp', uploading: 'Đang tải lên', processing: 'Đang xử lý', ready_for_review: 'Chờ duyệt', published: 'Đã đăng', hidden: 'Đã ẩn', failed: 'Lỗi xử lý' };

  // CONTENT MODE (2026-09-22): Clear stale error/message khi đổi tab.
  // Trước đây banner lỗi của tab cũ vẫn hiển thị khi user chuyển sang tab mới →
  // admin tưởng là lỗi mới của action vừa thực hiện.
  useEffect(() => {
    setError('');
    setMessage('');
  }, [tab]);

  return <div className="space-y-5">
    {/* CONTENT MODE (2026-09-22) banner ưu tiên: error > message > loading.
        Trước đây 2 banner hiển thị cùng lúc khi error và message đều có → admin
        không biết thao tác nào thực sự thành công. Bây giờ chỉ hiện 1 banner. */}
    {tab !== 'overview' && error ? (
      <InlineBanner variant="error" message={error} />
    ) : message ? (
      <InlineBanner variant="success" message={message} />
    ) : null}
    {tab !== 'overview' && loading && (
      <div className="flex items-center gap-2.5 rounded-2xl border border-[#F2E4D8] bg-white p-3.5 text-xs font-bold text-[#8C827A] shadow-2xs">
        <Spinner size="sm" tone="brand" />
        <span>Đang tải dữ liệu quản trị…</span>
      </div>
    )}
    {tab === 'overview' && (
      <AdminOverviewDashboard
        lessons={lessons}
        users={users}
        jobs={jobs}
        loading={loading}
        error={error}
        onReload={reload}
        onNavigateToTab={(targetTab) => {
          if (targetTab === 'upload') setTab('upload');
          else if (targetTab === 'users') setTab('users');
          else if (targetTab === 'videos') setTab('videos');
          else setTab(targetTab as AdminTab);
        }}
        onSelectLessonToEdit={(lessonId) => {
          void requestSwitchLesson(lessonId);
        }}
        onPublishLesson={async (lessonId) => {
          await action(() => publishAdminLesson(lessonId), 'Đã xuất bản bài học.');
        }}
        onRetryProcessing={async (lessonId) => {
          await action(() => retryProcessing(lessonId), 'Đã yêu cầu xử lý lại tiến trình AI.');
        }}
      />
    )}
    {tab === 'videos' && (
      <AdminVideoList
        lessons={lessons}
        loading={loading}
        busy={busy}
        onNavigateToUpload={() => setTab('upload')}
        onEditLesson={(id) => {
          void requestSwitchLesson(id);
        }}
        onViewProcessing={(id) => {
          if (onSelectProcessingLesson) {
            onSelectProcessingLesson(id);
          } else {
            requestSwitchLesson(id);
            setTab('processing');
          }
        }}
        onPublishLesson={async (id) => {
          await action(() => publishAdminLesson(id), 'Đã xuất bản bài học.');
        }}
        onHideLesson={async (id) => {
          await action(() => hideAdminLesson(id), 'Đã ẩn bài học.');
        }}
        onRestoreLesson={async (id) => {
          await action(() => restoreAdminLesson(id), 'Đã khôi phục bài học.');
        }}
        onDeleteLesson={async (id) => {
          await action(async () => {
            await deleteAdminLesson(id);
            if (editingId === id) {
              setEditingId(null);
            }
          }, 'Đã xóa bài học vĩnh viễn.');
        }}
        onRetryProcessing={async (id, repairedLyrics?: string, repairedMode?: AdminLesson['contentMode']) => {
          await action(async () => {
            if (repairedMode || repairedLyrics?.trim()) await patchAdminLesson(id, {
              ...(repairedMode ? { contentMode: repairedMode } : {}),
              ...(repairedLyrics?.trim() ? { lyricsRaw: repairedLyrics, lyricsSource: 'lrc' } : {}),
            });
            await retryProcessing(id);
          }, 'Đã yêu cầu xử lý lại tiến trình AI.');
        }}
      />
    )}
    {(tab === 'upload' || tab === 'processing') && (
      <AdminVideoUploader
        activeTab={tab}
        onTabChange={(t) => {
          if (t === 'upload') setTab('upload');
          else if (t === 'processing') {
            const targetId = activeProcessingLessonId;
            if (onSelectProcessingLesson) onSelectProcessingLesson(targetId);
            else setTab('processing');
          } else if (t === 'editor') {
            if (activeProcessingLessonId) {
              void requestSwitchLesson(activeProcessingLessonId);
            } else {
              setTab('editor');
            }
          } else {
            setTab(t as AdminTab);
          }
        }}
        titleVi={titleVi}
        setTitleVi={(v) => { setTitleVi(v); setDirty(d => ({ ...d, metadata: true })); }}
        titleZh={titleZh}
        setTitleZh={(v) => { setTitleZh(v); setDirty(d => ({ ...d, metadata: true })); }}
        descriptionVi={descriptionVi}
        setDescriptionVi={(v) => { setDescriptionVi(v); setDirty(d => ({ ...d, metadata: true })); }}
        hsk={hsk}
        setHsk={setHsk}
        autoGenerateQuizCount={autoGenerateQuizCount}
        setAutoGenerateQuizCount={(v) => { setAutoGenerateQuizCount(v); setDirty(d => ({ ...d, metadata: true })); }}
        lyricsRaw={lyricsRaw}
        setLyricsRaw={setLyricsRaw}
        contentMode={contentMode}
        setContentMode={(v) => { setContentMode(v); setDirty(d => ({ ...d, metadata: true })); }}
        topic={topic}
        setTopic={setTopic}
        duration={duration}
        setDuration={setDuration}
        file={file}
        setFile={setFile}
        busy={busy}
        uploadStage={uploadStage}
        uploadProgress={uploadProgress}
        uploadError={uploadError}
        onSubmitUpload={submitUpload}
        onCancelUpload={cancelInFlightUpload}
        selectedLesson={(() => {
          const found = lessons.find(item => item._id === activeProcessingLessonId);
          if (found) return found;
          if (lastUploadedLesson && lastUploadedLesson._id === activeProcessingLessonId) return lastUploadedLesson;
          if (selected && selected._id === activeProcessingLessonId) return selected;
          const fallbackJob = jobs.find(j => j.lessonId === activeProcessingLessonId);
          if (activeProcessingLessonId && fallbackJob) {
            return {
              _id: activeProcessingLessonId,
              slug: activeProcessingLessonId,
              titleVi: `Bài học #${activeProcessingLessonId.slice(-6)}`,
              titleZh: '',
              descriptionVi: '',
              hsk: 3,
              topicIds: [],
              goalTags: [],
              durationSeconds: 0,
              status: (fallbackJob.status === 'completed' ? 'ready_for_review' : fallbackJob.status === 'failed' ? 'failed' : 'processing') as AdminLesson['status'],
              processingProgress: processing?.stageProgress ?? fallbackJob.stageProgress ?? 0,
              processingStatus: processing?.status ?? fallbackJob.status ?? 'queued',
              processingStep: processing?.stage ?? fallbackJob.stage ?? 'inspect_media',
              processingError: (fallbackJob.status === 'failed' || processing?.status === 'failed')
                ? (processing?.errorMessage ?? fallbackJob.errorMessage)
                : undefined,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as AdminLesson;
          }
          return undefined;
        })()}
        processingStatus={processing}
        jobs={jobs}
        lessons={lessons}
        onSelectLesson={(id) => {
          if (onSelectProcessingLesson) {
            onSelectProcessingLesson(id);
          } else {
            requestSwitchLesson(id);
            setTab('processing');
          }
        }}
        onEditLesson={(id) => {
          void requestSwitchLesson(id);
        }}
        onRetryProcessing={async (id, repairedLyrics?: string, repairedMode?: AdminLesson['contentMode']) => {
          await action(async () => {
            if (repairedMode || repairedLyrics?.trim()) await patchAdminLesson(id, {
              ...(repairedMode ? { contentMode: repairedMode } : {}),
              ...(repairedLyrics?.trim() ? { lyricsRaw: repairedLyrics, lyricsSource: 'lrc' } : {}),
            });
            await retryProcessing(id);
          }, 'Đã yêu cầu xử lý lại tiến trình AI.');
        }}
        onCancelVideoUpload={async (id) => {
          await action(() => cancelVideoUpload(id), 'Đã hủy phiên tải lên.');
        }}
      />
    )}
    {tab === 'editor' && (
      selected ? (
        <AdminLessonReviewStudio
          lesson={selected}
          media={media}
          review={review}
          cues={cues}
          questions={questions}
          translationImproved={translationImproved}
          learningTips={learningTips}
          drillWords={drillWords}
          dirty={dirty}
          busy={busy}
          titleVi={titleVi}
          setTitleVi={(v) => { setTitleVi(v); setDirty(d => ({ ...d, metadata: true })); }}
          titleZh={titleZh}
          setTitleZh={(v) => { setTitleZh(v); setDirty(d => ({ ...d, metadata: true })); }}
          descriptionVi={descriptionVi}
          setDescriptionVi={(v) => { setDescriptionVi(v); setDirty(d => ({ ...d, metadata: true })); }}
          characters={characters}
          onCharactersChange={value => { setCharacters(value); setDirty(d => ({ ...d, metadata: true })); }}
          onCuesChange={(next) => { setCues(next); setDirty(d => ({ ...d, subtitles: true })); }}
          onQuestionsChange={(next) => { setQuestions(next); setDirty(d => ({ ...d, quiz: true })); }}
          onSaveMetadata={async () => {
            await action(async () => {
              await patchAdminLesson(selected._id, {
                titleVi,
                titleZh,
                descriptionVi,
                ...(selected.contentMode === 'drama' ? { characters } : {}),
                autoGenerateQuizCount: typeof autoGenerateQuizCount === 'number'
                  ? autoGenerateQuizCount
                  : null,
              });
              setDirty(d => ({ ...d, metadata: false }));
            }, 'Đã lưu thông tin bài học.');
          }}
          onSaveSubtitles={async () => {
            await action(async () => {
              await saveAdminSubtitles(selected._id, cues);
              setDirty(d => ({ ...d, subtitles: false }));
            }, 'Đã lưu phụ đề song ngữ.');
          }}
          onSaveQuiz={async () => {
            await action(async () => {
              if (questions.length || (selected.contentMode ?? 'lesson') === 'lesson') await saveAdminQuiz(selected._id, questions);
              setDirty(d => ({ ...d, quiz: false }));
            }, 'Đã lưu bộ câu hỏi.');
          }}
          onPublishAll={async () => {
            await action(async () => {
              await patchAdminLesson(selected._id, { titleVi, titleZh, descriptionVi, ...(selected.contentMode === 'drama' ? { characters } : {}) });
              await saveAdminSubtitles(selected._id, cues);
              if (questions.length || (selected.contentMode ?? 'lesson') === 'lesson') await saveAdminQuiz(selected._id, questions);
              await publishAdminLesson(selected._id);
              setDirty({ metadata: false, subtitles: false, quiz: false });
              initialLoadDone.current = null;
              setEditingId(null);
            }, 'Đã xuất bản bài học thành công!');
          }}
          onReload={reloadEditor}
          onBackToVideos={() => setEditingId(null)}
        />
      ) : (
        <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-[#F2E4D8]">
          <Spinner size="md" tone="brand" />
          <span className="ml-3 text-sm font-semibold text-[#8B9097]">Đang tải dữ liệu bài học…</span>
        </div>
      )
    )}
    {tab === 'users' && <AdminUserManager />}
    {tab === 'quiz' && <AdminQuizManager />}
    {tab === 'billing' && <AdminBillingManager />}
  </div>;
}
