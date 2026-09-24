export type SpeechSegment = {
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
  words?: Array<{
    text: string;
    startMs: number;
    endMs: number;
  }>;
};

export interface SpeechToTextService {
  transcribeFile(filePath: string, signal?: AbortSignal): Promise<SpeechSegment[]>;
}
