import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

let client: S3Client | undefined;

function r2Config() {
  const values = [env.R2_ACCOUNT_ID, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY, env.R2_BUCKET_NAME];
  if (values.some(value => !value)) {
    throw new AppError(503, 'R2_NOT_CONFIGURED', 'Cloudflare R2 chưa được cấu hình');
  }
  return {
    accountId: env.R2_ACCOUNT_ID!,
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    bucket: env.R2_BUCKET_NAME!,
  };
}

function getClient(): S3Client {
  const config = r2Config();
  client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return client;
}

export async function createVideoUploadUrl(objectKey: string, contentType: 'video/mp4' | 'video/webm') {
  const config = r2Config();
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: env.R2_UPLOAD_URL_TTL_SECONDS });
  return { uploadUrl, objectKey, expiresIn: env.R2_UPLOAD_URL_TTL_SECONDS };
}

export async function confirmR2Object(objectKey: string) {
  const config = r2Config();
  const result = await getClient().send(new HeadObjectCommand({ Bucket: config.bucket, Key: objectKey }));
  return {
    sizeBytes: result.ContentLength ?? 0,
    contentType: result.ContentType,
    etag: result.ETag?.replaceAll('"', ''),
  };
}

export async function createVideoDownloadUrl(objectKey: string): Promise<string> {
  if (env.R2_PUBLIC_BASE_URL) {
    return `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${encodeURI(objectKey)}`;
  }
  const config = r2Config();
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }),
    { expiresIn: env.R2_DOWNLOAD_URL_TTL_SECONDS },
  );
}
