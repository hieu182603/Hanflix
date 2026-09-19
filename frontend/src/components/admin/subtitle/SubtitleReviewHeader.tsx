import { ArrowLeft, CheckCircle2, Save } from 'lucide-react';
import type { SubtitleReviewStatus } from '../../../api/admin';

interface SubtitleReviewHeaderProps {
  lessonTitle: string;
  lessonHsk: number;
  status: SubtitleReviewStatus;
  approvedAt?: string;
  dirty: boolean;
  saving: boolean;
  approving: boolean;
  canApprove: boolean;
  onBack: () => void;
  onSaveDraft: () => void;
  onApprove: () => void;
}

const STATUS_LABEL: Record<SubtitleReviewStatus, { label: string; toneClass: string }> = {
  pending: { label: 'Chờ duyệt phụ đề', toneClass: 'bg-[#FFF8EC] text-[#B45309] border-[#FDE6BA]' },
  in_progress: { label: 'Đang chỉnh sửa', toneClass: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]' },
  approved: { label: 'Đã duyệt phụ đề', toneClass: 'bg-[#EAF5F1] text-[#188A5A] border-[#C6E7DA]' },
};

export function SubtitleReviewHeader({
  lessonTitle,
  lessonHsk,
  status,
  approvedAt,
  dirty,
  saving,
  approving,
  canApprove,
  onBack,
  onSaveDraft,
  onApprove,
}: SubtitleReviewHeaderProps) {
  const statusBadge = STATUS_LABEL[status];
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-[#F2E4D8] bg-white px-5 py-3.5 shadow-2xs">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-[#5F564F] transition hover:bg-[#FFF9F5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Quay lại
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-black text-[#2B2826]">{lessonTitle}</h1>
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#8C827A]">HSK {lessonHsk}</p>
      </div>
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide ${statusBadge.toneClass}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
        {statusBadge.label}
        {status === 'approved' && approvedAt && (
          <span className="ml-1 normal-case text-[10px] font-bold opacity-70">
            · {new Date(approvedAt).toLocaleString('vi-VN')}
          </span>
        )}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#F2E4D8] bg-white px-3 py-2 text-xs font-bold text-[#2B2826] transition hover:bg-[#FFF9F5] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C]"
        >
          <Save className="h-3.5 w-3.5" aria-hidden="true" />
          {saving ? 'Đang lưu…' : 'Lưu bản nháp'}
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={!canApprove || approving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#B91B1C] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#991314] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C] focus-visible:ring-offset-2"
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {approving ? 'Đang duyệt…' : 'Duyệt phụ đề & Tiếp tục'}
        </button>
      </div>
    </header>
  );
}
