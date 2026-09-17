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

/** Subtitle, quiz, saved-word and AI references all point to Word, not Vocabulary. */
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
    const word = await WordModel.findOneAndUpdate(
      { hanzi: tokenText },
      { $setOnInsert: {
        hanzi: tokenText,
        pinyin: hsk?.pinyin || pinyinService.convert(tokenText),
        meaningVi: hsk?.meanings?.vi?.[0] || cue?.vi || 'chưa cập nhật',
        partOfSpeech: hsk?.partOfSpeech?.join(', ') || 'chưa phân loại',
        examples: examples.length ? examples : cue ? [{ zh: cue.zh, pinyin: cue.pinyin, vi: cue.vi }] : [],
      } },
      { upsert: true, returnDocument: 'after' },
    );
    if (!word) throw new AppError(500, 'WORD_RESOLUTION_FAILED', `Không thể liên kết từ ${tokenText}`);
    wordIds.set(tokenText, word._id as Types.ObjectId);
  }
  return wordIds;
}
