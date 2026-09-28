import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { PracticeSession } from './PracticePage';
import { ApiRequestError } from '../../api/client';
import type { AttemptAnswers, PracticeAttempt } from '../../api/practice';

const api = vi.hoisted(() => ({ getPracticeAttempt: vi.fn(), savePractice: vi.fn(), submitPractice: vi.fn() }));
vi.mock('../../api/practice', async original => ({ ...await original<object>(), ...api }));
let stored: PracticeAttempt;
const clients: QueryClient[] = [];
const routers: ReturnType<typeof createMemoryRouter>[] = [];
const snapshot = () => ({ ...stored, serverNow: new Date().toISOString() });
function persist(input: AttemptAnswers) {
  stored = { ...stored, ...input, version: input.version + 1 };
  return snapshot();
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-27T10:00:00Z'));
  vi.resetAllMocks();
  stored = { id: 'a', setId: 's', title: 'Bài luyện', hsk: 1, skill: 'reading', status: 'in_progress', version: 0,
    startedAt: new Date().toISOString(), serverNow: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
    answers: {}, flagged: [], questions: [{ id: 'q1', type: 'choice', prompt: 'Chọn', options: [{ id: 'a', text: 'Đáp án A' }, { id: 'b', text: 'Đáp án B' }] }] };
  api.getPracticeAttempt.mockImplementation(async () => snapshot());
  api.savePractice.mockImplementation(async (_id: string, input: AttemptAnswers) => persist(input));
  api.submitPractice.mockImplementation(async (_id: string, input: AttemptAnswers) => {
    if (Date.now() < Date.parse(stored.expiresAt)) persist(input);
    stored = { ...stored, status: 'submitted', score: stored.answers.q1 === 'a' ? 100 : 0, correctCount: stored.answers.q1 === 'a' ? 1 : 0, rewardXp: 0 };
    return snapshot();
  });
});
afterEach(() => { cleanup(); routers.splice(0).forEach(r => r.dispose()); clients.splice(0).forEach(c => c.clear()); vi.useRealTimers(); });
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const router = createMemoryRouter([
    { path: '/exam', element: <><Link to="/feed">Trang chủ</Link><PracticeSession id="a" onBack={() => void router.navigate('/feed')} /></> },
    { path: '/feed', element: <p>Đã về trang chủ</p> },
  ], { initialEntries: ['/feed', '/exam'], initialIndex: 1 });
  routers.push(router);
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
  await act(async () => {});
  return router;
}
const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

it('waits for all edits, including those made during an earlier save, before sidebar navigation', async () => {
  const releases: Array<() => void> = [];
  api.savePractice.mockImplementation((_id: string, input: AttemptAnswers) => new Promise(resolve => releases.push(() => resolve(persist(input)))));
  await mount();
  fireEvent.click(screen.getByLabelText('Đáp án A'));
  fireEvent.click(screen.getByLabelText('Đáp án B'));
  fireEvent.click(screen.getByRole('link', { name: 'Trang chủ' }));
  expect(screen.queryByText('Đã về trang chủ')).toBeNull();
  await act(async () => releases.shift()!());
  expect(api.savePractice).toHaveBeenCalledTimes(2);
  expect(api.savePractice.mock.calls[1][1]).toMatchObject({ version: 1, answers: { q1: 'b' } });
  expect(screen.queryByText('Đã về trang chủ')).toBeNull();
  await act(async () => releases.shift()!());
  expect(screen.getByText('Đã về trang chủ')).toBeTruthy();
  expect(stored.answers.q1).toBe('b');
});

it('also protects browser back navigation', async () => {
  let release!: () => void;
  api.savePractice.mockImplementation((_id: string, input: AttemptAnswers) => new Promise(resolve => { release = () => resolve(persist(input)); }));
  const router = await mount();
  fireEvent.click(screen.getByLabelText('Đáp án A'));
  await act(async () => { await router.navigate(-1); });
  expect(screen.queryByText('Đã về trang chủ')).toBeNull();
  await act(async () => release());
  expect(screen.getByText('Đã về trang chủ')).toBeTruthy();
});

it('stays on the attempt and retains the answer when saving before navigation fails', async () => {
  api.savePractice.mockRejectedValue(new TypeError('Mất mạng'));
  await mount();
  fireEvent.click(screen.getByLabelText('Đáp án A'));
  fireEvent.click(screen.getByRole('link', { name: 'Trang chủ' }));
  await act(async () => {});
  expect(screen.queryByText('Đã về trang chủ')).toBeNull();
  expect((screen.getByLabelText('Đáp án A') as HTMLInputElement).checked).toBe(true);
  expect(screen.getByRole('alert').textContent).toContain('Mất mạng');
});

it.each(['choice', 'short_answer'] as const)('saves %s answers selected 500ms before expiry', async type => {
  stored.questions[0].type = type;
  await mount();
  await tick(59_500);
  if (type === 'choice') fireEvent.click(screen.getByLabelText('Đáp án A'));
  else fireEvent.change(screen.getByLabelText('Câu trả lời'), { target: { value: 'a' } });
  await tick(500);
  expect(stored.answers).toEqual({ q1: 'a' });
  expect(screen.getByText(/100% · 1\/1 câu đúng/)).toBeTruthy();
});

it('recovers a failed save when the connection returns', async () => {
  api.savePractice.mockRejectedValueOnce(new TypeError('Mất mạng'));
  await mount();
  fireEvent.click(screen.getByLabelText('Đáp án A'));
  await act(async () => {});
  expect(screen.getByRole('alert')).toBeTruthy();
  await act(async () => { window.dispatchEvent(new Event('online')); });
  expect(stored.answers).toEqual({ q1: 'a' });
  expect(screen.queryByRole('alert')).toBeNull();
});

it('submits on expiry even after saving failed, without silently counting late answers', async () => {
  api.savePractice.mockRejectedValue(new TypeError('Mất mạng'));
  await mount();
  fireEvent.click(screen.getByLabelText('Đáp án A'));
  await tick(60_000);
  expect(api.submitPractice).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/0% · 0\/1 câu đúng/)).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('chưa tới máy chủ');
});

it('retries a failed automatic submission with backoff', async () => {
  api.submitPractice.mockRejectedValueOnce(new TypeError('Mất mạng'));
  await mount();
  await tick(60_000);
  expect(api.submitPractice).toHaveBeenCalledTimes(1);
  await tick(1750);
  expect(api.submitPractice).toHaveBeenCalledTimes(1);
  await tick(250);
  expect(api.submitPractice).toHaveBeenCalledTimes(2);
  expect(screen.getByText(/0% · 0\/1 câu đúng/)).toBeTruthy();
});

it('does not repeatedly overwrite a stale version from another tab', async () => {
  api.savePractice.mockRejectedValue(new ApiRequestError(409, 'ATTEMPT_CHANGED', 'Bài đã thay đổi'));
  await mount();
  fireEvent.click(screen.getByLabelText('Đáp án A'));
  await tick(10_000);
  await act(async () => { window.dispatchEvent(new Event('online')); });
  expect(api.savePractice).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('alert').textContent).toContain('Bài đã thay đổi');
});

it('does not extend the clock by the response delivery time', async () => {
  let release!: () => void;
  const response = snapshot();
  api.getPracticeAttempt.mockImplementation(() => new Promise(resolve => { release = () => resolve(response); }));
  await mount();
  await tick(1000);
  await act(async () => release());
  expect(screen.getByRole('timer').textContent).toBe('0:59');
});
