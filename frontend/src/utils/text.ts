/**
 * Subtitle and punctuation formatting helpers.
 * Ensures Chinese Hanzi, Pinyin, and Vietnamese translations
 * display cleanly without orphaned commas or awkward spacing.
 */

/**
 * Strips awkward whitespace before punctuation marks:
 * `,`, `.`, `;`, `:`, `!`, `?`, `，`, `。`, `；`, `：`, `！`, `？`, `、`
 * and ensures standard punctuation spacing.
 */
export function cleanPunctuationSpacing(input: string): string {
  if (!input) return '';
  return input
    // Remove whitespace before any punctuation mark
    .replace(/\s+([,.:;!?，。；：！？、])/gu, '$1')
    // Ensure single space after ASCII punctuation when immediately followed by word characters
    .replace(/([,.:;!?])(?=[a-zA-Z\u00C0-\u024F\u1EA0-\u1EF9])/gu, '$1 ')
    .trim();
}

/**
 * Strip trailing punctuation (`,`, `.`, Chinese `，`, `。`, etc.) from a string
 * when clean ending without punctuation is preferred.
 */
export function stripTrailingPunctuation(input: string): string {
  if (!input) return '';
  return input.replace(/[,.，。、;；!！?？\s]+$/u, '').trimEnd();
}

/**
 * Clean up Chinese subtitles text:
 * - Fixes whitespace preceding punctuation
 * - Normalizes spacing around full-width Chinese punctuation
 */
export function cleanSubtitleText(input: string): string {
  if (!input) return '';
  return cleanPunctuationSpacing(input);
}

/**
 * Clean up Pinyin text:
 * - Removes whitespace before punctuation like `rì ,` -> `rì,` or `rì ;` -> `rì;`
 * - Ensures single space after punctuation when followed by words
 */
export function cleanPinyinText(input: string): string {
  if (!input) return '';
  return cleanPunctuationSpacing(input);
}

/**
 * Formats seconds into mm:ss (e.g. 285 -> "4:45", 65 -> "1:05")
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '0:00';
  const totalSecs = Math.round(seconds);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

