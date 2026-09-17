import { apiFetch } from './client';

export interface GrammarItem {
  _id: string;
  code?: string;
  structure: string;
  pattern?: string;
  group?: string;
  category?: string;
  details?: string;
  explanationVi: string;
  explanationEn?: string;
  hskLevel: number | '7-9';
  examples?: Array<{
    chinese: string;
    pinyin?: string;
    vietnamese?: string;
    english?: string;
  }>;
  tags?: string[];
  status: 'published' | 'draft' | 'pending_review';
  createdAt?: string;
  updatedAt?: string;
}

export interface GrammarStats {
  total: number;
  byLevel: Record<string, number>;
  byStatus: {
    published: number;
    pending_review: number;
    draft: number;
  };
}

export interface GrammarListResponse {
  items: GrammarItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function getAdminGrammarStats(): Promise<GrammarStats> {
  return apiFetch<GrammarStats>('/admin/grammar/stats');
}

export async function getAdminGrammarList(params: {
  page?: number;
  limit?: number;
  hskLevel?: string;
  status?: string;
  search?: string;
}): Promise<GrammarListResponse> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.hskLevel) q.set('hskLevel', params.hskLevel);
  if (params.status) q.set('status', params.status);
  if (params.search) q.set('search', params.search);

  return apiFetch<GrammarListResponse>(`/admin/grammar?${q.toString()}`);
}

export async function createAdminGrammar(data: Partial<GrammarItem>): Promise<GrammarItem> {
  return apiFetch<GrammarItem>('/admin/grammar', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAdminGrammar(id: string, data: Partial<GrammarItem>): Promise<GrammarItem> {
  return apiFetch<GrammarItem>(`/admin/grammar/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteAdminGrammar(id: string): Promise<void> {
  return apiFetch<void>(`/admin/grammar/${id}`, {
    method: 'DELETE',
  });
}
