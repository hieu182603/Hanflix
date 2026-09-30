import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getUserOrders, getUserSubscription, type PaymentOrder } from '../../api/billing';
import PaymentHistoryPage from './PaymentHistoryPage';

vi.mock('../../api/billing', () => ({ getUserOrders: vi.fn(), getUserSubscription: vi.fn() }));
const summary = { totalOrders: 14, paidOrders: 13, pendingOrders: 1, otherOrders: 0, totalSpent: 1287000 };
const order = (code: number): PaymentOrder => ({ orderCode: code, planCode: 'monthly', planName: 'Cơ bản',
  durationMonths: 1, amount: 99000, currency: 'VND', status: 'PAID', checkoutUrl: null,
  expiresAt: '2026-10-01', paidAt: '2026-09-01', premiumExpiresAt: '2026-10-01', createdAt: '2026-09-01' });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getUserSubscription).mockResolvedValue({ tier: 'free', premiumExpiresAt: null, benefits: [] });
  vi.mocked(getUserOrders).mockImplementation(async (params) => {
    const filtered = Boolean(params?.search || params?.status !== 'ALL');
    return { items: filtered || params?.page === 2 ? [order(10013)] : [order(10001)],
      total: filtered ? 1 : 14, page: params?.page ?? 1, limit: 12, summary };
  });
});
afterEach(cleanup);
function show() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><PaymentHistoryPage /></MemoryRouter>
  </QueryClientProvider>);
}
it('keeps lifetime totals across pages and searches older orders from page one', async () => {
  show();
  await screen.findByText('1.287.000 đ');
  expect(screen.getByRole('button', { name: 'Tất cả (14)' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Đã thanh toán (13)' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await waitFor(() => expect(getUserOrders).toHaveBeenLastCalledWith(
    { page: 2, limit: 12, status: 'ALL', search: '' }, expect.any(AbortSignal)));
  await screen.findByText('1.287.000 đ');
  fireEvent.change(screen.getByPlaceholderText('Tìm mã đơn hoặc gói...'), { target: { value: '#10013' } });
  await waitFor(() => expect(getUserOrders).toHaveBeenLastCalledWith(
    { page: 1, limit: 12, status: 'ALL', search: '#10013' }, expect.any(AbortSignal)));
  await screen.findByText('1.287.000 đ');
  expect(screen.queryByRole('button', { name: 'Trang sau' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Đã thanh toán (13)' })).toBeTruthy();
});
it('resets pagination and sends the status filter to the server', async () => {
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Trang sau' }));
  await screen.findByText('1.287.000 đ');
  fireEvent.click(screen.getByRole('button', { name: 'Đã thanh toán (13)' }));
  await waitFor(() => expect(getUserOrders).toHaveBeenLastCalledWith(
    { page: 1, limit: 12, status: 'PAID', search: '' }, expect.any(AbortSignal)));
  await screen.findByText('1.287.000 đ');
  expect(screen.queryByRole('button', { name: 'Trang sau' })).toBeNull();
});
