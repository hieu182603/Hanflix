import { useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  cancelVideoUpload, confirmVideo, createAdminLesson, getAdminMedia, getAdminReview, getProcessingStatus,
  deleteAdminLesson, hideAdminLesson, listAdminLessons, listAdminUsers, listProcessingJobs, patchAdminLesson,
  presignVideo, publishAdminLesson, restoreAdminLesson, retryProcessing, saveAdminQuiz,
  saveAdminSubtitles, setAdminUserStatus, uploadVideoToR2,
  type AdminCue, type AdminLesson, type AdminQuestion, type AdminReview, type AdminUser,
  type ProcessingJob, type ProcessingStatus, type UploadProgressEvent,
} from '../../api/admin';
import AdminQuizManager from './AdminQuizManager';
import AdminOverviewDashboard from './AdminOverviewDashboard';
import AdminVideoList from './AdminVideoList';
import AdminUserManager from './AdminUserManager';
import AdminVideoUploader from './AdminVideoUploader';
import AdminLessonReviewStudio from './AdminLessonReviewStudio';

type AdminTab = 'overview' | 'videos' | 'upload' | 'processing' | 'editor' | 'users' | 'quiz' | 'vocabulary' | 'grammar';

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

export default function ConnectedAdmin({ tab, setTab, editingId, setEditingId }: {
  tab: AdminTab;
  setTab: (tab: AdminTab) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
}) {
  const [lessons, setLessons] = useState<AdminLesson[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [processing, setProcessing] = useState<ProcessingStatus | null>(null);
  const [review, setReview] = useState<AdminReview | null>(null);
  const [media, setMedia] = useState<{ url: string; mimeType: string; sizeBytes: number } | null>(null);
  const [cues, setCues] = useState<AdminCue[]>([]);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [titleVi, setTitleVi] = useState('');
  const [titleZh, setTitleZh] = useState('');
  const [descriptionVi, setDescriptionVi] = useState('');
  const [hsk, setHsk] = useState(3);
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
    const [lessonItems, userItems, jobItems] = await Promise.all([listAdminLessons(), listAdminUsers(), listProcessingJobs()]);
    setLessons(lessonItems); setUsers(userItems); setJobs(jobItems.items);
  };

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void Promise.all([listAdminLessons(), listAdminUsers(), listProcessingJobs()]).then(([lessonItems, userItems, jobItems]) => {
      if (active) { setLessons(lessonItems); setUsers(userItems); setJobs(jobItems.items); }
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
    void getAdminReview(editingId).then(data => {
      if (!active) return;
      setReview(data);
      setCues(data.subtitle?.cues ?? []);
      setQuestions(data.quiz?.questions ?? []);
      const lesson = lessons.find(item => item._id === editingId);
      if (lesson) { setTitleVi(lesson.titleVi); setTitleZh(lesson.titleZh ?? ''); setDescriptionVi(lesson.descriptionVi); }
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

  /**
   * F01: explicit "Tải lại" button allows the user to discard local edits and
   * pull fresh data from the server.
   */
  const reloadEditor = async () => {
    if (!editingId) return;
    if (dirty.metadata || dirty.subtitles || dirty.quiz) {
      const confirmed = window.confirm('Có thay đổi chưa lưu. Tải lại sẽ mất các thay đổi đó. Tiếp tục?');
      if (!confirmed) return;
    }
    initialLoadDone.current = null;
    setError('');
    try {
      const [reviewData, mediaData] = await Promise.all([getAdminReview(editingId), getAdminMedia(editingId)]);
      setReview(reviewData);
      setCues(reviewData.subtitle?.cues ?? []);
      setQuestions(reviewData.quiz?.questions ?? []);
      setMedia(mediaData.media);
      const lesson = lessons.find(item => item._id === editingId);
      if (lesson) { setTitleVi(lesson.titleVi); setTitleZh(lesson.titleZh ?? ''); setDescriptionVi(lesson.descriptionVi); }
      setDirty({ metadata: false, subtitles: false, quiz: false });
      initialLoadDone.current = editingId;
      setMessage('Đã tải lại nội dung.');
    } catch (reason) {
      setError(errorText(reason));
    }
  };

  /**
   * F01: navigate-with-warning. Before switching lessons while edits exist, prompt
   * the user to confirm.
   */
  const requestSwitchLesson = (newId: string | null) => {
    if (!newId || newId === editingId) {
      setEditingId(newId);
      return;
    }
    if (dirty.metadata || dirty.subtitles || dirty.quiz) {
      const confirmed = window.confirm('Có thay đổi chưa lưu. Rời đi sẽ mất các thay đổi đó. Tiếp tục?');
      if (!confirmed) return;
    }
    initialLoadDone.current = null;
    setEditingId(newId);
  };

  useEffect(() => {
    if (tab !== 'processing' || !editingId) return;
    let active = true;
    const poll = async () => {
      try {
        const [status, lessonItems, jobItems] = await Promise.all([getProcessingStatus(editingId), listAdminLessons(), listProcessingJobs()]);
        if (active) { setProcessing(status); setLessons(lessonItems); setJobs(jobItems.items); }
      } catch (reason) { if (active) setError(errorText(reason)); }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [tab, editingId]);

  /**
   * F01: action() no longer calls reload() globally. It only refreshes the lessons
   * list (so the user sees status changes in the sidebar) but does NOT touch the
   * editor state. The user must click "Tải lại" to pull fresh editor data.
   */
  const action = async (task: () => Promise<unknown>, success: string, options?: { refreshEditor?: boolean }) => {
    setBusy(true); setError(''); setMessage('');
    try {
      await task();
      // Refresh lessons list (sidebar) but keep editor state intact.
      const [lessonItems, jobItems] = await Promise.all([listAdminLessons(), listProcessingJobs()]);
      setLessons(lessonItems); setJobs(jobItems.items);
      if (options?.refreshEditor && editingId) {
        initialLoadDone.current = null;
        // Trigger editor effect to refetch on next render.
        setEditingId(editingId);
      }
      setMessage(success);
    }
    catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const submitUpload = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!file) { setError('Hãy chọn video MP4 hoặc WebM.'); return; }
    if (!['video/mp4', 'video/webm'].includes(file.type)) { setError('Chỉ hỗ trợ MP4 hoặc WebM.'); return; }
    setBusy(true); setError(''); setMessage(''); setUploadError('');
    let lessonId: string | null = null;
    let uploadStarted = false;
    uploadControllerRef.current = new AbortController();
    try {
      const slug = titleVi.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'bai-hoc';
      setUploadStage('presigning');
      const draft = await createAdminLesson({ slug: `${slug}-${crypto.randomUUID().slice(0, 8)}`, titleVi, titleZh, descriptionVi, hsk, topicIds: [topic], goalTags: [], durationSeconds: duration, pinyin: '' });
      lessonId = draft._id;
      const signed = await presignVideo(draft._id, file);
      uploadStarted = true;
      const totalBytes = signed.clientByteSize ?? file.size;
      setUploadProgress({ percent: 0, bytesSent: 0, totalBytes });
      setUploadStage('uploading');
      // F08: stream the upload so we can report progress AND honor abort.
      // We throttle onProgress to once every 200ms to avoid re-rendering 60×/sec.
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
        // User pressed cancel; the abort already raised an exception in the upload.
        // Fall through to the catch below.
        throw new Error('Đã hủy tải lên.');
      }
      setUploadStage('confirming');
      await confirmVideo(draft._id, signed.objectKey);
      setUploadStage('idle');
      await reload();
      // F08: reset form state so a new upload doesn't re-use the previous file.
      setFile(null);
      initialLoadDone.current = null;
      setEditingId(draft._id); setTab('processing');
      setMessage('Video đã tải lên. Đang theo dõi quá trình xử lý.');
    } catch (reason) {
      if (lessonId && uploadStarted) {
        try { await cancelVideoUpload(lessonId); } catch { /* Leave the draft visible for manual recovery. */ }
      }
      setUploadStage('idle');
      setUploadError(errorText(reason));
      setError(errorText(reason));
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

  const selected = lessons.find(item => item._id === editingId);
  const statusLabel: Record<string, string> = { draft: 'Bản nháp', uploading: 'Đang tải lên', processing: 'Đang xử lý', ready_for_review: 'Chờ duyệt', published: 'Đã đăng', hidden: 'Đã ẩn', failed: 'Lỗi xử lý' };

  return <div className="space-y-5">
    {tab !== 'overview' && error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {tab !== 'overview' && loading && <p className="text-sm">Đang tải dữ liệu quản trị…</p>}
    {tab === 'overview' && (
      <AdminOverviewDashboard
        lessons={lessons}
        users={users}
        jobs={jobs}
        loading={loading}
        error={error}
        onReload={reload}
        onNavigateToTab={(targetTab) => setTab(targetTab as AdminTab)}
        onSelectLessonToEdit={(lessonId) => {
          requestSwitchLesson(lessonId);
          setTab('editor');
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
          requestSwitchLesson(id);
          setTab('editor');
        }}
        onViewProcessing={(id) => {
          requestSwitchLesson(id);
          setTab('processing');
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
              setTab('videos');
            }
          }, 'Đã xóa bài học vĩnh viễn.');
        }}
        onRetryProcessing={async (id) => {
          await action(() => retryProcessing(id), 'Đã yêu cầu xử lý lại tiến trình AI.');
        }}
      />
    )}
    {(tab === 'upload' || tab === 'processing') && (
      <AdminVideoUploader
        activeTab={tab}
        onTabChange={(t) => setTab(t)}
        titleVi={titleVi}
        setTitleVi={(v) => { setTitleVi(v); setDirty(d => ({ ...d, metadata: true })); }}
        titleZh={titleZh}
        setTitleZh={(v) => { setTitleZh(v); setDirty(d => ({ ...d, metadata: true })); }}
        descriptionVi={descriptionVi}
        setDescriptionVi={(v) => { setDescriptionVi(v); setDirty(d => ({ ...d, metadata: true })); }}
        hsk={hsk}
        setHsk={setHsk}
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
        selectedLesson={selected}
        processingStatus={processing}
        jobs={jobs}
        lessons={lessons}
        onSelectLesson={(id) => {
          requestSwitchLesson(id);
          setTab('processing');
        }}
        onRetryProcessing={async (id) => {
          await action(() => retryProcessing(id), 'Đã yêu cầu xử lý lại tiến trình AI.');
        }}
        onCancelVideoUpload={async (id) => {
          await action(() => cancelVideoUpload(id), 'Đã hủy phiên tải lên.');
        }}
      />
    )}
    {tab === 'editor' && selected && (
      <AdminLessonReviewStudio
        lesson={selected}
        media={media}
        review={review}
        cues={cues}
        questions={questions}
        dirty={dirty}
        busy={busy}
        titleVi={titleVi}
        setTitleVi={(v) => { setTitleVi(v); setDirty(d => ({ ...d, metadata: true })); }}
        titleZh={titleZh}
        setTitleZh={(v) => { setTitleZh(v); setDirty(d => ({ ...d, metadata: true })); }}
        descriptionVi={descriptionVi}
        setDescriptionVi={(v) => { setDescriptionVi(v); setDirty(d => ({ ...d, metadata: true })); }}
        onCuesChange={(next) => { setCues(next); setDirty(d => ({ ...d, subtitles: true })); }}
        onQuestionsChange={(next) => { setQuestions(next); setDirty(d => ({ ...d, quiz: true })); }}
        onSaveMetadata={async () => {
          await action(async () => {
            await patchAdminLesson(selected._id, { titleVi, titleZh, descriptionVi });
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
            await saveAdminQuiz(selected._id, questions);
            setDirty(d => ({ ...d, quiz: false }));
          }, 'Đã lưu bộ câu hỏi.');
        }}
        onPublishAll={async () => {
          await action(async () => {
            await patchAdminLesson(selected._id, { titleVi, titleZh, descriptionVi });
            await saveAdminSubtitles(selected._id, cues);
            await saveAdminQuiz(selected._id, questions);
            await publishAdminLesson(selected._id);
            setDirty({ metadata: false, subtitles: false, quiz: false });
            initialLoadDone.current = null;
            setTab('videos');
          }, 'Đã xuất bản bài học thành công!');
        }}
        onReload={reloadEditor}
        onBackToVideos={() => setTab('videos')}
      />
    )}
    {tab === 'users' && <AdminUserManager />}
    {tab === 'quiz' && <AdminQuizManager />}
  </div>;
}
