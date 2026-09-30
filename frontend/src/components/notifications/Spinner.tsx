function cn(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(' ');
}

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n';

export type SpinnerSize = 'sm' | 'md' | 'lg';
export type SpinnerTone = 'brand' | 'muted' | 'white';

export interface SpinnerProps {
  size?: SpinnerSize;
  tone?: SpinnerTone;
  label?: string;
  className?: string;
}

const SIZE_CLASS: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-8 w-8 border-[3px]',
};

const TONE_CLASS: Record<SpinnerTone, { ring: string; border: string }> = {
  brand: { ring: 'border-[#B91B1C]', border: 'border-t-transparent' },
  muted: { ring: 'border-[#8C827A]', border: 'border-t-transparent' },
  white: { ring: 'border-white', border: 'border-t-transparent' },
};

export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ size = 'md', tone = 'brand', label, className }, ref) => {
    const { ui } = useI18n();
    const toneClasses = TONE_CLASS[tone];
    return (
      <span
        ref={ref}
        role="status"
        aria-label={ui(label ?? 'Đang tải')}
        className={cn('inline-flex shrink-0', className)}
      >
        <Loader2
          className={cn('animate-spin rounded-full', SIZE_CLASS[size], toneClasses.ring, toneClasses.border)}
          aria-hidden="true"
        />
      </span>
    );
  },
);

Spinner.displayName = 'Spinner';
