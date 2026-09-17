import TextTranslationClient, { TranslatorCredential, isUnexpected } from '@azure-rest/ai-translation-text';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import type { TranslationService } from './translation/translation.service.js';

let client: ReturnType<typeof TextTranslationClient> | undefined;

function getClient() {
  if (!env.AZURE_TRANSLATOR_KEY || !env.AZURE_TRANSLATOR_REGION) {
    throw new AppError(503, 'AZURE_TRANSLATOR_NOT_CONFIGURED', 'Azure Translator chưa được cấu hình');
  }
  client ??= TextTranslationClient(env.AZURE_TRANSLATOR_ENDPOINT, {
    key: env.AZURE_TRANSLATOR_KEY,
    region: env.AZURE_TRANSLATOR_REGION,
  } satisfies TranslatorCredential);
  return client;
}

export class AzureTranslationService implements TranslationService {
  async translateChineseToVietnamese(cues: string[]): Promise<string[]> {
    if (cues.length === 0) return [];
    const translator = getClient();
    const output: string[] = [];

    for (let start = 0; start < cues.length; start += 100) {
      const batch = cues.slice(start, start + 100);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), env.VIDEO_PROCESSING_TIMEOUT_MINUTES * 60_000);
      let response;
      try {
        response = await translator.path('/translate').post({
          body: { inputs: batch.map(text => ({ text, language: 'zh-Hans', targets: [{ language: 'vi' }] })) },
          abortSignal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (isUnexpected(response)) {
        const body = response.body as { error?: { message?: string } };
        throw new AppError(502, 'FAILED_TRANSLATION', body.error?.message || 'Azure Translator trả về lỗi');
      }
      output.push(...response.body.value.map(item => item.translations[0]?.text || ''));
    }

    if (output.length !== cues.length || output.some(text => !text.trim())) {
      throw new AppError(502, 'FAILED_TRANSLATION_RESPONSE', 'Kết quả dịch Azure không hợp lệ');
    }
    return output;
  }
}

export const translationService: TranslationService = new AzureTranslationService();

export const translateChineseToVietnamese = (cues: string[]) =>
  translationService.translateChineseToVietnamese(cues);
