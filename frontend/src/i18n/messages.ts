import messages from './messages.json';

export type UiLanguage = 'vi' | 'en' | 'zh';
export const LOCALES = { vi: 'vi-VN', en: 'en-US', zh: 'zh-CN' } as const;
export const LANGUAGE_NAMES = { vi: 'Tiếng Việt', en: 'English', zh: '中文' } as const;
export const LANGUAGE_STORAGE_KEY = 'hanflix_language';
export const isLanguage = (value: unknown): value is UiLanguage => value === 'vi' || value === 'en' || value === 'zh';
export type MessageValues = Record<string, string | number>;
export const UI_MESSAGES: Record<string, readonly string[]> = messages;

// Used only at explicit UI boundaries (labels, toasts and errors), never on lesson
// content. This also localizes messages already stored in state before a switch.
const templates = Object.keys(UI_MESSAGES).filter(key => /\{\w+\}/.test(key)).map(key => {
  const names: string[] = [];
  const parts = key.split(/(\{\w+\})/g).map(part => {
    if (/^\{\w+\}$/.test(part)) { names.push(part.slice(1, -1)); return '(.+?)'; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return { key, names, pattern: new RegExp(`^${parts.join('')}$`, 'u') };
});

export function translateUiMessage(language: UiLanguage, source: string): string {
  if (language === 'vi' || UI_MESSAGES[source]) return translateMessage(language, source);
  for (const { key, names, pattern } of templates) {
    const match = pattern.exec(source);
    if (match) return translateMessage(language, key, Object.fromEntries(names.map((name, index) => [name, match[index + 1]])));
  }
  return source;
}

/** Source keys stay Vietnamese; only explicit UI messages belong in this catalog. */
export function translateMessage(language: UiLanguage, source: string, values?: MessageValues): string {
  const translated = language === 'vi' ? source : UI_MESSAGES[source]?.[language === 'en' ? 0 : 1] ?? source;
  return translated.replace(/\{(\w+)\}/g, (placeholder, key: string) => values && Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : placeholder);
}
