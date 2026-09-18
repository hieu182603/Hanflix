export type StoredObjectMetadata = {
  sizeBytes: number;
  contentType?: string;
  etag?: string;
};

export interface StorageService {
  createUploadUrl(objectKey: string, contentType: 'video/mp4' | 'video/webm', maxBytes?: number): Promise<{
    uploadUrl: string;
    objectKey: string;
    expiresIn: number;
    maxBytes?: number;
  }>;
  createDownloadUrl(objectKey: string): Promise<string>;
  headObject(objectKey: string): Promise<StoredObjectMetadata>;
  downloadToFile(objectKey: string, destinationPath: string): Promise<void>;
  uploadFile(objectKey: string, filePath: string, contentType: string): Promise<void>;
  deleteObject(objectKey: string): Promise<void>;
}
