import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../api/client', () => ({ apiFetch: vi.fn() }));
import { apiFetch } from '../api/client';
import { getStreakState, setStreakUser, refreshStreak, recordLearningActivity, startStreakSync } from './streak';

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
    await vi.advanceTimersByTimeAsync(150);
    expect(apiFetch).toHaveBeenCalledTimes(2);
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
  it('coalesces duplicate activity signals and cleans up timers and listeners', async () => {
    vi.mocked(apiFetch).mockResolvedValue(snapshot());
    const stop = startStreakSync('user-a');
    await Promise.resolve();
    vi.mocked(apiFetch).mockResolvedValue(snapshot(true));
    window.dispatchEvent(new CustomEvent('hanflix:activity-updated', { detail: { source: 'video' } }));
    recordLearningActivity('video');
    recordLearningActivity('video');
    await vi.advanceTimersByTimeAsync(150);
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(getStreakState().isCompletedToday).toBe(true);
    stop();
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('hanflix:activity-updated'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(getStreakState().loaded).toBe(false);
  });
  it('rolls over on focus before a slow response and refreshes when back online', async () => {
    vi.mocked(apiFetch).mockResolvedValue(snapshot(true));
    const stop = startStreakSync('user-a');
    await Promise.resolve();
    vi.setSystemTime(new Date('2026-09-26T17:00:00Z'));
    vi.mocked(apiFetch).mockReturnValueOnce(new Promise(() => {}));
    const observed: boolean[] = [];
    const listener = () => observed.push(getStreakState().isCompletedToday);
    window.addEventListener('hanflix:streak-updated', listener);
    window.dispatchEvent(new Event('focus'));
    expect(observed).toEqual([false]);
    vi.mocked(apiFetch).mockResolvedValue({ ...snapshot(), today: '2026-09-27', lastActiveDate: '2026-09-26' });
    window.dispatchEvent(new Event('online'));
    await Promise.resolve();
    expect(apiFetch).toHaveBeenCalledTimes(3);
    window.removeEventListener('hanflix:streak-updated', listener);
    stop();
  });
  it('cancels an old account queued activity and ignores its late cleanup', async () => {
    vi.mocked(apiFetch).mockResolvedValue(snapshot());
    const stopA = startStreakSync('user-a');
    recordLearningActivity('review');
    const stopB = startStreakSync('user-b');
    stopA();
    await vi.advanceTimersByTimeAsync(150);
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(getStreakState().loaded).toBe(true);
    stopB();
  });
  it('celebrates confirmed learning after initial loading failed', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('offline'));
    await refreshStreak();
    const listener = vi.fn();
    window.addEventListener('hanflix:streak-updated', listener);
    vi.mocked(apiFetch).mockResolvedValue(snapshot(true));
    await refreshStreak('review');
    expect(listener.mock.calls[0][0].detail).toMatchObject({ isNewStreak: true, source: 'review' });
    window.removeEventListener('hanflix:streak-updated', listener);
  });
  it('does not mark the new day complete from a response started before midnight', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(apiFetch).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const listener = vi.fn();
    window.addEventListener('hanflix:streak-updated', listener);
    const pending = refreshStreak('video');
    vi.setSystemTime(new Date('2026-09-26T17:00:00Z'));
    resolve(snapshot(true));
    await pending;
    expect(getStreakState()).toMatchObject({ today: '2026-09-27', streakCount: 2, isCompletedToday: false });
    expect(listener.mock.calls.some(([event]) => event.detail?.isNewStreak)).toBe(false);
    window.removeEventListener('hanflix:streak-updated', listener);
  });
});
