import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';
import type { SpeechSegment, SpeechToTextService } from './speech-to-text.service.js';

const responseSchema = z.object({
  phrases: z.array(z.object({
    offsetMilliseconds: z.number().nonnegative(),
    durationMilliseconds: z.number().nonnegative(),
    text: z.string().trim().min(1),
    confidence: z.number().nullable().optional(),
    words: z.array(z.object({
      text: z.string(),
      offsetMilliseconds: z.number().nonnegative(),
      durationMilliseconds: z.number().nonnegative(),
    })).optional(),
  })),
});

type FetchLike = typeof fetch;

export class AzureSpeechToTextService implements SpeechToTextService {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async transcribeFile(filePath: string, signal?: AbortSignal): Promise<SpeechSegment[]> {
    if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_ENDPOINT) {
      throw new AppError(503, 'AZURE_SPEECH_NOT_CONFIGURED', 'Azure Speech chưa được cấu hình');
    }

    signal?.throwIfAborted();
    const audio = await fs.readFile(filePath);
    const endpoint = env.AZURE_SPEECH_ENDPOINT.replace(/\/$/, '');
    const url = `${endpoint}/speechtotext/transcriptions:transcribe?api-version=${encodeURIComponent(env.AZURE_SPEECH_API_VERSION)}`;
    let lastError: unknown;

    for (let attempt = 1; attempt <= env.AZURE_PROVIDER_MAX_RETRIES; attempt += 1) {
      signal?.throwIfAborted();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), env.VIDEO_PROCESSING_TIMEOUT_MINUTES * 60_000);
      try {
        const form = new FormData();
        form.append('audio', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), path.basename(filePath));
        form.append('definition', JSON.stringify({
          locales: [env.AZURE_SPEECH_LOCALE],
          wordLevelTimestampsEnabled: true,
        }));
        const response = await this.fetchImpl(url, {
          method: 'POST',
          headers: { 'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY },
          body: form,
          signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
        });
        const body = await response.json().catch(() => undefined);
        if (!response.ok) {
          const message = typeof body === 'object' && body && 'message' in body ? String(body.message) : `HTTP ${response.status}`;
          const transient = response.status === 408 || response.status === 429 || response.status >= 500;
          if (!transient || attempt === env.AZURE_PROVIDER_MAX_RETRIES) {
            throw new AppError(502, 'FAILED_TRANSCRIPTION', `Azure Speech thất bại: ${message}`);
          }
          lastError = new Error(message);
        } else {
          const parsed = responseSchema.safeParse(body);
          if (!parsed.success) {
            const issues = parsed.error.issues.slice(0, 3).map(issue => `${issue.path.join('.') || 'response'}:${issue.message}`).join('; ');
            throw new AppError(502, 'FAILED_TRANSCRIPTION_RESPONSE', `Azure Speech response không hợp lệ: ${issues || 'schema mismatch'}`, parsed.error.flatten());
          }
          if (parsed.data.phrases.length === 0) {
            throw new AppError(502, 'AZURE_ASR_EMPTY_TRANSCRIPT', 'Azure Speech không nhận dạng được câu thoại trong audio');
          }
          return parsed.data.phrases.map(phrase => ({
            startMs: phrase.offsetMilliseconds,
            endMs: phrase.offsetMilliseconds + phrase.durationMilliseconds,
            text: phrase.text,
            confidence: phrase.confidence ?? undefined,
            words: phrase.words?.map(word => ({
              text: word.text,
              startMs: word.offsetMilliseconds,
              endMs: word.offsetMilliseconds + word.durationMilliseconds,
            })),
          }));
        }
      } catch (error) {
        signal?.throwIfAborted();
        if (error instanceof AppError) throw error;
        lastError = error;
        if (attempt === env.AZURE_PROVIDER_MAX_RETRIES) break;
      } finally {
        clearTimeout(timeout);
      }
      await new Promise(resolve => setTimeout(resolve, Math.min(1000 * 2 ** (attempt - 1), 5000)));
    }

    const message = lastError instanceof Error ? lastError.message : 'Lỗi không xác định';
    throw new AppError(504, 'FAILED_TRANSCRIPTION', `Azure Speech quá thời gian hoặc mất kết nối: ${message}`);
  }
}

export const speechToTextService: SpeechToTextService = new AzureSpeechToTextService();
