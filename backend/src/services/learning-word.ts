import { Types } from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { WordModel } from '../models/word.model.js';
import { pinyinService } from './pinyin.js';
import { vocabularyService } from './vocabulary.service.js';

interface LearningCue {
  zh: string;
  pinyin: string;
  vi: string;
  tokens: Array<{ text: string }>;
}

/**
 * Subtitle, quiz, saved-word and AI references all point to Word, not Vocabulary.
 *
 * F12 fix (2026-09-18): When a token has no HSK vocabulary match, we no longer
 * fall back to the whole-cue Vietnamese translation as the word's meaning. That
 * was polluting the dictionary: a single Chinese character would inherit the
 * meaning of the sentence it appeared in, then be re-used in unrelated contexts
 * with that wrong meaning.
 *
 * New behavior:
 *   - If we have a HSK vocabulary match → use its meaning.
 *   - If we DON'T → upsert the Word with meaningVi = null and a `needsReview` flag
 *     so the admin can fill it in later. We still keep pinyin and POS defaults.
 *   - $setOnInsert is preserved for new words, so subsequent pipeline runs do NOT
 *     clobber admin-edited meanings (only `needsReview` and a few metadata fields
 *     are touched on existing words).
 */
export async function resolveLearningWordIds(cues: LearningCue[]): Promise<Map<string, Types.ObjectId>> {
  const uniqueTokens = Array.from(new Set(
    cues.flatMap(cue => cue.tokens.map(token => token.text).filter(text => /[\u4e00-\u9fff]/.test(text))),
  ));
  const hskWords = await vocabularyService.findVocabularyByWords(uniqueTokens);
  const wordIds = new Map<string, Types.ObjectId>();

  for (const tokenText of uniqueTokens) {
    const hsk = hskWords.get(tokenText);
    const cue = cues.find(item => item.tokens.some(token => token.text === tokenText));
    const examples = hsk?.examples
      ?.filter((example: { chinese?: string; pinyin?: string; vietnamese?: string }) =>
        example.chinese && example.pinyin && example.vietnamese)
      .map((example: { chinese: string; pinyin: string; vietnamese: string }) => ({
        zh: example.chinese,
        pinyin: example.pinyin,
        vi: example.vietnamese,
      })) ?? [];

    // Build the $setOnInsert payload (only fires for new words).
    const setOnInsert: Record<string, unknown> = {
      hanzi: tokenText,
      pinyin: hsk?.pinyin || pinyinService.convert(tokenText),
      // F12: only assign meaningVi when we have a real HSK match. Otherwise leave
      // it null and mark for review so the admin can fill it in correctly.
      meaningVi: hsk?.meanings?.vi?.[0] ?? null,
      partOfSpeech: hsk?.partOfSpeech?.join(', ') || 'chưa phân loại',
      examples: examples.length ? examples : cue ? [{ zh: cue.zh, pinyin: cue.pinyin, vi: cue.vi }] : [],
      needsReview: !hsk,
      // When the meaning came from a HSK entry we can be confident; when it did not,
      // we still leave meaningVi null above and only set review flag.
    };

    const word = await WordModel.findOneAndUpdate(
      { hanzi: tokenText },
      { $setOnInsert: setOnInsert },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    if (!word) throw new AppError(500, 'WORD_RESOLUTION_FAILED', `Không thể liên kết từ ${tokenText}`);
    wordIds.set(tokenText, word._id as Types.ObjectId);
  }
  return wordIds;
}
