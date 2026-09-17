import { describe, expect, it } from 'vitest';
import { toPinyin, segmentTokens, enrichCuesWithPinyin } from './pinyin.js';

describe('pinyin service', () => {
  it('converts chinese text to tone-marked pinyin', () => {
    expect(toPinyin('你好')).toBe('nǐ hǎo');
    expect(toPinyin('学中文')).toBe('xué zhōng wén');
  });

  it('converts with custom tone options', () => {
    expect(toPinyin('你好', { toneType: 'none' })).toBe('ni hao');
    expect(toPinyin('你好', { toneType: 'num' })).toBe('ni3 hao3');
  });

  it('segments text into character tokens', () => {
    const tokens = segmentTokens('中文');
    expect(tokens).toEqual([
      { text: '中', pinyin: 'zhōng' },
      { text: '文', pinyin: 'wén' },
    ]);
  });

  it('enriches cues with pinyin and token data', () => {
    const cues = [{ zh: '再见' }];
    const enriched = enrichCuesWithPinyin(cues);
    expect(enriched[0].pinyin).toBe('zài jiàn');
    expect(enriched[0].tokens?.length).toBe(2);
  });
});
