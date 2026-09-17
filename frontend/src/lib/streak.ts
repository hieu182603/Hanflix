export interface StreakState {
  streakCount: number;
  isCompletedToday: boolean;
  lastActiveDate: string | null;
  freezeCount: number;
}

const STORAGE_KEYS = {
  COUNT: 'hanflix_streak_count',
  LAST_DATE: 'hanflix_streak_last_date',
  COMPLETED_TODAY: 'hanflix_streak_completed_today',
  FREEZE: 'hanflix_streak_freeze_count',
};

/**
 * Returns the local date string in YYYY-MM-DD format
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a given date string (YYYY-MM-DD) was yesterday
 */
function isYesterday(dateStr: string): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getLocalDateString(yesterday) === dateStr;
}

/**
 * Reads the current streak state from localStorage
 */
export function getStreakState(): StreakState {
  if (typeof window === 'undefined') {
    return { streakCount: 14, isCompletedToday: false, lastActiveDate: null, freezeCount: 1 };
  }

  const today = getLocalDateString();
  const lastActiveDate = localStorage.getItem(STORAGE_KEYS.LAST_DATE);
  const rawCount = localStorage.getItem(STORAGE_KEYS.COUNT);
  const streakCount = rawCount ? parseInt(rawCount, 10) : 14;
  const freezeCount = parseInt(localStorage.getItem(STORAGE_KEYS.FREEZE) || '1', 10);

  // Check if today is completed
  const isCompletedToday = lastActiveDate === today || localStorage.getItem(STORAGE_KEYS.COMPLETED_TODAY) === 'true';

  return { streakCount, isCompletedToday, lastActiveDate, freezeCount };
}

export type LearningActivityType = 'video' | 'practice' | 'review';

export interface ActivityResult {
  updated: boolean;
  streakCount: number;
  source: LearningActivityType;
}

/**
 * Automatically records a learning activity (watching video, doing quiz/practice, flashcards).
 * If today has not been completed yet, automatically increments the streak and fires a celebratory event.
 */
export function recordLearningActivity(source: LearningActivityType = 'video'): ActivityResult {
  if (typeof window === 'undefined') {
    return { updated: false, streakCount: 14, source };
  }

  const today = getLocalDateString();
  const state = getStreakState();

  // If already completed today, do not increment again
  if (state.isCompletedToday) {
    return { updated: false, streakCount: state.streakCount, source };
  }

  // Calculate new streak count
  let newCount = state.streakCount;
  if (!state.lastActiveDate || isYesterday(state.lastActiveDate)) {
    newCount += 1;
  } else {
    // If gap, encourage the learner by incrementing
    newCount += 1;
  }

  localStorage.setItem(STORAGE_KEYS.COUNT, String(newCount));
  localStorage.setItem(STORAGE_KEYS.LAST_DATE, today);
  localStorage.setItem(STORAGE_KEYS.COMPLETED_TODAY, 'true');

  // Dispatch a global event so Header, Dropdown, and Celebration Toast react immediately
  window.dispatchEvent(
    new CustomEvent('hanflix:streak-updated', {
      detail: {
        streakCount: newCount,
        source,
        isNewStreak: true,
        date: today,
      },
    })
  );

  return { updated: true, streakCount: newCount, source };
}
