import { useState, type FormEvent } from 'react';
import { CheckCircle2, KeyRound } from 'lucide-react';
import * as auth from '../../api/auth';
import AuthLayout from './AuthLayout';

export default function ResetPasswordView({ onNavigateToLogin }: { onNavigateToLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) return setError('Mật khẩu phải có ít nhất 8 ký tự.');
    if (password !== confirmation) return setError('Mật khẩu xác nhận không trùng khớp.');
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) return setError('Liên kết đặt lại mật khẩu không có token.');
    setLoading(true);
    try {
      await auth.resetPassword(token, password);
      setComplete(true);
    } catch (requestError) {
      setError(requestError instanceof auth.ApiRequestError ? requestError.message : 'Không thể đặt lại mật khẩu lúc này.');
    } finally {
      setLoading(false);
    }
  };

  const form = complete ? (
    <div className="text-center">
      <CheckCircle2 className="w-14 h-14 text-green-700 mx-auto mb-5" />
      <h1 className="font-display text-3xl font-black mb-3">Đã đổi mật khẩu</h1>
      <p className="text-sm text-neutral-600 mb-7">Các phiên đăng nhập cũ đã bị thu hồi.</p>
      <button type="button" onClick={onNavigateToLogin} className="w-full h-12 rounded-full bg-[#E50914] text-white font-bold">Đăng nhập</button>
    </div>
  ) : (
    <form onSubmit={submit} className="space-y-4">
      <KeyRound className="w-10 h-10 text-[#E50914]" />
      <h1 className="font-display text-3xl font-black">Đặt mật khẩu mới</h1>
      <p className="text-sm text-neutral-600">Liên kết chỉ dùng một lần. Mật khẩu mới phải có ít nhất 8 ký tự.</p>
      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-[#B91B1C] p-3 text-sm font-semibold">{error}</div>}
      <input type="password" value={password} onChange={event => setPassword(event.target.value)} required
        aria-label="Mật khẩu mới" placeholder="Mật khẩu mới" className="w-full h-12 rounded-xl border border-neutral-300 px-4 focus:outline-none focus:border-[#E50914]" />
      <input type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required
        aria-label="Xác nhận mật khẩu mới" placeholder="Xác nhận mật khẩu mới" className="w-full h-12 rounded-xl border border-neutral-300 px-4 focus:outline-none focus:border-[#E50914]" />
      <button type="submit" disabled={loading} className="w-full h-12 rounded-full bg-[#E50914] text-white font-bold disabled:opacity-60">
        {loading ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}
      </button>
    </form>
  );

  return <AuthLayout reverse visualPanel={<div><p className="text-xs font-bold tracking-[.2em] uppercase text-[#E50914] mb-3">HanFlix Security</p><h2 className="font-display text-5xl font-black text-neutral-900 mb-4">Tài khoản an toàn</h2><p className="max-w-md text-neutral-700">Đặt lại mật khẩu sẽ thu hồi toàn bộ phiên đăng nhập cũ.</p></div>} formPanel={form} />;
}
