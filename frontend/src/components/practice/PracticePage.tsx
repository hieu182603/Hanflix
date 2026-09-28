import React, { useEffect, useRef, useState } from 'react';
import { useBlocker, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPracticeAttempt, getPracticeHistory, getPracticeSets, savePractice, skillLabels, startPractice, submitPractice, type PracticeAttempt, type PracticeSkill } from '../../api/practice';
import { dashboardQueryKeys, learningQueryKeys } from '../../api/queryKeys';
import { ApiRequestError } from '../../api/client';

const button = 'min-h-11 rounded-xl border border-[#E7E7EA] px-4 py-2 text-sm font-bold disabled:opacity-40';
const panel = 'rounded-2xl border border-[#E7E7EA] bg-white p-5 space-y-4';
export default function PracticePage() {
  const [params, setParams] = useSearchParams();
  const attemptId = params.get('attempt');
  const hsk = /^[1-9]$/.test(params.get('hsk') ?? '') ? Number(params.get('hsk')) : 1;
  const skill = (Object.keys(skillLabels).includes(params.get('skill') ?? '') ? params.get('skill') : '') as PracticeSkill | '';
  const [page, setPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const startKey = useRef<{ setId: string; key: string } | null>(null);
  const filters = { hsk, skill: skill || undefined };
  const sets = useQuery({ queryKey: ['practice', 'sets', filters, page], queryFn: ({ signal }) => getPracticeSets({ ...filters, page }, signal), enabled: !attemptId });
  const history = useQuery({ queryKey: ['practice', 'history', filters, historyPage], queryFn: ({ signal }) => getPracticeHistory({ ...filters, page: historyPage }, signal), enabled: !attemptId });
  const changeFilter = (key: string, value: string) => {
    setParams(prev => { const next = new URLSearchParams(prev); value ? next.set(key, value) : next.delete(key); return next; });
    setPage(1); setHistoryPage(1);
  };
  const open = (id: string) => setParams(prev => { const next = new URLSearchParams(prev); next.set('attempt', id); return next; });
  const begin = async (setId: string) => {
    if (starting) return;
    setStarting(true); setError('');
    if (startKey.current?.setId !== setId) startKey.current = { setId, key: crypto.randomUUID() };
    try { const attempt = await startPractice(setId, startKey.current.key); startKey.current = null; open(attempt.id); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không thể bắt đầu bài luyện'); }
    finally { setStarting(false); }
  };
  if (attemptId) return <PracticeSession key={attemptId} id={attemptId} onBack={() => setParams(prev => { const next = new URLSearchParams(prev); next.delete('attempt'); return next; })} />;
  return <div className="mx-auto max-w-5xl space-y-6">
    <header className={panel}><h1 className="text-2xl font-black">Luyện kỹ năng HSK</h1><p className="text-sm text-neutral-600">Chọn bài luyện đã được duyệt. Kết quả giúp bạn tìm kỹ năng cần ôn; đây chưa phải đề thi thử HSK chính thức.</p>
      <div className="flex flex-wrap gap-4">
        <label>Cấp độ <select aria-label="Cấp HSK" className={button} value={hsk} onChange={e => changeFilter('hsk', e.target.value)}>{Array.from({ length: 9 }, (_, i) => <option key={i} value={i + 1}>HSK {i + 1}</option>)}</select></label>
        <label>Kỹ năng <select aria-label="Kỹ năng" className={button} value={skill} onChange={e => changeFilter('skill', e.target.value)}><option value="">Tất cả</option>{Object.entries(skillLabels).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      </div>
    </header>
    {(error || sets.error || history.error) && <p role="alert" className="text-red-700">{error || sets.error?.message || history.error?.message} <button className={button} onClick={() => { void sets.refetch(); void history.refetch(); }}>Thử lại</button></p>}
    {sets.isPending ? <p>Đang tải bài luyện…</p> : <section className="grid gap-4 sm:grid-cols-2">{sets.data?.items.map(set => <article key={set.id} className={panel}>
      <span className="text-xs font-bold text-[#B91B1C]">HSK {set.hsk} · {skillLabels[set.skill]}</span><h2 className="text-lg font-bold">{set.title}</h2><p>{set.questionCount} câu · {Math.ceil(set.durationSeconds / 60)} phút</p><button className={`${button} bg-[#B91B1C] text-white`} disabled={starting} onClick={() => void begin(set.id)}>Bắt đầu / Tiếp tục</button>
    </article>)}</section>}
    {sets.data?.items.length === 0 && <p className={panel}>Chưa có bài luyện được duyệt cho lựa chọn này. Hãy chọn cấp hoặc kỹ năng khác.</p>}
    <Pager page={page} pages={sets.data?.totalPages ?? 1} onChange={setPage} />
    <section className={panel}><h2 className="text-lg font-bold">Lịch sử và bài đang làm</h2>
      {history.isPending && <p>Đang tải lịch sử…</p>}{history.data?.items.length === 0 && <p>Chưa có bài làm cho bộ lọc này.</p>}
      {history.data?.items.map(a => <button key={a.id} className="flex w-full flex-wrap items-center justify-between gap-2 border-b py-3 text-left" onClick={() => open(a.id)}><span>{a.title}<small className="block text-neutral-500">{new Date(a.startedAt).toLocaleString('vi-VN')}</small></span><strong>{a.status === 'submitted' ? `${a.score}% · +${a.rewardXp} XP` : 'Tiếp tục làm bài'}</strong></button>)}
      <Pager page={historyPage} pages={history.data?.totalPages ?? 1} onChange={setHistoryPage} />
    </section>
  </div>;
}
function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  return <div className="flex items-center justify-end gap-3"><button className={button} disabled={page <= 1} onClick={() => onChange(page - 1)}>Trước</button><span>{page}/{pages}</span><button className={button} disabled={page >= pages} onClick={() => onChange(page + 1)}>Sau</button></div>;
}
export function PracticeSession({ id, onBack }: { id: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [attempt, setAttempt] = useState<PracticeAttempt | null>(null);
  const attemptRef = useRef<PracticeAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answersRef = useRef<Record<string, string>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const flaggedRef = useRef<string[]>([]);
  const [index, setIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const editVersion = useRef(0);
  const savedEditVersion = useRef(0);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(0);
  const deadline = useRef(0);
  const saveRetryAt = useRef(0);
  const submitRetryAt = useRef(0);
  const saveFailures = useRef(0);
  const submitFailures = useRef(0);
  const loadGeneration = useRef(0);
  const navigating = useRef(false);
  const [notice, setNotice] = useState('');
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['practice'] });
    void queryClient.invalidateQueries({ queryKey: learningQueryKeys.root });
    void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.root });
  };
  const syncDeadline = (a: PracticeAttempt, requestedAt: number) => {
    // Conservatively include the request round trip; receiving a response must
    // never grant extra time or move an already established deadline forward.
    const corrected = requestedAt + Math.max(0, Date.parse(a.expiresAt) - Date.parse(a.serverNow));
    deadline.current = deadline.current ? Math.min(deadline.current, corrected) : corrected;
    setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
  };
  const adopt = (a: PracticeAttempt, requestedAt: number) => {
    attemptRef.current = a; setAttempt(a);
    answersRef.current = a.answers; setAnswers(a.answers);
    flaggedRef.current = a.flagged; setFlagged(a.flagged);
    syncDeadline(a, requestedAt);
    savedEditVersion.current = editVersion.current;
    saveRetryAt.current = 0; saveFailures.current = 0;
    setDirty(false); setError('');
    if (a.status === 'submitted') {
      invalidate();
      window.dispatchEvent(new CustomEvent('hanflix:activity-updated', { detail: { source: 'practice' } }));
    }
  };
  const load = async () => {
    const generation = ++loadGeneration.current;
    const requestedAt = Date.now();
    setBusy(true);
    try {
      const a = await getPracticeAttempt(id);
      if (generation === loadGeneration.current) adopt(a, requestedAt);
    } catch (e) {
      if (generation === loadGeneration.current) setError(e instanceof Error ? e.message : 'Không thể tải bài');
    } finally { if (generation === loadGeneration.current) setBusy(false); }
  };
  useEffect(() => { void load(); return () => { ++loadGeneration.current; }; }, [id]);
  const retryDelay = (failures: number) => Math.min(30_000, 2000 * 2 ** Math.min(failures - 1, 4));
  const retryable = (e: unknown) => !(e instanceof ApiRequestError) || e.status === 0 || e.status === 408 || e.status === 429 || e.status >= 500;
  const save = async () => {
    if (inFlight.current) return inFlight.current;
    const pending = (async () => {
      setBusy(true);
      try {
        // Drain edits made while a request was in flight before allowing navigation.
        while (attemptRef.current?.status === 'in_progress' && savedEditVersion.current < editVersion.current) {
          const version = editVersion.current;
          const requestedAt = Date.now();
          const a = await savePractice(id, { version: attemptRef.current.version, answers: answersRef.current, flagged: flaggedRef.current });
          attemptRef.current = a; setAttempt(a);
          savedEditVersion.current = version;
          syncDeadline(a, requestedAt);
          setDirty(savedEditVersion.current < editVersion.current);
        }
        saveRetryAt.current = 0; saveFailures.current = 0;
        setError('');
      } catch (e) {
        saveRetryAt.current = retryable(e) ? Date.now() + retryDelay(++saveFailures.current) : Infinity;
        setError(e instanceof Error ? e.message : 'Chưa lưu được đáp án'); throw e;
      }
      finally { setBusy(false); }
    })();
    inFlight.current = pending;
    try { await pending; } finally { inFlight.current = null; }
  };
  const finish = async () => {
    if (submitting.current) return false;
    submitting.current = true; setBusy(true); setConfirmSubmit(false);
    try {
      if (inFlight.current) await inFlight.current.catch(() => {});
      const a = attemptRef.current;
      if (!a) return false;
      const requestedAt = Date.now();
      const result = await submitPractice(id, { version: a.version, answers: answersRef.current, flagged: flaggedRef.current });
      if (Object.entries(answersRef.current).some(([key, value]) => value !== (result.answers[key] ?? ''))) {
        setNotice('Một số đáp án chưa tới máy chủ trước hạn hoặc bài đã được nộp ở tab khác nên không được tính. Kết quả dưới đây dùng đáp án máy chủ đã nhận.');
      }
      adopt(result, requestedAt);
      submitRetryAt.current = 0; submitFailures.current = 0;
      return true;
    } catch (e) {
      submitRetryAt.current = retryable(e) ? Date.now() + retryDelay(++submitFailures.current) : Infinity;
      setError(e instanceof Error ? e.message : 'Chưa nộp được bài');
      return false;
    }
    finally { submitting.current = false; setBusy(false); }
  };
  useEffect(() => {
    if (attempt?.status !== 'in_progress') return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds) {
        if (Date.now() >= submitRetryAt.current) void finish();
      } else if (savedEditVersion.current < editVersion.current && !submitting.current && Date.now() >= saveRetryAt.current) {
        void save().catch(() => {});
      }
    };
    const online = () => {
      if (saveRetryAt.current !== Infinity) saveRetryAt.current = 0;
      if (submitRetryAt.current !== Infinity) submitRetryAt.current = 0;
      tick();
    };
    const timer = setInterval(tick, 250);
    window.addEventListener('online', online);
    return () => { clearInterval(timer); window.removeEventListener('online', online); };
  }, [attempt?.status]);
  const needsSave = () => attemptRef.current?.status === 'in_progress' && (savedEditVersion.current < editVersion.current || submitting.current);
  const blocker = useBlocker(() => Boolean(needsSave()));
  const prepareToLeave = async () => {
    if (submitting.current) return false;
    if (attemptRef.current?.status === 'in_progress' && Date.now() >= deadline.current) return finish();
    try { await save(); return true; } catch { return false; }
  };
  useEffect(() => {
    if (blocker.state !== 'blocked' || navigating.current) return;
    navigating.current = true;
    void prepareToLeave().then(saved => {
      navigating.current = false;
      if (saved) blocker.proceed(); else blocker.reset();
    });
  }, [blocker]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (needsSave()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const leave = async () => {
    if (needsSave() && !await prepareToLeave()) return;
    onBack();
  };
  if (!attempt) return <div className={panel}><p>{error || 'Đang tải bài làm…'}</p><button className={button} onClick={() => void load()}>Thử lại</button><button className={button} onClick={onBack}>Quay lại</button></div>;
  const submitted = attempt.status === 'submitted';
  const questions = onlyWrong && submitted ? attempt.questions.filter(q => !q.correct) : attempt.questions;
  const question = questions[Math.min(index, questions.length - 1)];
  const changeAnswer = (value: string) => {
    if (!question || submitted || Date.now() >= deadline.current || submitting.current) return;
    ++editVersion.current; answersRef.current = { ...answersRef.current, [question.id]: value }; setAnswers(answersRef.current); setDirty(true);
    if (Date.now() >= saveRetryAt.current) void save().catch(() => {});
  };
  return <div className="mx-auto max-w-4xl space-y-5">
    <header className={panel}><button className={button} disabled={busy} onClick={() => void leave()}>← Danh sách bài luyện</button><h1 className="text-2xl font-black">{attempt.title}</h1><p>HSK {attempt.hsk} · {skillLabels[attempt.skill]}</p>
      {submitted ? <div><strong className="text-xl">{attempt.score}% · {attempt.correctCount}/{attempt.questions.length} câu đúng · +{attempt.rewardXp} XP</strong><p className="text-sm">Mỗi bộ luyện thưởng tối đa một lần/ngày. Điểm dưới 50% chưa được thưởng.</p><label><input type="checkbox" checked={onlyWrong} onChange={e => { setOnlyWrong(e.target.checked); setIndex(0); }} /> Chỉ ôn câu sai</label></div>
        : <div className="flex justify-between"><strong role="timer">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</strong><span aria-live="polite">{busy ? 'Đang lưu / gửi…' : dirty ? 'Có đáp án chưa lưu' : 'Đã lưu trên máy chủ'}</span></div>}
    </header>
    {notice && <p role="status" className={panel}>{notice}</p>}
    {error && <div role="alert" className={`${panel} text-red-700`}><p>{error}</p><p>Đáp án đang nhập vẫn ở trang này. Tải lại bản máy chủ sẽ thay thế phần chưa lưu.</p><button disabled={busy} className={button} onClick={() => void save().catch(() => {})}>Thử lưu lại</button><button disabled={busy} className={button} onClick={() => { if (window.confirm('Tải bản máy chủ và thay phần đáp án chưa lưu?')) void load(); }}>Tải bản máy chủ</button></div>}
    <nav className="flex flex-wrap gap-2" aria-label="Danh sách câu hỏi">{questions.map((q, i) => <button key={q.id} aria-current={q.id === question?.id ? 'step' : undefined} className={`${button} ${q.id === question?.id ? 'bg-[#B91B1C] text-white' : answers[q.id] ? 'bg-green-50' : 'bg-white'}`} onClick={() => setIndex(i)}>{i + 1}{flagged.includes(q.id) ? ' ★' : ''}</button>)}</nav>
    {question ? <article className={panel}><h2 className="whitespace-pre-wrap text-lg font-bold">{question.prompt}</h2>{question.audioUrl && <audio key={question.id} controls preload="metadata" src={question.audioUrl} className="w-full" />}
      {question.type === 'choice' ? <fieldset disabled={submitted || !remaining || submitting.current} className="space-y-3"><legend className="sr-only">Chọn đáp án</legend>{question.options.map(o => <label key={o.id} className="flex items-start gap-3 rounded-xl border p-4"><input type="radio" name={question.id} checked={answers[question.id] === o.id} onChange={() => changeAnswer(o.id)} /><span>{o.text}</span></label>)}</fieldset>
        : <label className="block">Câu trả lời<input aria-label="Câu trả lời" maxLength={1000} className="mt-2 w-full rounded-xl border p-3" disabled={submitted || !remaining || submitting.current} value={answers[question.id] ?? ''} onChange={e => changeAnswer(e.target.value)} /></label>}
      {submitted ? <div className="rounded-xl bg-neutral-50 p-4"><strong>{question.correct ? 'Đúng' : 'Chưa đúng'}</strong><p>Đáp án: {question.type === 'choice' ? question.options.find(o => o.id === question.correctOptionId)?.text : question.acceptedAnswers?.join(' / ')}</p><p className="mt-2 whitespace-pre-wrap">{question.explanation}</p></div>
        : <label><input type="checkbox" checked={flagged.includes(question.id)} onChange={e => { ++editVersion.current; flaggedRef.current = e.target.checked ? [...flaggedRef.current, question.id] : flaggedRef.current.filter(id => id !== question.id); setFlagged(flaggedRef.current); setDirty(true); }} disabled={!remaining || submitting.current} /> Đánh dấu để xem lại</label>}
    </article> : <p className={panel}>Bạn không có câu sai trong bài này.</p>}
    <div className="flex flex-wrap justify-between gap-3"><button className={button} disabled={index <= 0} onClick={() => setIndex(i => i - 1)}>Câu trước</button><button className={button} disabled={index >= questions.length - 1} onClick={() => setIndex(i => i + 1)}>Câu sau</button>{!submitted && <button className={`${button} bg-[#B91B1C] text-white`} disabled={busy} onClick={() => setConfirmSubmit(true)}>Nộp bài</button>}</div>
    {confirmSubmit && <div role="dialog" aria-modal="true" aria-label="Xác nhận nộp bài" className={panel}><p>Bạn đã trả lời {Object.values(answers).filter(Boolean).length}/{attempt.questions.length} câu. Nộp bài để xem kết quả?</p><button className={button} onClick={() => setConfirmSubmit(false)}>Tiếp tục làm</button><button className={button} onClick={() => void finish()}>Xác nhận nộp</button></div>}
  </div>;
}
