import { storageService } from './storage/r2-storage.service.js';

// Compatibility wrappers keep existing route imports and response contracts unchanged.
export const createVideoUploadUrl = (
  objectKey: string,
  contentType: 'video/mp4' | 'video/webm' | 'audio/mpeg' | 'audio/mp4' | 'audio/wav' | 'audio/x-wav',
  maxBytes: number,
) => storageService.createUploadUrl(objectKey, contentType, maxBytes);

export const confirmR2Object = (objectKey: string) => storageService.headObject(objectKey);

export const createVideoDownloadUrl = (objectKey: string, expiresInSeconds?: number) => storageService.createDownloadUrl(objectKey, expiresInSeconds);

export const downloadR2Object = (objectKey: string, destinationPath: string, signal?: AbortSignal) =>
  storageService.downloadToFile(objectKey, destinationPath, signal);

export const uploadR2File = (objectKey: string, filePath: string, contentType: string) =>
  storageService.uploadFile(objectKey, filePath, contentType);

export const deleteR2Object = (objectKey: string) => storageService.deleteObject(objectKey);
