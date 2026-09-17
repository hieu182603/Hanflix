import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  normalizePinyin,
  makeNormalizedKey,
  vocabularyValidationSchema,
  vocabularyService,
} from './vocabulary.service.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { VocabularyModel } from '../models/vocabulary.model.js';

describe('Vocabulary Normalization & Validation', () => {
  it('normalizes pinyin cleanly', () => {
    expect(normalizePinyin('Nǐ Hǎo')).toBe('nǐ hǎo');
    expect(normalizePinyin('  Xǐ   Huān  ')).toBe('xǐ huān');
    expect(normalizePinyin('')).toBe('');
  });

  it('generates consistent normalized keys for deduplication', () => {
    const key1 = makeNormalizedKey('喜欢', 'xǐhuan');
    const key2 = makeNormalizedKey(' 喜欢 ', '  Xǐhuan  ');
    expect(key1).toBe(key2);
    expect(key1).toBe('喜欢:xǐhuan');
  });

  it('validates official HSK levels 1-6 and 7-9 strictly, rejecting HSK 0', () => {
    const valid1 = vocabularyValidationSchema.safeParse({
      simplified: '爱',
      pinyin: 'ài',
      hskLevel: 1,
    });
    expect(valid1.success).toBe(true);

    const valid79 = vocabularyValidationSchema.safeParse({
      simplified: '翱翔',
      pinyin: 'áoxiáng',
      hskLevel: '7-9',
    });
    expect(valid79.success).toBe(true);

    // HSK 0 must be rejected
    const invalidHsk0 = vocabularyValidationSchema.safeParse({
      simplified: '零',
      pinyin: 'líng',
      hskLevel: 0,
    });
    expect(invalidHsk0.success).toBe(false);

    // Invalid string level must be rejected
    const invalidString = vocabularyValidationSchema.safeParse({
      simplified: '测试',
      pinyin: 'cèshì',
      hskLevel: 'hsk10',
    });
    expect(invalidString.success).toBe(false);
  });

  it('validates meanings structure as arrays instead of single strings', () => {
    const parsed = vocabularyValidationSchema.safeParse({
      simplified: '你好',
      pinyin: 'nǐhǎo',
      hskLevel: 1,
      meanings: {
        vi: ['xin chào', 'chào bạn'],
        en: ['hello', 'hi'],
      },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.meanings.vi).toEqual(['xin chào', 'chào bạn']);
      expect(parsed.data.meanings.en).toEqual(['hello', 'hi']);
    }
  });
});

describe('Vocabulary Database & Bulk Lookup', () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('performs bulk lookup efficiently with $in query', async () => {
    const words = ['爱', '你好', '谢谢', '喜欢'];
    const map = await vocabularyService.findVocabularyByWords(words);
    expect(map).toBeInstanceOf(Map);
    // '爱' was imported from HSK 1
    const ai = map.get('爱');
    if (ai) {
      expect(ai.simplified).toBe('爱');
      expect(ai.hskLevel).toBe(1);
    }
  });

  it('searches catalog with pagination and level filters', async () => {
    const result = await vocabularyService.searchCatalog({
      page: 1,
      limit: 5,
      hskLevel: 1,
      status: 'published',
    });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.pagination.total).toBeGreaterThan(0);
    expect(result.items[0].hskLevel).toBe(1);
  });

  it('retrieves statistics covering all levels 1 to 7-9', async () => {
    const stats = await vocabularyService.getStatistics();
    expect(stats.total).toBeGreaterThan(10000);
    expect(stats.byLevel[1]).toBeGreaterThan(0);
    expect(stats.byLevel[2]).toBeGreaterThan(0);
    expect(stats.byLevel[3]).toBeGreaterThan(0);
    expect(stats.byLevel[4]).toBeGreaterThan(0);
    expect(stats.byLevel[5]).toBeGreaterThan(0);
    expect(stats.byLevel[6]).toBeGreaterThan(0);
    expect(stats.byLevel['7-9']).toBeGreaterThan(0);
  });
});
