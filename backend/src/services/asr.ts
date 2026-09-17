import { speechToTextService } from './speech/azure-speech-to-text.service.js';

export interface TranscribedSegment {
  startMs: number;
  endMs: number;
  zh: string;
  confidence?: number;
}

// Compatibility adapter retained for the existing processing pipeline.
export async function transcribeAudio(audioFilePath: string): Promise<TranscribedSegment[]> {
  const segments = await speechToTextService.transcribeFile(audioFilePath);
  return segments.map(segment => ({
    startMs: segment.startMs,
    endMs: segment.endMs,
    zh: segment.text,
    confidence: segment.confidence,
  }));
}
