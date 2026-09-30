import { Types, type PipelineStage } from 'mongoose';
import { ExamAttemptModel } from '../models/exam-attempt.model.js';
import { DEFAULT_TIMEZONE } from './study-activity.js';

export interface ExamActivityDay {
  userId: Types.ObjectId;
  dateKey: string;
  examAttempts: number;
  examStudySeconds: number;
}

// Attempts are immutable and unique by (userId, submissionKey). Read them
// directly so retries, old results and partial failures need no counter repair.
export function examActivityPipeline(userId?: Types.ObjectId, range?: { from: string; to: string }): PipelineStage[] {
  return [
    { $match: {
      ...(userId ? { userId } : {}),
      submittedAt: { $type: 'date' },
      $expr: { $gt: [{ $size: { $filter: {
        input: { $objectToArray: { $ifNull: ['$answers', {}] } },
        as: 'answer', cond: { $ne: [{ $trim: { input: '$$answer.v' } }, ''] },
      } } }, 0] },
    } },
    { $project: {
      userId: 1,
      dateKey: { $dateToString: { date: '$submittedAt', format: '%Y-%m-%d', timezone: DEFAULT_TIMEZONE } },
      timeSpentSeconds: { $max: [0, { $ifNull: ['$timeSpentSeconds', 0] }] },
    } },
    ...(range ? [{ $match: { dateKey: { $gte: range.from, $lte: range.to } } }] : []),
    { $group: { _id: { userId: '$userId', dateKey: '$dateKey' },
      examAttempts: { $sum: 1 }, examStudySeconds: { $sum: '$timeSpentSeconds' } } },
    { $project: { _id: 0, userId: '$_id.userId', dateKey: '$_id.dateKey', examAttempts: 1, examStudySeconds: 1 } },
  ];
}

export function getExamActivity(userId?: Types.ObjectId, range?: { from: string; to: string }) {
  return ExamAttemptModel.aggregate<ExamActivityDay>(examActivityPipeline(userId, range));
}
