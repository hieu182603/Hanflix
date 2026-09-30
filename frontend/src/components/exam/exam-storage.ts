import { z } from 'zod';

export function examStorageKeys(examId = '') {
  let userId = 'anon';
  try {
    const cached: unknown = JSON.parse(localStorage.getItem('hanflix_user') ?? 'null');
    const user = z.object({ id: z.string().min(1) }).safeParse(cached);
    if (user.success) {
      userId = user.data.id;
    } else if (cached && typeof cached === 'object' && '_id' in cached && typeof cached._id === 'string' && cached._id) {
      userId = cached._id;
    }
  } catch { /* Private browsing may disable storage. */ }
  return {
    userId,
    activeExamKey: `hanflix_active_exam_id_${userId}`,
    sessionKey: `hanflix_hsk_exam_session_${userId}_${examId}`,
    lastResultKey: `hanflix_last_exam_result_${userId}`,
  };
}

export function saveLastResultId(resultId: string): void {
  try {
    const { lastResultKey } = examStorageKeys();
    localStorage.setItem(lastResultKey, resultId);
    localStorage.setItem('hanflix_last_exam_result', resultId);
  } catch { /* Storage is optional */ }
}

export function loadLastResultId(): string | null {
  try {
    const { lastResultKey } = examStorageKeys();
    const primary = localStorage.getItem(lastResultKey);
    if (primary) return primary;
    const globalFallback = localStorage.getItem('hanflix_last_exam_result');
    if (globalFallback) return globalFallback;
    return localStorage.getItem('hanflix_last_exam_result_anon');
  } catch {
    return null;
  }
}

export function clearLastResultId(): void {
  try {
    const { lastResultKey } = examStorageKeys();
    localStorage.removeItem(lastResultKey);
    localStorage.removeItem('hanflix_last_exam_result');
    localStorage.removeItem('hanflix_last_exam_result_anon');
  } catch { /* Storage is optional */ }
}

export function loadActiveExamId(): string | null {
  try {
    const { activeExamKey } = examStorageKeys();
    return localStorage.getItem(activeExamKey)
      || localStorage.getItem('hanflix_active_exam_id')
      || localStorage.getItem('hanflix_active_exam_id_anon');
  } catch {
    return null;
  }
}

export function clearActiveExam(examId = ''): void {
  try {
    const { activeExamKey, sessionKey } = examStorageKeys(examId);
    localStorage.removeItem(activeExamKey);
    localStorage.removeItem('hanflix_active_exam_id');
    localStorage.removeItem('hanflix_active_exam_id_anon');
    if (examId) {
      localStorage.removeItem(sessionKey);
      localStorage.removeItem(`hanflix_hsk_exam_session_anon_${examId}`);
    }
  } catch { /* Storage is optional */ }
}
