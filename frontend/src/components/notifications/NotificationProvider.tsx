import { useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { ToastViewport, type ToastItem } from './Toast';
import { ConfirmModalViewport, type ConfirmDialogState, type ConfirmTone } from './ConfirmModal';
import { NOTIFICATION_VARIANTS, type NotificationVariant } from './notification.tokens';

export interface ToastOptions {
  title?: string;
  duration?: number;
  dismissible?: boolean;
}

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
}

export interface NotificationApi {
  toast: (variant: NotificationVariant, message: string, opts?: ToastOptions) => string;
  success: (message: string, opts?: ToastOptions) => string;
  error: (message: string, opts?: ToastOptions) => string;
  warning: (message: string, opts?: ToastOptions) => string;
  info: (message: string, opts?: ToastOptions) => string;
  dismiss: (id: string) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

interface NotificationContextValue {
  api: NotificationApi;
  toasts: ToastItem[];
  confirmState: ConfirmDialogState | null;
  pushToast: (item: ToastItem) => string;
  removeToast: (id: string) => void;
  openConfirm: (state: Omit<ConfirmDialogState, 'resolve'>) => Promise<boolean>;
  closeConfirm: (result: boolean) => void;
  defaultDuration: number;
  maxToasts: number;
}

import { createContext, useContext } from 'react';

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotificationContext(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotification must be used within <NotificationProvider>');
  }
  return ctx;
}

export interface NotificationProviderProps {
  children: ReactNode;
  maxToasts?: number;
  defaultDuration?: number;
}

let toastIdCounter = 0;
const nextToastId = () => `toast-${++toastIdCounter}-${Date.now()}`;

export function NotificationProvider({
  children,
  maxToasts = 5,
  defaultDuration = 4000,
}: NotificationProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmDialogState | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (item: ToastItem) => {
      const id = item.id ?? nextToastId();
      const newItem: ToastItem = { ...item, id, duration: item.duration ?? defaultDuration, dismissible: item.dismissible ?? true };
      setToasts((prev) => {
        const next = [...prev, newItem];
        if (next.length > maxToasts) {
          return next.slice(next.length - maxToasts);
        }
        return next;
      });
      return id;
    },
    [defaultDuration, maxToasts],
  );

  const openConfirm = useCallback((state: Omit<ConfirmDialogState, 'resolve'>) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...state, resolve });
    });
  }, []);

  const closeConfirm = useCallback(
    (result: boolean) => {
      setConfirmState((prev) => {
        if (!prev) return null;
        prev.resolve(result);
        return null;
      });
    },
    [],
  );

  const api = useMemo<NotificationApi>(() => {
    const make =
      (variant: NotificationVariant) =>
      (message: string, opts?: ToastOptions): string =>
        pushToast({
          id: '',
          variant,
          message,
          title: opts?.title,
          duration: opts?.duration ?? defaultDuration,
          dismissible: opts?.dismissible ?? true,
        });
    return {
      toast: (variant, message, opts) =>
        pushToast({
          id: '',
          variant,
          message,
          title: opts?.title,
          duration: opts?.duration ?? defaultDuration,
          dismissible: opts?.dismissible ?? true,
        }),
      success: make('success'),
      error: make('error'),
      warning: make('warning'),
      info: make('info'),
      dismiss: removeToast,
      confirm: (opts) =>
        openConfirm({
          title: opts.title,
          message: opts.message,
          confirmText: opts.confirmText ?? 'Xác nhận',
          cancelText: opts.cancelText ?? 'Hủy',
          tone: opts.tone ?? 'default',
        }),
    };
  }, [pushToast, removeToast, openConfirm, defaultDuration]);

  // ESC closes confirm
  useEffect(() => {
    if (!confirmState) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeConfirm(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [confirmState, closeConfirm]);

  const ctxValue = useMemo<NotificationContextValue>(
    () => ({
      api,
      toasts,
      confirmState,
      pushToast,
      removeToast,
      openConfirm,
      closeConfirm,
      defaultDuration,
      maxToasts,
    }),
    [api, toasts, confirmState, pushToast, removeToast, openConfirm, closeConfirm, defaultDuration, maxToasts],
  );

  // Reference used for variant color tokens inside Toast/ConfirmModal
  void NOTIFICATION_VARIANTS;

  return (
    <NotificationContext.Provider value={ctxValue}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={removeToast} />
      <ConfirmModalViewport state={confirmState} onClose={closeConfirm} />
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationApi {
  return useNotificationContext().api;
}
