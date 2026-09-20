import { v2 as cloudinary, type UploadApiResponse, type UploadApiOptions } from 'cloudinary';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

// Configure Cloudinary from environment
if (env.CLOUDINARY_URL && env.CLOUDINARY_URL.startsWith('cloudinary://')) {
  try {
    cloudinary.config({ url: env.CLOUDINARY_URL });
  } catch {
    // fallback to discrete credentials if URL parsing fails
    if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    }
  }
} else if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}


export interface UploadResult {
  url: string;
  publicId: string;
  format: string;
  width?: number;
  height?: number;
  bytes: number;
}

export class CloudinaryService {
  isConfigured(): boolean {
    const config = cloudinary.config();
    return Boolean(config.cloud_name && config.api_key && config.api_secret);
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new AppError(
        503,
        'CLOUDINARY_NOT_CONFIGURED',
        'Dịch vụ lưu trữ ảnh Cloudinary chưa được cấu hình. Vui lòng kiểm tra biến môi trường CLOUDINARY_*.'
      );
    }
  }

  /**
   * Upload image buffer directly to Cloudinary using upload_stream.
   */
  async uploadImageBuffer(
    buffer: Buffer,
    options: {
      folder?: string;
      publicId?: string;
      tags?: string[];
      resourceType?: 'image' | 'auto';
      transformation?: UploadApiOptions['transformation'];
    } = {}
  ): Promise<UploadResult> {
    this.assertConfigured();

    const uploadOptions: UploadApiOptions = {
      folder: options.folder || 'hanflix/images',
      resource_type: options.resourceType || 'image',
      tags: options.tags || ['hanflix'],
    };

    if (options.publicId) {
      uploadOptions.public_id = options.publicId;
    }

    if (options.transformation) {
      uploadOptions.transformation = options.transformation;
    }

    return new Promise<UploadResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            let message = error?.message || 'Không thể tải ảnh lên Cloudinary';
            if (error?.http_code === 403 || message.includes('403')) {
              message = 'Cloudinary API Key thiếu quyền tải ảnh (403 Forbidden - missing "create" permission). Vui lòng kiểm tra quyền Access Key trong Cloudinary Console.';
            }
            reject(
              new AppError(
                502,
                'CLOUDINARY_UPLOAD_FAILED',
                message
              )
            );
            return;
          }

          resolve({
            url: result.secure_url || result.url,
            publicId: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
          });
        }
      );

      uploadStream.end(buffer);
    });
  }

  /**
   * Delete an image from Cloudinary by public ID.
   */
  async deleteImage(publicId?: string | null): Promise<{ result: string }> {
    if (!publicId) return { result: 'ignored' };
    if (!this.isConfigured()) return { result: 'not_configured' };
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result as { result: string };
    } catch {
      return { result: 'error' };
    }
  }
}

export const cloudinaryService = new CloudinaryService();
