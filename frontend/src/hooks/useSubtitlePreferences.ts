import { useCallback, useEffect, useState } from 'react';
import type {
  SubtitleLanguageTrack,
  SubtitleOverlayStyle,
} from '../components/watch/SubtitleOverlay';

const STORAGE_KEY = 'hanflix_subtitle_prefs_v1';

export type SubtitlePrefs = {
  top: SubtitleLanguageTrack;
  bottom: SubtitleLanguageTrack;
  style: SubtitleOverlayStyle;
};

const DEFAULT_PREFS: SubtitlePrefs = {
  top: 'zh',
  bottom: 'pinyin',
  style: 'modern',
};

function isValidTrack(value: unknown): value is SubtitleLanguageTrack {
  return value === 'zh' || value === 'pinyin' || value === 'vi' || value === 'off';
}

function isValidStyle(value: unknown): value is SubtitleOverlayStyle {
  return value === 'modern' || value === 'classic_yellow' || value === 'netflix' || value === 'anime';
}

function readFromStorage(): SubtitlePrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<SubtitlePrefs>;
    return {
      top: isValidTrack(parsed.top) ? parsed.top : DEFAULT_PREFS.top,
      bottom: isValidTrack(parsed.bottom) ? parsed.bottom : DEFAULT_PREFS.bottom,
      style: isValidStyle(parsed.style) ? parsed.style : DEFAULT_PREFS.style,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function useSubtitlePreferences(): {
  prefs: SubtitlePrefs;
  setTop: (top: SubtitleLanguageTrack) => void;
  setBottom: (bottom: SubtitleLanguageTrack) => void;
  setStyle: (style: SubtitleOverlayStyle) => void;
  reset: () => void;
} {
  const [prefs, setPrefs] = useState<SubtitlePrefs>(() => readFromStorage());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore quota errors — preference is non-critical
    }
  }, [prefs]);

  const setTop = useCallback(
    (top: SubtitleLanguageTrack) => setPrefs((prev) => ({ ...prev, top })),
    [],
  );
  const setBottom = useCallback(
    (bottom: SubtitleLanguageTrack) => setPrefs((prev) => ({ ...prev, bottom })),
    [],
  );
  const setStyle = useCallback(
    (style: SubtitleOverlayStyle) => setPrefs((prev) => ({ ...prev, style })),
    [],
  );
  const reset = useCallback(() => setPrefs(DEFAULT_PREFS), []);

  return { prefs, setTop, setBottom, setStyle, reset };
}
