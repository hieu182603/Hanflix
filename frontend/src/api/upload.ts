import { apiFetch } from './client';
import { saveUserCache } from './auth';
import type { User } from '../data/hanflixData';

export interface UploadImageResponse {
  url: string;
  publicId: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
}

export interface UploadAvatarResponse {
  url: string;
  publicId: string;
  user: User;
}

/**
 * Upload any image to Cloudinary via Hanflix backend
 */
export async function uploadImageToCloudinary(file: File): Promise<UploadImageResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return apiFetch<UploadImageResponse>('/uploads/image', {
    method: 'POST',
    body: formData,
  });
}

/**
 * Upload avatar directly to Cloudinary and update user profile
 */
export async function uploadAvatarToCloudinary(file: File): Promise<UploadAvatarResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiFetch<UploadAvatarResponse>('/uploads/avatar', {
    method: 'POST',
    body: formData,
  });

  if (res?.user) {
    saveUserCache(res.user);
  }

  return res;
}

export interface RestoreAvatarResponse {
  avatarType: 'generated';
  avatarUrl: null;
  avatarPublicId: null;
  user: User;
}

/**
 * Restore default react-nice-avatar and delete custom image on Cloudinary
 */
export async function restoreDefaultAvatar(): Promise<RestoreAvatarResponse> {
  const res = await apiFetch<RestoreAvatarResponse>('/uploads/avatar/restore', {
    method: 'POST',
  });

  if (res?.user) {
    saveUserCache(res.user);
  }

  return res;
}

