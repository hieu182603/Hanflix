import { useState } from 'react';
import type { AdminCue, AdminSubtitleStyle } from '../../../api/admin';
import { SubtitleContentEditor, SubtitleAppearanceControls } from './SubtitleContentEditor';

type InspectorTab = 'content' | 'appearance';

interface SubtitleInspectorProps {
  selectedCue: AdminCue | null;
  durationSeconds: number;
  style: AdminSubtitleStyle;
  onCueChange: (cue: AdminCue) => void;
  onCueRemove: (cueId: string) => void;
  onStyleChange: (style: AdminSubtitleStyle) => void;
}

export function SubtitleInspector({
  selectedCue,
  durationSeconds,
  style,
  onCueChange,
  onCueRemove,
  onStyleChange,
}: SubtitleInspectorProps) {
  const [tab, setTab] = useState<InspectorTab>('content');

  return (
    <aside className="flex h-full min-h-0 flex-col bg-white">
      <div role="tablist" aria-label="Inspector chế độ" className="flex shrink-0 border-b border-[#F2E4D8]">
        {(['content', 'appearance'] as const).map((key) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 px-4 py-3 text-xs font-black uppercase tracking-wide transition ${
              tab === key
                ? 'border-b-2 border-[#B91B1C] text-[#B91B1C]'
                : 'text-[#8C827A] hover:text-[#2B2826]'
            }`}
          >
            {key === 'content' ? 'Nội dung' : 'Hiển thị'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto" role="tabpanel">
        {tab === 'content' && (
          <SubtitleContentEditor
            cue={selectedCue}
            durationSeconds={durationSeconds}
            onChange={onCueChange}
            onRemove={() => selectedCue && onCueRemove(selectedCue.cueId)}
          />
        )}
        {tab === 'appearance' && (
          <SubtitleAppearanceControls style={style} onChange={onStyleChange} />
        )}
      </div>
    </aside>
  );
}
