import { describe, expect, it } from 'vitest';
import { parseBatchTranscriptionResult } from './azure-speech-batch.service.js';

describe('Azure batch transcription parser', () => {
  it('normalizes phrase and word timestamps from a batch result', () => {
    const result = parseBatchTranscriptionResult({
      recognizedPhrases: [{
        offsetMilliseconds: 100,
        durationMilliseconds: 900,
        nBest: [{ display: '我爱你' }],
        words: [{ text: '我', offsetMilliseconds: 100, durationMilliseconds: 300 }],
      }],
    });
    expect(result).toEqual([{
      startMs: 100,
      endMs: 1000,
      text: '我爱你',
      words: [{ text: '我', startMs: 100, endMs: 400 }],
    }]);
  });

  it('rejects an empty successful response with a useful code', () => {
    try {
      parseBatchTranscriptionResult({ phrases: [] });
      throw new Error('expected parser to throw');
    } catch (error) {
      expect(error).toMatchObject({ code: 'AZURE_ASR_EMPTY_TRANSCRIPT' });
    }
  });
});
