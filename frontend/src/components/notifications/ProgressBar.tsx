function cn(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(' ');
}

export interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: 'brand' | 'success' | 'info' | 'warning' | 'error';
  indeterminate?: boolean;
  label?: string;
  showValue?: boolean;
  className?: string;
}

const VARIANT_BG: Record<NonNullable<ProgressBarProps['variant']>, string> = {
  brand: 'bg-[#B91B1C]',
  success: 'bg-[#188A5A]',
  info: 'bg-[#1D4ED8]',
  warning: 'bg-[#B45309]',
  error: 'bg-[#DC2626]',
};

const VARIANT_TRACK: Record<NonNullable<ProgressBarProps['variant']>, string> = {
  brand: 'bg-[#F2E4D8]',
  success: 'bg-[#C6E7DA]',
  info: 'bg-[#BFDBFE]',
  warning: 'bg-[#FDE6BA]',
  error: 'bg-[#F9D2D2]',
};

export function ProgressBar({
  value,
  max = 100,
  variant = 'brand',
  indeterminate = false,
  label,
  showValue = false,
  className,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn('w-full', className)} role="progressbar" aria-valuenow={indeterminate ? undefined : value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className={cn('relative h-2 w-full overflow-hidden rounded-full', VARIANT_TRACK[variant])}>
        {indeterminate ? (
          <div
            className={cn('absolute inset-y-0 left-0 w-1/3 animate-[progress-indeterminate_1.4s_ease-in-out_infinite] rounded-full', VARIANT_BG[variant])}
            aria-hidden="true"
          />
        ) : (
          <div
            className={cn('h-full rounded-full transition-[width] duration-300 ease-out', VARIANT_BG[variant])}
            style={{ width: `${pct}%` }}
            aria-hidden="true"
          />
        )}
      </div>
      {showValue && !indeterminate && (
        <div className="mt-1 text-right text-[10px] font-bold text-[#8C827A]">{Math.round(pct)}%</div>
      )}
    </div>
  );
}
