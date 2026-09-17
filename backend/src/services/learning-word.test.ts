import { afterEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { WordModel } from '../models/word.model.js';
import { resolveLearningWordIds } from './learning-word.js';
import { vocabularyService } from './vocabulary.service.js';

afterEach(() => vi.restoreAllMocks());

describe('learning word references', () => {
  const cues = [{
    zh: '我爱你', pinyin: 'wǒ ài nǐ', vi: 'Tôi yêu bạn',
    tokens: [{ text: '我' }, { text: '爱' }, { text: '你' }, { text: '。' }],
  }];

  it('uses Word IDs for HSK and non-HSK subtitle tokens', async () => {
    const hskId = new Types.ObjectId();
    const wordIds = [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()];
    vi.spyOn(vocabularyService, 'findVocabularyByWords').mockResolvedValue(new Map([
      ['爱', { _id: hskId, pinyin: 'ài', meanings: { vi: ['yêu'] }, partOfSpeech: ['động từ'], examples: [] }],
    ]));
    const upsert = vi.spyOn(WordModel, 'findOneAndUpdate').mockImplementation(async () => ({
      _id: wordIds[upsert.mock.calls.length - 1],
    }) as never);

    const result = await resolveLearningWordIds(cues);

    expect(result.size).toBe(3);
    expect(result.get('爱')?.equals(wordIds[1]!)).toBe(true);
    expect(result.get('爱')?.equals(hskId)).toBe(false);
    expect(upsert).toHaveBeenCalledTimes(3);
    expect(upsert.mock.calls[1]?.[0]).toEqual({ hanzi: '爱' });
    expect(upsert.mock.calls[1]?.[1]).toMatchObject({
      $setOnInsert: { pinyin: 'ài', meaningVi: 'yêu', partOfSpeech: 'động từ' },
    });
  });

  it('does not create a broken reference when Word cannot be resolved', async () => {
    vi.spyOn(vocabularyService, 'findVocabularyByWords').mockResolvedValue(new Map());
    vi.spyOn(WordModel, 'findOneAndUpdate').mockResolvedValue(null);
    await expect(resolveLearningWordIds(cues)).rejects.toMatchObject({ code: 'WORD_RESOLUTION_FAILED' });
  });
});
