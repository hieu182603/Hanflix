import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import * as auth from './api/auth';
import { getUserSubscription } from './api/billing';
import { queryClient } from './lib/queryClient';
import type { User } from './data/hanflixData';

vi.mock('./api/auth', () => ({ getCachedUser: vi.fn(), restoreSession: vi.fn() }));
vi.mock('./api/billing', () => ({ getUserSubscription: vi.fn() }));
vi.mock('./lib/streak', () => ({ getStreakState: () => ({ streakCount: 0 }), setStreakUser: vi.fn(), startStreakSync: () => () => {} }));
vi.mock('./components/Header', () => ({ default: ({ onOpenPreferences }: { onOpenPreferences: () => void }) => <button onClick={onOpenPreferences}>Open survey</button> }));
vi.mock('./components/Sidebar', () => ({ default: () => null }));
vi.mock('./components/ConnectedLearner', () => ({ default: () => null }));
vi.mock('./components/settings/SettingsModal', () => ({ default: () => null }));
vi.mock('./components/PreferencesDrawer', () => ({ default: () => null }));
vi.mock('./components/AIAssistantDrawer', () => ({ default: () => null }));
vi.mock('./components/panda-pet', () => ({ PandaPet: () => null }));
vi.mock('./components/streak/StreakCelebrationToast', () => ({ default: () => null }));
vi.mock('./components/xp/XpCelebrationToast', () => ({ default: () => null }));
vi.mock('./components/onboarding/LearningSurveyModal', () => ({ default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => isOpen
  ? <div role="dialog"><input aria-label="Survey draft" /><button onClick={onClose}>Close survey</button></div> : null }));
const user = { id: 'learner', role: 'user', name: 'Learner', learningProfile: { surveyVersion: 1, hskLevel: 3 } } as User;
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.resetAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null as any);
  vi.mocked(auth.getCachedUser).mockReturnValue(user);
  vi.mocked(auth.restoreSession).mockResolvedValue(user);
  vi.mocked(getUserSubscription).mockResolvedValue({ tier: 'free', premiumExpiresAt: null, benefits: [] });
});
afterEach(() => { cleanup(); queryClient.clear(); vi.useRealTimers(); });
async function show() {
  await act(async () => { render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/feed']}><App /></MemoryRouter></QueryClientProvider>); });
}
it('preserves a manually opened survey and its draft on poll, focus and entitlement changes', async () => {
  await show();
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Open survey' }));
  fireEvent.change(screen.getByLabelText('Survey draft'), { target: { value: 'Unfinished preferences' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(getUserSubscription).toHaveBeenCalled();
  expect((screen.getByLabelText('Survey draft') as HTMLInputElement).value).toBe('Unfinished preferences');
  vi.mocked(getUserSubscription).mockResolvedValue({ tier: 'premium', premiumExpiresAt: '2099-01-01T00:00:00Z', benefits: [] });
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect((screen.getByLabelText('Survey draft') as HTMLInputElement).value).toBe('Unfinished preferences');
});
it('still opens onboarding for an incomplete profile without reopening it after dismissal on refresh', async () => {
  const incomplete = { ...user, learningProfile: undefined };
  vi.mocked(auth.getCachedUser).mockReturnValue(incomplete);
  vi.mocked(auth.restoreSession).mockResolvedValue(incomplete);
  await show();
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close survey' }));
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('sequences onboarding survey before welcome trial popup and opens trial modal after survey is closed', async () => {
  const newUser = {
    ...user,
    learningProfile: undefined,
    showWelcomeTrialPopup: true,
    trialEndsAt: '2026-10-19T00:00:00.000Z',
  };
  vi.mocked(auth.getCachedUser).mockReturnValue(newUser);
  vi.mocked(auth.restoreSession).mockResolvedValue(newUser);
  await show();

  // 1. Survey dialog is open, Welcome Trial Modal is not yet open
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.getByLabelText('Survey draft')).toBeTruthy();
  expect(screen.queryByText('15 NGÀY PREMIUM MIỄN PHÍ')).toBeNull();

  // 2. User completes or closes the survey
  fireEvent.click(screen.getByRole('button', { name: 'Close survey' }));

  // 3. Survey dialog closes, and Welcome Trial Modal opens!
  expect(screen.queryByLabelText('Survey draft')).toBeNull();
  expect(screen.getByText('15 NGÀY PREMIUM MIỄN PHÍ')).toBeTruthy();
});

