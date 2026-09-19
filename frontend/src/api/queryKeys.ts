/**
 * Centralised query keys.
 *
 * Why a dedicated module?
 *   - React Query treats two `useQuery({ queryKey: ['lessons', ...] })` calls
 *     as sharing cache; using the SAME literal key object across files is
 *     how we guarantee that.
 *   - When we add a new query that depends on the same data, we read the
 *     key from here and we get cache for free.
 *   - It surfaces accidental key drift in code review: every call to
 *     `useQuery` shows what arguments matter.
 *
 * Keys are functions so we can clamp invalidation: e.g.
 *   `queryKeys.lessons()` matches every listing regardless of filter.
 */
export const lessonQueryKeys = {
  all: ['lessons'] as const,
  list: (params: { q?: string; hsk?: number; topic?: string; page?: number; limit?: number }) =>
    [...lessonQueryKeys.all, 'list', params] as const,
  lesson: (id: string) => ['lesson', id] as const,
  subtitles: (id: string) => ['subtitles', id] as const,
  progress: (id: string) => ['progress', id] as const,
  quiz: (id: string) => ['quiz', id] as const,
};

export const dashboardQueryKeys = {
  root: ['dashboard'] as const,
  detail: () => [...dashboardQueryKeys.root] as const,
};

export const learningQueryKeys = {
  root: ['learning'] as const,
  activity: (params: { from?: string; to?: string; timezone?: string }) =>
    [...learningQueryKeys.root, 'activity', params] as const,
  recsRule: () => [...learningQueryKeys.root, 'recs', 'rule'] as const,
  recsAi: () => [...learningQueryKeys.root, 'recs', 'ai'] as const,
};

export const vocabularyQueryKeys = {
  root: ['vocabulary'] as const,
  saved: () => [...vocabularyQueryKeys.root, 'saved'] as const,
  due: () => [...vocabularyQueryKeys.root, 'due'] as const,
};
