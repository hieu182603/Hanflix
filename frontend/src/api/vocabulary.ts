import { apiFetch } from './client';

export interface SavedVocabulary {
  _id: string;
  wordId: { _id: string; hanzi: string; pinyin?: string; meaningVi?: string; partOfSpeech?: string };
  sourceLessonId?: { _id: string; titleVi: string };
  nextReviewAt: string;
  repetitions: number;
  intervalDays: number;
}

export function listSavedWords(): Promise<{ items: SavedVocabulary[]; total: number; dueCount: number }> {
  return apiFetch('/vocabulary/saved');
}

export function listDueWords(): Promise<{ items: SavedVocabulary[]; count: number }> { return apiFetch('/vocabulary/due'); }

export function saveSubtitleWord(wordId: string, sourceLessonId: string, sourceCueId: string): Promise<SavedVocabulary> {
  return apiFetch('/vocabulary', { method: 'POST', body: JSON.stringify({ wordId, sourceLessonId, sourceCueId }) });
}

export function removeSavedWord(wordId: string): Promise<void> {
  return apiFetch(`/vocabulary/${encodeURIComponent(wordId)}`, { method: 'DELETE' });
}

export function reviewSavedWord(wordId: string, rating: 'again' | 'hard' | 'good' | 'easy'): Promise<SavedVocabulary> {
  return apiFetch(`/vocabulary/${encodeURIComponent(wordId)}/review`, { method: 'POST', body: JSON.stringify({ rating }) });
}

export interface VocabularyItem {
  _id: string;
  simplified: string;
  traditional?: string;
  pinyin: string;
  pinyinNumbered?: string;
  meanings: {
    vi?: string[];
    en?: string[];
  };
  hskLevel: number | '7-9';
  partOfSpeech?: string[];
  variants?: string[];
  examples?: Array<{
    chinese: string;
    pinyin?: string;
    vietnamese?: string;
    english?: string;
  }>;
  tags?: string[];
  source?: Array<{
    name: string;
    sourceId?: string;
  }>;
  status: 'published' | 'draft' | 'pending_review';
  createdAt?: string;
  updatedAt?: string;
}

export interface VocabularyStats {
  total: number;
  byLevel: Record<string, number>;
  byStatus: {
    published: number;
    pending_review: number;
    draft: number;
  };
}

export interface VocabularyListResponse {
  items: VocabularyItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ImportPreviewReport {
  mode: 'preview' | 'commit';
  strategy: 'skip_existing' | 'update_existing' | 'insert_only';
  summary: {
    total: number;
    valid: number;
    invalid: number;
    duplicatesInInput: number;
    existing: number;
    new: number;
    inserted: number;
    updated: number;
    skipped: number;
  };
  validationErrors: Array<{ row: number; item: any; error: string }>;
}

export async function getPublicVocabulary(params: {
  page?: number;
  limit?: number;
  hskLevel?: string | number;
  search?: string;
  tag?: string;
  sort?: string;
}): Promise<VocabularyListResponse> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.hskLevel) q.set('hskLevel', String(params.hskLevel));
  if (params.search) q.set('search', params.search);
  if (params.tag) q.set('tag', params.tag);
  if (params.sort) q.set('sort', params.sort);

  return apiFetch<VocabularyListResponse>(`/vocabulary?${q.toString()}`);
}

export async function getVocabularyById(id: string): Promise<VocabularyItem> {
  return apiFetch<VocabularyItem>(`/vocabulary/${id}`);
}

export async function getAdminVocabularyStats(): Promise<VocabularyStats> {
  return apiFetch<VocabularyStats>('/admin/vocabulary/stats');
}

export async function getAdminVocabularyList(params: {
  page?: number;
  limit?: number;
  hskLevel?: string;
  status?: string;
  search?: string;
  tag?: string;
  sort?: string;
}): Promise<VocabularyListResponse> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.hskLevel) q.set('hskLevel', params.hskLevel);
  if (params.status) q.set('status', params.status);
  if (params.search) q.set('search', params.search);
  if (params.tag) q.set('tag', params.tag);
  if (params.sort) q.set('sort', params.sort);

  return apiFetch<VocabularyListResponse>(`/admin/vocabulary?${q.toString()}`);
}

export async function createAdminVocabulary(data: Partial<VocabularyItem>): Promise<VocabularyItem> {
  return apiFetch<VocabularyItem>('/admin/vocabulary', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAdminVocabulary(id: string, data: Partial<VocabularyItem>): Promise<VocabularyItem> {
  return apiFetch<VocabularyItem>(`/admin/vocabulary/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteAdminVocabulary(id: string): Promise<void> {
  return apiFetch<void>(`/admin/vocabulary/${id}`, {
    method: 'DELETE',
  });
}

export async function importAdminVocabulary(payload: {
  mode: 'preview' | 'commit';
  strategy: 'skip_existing' | 'update_existing' | 'insert_only';
  items: any[];
}): Promise<ImportPreviewReport> {
  return apiFetch<ImportPreviewReport>('/admin/vocabulary/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
