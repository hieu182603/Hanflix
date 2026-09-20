import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Video, GitBranch } from 'lucide-react';
import { motion } from 'framer-motion';
import { User as UserType } from '../../data/hanflixData';
import * as auth from '../../api/auth';
import AuthLayout from './AuthLayout';
import AuthDivider from './AuthDivider';
import GoogleSignInButton from './GoogleSignInButton';

interface LoginViewProps {
  onLoginSuccess: (user: UserType) => void;
  onNavigateToSignup: () => void;
  onNavigateToForgotPassword: () => void;
}

export default function LoginView({ onLoginSuccess, onNavigateToSignup, onNavigateToForgotPassword }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [canResendVerification, setCanResendVerification] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setCanResendVerification(false);
    setIsLoading(true);
    try {
      const user = await auth.login(email, password);
      onLoginSuccess(user);
    } catch (err) {
      if (err instanceof auth.ApiRequestError) {
        setErrorMsg(err.message);
        setCanResendVerification(err.code === 'EMAIL_NOT_VERIFIED');
      } else {
        setErrorMsg('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerification = async () => {
    try {
      await auth.resendVerification(email);
      setErrorMsg('Nếu tài khoản đang chờ xác minh, mã OTP mới đã được gửi. Vui lòng kiểm tra email.');
      setCanResendVerification(false);
    } catch (error) {
      setErrorMsg(error instanceof auth.ApiRequestError ? error.message : 'Không thể gửi lại mã lúc này.');
    }
  };

  const visualPanel = (
    <div className="flex flex-col justify-between h-full">
      {/* Hero Headline */}
      <h1
        className="font-display font-black leading-[1.12] tracking-tight text-[#18181B] mb-3 xl:mb-5 auth-heading"
        style={{ fontSize: 'clamp(1.85rem, 2.6vw, 2.75rem)' }}
      >
        Học Tiếng Trung<br />
        Qua <span className="text-[#E50914]">Short Videos</span>
      </h1>

      {/* Floating Staggered HSK Cards with Ambient Glow */}
      <div className="relative flex items-center gap-3 xl:gap-4 py-1 mb-4 xl:mb-6">
        {/* Soft Ambient Red Glow behind cards */}
        <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-56 h-56 bg-[#E50914]/15 blur-3xl rounded-full pointer-events-none" />

        {/* Column 1 (Left): HSK 1 and HSK 3 */}
        <div className="flex flex-col gap-2.5 xl:gap-3.5 relative z-10">
          {/* Card 1: HSK 1 */}
          <motion.div
            animate={{ y: [-3, 3, -3] }}
            transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}
            className="w-[clamp(142px,12.5vw,180px)] rounded-[20px] bg-white p-3.5 xl:p-4.5 shadow-[0_16px_36px_rgba(180,60,20,0.12),0_2px_8px_rgba(0,0,0,0.04)] border border-white auth-card-compact"
          >
            <div className="inline-block bg-[#059669] text-white text-[9px] xl:text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-1.5 shadow-sm">
              HSK 1
            </div>
            <div className="text-[11px] xl:text-[12px] text-neutral-400 font-medium leading-none">
              nǐ hǎo
            </div>
            <div className="text-[clamp(26px,2.4vw,38px)] leading-tight font-black text-neutral-900 my-0.5 font-serif-sc">
              你好
            </div>
            <div className="text-[11px] xl:text-[12px] font-medium text-neutral-600 leading-none">
              Hello
            </div>
          </motion.div>

          {/* Card 3: HSK 3 */}
          <motion.div
            animate={{ y: [3, -3, 3] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 0.5 }}
            className="w-[clamp(142px,12.5vw,180px)] rounded-[20px] bg-white p-3.5 xl:p-4.5 shadow-[0_16px_36px_rgba(180,60,20,0.12),0_2px_8px_rgba(0,0,0,0.04)] border border-white auth-card-compact"
          >
            <div className="inline-block bg-[#D97706] text-white text-[9px] xl:text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-1.5 shadow-sm">
              HSK 3
            </div>
            <div className="text-[11px] xl:text-[12px] text-neutral-400 font-medium leading-none">
              xuéxí
            </div>
            <div className="text-[clamp(26px,2.4vw,38px)] leading-tight font-black text-neutral-900 my-0.5 font-serif-sc">
              学习
            </div>
            <div className="text-[11px] xl:text-[12px] font-medium text-neutral-600 leading-none">
              Learn
            </div>
          </motion.div>
        </div>

        {/* Column 2 (Right, staggered offset): HSK 2 */}
        <div className="flex flex-col relative z-10">
          <motion.div
            animate={{ y: [-4, 4, -4] }}
            transition={{ repeat: Infinity, duration: 4.8, ease: "easeInOut", delay: 0.2 }}
            className="w-[clamp(142px,12.5vw,180px)] rounded-[20px] bg-white p-3.5 xl:p-4.5 shadow-[0_16px_36px_rgba(180,60,20,0.12),0_2px_8px_rgba(0,0,0,0.04)] border border-white auth-card-compact"
          >
            <div className="inline-block bg-[#2563EB] text-white text-[9px] xl:text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-1.5 shadow-sm">
              HSK 2
            </div>
            <div className="text-[11px] xl:text-[12px] text-neutral-400 font-medium leading-none">
              xièxie
            </div>
            <div className="text-[clamp(26px,2.4vw,38px)] leading-tight font-black text-neutral-900 my-0.5 font-serif-sc">
              谢谢
            </div>
            <div className="text-[11px] xl:text-[12px] font-medium text-neutral-600 leading-none">
              Thank you
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Stats Footer with Outline Crimson Icons */}
      <div className="grid grid-cols-3 gap-3 xl:gap-5 pt-3 xl:pt-4 border-t border-[#E50914]/15">
        <div>
          <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-lg flex items-center justify-center text-[#E50914] mb-1">
            <Video className="w-4 h-4 xl:w-5 xl:h-5 stroke-[1.8]" />
          </div>
          <div className="text-[16px] xl:text-[18px] font-black text-neutral-900 leading-none mb-0.5 font-display">
            5,000+
          </div>
          <div className="text-[10px] xl:text-[11px] font-medium text-neutral-500">
            Video bài học
          </div>
        </div>

        <div>
          <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-lg flex items-center justify-center text-[#E50914] mb-1">
            <GitBranch className="w-4 h-4 xl:w-5 xl:h-5 stroke-[1.8]" />
          </div>
          <div className="text-[16px] xl:text-[18px] font-black text-neutral-900 leading-none mb-0.5 font-display">
            HSK 1-9
          </div>
          <div className="text-[10px] xl:text-[11px] font-medium text-neutral-500">
            Lộ trình
          </div>
        </div>

        <div>
          <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-lg flex items-center justify-center text-[#E50914] mb-1">
            <div className="w-4 h-4 xl:w-5 xl:h-5 rounded-full border-[1.8px] border-[#E50914] flex items-center justify-center text-[9px] font-black text-[#E50914]">
              AI
            </div>
          </div>
          <div className="text-[16px] xl:text-[18px] font-black text-neutral-900 leading-none mb-0.5 font-display">
            AI
          </div>
          <div className="text-[10px] xl:text-[11px] font-medium text-neutral-500">
            Trợ lý ngôn ngữ
          </div>
        </div>
      </div>
    </div>
  );

  const formPanel = (
    <div className="w-full">
      <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-neutral-700 mb-1.5 font-display">
        CHÀO MỪNG TRỞ LẠI
      </p>
      <h2
        className="font-display font-black text-neutral-900 tracking-tight mb-4 sm:mb-6 auth-heading"
        style={{ fontSize: 'clamp(1.85rem, 2.6vw, 2.5rem)' }}
      >
        Đăng nhập
      </h2>

      {/* Error Message */}
      {errorMsg && (
        <div className="mb-4 p-3.5 rounded-xl text-sm font-semibold flex items-center gap-3 bg-[#FFF0F0] border border-[#F5CACA] text-[#E50914]">
          <div className="w-2 h-2 rounded-full bg-[#E50914] shrink-0" />
          {errorMsg}
        </div>
      )}
      {canResendVerification && <button type="button" onClick={resendVerification}
        className="mb-3 text-sm font-semibold text-[#E50914] hover:underline">Gửi lại mã xác minh</button>}

      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5 auth-field-gap">
        {/* Email */}
        <div>
          <label
            htmlFor="login-email"
            className="block text-[12px] sm:text-[13px] font-bold text-neutral-800 mb-1 sm:mb-1.5 font-display"
          >
            Email
          </label>
          <div className="relative">
            <Mail className="w-4.5 h-4.5 sm:w-5 sm:h-5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-neutral-400 stroke-[1.8]" />
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full h-11 sm:h-12 pl-11 pr-4 sm:pl-12 sm:pr-4 rounded-xl bg-white border border-neutral-300 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#E50914] focus:ring-4 focus:ring-[#E50914]/10 text-[15px] sm:text-[14px] transition-all shadow-sm auth-input-field"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="login-password"
            className="block text-[12px] sm:text-[13px] font-bold text-neutral-800 mb-1 sm:mb-1.5 font-display"
          >
            Mật khẩu
          </label>
          <div className="relative">
            <Lock className="w-4.5 h-4.5 sm:w-5 sm:h-5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-neutral-400 stroke-[1.8]" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-11 sm:h-12 pl-11 pr-11 sm:pl-12 sm:pr-12 rounded-xl bg-white border border-neutral-300 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#E50914] focus:ring-4 focus:ring-[#E50914]/10 text-[15px] sm:text-[14px] transition-all shadow-sm auth-input-field"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4.5 h-4.5 sm:w-5 sm:h-5 stroke-[1.8]" /> : <Eye className="w-4.5 h-4.5 sm:w-5 sm:h-5 stroke-[1.8]" />}
            </button>
          </div>
        </div>

        {/* Remember me & Forgot password */}
        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-neutral-300 text-[#E50914] focus:ring-[#E50914] accent-[#E50914]"
            />
            <span className="text-[13px] sm:text-[14px] text-neutral-700 font-medium">Ghi nhớ đăng nhập</span>
          </label>
          <button
            type="button"
            className="text-[13px] sm:text-[14px] font-semibold text-[#E50914] hover:text-[#C50711] transition-colors cursor-pointer"
            onClick={onNavigateToForgotPassword}
          >
            Quên mật khẩu?
          </button>
        </div>

        {/* Buttons with Divider */}
        <div className="pt-1.5 sm:pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 sm:h-12 rounded-full text-white font-bold text-[14px] sm:text-[15px] bg-[#E50914] hover:bg-[#CC0813] active:scale-[0.99] disabled:opacity-60 transition-all flex items-center justify-center shadow-[0_8px_20px_rgba(229,9,20,0.25)] cursor-pointer auth-btn-primary"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Đăng nhập ngay</span>
            )}
          </button>

          <AuthDivider />

          <GoogleSignInButton action="signin_with"
            onCredential={async credential => onLoginSuccess(await auth.signInWithGoogle(credential))}
            onError={setErrorMsg} />
        </div>
      </form>

      <p className="text-center text-[13px] sm:text-[14px] text-neutral-600 mt-4 sm:mt-5 auth-footer-link">
        Chưa có tài khoản?{' '}
        <button onClick={onNavigateToSignup} className="font-semibold text-[#E50914] hover:underline cursor-pointer">
          Đăng ký miễn phí
        </button>
      </p>
    </div>
  );

  return <AuthLayout visualPanel={visualPanel} formPanel={formPanel} reverse={false} />;
}
