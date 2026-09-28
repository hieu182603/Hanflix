import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AiCitation, LessonAiContext } from '../../api/learning';

export interface LearningAISource {
  lessonId: string;
  title: string;
  hskLevel: number;
  revision?: number;
  status: 'loading' | 'ready' | 'missing';
  activeCue?: AiCitation;
  snapshot: () => LessonAiContext;
  seek: (startMs: number) => void;
}
interface LearningAIState {
  source: LearningAISource | null;
  register: (source: LearningAISource) => () => void;
  selected: { lessonId: string; cue?: AiCitation } | null;
  selectCue: (lessonId: string, cue?: AiCitation) => void;
}
const Context = createContext<LearningAIState>({ source: null, register: () => () => {}, selected: null, selectCue: () => {} });

export function LearningAIProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<LearningAISource | null>(null);
  const [selected, setSelected] = useState<LearningAIState['selected']>(null);
  useEffect(() => { setSelected(null); }, [source?.lessonId, source?.revision]);
  const register = useCallback((next: LearningAISource) => {
    setSource(next);
    return () => setSource(current => current === next ? null : current);
  }, []);
  const selectCue = useCallback((lessonId: string, cue?: AiCitation) => setSelected({ lessonId, cue }), []);
  const value = useMemo(() => ({ source, register, selected, selectCue }), [source, register, selected, selectCue]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useLearningAI = () => useContext(Context);
export const formatAiTime = (ms: number) => `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${Math.floor(ms / 1000 % 60).toString().padStart(2, '0')}`;
