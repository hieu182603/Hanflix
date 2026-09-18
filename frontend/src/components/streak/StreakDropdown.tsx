import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Flame, X } from 'lucide-react';
import { getLearningActivity, type LearningActivity } from '../../api/learning';

interface Props {
  initialStreakDays?: number;
  dailyMinutes?: number;
  onOpenPractice?: () => void;
  onNavigateToLessons?: () => void;
}

function getLocalDateKey(date = new Date(), timeZone = 'Asia/Ho_Chi_Minh'): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function getPreviousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export default function StreakDropdown({ dailyMinutes = 15, onNavigateToLessons }: Props) {
  const [activity, setActivity] = useState<LearningActivity | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getLearningActivity().then(data => { if (active) { setActivity(data); setError(''); } })
        .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Không thể tải hoạt động học tập.'); });
    };
    refresh();
    window.addEventListener('hanflix:activity-updated', refresh);
    return () => { active = false; window.removeEventListener('hanflix:activity-updated', refresh); };
  }, []);

  const days = activity?.days ?? [];
  const tz = activity?.timezone || 'Asia/Ho_Chi_Minh';
  const today = useMemo(() => getLocalDateKey(new Date(), tz), [tz]);
  const todaySeconds = days.find(day => day.date === today)?.activeStudySeconds ?? 0;
  const streak = useMemo(() => {
    let count = 0;
    const activeDays = new Set(days.filter(day => day.activeStudySeconds > 0 || day.quizAttempts > 0).map(day => day.date));
    let cursor = today;
    if (!activeDays.has(today)) cursor = getPreviousDateKey(cursor);
    while (activeDays.has(cursor)) {
      count++;
      cursor = getPreviousDateKey(cursor);
    }
    return count;
  }, [days, today]);
  const goalPercent = Math.min(100, Math.round((todaySeconds / (dailyMinutes * 60)) * 100));

  return <div className="relative">
    <button type="button" onClick={() => setOpen(value => !value)} className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800" aria-label="Hoạt động học tập">
      <Flame className="h-4 w-4" /> {streak} ngày
    </button>
    {open && <div className="absolute right-0 z-50 mt-2 w-[330px] max-w-[calc(100vw-24px)] rounded-2xl border bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-black"><CalendarDays className="h-5 w-5 text-[#B91B1C]" /> Hoạt động học tập</h2><button type="button" onClick={() => setOpen(false)} aria-label="Đóng"><X className="h-4 w-4" /></button></div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <p className="mt-3 text-sm">Chuỗi hiện tại: <strong>{streak} ngày</strong></p>
      <p className="mt-1 text-sm">Hôm nay: <strong>{Math.round(todaySeconds / 60)} / {dailyMinutes} phút</strong></p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200"><div className="h-full bg-[#B91B1C]" style={{ width: `${goalPercent}%` }} /></div>
      <div className="mt-4 grid grid-cols-7 gap-1">{days.slice(-7).map(day => <div key={day.date} title={`${day.date}: ${Math.round(day.activeStudySeconds / 60)} phút`} className={`h-8 rounded-md ${day.activeStudySeconds > 0 || day.quizAttempts > 0 ? 'bg-amber-400' : 'bg-neutral-100'}`} />)}</div>
      <button type="button" onClick={() => { setOpen(false); onNavigateToLessons?.(); }} className="mt-4 rounded-lg bg-[#B91B1C] px-4 py-2 text-xs font-bold text-white">Xem bài học</button>
    </div>}
  </div>;
}
