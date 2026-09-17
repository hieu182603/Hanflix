export type SpeechSegment = {
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
};

export interface SpeechToTextService {
  transcribeFile(filePath: string): Promise<SpeechSegment[]>;
}
