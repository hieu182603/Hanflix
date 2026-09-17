export type StoredObjectMetadata = {
  sizeBytes: number;
  contentType?: string;
  etag?: string;
};

export interface StorageService {
  createUploadUrl(objectKey: string, contentType: 'video/mp4' | 'video/webm'): Promise<{
    uploadUrl: string;
    objectKey: string;
    expiresIn: number;
  }>;
  createDownloadUrl(objectKey: string): Promise<string>;
  headObject(objectKey: string): Promise<StoredObjectMetadata>;
  downloadToFile(objectKey: string, destinationPath: string): Promise<void>;
}
