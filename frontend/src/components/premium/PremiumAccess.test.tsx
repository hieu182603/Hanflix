import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { PremiumAccessProvider, PremiumGate } from './PremiumAccess';

afterEach(() => { cleanup(); vi.useRealTimers(); });
function View({ expiry, role = 'user' }: { expiry?: string; role?: string }) {
  return <MemoryRouter><PremiumAccessProvider user={{ role, premiumExpiresAt: expiry }}>
    <PremiumGate><p>Protected learning content</p></PremiumGate>
  </PremiumAccessProvider></MemoryRouter>;
}
it('shows an upgrade link for Free and opens the feature after a confirmed upgrade', () => {
  const view = render(<View />);
  expect(screen.queryByText('Protected learning content')).toBeNull();
  expect(screen.getByRole('link', { name: 'Nâng cấp ngay' }).getAttribute('href')).toBe('/premium');
  view.rerender(<View expiry={new Date(Date.now() + 60000).toISOString()} />);
  expect(screen.getByText('Protected learning content')).toBeTruthy();
});
it('locks an open feature exactly at expiry even when offline', () => {
  vi.useFakeTimers();
  render(<View expiry={new Date(Date.now() + 1000).toISOString()} />);
  expect(screen.getByText('Protected learning content')).toBeTruthy();
  act(() => vi.advanceTimersByTime(1001));
  expect(screen.queryByText('Protected learning content')).toBeNull();
  expect(screen.getByRole('link', { name: 'Nâng cấp ngay' })).toBeTruthy();
});
it('keeps admin preview access without a paid subscription', () => {
  render(<View role="admin" />);
  expect(screen.getByText('Protected learning content')).toBeTruthy();
});
