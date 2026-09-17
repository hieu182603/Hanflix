import { apiFetch } from './client';

export interface PublishedLesson {
  _id: string;
  titleVi: string;
  titleZh?: string;
  pinyin?: string;
  descriptionVi?: string;
  hsk: number;
  topicIds: string[];
  goalTags: string[];
  durationSeconds: number;
  media?: { url?: string | null } | null;
}

export interface SubtitleCue {
  cueId: string;
  startMs: number;
  endMs: number;
  zh: string;
  pinyin: string;
  vi: string;
  tokens: Array<{ text: string; wordId?: { _id: string; hanzi: string; pinyin?: string; meaningVi?: string } | null }>;
}

export interface WordExplanation {
  meaningVi: string;
  usageVi: string;
  exampleZh: string;
  examplePinyin: string;
  exampleVi: string;
  cautionVi?: string;
}

export async function getAiRecommendations(): Promise<Array<{ lesson: PublishedLesson; reasonVi: string }>> {
  const data = await apiFetch<{ items: Array<{ lesson: PublishedLesson; reasonVi: string }> }>('/learning/recommendations/ai', { method: 'POST' });
  return data.items;
}

export async function askPanda(question: string): Promise<string> {
  const data = await apiFetch<{ answerVi: string }>('/ai/ask', { method: 'POST', body: JSON.stringify({ question }) });
  return data.answerVi;
}

export async function getPublishedLesson(id: string): Promise<PublishedLesson> {
  return apiFetch<PublishedLesson>(`/lessons/${encodeURIComponent(id)}`);
}

export async function getPublishedSubtitles(id: string): Promise<SubtitleCue[]> {
  const data = await apiFetch<{ cues: SubtitleCue[] }>(`/lessons/${encodeURIComponent(id)}/subtitles`);
  return data.cues;
}

export async function explainWord(lessonId: string, cueId: string, wordId: string): Promise<WordExplanation> {
  return apiFetch<WordExplanation>('/ai/explain', {
    method: 'POST', body: JSON.stringify({ lessonId, cueId, wordId }),
  });
}

export interface LearningProfilePayload {
  currentHsk?: number;
  currentHskSource?: string;
  targetHsk?: number;
  goal?: string;
  focusSkills?: string[];
  topicIds?: string[];
  dailyMinutes?: number;
  studyDaysPerWeek?: number;
  subtitlePreference?: string;
  surveyVersion?: number;
}

export async function saveLearningProfile(payload: LearningProfilePayload): Promise<void> {
  await apiFetch('/profile/learning', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
