import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./api/auth', () => ({ getCachedUser: vi.fn(), restoreSession: vi.fn() }));
vi.mock('./api/client', async (importOriginal) => ({ ...await importOriginal<typeof import('./api/client')>(), apiFetch: vi.fn() }));
vi.mock('./components/HanFlixLoadingScreen', () => ({ default: () => null }));
import App from './App';
import * as auth from './api/auth';
import { apiFetch } from './api/client';
import { getStreakState, setStreakUser } from './lib/streak';
import type { User } from './data/hanflixData';

describe('App streak session lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T05:00:00Z'));
    vi.mocked(apiFetch).mockReset();
    setStreakUser(null);
    vi.mocked(auth.getCachedUser).mockReturnValue({ id: 'learner', role: 'user', learningProfile: { surveyVersion: 1 } } as User);
  });
  afterEach(() => { cleanup(); setStreakUser(null); vi.useRealTimers(); });
  it('waits for confirmed authentication, loads streak and clears it on unmount', async () => {
    let restore!: (user: User | null) => void;
    vi.mocked(auth.restoreSession).mockReturnValueOnce(new Promise(resolve => { restore = resolve; }));
    vi.mocked(apiFetch).mockResolvedValue({ streakCount: 3, longestStreak: 3, isCompletedToday: true,
      today: '2026-09-26', lastActiveDate: '2026-09-26', timezone: 'Asia/Ho_Chi_Minh', weekDays: [] });
    const view = render(<MemoryRouter initialEntries={['/loading']}><App /></MemoryRouter>);
    expect(apiFetch).not.toHaveBeenCalled();
    await act(async () => { restore(auth.getCachedUser()); });
    expect(apiFetch).toHaveBeenCalledWith('/learning/streak');
    expect(getStreakState().streakCount).toBe(3);
    view.unmount();
    expect(getStreakState().loaded).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
  it('does not load private streak data for a stale cached login', async () => {
    vi.mocked(auth.restoreSession).mockResolvedValueOnce(null);
    await act(async () => { render(<MemoryRouter initialEntries={['/loading']}><App /></MemoryRouter>); });
    expect(apiFetch).not.toHaveBeenCalled();
    expect(getStreakState().loaded).toBe(false);
  });
});
