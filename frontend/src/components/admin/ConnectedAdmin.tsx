import { useEffect, useState } from 'react';
import {
  cancelVideoUpload, confirmVideo, createAdminLesson, getAdminReview, getProcessingStatus,
  hideAdminLesson, listAdminLessons, listAdminUsers, listProcessingJobs, patchAdminLesson,
  presignVideo, publishAdminLesson, restoreAdminLesson, retryProcessing, saveAdminQuiz,
  saveAdminSubtitles, setAdminUserStatus, uploadVideoToR2,
  type AdminCue, type AdminLesson, type AdminQuestion, type AdminReview, type AdminUser,
  type ProcessingJob, type ProcessingStatus,
} from '../../api/admin';

type AdminTab = 'overview' | 'videos' | 'upload' | 'processing' | 'editor' | 'users';

function errorText(error: unknown): string { return error instanceof Error ? error.message : 'Thao tác thất bại.'; }

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

  useEffect(() => {
    if (tab !== 'editor' || !editingId) return;
    let active = true;
    setReview(null); setError('');
    void getAdminReview(editingId).then(data => {
      if (!active) return;
      setReview(data); setCues(data.subtitle?.cues ?? []); setQuestions(data.quiz?.questions ?? []);
      const lesson = lessons.find(item => item._id === editingId);
      if (lesson) { setTitleVi(lesson.titleVi); setTitleZh(lesson.titleZh ?? ''); setDescriptionVi(lesson.descriptionVi); }
    }).catch(reason => { if (active) setError(errorText(reason)); });
    return () => { active = false; };
  }, [tab, editingId]);

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

  const action = async (task: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(''); setMessage('');
    try { await task(); await reload(); setMessage(success); }
    catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const submitUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) { setError('Hãy chọn video MP4 hoặc WebM.'); return; }
    if (!['video/mp4', 'video/webm'].includes(file.type)) { setError('Chỉ hỗ trợ MP4 hoặc WebM.'); return; }
    setBusy(true); setError(''); setMessage('');
    let lessonId: string | null = null;
    let uploadStarted = false;
    try {
      const slug = titleVi.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'bai-hoc';
      const draft = await createAdminLesson({ slug: `${slug}-${crypto.randomUUID().slice(0, 8)}`, titleVi, titleZh, descriptionVi, hsk, topicIds: [topic], goalTags: [], durationSeconds: duration, pinyin: '' });
      lessonId = draft._id;
      const signed = await presignVideo(draft._id, file);
      uploadStarted = true;
      await uploadVideoToR2(signed.uploadUrl, file, signed.requiredHeaders['Content-Type']);
      await confirmVideo(draft._id, signed.objectKey);
      await reload();
      setEditingId(draft._id); setTab('processing');
      setMessage('Video đã tải lên. Đang theo dõi quá trình xử lý.');
    } catch (reason) {
      if (lessonId && uploadStarted) {
        try { await cancelVideoUpload(lessonId); } catch { /* Leave the draft visible for manual recovery. */ }
      }
      setError(errorText(reason));
      void reload();
    } finally { setBusy(false); }
  };

  const selected = lessons.find(item => item._id === editingId);
  const statusLabel: Record<string, string> = { draft: 'Bản nháp', uploading: 'Đang tải lên', processing: 'Đang xử lý', ready_for_review: 'Chờ duyệt', published: 'Đã đăng', hidden: 'Đã ẩn', failed: 'Lỗi xử lý' };

  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {loading && <p className="text-sm">Đang tải dữ liệu quản trị…</p>}
    {tab === 'overview' && <>
      <h1 className="text-2xl font-black">Tổng quan quản trị</h1>
      <div className="grid gap-3 sm:grid-cols-3">{[
        ['Bài học', lessons.length], ['Đã xuất bản', lessons.filter(item => item.status === 'published').length], ['Chờ duyệt', lessons.filter(item => item.status === 'ready_for_review').length],
      ].map(([label, value]) => <div key={label} className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">{label}</p><p className="text-2xl font-black">{value}</p></div>)}</div>
      <button type="button" onClick={() => setTab('upload')} className="rounded-xl bg-[#B91B1C] px-4 py-2 text-sm font-bold text-white">Thêm video mới</button>
    </>}
    {tab === 'videos' && <>
      <div className="flex justify-between gap-2"><h1 className="text-2xl font-black">Bài học video</h1><button type="button" onClick={() => setTab('upload')} className="rounded-xl bg-[#B91B1C] px-4 py-2 text-sm font-bold text-white">Thêm video</button></div>
      {lessons.length === 0 && !loading && <p className="rounded-xl bg-white p-5 text-sm">Chưa có bài học.</p>}
      <div className="space-y-2">{lessons.map(item => <div key={item._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"><div><h2 className="font-bold">{item.titleVi}</h2><p className="text-xs text-neutral-500">HSK {item.hsk} · {statusLabel[item.status] ?? item.status}</p></div><div className="flex flex-wrap gap-2">
        {['ready_for_review', 'draft'].includes(item.status) && <button type="button" onClick={() => { setEditingId(item._id); setTab('editor'); }} className="rounded-lg border px-3 py-1 text-sm">Biên tập</button>}
        {['processing', 'failed', 'uploading'].includes(item.status) && <button type="button" onClick={() => { setEditingId(item._id); setTab('processing'); }} className="rounded-lg border px-3 py-1 text-sm">Tiến trình</button>}
        {item.status === 'published' && <button type="button" disabled={busy} onClick={() => void action(() => hideAdminLesson(item._id), 'Đã ẩn bài học.')} className="rounded-lg border px-3 py-1 text-sm">Ẩn bài</button>}
        {item.status === 'hidden' && <button type="button" disabled={busy} onClick={() => void action(() => restoreAdminLesson(item._id), 'Đã khôi phục bài học.')} className="rounded-lg border px-3 py-1 text-sm">Khôi phục</button>}
      </div></div>)}</div>
    </>}
    {tab === 'upload' && <form onSubmit={event => void submitUpload(event)} className="mx-auto max-w-2xl space-y-4 rounded-2xl border bg-white p-6">
      <h1 className="text-2xl font-black">Thêm video bài học</h1>
      <label className="block text-sm font-bold">Video MP4/WebM<input type="file" required accept="video/mp4,video/webm" onChange={event => setFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full rounded-xl border p-2 font-normal" /></label>
      <label className="block text-sm font-bold">Tiêu đề tiếng Việt<input required minLength={2} maxLength={160} value={titleVi} onChange={event => setTitleVi(event.target.value)} className="mt-1 block w-full rounded-xl border p-2 font-normal" /></label>
      <label className="block text-sm font-bold">Tiêu đề tiếng Trung<input value={titleZh} onChange={event => setTitleZh(event.target.value)} className="mt-1 block w-full rounded-xl border p-2 font-normal" /></label>
      <label className="block text-sm font-bold">Mô tả<input required minLength={10} maxLength={1000} value={descriptionVi} onChange={event => setDescriptionVi(event.target.value)} className="mt-1 block w-full rounded-xl border p-2 font-normal" /></label>
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-bold">HSK<select value={hsk} onChange={event => setHsk(Number(event.target.value))} className="mt-1 block w-full rounded-xl border p-2 font-normal">{[1,2,3,4,5,6].map(level => <option key={level} value={level}>HSK {level}</option>)}</select></label>
        <label className="text-sm font-bold">Chủ đề<select value={topic} onChange={event => setTopic(event.target.value)} className="mt-1 block w-full rounded-xl border p-2 font-normal">{['daily-life','food','travel','shopping','business','entertainment'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-sm font-bold">Thời lượng (giây)<input type="number" required min={60} max={300} value={duration} onChange={event => setDuration(Number(event.target.value))} className="mt-1 block w-full rounded-xl border p-2 font-normal" /></label></div>
      <button type="submit" disabled={busy} className="rounded-xl bg-[#B91B1C] px-5 py-2 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Đang tải video…' : 'Tạo bài và tải video'}</button>
    </form>}
    {tab === 'processing' && <>
      <h1 className="text-2xl font-black">Tiến trình xử lý</h1>
      {selected && <div className="rounded-2xl border bg-white p-5 space-y-2"><h2 className="font-bold">{selected.titleVi}</h2><p className="text-sm">{statusLabel[selected.status]} · {processing?.stage ?? selected.processingStep ?? ''} · {processing?.stageProgress ?? selected.processingProgress ?? 0}%</p>
        {selected.processingError && <p className="text-sm text-red-700">{selected.processingError}</p>}
        {selected.status === 'ready_for_review' && <button type="button" onClick={() => setTab('editor')} className="rounded-xl bg-[#B91B1C] px-4 py-2 text-sm text-white">Kiểm tra và biên tập</button>}
        {selected.status === 'failed' && <button type="button" disabled={busy} onClick={() => void action(() => retryProcessing(selected._id), 'Đã yêu cầu xử lý lại.')} className="rounded-xl border px-4 py-2 text-sm">Thử lại</button>}
        {selected.status === 'uploading' && <button type="button" disabled={busy} onClick={() => void action(() => cancelVideoUpload(selected._id), 'Đã hủy phiên tải lên.')} className="rounded-xl border px-4 py-2 text-sm">Hủy tải lên</button>}
      </div>}
      <div className="space-y-2">{jobs.map(job => <div key={job._id} className="rounded-xl border bg-white p-3 text-sm">{lessons.find(item => item._id === job.lessonId)?.titleVi ?? job.lessonId} · {job.status} · {job.stage} · {job.stageProgress}%</div>)}</div>
    </>}
    {tab === 'editor' && selected && <div className="space-y-5">
      <div><h1 className="text-2xl font-black">Biên tập: {selected.titleVi}</h1><p className="text-sm text-neutral-500">{statusLabel[selected.status]}</p></div>
      {review && <>
        <div className="rounded-2xl border bg-white p-5 space-y-3"><h2 className="font-bold">Thông tin chung</h2>
          <input value={titleVi} onChange={event => setTitleVi(event.target.value)} aria-label="Tiêu đề tiếng Việt" className="block w-full rounded-lg border p-2 text-sm" />
          <input value={titleZh} onChange={event => setTitleZh(event.target.value)} aria-label="Tiêu đề tiếng Trung" className="block w-full rounded-lg border p-2 text-sm" />
          <textarea value={descriptionVi} onChange={event => setDescriptionVi(event.target.value)} aria-label="Mô tả" className="block w-full rounded-lg border p-2 text-sm" />
          <button type="button" disabled={busy || !['draft','ready_for_review','failed'].includes(selected.status)} onClick={() => void action(() => patchAdminLesson(selected._id, { titleVi, titleZh, descriptionVi }), 'Đã lưu thông tin.')} className="rounded-lg border px-3 py-2 text-sm">Lưu thông tin</button>
        </div>
        {selected.status === 'ready_for_review' && <>
          <div className="rounded-2xl border bg-white p-5 space-y-3"><h2 className="font-bold">Phụ đề ({cues.length})</h2>{cues.map((cue, index) => <div key={cue.cueId} className="rounded-lg border p-3 space-y-2"><p className="text-xs">{cue.cueId} · {Math.round(cue.startMs / 1000)}–{Math.round(cue.endMs / 1000)} giây</p>{(['zh','pinyin','vi'] as const).map(field => <input key={field} aria-label={`${field} ${index + 1}`} value={cue[field]} onChange={event => setCues(current => current.map((item, i) => i === index ? { ...item, [field]: event.target.value } : item))} className="block w-full rounded-lg border p-2 text-sm" />)}</div>)}
            <button type="button" disabled={busy || !cues.length} onClick={() => void action(() => saveAdminSubtitles(selected._id, cues), 'Đã lưu phụ đề.')} className="rounded-lg border px-3 py-2 text-sm">Lưu phụ đề</button>
          </div>
          <div className="rounded-2xl border bg-white p-5 space-y-3"><h2 className="font-bold">Câu hỏi ({questions.length})</h2>{questions.map((question, index) => <div key={question.questionId} className="rounded-lg border p-3 space-y-2"><p className="text-xs">Câu {index + 1} · {question.type}</p>
            <input value={question.prompt} aria-label={`Câu hỏi ${index + 1}`} onChange={event => setQuestions(current => current.map((item, i) => i === index ? { ...item, prompt: event.target.value } : item))} className="w-full rounded-lg border p-2 text-sm" />
            {question.options.map(option => <label key={option.optionId} className="flex items-center gap-2 text-sm"><input type="radio" name={`correct-${question.questionId}`} checked={question.correctOptionId === option.optionId} onChange={() => setQuestions(current => current.map((item, i) => i === index ? { ...item, correctOptionId: option.optionId } : item))} /><input value={option.text} onChange={event => setQuestions(current => current.map((item, i) => i === index ? { ...item, options: item.options.map(entry => entry.optionId === option.optionId ? { ...entry, text: event.target.value } : entry) } : item))} className="flex-1 rounded-lg border p-2" /></label>)}
            {question.type === 'fill_blank' && <input value={question.acceptedAnswers?.join(', ') ?? ''} aria-label="Đáp án chấp nhận" onChange={event => setQuestions(current => current.map((item, i) => i === index ? { ...item, acceptedAnswers: event.target.value.split(',').map(value => value.trim()).filter(Boolean) } : item))} className="w-full rounded-lg border p-2 text-sm" />}
            <input value={question.explanationVi} aria-label="Giải thích" onChange={event => setQuestions(current => current.map((item, i) => i === index ? { ...item, explanationVi: event.target.value } : item))} className="w-full rounded-lg border p-2 text-sm" />
          </div>)}<button type="button" disabled={busy || !questions.length} onClick={() => void action(() => saveAdminQuiz(selected._id, questions), 'Đã lưu quiz.')} className="rounded-lg border px-3 py-2 text-sm">Lưu quiz</button></div>
          <button type="button" disabled={busy} onClick={() => void action(async () => { await saveAdminSubtitles(selected._id, cues); await saveAdminQuiz(selected._id, questions); await publishAdminLesson(selected._id); setTab('videos'); }, 'Đã xuất bản bài học.')} className="rounded-xl bg-[#188A5A] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Lưu và xuất bản</button>
        </>}
      </>}
    </div>}
    {tab === 'users' && <><h1 className="text-2xl font-black">Người dùng</h1><div className="space-y-2">{users.map(user => <div key={user._id} className="flex items-center justify-between gap-3 rounded-xl border bg-white p-4"><div><p className="font-bold">{user.name}</p><p className="text-sm text-neutral-500">{user.email} · {user.role} · {user.status}</p></div>{user.role !== 'admin' && <button type="button" disabled={busy} onClick={() => void action(() => setAdminUserStatus(user._id, user.status === 'active' ? 'locked' : 'active'), 'Đã cập nhật tài khoản.')} className="rounded-lg border px-3 py-2 text-sm">{user.status === 'active' ? 'Khóa' : 'Mở khóa'}</button>}</div>)}</div></>}
  </div>;
}
