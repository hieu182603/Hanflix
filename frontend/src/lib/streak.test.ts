import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../api/client', () => ({ apiFetch: vi.fn() }));
import { apiFetch } from '../api/client';
import { getStreakState, setStreakUser, refreshStreak, recordLearningActivity } from './streak';

const snapshot = (completed = false) => ({ streakCount: completed ? 2 : 1, longestStreak: 2,
  isCompletedToday: completed, lastActiveDate: completed ? '2026-09-26' : '2026-09-25',
  today: '2026-09-26', timezone: 'Asia/Ho_Chi_Minh', weekDays: [] });
describe('server-backed streak client', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T05:00:00Z'));
    vi.mocked(apiFetch).mockReset();
    setStreakUser(null);
    setStreakUser('user-a');
  });
  afterEach(() => { setStreakUser(null); vi.useRealTimers(); });
  it('does not import the previous browser-only fabricated count', async () => {
    localStorage.setItem('hanflix_streak_count', '999');
    expect(getStreakState().streakCount).toBe(0);
    vi.mocked(apiFetch).mockResolvedValue(snapshot());
    await refreshStreak();
    expect(getStreakState().streakCount).toBe(1);
  });
  it('does not award streak for a local activity without a server record', async () => {
    vi.mocked(apiFetch).mockResolvedValue(snapshot());
    await refreshStreak();
    recordLearningActivity('video');
    await Promise.resolve();
    expect(getStreakState().isCompletedToday).toBe(false);
  });
  it('celebrates only the first server-confirmed completion', async () => {
    vi.mocked(apiFetch).mockResolvedValue(snapshot());
    await refreshStreak();
    const listener = vi.fn();
    window.addEventListener('hanflix:streak-updated', listener);
    vi.mocked(apiFetch).mockResolvedValue(snapshot(true));
    await refreshStreak('review');
    await refreshStreak('review');
    expect(listener.mock.calls.filter(([event]) => event.detail?.isNewStreak)).toHaveLength(1);
    window.removeEventListener('hanflix:streak-updated', listener);
  });
  it('rejects a response from the previous account', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(apiFetch).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const request = refreshStreak();
    setStreakUser('user-b');
    resolve(snapshot(true));
    await request;
    expect(getStreakState()).toMatchObject({ streakCount: 0, loaded: false });
  });
  it('does not let older requests overwrite newer responses', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(apiFetch).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const old = refreshStreak();
    vi.mocked(apiFetch).mockResolvedValueOnce(snapshot(true));
    await refreshStreak();
    resolve(snapshot());
    await old;
    expect(getStreakState().isCompletedToday).toBe(true);
  });
  it('retains confirmed data on failure and rolls over offline', async () => {
    vi.mocked(apiFetch).mockResolvedValue(snapshot(true));
    await refreshStreak();
    vi.mocked(apiFetch).mockRejectedValue(new Error('offline'));
    await refreshStreak();
    expect(getStreakState()).toMatchObject({ error: true, streakCount: 2 });
    vi.setSystemTime(new Date('2026-09-26T17:00:00Z'));
    expect(getStreakState()).toMatchObject({ isCompletedToday: false, streakCount: 2 });
    vi.setSystemTime(new Date('2026-09-27T17:00:00Z'));
    expect(getStreakState().streakCount).toBe(0);
  });
});
