import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { NOTIFICATION_VARIANTS, type NotificationVariant } from './notification.tokens';

function cn(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(' ');
}

export interface InlineBannerProps {
  variant: NotificationVariant;
  title?: string;
  message: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Thời gian auto-dismiss (ms). 0 = không auto-dismiss. Mặc định 0. */
  autoDismissMs?: number;
}

export function InlineBanner({
  variant,
  title,
  message,
  dismissible = false,
  onDismiss,
  icon,
  action,
  className,
  autoDismissMs = 0,
}: InlineBannerProps) {
  const tokens = NOTIFICATION_VARIANTS[variant];
  const Icon = tokens.icon;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoDismissMs <= 0) return;
    const t = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(() => onDismiss?.(), 200);
    }, autoDismissMs);
    return () => window.clearTimeout(t);
  }, [autoDismissMs, onDismiss]);

  if (!visible) return null;

  return (
    <div
      role={tokens.ariaRole}
      aria-live={tokens.ariaLive}
      aria-atomic="true"
      className={cn(
        'animate-in fade-in slide-in-from-top-2 duration-200 flex items-start gap-2.5 rounded-2xl border p-3.5 text-xs font-bold shadow-2xs',
        tokens.bg,
        tokens.border,
        tokens.text,
        className,
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white text-[10px] font-black">
        {icon ?? <Icon className="h-4 w-4" aria-hidden="true" />}
      </span>
      <div className="flex-1 min-w-0">
        {title && <div className="font-black text-[13px] leading-tight">{title}</div>}
        <div className={cn(title ? 'mt-0.5 text-xs font-semibold leading-snug' : 'text-xs font-bold leading-snug')}>{message}</div>
        {action && <div className="mt-2">{action}</div>}
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            onDismiss?.();
          }}
          className="shrink-0 -m-1 p-1 rounded-full hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C]"
          aria-label="Đóng thông báo"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
