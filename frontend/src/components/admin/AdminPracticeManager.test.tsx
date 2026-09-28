import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPracticeManager from './AdminPracticeManager';

const api = vi.hoisted(() => ({ getAdminPracticeSets: vi.fn(), saveAdminPracticeSet: vi.fn() }));
vi.mock('../../api/practice', async original => ({ ...await original<object>(), ...api }));
let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  api.getAdminPracticeSets.mockResolvedValue({ items: [], totalPages: 1 });
  api.saveAdminPracticeSet.mockImplementation(async input => ({ ...input, _id: 's1', revision: 1 }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AdminPracticeManager /></QueryClientProvider>);
});
afterEach(() => { cleanup(); client.clear(); });

it('lets the draft submitter bypass incomplete question fields and saves them as draft', async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Tạo bộ luyện' }));
  fireEvent.change(screen.getByLabelText('Tên bộ luyện'), { target: { value: 'Bản nháp nghe' } });
  fireEvent.change(screen.getByLabelText('Kỹ năng'), { target: { value: 'listening' } });
  const draft = screen.getByRole('button', { name: 'Lưu bản nháp / Ẩn' }) as HTMLButtonElement;
  expect(draft.formNoValidate).toBe(true);
  expect(draft.form!.checkValidity()).toBe(false);
  fireEvent.submit(draft.form!, { submitter: draft });
  await waitFor(() => expect(api.saveAdminPracticeSet).toHaveBeenCalledWith(expect.objectContaining({
    status: 'draft', skill: 'listening', questions: [expect.objectContaining({ prompt: '', explanation: '' })],
  }), undefined));
});

it('still requires complete fields when publishing', () => {
  fireEvent.click(screen.getByRole('button', { name: 'Tạo bộ luyện' }));
  fireEvent.change(screen.getByLabelText('Tên bộ luyện'), { target: { value: 'Bản nháp nghe' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Duyệt xuất bản' }));
  expect(api.saveAdminPracticeSet).not.toHaveBeenCalled();
});
