import { useEffect, useRef, useState } from 'react';
import * as auth from '../../api/auth';

type GoogleCredentialResponse = { credential?: string };
type GoogleIdentity = {
  initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
  renderButton: (element: HTMLElement, options: {
    type: 'standard'; theme: 'outline'; size: 'large'; shape: 'pill'; text: 'signin_with' | 'signup_with' | 'continue_with'; locale: string; width: number;
  }) => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

let scriptPromise: Promise<void> | undefined;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts.id) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => window.google?.accounts.id ? resolve() : reject(new Error('Google Identity Services chưa sẵn sàng'));
    script.onerror = () => reject(new Error('Không thể tải Google Identity Services'));
    document.head.appendChild(script);
  }).catch(error => {
    scriptPromise = undefined;
    throw error;
  });
  return scriptPromise;
}

const FALLBACK_LABEL: Record<'signin_with' | 'signup_with' | 'continue_with', string> = {
  signin_with: 'Đăng nhập với Google',
  signup_with: 'Đăng ký với Google',
  continue_with: 'Tiếp tục với Google',
};

export default function GoogleSignInButton({
  action,
  onCredential,
  onError,
}: {
  action: 'signin_with' | 'signup_with' | 'continue_with';
  onCredential: (credential: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  onCredentialRef.current = onCredential;
  onErrorRef.current = onError;

  useEffect(() => {
    let active = true;
    Promise.all([auth.getGoogleClientId(), loadGoogleScript()])
      .then(([clientId]) => {
        if (!active || !container.current) return;
        if (!clientId) throw new Error('Đăng nhập Google chưa được cấu hình.');
        window.google!.accounts.id.initialize({
          client_id: clientId,
          callback: response => {
            if (!active) return;
            if (!response.credential) return onErrorRef.current('Google không trả về thông tin đăng nhập.');
            setPending(true);
            void onCredentialRef.current(response.credential)
              .catch(error => onErrorRef.current(error instanceof auth.ApiRequestError ? error.message : 'Không thể đăng nhập với Google.'))
              .finally(() => { if (active) setPending(false); });
          },
        });
        window.google!.accounts.id.renderButton(container.current, {
          type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: action, locale: 'vi',
          width: Math.min(Math.max(container.current.clientWidth, 240), 400),
        });
        if (active) setReady(true);
      })
      .catch(error => { if (active) onErrorRef.current(error instanceof Error ? error.message : 'Không thể tải đăng nhập Google.'); });
    return () => { active = false; if (container.current) container.current.replaceChildren(); setReady(false); };
  }, [action]);

  const handleFallbackClick = () => {
    if (ready) return; // Google button already handles click
    onErrorRef.current('Đang tải Google, vui lòng đợi thêm hoặc thử lại sau ít giây.');
  };

  return (
    <div
      className="relative flex min-h-11 w-full items-center justify-center"
      aria-busy={pending}
    >
      {/* Fallback button — luôn hiển thị để người dùng thấy ngay,
          được đè bởi Google button khi script load xong */}
      {!ready && (
        <button
          type="button"
          onClick={handleFallbackClick}
          disabled={pending}
          className="flex h-11 w-full min-w-[240px] max-w-[400px] items-center justify-center gap-2.5 rounded-full border border-[#DADCE0] bg-white px-5 text-sm font-semibold text-[#3C4043] shadow-sm transition-[background-color,opacity] hover:bg-[#F7F8F8] active:scale-[0.99] disabled:opacity-60"
          aria-label={FALLBACK_LABEL[action]}
        >
          <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.44 1.18 4.94l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          <span>{FALLBACK_LABEL[action]}</span>
        </button>
      )}
      <div
        ref={container}
        className={`w-full flex justify-center ${ready ? '' : 'absolute inset-0 opacity-0 pointer-events-none'}`}
      />
      {pending && (
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70 text-sm font-semibold">
          Đang đăng nhập…
        </div>
      )}
    </div>
  );
}
