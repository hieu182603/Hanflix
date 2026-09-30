import { apiFetch } from '../api/client';
import type { ExamMetadata, HskExam, ExamResult } from '../data/hskExamData';

export function fetchExams(level?: number, category?: string): Promise<ExamMetadata[]> {
  const query = new URLSearchParams();
  if (level !== undefined) query.set('level', String(level));
  if (category) query.set('category', category);
  return apiFetch(`/exams?${query}`);
}
export function fetchExamById(id: string): Promise<HskExam> {
  return apiFetch(`/exams/${encodeURIComponent(id)}`);
}
export function submitExam(id: string, data: { answers: Record<string, string>; timeSpentSeconds: number }, submissionKey?: string): Promise<ExamResult> {
  return apiFetch(`/exams/${encodeURIComponent(id)}/submit`, {
    method: 'POST', body: JSON.stringify(data),
    ...(submissionKey ? { headers: { 'Idempotency-Key': submissionKey } } : {}),
  });
}
export interface ExamHistoryItem {
  id: string; examId: string; examCode: string; level: number;
  score: number; listeningScore: number; readingScore: number; writingScore: number;
  totalScore: number; passingScore: number; isPassed: boolean; timeSpentSeconds: number; submittedAt: string;
}
export interface ExamHistory { items: ExamHistoryItem[]; total: number; page: number; limit: number }
export function fetchMyExamHistory(page = 1): Promise<ExamHistory> {
  return apiFetch(`/exams/my-history?page=${page}`);
}
export function fetchExamAttempt(id: string): Promise<ExamResult> {
  return apiFetch(`/exams/my-history/${encodeURIComponent(id)}`);
}
