import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';

const { userModelMock, lessonModelMock, progressModelMock, practiceAttemptModelMock, studyActivityModelMock } = vi.hoisted(() => {
  return {
    userModelMock: {
      findById: vi.fn(),
    },
    lessonModelMock: {
      find: vi.fn(),
    },
    progressModelMock: {
      find: vi.fn(),
    },
    practiceAttemptModelMock: {
      aggregate: vi.fn(),
    },
    studyActivityModelMock: {
      aggregate: vi.fn(),
    },
  };
});

vi.mock('../../models/user.model.js', () => ({
  UserModel: userModelMock,
}));

vi.mock('../../models/lesson.model.js', () => ({
  LessonModel: lessonModelMock,
}));

vi.mock('../../models/progress.model.js', () => ({
  ProgressModel: progressModelMock,
}));
vi.mock('../../models/practice.model.js', () => ({
  PracticeAttemptModel: practiceAttemptModelMock,
}));
vi.mock('../../models/study-activity.model.js', () => ({
  StudyActivityModel: studyActivityModelMock,
}));

import { RoadmapService } from '../roadmap.service.js';

describe('RoadmapService.getRoadmap', () => {
  const userId = new Types.ObjectId().toString();
  const lesson1 = new Types.ObjectId();
  const lesson2 = new Types.ObjectId();

  beforeEach(() => {
    userModelMock.findById.mockReset();
    lessonModelMock.find.mockReset();
    progressModelMock.find.mockReset();
    practiceAttemptModelMock.aggregate.mockReset();
    practiceAttemptModelMock.aggregate.mockResolvedValue([]);
    studyActivityModelMock.aggregate.mockReset();
    studyActivityModelMock.aggregate.mockResolvedValue([]);
  });

  it('calculates HSK stage progress correctly', async () => {
    userModelMock.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: userId,
          learningProfile: { currentHsk: 2, targetHsk: 5 },
        }),
      }),
    });

    lessonModelMock.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: lesson1, hsk: 1, titleVi: 'Bài 1', topicIds: ['food'] },
          { _id: lesson2, hsk: 2, titleVi: 'Bài 2', topicIds: ['travel'] },
        ]),
      }),
    });

    progressModelMock.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { lessonId: lesson1 }, // Completed lesson 1 (HSK 1)
        ]),
      }),
    });

    const result = await RoadmapService.getRoadmap(userId);

    expect(result.currentHsk).toBe(2);
    expect(result.targetHsk).toBe(5);
    expect(result.stages.length).toBe(9);

    // Previous progress remains, but a lower level is no longer accessible.
    const hsk1 = result.stages[0];
    expect(hsk1.level).toBe('HSK 1');
    expect(hsk1.progress).toBe(100);
    expect(hsk1.status).toBe('locked');
    expect(hsk1.lessons).toEqual([]);
    expect(hsk1.nextLessonId).toBeNull();
    expect(hsk1.totalLessons).toBe(1);
    expect(hsk1.completedLessons).toBe(1);

    // Only the exact current level is accessible.
    const hsk2 = result.stages[1];
    expect(hsk2.level).toBe('HSK 2');
    expect(hsk2.progress).toBe(0);
    expect(hsk2.status).toBe('in_progress');
    expect(hsk2.totalLessons).toBe(1);
    expect(hsk2.completedLessons).toBe(0);

    // HSK 3: level > currentHsk -> locked
    const hsk3 = result.stages[2];
    expect(hsk3.level).toBe('HSK 3');
    expect(hsk3.status).toBe('unavailable');
    expect(hsk1.topics).toEqual([{
      id: 'food', nameVi: 'Ẩm thực', progress: 100, status: 'completed',
      totalLessons: 1, completedLessons: 1,
    }]);
    expect(hsk2.topics[0].progress).toBe(0);
    expect(hsk2.topics[0].status).toBe('not_started');
    expect(hsk3.topics).toEqual([]);
  });

  it('does not unlock another HSK when all current-level lessons are completed', async () => {
    userModelMock.findById.mockReturnValue({ select: () => ({ lean: async () => ({
      role: 'user', learningProfile: { currentHsk: 2, targetHsk: 3 },
    }) }) });
    lessonModelMock.find.mockReturnValue({ select: () => ({ lean: async () => [
      { _id: lesson1, hsk: 2, titleVi: 'HSK 2', topicIds: [] },
      { _id: lesson2, hsk: 3, titleVi: 'HSK 3', topicIds: [] },
    ] }) });
    progressModelMock.find.mockReturnValue({ select: () => ({ lean: async () => [{ lessonId: lesson1 }] }) });
    const result = await RoadmapService.getRoadmap(userId);
    expect(result.stages[1].status).toBe('completed');
    expect(result.stages[2]).toMatchObject({ status: 'locked', lessons: [], nextLessonId: null });
    expect(result.dailyLessons).toEqual([]);
  });

  it('does not manufacture progress when the catalog is empty', async () => {
    userModelMock.findById.mockReturnValue({ select: () => ({ lean: async () => ({
      learningProfile: { currentHsk: 4, targetHsk: 6 },
    }) }) });
    lessonModelMock.find.mockReturnValue({ select: () => ({ lean: async () => [] }) });
    progressModelMock.find.mockReturnValue({ select: () => ({ lean: async () => [] }) });
    const result = await RoadmapService.getRoadmap(userId);
    expect(result.overallProgress).toBe(0);
    expect(result.stages.every(stage => stage.progress === 0 && stage.status === 'unavailable' && stage.topics.length === 0)).toBe(true);
  });
});
