import { pinyin } from 'pinyin-pro';

export interface PinyinToken {
  text: string;
  pinyin: string;
}

export interface PinyinService {
  convert(text: string): string;
  tokenize(text: string): PinyinToken[];
}

/**
 * Converts Chinese Hanzi to Pinyin with tone marks by default
 */
export function toPinyin(
  chineseText: string,
  options: { toneType?: 'symbol' | 'num' | 'none'; nonZh?: 'spaced' | 'consecutive' } = {}
): string {
  if (!chineseText || !chineseText.trim()) return '';
  return pinyin(chineseText, {
    toneType: options.toneType ?? 'symbol',
    nonZh: options.nonZh ?? 'spaced',
  }).trim();
}

/**
 * Tokenizes Chinese text and attaches Pinyin for each character/word
 */
export function segmentTokens(chineseText: string): PinyinToken[] {
  if (!chineseText || !chineseText.trim()) return [];

  const chars = Array.from(chineseText.trim());
  const pinyinList = pinyin(chineseText.trim(), {
    type: 'array',
    toneType: 'symbol',
    nonZh: 'spaced',
  });

  if (pinyinList.length !== chars.length) {
    throw new Error('PINYIN_MAPPING_MISMATCH: contextual Pinyin output does not match text');
  }

  return chars.map((char, index) => ({
    text: char,
    pinyin: pinyinList[index] || '',
  }));
}

/**
 * Enriches subtitle cues with Pinyin and tokens
 */
export function enrichCuesWithPinyin<T extends { zh: string; pinyin?: string; tokens?: Array<{ text: string }> }>(
  cues: T[]
): T[] {
  return cues.map(cue => {
    const generatedPinyin = cue.pinyin || toPinyin(cue.zh);
    const tokens = (cue.tokens && cue.tokens.length > 0)
      ? cue.tokens
      : segmentTokens(cue.zh).map(token => ({ text: token.text }));

    return {
      ...cue,
      pinyin: generatedPinyin,
      tokens,
    };
  });
}

export const pinyinService: PinyinService = {
  convert: text => toPinyin(text),
  tokenize: text => segmentTokens(text),
};
