// Azure fast transcription with phrase-level speaker labels. Failures remain retryable.
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';
import { logger } from '../logger.js';

const responseSchema = z.object({
  phrases: z.array(z.object({
    offsetMilliseconds: z.number().nonnegative(),
    durationMilliseconds: z.number().nonnegative(),
    text: z.string().trim().min(1),
    confidence: z.number().optional(),
    speaker: z.number().int().nonnegative().optional(),
    words: z.array(z.object({
      text: z.string(),
      offsetMilliseconds: z.number().nonnegative(),
      durationMilliseconds: z.number().nonnegative(),
      speaker: z.number().int().nonnegative().optional(),
    })).optional(),
  })).min(1),
});

export interface DiarizedSegment {
  startMs: number;
  endMs: number;
  text: string;
  speakerId: string; // 'speaker-0', 'speaker-1', ...
  confidence?: number;
  words?: Array<{
    text: string;
    startMs: number;
    endMs: number;
    speakerId?: string;
  }>;
}

export interface DiarizationResult {
  segments: DiarizedSegment[];
  /** Danh sách unique speakerId được phát hiện (vd ['speaker-0', 'speaker-1']). */
  speakers: string[];
  /** Source quyết định: 'azure-diarization' nếu thành công, 'azure-asr-fallback' nếu fallback. */
  source: 'azure-diarization' | 'azure-asr-fallback';
}

/**
 * Gọi Azure Speech với diarization enabled.
 *
 * Schema response khi có diarization:
 *   - mỗi phrase có field `speaker: number` (0-based)
 *   - mỗi word cũng có `speaker: number` (khớp với phrase cha)
 *
 * Reference: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/fast-transcription-create
 */
export async function diarizeAudio(audioPath: string, signal?: AbortSignal): Promise<DiarizationResult> {
  if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_ENDPOINT) {
    throw new AppError(503, 'AZURE_SPEECH_NOT_CONFIGURED', 'Azure Speech chưa được cấu hình');
  }

  signal?.throwIfAborted();
  const audio = await fs.readFile(audioPath);
  const endpoint = env.AZURE_SPEECH_ENDPOINT.replace(/\/$/, '');
  const url = `${endpoint}/speechtotext/transcriptions:transcribe?api-version=${encodeURIComponent(env.AZURE_SPEECH_API_VERSION)}`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= env.AZURE_PROVIDER_MAX_RETRIES; attempt += 1) {
    signal?.throwIfAborted();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.VIDEO_PROCESSING_TIMEOUT_MINUTES * 60_000);
    try {
      const form = new FormData();
      form.append('audio', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), path.basename(audioPath));
      // Definition: bật diarization, giới hạn 10 speakers (đủ cho drama ngắn)
      form.append('definition', JSON.stringify({
        locales: [env.AZURE_SPEECH_LOCALE],
        wordLevelTimestampsEnabled: true,
        diarization: {
          enabled: true,
          maxSpeakers: 10,
        },
      }));
      const response = await fetch(url, {
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
          throw new AppError(502, 'FAILED_DIARIZATION', `Azure Speech diarization thất bại: ${message}`);
        }
        lastError = new Error(message);
        continue;
      }
      const parsed = responseSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError(502, 'FAILED_DIARIZATION_RESPONSE', 'Azure trả về dữ liệu diarization không hợp lệ', parsed.error.flatten());
      }
      const speakersSet = new Set<string>();
      const segments: DiarizedSegment[] = parsed.data.phrases.map(phrase => {
        const speakerId = phrase.speaker !== undefined ? `speaker-${phrase.speaker}` : 'speaker-0';
        speakersSet.add(speakerId);
        return {
          startMs: phrase.offsetMilliseconds,
          endMs: phrase.offsetMilliseconds + phrase.durationMilliseconds,
          text: phrase.text,
          speakerId,
          confidence: phrase.confidence,
          words: phrase.words?.map(word => ({
            text: word.text,
            startMs: word.offsetMilliseconds,
            endMs: word.offsetMilliseconds + word.durationMilliseconds,
            speakerId: word.speaker !== undefined ? `speaker-${word.speaker}` : undefined,
          })),
        };
      });
      logger.info({ segments: segments.length, speakers: speakersSet.size }, '[SpeakerDiarization] Azure success');
      return {
        segments,
        speakers: [...speakersSet].sort(),
        source: 'azure-diarization',
      };
    } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof AppError) throw error;
      lastError = error;
      logger.warn(
        { attempt, error: error instanceof Error ? error.message : String(error) },
        '[SpeakerDiarization] attempt failed',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new AppError(502, 'FAILED_DIARIZATION', `Azure diarization thất bại sau ${env.AZURE_PROVIDER_MAX_RETRIES} lần: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}
