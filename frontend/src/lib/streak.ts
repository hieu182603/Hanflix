import { apiFetch } from '../api/client';

export interface StreakState {
  streakCount: number;
  longestStreak: number;
  isCompletedToday: boolean;
  lastActiveDate: string | null;
  today: string;
  timezone: string;
  weekDays: Array<{ date: string; completed: boolean; isToday: boolean }>;
  loaded: boolean;
  error: boolean;
}
export type LearningActivityType = 'video' | 'practice' | 'review';
export function getLocalDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
const emptyState = (): StreakState => ({ streakCount: 0, longestStreak: 0, isCompletedToday: false,
  lastActiveDate: null, today: getLocalDateString(), timezone: 'Asia/Ho_Chi_Minh', weekDays: [], loaded: false, error: false });
let state = emptyState();
let owner: string | null = null;
let generation = 0;
let requestNumber = 0;
let appliedRequest = 0;
function emit(detail?: unknown) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('hanflix:streak-updated', { detail }));
}
export function getStreakState(): StreakState {
  const today = getLocalDateString();
  if (state.loaded && state.today !== today) {
    const yesterday = new Date(`${today}T00:00:00Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const monday = new Date(`${today}T00:00:00Z`);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const completed = new Set(state.weekDays.filter(day => day.completed).map(day => day.date));
    state = { ...state, today, isCompletedToday: state.lastActiveDate === today,
      streakCount: state.lastActiveDate === today || state.lastActiveDate === yesterday.toISOString().slice(0, 10) ? state.streakCount : 0,
      weekDays: Array.from({ length: 7 }, (_, i) => {
        const value = new Date(monday);
        value.setUTCDate(value.getUTCDate() + i);
        const date = value.toISOString().slice(0, 10);
        return { date, completed: completed.has(date), isToday: date === today };
      }),
    };
  }
  return state;
}
export function setStreakUser(userId: string | null) {
  if (owner === userId) return;
  owner = userId;
  generation++;
  state = emptyState();
  emit();
}
export async function refreshStreak(source?: LearningActivityType) {
  if (!owner) return;
  const currentGeneration = generation;
  const request = ++requestNumber;
  try {
    const result = await apiFetch<Omit<StreakState, 'loaded' | 'error'>>('/learning/streak');
    if (currentGeneration !== generation || request < appliedRequest) return;
    appliedRequest = request;
    const previous = getStreakState();
    const celebrate = Boolean(source) && previous.loaded && !previous.isCompletedToday && result.isCompletedToday;
    state = { ...result, loaded: true, error: false };
    emit(celebrate ? { streakCount: state.streakCount, source, isNewStreak: true, date: state.today } : undefined);
  } catch {
    if (currentGeneration !== generation || request < appliedRequest) return;
    appliedRequest = request;
    state = { ...state, error: true };
    emit();
  }
}
// Compatibility for callers: this only reads server-confirmed activity, never awards a local day.
export function recordLearningActivity(source: LearningActivityType = 'video') {
  void refreshStreak(source);
}
export function startStreakSync(userId: string) {
  setStreakUser(userId);
  void refreshStreak();
  const activity = (event: Event) => { void refreshStreak((event as CustomEvent<{ source?: LearningActivityType }>).detail?.source ?? 'practice'); };
  const focus = () => { void refreshStreak(); };
  const timer = window.setInterval(focus, 60_000);
  window.addEventListener('hanflix:activity-updated', activity);
  window.addEventListener('focus', focus);
  window.addEventListener('online', focus);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener('hanflix:activity-updated', activity);
    window.removeEventListener('focus', focus);
    window.removeEventListener('online', focus);
    setStreakUser(null);
  };
}
