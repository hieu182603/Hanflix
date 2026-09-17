export interface TranslationService {
  translateChineseToVietnamese(texts: string[]): Promise<string[]>;
}
