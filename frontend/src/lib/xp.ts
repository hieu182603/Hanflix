export interface XpEventDetail {
  amount: number;
  title: string;
  reason?: 'lesson' | 'quiz' | 'vocab' | 'streak' | 'other';
}

/**
 * Dispatches a global event when XP is awarded to trigger celebration toast
 * and invalidate leaderboard / dashboard queries in real-time.
 */
export function awardXP(amount: number, title: string, reason: XpEventDetail['reason'] = 'other') {
  if (typeof window === 'undefined' || amount <= 0) return;

  window.dispatchEvent(
    new CustomEvent('hanflix:xp-awarded', {
      detail: {
        amount,
        title,
        reason,
      },
    }),
  );
}
