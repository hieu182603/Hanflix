import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User as UserIcon,
  Shield,
  Camera,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Compass,
  Flame,
  GraduationCap,
  Lock,
  Mail,
  BadgeCheck,
  Check,
} from 'lucide-react';
import * as authApi from '../../api/auth';
import { uploadAvatarToCloudinary, restoreDefaultAvatar } from '../../api/upload';
import GoogleSignInButton from '../auth/GoogleSignInButton';
import { User, UserProfile } from '../../data/hanflixData';
import UserAvatar from '../common/UserAvatar';
import { InlineBanner } from '../notifications';
import { getStreakState } from '../../lib/streak';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
  userProfile?: UserProfile;
  onSavePreferences?: (updated: Partial<UserProfile>) => void;
  onOpenSurvey?: () => void;
  onUpdateUser?: (updated: User) => void;
}

type TabType = 'profile' | 'security';

export default function SettingsModal({
  isOpen,
  onClose,
  currentUser,
  userProfile,
  onSavePreferences,
  onOpenSurvey,
  onUpdateUser,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [currentStreak, setCurrentStreak] = useState(() => {
    const fromStorage = getStreakState().streakCount;
    return typeof fromStorage === 'number' ? fromStorage : (userProfile?.streakDays ?? 14);
  });

  useEffect(() => {
    const handleUpdate = () => {
      setCurrentStreak(getStreakState().streakCount);
    };
    if (isOpen) {
      handleUpdate();
    }
    window.addEventListener('hanflix:streak-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('hanflix:streak-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [isOpen, userProfile?.streakDays]);

  // Basic Profile editing state
  const [editName, setEditName] = useState(currentUser?.name || userProfile?.name || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // File Upload & Preview state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isRestoringAvatar, setIsRestoringAvatar] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Clean up object URL on unmount or URL change
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const isCustomAvatar = Boolean(
    currentUser?.avatarType === 'custom' ||
    (currentUser?.avatarUrl && !currentUser?.avatarUrl.includes('dicebear.com'))
  );

  const processFile = (file: File) => {
    setProfileError('');
    setProfileSuccess('');

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type.toLowerCase())) {
      setProfileError('Chỉ hỗ trợ tệp hình ảnh định dạng JPG, PNG hoặc WEBP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Kích thước ảnh không được vượt quá 5 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    executeUpload(file, localUrl);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const executeUpload = async (file: File, localUrl: string) => {
    setIsUploadingImage(true);
    setProfileError('');
    setProfileSuccess('');
    try {
      const res = await uploadAvatarToCloudinary(file);
      if (res?.user) {
        onUpdateUser?.(res.user);
      }
      setProfileSuccess('Cập nhật ảnh đại diện thành công!');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch {
      setProfileError('Không thể tải ảnh đại diện. Vui lòng kiểm tra lại mạng hoặc thử ảnh khác.');
      URL.revokeObjectURL(localUrl);
      setPreviewUrl(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRestoreDefault = async () => {
    if (isRestoringAvatar || isUploadingImage) return;
    setIsRestoringAvatar(true);
    setProfileError('');
    setProfileSuccess('');
    try {
      const res = await restoreDefaultAvatar();
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      if (res?.user) {
        onUpdateUser?.(res.user);
      }
      setProfileSuccess('Đã khôi phục avatar mặc định của bạn!');
    } catch {
      setProfileError('Không thể khôi phục avatar mặc định. Vui lòng thử lại sau.');
    } finally {
      setIsRestoringAvatar(false);
    }
  };

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [googleLinkMessage, setGoogleLinkMessage] = useState('');

  // Google unlink state
  const [unlinkPassword, setUnlinkPassword] = useState('');
  const [isUnlinkingGoogle, setIsUnlinkingGoogle] = useState(false);
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setEditName(currentUser.name);
    }
  }, [currentUser]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (editName.trim().length < 2) {
      setProfileError('Họ và tên phải có tối thiểu 2 ký tự.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const updated = await authApi.updateBasicProfile({
        name: editName.trim(),
      });
      onUpdateUser?.(updated);
      setProfileSuccess('Đã cập nhật thông tin hồ sơ thành công!');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Không thể lưu hồ sơ.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (newPassword.length < 8) {
      setPassError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setIsChangingPass(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPassSuccess('Đã đổi mật khẩu thành công! Các phiên đăng nhập khác đã được thu hồi an toàn.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err instanceof authApi.ApiRequestError) {
        setPassError(err.message);
      } else {
        setPassError('Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu hiện tại.');
      }
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleUnlinkGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoogleLinkMessage('');
    setIsUnlinkingGoogle(true);
    try {
      await authApi.unlinkGoogle(unlinkPassword);
      setGoogleLinkMessage('Đã hủy liên kết Google thành công.');
      setShowUnlinkDialog(false);
      setUnlinkPassword('');
    } catch (err) {
      setGoogleLinkMessage(err instanceof Error ? err.message : 'Không thể hủy liên kết Google.');
    } finally {
      setIsUnlinkingGoogle(false);
    }
  };

  if (!isOpen) return null;

  const hskCurrent = currentUser?.learningProfile?.hskLevel || 3;
  const hskTarget = currentUser?.learningProfile?.targetHsk || Math.min(9, hskCurrent + 1);
  const streak = currentStreak;
  const goalLabel = currentUser?.learningProfile?.goal || 'daily';
  const goalMap: Record<string, string> = {
    daily: 'Giao tiếp hàng ngày',
    travel: 'Du lịch & Khám phá',
    work: 'Công việc & Thương mại',
    hsk: 'Luyện thi chứng chỉ HSK',
    culture: 'Phim ảnh & Văn hóa',
    other: 'Sở thích cá nhân',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      {/* Outer Container with Liquid Glass Refraction Border */}
      <div className="bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-[0_25px_70px_-15px_rgba(0,0,0,0.3)] border border-zinc-200/90 flex flex-col max-h-[92vh] min-h-[580px]">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-zinc-200/80 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#B91B1C]/10 border border-[#B91B1C]/20 text-[#B91B1C] flex items-center justify-center shadow-xs">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-zinc-900 tracking-tight">Cài Đặt Tài Khoản</h2>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-zinc-100 text-zinc-600 border border-zinc-200">
                  {currentUser?.role === 'admin' ? 'Quản Trị Viên' : 'Học Viên HanFlix'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-medium">Quản lý nhận diện cá nhân, lộ trình học và bảo mật tài khoản</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Đóng cài đặt"
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-all cursor-pointer active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Navigation Pills */}
        <div className="flex md:hidden border-b border-zinc-200/80 px-4 bg-zinc-50/80 overflow-x-auto no-scrollbar shrink-0 py-2 gap-1.5">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-[#B91B1C] text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>Hồ sơ cá nhân</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'security'
                ? 'bg-[#B91B1C] text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Bảo mật</span>
          </button>
        </div>

        {/* Desktop Master-Detail Layout */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Rail (Desktop Only Master View) */}
          <div className="hidden md:flex w-64 bg-zinc-50/70 border-r border-zinc-200/80 p-4 flex-col shrink-0 select-none">
            <div className="space-y-4">
              {/* Mini Learner Profile Card */}
              <div className="p-3.5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs flex items-center gap-3">
                <div className="relative shrink-0">
                  <UserAvatar
                    user={currentUser}
                    size={42}
                    className="ring-2 ring-zinc-200/80 rounded-full"
                  />
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-zinc-900 truncate">
                    {editName || currentUser?.name || 'Học viên'}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-[#B91B1C]/10 text-[#B91B1C]">
                      HSK {hskCurrent}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-medium">· Online</span>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <nav className="space-y-1.5" aria-label="Cài đặt danh mục">
                {[
                  {
                    id: 'profile' as TabType,
                    icon: UserIcon,
                    title: 'Hồ sơ cá nhân',
                    sub: 'Ảnh đại diện & danh tính',
                  },
                  {
                    id: 'security' as TabType,
                    icon: Shield,
                    title: 'Bảo mật & Đăng nhập',
                    sub: 'Mật khẩu & tài khoản Google',
                  },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full text-left p-3 rounded-2xl transition-all relative flex items-center gap-3 cursor-pointer group ${
                        isActive
                          ? 'text-[#B91B1C]'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/80'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeTabIndicator"
                          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                          className="absolute inset-0 bg-white rounded-2xl border border-zinc-200/80 shadow-xs"
                        />
                      )}
                      <div className={`relative z-10 p-2 rounded-xl transition-colors ${
                        isActive ? 'bg-[#B91B1C] text-white shadow-xs' : 'bg-zinc-100 text-zinc-500 group-hover:text-zinc-800'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="relative z-10 min-w-0">
                        <div className="text-xs font-bold tracking-tight">{tab.title}</div>
                        <div className="text-[10px] text-zinc-400 font-medium truncate">{tab.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Right Viewport (Detail View) */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 bg-white">
            <AnimatePresence mode="wait">
              {/* TAB 1: PROFILE */}
              {activeTab === 'profile' && (
                <motion.div
                  key="tab-profile"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {/* Status Alerts */}
                  {profileSuccess && (
                    <InlineBanner variant="success" message={profileSuccess} />
                  )}
                  {profileError && (
                    <InlineBanner variant="error" message={profileError} />
                  )}

                  {/* Visual Identity & Avatar Studio Bento Card */}
                  <div className="p-6 rounded-3xl bg-zinc-50/70 border border-zinc-200/90 space-y-5">
                    <div>
                      <h3 className="text-sm font-black text-zinc-900 tracking-tight">Ảnh đại diện & Danh tính học tập</h3>
                      <p className="text-xs text-zinc-500 font-medium">Hình ảnh đại diện và tiến độ học tập trên HanFlix</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                      {/* Avatar Dropzone Frame */}
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={handleDrop}
                        className={`relative group shrink-0 cursor-pointer ${
                          isDragOver ? 'ring-3 ring-[#B91B1C] rounded-full' : ''
                        }`}
                        onClick={() => !isUploadingImage && fileInputRef.current?.click()}
                        title="Bấm để chọn ảnh từ máy tính"
                      >
                        <div className="p-1 rounded-full bg-linear-to-b from-zinc-200 to-zinc-300 shadow-sm">
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt="Preview"
                              className="w-20 h-20 rounded-full object-cover shadow-inner"
                            />
                          ) : (
                            <UserAvatar
                              user={currentUser}
                              size={80}
                              className="shadow-inner rounded-full"
                            />
                          )}
                        </div>

                        {/* Hover Camera Overlay */}
                        <div className="absolute inset-1 rounded-full bg-zinc-950/40 backdrop-blur-2xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Camera className="w-5 h-5" />
                        </div>

                        {/* Corner Floating Action Icon */}
                        <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-[#B91B1C] text-white flex items-center justify-center shadow-md ring-2 ring-white transition-transform group-hover:scale-110">
                          {isUploadingImage ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Camera className="w-3.5 h-3.5" />
                          )}
                        </div>

                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </div>

                      {/* User Profile Info & Quick Actions */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-black text-zinc-900 truncate">
                            {editName || currentUser?.name || 'Học viên'}
                          </h4>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Đang trực tuyến" />
                        </div>
                        <p className="text-xs text-zinc-500 font-medium truncate">
                          {currentUser?.email}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 pt-1.5">
                          <button
                            type="button"
                            disabled={isUploadingImage}
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs font-bold text-[#B91B1C] hover:text-[#991213] cursor-pointer flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{isUploadingImage ? 'Đang tải ảnh...' : 'Tải ảnh cá nhân'}</span>
                          </button>

                          {isCustomAvatar && (
                            <>
                              <span className="text-zinc-300 text-xs">·</span>
                              <button
                                type="button"
                                disabled={isRestoringAvatar || isUploadingImage}
                                onClick={handleRestoreDefault}
                                className="text-xs font-medium text-zinc-500 hover:text-red-600 cursor-pointer flex items-center gap-1 transition-colors disabled:opacity-50"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>{isRestoringAvatar ? 'Đang đặt lại...' : 'Dùng avatar mặc định'}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Learning Passport Strip */}
                    <div className="pt-2 border-t border-zinc-200/70 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs">
                        <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-bold">
                          <GraduationCap className="w-3.5 h-3.5 text-[#B91B1C]" />
                          <span>Cấp độ HSK</span>
                        </div>
                        <div className="text-sm font-black text-zinc-900 mt-1 flex items-baseline gap-1.5">
                          <span>HSK {hskCurrent}</span>
                          <span className="text-[11px] text-zinc-400 font-semibold">/ Mục tiêu HSK {hskTarget}</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs">
                        <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-bold">
                          <Flame className="w-3.5 h-3.5 text-amber-500" />
                          <span>Chuỗi học tập</span>
                        </div>
                        <div className="text-sm font-black text-zinc-900 mt-1 flex items-baseline gap-1">
                          <span>{streak}</span>
                          <span className="text-[11px] text-zinc-400 font-semibold">ngày liên tục</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs">
                        <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-bold">
                          <Compass className="w-3.5 h-3.5 text-[#B91B1C]" />
                          <span>Mục tiêu chính</span>
                        </div>
                        <div className="text-xs font-black text-zinc-900 mt-1 truncate">
                          {goalMap[goalLabel] || 'Giao tiếp hàng ngày'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Form Editable Information */}
                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div className="p-6 rounded-3xl bg-white border border-zinc-200/90 shadow-xs space-y-4">
                      <h3 className="text-sm font-black text-zinc-900 tracking-tight">Thông tin hiển thị học viên</h3>

                      {/* Name Input */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label htmlFor="user-name-input" className="block text-xs font-bold text-zinc-800">
                            Họ và tên hiển thị
                          </label>
                          <span className="text-[11px] text-zinc-400 font-medium">
                            {editName.length}/80 ký tự
                          </span>
                        </div>
                        <input
                          id="user-name-input"
                          type="text"
                          required
                          maxLength={80}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Nhập tên hiển thị của bạn"
                          className="w-full h-11 px-4 rounded-xl bg-white border border-zinc-300 text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#B91B1C] focus:ring-4 focus:ring-[#B91B1C]/10 transition-all"
                        />
                      </div>

                      {/* Readonly Info Rows */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/70 space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
                            <span className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-zinc-400" />
                              <span>Địa chỉ Email</span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-full font-bold">
                              <BadgeCheck className="w-3 h-3" />
                              Đã xác minh
                            </span>
                          </div>
                          <div className="text-xs font-bold text-zinc-900 truncate" title={currentUser?.email}>
                            {currentUser?.email}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/70 space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
                            <span className="flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5 text-zinc-400" />
                              <span>Vai trò hệ thống</span>
                            </span>
                            <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
                              {currentUser?.role === 'admin' ? 'Quyền cao' : 'Tiêu chuẩn'}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-zinc-900 capitalize">
                            {currentUser?.role === 'admin' ? 'Quản trị viên (Admin)' : 'Học viên HanFlix'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Learning Survey CTA Banner */}
                    <div className="p-4.5 rounded-3xl bg-linear-to-r from-zinc-50 to-[#B91B1C]/5 border border-zinc-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-black text-zinc-900">
                          <Compass className="w-4 h-4 text-[#B91B1C]" />
                          <span>Lộ trình & Mục tiêu cá nhân hóa</span>
                        </div>
                        <p className="text-xs text-zinc-600 font-medium">
                          Cập nhật trình độ HSK và sở thích để thuật toán HanFlix đề xuất video chuẩn xác nhất cho bạn.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenSurvey?.();
                        }}
                        className="shrink-0 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        Khảo sát lại
                      </button>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSavingProfile}
                        className="px-6 py-2.5 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isSavingProfile ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Đang lưu thay đổi...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Lưu thông tin hồ sơ</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* TAB 2: SECURITY & AUTH */}
              {activeTab === 'security' && (
                <motion.div
                  key="tab-security"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {/* Status Alerts */}
                  {passError && (
                    <InlineBanner variant="error" message={passError} />
                  )}
                  {passSuccess && (
                    <InlineBanner variant="success" message={passSuccess} />
                  )}

                  {/* Change Password Bento Card */}
                  <form onSubmit={handleChangePassword} className="p-6 rounded-3xl bg-white border border-zinc-200/90 shadow-xs space-y-4">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-[#B91B1C]" />
                      <h3 className="text-sm font-black text-zinc-900 tracking-tight">Đổi mật khẩu tài khoản</h3>
                    </div>
                    <p className="text-xs text-zinc-500 font-medium">Đặt mật khẩu mạnh để bảo vệ thông tin học tập và lịch sử tra từ</p>

                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1.5">
                          Mật khẩu hiện tại
                        </label>
                        <div className="relative">
                          <input
                            type={showCurrentPass ? 'text' : 'password'}
                            required
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Nhập mật khẩu đang sử dụng"
                            className="w-full h-11 px-4 pr-11 rounded-xl bg-white border border-zinc-300 text-sm font-semibold focus:outline-none focus:border-[#B91B1C] focus:ring-4 focus:ring-[#B91B1C]/10 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPass(!showCurrentPass)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-1 cursor-pointer"
                          >
                            {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-zinc-800 mb-1.5">
                            Mật khẩu mới (ít nhất 8 ký tự)
                          </label>
                          <div className="relative">
                            <input
                              type={showNewPass ? 'text' : 'password'}
                              required
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Nhập mật khẩu mới"
                              className="w-full h-11 px-4 pr-11 rounded-xl bg-white border border-zinc-300 text-sm font-semibold focus:outline-none focus:border-[#B91B1C] focus:ring-4 focus:ring-[#B91B1C]/10 transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPass(!showNewPass)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-1 cursor-pointer"
                            >
                              {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-zinc-800 mb-1.5">
                            Xác nhận mật khẩu mới
                          </label>
                          <div className="relative">
                            <input
                              type={showConfirmPass ? 'text' : 'password'}
                              required
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Nhập lại mật khẩu mới"
                              className="w-full h-11 px-4 pr-11 rounded-xl bg-white border border-zinc-300 text-sm font-semibold focus:outline-none focus:border-[#B91B1C] focus:ring-4 focus:ring-[#B91B1C]/10 transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPass(!showConfirmPass)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-1 cursor-pointer"
                            >
                              {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={isChangingPass}
                        className="px-6 py-2.5 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-98 disabled:opacity-50 flex items-center gap-2"
                      >
                        {isChangingPass ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Đang đổi mật khẩu...</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Cập nhật mật khẩu mới</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  {/* Google OAuth Link / Unlink Bento Card */}
                  <div className="p-6 rounded-3xl bg-zinc-50/70 border border-zinc-200/90 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-black text-zinc-900 tracking-tight">Liên kết tài khoản Google</h3>
                        <p className="text-xs text-zinc-500 font-medium">Đăng nhập nhanh 1 chạm bằng Google mà không cần nhập mật khẩu</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white border border-zinc-200 text-zinc-700">
                        OAuth 2.0
                      </span>
                    </div>

                    <div className="pt-2">
                      <GoogleSignInButton
                        action="continue_with"
                        onCredential={async (credential) => {
                          await authApi.linkGoogle(credential);
                          setGoogleLinkMessage('Đã liên kết tài khoản Google thành công.');
                        }}
                        onError={setGoogleLinkMessage}
                      />
                      {googleLinkMessage && (
                        <p className="text-xs text-zinc-700 font-semibold mt-2" role="status">
                          {googleLinkMessage}
                        </p>
                      )}
                    </div>

                    {/* Unlink trigger */}
                    <div className="pt-2 border-t border-zinc-200/70">
                      {!showUnlinkDialog ? (
                        <button
                          type="button"
                          onClick={() => setShowUnlinkDialog(true)}
                          className="text-xs text-zinc-500 hover:text-red-600 transition-colors font-medium cursor-pointer underline"
                        >
                          Hủy liên kết tài khoản Google khỏi HanFlix
                        </button>
                      ) : (
                        <form onSubmit={handleUnlinkGoogle} className="p-4 rounded-2xl bg-white border border-red-200 space-y-3 shadow-xs">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-red-700">
                            <AlertCircle className="w-4 h-4" />
                            <span>Xác nhận hủy liên kết Google</span>
                          </div>
                          <p className="text-[11px] text-zinc-600 font-medium">
                            Vui lòng nhập mật khẩu tài khoản HanFlix của bạn để xác thực gỡ bỏ tài khoản Google này.
                          </p>
                          <input
                            type="password"
                            required
                            value={unlinkPassword}
                            onChange={(e) => setUnlinkPassword(e.target.value)}
                            placeholder="Nhập mật khẩu tài khoản"
                            className="w-full h-10 px-3 rounded-xl bg-white border border-zinc-300 text-xs font-medium focus:outline-none focus:border-[#B91B1C]"
                          />
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setShowUnlinkDialog(false);
                                setUnlinkPassword('');
                              }}
                              className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                            >
                              Hủy
                            </button>
                            <button
                              type="submit"
                              disabled={isUnlinkingGoogle}
                              className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-2xs"
                            >
                              {isUnlinkingGoogle ? 'Đang gỡ...' : 'Xác nhận gỡ liên kết'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
