import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../api/client', () => ({ apiFetch: vi.fn() }));
vi.mock('./BurningFlame', () => ({ default: () => null }));
import { apiFetch } from '../../api/client';
import { refreshStreak, setStreakUser } from '../../lib/streak';
import StreakDropdown from './StreakDropdown';

describe('streak loading and recovery', () => {
  beforeEach(() => { vi.mocked(apiFetch).mockReset(); setStreakUser('learner'); });
  afterEach(() => { cleanup(); setStreakUser(null); });
  it('does not present missing data as zero days or require learning again', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('offline'));
    await refreshStreak();
    render(<StreakDropdown />);
    fireEvent.click(screen.getByRole('button', { name: 'Chuỗi học tập rực lửa' }));
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByText('Xem video ngay')).toBeNull();
    expect(screen.getByText(/không cần học lại/)).toBeTruthy();
    vi.mocked(apiFetch).mockResolvedValueOnce({ streakCount: 4, longestStreak: 4, isCompletedToday: true,
      today: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()),
      lastActiveDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()),
      timezone: 'Asia/Ho_Chi_Minh', weekDays: [] });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Thử đồng bộ lại' })); });
    expect(screen.queryByRole('button', { name: 'Thử đồng bộ lại' })).toBeNull();
    expect(screen.getByText('Đã ghi nhận')).toBeTruthy();
  });
});
