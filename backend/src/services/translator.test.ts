import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/env.js', () => ({ env: { AZURE_TRANSLATOR_KEY: 'test-key', AZURE_TRANSLATOR_REGION: 'eastasia', AZURE_TRANSLATOR_ENDPOINT: 'https://api.cognitive.microsofttranslator.com', VIDEO_PROCESSING_TIMEOUT_MINUTES: 1 } }));
import { env } from '../config/env.js';
import { translateChineseToVietnamese } from './translator.js';
const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); env.AZURE_TRANSLATOR_ENDPOINT = 'https://api.cognitive.microsofttranslator.com'; });
const ok = (texts: string[]) => new Response(JSON.stringify(texts.map(text => ({ translations: [{ to: 'vi', text }] }))));
describe('Azure Translator', () => {
  it('uses v3 body and preserves cue ordering across batches', async () => {
    const texts = Array.from({ length: 101 }, (_, i) => `句${i}`);
    fetchMock.mockImplementation(async (_url, options) => ok(JSON.parse(options.body).map((x: { Text: string }) => `vi:${x.Text}`)));
    expect(await translateChineseToVietnamese(texts)).toEqual(texts.map(x => `vi:${x}`));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url.searchParams.get('api-version')).toBe('3.0');
    expect(url.searchParams.get('to')).toBe('vi');
    expect(JSON.parse(options.body)).toHaveLength(100);
  });
  it('splits by total character limit', async () => {
    fetchMock.mockImplementation(async () => ok(['dịch']));
    expect(await translateChineseToVietnamese(['中'.repeat(30000), '文'.repeat(30000)])).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('reports plain-text gateway errors with HTTP status', async () => {
    fetchMock.mockResolvedValue(new Response('upstream protocol error', { status: 502 }));
    await expect(translateChineseToVietnamese(['你好'])).rejects.toMatchObject({ code: 'TRANSLATION_SUBMISSION_UNCERTAIN', message: 'Azure Translator HTTP 502' });
  });
  it('reports provider error codes', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 401000, message: 'Invalid subscription' } }), { status: 401 }));
    await expect(translateChineseToVietnamese(['你好'])).rejects.toThrow('HTTP 401');
  });
  it.each([[], [{ translations: [] }], [{ translations: [{ to: 'en', text: 'hello' }] }], [{ translations: [{ to: 'vi', text: 123 }] }], { value: [] }])('rejects malformed result %j', async body => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body)));
    await expect(translateChineseToVietnamese(['你好'])).rejects.toMatchObject({ code: 'FAILED_TRANSLATION_RESPONSE' });
  });
  it('skips empty input and rejects invalid cues before sending', async () => {
    expect(await translateChineseToVietnamese([])).toEqual([]);
    await expect(translateChineseToVietnamese([' '])).rejects.toMatchObject({ code: 'INVALID_TRANSLATION_INPUT' });
    await expect(translateChineseToVietnamese(['中'.repeat(50001)])).rejects.toMatchObject({ code: 'INVALID_TRANSLATION_INPUT' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('cancels an in-flight request with the worker signal', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason))));
    const promise = translateChineseToVietnamese(['你好'], controller.signal);
    controller.abort(new Error('LEASE_REVOKED'));
    await expect(promise).rejects.toThrow('LEASE_REVOKED');
  });
  it('supports resource-specific Azure endpoints', async () => {
    env.AZURE_TRANSLATOR_ENDPOINT = 'https://example.cognitiveservices.azure.com/';
    fetchMock.mockResolvedValue(ok(['xin chào']));
    await translateChineseToVietnamese(['你好']);
    expect(fetchMock.mock.calls[0]![0].pathname).toBe('/translator/text/v3.0/translate');
  });
});
