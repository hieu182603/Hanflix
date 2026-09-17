type LessonLike = Record<string, unknown> & {
  status?: string | null;
  processingStatus?: string | null;
  processingStep?: string | null;
  processingProgress?: number | null;
};

export function withProcessingCompatibility<T extends LessonLike>(lesson: T) {
  if (lesson.processingStatus) return lesson;
  const mapped = lesson.status === 'failed'
    ? { processingStatus: 'FAILED', processingStep: 'FAILED', processingProgress: 0 }
    : lesson.status === 'processing'
      ? { processingStatus: 'PROCESSING', processingStep: 'TRANSCRIBING', processingProgress: 30 }
      : lesson.status === 'uploading'
        ? { processingStatus: 'UPLOADED', processingStep: 'UPLOADING', processingProgress: 0 }
        : lesson.status === 'ready_for_review' || lesson.status === 'published'
          ? { processingStatus: 'READY', processingStep: 'COMPLETED', processingProgress: 100 }
          : {};
  return { ...lesson, ...mapped };
}
