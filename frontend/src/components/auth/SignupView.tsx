import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, Video, GitBranch, Mic, ChevronRight, CheckCircle2 } from 'lucide-react';
import * as auth from '../../api/auth';
import AuthLayout from './AuthLayout';
import GoogleIcon from './GoogleIcon';
import AuthDivider from './AuthDivider';

interface SignupViewProps {
  onNavigateToLogin: () => void;
}

export default function SignupView({ onNavigateToLogin }: SignupViewProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (password !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không trùng khớp.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Mật khẩu phải chứa ít nhất 8 ký tự.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await auth.register(name.trim(), email.trim(), password);
      if (result.verificationRequired) setRegisteredEmail(result.user.email);
    } catch (err) {
      if (err instanceof auth.ApiRequestError) {
        if (err.code === 'EMAIL_EXISTS') {
          setErrorMsg('Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.');
        } else {
          setErrorMsg(err.message);
        }
      } else {
        setErrorMsg('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    console.log("Google signup clicked");
  };

  const visualPanel = (
    <div className="flex flex-col justify-between h-full">
      {/* Hero Headline */}
      <h1
        className="font-display font-black leading-[1.12] tracking-tight text-[#18181B] mb-3 sm:mb-4 xl:mb-6 auth-heading"
        style={{ fontSize: 'clamp(1.85rem, 3vw, 2.8rem)' }}
      >
        Hành Trình <span className="text-[#E50914]">HSK</span><br />
        Của Bạn Bắt Đầu
      </h1>

      {/* 2x2 Grid of 4 Feature Cards (No feedback/testimonial) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:gap-3.5 my-auto">
        {/* Card 1: 5,000+ Video bài học */}
        <div className="rounded-[18px] sm:rounded-[22px] bg-white p-3 sm:p-3.5 xl:p-4 shadow-[0_20px_40px_rgba(180,60,20,0.12),0_2px_8px_rgba(0,0,0,0.04)] border border-white flex flex-col justify-between auth-card-compact">
          <div>
            <div className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl bg-[#E50914]/10 text-[#E50914] flex items-center justify-center mb-1.5 sm:mb-2">
              <Video className="w-4 h-4 xl:w-4.5 xl:h-4.5 stroke-[2]" />
            </div>
            <div className="text-[13px] xl:text-[14px] font-bold text-neutral-900 leading-tight mb-1.5 font-display">
              5,000+ Video Bài Học
            </div>
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            <span className="text-[10px] font-medium bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-md">
              Giao tiếp
            </span>
            <span className="text-[10px] font-medium bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-md">
              Du lịch
            </span>
            <span className="text-[10px] font-medium bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-md">
              Công sở
            </span>
          </div>
        </div>

        {/* Card 2: Lộ trình HSK 1-6 */}
        <div className="rounded-[18px] sm:rounded-[22px] bg-white p-3 sm:p-3.5 xl:p-4 shadow-[0_20px_40px_rgba(180,60,20,0.12),0_2px_8px_rgba(0,0,0,0.04)] border border-white flex flex-col justify-between auth-card-compact">
          <div>
            <div className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl bg-[#E50914]/10 text-[#E50914] flex items-center justify-center mb-1.5 sm:mb-2">
              <GitBranch className="w-4 h-4 xl:w-4.5 xl:h-4.5 stroke-[2]" />
            </div>
            <div className="text-[13px] xl:text-[14px] font-bold text-neutral-900 leading-tight mb-0.5 font-display">
              Lộ Trình HSK 1-6
            </div>
            <div className="text-[11px] text-neutral-400 font-medium mb-1.5">
              Milestone chuẩn
            </div>
          </div>
          <div className="flex items-center gap-1 pt-0.5">
            <div className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-[#E50914] text-white text-[10px] font-bold flex items-center justify-center">1</div>
            <div className="h-0.5 w-2 bg-[#E50914]" />
            <div className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-[#E50914] text-white text-[10px] font-bold flex items-center justify-center">2</div>
            <div className="h-0.5 w-2 bg-neutral-200" />
            <div className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-neutral-100 text-neutral-400 text-[10px] font-bold flex items-center justify-center">3</div>
            <div className="h-0.5 w-2 bg-neutral-200" />
            <div className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-neutral-100 text-neutral-400 text-[10px] font-bold flex items-center justify-center">4</div>
          </div>
        </div>

        {/* Card 3: Phụ đề Pinyin thông minh */}
        <div className="rounded-[18px] sm:rounded-[22px] bg-white p-3 sm:p-3.5 xl:p-4 shadow-[0_20px_40px_rgba(180,60,20,0.12),0_2px_8px_rgba(0,0,0,0.04)] border border-white flex flex-col justify-between auth-card-compact">
          <div>
            <div className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl bg-[#E50914]/10 text-[#E50914] flex items-center justify-center mb-1.5 sm:mb-2 font-serif-sc font-bold text-base xl:text-lg">
              字
            </div>
            <div className="text-[13px] xl:text-[14px] font-bold text-neutral-900 leading-tight mb-1.5 font-display">
              Phụ Đề Pinyin Thông Minh
            </div>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-neutral-50 text-[11px] text-neutral-600 border border-neutral-100">
            <span className="font-serif-sc font-bold text-neutral-900">字</span>
            <span className="truncate mx-1">Interactive subtitle</span>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          </div>
        </div>

        {/* Card 4: Trợ lý AI luyện nói */}
        <div className="rounded-[18px] sm:rounded-[22px] bg-white p-3 sm:p-3.5 xl:p-4 shadow-[0_20px_40px_rgba(180,60,20,0.12),0_2px_8px_rgba(0,0,0,0.04)] border border-white flex flex-col justify-between auth-card-compact">
          <div>
            <div className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl bg-[#E50914]/10 text-[#E50914] flex items-center justify-center mb-1.5 sm:mb-2 font-black text-xs">
              AI
            </div>
            <div className="text-[13px] xl:text-[14px] font-bold text-neutral-900 leading-tight mb-1.5 font-display">
              Trợ Lý AI Luyện Nói
            </div>
          </div>
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-neutral-50 border border-neutral-100">
            <div className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-[#E50914] text-white flex items-center justify-center shrink-0">
              <Mic className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </div>
            {/* Audio wave bars */}
            <div className="flex items-center gap-0.5 flex-1 justify-center">
              <span className="w-0.5 h-2 bg-[#E50914] rounded-full" />
              <span className="w-0.5 h-3.5 bg-[#E50914] rounded-full" />
              <span className="w-0.5 h-1.5 bg-neutral-300 rounded-full" />
              <span className="w-0.5 h-3 bg-[#E50914] rounded-full" />
              <span className="w-0.5 h-4.5 bg-[#E50914] rounded-full" />
              <span className="w-0.5 h-2 bg-neutral-300 rounded-full" />
              <span className="w-0.5 h-3 bg-[#E50914] rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const formPanel = registeredEmail ? (
    <div className="w-full text-center">
      <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32] mx-auto mb-6">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <h2 className="font-display font-black text-neutral-900 tracking-tight text-3xl mb-3">Kiểm tra email</h2>
      <p className="text-sm text-neutral-600 leading-relaxed mb-7">
        HanFlix đã gửi liên kết xác minh đến <strong>{registeredEmail}</strong>. Xác minh email trước khi đăng nhập.
      </p>
      <button type="button" onClick={onNavigateToLogin}
        className="w-full h-12 rounded-full bg-[#E50914] hover:bg-[#CC0813] text-white font-bold transition-colors">
        Đi đến đăng nhập
      </button>
    </div>
  ) : (
    <div className="w-full">
      <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-neutral-700 mb-1 sm:mb-2 font-display">
        CHÀO MỪNG TRỞ LẠI
      </p>
      <h2
        className="font-display font-black text-neutral-900 tracking-tight mb-3 sm:mb-5 auth-heading"
        style={{ fontSize: 'clamp(1.85rem, 2.6vw, 2.4rem)' }}
      >
        Tạo tài khoản mới
      </h2>

      {/* Error Message */}
      {errorMsg && (
        <div className="mb-4 p-3.5 rounded-xl text-sm font-semibold flex items-center gap-3 bg-[#FFF0F0] border border-[#F5CACA] text-[#E50914]">
          <div className="w-2 h-2 rounded-full bg-[#E50914] shrink-0" />
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-3 auth-field-gap">
        {/* Name */}
        <div>
          <label htmlFor="signup-name" className="block text-[12px] sm:text-[13px] font-bold text-neutral-800 mb-0.5 sm:mb-1 font-display">Họ và tên</label>
          <div className="relative">
            <User className="w-4.5 h-4.5 sm:w-5 sm:h-5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-neutral-400 stroke-[1.8]" />
            <input
              id="signup-name"
              type="text"
              required
              placeholder="Họ và tên"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-11 sm:h-12 pl-11 pr-4 sm:pl-12 sm:pr-4 rounded-xl bg-white border border-neutral-300 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#E50914] focus:ring-4 focus:ring-[#E50914]/10 text-[15px] sm:text-[14px] transition-all shadow-sm auth-input-field"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="signup-email" className="block text-[12px] sm:text-[13px] font-bold text-neutral-800 mb-0.5 sm:mb-1 font-display">Email</label>
          <div className="relative">
            <Mail className="w-4.5 h-4.5 sm:w-5 sm:h-5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-neutral-400 stroke-[1.8]" />
            <input
              id="signup-email"
              type="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full h-11 sm:h-12 pl-11 pr-4 sm:pl-12 sm:pr-4 rounded-xl bg-white border border-neutral-300 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#E50914] focus:ring-4 focus:ring-[#E50914]/10 text-[15px] sm:text-[14px] transition-all shadow-sm auth-input-field"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label htmlFor="signup-password" className="block text-[12px] sm:text-[13px] font-bold text-neutral-800 mb-0.5 sm:mb-1 font-display">Mật khẩu</label>
          <div className="relative">
            <Lock className="w-4.5 h-4.5 sm:w-5 sm:h-5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-neutral-400 stroke-[1.8]" />
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full h-11 sm:h-12 pl-11 pr-11 sm:pl-12 sm:pr-12 rounded-xl bg-white border border-neutral-300 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#E50914] focus:ring-4 focus:ring-[#E50914]/10 text-[15px] sm:text-[14px] transition-all shadow-sm auth-input-field"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4.5 h-4.5 sm:w-5 sm:h-5 stroke-[1.8]" /> : <Eye className="w-4.5 h-4.5 sm:w-5 sm:h-5 stroke-[1.8]" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="signup-confirm-password" className="block text-[12px] sm:text-[13px] font-bold text-neutral-800 mb-0.5 sm:mb-1 font-display">Xác nhận mật khẩu</label>
          <div className="relative">
            <Lock className="w-4.5 h-4.5 sm:w-5 sm:h-5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-neutral-400 stroke-[1.8]" />
            <input
              id="signup-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full h-11 sm:h-12 pl-11 pr-11 sm:pl-12 sm:pr-12 rounded-xl bg-white border border-neutral-300 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#E50914] focus:ring-4 focus:ring-[#E50914]/10 text-[15px] sm:text-[14px] transition-all shadow-sm auth-input-field"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="w-4.5 h-4.5 sm:w-5 sm:h-5 stroke-[1.8]" /> : <Eye className="w-4.5 h-4.5 sm:w-5 sm:h-5 stroke-[1.8]" />}
            </button>
          </div>
        </div>

        {/* Buttons */}
        <div className="pt-1.5 sm:pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 sm:h-12 rounded-full text-white font-bold text-[14px] sm:text-[15px] bg-[#E50914] hover:bg-[#CC0813] active:scale-[0.99] disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(229,9,20,0.25)] cursor-pointer auth-btn-primary"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Tạo tài khoản</span>
                <ArrowRight className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </>
            )}
          </button>

          <AuthDivider />

          <button
            type="button"
            onClick={handleGoogleSignup}
            className="w-full h-11 sm:h-12 rounded-full bg-[#EEF2F6] hover:bg-[#E3E8EE] text-neutral-800 font-bold text-[14px] sm:text-[15px] active:scale-[0.99] transition-all flex items-center justify-center gap-3 cursor-pointer auth-btn-secondary"
          >
            <GoogleIcon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            <span>Đăng ký với Google</span>
          </button>
        </div>
      </form>

      <p className="text-center text-[13px] sm:text-[14px] text-neutral-600 mt-3 sm:mt-5 auth-footer-link">
        Đã có tài khoản?{' '}
        <button onClick={onNavigateToLogin} className="font-semibold text-neutral-900 hover:underline cursor-pointer">
          Đăng nhập ngay
        </button>
      </p>
    </div>
  );

  return <AuthLayout visualPanel={visualPanel} formPanel={formPanel} reverse={true} />;
}
