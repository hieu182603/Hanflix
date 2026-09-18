import { storageService } from './storage/r2-storage.service.js';

// Compatibility wrappers keep existing route imports and response contracts unchanged.
export const createVideoUploadUrl = (
  objectKey: string,
  contentType: 'video/mp4' | 'video/webm',
  maxBytes: number,
) => storageService.createUploadUrl(objectKey, contentType, maxBytes);

export const confirmR2Object = (objectKey: string) => storageService.headObject(objectKey);

export const createVideoDownloadUrl = (objectKey: string) => storageService.createDownloadUrl(objectKey);

export const downloadR2Object = (objectKey: string, destinationPath: string) =>
  storageService.downloadToFile(objectKey, destinationPath);

export const uploadR2File = (objectKey: string, filePath: string, contentType: string) =>
  storageService.uploadFile(objectKey, filePath, contentType);

export const deleteR2Object = (objectKey: string) => storageService.deleteObject(objectKey);
