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

export function listPublishedLessons(params: { q?: string; hsk?: number; topic?: string; page?: number; limit?: number; signal?: AbortSignal } = {}): Promise<LessonList> {
  const { signal, ...rest } = params;
  const query = new URLSearchParams();
  Object.entries(rest).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
  return apiFetch(`/lessons?${query}`, { signal });
}

export interface LessonProgress {
  lastPositionSeconds: number;
  watchedRanges: Array<{ start: number; end: number }>;
  coverage: number;
  activeStudySeconds: number;
  completed: boolean;
  bestQuizScore: number | null;
}

export function getLessonProgress(id: string, options: { signal?: AbortSignal } = {}): Promise<LessonProgress> {
  return apiFetch(`/lessons/${encodeURIComponent(id)}/progress`, options);
}

export function updateLessonProgress(id: string, input: { positionSeconds: number; watchedRange?: { start: number; end: number }; activeStudyDeltaSeconds?: number }): Promise<{ coverage: number; progress?: LessonProgress; xpEarned?: number; isNewCompletion?: boolean }> {
  return apiFetch(`/lessons/${encodeURIComponent(id)}/progress`, { method: 'PATCH', body: JSON.stringify(input) });
}

export interface PublicQuestion {
  questionId: string;
  type: 'multiple_choice' | 'fill_blank';
  prompt: string;
  options: Array<{ optionId: string; text: string }>;
}

export function getLessonQuiz(id: string, options: { signal?: AbortSignal } = {}): Promise<{ questions: PublicQuestion[] }> {
  return apiFetch(`/lessons/${encodeURIComponent(id)}/quiz`, options);
}

export interface QuizResult {
  score: number;
  correctCount: number;
  totalCount: number;
  answers: Array<{ questionId: string; correct: boolean; explanationVi: string; correctOptionId?: string; acceptedAnswers?: string[] }>;
  xpEarned?: number;
}

export function submitLessonQuiz(id: string, answers: Array<{ questionId: string; selectedOptionId?: string; textAnswer?: string }>, idempotencyKey: string): Promise<QuizResult> {
  return apiFetch(`/lessons/${encodeURIComponent(id)}/attempts`, {
    method: 'POST',
    body: JSON.stringify({ answers, idempotencyKey }),
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

export interface LearnerDashboard {
  metrics: {
    completedLessons: number;
    savedWords: number;
    dueWords: number;
    averageQuizScore: number | null;
    totalXP?: number;
    streakDays?: number;
  };
  userXP?: {
    totalXP: number;
    streakDays: number;
    completedLessons: number;
    quizAttempts: number;
    vocabReviews: number;
    minutesStudied: number;
  };
  continueLearning: { lessonId?: PublishedLesson; lastPositionSeconds: number } | null;
  recentProgress: Array<{ lessonId?: PublishedLesson; completed: boolean; lastPositionSeconds: number }>;
}

export function getLearnerDashboard(options: { signal?: AbortSignal } = {}): Promise<LearnerDashboard> { return apiFetch('/learning/dashboard', options); }

export interface LearningActivity {
  days: Array<{ date: string; activeStudySeconds: number; progressUpdates: number; quizAttempts: number; completedLessons: number }>;
  totals: { activeStudySeconds: number; progressUpdates: number; quizAttempts: number; completedLessons: number };
  timezone?: string;
}

export function getLearningActivity(options: { signal?: AbortSignal } = {}): Promise<LearningActivity> { return apiFetch('/learning/activity', options); }

export interface SubtitleCue {
  cueId: string;
  startMs: number;
  endMs: number;
  zh: string;
  pinyin: string;
  vi: string;
  tokens: Array<{ text: string; wordId?: { _id: string; hanzi: string; pinyin?: string; meaningVi?: string; partOfSpeech?: string } | null }>;
}

export interface LearningTip {
  title: string;
  detail: string;
  cueId?: string;
}

export interface SubtitleTrackMeta {
  cues: SubtitleCue[];
  /** True when Vietnamese was polished by Gemini after Azure. */
  translationImproved?: boolean;
  /** AI-generated study tips tailored to this track's content. */
  learningTips?: LearningTip[];
  /** Words worth drilling after watching, in priority order. */
  drillWords?: string[];
}

export interface WordExplanation {
  meaningVi: string;
  usageVi: string;
  exampleZh: string;
  examplePinyin: string;
  exampleVi: string;
  cautionVi?: string;
}

export async function getAiRecommendations(options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<Array<{ lesson: PublishedLesson; reasonVi: string }>> {
  const { signal, timeoutMs } = options;
  let timedSignal: AbortSignal | undefined = signal;
  let timeoutController: AbortController | undefined;
  if (timeoutMs && timeoutMs > 0 && typeof AbortController !== 'undefined') {
    timeoutController = new AbortController();
    const tid = setTimeout(() => timeoutController!.abort(), timeoutMs);
    const combined = signal
      ? composeAbortSignals([signal, timeoutController.signal])
      : timeoutController.signal;
    timedSignal = combined;
    if (timedSignal && 'addEventListener' in timedSignal) {
      const onAbort = () => clearTimeout(tid);
      timedSignal.addEventListener('abort', onAbort, { once: true });
    } else {
      clearTimeout(tid);
    }
  }
  try {
    const data = await apiFetch<{ items: Array<{ lesson: PublishedLesson; reasonVi: string }> }>('/learning/recommendations/ai', { method: 'POST', signal: timedSignal });
    return data.items;
  } finally {
    timeoutController?.abort();
  }
}

export async function getRuleBasedRecommendations(options: { signal?: AbortSignal } = {}): Promise<Array<{ lesson: PublishedLesson; reasonVi: string }>> {
  const data = await apiFetch<{ items: Array<{ lesson: PublishedLesson; reasonVi: string }> }>('/learning/recommendations', options);
  return data.items;
}

/**
 * Compose multiple AbortSignals into one. The first abort propagates.
 * Avoids a dependency on `abort-controller` polyfill.
 */
function composeAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort(sig.reason);
      return controller.signal;
    }
    sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true });
  }
  return controller.signal;
}


export async function askPanda(question: string): Promise<string> {
  const data = await apiFetch<{ answerVi: string }>('/ai/ask', { method: 'POST', body: JSON.stringify({ question }) });
  return data.answerVi;
}

export async function getPublishedLesson(id: string, options: { signal?: AbortSignal } = {}): Promise<PublishedLesson> {
  return apiFetch<PublishedLesson>(`/lessons/${encodeURIComponent(id)}`, options);
}

export async function getPublishedSubtitles(id: string, options: { signal?: AbortSignal } = {}): Promise<SubtitleTrackMeta> {
  return apiFetch<SubtitleTrackMeta>(`/lessons/${encodeURIComponent(id)}/subtitles`, options);
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

export interface HistoryProgressItem {
  _id: string;
  lessonId?: PublishedLesson;
  lesson?: PublishedLesson;
  lastPositionSeconds: number;
  activeStudySeconds?: number;
  completed: boolean;
  completedAt?: string;
  bestQuizScore?: number | null;
  updatedAt?: string;
  createdAt?: string;
}

export interface HistoryStats {
  totalLessonsLearned: number;
  completedCount: number;
  inProgressCount: number;
  totalStudySeconds: number;
  averageQuizScore: number | null;
}

export interface LearningHistoryResponse {
  items: HistoryProgressItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: HistoryStats;
}

export function getLearningHistory(params: {
  page?: number;
  limit?: number;
  status?: string;
  q?: string;
  hsk?: number;
} = {}): Promise<LearningHistoryResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return apiFetch(`/learning/history?${query}`);
}

export type LeaderboardPeriod = 'week' | 'month' | 'all';

export interface LeaderUser {
  rank: number;
  id: string;
  name: string;
  avatar: string;
  xp: number;
  streakDays: number;
  hskLevel: string;
  isMe: boolean;
  trend: 'up' | 'down' | 'same';
  trendValue?: number;
  badge?: string;
}

export interface LeaderboardResponse {
  period: LeaderboardPeriod;
  items: LeaderUser[];
  currentUserRank: LeaderUser | null;
  totalParticipants: number;
}

export function getLeaderboard(params: {
  period?: LeaderboardPeriod;
  limit?: number;
  signal?: AbortSignal;
} = {}): Promise<LeaderboardResponse> {
  const query = new URLSearchParams();
  if (params.period) query.set('period', params.period);
  if (params.limit) query.set('limit', String(params.limit));
  return apiFetch(`/learning/leaderboard?${query}`, { signal: params.signal });
}

export interface ModuleTopic {
  id: string;
  nameVi: string;
  progress: number;
  status: 'completed' | 'in_progress' | 'not_started';
  totalLessons?: number;
  completedLessons?: number;
}

export interface RoadmapStage {
  id: string;
  level: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'locked';
  progress: number;
  wordCount: string;
  grammarCount: string;
  totalLessons: number;
  completedLessons: number;
  topics: ModuleTopic[];
}

export interface RoadmapResponse {
  currentHsk: number;
  targetHsk: number;
  overallProgress: number;
  stages: RoadmapStage[];
}

export function getRoadmap(options: { signal?: AbortSignal } = {}): Promise<RoadmapResponse> {
  return apiFetch('/learning/roadmap', { signal: options.signal });
}

