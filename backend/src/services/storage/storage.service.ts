export type StoredObjectMetadata = {
  sizeBytes: number;
  contentType?: string;
  etag?: string;
};

export interface StorageService {
  createUploadUrl(objectKey: string, contentType: 'video/mp4' | 'video/webm' | 'audio/mpeg' | 'audio/mp4' | 'audio/wav' | 'audio/x-wav', maxBytes?: number): Promise<{
    uploadUrl: string;
    objectKey: string;
    expiresIn: number;
    maxBytes?: number;
  }>;
  createDownloadUrl(objectKey: string, expiresInSeconds?: number): Promise<string>;
  headObject(objectKey: string): Promise<StoredObjectMetadata>;
  downloadToFile(objectKey: string, destinationPath: string, signal?: AbortSignal): Promise<void>;
  uploadFile(objectKey: string, filePath: string, contentType: string): Promise<void>;
  deleteObject(objectKey: string): Promise<void>;
}
