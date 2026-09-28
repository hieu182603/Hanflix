import { apiFetch } from './client';

export const skillLabels = { vocabulary: 'Từ vựng', listening: 'Nghe', reading: 'Đọc', writing: 'Viết câu ngắn' } as const;
export type PracticeSkill = keyof typeof skillLabels;
export interface PracticeQuestion {
  id: string; type: 'choice' | 'short_answer'; prompt: string; audioUrl?: string;
  options: Array<{ id: string; text: string }>;
  correctOptionId?: string; acceptedAnswers?: string[]; explanation?: string; correct?: boolean;
}
export interface PracticeSet {
  id: string; title: string; hsk: number; skill: PracticeSkill; revision: number;
  durationSeconds: number; questionCount: number;
}
export interface PracticeAttempt {
  id: string; setId: string; title: string; hsk: number; skill: PracticeSkill;
  status: 'in_progress' | 'submitted'; version: number; startedAt: string; expiresAt: string; serverNow: string;
  submittedAt?: string; answers: Record<string, string>; flagged: string[]; questions: PracticeQuestion[];
  score?: number; correctCount?: number; rewardXp?: number;
}
export interface PracticeSetInput {
  title: string; hsk: number; skill: PracticeSkill; status: 'draft' | 'published'; durationSeconds: number;
  questions: PracticeQuestion[]; revision?: number;
}
export interface PracticeFilters { hsk?: number; skill?: PracticeSkill; page?: number }
function query(params: PracticeFilters & { status?: string }) {
  return new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString();
}
export function getPracticeSets(filters: PracticeFilters, signal?: AbortSignal) {
  return apiFetch<{ items: PracticeSet[]; totalPages: number; total: number }>(`/practice/sets?${query(filters)}`, { signal });
}
export function getPracticeHistory(filters: PracticeFilters, signal?: AbortSignal) {
  return apiFetch<{ items: Array<Omit<PracticeAttempt, 'questions' | 'answers' | 'flagged'>>; totalPages: number }>(`/practice/attempts?${query(filters)}`, { signal });
}
export const getPracticeAttempt = (id: string) => apiFetch<PracticeAttempt>(`/practice/attempts/${encodeURIComponent(id)}`);
export const startPractice = (setId: string, requestKey: string) => apiFetch<PracticeAttempt>('/practice/attempts', { method: 'POST', body: JSON.stringify({ setId, requestKey }) });
export interface AttemptAnswers { version: number; answers: Record<string, string>; flagged: string[] }
export const savePractice = (id: string, input: AttemptAnswers) => apiFetch<PracticeAttempt>(`/practice/attempts/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
export const submitPractice = (id: string, input: AttemptAnswers) => apiFetch<PracticeAttempt>(`/practice/attempts/${id}/submit`, { method: 'POST', body: JSON.stringify(input) });
export function getAdminPracticeSets(filters: PracticeFilters & { status?: string }, signal?: AbortSignal) {
  return apiFetch<{ items: Array<PracticeSetInput & { _id: string; revision: number }>; totalPages: number }>(`/admin/practice-sets?${query(filters)}`, { signal });
}
export const getAdminPracticeSet = (id: string) => apiFetch<PracticeSetInput & { _id: string; revision: number }>(`/admin/practice-sets/${id}`);
export const saveAdminPracticeSet = (input: PracticeSetInput, id?: string) => apiFetch<PracticeSetInput & { _id: string; revision: number }>(`/admin/practice-sets${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) });
