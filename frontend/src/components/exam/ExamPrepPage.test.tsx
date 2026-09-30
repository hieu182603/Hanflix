import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HskExam, ExamResult } from '../../data/hskExamData';
import { fetchExams, fetchExamById, fetchMyExamHistory, fetchExamAttempt } from '../../services/exam.service';
import { examStorageKeys } from './exam-storage';
import { ExamPrepPage } from '../ExamPrepPage';

vi.mock('../../services/exam.service', () => ({ fetchExams: vi.fn(), fetchExamById: vi.fn(), fetchMyExamHistory: vi.fn(), fetchExamAttempt: vi.fn() }));
vi.mock('../../i18n', () => ({ useI18n: () => ({ tr: (text: string) => text, locale: 'vi' }) }));
vi.mock('../leaderboard/LeaderboardView', () => ({ default: () => null }));
vi.mock('./ExamRunner', () => ({ default: ({ exam, onFinish }: { exam: HskExam; onFinish: (result: ExamResult) => void }) => <button onClick={() => onFinish({ id: 'attempt', exam } as ExamResult)}>Finish {exam.code}</button> }));
vi.mock('./ExamResultView', () => ({ default: ({ onRetake }: { onRetake: () => void }) => <button onClick={onRetake}>Retake</button> }));
const metadata = { id: 'id-3', code: 'H31001', title: 'HSK 3 Sample', level: 3, category: 'mini_test' as const, totalQuestions: 1, durationMinutes: 10, totalScore: 100, passingScore: 60, description: 'Sample', attemptCount: 0 };
const exam: HskExam = { ...metadata, sections: [{ skill: 'reading', title: 'Đọc', totalQuestions: 1, durationMinutes: 10, instructions: '', questions: [{ id: 'q1', order: 1, part: 1, skill: 'reading', type: 'single_choice', instruction: 'Chọn', options: ['A', 'B'] }] }] };
beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  vi.mocked(fetchExams).mockResolvedValue([metadata]);
  vi.mocked(fetchExamById).mockResolvedValue(exam);
  vi.mocked(fetchMyExamHistory).mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 });
});
afterEach(cleanup);

describe('exam catalog API flow', () => {
  it('starts the selected skill and level instead of the general exam', async () => {
    const reading = { ...metadata, id: 'reading-3', code: 'READ3', category: 'skill_reading' as const };
    vi.mocked(fetchExams).mockResolvedValue([metadata, reading, { ...reading, id: 'reading-4', level: 4 }]);
    render(<ExamPrepPage />);
    await screen.findByText('READ3');
    fireEvent.click(screen.getByText('Làm bài đọc ngay'));
    await waitFor(() => expect(fetchExamById).toHaveBeenCalledWith('reading-3'));
  });
  it('does not substitute a full exam when the selected skill is unavailable', async () => {
    render(<ExamPrepPage />);
    await screen.findByRole('button', { name: /Vào phòng thi/ });
    fireEvent.click(screen.getByText('Làm bài nghe ngay'));
    expect(screen.getByRole('alert').textContent).toContain('Chưa có đề riêng');
    expect(fetchExamById).not.toHaveBeenCalled();
  });
  it('restores the saved result from the server after a page reload', async () => {
    localStorage.setItem('hanflix_user', JSON.stringify({ id: 'learner' }));
    localStorage.setItem(examStorageKeys().lastResultKey, 'saved-attempt');
    vi.mocked(fetchExamAttempt).mockResolvedValue({ id: 'saved-attempt', exam } as ExamResult);
    render(<ExamPrepPage />);
    await screen.findByRole('button', { name: 'Retake' });
    expect(fetchExamAttempt).toHaveBeenCalledWith('saved-attempt');
    expect(fetchExamById).not.toHaveBeenCalled();
  });
  it('starts a metadata-only exam by fetching details, and retakes with a fresh public fetch', async () => {
    render(<ExamPrepPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Vào phòng thi/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Finish H31001' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Retake' }));
    await screen.findByRole('button', { name: 'Finish H31001' });
    expect(fetchExamById).toHaveBeenNthCalledWith(1, 'id-3');
    expect(fetchExamById).toHaveBeenNthCalledWith(2, 'id-3');
  });
  it('shows an offline catalog without starting or grading a local exam', async () => {
    vi.mocked(fetchExams).mockRejectedValue(new Error('offline'));
    render(<ExamPrepPage />);
    await screen.findByText(/Đang hiển thị danh mục ngoại tuyến/);
    expect(screen.queryByRole('button', { name: /Vào phòng thi/ })).toBeNull();
    expect(fetchExamById).not.toHaveBeenCalled();
    expect(screen.getByText('H31001')).toBeTruthy();
  });
  it('shows a retryable detail error without entering an empty exam', async () => {
    vi.mocked(fetchExamById).mockRejectedValue(new Error('Không tải được đề'));
    render(<ExamPrepPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Vào phòng thi/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Không tải được đề'));
    expect(screen.queryByRole('button', { name: 'Finish H31001' })).toBeNull();
  });
});
