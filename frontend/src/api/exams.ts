import { apiFetch } from './client';
import type { ExamMetadata, ExamQuestion, ExamSection, HskExam } from '../data/hskExamData';

export type ExamCategory = HskExam['category'];

export interface AdminExamQuestion extends ExamQuestion {
  correctAnswer: string;
  acceptedAnswers?: string[];
  explanationVi: string;
}

export interface AdminExamSection extends Omit<ExamSection, 'questions'> {
  questions: AdminExamQuestion[];
}

/** Full exam document including answer keys, as edited in the admin modal. */
export interface AdminExamInput extends Omit<HskExam, 'id' | 'attemptCount' | 'averageScore' | 'sections'> {
  isPublished: boolean;
  sections: AdminExamSection[];
}

export interface AdminExamDetail extends AdminExamInput {
  id: string;
  attemptCount: number;
}

export interface AdminExamSummary extends ExamMetadata {
  isPublished: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminExamStats {
  total: number;
  totalAttempts: number;
  published: number;
  draft: number;
  byLevel: Record<string, number>;
}

export interface AdminExamListResponse {
  items: AdminExamSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export function getAdminExamStats(): Promise<AdminExamStats> {
  return apiFetch<AdminExamStats>('/admin/exams/stats');
}

export function getAdminExamList(params: {
  page?: number;
  limit?: number;
  level?: string;
  category?: string;
  status?: string;
  search?: string;
}): Promise<AdminExamListResponse> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.level) q.set('level', params.level);
  if (params.category) q.set('category', params.category);
  if (params.status) q.set('status', params.status);
  if (params.search) q.set('search', params.search);
  return apiFetch<AdminExamListResponse>(`/admin/exams?${q.toString()}`);
}

export function getAdminExam(id: string): Promise<AdminExamDetail> {
  return apiFetch<AdminExamDetail>(`/admin/exams/${encodeURIComponent(id)}`);
}

export function createAdminExam(data: AdminExamInput): Promise<AdminExamSummary> {
  return apiFetch<AdminExamSummary>('/admin/exams', { method: 'POST', body: JSON.stringify(data) });
}

export function updateAdminExam(id: string, data: AdminExamInput): Promise<AdminExamSummary> {
  return apiFetch<AdminExamSummary>(`/admin/exams/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function setAdminExamPublished(id: string, isPublished: boolean): Promise<AdminExamSummary> {
  return apiFetch<AdminExamSummary>(`/admin/exams/${encodeURIComponent(id)}/publish`, {
    method: 'PATCH',
    body: JSON.stringify({ isPublished }),
  });
}

export function deleteAdminExam(id: string): Promise<void> {
  return apiFetch<void>(`/admin/exams/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export interface GenerateAdminExamRequest {
  level: number;
  category: ExamCategory;
  skills?: Array<'listening' | 'reading' | 'writing'>;
  questionsPerSection: number;
  referenceExamIds?: string[];
  topic?: string;
  notes?: string;
}

export interface GenerateAdminExamResponse {
  /** Unsaved draft; open it in the editor so the admin reviews before creating. */
  exam: AdminExamInput;
  references: Array<{ id: string; code: string; title: string; level: number }>;
  warnings: string[];
}

export function generateAdminExam(data: GenerateAdminExamRequest, signal?: AbortSignal): Promise<GenerateAdminExamResponse> {
  return apiFetch<GenerateAdminExamResponse>('/admin/exams/generate', { method: 'POST', body: JSON.stringify(data), signal });
}
