import { speechToTextService } from './speech/azure-speech-to-text.service.js';
import { azureSpeechBatchWhisperProvider } from './speech/azure-speech-batch.service.js';

export interface WordTimestamp {
  text: string;
  startMs: number;
  endMs: number;
}

export interface TranscribedSegment {
  startMs: number;
  endMs: number;
  zh: string;
  confidence?: number;
  words?: WordTimestamp[];
}

export async function transcribeAudio(audioFilePath: string, signal?: AbortSignal): Promise<TranscribedSegment[]> {
  const segments = await speechToTextService.transcribeFile(audioFilePath, signal);
  return segments.map(segment => ({
    startMs: segment.startMs,
    endMs: segment.endMs,
    zh: segment.text,
    confidence: segment.confidence,
    words: segment.words,
  }));
}

export async function transcribeAudioFromUrl(audioUrl: string, signal?: AbortSignal): Promise<TranscribedSegment[]> {
  const result = await azureSpeechBatchWhisperProvider.transcribeFromUrl(audioUrl, signal);
  return result.segments.map(segment => ({
    startMs: segment.startMs,
    endMs: segment.endMs,
    zh: segment.text,
    confidence: segment.confidence,
    words: segment.words,
  }));
}
