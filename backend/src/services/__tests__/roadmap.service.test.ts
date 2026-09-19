import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';

const { userModelMock, lessonModelMock, progressModelMock } = vi.hoisted(() => {
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

import { RoadmapService } from '../roadmap.service.js';

describe('RoadmapService.getRoadmap', () => {
  const userId = new Types.ObjectId().toString();
  const lesson1 = new Types.ObjectId();
  const lesson2 = new Types.ObjectId();

  beforeEach(() => {
    userModelMock.findById.mockReset();
    lessonModelMock.find.mockReset();
    progressModelMock.find.mockReset();
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
    expect(result.stages.length).toBe(6);

    // HSK 1: 1 out of 1 completed -> 100%, completed
    const hsk1 = result.stages[0];
    expect(hsk1.level).toBe('HSK 1');
    expect(hsk1.progress).toBe(100);
    expect(hsk1.status).toBe('completed');
    expect(hsk1.totalLessons).toBe(1);
    expect(hsk1.completedLessons).toBe(1);

    // HSK 2: 0 out of 1 completed, but level <= currentHsk (2) -> in_progress
    const hsk2 = result.stages[1];
    expect(hsk2.level).toBe('HSK 2');
    expect(hsk2.progress).toBe(0);
    expect(hsk2.status).toBe('in_progress');
    expect(hsk2.totalLessons).toBe(1);
    expect(hsk2.completedLessons).toBe(0);

    // HSK 3: level > currentHsk -> locked
    const hsk3 = result.stages[2];
    expect(hsk3.level).toBe('HSK 3');
    expect(hsk3.status).toBe('locked');
  });
});
