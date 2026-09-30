import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider, LearnerLanguageScope, useI18n, TRANSLATIONS } from './index';
import { LANGUAGE_STORAGE_KEY, translateMessage, translateUiMessage, UI_MESSAGES } from './messages';

function Probe() {
  const { tr, lang, setLang, locale } = useI18n();
  return <><output>{lang}:{tr('Thử lại')}:{(1234.5).toLocaleString(locale)}</output>
    <button onClick={() => setLang('en')}>English</button><button onClick={() => setLang('zh')}>中文</button></>;
}
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('learner language preference', () => {
  it('restores the persisted language without resetting it to the default on mount', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    const view = render(<LanguageProvider><LearnerLanguageScope enabled><Probe /></LearnerLanguageScope></LanguageProvider>);
    expect(screen.getByRole('status').textContent).toBe('en:Try again:1,234.5');
    fireEvent.click(screen.getByText('中文'));
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('zh');
    view.unmount();
    render(<LanguageProvider><LearnerLanguageScope enabled><Probe /></LearnerLanguageScope></LanguageProvider>);
    expect(screen.getByRole('status').textContent).toContain('zh:重试');
  });
  it('keeps public/admin screens Vietnamese without erasing the learner preference', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    const view = render(<LanguageProvider><LearnerLanguageScope enabled={false}><Probe /></LearnerLanguageScope></LanguageProvider>);
    expect(screen.getByRole('status').textContent).toContain('vi:Thử lại');
    expect(document.documentElement.lang).toBe('vi');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    view.rerender(<LanguageProvider><LearnerLanguageScope enabled><Probe /></LearnerLanguageScope></LanguageProvider>);
    expect(screen.getByRole('status').textContent).toContain('en:Try again');
    expect(document.documentElement.lang).toBe('en');
  });
  it('still switches language when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<LanguageProvider><Probe /></LanguageProvider>);
    fireEvent.click(screen.getByText('English'));
    expect(screen.getByRole('status').textContent).toContain('en:Try again');
  });
  it('ignores invalid preferences and synchronizes valid cross-tab changes', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'xx');
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByRole('status').textContent).toContain('vi:Thử lại');
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: LANGUAGE_STORAGE_KEY, newValue: 'en' })));
    expect(screen.getByRole('status').textContent).toContain('en:Try again');
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: LANGUAGE_STORAGE_KEY, newValue: 'invalid' })));
    expect(screen.getByRole('status').textContent).toContain('en:Try again');
  });
});

describe('translation catalogs', () => {
  const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();
  it('provides English and Chinese with the same placeholders for every UI message', () => {
    for (const [source, translations] of Object.entries(UI_MESSAGES)) {
      expect(translations, source).toHaveLength(2);
      for (const text of translations) {
        expect(text.trim().length, source).toBeGreaterThan(0);
        expect(placeholders(text), source).toEqual(placeholders(source));
      }
    }
  });
  it('keeps the original dictionary structures consistent', () => {
    const keys = (obj: object, prefix = ''): string[] => Object.entries(obj).flatMap(([key, value]) => typeof value === 'string' ? [prefix + key] : keys(value, prefix + key + '.')).sort();
    expect(keys(TRANSLATIONS.en)).toEqual(keys(TRANSLATIONS.vi));
    expect(keys(TRANSLATIONS.zh)).toEqual(keys(TRANSLATIONS.vi));
  });
  it('interpolates zero and user values without reinterpreting them or altering unknown content', () => {
    expect(translateMessage('en', 'Hết hạn sau {0}', { 0: 0 })).toBe('Expires in 0');
    expect(translateMessage('en', 'Giải thích "{0}"', { 0: '<script>{1}</script>' })).toBe('Explain "<script>{1}</script>"');
    expect(translateMessage('en', '你好 — Bài học do người dùng tạo')).toBe('你好 — Bài học do người dùng tạo');
  });
  it('translates stored UI templates while preserving interpolated values', () => {
    expect(translateUiMessage('en', 'Hết hạn sau 05:30')).toBe('Expires in 05:30');
    expect(translateUiMessage('zh', 'Giải thích "你好"')).toBe(translateMessage('zh', 'Giải thích "{0}"', { 0: '你好' }));
    expect(translateUiMessage('en', 'Nguyễn An')).toBe('Nguyễn An');
    expect(translateUiMessage('vi', 'Hết hạn sau 05:30')).toBe('Hết hạn sau 05:30');
  });
});
