import { describe, expect, it, vi } from 'vitest';
import { learnerHsk, lessonHskFilter, assertLessonHsk } from './lesson-access.js';
import { LessonModel } from '../models/lesson.model.js';
import { AppError } from '../errors/app-error.js';

describe('lesson-access service', () => {
  describe('learnerHsk', () => {
    it('returns undefined for admin user', () => {
      expect(learnerHsk({ role: 'admin', currentHsk: 3 })).toBeUndefined();
    });

    it('returns undefined when user is null or undefined', () => {
      expect(learnerHsk(null)).toBeUndefined();
      expect(learnerHsk(undefined)).toBeUndefined();
    });

    it('returns undefined when currentHsk is not between 1 and 9', () => {
      expect(learnerHsk({ role: 'user', currentHsk: 0 })).toBeUndefined();
      expect(learnerHsk({ role: 'user', currentHsk: 10 })).toBeUndefined();
      expect(learnerHsk({ role: 'user', currentHsk: null })).toBeUndefined();
    });

    it('returns valid HSK level for learners', () => {
      expect(learnerHsk({ role: 'user', currentHsk: 3 })).toBe(3);
      expect(learnerHsk({ role: 'user', currentHsk: 6 })).toBe(6);
    });
  });

  describe('lessonHskFilter', () => {
    it('forces learner current HSK even if another HSK is requested', () => {
      const learner = { role: 'user', currentHsk: 3 };
      expect(lessonHskFilter(learner, 5)).toEqual({ hsk: 3 });
      expect(lessonHskFilter(learner, undefined)).toEqual({ hsk: 3 });
    });

    it('uses requested HSK for admin or guest users', () => {
      expect(lessonHskFilter({ role: 'admin', currentHsk: 3 }, 5)).toEqual({ hsk: 5 });
      expect(lessonHskFilter(null, 4)).toEqual({ hsk: 4 });
      expect(lessonHskFilter(null, undefined)).toEqual({});
    });
  });

  describe('assertLessonHsk', () => {
    it('allows access if user has no restricted HSK (e.g. admin or guest)', async () => {
      await expect(assertLessonHsk(null, 'lesson-1')).resolves.toBeUndefined();
      await expect(assertLessonHsk({ role: 'admin', currentHsk: 3 }, 'lesson-1')).resolves.toBeUndefined();
    });

    it('throws 404 if lesson is not found', async () => {
      vi.spyOn(LessonModel, 'findOne').mockReturnValue({
        select: () => ({
          lean: () => Promise.resolve(null),
        }),
      } as any);

      const learner = { role: 'user', currentHsk: 3 };
      await expect(assertLessonHsk(learner, 'lesson-not-found')).rejects.toThrow(
        expect.objectContaining({
          statusCode: 404,
          code: 'LESSON_NOT_FOUND',
        })
      );
    });

    it('throws 403 HSK_LEVEL_MISMATCH when lesson HSK does not match learner HSK', async () => {
      vi.spyOn(LessonModel, 'findOne').mockReturnValue({
        select: () => ({
          lean: () => Promise.resolve({ _id: 'lesson-1', hsk: 5 }),
        }),
      } as any);

      const learner = { role: 'user', currentHsk: 3 };
      await expect(assertLessonHsk(learner, 'lesson-1')).rejects.toThrow(
        expect.objectContaining({
          statusCode: 403,
          code: 'HSK_LEVEL_MISMATCH',
        })
      );
    });

    it('resolves cleanly when lesson HSK matches learner HSK', async () => {
      vi.spyOn(LessonModel, 'findOne').mockReturnValue({
        select: () => ({
          lean: () => Promise.resolve({ _id: 'lesson-1', hsk: 3 }),
        }),
      } as any);

      const learner = { role: 'user', currentHsk: 3 };
      await expect(assertLessonHsk(learner, 'lesson-1')).resolves.toBeUndefined();
    });
  });
});
