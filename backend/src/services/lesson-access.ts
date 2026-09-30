import { AppError } from '../errors/app-error.js';
import { LessonModel } from '../models/lesson.model.js';

type Learner = { role?: string; currentHsk?: number | null } | null | undefined;

export function learnerHsk(user: Learner): number | undefined {
  if (!user || user.role === 'admin') return undefined;
  const level = user.currentHsk;
  return typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 9 ? level : undefined;
}

export function lessonHskFilter(user: Learner, requestedHsk?: number) {
  const currentHsk = learnerHsk(user);
  // Learner only sees videos matching their current HSK level.
  const hsk = currentHsk ?? requestedHsk;
  return hsk ? { hsk } : {};
}

export async function assertLessonHsk(user: Learner, lessonId: string) {
  const hsk = learnerHsk(user);
  if (!hsk) return;
  const lesson = await LessonModel.findOne({ _id: lessonId, status: 'published' }).select('hsk').lean();
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  if (lesson.hsk !== hsk) {
    throw new AppError(403, 'HSK_LEVEL_MISMATCH', `Bài học này thuộc HSK ${lesson.hsk}. Vui lòng đặt lại khảo sát để đổi sang cấp độ này.`);
  }
}
