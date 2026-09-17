import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, LoaderCircle, MailWarning } from 'lucide-react';
import * as auth from '../../api/auth';
import AuthLayout from './AuthLayout';

export default function VerifyEmailView({ onNavigateToLogin }: { onNavigateToLogin: () => void }) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Đang xác minh email của bạn…');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setStatus('error');
      setMessage('Liên kết xác minh không có token.');
      return;
    }
    auth.verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('Email đã được xác minh. Bạn có thể đăng nhập HanFlix.');
      })
      .catch(error => {
        setStatus('error');
        setMessage(error instanceof auth.ApiRequestError ? error.message : 'Không thể xác minh email lúc này.');
      });
  }, []);

  const icon = status === 'loading'
    ? <LoaderCircle className="w-9 h-9 animate-spin" />
    : status === 'success' ? <CheckCircle2 className="w-9 h-9" /> : <MailWarning className="w-9 h-9" />;
  const panel = (
    <div className="w-full text-center">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${status === 'error' ? 'bg-red-50 text-[#E50914]' : 'bg-green-50 text-green-700'}`}>{icon}</div>
      <h1 className="font-display text-3xl font-black text-neutral-900 mb-3">Xác minh email</h1>
      <p className="text-sm leading-relaxed text-neutral-600 mb-7">{message}</p>
      {status !== 'loading' && (
        <button type="button" onClick={onNavigateToLogin}
          className="w-full h-12 rounded-full bg-[#E50914] text-white font-bold hover:bg-[#CC0813] transition-colors">
          Đi đến đăng nhập
        </button>
      )}
    </div>
  );
  return <AuthLayout visualPanel={<AuthMessage title="Một bước cuối" text="Xác minh email để bảo vệ tài khoản và bắt đầu hành trình học." />} formPanel={panel} />;
}

function AuthMessage({ title, text }: { title: string; text: string }) {
  return <div><p className="text-xs font-bold tracking-[.2em] uppercase text-[#E50914] mb-3">HanFlix Security</p><h2 className="font-display text-5xl font-black tracking-tight text-neutral-900 mb-4">{title}</h2><p className="max-w-md text-neutral-700 leading-relaxed">{text}</p></div>;
}
