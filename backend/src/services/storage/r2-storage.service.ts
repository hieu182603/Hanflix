import fs from 'node:fs/promises';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';
import type { StorageService } from './storage.service.js';

export class R2StorageService implements StorageService {
  private client?: S3Client;

  private config() {
    const values = [env.R2_ACCOUNT_ID, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY, env.R2_BUCKET_NAME];
    if (values.some(value => !value)) throw new AppError(503, 'R2_NOT_CONFIGURED', 'Cloudflare R2 chưa được cấu hình');
    return {
      endpoint: env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      bucket: env.R2_BUCKET_NAME!,
    };
  }

  private getClient() {
    const config = this.config();
    this.client ??= new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
    return this.client;
  }

  async createUploadUrl(objectKey: string, contentType: 'video/mp4' | 'video/webm') {
    const config = this.config();
    const uploadUrl = await getSignedUrl(this.getClient(), new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      ContentType: contentType,
    }), { expiresIn: env.R2_UPLOAD_URL_TTL_SECONDS });
    return { uploadUrl, objectKey, expiresIn: env.R2_UPLOAD_URL_TTL_SECONDS };
  }

  async createDownloadUrl(objectKey: string) {
    if (env.R2_PUBLIC_BASE_URL) return `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${encodeURI(objectKey)}`;
    const config = this.config();
    return getSignedUrl(this.getClient(), new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }), {
      expiresIn: env.R2_DOWNLOAD_URL_TTL_SECONDS,
    });
  }

  async headObject(objectKey: string) {
    const config = this.config();
    const result = await this.getClient().send(new HeadObjectCommand({ Bucket: config.bucket, Key: objectKey }));
    return { sizeBytes: result.ContentLength ?? 0, contentType: result.ContentType, etag: result.ETag?.replaceAll('"', '') };
  }

  async downloadToFile(objectKey: string, destinationPath: string) {
    const config = this.config();
    const result = await this.getClient().send(new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }));
    if (!result.Body) throw new AppError(502, 'R2_EMPTY_OBJECT', 'R2 không trả về dữ liệu video');
    await fs.writeFile(destinationPath, await result.Body.transformToByteArray());
  }
}

export const storageService: StorageService = new R2StorageService();
