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
  thumbnailUrl?: string | null;
}

export interface LessonList {
  items: PublishedLesson[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export function listPublishedLessons(params: { q?: string; hsk?: number; topic?: string; page?: number; limit?: number } = {}): Promise<LessonList> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
  return apiFetch(`/lessons?${query}`);
}

export interface LessonProgress {
  lastPositionSeconds: number;
  watchedRanges: Array<{ start: number; end: number }>;
  coverage: number;
  activeStudySeconds: number;
  completed: boolean;
  bestQuizScore: number | null;
}

export function getLessonProgress(id: string): Promise<LessonProgress> {
  return apiFetch(`/lessons/${encodeURIComponent(id)}/progress`);
}

export function updateLessonProgress(id: string, input: { positionSeconds: number; watchedRange?: { start: number; end: number }; activeStudyDeltaSeconds?: number }): Promise<{ coverage: number }> {
  return apiFetch(`/lessons/${encodeURIComponent(id)}/progress`, { method: 'PATCH', body: JSON.stringify(input) });
}

export interface PublicQuestion {
  questionId: string;
  type: 'multiple_choice' | 'fill_blank';
  prompt: string;
  options: Array<{ optionId: string; text: string }>;
}

export function getLessonQuiz(id: string): Promise<{ questions: PublicQuestion[] }> {
  return apiFetch(`/lessons/${encodeURIComponent(id)}/quiz`);
}

export interface QuizResult {
  score: number;
  correctCount: number;
  totalCount: number;
  answers: Array<{ questionId: string; correct: boolean; explanationVi: string; correctOptionId?: string; acceptedAnswers?: string[] }>;
}

export function submitLessonQuiz(id: string, answers: Array<{ questionId: string; selectedOptionId?: string; textAnswer?: string }>, idempotencyKey: string): Promise<QuizResult> {
  return apiFetch(`/lessons/${encodeURIComponent(id)}/attempts`, { method: 'POST', body: JSON.stringify({ answers, idempotencyKey }) });
}

export interface LearnerDashboard {
  metrics: { completedLessons: number; savedWords: number; dueWords: number; averageQuizScore: number | null };
  continueLearning: { lessonId?: PublishedLesson; lastPositionSeconds: number } | null;
  recentProgress: Array<{ lessonId?: PublishedLesson; completed: boolean; lastPositionSeconds: number }>;
}

export function getLearnerDashboard(): Promise<LearnerDashboard> { return apiFetch('/learning/dashboard'); }

export interface LearningActivity {
  days: Array<{ date: string; activeStudySeconds: number; progressUpdates: number; quizAttempts: number; completedLessons: number }>;
  totals: { activeStudySeconds: number; progressUpdates: number; quizAttempts: number; completedLessons: number };
  timezone?: string;
}

export function getLearningActivity(): Promise<LearningActivity> { return apiFetch('/learning/activity'); }

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

export async function getRuleBasedRecommendations(): Promise<Array<{ lesson: PublishedLesson; reasonVi: string }>> {
  const data = await apiFetch<{ items: Array<{ lesson: PublishedLesson; reasonVi: string }> }>('/learning/recommendations');
  return data.items;
}


export async function askPanda(question: string): Promise<string> {
  const data = await apiFetch<{ data: { answerVi: string } }>('/ai/ask', { method: 'POST', body: JSON.stringify({ question }) });
  return data.data.answerVi;
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
