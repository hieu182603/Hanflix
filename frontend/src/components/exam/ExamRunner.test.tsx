import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HskExam, ExamResult } from '../../data/hskExamData';
import { submitExam } from '../../services/exam.service';
import ExamRunner from './ExamRunner';
import ExamResultView from './ExamResultView';
import { examStorageKeys } from './exam-storage';

vi.mock('../../services/exam.service', () => ({ submitExam: vi.fn() }));
vi.mock('../../i18n', () => ({ useI18n: () => ({ tr: (text: string) => text, locale: 'vi' }) }));
vi.mock('./useAntiCheat', () => ({ useAntiCheat: () => ({ warningMessage: null, dismissWarning: vi.fn() }) }));
const question = { id: 'q1', order: 1, type: 'single_choice' as const, skill: 'reading' as const, part: 1, instruction: 'Chọn đáp án', promptText: '去哪儿？', options: ['A. 北京', 'B. 上海'] };
const exam: HskExam = {
  id: 'exam-id', code: 'DEMO', title: 'HSK demo', level: 1, category: 'skill_reading', durationMinutes: 1,
  totalQuestions: 1, totalScore: 100, passingScore: 60, description: '', attemptCount: 0,
  sections: [{ skill: 'reading', title: 'Đọc', totalQuestions: 1, durationMinutes: 1, instructions: '', questions: [question] }],
};
const result: ExamResult = {
  id: 'attempt-id', exam, answers: { q1: 'A. 北京' }, score: 100, listeningScore: 0, readingScore: 100,
  writingScore: 0, totalScore: 100, passingScore: 60, isPassed: true, timeSpentSeconds: 60, submittedAt: '2026-09-30T00:00:00Z',
  questionResults: [{ question: { ...question, correctAnswer: 'A', explanationVi: 'Đi Bắc Kinh.' }, userAns: 'A. 北京', isCorrect: true }],
};
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-30T00:00:00Z'));
  vi.mocked(submitExam).mockReset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('server-submitted exams', () => {
  it('restarts synthesized speech and ignores completion of the cancelled utterance', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
    const speak = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel });
    const listeningQuestion = { ...question, skill: 'listening' as const, dialogue: [{ speaker: '男', text: '你好' }] };
    render(<ExamRunner exam={{ ...exam, sections: [{ ...exam.sections[0], skill: 'listening', questions: [listeningQuestion] }] }} onExit={vi.fn()} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Bấm để nghe audio đoạn hội thoại'));
    const previous = speak.mock.calls[0][0];
    fireEvent.click(screen.getByTitle('Nghe lại từ đầu'));
    expect(speak).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalled();
    await act(async () => { previous.onend(); await vi.advanceTimersByTimeAsync(500); });
    expect(screen.getByTitle('Tạm dừng audio')).toBeTruthy();
  });
  it('hides listening scripts and translations while replay restarts a playing recording', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const listeningQuestion = { ...question, skill: 'listening' as const, audioUrl: 'https://example.test/listening.mp3',
      dialogue: [{ speaker: '男', text: 'SECRET LISTENING SCRIPT' }], translationVi: 'SECRET TRANSLATION' };
    try {
      const view = render(<ExamRunner exam={{ ...exam, category: 'full_mock', sections: [
        { ...exam.sections[0], skill: 'listening', questions: [listeningQuestion] },
      ] }} onExit={vi.fn()} onFinish={vi.fn()} />);
      expect(screen.queryByText('SECRET LISTENING SCRIPT')).toBeNull();
      expect(screen.queryByText(/SECRET TRANSLATION/)).toBeNull();
      fireEvent.click(screen.getByTitle('Bấm để nghe audio đoạn hội thoại'));
      const audio = view.container.querySelector('audio')!;
      audio.currentTime = 25;
      fireEvent.click(screen.getByTitle('Nghe lại từ đầu'));
      expect(pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(0);
      expect(play).toHaveBeenCalledTimes(2);
    } finally { play.mockRestore(); pause.mockRestore(); }
  });
  it('submits the latest answer on expiry and clears storage only after success', async () => {
    const finish = vi.fn();
    vi.mocked(submitExam).mockResolvedValue(result);
    render(<ExamRunner exam={exam} onExit={vi.fn()} onFinish={finish} />);
    fireEvent.click(screen.getByText('A. 北京'));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(submitExam).toHaveBeenCalledWith('exam-id', { answers: { q1: 'A. 北京' }, timeSpentSeconds: 60 }, expect.any(String));
    expect(submitExam).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledWith(result);
    expect(localStorage.getItem(examStorageKeys(exam.id).sessionKey)).toBeNull();
  });
  it('retains and restores a failed submission, retrying the same frozen payload and key', async () => {
    vi.mocked(submitExam).mockRejectedValueOnce(new Error('Mất kết nối'));
    const view = render(<ExamRunner exam={exam} onExit={vi.fn()} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByText('B. 上海'));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.getByRole('alert').textContent).toBe('Mất kết nối');
    expect(localStorage.getItem(examStorageKeys(exam.id).sessionKey)).toContain('B. 上海');
    const firstCall = vi.mocked(submitExam).mock.calls[0];
    view.unmount();
    vi.mocked(submitExam).mockResolvedValueOnce(result);
    const finish = vi.fn();
    render(<ExamRunner exam={exam} onExit={vi.fn()} onFinish={finish} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Thử nộp lại' })); });
    expect(vi.mocked(submitExam).mock.calls[1]).toEqual(firstCall);
    expect(finish).toHaveBeenCalledWith(result);
  });
  it('does not restore another account’s answers', () => {
    localStorage.setItem('hanflix_user', JSON.stringify({ id: 'user-one' }));
    const firstKey = examStorageKeys(exam.id).sessionKey;
    localStorage.setItem(firstKey, JSON.stringify({ examId: exam.id, startedAt: Date.now(), answers: { q1: 'A. 北京' }, currentIndex: 0, flaggedIds: [] }));
    localStorage.setItem('hanflix_user', JSON.stringify({ id: 'user-two' }));
    render(<ExamRunner exam={exam} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(localStorage.getItem(examStorageKeys(exam.id).sessionKey)).toContain('"answers":{}');
  });
  it('uses server correctness for review instead of recalculating in the browser', () => {
    const serverResult = { ...result, questionResults: result.questionResults.map(item => ({ ...item, isCorrect: false })) };
    render(<ExamResultView submission={serverResult} onRetake={vi.fn()} onBackToList={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Câu sai/ }).textContent).toContain('1');
    expect(screen.getByRole('button', { name: /Câu đúng/ }).textContent).toContain('0');
  });
});
