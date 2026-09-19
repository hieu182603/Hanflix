import { Sparkles } from 'lucide-react';

interface AiImprovedBadgeProps {
  /** When false, the badge is not rendered. */
  visible: boolean;
  /** Optional tooltip override. */
  label?: string;
  size?: 'sm' | 'md';
}

export default function AiImprovedBadge({ visible, label = 'Bản dịch được cải thiện bằng AI', size = 'sm' }: AiImprovedBadgeProps) {
  if (!visible) return null;
  const sizing = size === 'md'
    ? 'px-2.5 py-1 text-xs'
    : 'px-2 py-0.5 text-[10px]';
  return (
    <span
      title={label}
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#FFF0D6] to-[#FFE3B8] font-bold text-[#B45309] ring-1 ring-[#FDE6BA] ${sizing}`}
    >
      <Sparkles size={size === 'md' ? 12 : 10} />
      AI-improved
    </span>
  );
}
