import { speechToTextService } from './speech/azure-speech-to-text.service.js';

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

export async function transcribeAudio(audioFilePath: string): Promise<TranscribedSegment[]> {
  const segments = await speechToTextService.transcribeFile(audioFilePath);
  return segments.map(segment => ({
    startMs: segment.startMs,
    endMs: segment.endMs,
    zh: segment.text,
    confidence: segment.confidence,
    words: segment.words,
  }));
}
