import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../api/billing', () => ({ activateAdminUserPremium: vi.fn(), getAdminBillingPlans: vi.fn(), getAdminUserGrants: vi.fn() }));
import { activateAdminUserPremium, getAdminBillingPlans, getAdminUserGrants } from '../../api/billing';
import AdminPremiumActivation from './AdminPremiumActivation';
const user = { _id: 'learner', name: 'Học viên', email: 'test@example.test', role: 'user' as const, status: 'active' as const };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getAdminBillingPlans).mockResolvedValue({ items: [{ code: 'monthly', durationMonths: 1, name: '1 tháng' }, { code: 'yearly', durationMonths: 12, name: '1 năm' }] } as never);
  vi.mocked(getAdminUserGrants).mockResolvedValue({ premiumExpiresAt: null, items: [] });
});
afterEach(cleanup);
function view(status: 'active' | 'locked' = 'active') {
  const activated = vi.fn();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <AdminPremiumActivation user={{ ...user, status }} onActivated={activated} />
  </QueryClientProvider>);
  return activated;
}
it('requires a reason and retains the request key when retrying a failed activation', async () => {
  const activated = view();
  await screen.findByRole('option', { name: '12 tháng — 1 năm' });
  const button = screen.getByRole('button', { name: 'Kích hoạt gói cho người dùng' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Gói kích hoạt'), { target: { value: 'yearly' } });
  fireEvent.change(screen.getByLabelText('Lý do kích hoạt'), { target: { value: 'Hỗ trợ học viên' } });
  vi.mocked(activateAdminUserPremium).mockRejectedValueOnce(new Error('Mất kết nối'));
  fireEvent.click(button);
  await screen.findByRole('alert');
  const expiry = '2027-09-29T00:00:00Z';
  vi.mocked(activateAdminUserPremium).mockResolvedValueOnce({ premiumExpiresAt: expiry } as never);
  fireEvent.click(button);
  await waitFor(() => expect(activated).toHaveBeenCalledWith(expiry));
  const calls = vi.mocked(activateAdminUserPremium).mock.calls;
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual(['learner', { planCode: 'yearly', reason: 'Hỗ trợ học viên' }, expect.any(String)]);
  expect(calls[1][2]).toBe(calls[0][2]);
  expect((screen.getByLabelText('Lý do kích hoạt') as HTMLTextAreaElement).value).toBe('');
});
it('blocks duplicate clicks while a request is pending', async () => {
  view();
  await screen.findByRole('option', { name: '1 tháng — 1 tháng' });
  vi.mocked(activateAdminUserPremium).mockReturnValue(new Promise(() => {}));
  fireEvent.change(screen.getByLabelText('Lý do kích hoạt'), { target: { value: 'Tặng gói' } });
  const button = screen.getByRole('button', { name: 'Kích hoạt gói cho người dùng' });
  fireEvent.click(button); fireEvent.click(button);
  expect(activateAdminUserPremium).toHaveBeenCalledTimes(1);
  expect((screen.getByRole('button', { name: 'Đang kích hoạt…' }) as HTMLButtonElement).disabled).toBe(true);
});
it('does not offer activation for locked users', () => {
  view('locked');
  expect(screen.queryByRole('button', { name: 'Kích hoạt gói cho người dùng' })).toBeNull();
});
