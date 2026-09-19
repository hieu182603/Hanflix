import { useMemo } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import type { AdminCue } from '../../../api/admin';

interface SubtitleNavigatorProps {
  cues: AdminCue[];
  selectedCueId: string | null;
  activeCueId: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (cueId: string) => void;
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function SubtitleNavigator({
  cues,
  selectedCueId,
  activeCueId,
  query,
  onQueryChange,
  onSelect,
}: SubtitleNavigatorProps) {
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return cues;
    return cues.filter((cue) =>
      cue.zh.toLowerCase().includes(needle)
      || cue.vi.toLowerCase().includes(needle)
      || cue.pinyin.toLowerCase().includes(needle),
    );
  }, [cues, query]);

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-[#F2E4D8] p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8C827A]" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Tìm câu thoại…"
            className="w-full rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] py-1.5 pl-8 pr-3 text-xs font-bold text-[#2B2826] outline-none transition focus:border-[#B91B1C] focus:ring-2 focus:ring-[#B91B1C]/10"
            aria-label="Tìm câu thoại"
          />
        </div>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-[#8C827A]">
          {filtered.length}/{cues.length} câu thoại
        </p>
      </div>
      <ul className="flex-1 overflow-y-auto" role="listbox" aria-label="Danh sách câu thoại">
        {filtered.length === 0 && (
          <li className="px-3 py-8 text-center text-xs text-[#8C827A]">
            Không tìm thấy câu thoại nào khớp với bộ lọc.
          </li>
        )}
        {filtered.map((cue, index) => {
          const isSelected = cue.cueId === selectedCueId;
          const isActive = cue.cueId === activeCueId;
          return (
            <li key={cue.cueId}>
              <button
                type="button"
                onClick={() => onSelect(cue.cueId)}
                aria-selected={isSelected}
                role="option"
                className={`flex w-full items-start gap-2 border-b border-[#F2E4D8]/60 px-3 py-2 text-left transition ${
                  isSelected ? 'bg-[#FDF1F1]' : 'hover:bg-[#FFF9F5]'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-black ${
                    isActive
                      ? 'bg-[#B91B1C] text-white'
                      : 'bg-[#F2E4D8] text-[#5F564F]'
                  }`}
                >
                  {formatMs(cue.startMs)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-xs font-bold text-[#2B2826]">
                    {cue.zh}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-[#8C827A]">
                    {cue.vi}
                  </span>
                </span>
                <ChevronRight
                  className={`mt-1 h-3.5 w-3.5 shrink-0 transition ${isSelected ? 'text-[#B91B1C]' : 'text-[#8C827A]/40'}`}
                  aria-hidden="true"
                />
                <span className="sr-only">Câu {index + 1}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
