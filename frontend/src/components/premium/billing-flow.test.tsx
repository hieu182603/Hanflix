import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../api/billing', () => ({ getBillingPlans: vi.fn(), getUserSubscription: vi.fn(), getUserOrders: vi.fn(), getOrderDetails: vi.fn(), createCheckout: vi.fn(), cancelOrder: vi.fn() }));
import { getBillingPlans, getUserSubscription, getUserOrders, getOrderDetails, createCheckout } from '../../api/billing';
import PremiumPricingPage from './PremiumPricingPage';
import PaymentReturnPage from './PaymentReturnPage';
import PaymentHistoryPage from './PaymentHistoryPage';
const monthly = { code: 'monthly', durationMonths: 1, price: 120000, name: '1 tháng', savings: 0, pricePerMonth: 120000, approximatePricePerDay: 4000 };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getBillingPlans).mockResolvedValue({ plans: [monthly], benefits: ['Xem video'], paymentAvailable: true } as never);
  vi.mocked(getUserSubscription).mockResolvedValue({ tier: 'free', premiumExpiresAt: null, benefits: [] });
  vi.mocked(getUserOrders).mockResolvedValue({ items: [], total: 0, page: 1, limit: 10,
    summary: { totalOrders: 0, paidOrders: 0, pendingOrders: 0, otherOrders: 0, totalSpent: 0 } });
});
afterEach(cleanup);
function view(component: React.ReactNode, path = '/premium') {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}>{component}</MemoryRouter>
  </QueryClientProvider>);
}
it('shows current prices and never invents a disabled package', async () => {
  view(<PremiumPricingPage />);
  await screen.findByText('120.000 đ');
  expect(screen.queryByText('99.000 đ')).toBeNull();
  expect(screen.getAllByRole('button', { name: 'Nâng cấp ngay' })).toHaveLength(1);
  expect(screen.getByText(/4.000 đ\/ngày/)).toBeTruthy();
});
it('disables checkout when payment is not configured', async () => {
  vi.mocked(getBillingPlans).mockResolvedValue({ plans: [monthly], benefits: [], paymentAvailable: false } as never);
  view(<PremiumPricingPage />);
  const button = await screen.findByRole('button', { name: 'Nâng cấp ngay' });
  expect((button as HTMLButtonElement).disabled).toBe(true);
});
it('does not display default prices after a failed plans request', async () => {
  vi.mocked(getBillingPlans).mockRejectedValue(new Error('offline'));
  view(<PremiumPricingPage />);
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'Nâng cấp ngay' })).toBeNull();
});
it('ignores a forged PAID return URL and loads the owner-checked API status', async () => {
  vi.mocked(getOrderDetails).mockResolvedValue({ orderCode: 123, status: 'CANCELLED', expiresAt: new Date().toISOString() } as never);
  view(<PaymentReturnPage />, '/premium/payment?orderCode=123&status=PAID&cancel=false');
  await screen.findByText('Đơn hàng đã được hủy');
  expect(getOrderDetails).toHaveBeenCalledWith(123, expect.any(AbortSignal));
  expect(createCheckout).not.toHaveBeenCalled();
  expect(screen.queryByText(/Thanh toán thành công/)).toBeNull();
});
it('rejects invalid return codes without requesting or creating a payment', () => {
  view(<PaymentReturnPage />, '/premium/payment?orderCode=123abc');
  expect(screen.getByText('Không tìm thấy mã đơn thanh toán')).toBeTruthy();
  expect(getOrderDetails).not.toHaveBeenCalled();
  expect(createCheckout).not.toHaveBeenCalled();
});
it('lets a Free user reopen a pending order from history', async () => {
  vi.mocked(getUserOrders).mockResolvedValue({ items: [{ orderCode: 123, status: 'PENDING', planName: '1 tháng', amount: 120000, createdAt: new Date().toISOString() }], total: 1, page: 1, limit: 10 } as never);
  view(<PaymentHistoryPage />);
  const link = await screen.findByRole('link', { name: /Thanh toán ngay/i });
  expect(link.getAttribute('href')).toBe('/premium/payment?orderCode=123');
});
it('refreshes the price and asks for a new choice when the selected price changes', async () => {
  view(<PremiumPricingPage />);
  await screen.findByText('120.000 đ');
  vi.mocked(getBillingPlans).mockResolvedValue({ plans: [{ ...monthly, price: 130000 }], benefits: [], paymentAvailable: true } as never);
  act(() => { window.dispatchEvent(new Event('hanflix:billing-plans-updated')); });
  await screen.findByText('130.000 đ');
  expect(screen.getByText(/Gói hoặc giá vừa thay đổi/)).toBeTruthy();
  expect(createCheckout).not.toHaveBeenCalled();
});

it('renders the client pricing brief with equal benefits and the quarterly emphasis', async () => {
  const benefits = ['Xem video học không giới hạn', 'Phụ đề Chữ Hán – Pinyin – Tiếng Việt',
    'Tra cứu và lưu từ vựng trực tiếp trong video', 'Mở khóa toàn bộ quiz/bài luyện tập',
    'AI cá nhân hóa & đề xuất nội dung', 'Theo dõi tiến độ học tập', 'Kho từ vựng & Flashcard', 'Kho ngữ pháp'];
  vi.mocked(getBillingPlans).mockResolvedValue({ benefits, paymentAvailable: true, plans: [
    { ...monthly, price: 99000, pricePerMonth: 99000, approximatePricePerDay: 3300 },
    { ...monthly, code: 'quarterly', name: '3 tháng', price: 249000, pricePerMonth: 83000, savings: 48000, savingsPercent: 16 },
    { ...monthly, code: 'yearly', name: '1 năm', price: 699000, pricePerMonth: 58250, savings: 489000, savingsPercent: 41 },
  ] } as never);
  const { container } = view(<PremiumPricingPage />);
  await screen.findByText('249.000 đ');
  for (const benefit of benefits) expect(screen.getAllByText(benefit).length).toBeGreaterThan(0);
  expect(screen.getByText('99.000 đ')).toBeTruthy();
  expect(screen.getByText('699.000 đ')).toBeTruthy();
  expect(screen.getByText('83.000 đ/tháng')).toBeTruthy();
  expect(screen.getByText('58.250 đ/tháng')).toBeTruthy();
  expect(screen.getByText('Tiết kiệm 48.000 đ (~16%)')).toBeTruthy();
  expect(screen.getByText('Tiết kiệm 489.000 đ (~41%)')).toBeTruthy();
  expect(container.querySelector('[data-plan="quarterly"]')?.className).toContain('border-[#B91B1C]');
  expect(container.querySelector('[data-plan="yearly"]')?.className).not.toContain('border-[#B91B1C]');
  expect(getUserSubscription).not.toHaveBeenCalled();
});
