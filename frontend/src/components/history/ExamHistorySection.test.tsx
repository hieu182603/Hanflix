import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fetchMyExamHistory, fetchExamAttempt } from '../../services/exam.service';
import ExamHistorySection from './ExamHistorySection';

vi.mock('../../services/exam.service', () => ({ fetchMyExamHistory: vi.fn(), fetchExamAttempt: vi.fn() }));
vi.mock('../exam/ExamResultView', () => ({ default: ({ submission, onBackToList }: { submission: { id: string }; onBackToList: () => void }) =>
  <button onClick={onBackToList}>Result {submission.id}</button> }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchMyExamHistory).mockResolvedValue({ items: [{ id: 'saved-attempt', examCode: 'H31001', level: 3,
    submittedAt: '2026-09-30T10:00:00Z', score: 200, totalScore: 300, timeSpentSeconds: 120 }], page: 1, limit: 20, total: 1 } as never);
  vi.mocked(fetchExamAttempt).mockResolvedValue({ id: 'saved-attempt' } as never);
});
afterEach(cleanup);
it('loads server history and opens the immutable result after remounting', async () => {
  const view = render(<ExamHistorySection onNavigateLesson={vi.fn()} />);
  await screen.findByText('HSK 3 · H31001');
  view.unmount();
  render(<ExamHistorySection onNavigateLesson={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Xem kết quả' }));
  await screen.findByText('Result saved-attempt');
  expect(fetchExamAttempt).toHaveBeenCalledWith('saved-attempt');
  fireEvent.click(screen.getByText('Result saved-attempt'));
  expect(screen.queryByText('Result saved-attempt')).toBeNull();
  fireEvent(window, new CustomEvent('hanflix:activity-updated', { detail: { source: 'practice' } }));
  await waitFor(() => expect(fetchMyExamHistory).toHaveBeenCalledTimes(3));
});
it('shows a retryable history error', async () => {
  vi.mocked(fetchMyExamHistory).mockRejectedValueOnce(new Error('offline'));
  render(<ExamHistorySection onNavigateLesson={vi.fn()} />);
  expect((await screen.findByRole('alert')).textContent).toContain('offline');
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await screen.findByText('HSK 3 · H31001');
});
