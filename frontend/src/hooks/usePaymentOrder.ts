import { useEffect, useRef, useState } from 'react';
import { cancelOrder, createCheckout, getOrderDetails, type PaymentOrder, type PremiumPlan } from '../api/billing';
import { getCachedUser } from '../api/auth';
import { checkoutRequest } from '../lib/billing-session';

const terminal = (status: PaymentOrder['status']) => ['PAID', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(status);
export function usePaymentOrder(isOpen: boolean, plan: PremiumPlan | undefined, orderCode: number | undefined, onSuccess: (order: PaymentOrder) => void) {
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isCancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [retryVersion, setRetryVersion] = useState(0);
  const successRef = useRef(onSuccess);
  successRef.current = onSuccess;
  const paidRef = useRef<number | null>(null);
  const cancelRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    let latest: PaymentOrder | null = null;
    let pollTimer: ReturnType<typeof setTimeout>;
    let requestVersion = 0;
    let cancelling = false;
    const checkout = plan && !orderCode ? checkoutRequest(getCachedUser()?.id ?? 'session', { planCode: plan.code, expectedPrice: plan.price }) : null;
    setLoading(true); setError(null); setOrder(null); setCancelling(false);
    const apply = (value: PaymentOrder) => {
      if (controller.signal.aborted) return;
      latest = value; setOrder(value); setError(null);
      setTimeLeft(Math.max(0, Math.ceil((Date.parse(value.expiresAt) - Date.now()) / 1000)));
      if (terminal(value.status)) checkout?.clear();
      if (value.status === 'PAID' && paidRef.current !== value.orderCode) {
        paidRef.current = value.orderCode;
        window.dispatchEvent(new Event('hanflix:subscription-updated'));
        successRef.current(value);
      }
    };
    const poll = async () => {
      if (!latest || terminal(latest.status) || controller.signal.aborted) return;
      if (cancelling) { pollTimer = setTimeout(poll, 3000); return; }
      const version = ++requestVersion;
      try {
        const value = await getOrderDetails(latest.orderCode, controller.signal);
        if (version === requestVersion) apply(value);
      } catch {
        if (!controller.signal.aborted && version === requestVersion) setError('Chưa kiểm tra được thanh toán. Hệ thống sẽ tự thử lại; bạn không cần chuyển khoản lần nữa.');
      }
      if (!controller.signal.aborted) pollTimer = setTimeout(poll, 3000);
    };
    cancelRef.current = async () => {
      if (!latest || terminal(latest.status) || cancelling) return;
      cancelling = true; setCancelling(true);
      ++requestVersion; // Ignore a status request that began before cancellation.
      try { apply(await cancelOrder(latest.orderCode, controller.signal)); }
      catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Chưa hủy được đơn hàng.'); }
      finally { cancelling = false; if (!controller.signal.aborted) setCancelling(false); }
    };
    void (async () => {
      try {
        if (!orderCode && !plan) throw new Error('Không tìm thấy đơn thanh toán.');
        apply(orderCode ? await getOrderDetails(orderCode, controller.signal)
          : await createCheckout({ planCode: plan!.code, expectedPrice: plan!.price }, checkout!.key, controller.signal));
        if (!controller.signal.aborted) pollTimer = setTimeout(poll, 3000);
      } catch (error) {
        if (!controller.signal.aborted) {
          if ((error as { code?: string }).code === 'CHECKOUT_EXPIRED') checkout?.clear();
          if (['PLAN_PRICE_CHANGED', 'PLAN_UNAVAILABLE'].includes((error as { code?: string }).code ?? '')) {
            window.dispatchEvent(new Event('hanflix:billing-plans-updated'));
          }
          setError(error instanceof Error ? error.message : 'Chưa thể tạo yêu cầu thanh toán.');
        }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    const clock = setInterval(() => {
      if (latest) setTimeLeft(Math.max(0, Math.ceil((Date.parse(latest.expiresAt) - Date.now()) / 1000)));
    }, 1000);
    return () => { controller.abort(); clearTimeout(pollTimer); clearInterval(clock); cancelRef.current = async () => {}; };
  }, [isOpen, plan?.code, plan?.price, orderCode, retryVersion]);

  return { order, isLoading, isCancelling, error, timeLeft,
    retry: () => setRetryVersion(value => value + 1), handleCancel: () => cancelRef.current() };
}
