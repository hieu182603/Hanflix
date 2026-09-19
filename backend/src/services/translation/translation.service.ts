export interface TranslationService {
  translateChineseToVietnamese(texts: string[], signal?: AbortSignal): Promise<string[]>;
}
