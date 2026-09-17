import type { Types } from 'mongoose';
import { StudyActivityModel } from '../models/study-activity.model.js';

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

export function toUtcDateKey(value = new Date()): string {
  return value.toISOString().slice(0, 10);
}

export function parseUtcDateKey(value: string): Date {
  if (!dateKeyPattern.test(value)) throw new Error('Invalid UTC date key');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || toUtcDateKey(date) !== value) throw new Error('Invalid UTC date key');
  return date;
}

export function enumerateUtcDateKeys(from: string, to: string): string[] {
  const current = parseUtcDateKey(from);
  const end = parseUtcDateKey(to);
  if (current > end) throw new Error('from must not be after to');
  const output: string[] = [];
  while (current <= end) {
    output.push(toUtcDateKey(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return output;
}

export interface StudyActivityIncrement {
  activeStudySeconds?: number;
  progressUpdates?: number;
  quizAttempts?: number;
  completedLessons?: number;
}

export async function recordStudyActivity(userId: Types.ObjectId, increment: StudyActivityIncrement, now = new Date()) {
  const dateKey = toUtcDateKey(now);
  const safeIncrement = Object.fromEntries(
    Object.entries(increment).filter(([, value]) => typeof value === 'number' && value > 0),
  );
  if (Object.keys(safeIncrement).length === 0) return null;
  return StudyActivityModel.findOneAndUpdate(
    { userId, dateKey },
    { $inc: safeIncrement, $setOnInsert: { userId, dateKey } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
}
