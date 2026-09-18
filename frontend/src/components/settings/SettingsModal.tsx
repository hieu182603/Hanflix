import React, { useState } from 'react';
import {
  X,
  Settings,
  Shield,
  Sliders,
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Compass,
} from 'lucide-react';
import * as authApi from '../../api/auth';
import { saveLearningProfile } from '../../api/learning';
import GoogleSignInButton from '../auth/GoogleSignInButton';
import { UserProfile } from '../../data/hanflixData';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: {
    id?: string;
    name: string;
    email: string;
    role?: string;
    learningProfile?: any;
  } | null;
  userProfile?: UserProfile;
  onSavePreferences?: (updated: Partial<UserProfile>) => void;
  onOpenSurvey?: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  currentUser,
  userProfile,
  onSavePreferences,
  onOpenSurvey,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'learning'>('profile');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [googleLinkMessage, setGoogleLinkMessage] = useState('');

  // Learning preferences state
  const [subtitleMode, setSubtitleMode] = useState<'all' | 'zh-pinyin' | 'zh'>(
    userProfile?.subtitleMode || 'all'
  );
  const [autoPronounce, setAutoPronounce] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [prefSuccess, setPrefSuccess] = useState('');
  const [prefError, setPrefError] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);

  if (!isOpen) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (newPassword.length < 8) {
      setPassError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsChangingPass(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPassSuccess('Đã đổi mật khẩu thành công! Các phiên đăng nhập khác đã được thu hồi.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err instanceof authApi.ApiRequestError) {
        setPassError(err.message);
      } else {
        setPassError('Không thể đổi mật khẩu lúc này. Vui lòng kiểm tra lại mật khẩu hiện tại.');
      }
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleSaveLearningPrefs = async () => {
    setSavingPrefs(true); setPrefError(''); setPrefSuccess('');
    try {
      const profile = currentUser?.learningProfile;
      await saveLearningProfile({
        currentHsk: profile?.hskLevel ?? 3,
        currentHskSource: profile?.currentHskSource ?? 'unknown',
        targetHsk: profile?.targetHsk,
        goal: profile?.goal ?? 'daily',
        focusSkills: profile?.focusSkills,
        topicIds: profile?.topics ?? [],
        dailyMinutes: profile?.dailyMinutes ?? 15,
        studyDaysPerWeek: profile?.studyDaysPerWeek,
        subtitlePreference: { all: 'all', 'zh-pinyin': 'zh_pinyin', zh: 'zh_only' }[subtitleMode],
        surveyVersion: profile?.surveyVersion ?? 1,
      });
      localStorage.setItem('hanflix_auto_pronounce', String(autoPronounce));
      localStorage.setItem('hanflix_playback_speed', String(playbackSpeed));
      onSavePreferences?.({ subtitleMode });
      setPrefSuccess('Đã lưu tùy chọn học tập.');
    } catch (error) { setPrefError(error instanceof Error ? error.message : 'Không thể lưu tùy chọn.'); }
    finally { setSavingPrefs(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-[#E7E7EA] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E7E7EA] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FDF1F1] text-[#B91B1C] flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] tracking-tight">Cài Đặt Tài Khoản</h2>
              <p className="text-xs text-[#5F6368]">Quản lý hồ sơ, bảo mật mật khẩu và tùy chọn học tập</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Đóng cài đặt"
            className="p-2 rounded-xl text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#E7E7EA] px-6 bg-[#FAFAFC] shrink-0">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-bold transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'border-[#B91B1C] text-[#B91B1C]'
                : 'border-transparent text-[#5F6368] hover:text-[#18181B]'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Hồ sơ cá nhân</span>
          </button>

          <button
            onClick={() => setActiveTab('learning')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-bold transition-colors cursor-pointer ${
              activeTab === 'learning'
                ? 'border-[#B91B1C] text-[#B91B1C]'
                : 'border-transparent text-[#5F6368] hover:text-[#18181B]'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Tùy chọn học tập</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-bold transition-colors cursor-pointer ${
              activeTab === 'security'
                ? 'border-[#B91B1C] text-[#B91B1C]'
                : 'border-transparent text-[#5F6368] hover:text-[#18181B]'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Đổi mật khẩu</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: Profile */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#F7F7F9] border border-[#E7E7EA]">
                <img
                  src={userProfile?.avatar || 'https://picsum.photos/seed/avatar-default/64/64'}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-base text-[#18181B] truncate">{currentUser?.name || userProfile?.name}</h3>
                  <p className="text-xs text-[#5F6368] truncate">{currentUser?.email}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#34363A] text-white text-[11px] font-semibold">
                      HSK {currentUser?.learningProfile?.hskLevel || userProfile?.hskLevel || 3}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#EBF5EE] text-[#1E7E44] text-[11px] font-semibold">
                      Tài khoản hoạt động
                    </span>
                  </div>
                </div>
              </div>

              {/* Goal & Preferences CTA Card */}
              <div className="p-4 rounded-2xl bg-[#FBFBFC] border border-[#E7E7EA] flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#18181B]">
                    <Compass className="w-4 h-4 text-[#B91B1C]" />
                    <span>Mục tiêu & Lộ trình học tập</span>
                  </div>
                  <p className="text-xs text-[#5F6368]">
                    Cập nhật lại trình độ HSK và các chủ đề bạn quan tâm để trang chủ đề xuất đúng nội dung cần học.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSurvey?.();
                  }}
                  className="shrink-0 px-3.5 py-2 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Khảo sát lại
                </button>
              </div>

              {/* System Details */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center py-2.5 border-b border-[#E7E7EA] text-sm">
                  <span className="text-[#5F6368]">Họ và tên</span>
                  <span className="font-bold text-[#18181B]">{currentUser?.name || userProfile?.name}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-[#E7E7EA] text-sm">
                  <span className="text-[#5F6368]">Địa chỉ Email</span>
                  <span className="font-bold text-[#18181B]">{currentUser?.email}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-[#E7E7EA] text-sm">
                  <span className="text-[#5F6368]">Vai trò hệ thống</span>
                  <span className="font-bold text-[#18181B] capitalize">{currentUser?.role || 'Học viên'}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Learning Preferences */}
          {activeTab === 'learning' && (
            <div className="space-y-5">
              {prefSuccess && (
                <div className="p-3.5 rounded-2xl bg-[#EBF5EE] border border-[#A4D8B6] text-[#1E7E44] text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{prefSuccess}</span>
                </div>
              )}
              {prefError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{prefError}</p>}

              {/* Subtitle mode */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Chế độ phụ đề mặc định trong video
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'all', title: 'Song ngữ đầy đủ', desc: 'Hán tự + Pinyin + Tiếng Việt' },
                    { id: 'zh-pinyin', title: 'Trung & Pinyin', desc: 'Luyện phản xạ nghĩa' },
                    { id: 'zh', title: 'Chỉ chữ Hán', desc: 'Thử thách nâng cao' },
                  ].map(mode => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setSubtitleMode(mode.id as any)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        subtitleMode === mode.id
                          ? 'border-[#B91B1C] bg-[#FFF5F5] ring-2 ring-[#B91B1C]/15'
                          : 'border-[#E7E7EA] hover:border-neutral-400 bg-white'
                      }`}
                    >
                      <div className="font-bold text-xs text-[#18181B]">{mode.title}</div>
                      <div className="text-[11px] text-[#5F6368] mt-0.5">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pronunciation & Audio */}
              <div className="pt-2 space-y-3">
                <label className="block text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Âm thanh & Tương tác
                </label>
                <div className="p-3.5 rounded-2xl border border-[#E7E7EA] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#18181B]">Tự động phát âm chuẩn khi bấm vào từ vựng</div>
                    <div className="text-[11px] text-[#5F6368]">Đọc phát âm tiếng Trung phổ thông (zh-CN) ngay khi tra cứu</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoPronounce}
                    onChange={(e) => setAutoPronounce(e.target.checked)}
                    className="w-4 h-4 rounded text-[#B91B1C] accent-[#B91B1C] cursor-pointer"
                  />
                </div>

                {/* Speed picker */}
                <div className="p-3.5 rounded-2xl border border-[#E7E7EA] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#18181B]">Tốc độ phát mặc định</div>
                    <div className="text-[11px] text-[#5F6368]">Tốc độ phù hợp khi bắt đầu xem bài học mới</div>
                  </div>
                  <select
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                    className="px-2.5 py-1.5 rounded-xl border border-[#E7E7EA] text-xs font-bold bg-white outline-none cursor-pointer"
                  >
                    <option value={0.75}>0.75x (Chậm)</option>
                    <option value={1}>1.0x (Chuẩn)</option>
                    <option value={1.25}>1.25x (Nhanh)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveLearningPrefs}
                  disabled={savingPrefs}
                  className="px-5 py-2.5 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  {savingPrefs ? 'Đang lưu…' : 'Lưu tùy chọn học tập'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Security & Password */}
          {activeTab === 'security' && (
            <div className="space-y-5">
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passError && (
                <div className="p-3.5 rounded-2xl bg-[#FFF0F0] border border-[#F5CACA] text-[#B91B1C] text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passError}</span>
                </div>
              )}

              {passSuccess && (
                <div className="p-3.5 rounded-2xl bg-[#EBF5EE] border border-[#A4D8B6] text-[#1E7E44] text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{passSuccess}</span>
                </div>
              )}

              {/* Current Password */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                  Mật khẩu hiện tại
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Nhập mật khẩu đang dùng"
                    className="w-full h-11 px-4 pr-11 rounded-xl bg-white border border-neutral-300 text-sm focus:outline-none focus:border-[#B91B1C] focus:ring-3 focus:ring-[#B91B1C]/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                  Mật khẩu mới (tối thiểu 8 ký tự)
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới"
                    className="w-full h-11 px-4 pr-11 rounded-xl bg-white border border-neutral-300 text-sm focus:outline-none focus:border-[#B91B1C] focus:ring-3 focus:ring-[#B91B1C]/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full h-11 px-4 rounded-xl bg-white border border-neutral-300 text-sm focus:outline-none focus:border-[#B91B1C] focus:ring-3 focus:ring-[#B91B1C]/10 transition-all"
                />
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={isChangingPass}
                  className="px-5 py-2.5 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-2"
                >
                  {isChangingPass ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Cập nhật mật khẩu mới</span>
                    </>
                  )}
                </button>
              </div>
            </form>
            <div className="border-t border-[#E7E7EA] pt-5">
              <p className="text-sm font-bold text-neutral-800 mb-2">Liên kết tài khoản Google</p>
              <p className="text-xs text-neutral-600 mb-3">Dùng tài khoản Google có cùng địa chỉ email với HanFlix.</p>
              <GoogleSignInButton action="continue_with" onCredential={async credential => {
                await authApi.linkGoogle(credential);
                setGoogleLinkMessage('Đã liên kết tài khoản Google.');
              }} onError={setGoogleLinkMessage} />
              {googleLinkMessage && <p className="text-xs text-neutral-700 mt-2" role="status">{googleLinkMessage}</p>}
            </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
