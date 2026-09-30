import React, { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { activateAdminUserPremium, getAdminBillingPlans, getAdminUserGrants, type PremiumPlan } from '../../api/billing';
import { pendingBillingRequest } from '../../lib/billing-session';
import { getCachedUser } from '../../api/auth';
import type { AdminUser } from '../../api/admin';

export default function AdminPremiumActivation({ user, onActivated }: { user: AdminUser; onActivated: (expiry: string) => void }) {
  const plans = useQuery({ queryKey: ['admin', 'billing', 'plans'], queryFn: ({ signal }) => getAdminBillingPlans(signal) });
  const grants = useQuery({ queryKey: ['admin', 'billing', 'grants', user._id], queryFn: ({ signal }) => getAdminUserGrants(user._id, signal) });
  const [planCode, setPlanCode] = useState<PremiumPlan['code']>('monthly');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const request = useRef<{ key: string; fingerprint: string; clear: () => void } | null>(null);
  const inFlight = useRef(false);
  const expiry = grants.data?.premiumExpiresAt ?? user.premiumExpiresAt;
  const active = Boolean(expiry && Date.parse(expiry) > Date.now());
  const formatDate = (value: string) => new Date(value).toLocaleString('vi-VN');

  const activate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !plans.data?.items.some(plan => plan.code === planCode)) return;
    const input = { planCode, reason: reason.trim() };
    if (input.reason.length < 3) { setError('Vui lòng nhập lý do kích hoạt (ít nhất 3 ký tự).'); return; }
    const fingerprint = JSON.stringify([user._id, input]);
    if (request.current?.fingerprint !== fingerprint) request.current = {
      fingerprint, ...pendingBillingRequest(`admin-grant:${getCachedUser()?.id ?? 'admin'}:${fingerprint}`),
    };
    inFlight.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await activateAdminUserPremium(user._id, input, request.current.key);
      onActivated(result.premiumExpiresAt);
      setMessage(`Đã kích hoạt Premium đến ${formatDate(result.premiumExpiresAt)}.`);
      setReason(''); request.current.clear(); request.current = null;
      void grants.refetch();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Chưa kích hoạt được gói.');
    } finally { inFlight.current = false; setBusy(false); }
  };

  return <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3 text-xs">
    <h4 className="font-bold text-sm text-amber-900">Kích hoạt gói Premium</h4>
    <p>{active ? `Premium hiện tại đến ${formatDate(expiry!)}` : 'Chưa có gói Premium còn hạn.'}</p>
    {user.role === 'user' && user.status === 'active' ? <form onSubmit={activate} className="space-y-3">
      <p>Thời hạn mới được cộng tiếp phần còn lại; nếu đã hết hạn thì tính từ lúc kích hoạt. Không tạo giao dịch thu tiền.</p>
      <label className="block font-semibold">Gói kích hoạt
        <select aria-label="Gói kích hoạt" value={planCode} onChange={event => setPlanCode(event.target.value as PremiumPlan['code'])}
          disabled={busy || !plans.data} className="mt-1 block w-full rounded-xl border border-amber-200 bg-white p-2">
          {(plans.data?.items ?? []).map(plan => <option key={plan.code} value={plan.code}>{plan.durationMonths} tháng — {plan.name}</option>)}
        </select>
      </label>
      <label className="block font-semibold">Lý do kích hoạt
        <textarea aria-label="Lý do kích hoạt" required minLength={3} maxLength={500} disabled={busy} value={reason}
          onChange={event => setReason(event.target.value)} placeholder="Ví dụ: Tặng gói học theo chương trình hỗ trợ"
          className="mt-1 block w-full rounded-xl border border-amber-200 bg-white p-2" />
      </label>
      {plans.isError && <p role="alert">Chưa tải được gói. <button type="button" onClick={() => void plans.refetch()} className="underline">Tải lại</button></p>}
      <button type="submit" disabled={busy || !plans.data?.items.length || reason.trim().length < 3}
        className="rounded-xl bg-[#B91B1C] px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? 'Đang kích hoạt…' : 'Kích hoạt gói cho người dùng'}</button>
    </form> : <p>Chỉ kích hoạt cho học viên đang hoạt động.</p>}
    {error && <p role="alert" className="text-red-700">{error} Hãy thử lại cùng thông tin để tránh cấp trùng.</p>}
    {message && <p role="status" className="text-emerald-800">{message}</p>}
    <details className="border-t border-amber-200 pt-2">
      <summary className="cursor-pointer font-semibold">Lịch sử kích hoạt thủ công</summary>
      {grants.isPending && <p>Đang tải…</p>}
      {grants.isError && <button type="button" onClick={() => void grants.refetch()} className="underline">Tải lại lịch sử</button>}
      {grants.data?.items.length === 0 && <p className="pt-2">Chưa có lần kích hoạt thủ công.</p>}
      <ul className="space-y-2 pt-2">{grants.data?.items.map(grant => <li key={grant.grantId} className="rounded-lg bg-white p-2">
        <p className="font-semibold">+{grant.durationMonths} tháng · {formatDate(grant.grantedAt)}</p>
        <p className="break-words">{grant.reason}</p>
        <p className="text-neutral-500 break-all">Admin: {grant.grantedBy}</p>
      </li>)}</ul>
    </details>
  </section>;
}
