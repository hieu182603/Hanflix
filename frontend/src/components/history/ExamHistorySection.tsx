import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { fetchMyExamHistory, fetchExamAttempt, type ExamHistory } from '../../services/exam.service';
import type { ExamResult } from '../../data/hskExamData';
import ExamResultView from '../exam/ExamResultView';

export default function ExamHistorySection({ onNavigateLesson }: { onNavigateLesson: (id: string) => void }) {
  const { tr, locale } = useI18n();
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [history, setHistory] = useState<ExamHistory | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ExamResult | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => setReload(value => value + 1);
    window.addEventListener('hanflix:activity-updated', refresh);
    return () => window.removeEventListener('hanflix:activity-updated', refresh);
  }, []);
  useEffect(() => {
    let active = true;
    setHistory(null);
    setError('');
    fetchMyExamHistory(page).then(value => { if (active) setHistory(value); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : tr('Không thể tải lịch sử thi.')); });
    return () => { active = false; };
  }, [page, reload, tr]);
  useEffect(() => {
    if (!attemptId) return;
    let active = true;
    setError('');
    fetchExamAttempt(attemptId).then(value => { if (active) setResult(value); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : tr('Không thể tải kết quả thi.')); })
      .finally(() => { if (active) setAttemptId(null); });
    return () => { active = false; };
  }, [attemptId, tr]);
  return <section className="rounded-3xl border border-[#E7E7EA] bg-white p-5 space-y-4" aria-label={tr('Lịch sử thi HSK')}>
    <h2 className="text-lg font-bold">{tr('Lịch sử thi HSK')}</h2>
    {error && <div role="alert"><p>{error}</p><button onClick={() => setReload(value => value + 1)}>{tr('Thử lại')}</button></div>}
    {!history && !error && <p role="status">{tr('Đang tải lịch sử thi…')}</p>}
    {history?.items.length === 0 && <p>{tr('Bạn chưa nộp bài thi nào.')}</p>}
    {history && <>
      <ul className="divide-y divide-neutral-100">
        {history.items.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div><strong>HSK {item.level} · {item.examCode}</strong>
            <p className="text-sm text-neutral-600">{new Date(item.submittedAt).toLocaleString(locale)} · {item.score}/{item.totalScore} · {Math.floor(item.timeSpentSeconds / 60)} {tr('phút')}</p>
          </div>
          <button disabled={Boolean(attemptId)} onClick={() => setAttemptId(item.id)} className="rounded-xl border px-4 py-2 font-semibold disabled:opacity-50">{tr('Xem kết quả')}</button>
        </li>)}
      </ul>
      {history.total > history.limit && <div className="flex items-center justify-between">
        <button disabled={page === 1} onClick={() => setPage(value => value - 1)}>{tr('Trang trước')}</button>
        <span>{page} / {Math.ceil(history.total / history.limit)}</span>
        <button disabled={page * history.limit >= history.total} onClick={() => setPage(value => value + 1)}>{tr('Trang sau')}</button>
      </div>}
    </>}
    {result && <ExamResultView submission={result} onBackToList={() => setResult(null)} onNavigateLesson={onNavigateLesson} />}
  </section>;
}
