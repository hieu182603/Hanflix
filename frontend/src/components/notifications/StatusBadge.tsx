import { NOTIFICATION_VARIANTS, type NotificationVariant } from './notification.tokens';

function cn(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(' ');
}

export type StatusBadgeSize = 'sm' | 'md';

export interface StatusBadgeProps {
  variant: NotificationVariant;
  label: string;
  size?: StatusBadgeSize;
  icon?: React.ReactNode;
  className?: string;
}

const SIZE_CLASS: Record<StatusBadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[9px]',
  md: 'px-2.5 py-1 text-[10px]',
};

export function StatusBadge({ variant, label, size = 'md', icon, className }: StatusBadgeProps) {
  const tokens = NOTIFICATION_VARIANTS[variant];
  const Icon = tokens.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-black tracking-wide uppercase transition-all',
        SIZE_CLASS[size],
        tokens.bg,
        tokens.border,
        tokens.text,
        className,
      )}
    >
      {icon ?? <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}
