import React, { useState, type FormEvent } from 'react';
import { Mail, Lock, Eye, EyeOff, CheckCircle2, ShieldCheck, KeyRound, ArrowRight, ArrowLeft, Sparkles, RefreshCw } from 'lucide-react';
import * as auth from '../../api/auth';
import AuthLayout from './AuthLayout';
import OtpInput from './OtpInput';

interface ResetPasswordViewProps {
  onNavigateToLogin: () => void;
  initialEmail?: string;
}

export default function ResetPasswordView({ onNavigateToLogin, initialEmail }: ResetPasswordViewProps) {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const [email, setEmail] = useState(initialEmail || params.get('email') || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(email ? 60 : 0);
  const [resendStatus, setResendStatus] = useState('');

  React.useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendOtp = async () => {
    if (!email || resendCooldown > 0) return;
    setResendStatus('');
    setCode('');
    try {
      await auth.forgotPassword(email);
      setResendStatus('Mã OTP mới đã được gửi đến email (hiệu lực trong 1 phút).');
      setResendCooldown(60);
    } catch (e) {
      setResendStatus(e instanceof auth.ApiRequestError ? e.message : 'Không thể gửi lại mã lúc này.');
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!token) {
      if (!email.trim()) {
        setError('Vui lòng nhập email tài khoản.');
        return;
      }
      if (resendCooldown === 0) {
        setError('Mã OTP đã hết hạn sau 1 phút và đã bị hủy. Vui lòng bấm "Gửi lại mã" để nhận mã mới.');
        return;
      }
      if (code.length !== 6 || !/^\d{6}$/.test(code)) {
        setError('Vui lòng nhập đủ 6 chữ số mã OTP.');
        return;
      }
    }

    if (password.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (password !== confirmation) {
      setError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setLoading(true);
    try {
      if (token) {
        await auth.resetPassword(token, password);
      } else {
        await auth.resetPasswordWithCode(email.trim(), code, password);
      }
      setComplete(true);
    } catch (requestError) {
      setError(requestError instanceof auth.ApiRequestError ? requestError.message : 'Không thể đặt lại mật khẩu lúc này.');
    } finally {
      setLoading(false);
    }
  };

  const visualPanel = (
    <div className="flex flex-col justify-between h-full">
      {/* Hero Headline */}
      <div>
        <h1
          className="font-display font-black leading-[1.14] tracking-tight text-[#18181B] mb-1.5 sm:mb-2 auth-heading"
          style={{ fontSize: 'clamp(1.85rem, 2.7vw, 2.65rem)' }}
        >
          Đặt Lại <span className="text-[#E50914]">Mật Khẩu</span>
        </h1>
        <p className="text-[13px] sm:text-[14px] text-neutral-600 leading-relaxed max-w-[420px] auth-subtitle">
          Bảo mật tài khoản HSK với xác thực mã OTP 6 số và thiết lập mật khẩu mới mạnh mẽ.
        </p>
      </div>

      {/* Central Stage Section */}
      <div className="relative my-auto py-1 flex flex-col items-center justify-center w-full">
        {/* Soft Ambient Radial Halo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] sm:w-[540px] h-[420px] sm:h-[540px] rounded-full bg-gradient-to-tr from-[#E50914]/15 via-[#FED3BD]/60 to-white/80 blur-3xl pointer-events-none" />

        {/* Floating Badges */}
        <div className="absolute top-1 sm:top-2 right-4 sm:right-10 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-white/80 shadow-[0_8px_20px_rgba(180,60,20,0.12)] text-[11px] sm:text-[12px] font-bold text-neutral-800 pointer-events-none">
          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#EA580C]" />
          <span>Mã hóa bảo mật</span>
        </div>

        <div className="absolute top-24 sm:top-28 -left-1 sm:left-2 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-white/80 shadow-[0_8px_20px_rgba(180,60,20,0.12)] text-[11px] sm:text-[12px] font-bold text-neutral-800 pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#E50914]" />
          <span>Xác thực OTP 6 số</span>
        </div>

        {/* Panda Character on 3D Pedestal Stage */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full">
          <div className="relative z-10 -mb-8 sm:-mb-10 flex items-center justify-center w-full">
            <img
              src="/assets/panda-recovery.png"
              alt="HanFlix Security"
              className="w-auto h-auto max-w-[420px] sm:max-w-[460px] xl:max-w-[500px] max-h-[clamp(260px,40vh,420px)] object-contain drop-shadow-[0_20px_36px_rgba(160,50,20,0.26)] hover:scale-[1.02] transition-transform duration-300 auth-recovery-img"
            />
          </div>

          {/* 3D Round Pedestal Stage */}
          <div className="relative w-full max-w-[520px] flex flex-col items-center justify-center">
            <div className="w-48 sm:w-60 h-6 rounded-full bg-[#963416]/25 blur-md -mb-3.5 z-[1] pointer-events-none" />
            <div className="w-[360px] sm:w-[420px] xl:w-[460px] h-[38px] sm:h-[46px] rounded-[50%] auth-pedestal-top border-t border-white/90 z-0" />
            <div className="-mt-4 sm:-mt-5 w-[420px] sm:w-[480px] xl:w-[520px] h-[42px] sm:h-[50px] rounded-[50%] auth-pedestal-base z-[-1]" />
          </div>

          {/* Step Progress Card */}
          <div className="relative z-20 -mt-6 sm:-mt-7 px-5 sm:px-6 py-2 sm:py-2.5 rounded-2xl bg-white/95 backdrop-blur-md border border-white shadow-[0_12px_28px_rgba(180,60,20,0.12)] flex items-center gap-3 sm:gap-4 auth-card-compact">
            {/* Step 1: Done */}
            <div className="flex flex-col items-center text-center">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#E50914]/20 text-[#E50914] flex items-center justify-center text-[10px] sm:text-[11px] font-black mb-0.5">
                ✓
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-neutral-500">Gửi mã</span>
            </div>

            <div className="h-[2px] w-6 sm:w-10 bg-[#E50914] rounded-full" />

            {/* Step 2: Active */}
            <div className="flex flex-col items-center text-center">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#E50914] text-white flex items-center justify-center text-[10px] sm:text-[11px] font-black shadow-sm mb-0.5">
                2
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-[#E50914]">Đổi mật khẩu</span>
            </div>

            <div className="h-[2px] w-6 sm:w-10 bg-neutral-200 rounded-full" />

            {/* Step 3: Done */}
            <div className="flex flex-col items-center text-center opacity-70">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200 flex items-center justify-center text-[10px] sm:text-[11px] font-bold mb-0.5">
                3
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-neutral-600">Hoàn tất</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Security Guarantee Pill Bar */}
      <div className="w-full max-w-[500px] xl:max-w-[540px] mx-auto mt-2 sm:mt-3 px-5 sm:px-7 py-2 sm:py-2.5 rounded-full bg-white/70 backdrop-blur-md border border-white/80 shadow-[0_4px_16px_rgba(180,60,20,0.08)] flex items-center justify-between text-neutral-800 text-[11px] sm:text-[12px] font-bold">
        <div className="flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5 text-[#E50914]" />
          <span>Đổi mật khẩu an toàn</span>
        </div>
        <div className="w-1 h-1 rounded-full bg-[#E50914]/40" />
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#E50914]" />
          <span>Thu hồi phiên cũ</span>
        </div>
      </div>
    </div>
  );

  const formPanel = complete ? (
    <div className="w-full text-center py-4">
      <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32] mx-auto mb-5 shadow-sm">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <h2
        className="font-display font-black text-neutral-900 tracking-tight mb-2 auth-heading"
        style={{ fontSize: 'clamp(1.85rem, 2.6vw, 2.4rem)' }}
      >
        Đã đổi mật khẩu!
      </h2>
      <p className="text-[14px] sm:text-[15px] text-neutral-600 mb-6 leading-relaxed max-w-[360px] mx-auto">
        Mật khẩu mới đã được cập nhật thành công. Toàn bộ phiên đăng nhập cũ đã được thu hồi an toàn.
      </p>
      <button
        type="button"
        onClick={onNavigateToLogin}
        className="w-full h-11 sm:h-12 rounded-full bg-[#E50914] hover:bg-[#CC0813] text-white font-bold transition-all shadow-[0_8px_20px_rgba(229,9,20,0.25)] flex items-center justify-center gap-2 cursor-pointer"
      >
        <span>Đăng nhập ngay</span>
        <ArrowRight className="w-4.5 h-4.5" />
      </button>
    </div>
  ) : (
    <div className="w-full">
      <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-neutral-500 mb-1 sm:mb-1.5 font-display">
        BẢO MẬT TÀI KHOẢN
      </p>
      <h2
        className="font-display font-black text-neutral-900 tracking-tight mb-1.5 sm:mb-2 auth-heading"
        style={{ fontSize: 'clamp(1.75rem, 2.6vw, 2.3rem)' }}
      >
        Thiết lập mật khẩu mới
      </h2>
      <p className="text-[13px] sm:text-[14px] text-neutral-600 mb-4 leading-relaxed auth-subtitle">
        {token
          ? 'Liên kết xác thực hợp lệ. Vui lòng tạo mật khẩu mới tối thiểu 8 ký tự.'
          : 'Nhập mã OTP 6 số đã nhận qua email cùng mật khẩu mới của bạn.'}
      </p>

      {error && (
        <div className="mb-4 p-3.5 rounded-xl text-sm font-semibold flex items-center gap-3 bg-[#FFF0F0] border border-[#F5CACA] text-[#E50914]">
          <div className="w-2 h-2 rounded-full bg-[#E50914] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {resendStatus && (
        <div className="mb-4 p-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800">
          <span>{resendStatus}</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3 sm:space-y-3.5 auth-field-gap">
        {!token && (
          <>
            {/* Email Field */}
            <div>
              <label htmlFor="reset-email" className="block text-[12px] sm:text-[13px] font-bold text-neutral-800 mb-1 font-display">
                Email tài khoản
              </label>
              <div className="relative">
                <Mail className="w-4.5 h-4.5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-neutral-400 stroke-[1.8]" />
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-11 sm:h-12 pl-11 pr-4 sm:pl-12 sm:pr-4 rounded-xl bg-white border border-neutral-300 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#E50914] focus:ring-4 focus:ring-[#E50914]/10 text-[15px] sm:text-[14px] transition-all shadow-sm"
                />
              </div>
            </div>

            {/* OTP 6-box input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[12px] sm:text-[13px] font-bold text-neutral-800 font-display">
                  Mã xác thực OTP (6 số)
                </label>
                <button
                  type="button"
                  disabled={!email || resendCooldown > 0}
                  onClick={handleResendOtp}
                  className="text-xs font-bold text-[#E50914] hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {resendCooldown > 0 ? (
                    `Gửi lại sau (${resendCooldown}s)`
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3" />
                      <span>Gửi lại mã</span>
                    </>
                  )}
                </button>
              </div>
              {/* Countdown / Expiry status */}
              <div className="mb-2">
                {resendCooldown > 0 ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                    <span>Mã OTP tự động hủy sau: <strong>{resendCooldown}s</strong></span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-[#E50914] text-xs font-semibold">
                    <span>Mã OTP đã hết hạn sau 1 phút và bị hủy. Vui lòng bấm gửi lại mã!</span>
                  </div>
                )}
              </div>

              <div className="py-1">
                <OtpInput
                  value={code}
                  onChange={setCode}
                  length={6}
                  disabled={loading || resendCooldown === 0}
                  autoFocus={true}
                />
              </div>
            </div>
          </>
        )}

        {/* New Password */}
        <div>
          <label htmlFor="reset-new-password" className="block text-[12px] sm:text-[13px] font-bold text-neutral-800 mb-1 font-display">
            Mật khẩu mới
          </label>
          <div className="relative">
            <Lock className="w-4.5 h-4.5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-neutral-400 stroke-[1.8]" />
            <input
              id="reset-new-password"
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="Tối thiểu 8 ký tự"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full h-11 sm:h-12 pl-11 pr-11 sm:pl-12 sm:pr-12 rounded-xl bg-white border border-neutral-300 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#E50914] focus:ring-4 focus:ring-[#E50914]/10 text-[15px] sm:text-[14px] transition-all shadow-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4.5 h-4.5 stroke-[1.8]" /> : <Eye className="w-4.5 h-4.5 stroke-[1.8]" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="reset-confirm-password" className="block text-[12px] sm:text-[13px] font-bold text-neutral-800 mb-1 font-display">
            Xác nhận mật khẩu mới
          </label>
          <div className="relative">
            <Lock className="w-4.5 h-4.5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-neutral-400 stroke-[1.8]" />
            <input
              id="reset-confirm-password"
              type={showConfirmation ? 'text' : 'password'}
              required
              placeholder="Nhập lại mật khẩu mới"
              value={confirmation}
              onChange={e => setConfirmation(e.target.value)}
              className="w-full h-11 sm:h-12 pl-11 pr-11 sm:pl-12 sm:pr-12 rounded-xl bg-white border border-neutral-300 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#E50914] focus:ring-4 focus:ring-[#E50914]/10 text-[15px] sm:text-[14px] transition-all shadow-sm"
            />
            <button
              type="button"
              onClick={() => setShowConfirmation(!showConfirmation)}
              aria-label={showConfirmation ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
            >
              {showConfirmation ? <EyeOff className="w-4.5 h-4.5 stroke-[1.8]" /> : <Eye className="w-4.5 h-4.5 stroke-[1.8]" />}
            </button>
          </div>
        </div>

        {/* Submit button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || (!token && code.length !== 6)}
            className="w-full h-11 sm:h-12 rounded-full text-white font-bold text-[14px] sm:text-[15px] bg-[#E50914] hover:bg-[#CC0813] active:scale-[0.99] disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(229,9,20,0.25)] cursor-pointer auth-btn-primary"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Cập nhật mật khẩu</span>
                <ArrowRight className="w-4.5 h-4.5" />
              </>
            )}
          </button>
        </div>

        {/* Back to login */}
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onNavigateToLogin}
            className="inline-flex items-center justify-center gap-1.5 text-[13px] sm:text-[14px] font-semibold text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại đăng nhập</span>
          </button>
        </div>
      </form>
    </div>
  );

  return <AuthLayout visualPanel={visualPanel} formPanel={formPanel} reverse={false} />;
}
