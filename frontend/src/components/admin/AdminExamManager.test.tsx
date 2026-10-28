import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NotificationProvider } from '../notifications';
import AdminExamManager from './AdminExamManager';
import { normalizeExam, retypeQuestion } from './AdminExamEditorModal';
import type { AdminExamDetail } from '../../api/exams';

const api = vi.hoisted(() => ({
  getAdminExamStats: vi.fn(),
  getAdminExamList: vi.fn(),
  getAdminExam: vi.fn(),
  createAdminExam: vi.fn(),
  updateAdminExam: vi.fn(),
  setAdminExamPublished: vi.fn(),
  deleteAdminExam: vi.fn(),
  generateAdminExam: vi.fn(),
}));
vi.mock('../../api/exams', async original => ({ ...await original<object>(), ...api }));

const detail: AdminExamDetail = {
  id: 'e1', code: 'H11001', title: 'HSK 1 — Đề mẫu', level: 1, category: 'mini_test',
  durationMinutes: 15, totalQuestions: 2, totalScore: 200, passingScore: 120, description: '',
  isPublished: true, attemptCount: 3,
  sections: [
    { skill: 'listening', title: 'Nghe', totalQuestions: 1, durationMinutes: 5, instructions: 'Nghe', questions: [
      { id: 'q1', order: 1, type: 'single_choice', skill: 'listening', part: 1, instruction: 'Chọn', promptText: '喝什么？', options: ['茶', '水'], correctAnswer: 'A', explanationVi: 'Trà' },
    ] },
    { skill: 'reading', title: 'Đọc', totalQuestions: 1, durationMinutes: 5, instructions: 'Đọc', questions: [
      { id: 'q2', order: 2, type: 'true_false', skill: 'reading', part: 1, instruction: 'Đúng sai', promptText: '现在是晚上。', correctAnswer: 'False', explanationVi: 'Buổi sáng' },
    ] },
  ],
};
const { sections: _sections, ...summary } = detail;

const renderManager = () => render(<NotificationProvider><AdminExamManager /></NotificationProvider>);

beforeEach(() => {
  vi.resetAllMocks();
  api.getAdminExamStats.mockResolvedValue({ total: 1, totalAttempts: 3, published: 1, draft: 0, byLevel: { 1: 1 } });
  api.getAdminExamList.mockResolvedValue({ items: [summary], pagination: { page: 1, limit: 8, total: 1, totalPages: 1 } });
  api.getAdminExam.mockResolvedValue(detail);
  api.updateAdminExam.mockResolvedValue(summary);
  api.createAdminExam.mockResolvedValue(summary);
  api.deleteAdminExam.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('AdminExamManager', () => {
  it('opens the full exam in the editor and saves the edited document', async () => {
    renderManager();
    fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa đề H11001' }));
    const dialog = await screen.findByRole('dialog');
    expect(api.getAdminExam).toHaveBeenCalledWith('e1');
    fireEvent.change(within(dialog).getByPlaceholderText('HSK 3 — Đề luyện số 2'), { target: { value: 'Tên mới' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Chọn B là đáp án đúng' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(api.updateAdminExam).toHaveBeenCalledTimes(1));
    const [id, payload] = api.updateAdminExam.mock.calls[0]!;
    expect(id).toBe('e1');
    expect(payload).toMatchObject({ title: 'Tên mới', totalQuestions: 2, totalScore: 200 });
    expect(payload.sections[0].questions[0].correctAnswer).toBe('B');
    expect(payload).not.toHaveProperty('attemptCount');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('restores a question’s options when switching type and back', async () => {
    renderManager();
    fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa đề H11001' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đúng / Sai' }));
    expect(within(dialog).queryByLabelText('Lựa chọn A')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Trắc nghiệm' }));
    expect((within(dialog).getByLabelText('Lựa chọn A') as HTMLInputElement).value).toBe('茶');
    expect(within(dialog).getByDisplayValue('Chọn')).toBeTruthy();
  });

  it('blocks saving an incomplete new exam', async () => {
    renderManager();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo Đề Thi Mới' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo đề thi' }));
    expect(api.createAdminExam).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/vấn đề cần xử lý/)).toBeTruthy();
  });

  it('deletes only after confirmation', async () => {
    renderManager();
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa đề H11001' }));
    expect(await screen.findByText(/đã có 3 lượt làm/)).toBeTruthy();
    expect(api.deleteAdminExam).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa đề' }));
    await waitFor(() => expect(api.deleteAdminExam).toHaveBeenCalledWith('e1'));
  });
});

describe('AI exam generation', () => {
  it('sends the chosen settings and opens the unsaved draft for review', async () => {
    const { id: _id, attemptCount: _a, ...draft } = detail;
    api.generateAdminExam.mockResolvedValue({
      exam: { ...draft, code: 'AI-H1-261028-01', isPublished: false },
      references: [{ id: 'e1', code: 'H11001', title: detail.title, level: 1 }],
      warnings: ['Đọc (阅读): chỉ tạo được 1/2 câu hợp lệ'],
    });
    renderManager();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo Đề Bằng AI' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('HSK 1 — Đề mẫu');
    fireEvent.change(within(dialog).getByLabelText('Cấp độ HSK'), { target: { value: '1' } });
    fireEvent.change(within(dialog).getByLabelText('Chủ đề ưu tiên (tùy chọn)'), { target: { value: 'đồ uống' } });
    fireEvent.click(within(dialog).getByLabelText('Tự động chọn đề tham khảo'));
    fireEvent.click(within(dialog).getByRole('button', { name: /H11001/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo đề bằng AI' }));
    await waitFor(() => expect(api.generateAdminExam).toHaveBeenCalledWith({
      level: 1, category: 'mini_test', skills: ['listening', 'reading'], questionsPerSection: 5,
      referenceExamIds: ['e1'], topic: 'đồ uống',
    }, expect.any(AbortSignal)));
    const editor = await screen.findByRole('dialog', { name: /Tạo Đề Thi Mới/ });
    expect(within(editor).getByText(/Bản nháp do Panda AI soạn/)).toBeTruthy();
    expect(within(editor).getByText(/chỉ tạo được 1\/2 câu/)).toBeTruthy();
    expect(api.createAdminExam).not.toHaveBeenCalled();
  });
});

describe('retypeQuestion', () => {
  const base = detail.sections[1]!.questions[0]!;
  it('keeps content that fits the new type', () => {
    const blank = { ...base, type: 'fill_in_blank' as const, instruction: 'Xác định đúng hoặc sai.', options: undefined, correctAnswer: '本' };
    expect(retypeQuestion(blank, 'single_choice')).toMatchObject({ options: ['本', '', ''], correctAnswer: 'A', instruction: 'Chọn đáp án phù hợp nhất.' });
    const choice = { ...base, type: 'single_choice' as const, instruction: 'Đọc kỹ rồi chọn', options: ['本', '个'], correctAnswer: 'B' };
    expect(retypeQuestion(choice, 'fill_in_blank')).toMatchObject({ options: ['本', '个'], correctAnswer: '个', instruction: 'Đọc kỹ rồi chọn' });
  });
});

describe('normalizeExam', () => {
  it('derives counters and drops empty optional fields', () => {
    const { id: _id, attemptCount: _a, ...input } = detail;
    input.sections[1]!.questions[0]!.promptText = '  ';
    input.sections[0]!.questions[0]!.options = ['茶', '', '水'];
    const result = normalizeExam({ ...input, totalQuestions: 99, totalScore: 1 });
    expect(result.totalQuestions).toBe(2);
    expect(result.totalScore).toBe(200);
    expect(result.sections.map(s => s.questions[0]!.order)).toEqual([1, 2]);
    expect(result.sections[0]!.questions[0]!.options).toEqual(['茶', '水']);
    expect(result.sections[1]!.questions[0]).not.toHaveProperty('promptText');
  });
});
