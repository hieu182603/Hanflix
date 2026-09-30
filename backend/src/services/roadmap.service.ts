import { learnerHsk } from './lesson-access.js';
import { Types } from 'mongoose';
import { LessonModel } from '../models/lesson.model.js';
import { ProgressModel } from '../models/progress.model.js';
import { UserModel } from '../models/user.model.js';
import { PracticeAttemptModel } from '../models/practice.model.js';
import { StudyActivityModel } from '../models/study-activity.model.js';
import { summarizeStreak, qualifyingStudyActivity, qualifyingPracticeActivity } from './streak.js';

export interface ModuleTopic {
  id: string; nameVi: string; progress: number;
  status: 'completed' | 'in_progress' | 'not_started';
  totalLessons: number; completedLessons: number;
}
export interface RoadmapStage {
  id: string; level: string; title: string; description: string;
  status: 'completed' | 'in_progress' | 'locked' | 'unavailable';
  progress: number; wordCount: string; grammarCount: string;
  totalLessons: number; completedLessons: number; topics: ModuleTopic[];
  nextLessonId: string | null;
  lessons: Array<{ id: string; title: string; completed: boolean; durationSeconds: number }>;
}
const topicNames: Record<string, string> = {
  'daily-life': 'Đời sống', food: 'Ẩm thực', travel: 'Du lịch', shopping: 'Mua sắm',
  business: 'Kinh doanh', entertainment: 'Giải trí', general: 'Tổng hợp',
};
export class RoadmapService {
  static async getRoadmap(userId: string) {
    const user = await UserModel.findById(userId).select('role learningProfile').lean();
    const currentHsk = learnerHsk({ role: user?.role, currentHsk: user?.learningProfile?.currentHsk }) ?? 1;
    const targetHsk = Math.max(currentHsk, user?.learningProfile?.targetHsk || 6);
    const dailyMinutes = user?.learningProfile?.dailyMinutes || 15;
    const preferredTopics = new Set(user?.learningProfile?.topicIds ?? []);
    const published = await LessonModel.find({ status: 'published' }).select('_id hsk titleVi topicIds durationSeconds').lean();
    const completed = await ProgressModel.find({ userId: new Types.ObjectId(userId), completed: true }).select('lessonId').lean();
    const completedIds = new Set(completed.map(p => String(p.lessonId)));
    const practiceResults = await PracticeAttemptModel.aggregate<{ _id: { hsk: number; skill: string }; score: number; count: number }>([
      { $match: { userId: new Types.ObjectId(userId), status: 'submitted' } },
      { $sort: { submittedAt: -1, _id: -1 } },
      { $limit: 30 },
      { $group: { _id: { hsk: '$hsk', skill: '$skill' }, score: { $avg: '$score' }, count: { $sum: 1 } } },
    ]);
    const [studyDates, practiceDates] = await Promise.all([
      StudyActivityModel.aggregate<{ dateKeys: string[] }>([
        { $match: { userId: new Types.ObjectId(userId), ...qualifyingStudyActivity } },
        { $group: { _id: null, dateKeys: { $addToSet: '$dateKey' } } },
      ]),
      PracticeAttemptModel.aggregate<{ dateKeys: string[] }>([
        { $match: { userId: new Types.ObjectId(userId), ...qualifyingPracticeActivity } },
        { $group: { _id: null, dateKeys: { $addToSet: '$dateKey' } } },
      ]),
    ]);
    const stages: RoadmapStage[] = [];
    for (let level = 1; level <= 9; level++) {
      const lessons = published.filter(l => l.hsk === level).sort((a, b) => {
        const aPreferred = (a.topicIds ?? []).some(t => preferredTopics.has(t));
        const bPreferred = (b.topicIds ?? []).some(t => preferredTopics.has(t));
        return Number(bPreferred) - Number(aPreferred) || String(a._id).localeCompare(String(b._id));
      });
      const done = lessons.filter(l => completedIds.has(String(l._id))).length;
      const unlocked = user?.role === 'admin' || level === currentHsk;
      const status: RoadmapStage['status'] = !lessons.length ? 'unavailable'
        : !unlocked ? 'locked' : done === lessons.length ? 'completed' : 'in_progress';
      const topicIds = [...new Set(lessons.flatMap(l => l.topicIds?.length ? l.topicIds : ['general']))];
      const topics: ModuleTopic[] = topicIds.map(id => {
        const subset = lessons.filter(l => l.topicIds?.length ? l.topicIds.includes(id) : id === 'general');
        const count = subset.filter(l => completedIds.has(String(l._id))).length;
        return { id, nameVi: topicNames[id] ?? id, progress: Math.round(count / subset.length * 100),
          totalLessons: subset.length, completedLessons: count,
          status: count === subset.length ? 'completed' : count ? 'in_progress' : 'not_started' };
      });
      stages.push({ id: `hsk${level}`, level: `HSK ${level}`, title: `Chặng học HSK ${level}`,
        description: lessons.length ? `Chặng này có ${lessons.length} bài học. Video chỉ mở tại HSK hiện tại trong hồ sơ của bạn.` : 'Chưa có bài học được xuất bản cho cấp này.',
        status, progress: lessons.length ? Math.round(done / lessons.length * 100) : 0,
        wordCount: '', grammarCount: '', totalLessons: lessons.length, completedLessons: done, topics,
        nextLessonId: status === 'in_progress' ? String(lessons.find(l => !completedIds.has(String(l._id)))!._id) : null,
        lessons: (unlocked ? lessons : []).map(l => ({ id: String(l._id), title: l.titleVi, completed: completedIds.has(String(l._id)), durationSeconds: l.durationSeconds || 600 })),
      });
    }
    const relevant = stages.filter((_, index) => index + 1 >= currentHsk && index + 1 <= targetHsk);
    const total = relevant.reduce((sum, s) => sum + s.totalLessons, 0);
    const done = relevant.reduce((sum, s) => sum + s.completedLessons, 0);
    const dailyLessons: RoadmapStage['lessons'] = [];
    let remaining = dailyMinutes * 60;
    for (const stage of relevant.filter(s => s.status === 'in_progress')) {
      for (const lesson of stage.lessons.filter(l => !l.completed)) {
        if (dailyLessons.length && lesson.durationSeconds > remaining) continue;
        dailyLessons.push(lesson);
        remaining -= lesson.durationSeconds;
        if (remaining <= 0) break;
      }
      if (remaining <= 0) break;
    }
    const streak = summarizeStreak([...(studyDates[0]?.dateKeys ?? []), ...(practiceDates[0]?.dateKeys ?? [])]);
    return { currentHsk, targetHsk, dailyMinutes, stages, dailyLessons,
      streakDays: streak.streakCount, weekDays: streak.weekDays,
      overallProgress: total ? Math.round(done / total * 100) : 0,
      weakSkills: practiceResults.filter(r => r.score < 80).map(r => ({ hsk: r._id.hsk, skill: r._id.skill, score: Math.round(r.score), attempts: r.count })),
    };
  }
}
