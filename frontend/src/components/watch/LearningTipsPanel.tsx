import { useI18n } from '../../i18n';
import { Sparkles, GraduationCap, ListChecks } from 'lucide-react';
import type { LearningTip } from '../../api/admin';

interface LearningTipsPanelProps {
  tips: ReadonlyArray<LearningTip> | undefined;
  drillWords: ReadonlyArray<string> | undefined;
  /** 'admin' shows internal labels; 'learner' uses friendly Vietnamese only. */
  audience?: 'admin' | 'learner';
}

export default function LearningTipsPanel({ tips, drillWords, audience = 'learner' }: LearningTipsPanelProps) {
  const { tr } = useI18n();
  const safeTips = tips ?? [];
  const safeWords = drillWords ?? [];
  if (safeTips.length === 0 && safeWords.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[#F2E4D8] bg-gradient-to-br from-[#FFFAF3] to-[#FFFDFB] p-4 shadow-xs">
      <header className="mb-3 flex items-center gap-2">
        <span className="rounded-lg bg-[#FFF0D6] p-1.5 text-[#B45309]">
          <GraduationCap size={16} />
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-black text-[#2B2826]">{tr("Mẹo học tập cho video này")}</h3>
          <p className="text-[11px] text-[#7A6F66]">
            {audience === 'admin'
              ? tr("AI đã sinh mẹo dựa trên phụ đề. Bạn có thể sửa hoặc xóa.")
              : tr("AI gợi ý cách học hiệu quả nhất với nội dung này.")}
          </p>
        </div>
        <span className="rounded-full bg-[#FFF0D6] px-2 py-0.5 text-[10px] font-bold text-[#B45309]">
          AI Tips
        </span>
      </header>

      {safeTips.length > 0 && (
        <ol className="space-y-2">
          {safeTips.map((tip, idx) => (
            <li
              key={`${tip.cueId ?? ''}-${idx}`}
              className="flex items-start gap-2 rounded-xl bg-white p-3 ring-1 ring-[#F2E4D8]"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#B91B1C] text-[11px] font-black text-white">
                {idx + 1}
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-xs font-bold text-[#2B2826]">{tip.title}</p>
                  {tip.cueId && (
                    <span className="rounded bg-[#F2E4D8] px-1.5 py-0.5 text-[10px] font-mono text-[#7A6F66]">
                      {tip.cueId}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#2B2826]/80">{tip.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {safeWords.length > 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-[#F2E4D8] bg-white p-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <ListChecks size={12} className="text-[#188A5A]" />
            <p className="text-[11px] font-bold text-[#2B2826]">{tr("Từ vựng nên ôn lại sau khi xem")}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {safeWords.map((w, idx) => (
              <span
                key={`${w}-${idx}`}
                className="inline-flex items-center gap-1 rounded-full bg-[#EAF5F1] px-2 py-0.5 text-[11px] font-bold text-[#188A5A] ring-1 ring-[#C6E7DA]"
              >
                <Sparkles size={10} />
                {w}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
