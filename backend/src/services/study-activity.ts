import type { Types } from 'mongoose';
import { StudyActivityModel } from '../models/study-activity.model.js';

export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

export function toTimezoneDateKey(value = new Date(), timeZone = DEFAULT_TIMEZONE): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(value);
  } catch {
    return value.toISOString().slice(0, 10);
  }
}

export function toUtcDateKey(value = new Date()): string {
  return value.toISOString().slice(0, 10);
}

export function parseDateKey(value: string): Date {
  if (!dateKeyPattern.test(value)) throw new Error('Invalid date key');
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Invalid date key');
  }
  return date;
}

export const parseUtcDateKey = parseDateKey;

export function enumerateDateKeys(from: string, to: string): string[] {
  const current = parseDateKey(from);
  const end = parseDateKey(to);
  if (current > end) throw new Error('from must not be after to');
  const output: string[] = [];
  while (current <= end) {
    output.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return output;
}

export const enumerateUtcDateKeys = enumerateDateKeys;

export interface StudyActivityIncrement {
  activeStudySeconds?: number;
  progressUpdates?: number;
  quizAttempts?: number;
  completedLessons?: number;
}

export async function recordStudyActivity(
  userId: Types.ObjectId,
  increment: StudyActivityIncrement,
  now = new Date(),
  timeZone = DEFAULT_TIMEZONE,
) {
  const dateKey = toTimezoneDateKey(now, timeZone);
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
