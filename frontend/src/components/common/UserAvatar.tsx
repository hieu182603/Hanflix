import React, { useState, useEffect, useMemo } from 'react';
import Avatar from 'react-nice-avatar';
import { getDeterministicAvatarConfig } from '../../utils/avatar-generator';

export interface UserAvatarUser {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  avatarType?: 'generated' | 'custom' | null;
  avatarUrl?: string | null;
  avatarConfig?: any;
  googleAvatarUrl?: string | null;
  avatarAsset?: string | null;
  avatar?: string | null;
}

export interface UserAvatarProps {
  user?: UserAvatarUser | null;
  size?: number;
  shape?: 'circle' | 'rounded' | 'square';
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  alt?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = 40,
  shape = 'circle',
  className = '',
  style = {},
  onClick,
  alt,
}) => {
  const [imgError, setImgError] = useState(false);

  // Extract avatar URL if user has a custom one
  const customUrl = user?.avatarUrl || user?.googleAvatarUrl || user?.avatarAsset || user?.avatar;
  const isCustom = user?.avatarType === 'custom' || (!user?.avatarType && Boolean(customUrl && !customUrl.includes('dicebear.com')));

  // Reset img error when custom URL changes
  useEffect(() => {
    setImgError(false);
  }, [customUrl]);

  // Generate or retrieve stable avatar config
  const avatarConfig = useMemo(() => {
    if (user?.avatarConfig && typeof user.avatarConfig === 'object') {
      return user.avatarConfig;
    }
    const seed = user?.id || user?.email || user?.name || 'hanflix-user';
    return getDeterministicAvatarConfig(seed);
  }, [user?.avatarConfig, user?.id, user?.email, user?.name]);

  const borderRadius =
    shape === 'circle' ? '50%' : shape === 'rounded' ? '12px' : '4px';

  // Render custom image if available and not in error state
  if (isCustom && customUrl && !imgError) {
    return (
      <img
        src={customUrl}
        alt={alt || user?.name || 'User Avatar'}
        className={`select-none shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          aspectRatio: '1 / 1',
          objectFit: 'cover',
          borderRadius,
          ...style,
        }}
        onError={() => setImgError(true)}
        onClick={onClick}
        loading="lazy"
      />
    );
  }

  // Fallback to deterministic react-nice-avatar
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden select-none ${className}`}
      style={{
        width: size,
        height: size,
        aspectRatio: '1 / 1',
        borderRadius,
        ...style,
      }}
      onClick={onClick}
    >
      <Avatar
        {...avatarConfig}
        shape={shape}
        style={{
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
};

export default UserAvatar;
