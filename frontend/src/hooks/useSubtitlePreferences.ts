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
  scale: number;
};

const DEFAULT_PREFS: SubtitlePrefs = {
  top: 'zh',
  bottom: 'vi',
  style: 'netflix',
  scale: 100,
};

function isValidTrack(value: unknown): value is SubtitleLanguageTrack {
  return value === 'zh' || value === 'pinyin' || value === 'vi' || value === 'off';
}

function readFromStorage(): SubtitlePrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<SubtitlePrefs>;
    const scale = typeof parsed.scale === 'number' && parsed.scale >= 50 && parsed.scale <= 200
      ? parsed.scale
      : DEFAULT_PREFS.scale;
    return {
      top: isValidTrack(parsed.top) ? parsed.top : DEFAULT_PREFS.top,
      bottom: isValidTrack(parsed.bottom) ? parsed.bottom : DEFAULT_PREFS.bottom,
      style: 'netflix',
      scale,
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
  setScale: (scale: number) => void;
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
  const setScale = useCallback(
    (scale: number) => setPrefs((prev) => ({ ...prev, scale })),
    [],
  );
  const reset = useCallback(() => setPrefs(DEFAULT_PREFS), []);

  return { prefs, setTop, setBottom, setStyle, setScale, reset };
}
