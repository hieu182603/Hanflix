import { apiFetch } from './client';

export type AdminLessonStatus = 'draft' | 'uploading' | 'processing' | 'ready_for_review' | 'published' | 'hidden' | 'failed';

export interface AdminLesson {
  _id: string;
  slug: string;
  titleVi: string;
  titleZh?: string;
  pinyin?: string;
  descriptionVi: string;
  hsk: number;
  topicIds: string[];
  goalTags: string[];
  durationSeconds: number;
  status: AdminLessonStatus;
  processingStatus?: string;
  processingStep?: string;
  processingProgress?: number;
  processingError?: string;
  media?: { mimeType: string; sizeBytes: number } | null;
  createdAt?: string;
}

export interface AdminCue {
  cueId: string;
  startMs: number;
  endMs: number;
  zh: string;
  pinyin: string;
  vi: string;
}

export interface AdminQuestion {
  questionId: string;
  type: 'multiple_choice' | 'fill_blank';
  prompt: string;
  cueId?: string;
  options: Array<{ optionId: string; text: string }>;
  correctOptionId?: string;
  acceptedAnswers?: string[];
  explanationVi: string;
}

export interface AdminReview {
  lesson: Pick<AdminLesson, '_id' | 'status' | 'titleVi' | 'durationSeconds'>;
  subtitle: { cues: AdminCue[] } | null;
  quiz: { questions: AdminQuestion[] } | null;
}

export interface ProcessingStatus {
  status: 'queued' | 'running' | 'completed' | 'failed';
  stage: string;
  stageProgress: number;
  attempts: number;
  errorCode?: string;
  errorMessage?: string;
  video?: Pick<AdminLesson, 'status' | 'processingStatus' | 'processingProgress' | 'processingStep' | 'processingError'>;
}

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'locked';
  learningProfile?: { currentHsk?: number; goal?: string } | null;
  createdAt?: string;
}

export async function listAdminLessons(): Promise<AdminLesson[]> {
  const data = await apiFetch<{ items: AdminLesson[] }>('/admin/lessons');
  return data.items;
}

export function createAdminLesson(input: Omit<AdminLesson, '_id' | 'status' | 'processingStatus' | 'processingStep' | 'processingProgress' | 'processingError' | 'media' | 'createdAt'>): Promise<AdminLesson> {
  return apiFetch('/admin/lessons', { method: 'POST', body: JSON.stringify(input) });
}

export function patchAdminLesson(id: string, input: Partial<Pick<AdminLesson, 'titleVi' | 'titleZh' | 'pinyin' | 'descriptionVi' | 'hsk' | 'topicIds' | 'goalTags' | 'durationSeconds'>>): Promise<AdminLesson> {
  return apiFetch(`/admin/lessons/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function presignVideo(lessonId: string, file: File): Promise<{
  uploadUrl: string;
  objectKey: string;
  requiredHeaders: { 'Content-Type': string };
  maxBytes: number;
  clientByteSize?: number;
  uploadSessionId?: string;
  uploadedAt?: string;
}> {
  return apiFetch('/admin/uploads/presign', {
    method: 'POST',
    body: JSON.stringify({ lessonId, fileName: file.name, contentType: file.type, sizeBytes: file.size }),
  });
}

export function confirmVideo(lessonId: string, objectKey: string): Promise<{ lessonId: string; status: string; processingJobId: string }> {
  return apiFetch('/admin/uploads/confirm', { method: 'POST', body: JSON.stringify({ lessonId, objectKey }) });
}

export function cancelVideoUpload(lessonId: string): Promise<unknown> {
  return apiFetch(`/admin/lessons/${encodeURIComponent(lessonId)}/upload/cancel`, { method: 'POST' });
}

/**
 * F08 fix (2026-09-18): upload progress via XMLHttpRequest.
 *
 * Why XHR instead of fetch?
 *   - `fetch` with `duplex: 'half'` does not work reliably with all R2/CDN endpoints
 *     and throws ERR_ALPN_NEGOTIATION_FAILED when the body stream cannot negotiate
 *     HTTP/2 properly.
 *   - XMLHttpRequest's `upload.onprogress` event is universally supported, has
 *     built-in byte counters, and is easy to abort via `xhr.abort()`.
 *   - We use a per-call XHR so the caller can supply an AbortSignal that maps
 *     to xhr.abort() and exposes onProgress as a callback.
 */
export interface UploadProgressEvent {
  bytesSent: number;
  totalBytes: number;
  percent: number;
}
export async function uploadVideoToR2(
  uploadUrl: string,
  file: File,
  contentType: string,
  options: { onProgress?: (event: UploadProgressEvent) => void; signal?: AbortSignal } = {},
): Promise<void> {
  const { onProgress, signal } = options;
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', contentType);
    // XHR will automatically include cookies/credentials if `withCredentials = true`.
    // R2 presigned URLs use query-string auth so we don't need credentials here.
    if (onProgress) {
      xhr.upload.onprogress = (event: ProgressEvent) => {
        const bytesSent = event.loaded;
        const totalBytes = event.total || file.size;
        onProgress({
          bytesSent,
          totalBytes,
          percent: totalBytes > 0 ? Math.min(100, Math.round((bytesSent / totalBytes) * 100)) : 0,
        });
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`R2 từ chối video (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error('Không thể kết nối tới R2.'));
    xhr.onabort = () => reject(Object.assign(new Error('Đã hủy tải lên.'), { name: 'AbortError' }));
    xhr.ontimeout = () => reject(new Error('Tải lên quá thời gian cho phép.'));
    // Wire AbortSignal to xhr.abort() so callers can cancel mid-upload.
    const onAbort = () => xhr.abort();
    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      xhr.addEventListener('loadend', () => signal.removeEventListener('abort', onAbort), { once: true });
      xhr.addEventListener('error', () => signal.removeEventListener('abort', onAbort), { once: true });
      xhr.addEventListener('abort', () => signal.removeEventListener('abort', onAbort), { once: true });
    }
    xhr.send(file);
  });
}

export function getProcessingStatus(id: string): Promise<ProcessingStatus> {
  return apiFetch(`/admin/lessons/${encodeURIComponent(id)}/processing`);
}

export interface ProcessingJob {
  _id: string;
  lessonId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stage: string;
  stageProgress: number;
  attempts: number;
  errorMessage?: string;
}

export function listProcessingJobs(status?: ProcessingJob['status']): Promise<{ items: ProcessingJob[]; total: number }> {
  return apiFetch(`/admin/processing-jobs${status ? `?status=${status}` : ''}`);
}

export function retryProcessing(id: string): Promise<ProcessingStatus> {
  return apiFetch(`/admin/lessons/${encodeURIComponent(id)}/processing/retry`, { method: 'POST' });
}

export function getAdminReview(id: string): Promise<AdminReview> {
  return apiFetch(`/admin/lessons/${encodeURIComponent(id)}/review`);
}

export function getAdminMedia(id: string): Promise<{ media: { url: string; mimeType: string; sizeBytes: number } }> {
  return apiFetch(`/admin/lessons/${encodeURIComponent(id)}/media`);
}

export function saveAdminSubtitles(id: string, cues: AdminCue[]): Promise<unknown> {
  return apiFetch(`/admin/lessons/${encodeURIComponent(id)}/subtitles`, { method: 'PUT', body: JSON.stringify({ cues }) });
}

export function saveAdminQuiz(id: string, questions: AdminQuestion[]): Promise<unknown> {
  return apiFetch(`/admin/lessons/${encodeURIComponent(id)}/quiz`, { method: 'PUT', body: JSON.stringify({ questions }) });
}

export function publishAdminLesson(id: string): Promise<AdminLesson> {
  return apiFetch(`/admin/lessons/${encodeURIComponent(id)}/publish`, { method: 'POST' });
}

export function deleteAdminLesson(id: string): Promise<{ lessonId: string; titleVi: string; deleted: true }> {
  return apiFetch(`/admin/lessons/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function hideAdminLesson(id: string): Promise<AdminLesson> {
  return apiFetch(`/admin/lessons/${encodeURIComponent(id)}/hide`, { method: 'POST' });
}

export function restoreAdminLesson(id: string): Promise<AdminLesson> {
  return apiFetch(`/admin/lessons/${encodeURIComponent(id)}/restore`, { method: 'POST' });
}

export async function listAdminUsers(query?: string): Promise<AdminUser[]> {
  const q = query ? `?q=${encodeURIComponent(query.trim())}` : '';
  const data = await apiFetch<{ items: AdminUser[] }>(`/admin/users${q}`);
  return data.items;
}

export function setAdminUserStatus(id: string, status: 'active' | 'locked'): Promise<AdminUser> {
  return apiFetch(`/admin/users/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}
