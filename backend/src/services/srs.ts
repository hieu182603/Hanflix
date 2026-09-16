export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export type SrsState = {
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
};

export type SrsResult = SrsState & { nextReviewAt: Date };

const ratingQuality: Record<ReviewRating, number> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
};

export function scheduleReview(state: SrsState, rating: ReviewRating, now = new Date()): SrsResult {
  const quality = ratingQuality[rating];
  let repetitions = state.repetitions;
  let intervalDays = state.intervalDays;
  let easeFactor = Math.max(1.3, state.easeFactor);

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 0;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = rating === 'easy' ? 4 : 3;
    else {
      const multiplier = rating === 'hard' ? 0.8 : rating === 'easy' ? 1.3 : 1;
      intervalDays = Math.max(1, Math.round(intervalDays * easeFactor * multiplier));
    }
  }

  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  const minutes = rating === 'again' ? 10 : intervalDays * 24 * 60;
  return {
    repetitions,
    intervalDays,
    easeFactor: Number(easeFactor.toFixed(2)),
    nextReviewAt: new Date(now.getTime() + minutes * 60 * 1000),
  };
}
