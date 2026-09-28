import { DEFAULT_TIMEZONE, parseDateKey, toTimezoneDateKey } from './study-activity.js';

// A progress ping or an XP adjustment alone is not evidence of learning.
export const qualifyingStudyActivity = { $or: [
  { activeStudySeconds: { $gt: 0 } }, { completedLessons: { $gt: 0 } },
  { quizAttempts: { $gt: 0 } }, { vocabReviews: { $gt: 0 } }, { flashcardCompleted: true },
] };
export const qualifyingPracticeActivity = {
  status: 'submitted',
  $expr: { $gt: [{ $size: { $objectToArray: { $ifNull: ['$answers', {}] } } }, 0] },
};

export function summarizeStreak(dateKeys: string[], now = new Date(), timezone = DEFAULT_TIMEZONE) {
  const today = toTimezoneDateKey(now, timezone);
  const dates = [...new Set(dateKeys.filter(key => {
    try { parseDateKey(key); return key <= today; } catch { return false; }
  }))].sort();
  const shift = (key: string, days: number) => {
    const date = parseDateKey(key);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  let run = 0;
  let longestStreak = 0;
  dates.forEach((key, index) => {
    run = index > 0 && shift(dates[index - 1]!, 1) === key ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  });
  const lastActiveDate = dates.at(-1) ?? null;
  const streakCount = lastActiveDate === today || lastActiveDate === shift(today, -1) ? run : 0;
  const monday = shift(today, -((parseDateKey(today).getUTCDay() + 6) % 7));
  const active = new Set(dates);
  return { streakCount, longestStreak, lastActiveDate, isCompletedToday: active.has(today),
    today, timezone, activeDays: dates.length,
    weekDays: Array.from({ length: 7 }, (_, i) => {
      const date = shift(monday, i);
      return { date, completed: active.has(date), isToday: date === today };
    }),
  };
}
