/**
 * NotificationProvider + useNotification
 *
 * v2 changes (2026-09-23):
 * - Sử dụng NOTIFICATION_PRIORITY + NOTIFICATION_DURATION từ design tokens
 * - Fix stale closure: luôn đọc defaultDuration từ ref hoặc token, không phụ thuộc closure
 * - Fix stacking bug: khi push toast mới, drop oldest trong nhóm priority THẤP NHẤT
 *   mà KHÔNG trùng với toast mới (prev bug: id check không đúng vì newItem chưa replace)
 * - Thêm rate-limit: debounce 300ms cho mỗi toast cùng variant (tránh flood khi spam)
 * - Hỗ trợ destructive variant
 */
import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { ToastViewport, type ToastItem } from './Toast';
import { ConfirmModalViewport, type ConfirmDialogState, type ConfirmTone } from './ConfirmModal';
import {
  type NotificationVariant,
  type ToastPosition,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_DURATION,
} from './notification.tokens';

export interface ToastOptions {
  title?: string;
  /** Auto-dismiss duration in ms. 0 = sticky (no auto-dismiss). */
  duration?: number;
  /** Nếu false = không có nút X, user phải đợi auto-dismiss. */
  dismissible?: boolean;
  /** Action button bên trong toast. */
  action?: { label: string; onClick: () => void };
}

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
  /** Tertiary action (optional) — ví dụ: "Lưu bản nháp" */
  tertiaryText?: string;
  onTertiary?: () => void;
}

export interface NotificationApi {
  toast: (
    variant: NotificationVariant,
    message: string,
    opts?: ToastOptions,
  ) => string;
  success: (message: string, opts?: ToastOptions) => string;
  error: (message: string, opts?: ToastOptions) => string;
  warning: (message: string, opts?: ToastOptions) => string;
  info: (message: string, opts?: ToastOptions) => string;
  destructive: (message: string, opts?: ToastOptions) => string;
  dismiss: (id: string) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

interface NotificationContextValue {
  api: NotificationApi;
  toasts: ToastItem[];
  confirmState: ConfirmDialogState | null;
  pushToast: (item: Partial<ToastItem>) => string;
  removeToast: (id: string) => void;
  openConfirm: (
    state: Omit<ConfirmDialogState, 'resolve'>,
  ) => Promise<boolean>;
  closeConfirm: (result: boolean) => void;
  defaultDuration: number;
  maxToasts: number;
  toastPosition: ToastPosition;
}

import { createContext, useContext } from 'react';

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotificationContext(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      'useNotification must be used within <NotificationProvider>',
    );
  }
  return ctx;
}

export interface NotificationProviderProps {
  children: ReactNode;
  maxToasts?: number;
  defaultDuration?: number;
  /** Vị trí mặc định của toast viewport. Default: 'top-right' */
  toastPosition?: ToastPosition;
}

let toastIdCounter = 0;
const nextToastId = () => `toast-${++toastIdCounter}-${Date.now()}`;

export function NotificationProvider({
  children,
  maxToasts = 5,
  defaultDuration = 4000,
  toastPosition = 'top-right',
}: NotificationProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] =
    useState<ConfirmDialogState | null>(null);

  // Refs để tránh stale closure
  const maxToastsRef = useRef(maxToasts);
  const defaultDurationRef = useRef(defaultDuration);
  useEffect(() => {
    maxToastsRef.current = maxToasts;
  }, [maxToasts]);
  useEffect(() => {
    defaultDurationRef.current = defaultDuration;
  }, [defaultDuration]);

  // Rate-limit: debounce per variant
  const lastPushRef = useRef<Record<string, number>>({});
  const pendingPushRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (item: Partial<ToastItem>): string => {
      const variant: NotificationVariant = item.variant ?? 'neutral';

      // Rate-limit: nếu cùng variant được push trong 300ms, debounce
      const now = Date.now();
      const last = lastPushRef.current[variant] ?? 0;
      if (now - last < 300) {
        // Hủy push cũ nếu đang pending
        if (pendingPushRef.current[variant]) {
          clearTimeout(pendingPushRef.current[variant]);
        }
        // Debounce: đợi 300ms rồi push
        return new Promise<string>((resolve) => {
          pendingPushRef.current[variant] = setTimeout(() => {
            delete pendingPushRef.current[variant];
            const id = pushToast(item);
            resolve(id);
          }, 300);
        }) as unknown as string;
      }
      lastPushRef.current[variant] = now;

      const id = item.id || nextToastId();
      // Resolve effective duration: explicit > provider default > token default
      const effectiveDuration =
        item.duration !== undefined
          ? item.duration
          : defaultDurationRef.current;

      const newItem: ToastItem = {
        id,
        variant,
        message: item.message ?? '',
        title: item.title,
        duration:
          effectiveDuration ??
          NOTIFICATION_DURATION[variant] ??
          defaultDurationRef.current,
        dismissible: item.dismissible ?? true,
        action: item.action,
      };

      setToasts((prev) => {
        const priority = NOTIFICATION_PRIORITY;
        // Sắp xếp: priority cao lên trước
        const next: ToastItem[] = [...prev, newItem].sort(
          (a, b) =>
            (priority[b.variant] ?? 1) - (priority[a.variant] ?? 1),
        );

        // Drop oldest trong nhóm priority THẤP NHẤT nếu vượt maxToasts
        if (next.length > maxToastsRef.current) {
          // Tìm nhóm priority thấp nhất (cùng hoặc thấp hơn newItem)
          const newItemPriority = priority[variant] ?? 1;

          // Tìm index đầu tiên mà priority < newItemPriority
          // → drop item đầu tiên trong nhóm thấp nhất
          let dropIndex = -1;
          for (let i = next.length - 1; i >= 0; i--) {
            const p = priority[next[i].variant] ?? 1;
            if (p <= newItemPriority) {
              dropIndex = i;
              break;
            }
          }

          // Nếu không tìm được (tất cả đều cao hơn), drop cái cũ nhất (index 0)
          if (dropIndex === -1) dropIndex = 0;

          // Không drop nếu dropIndex trùng với newItem (vừa push vào)
          if (dropIndex === next.length - 1) {
            // newItem ở cuối → drop item có priority thấp nhất trước đó
            let lowestP = Infinity;
            let lowestIdx = -1;
            for (let i = 0; i < next.length - 1; i++) {
              const p = priority[next[i].variant] ?? 1;
              if (p < lowestP) {
                lowestP = p;
                lowestIdx = i;
              }
            }
            dropIndex = lowestIdx >= 0 ? lowestIdx : next.length - 2;
          }

          return next.filter((_, i) => i !== dropIndex);
        }

        return next;
      });

      return id;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const openConfirm = useCallback(
    (state: Omit<ConfirmDialogState, 'resolve'>) => {
      return new Promise<boolean>((resolve) => {
        setConfirmState({ ...state, resolve });
      });
    },
    [],
  );

  const closeConfirm = useCallback((result: boolean) => {
    setConfirmState((prev) => {
      if (!prev) return null;
      prev.resolve(result);
      return null;
    });
  }, []);

  const api = useMemo<NotificationApi>(() => {
    const makeToast =
      (variant: NotificationVariant) =>
      (message: string, opts?: ToastOptions): string =>
        pushToast({
          id: '',
          variant,
          message,
          title: opts?.title,
          duration: opts?.duration,
          dismissible: opts?.dismissible,
          action: opts?.action,
        });

    return {
      toast: (variant, message, opts) =>
        pushToast({
          id: '',
          variant,
          message,
          title: opts?.title,
          duration: opts?.duration,
          dismissible: opts?.dismissible,
          action: opts?.action,
        }),
      success: makeToast('success'),
      error: makeToast('error'),
      warning: makeToast('warning'),
      info: makeToast('info'),
      // destructive = critical system failure
      destructive: makeToast('destructive'),
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
  }, [pushToast, removeToast, openConfirm]);

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

  // Cleanup pending debounces on unmount
  useEffect(() => {
    return () => {
      Object.values(pendingPushRef.current).forEach(clearTimeout);
    };
  }, []);

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
      toastPosition,
    }),
    [
      api,
      toasts,
      confirmState,
      pushToast,
      removeToast,
      openConfirm,
      closeConfirm,
      defaultDuration,
      maxToasts,
      toastPosition,
    ],
  );

  return (
    <NotificationContext.Provider value={ctxValue}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={removeToast} position={toastPosition} />
      <ConfirmModalViewport state={confirmState} onClose={closeConfirm} />
    </NotificationContext.Provider>
  );
}

/** Hook chính để sử dụng notification trong component */
export function useNotification(): NotificationApi {
  return useNotificationContext().api;
}
