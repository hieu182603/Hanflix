import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import type { TranslationService } from './translation/translation.service.js';
import { setTimeout as delay } from 'node:timers/promises';

// SDK v2 defaults to 2026-06-06, which returned HTTP 502 for batch requests.
// Use the stable v3 NMT contract explicitly.
function translationUrl(): URL {
  const url = new URL(env.AZURE_TRANSLATOR_ENDPOINT);
  let base = url.pathname.replace(/\/+$/, '');
  if (!base && url.hostname.endsWith('.cognitiveservices.azure.com')) base = '/translator/text/v3.0';
  url.pathname = base.endsWith('/translate') ? base : `${base}/translate`;
  url.search = new URLSearchParams({ 'api-version': '3.0', from: 'zh-Hans', to: 'vi' }).toString();
  return url;
}

export class AzureTranslationService implements TranslationService {
  async translateChineseToVietnamese(cues: string[], signal?: AbortSignal): Promise<string[]> {
    if (!cues.length) return [];
    if (!env.AZURE_TRANSLATOR_KEY || !env.AZURE_TRANSLATOR_REGION) {
      throw new AppError(503, 'AZURE_TRANSLATOR_NOT_CONFIGURED', 'Azure Translator chưa được cấu hình');
    }
    const batches: string[][] = [];
    let batch: string[] = [];
    let characters = 0;
    for (const text of cues) {
      if (!text.trim() || text.length > 50_000) {
        throw new AppError(422, 'INVALID_TRANSLATION_INPUT', 'Câu cần dịch bị trống hoặc vượt giới hạn 50.000 ký tự');
      }
      if (batch.length >= 100 || characters + text.length > 50_000) {
        batches.push(batch);
        batch = [];
        characters = 0;
      }
      batch.push(text);
      characters += text.length;
    }
    if (batch.length) batches.push(batch);

    const output: string[] = [];
    for (const items of batches) {
      signal?.throwIfAborted();
      const timeout = AbortSignal.timeout(Math.min(60_000, env.VIDEO_PROCESSING_TIMEOUT_MINUTES * 60_000));
      const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
      let response: Response;
      let raw: string;
      try {
        const init: RequestInit = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'Ocp-Apim-Subscription-Key': env.AZURE_TRANSLATOR_KEY,
            'Ocp-Apim-Subscription-Region': env.AZURE_TRANSLATOR_REGION,
          },
          body: JSON.stringify(items.map(Text => ({ Text }))),
          signal: requestSignal,
        };
        response = await fetch(translationUrl(), init);
        for (let retry = 1; response.status === 429 && retry < env.AZURE_PROVIDER_MAX_RETRIES; retry++) {
          await response.body?.cancel();
          await delay(Math.min(30_000, (Number(response.headers.get('retry-after')) || 2 ** retry) * 1000), undefined, { signal: requestSignal });
          response = await fetch(translationUrl(), init);
        }
        raw = await response.text();
      } catch (error) {
        signal?.throwIfAborted();
        throw new AppError(502, 'TRANSLATION_SUBMISSION_UNCERTAIN', timeout.aborted
          ? 'Azure Translator hết thời gian chờ phản hồi'
          : 'Không thể xác định kết quả Azure Translator do lỗi mạng');
      }
      let body: unknown;
      try { body = JSON.parse(raw); } catch { body = null; }
      if (!response.ok) {
        const providerError = (body as { error?: { code?: string | number; message?: string } } | null)?.error;
        throw new AppError(502, response.status >= 500 || response.status === 408 ? 'TRANSLATION_SUBMISSION_UNCERTAIN' : 'FAILED_TRANSLATION',
          `Azure Translator HTTP ${response.status}`);
      }
      if (!Array.isArray(body) || body.length !== items.length) {
        throw new AppError(502, 'FAILED_TRANSLATION_RESPONSE', 'Số câu dịch Azure không khớp với phụ đề');
      }
      for (const item of body) {
        const translated = Array.isArray(item?.translations)
          ? item.translations.find((value: { to?: string }) => value?.to === 'vi')?.text
          : undefined;
        if (typeof translated !== 'string' || !translated.trim()) {
          throw new AppError(502, 'FAILED_TRANSLATION_RESPONSE', 'Kết quả dịch Azure không hợp lệ');
        }
        output.push(translated);
      }
    }
    return output;
  }
}

export const translationService: TranslationService = new AzureTranslationService();
export const translateChineseToVietnamese = (cues: string[], signal?: AbortSignal) =>
  translationService.translateChineseToVietnamese(cues, signal);
