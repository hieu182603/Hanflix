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
      })
      .catch(error => { if (active) onErrorRef.current(error instanceof Error ? error.message : 'Không thể tải đăng nhập Google.'); });
    return () => { active = false; if (container.current) container.current.replaceChildren(); };
  }, [action]);

  return <div className="relative flex min-h-11 w-full items-center justify-center" aria-busy={pending}>
    <div ref={container} className="w-full flex justify-center" />
    {pending && <div className="absolute inset-0 rounded-full bg-white/70 flex items-center justify-center text-sm font-semibold">Đang đăng nhập…</div>}
  </div>;
}
