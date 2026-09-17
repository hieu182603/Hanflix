import React, { useState } from 'react';
import { Mail, CheckCircle2, ShieldCheck, Send, Headphones, ArrowRight, ArrowLeft, Info, Sparkles } from 'lucide-react';
import * as auth from '../../api/auth';
import AuthLayout from './AuthLayout';

interface ForgotPasswordViewProps {
  onNavigateToLogin: () => void;
}

export default function ForgotPasswordView({ onNavigateToLogin }: ForgotPasswordViewProps) {
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Vui lòng nhập địa chỉ email.');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);
    try {
      await auth.forgotPassword(email);
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof auth.ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
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
          Khôi Phục <span className="text-[#E50914]">Mật Khẩu</span>
        </h1>
        <p className="text-[13px] sm:text-[14px] text-neutral-600 leading-relaxed max-w-[420px] auth-subtitle">
          Bảo vệ tài khoản & dữ liệu học tập HSK của bạn qua 3 bước xác thực an toàn.
        </p>
      </div>

      {/* Central 3D Pedestal Stage Section */}
      <div className="relative my-auto py-1 flex flex-col items-center justify-center w-full">
        {/* Soft Ambient Radial Halo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] sm:w-[540px] h-[420px] sm:h-[540px] rounded-full bg-gradient-to-tr from-[#E50914]/15 via-[#FED3BD]/60 to-white/80 blur-3xl pointer-events-none" />

        {/* Floating Badges */}
        {/* Badge 1: Top Right */}
        <div className="absolute top-1 sm:top-2 right-4 sm:right-10 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-white/80 shadow-[0_8px_20px_rgba(180,60,20,0.12)] text-[11px] sm:text-[12px] font-bold text-neutral-800 pointer-events-none">
          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#EA580C]" />
          <span>Bảo vệ tài khoản</span>
        </div>

        {/* Badge 2: Mid Left (near Golden Key) */}
        <div className="absolute top-24 sm:top-28 -left-1 sm:left-2 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-white/80 shadow-[0_8px_20px_rgba(180,60,20,0.12)] text-[11px] sm:text-[12px] font-bold text-neutral-800 pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#E50914]" />
          <span>Mã OTP 6 số tức thì</span>
        </div>

        {/* Panda Character on 3D Pedestal Stage */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full">
          {/* Panda Image - Large & Dominant */}
          <div className="relative z-10 -mb-8 sm:-mb-10 flex items-center justify-center w-full">
            <img
              src="/assets/panda-recovery.png"
              alt="HanFlix Panda Khôi phục mật khẩu"
              className="w-auto h-auto max-w-[420px] sm:max-w-[460px] xl:max-w-[500px] max-h-[clamp(260px,40vh,420px)] object-contain drop-shadow-[0_20px_36px_rgba(160,50,20,0.26)] hover:scale-[1.02] transition-transform duration-300 auth-recovery-img"
            />
          </div>

          {/* 3D Round Pedestal Stage */}
          <div className="relative w-full max-w-[520px] flex flex-col items-center justify-center">
            {/* Contact Shadow under Panda Feet */}
            <div className="w-48 sm:w-60 h-6 rounded-full bg-[#963416]/25 blur-md -mb-3.5 z-[1] pointer-events-none" />

            {/* Top Tier Platform */}
            <div className="w-[360px] sm:w-[420px] xl:w-[460px] h-[38px] sm:h-[46px] rounded-[50%] auth-pedestal-top border-t border-white/90 z-0" />

            {/* Base Pedestal Ring */}
            <div className="-mt-4 sm:-mt-5 w-[420px] sm:w-[480px] xl:w-[520px] h-[42px] sm:h-[50px] rounded-[50%] auth-pedestal-base z-[-1]" />
          </div>

          {/* Step Progress Card positioned right on the front of the stage */}
          <div className="relative z-20 -mt-6 sm:-mt-7 px-5 sm:px-6 py-2 sm:py-2.5 rounded-2xl bg-white/95 backdrop-blur-md border border-white shadow-[0_12px_28px_rgba(180,60,20,0.12)] flex items-center gap-3 sm:gap-4 auth-card-compact">
            {/* Step 1: Active */}
            <div className="flex flex-col items-center text-center">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#E50914] text-white flex items-center justify-center text-[10px] sm:text-[11px] font-black shadow-sm mb-0.5">
                1
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-[#E50914]">Bước 1</span>
            </div>

            <div className="h-[2px] w-6 sm:w-10 bg-[#E50914] rounded-full" />

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center opacity-70">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200 flex items-center justify-center text-[10px] sm:text-[11px] font-bold mb-0.5">
                2
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-neutral-600">Bước 2</span>
            </div>

            <div className="h-[2px] w-6 sm:w-10 bg-neutral-200 rounded-full" />

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center opacity-70">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200 flex items-center justify-center text-[10px] sm:text-[11px] font-bold mb-0.5">
                3
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-neutral-600">Bước 3</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Security Guarantee Pill Bar */}
      <div className="w-full max-w-[500px] xl:max-w-[540px] mx-auto mt-2 sm:mt-3 px-5 sm:px-7 py-2 sm:py-2.5 rounded-full bg-white/70 backdrop-blur-md border border-white/80 shadow-[0_4px_16px_rgba(180,60,20,0.08)] flex items-center justify-between text-neutral-800 text-[11px] sm:text-[12px] font-bold">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914]" />
          <span>Gửi mã tức thì</span>
        </div>
        <div className="w-1 h-1 rounded-full bg-[#E50914]/40" />
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#E50914]" />
          <span>Bảo mật SSL 256-bit</span>
        </div>
        <div className="w-1 h-1 rounded-full bg-[#E50914]/40" />
        <div className="flex items-center gap-1.5">
          <Headphones className="w-3.5 h-3.5 text-[#E50914]" />
          <span>Hỗ trợ 24/7</span>
        </div>
      </div>
    </div>
  );

  const formPanel = isSuccess ? (
    <div className="w-full text-center">
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32] mx-auto mb-4 sm:mb-6 shadow-sm">
        <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
      </div>
      <h2
        className="font-display font-black text-neutral-900 tracking-tight mb-2 sm:mb-3 auth-heading"
        style={{ fontSize: 'clamp(1.85rem, 2.6vw, 2.4rem)' }}
      >
        Đã gửi liên kết!
      </h2>
      <p className="text-[14px] sm:text-[15px] text-neutral-600 mb-6 sm:mb-8 leading-relaxed auth-subtitle">
        Nếu email thuộc tài khoản HanFlix, chúng tôi đã gửi liên kết đặt lại mật khẩu đến <strong>{email}</strong>.
      </p>
      <button
        onClick={onNavigateToLogin}
        className="w-full h-11 sm:h-12 rounded-full font-bold text-[14px] sm:text-[15px] transition-all bg-[#EEF2F6] hover:bg-[#E3E8EE] text-neutral-800 cursor-pointer auth-btn-secondary"
      >
        Quay lại đăng nhập
      </button>
    </div>
  ) : (
    <div className="w-full">
      <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-neutral-500 mb-1 sm:mb-1.5 font-display">
        XÁC THỰC TÀI KHOẢN
      </p>
      <h2
        className="font-display font-black text-neutral-900 tracking-tight mb-2 sm:mb-3 auth-heading"
        style={{ fontSize: 'clamp(1.85rem, 2.8vw, 2.5rem)' }}
      >
        Quên mật khẩu?
      </h2>
      <p className="text-[13px] sm:text-[14px] text-neutral-600 mb-4 sm:mb-6 leading-relaxed auth-subtitle">
        Vui lòng nhập địa chỉ email bạn đã dùng để đăng ký tài khoản HanFlix.
      </p>

      {errorMsg && (
        <div className="mb-4 p-3.5 rounded-xl text-sm font-semibold flex items-center gap-3 bg-[#FFF0F0] border border-[#F5CACA] text-[#E50914]">
          <div className="w-2 h-2 rounded-full bg-[#E50914] shrink-0" />
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4 auth-field-gap">
        <div>
          <label
            htmlFor="forgot-email"
            className="block text-[12px] sm:text-[13px] font-bold text-neutral-800 mb-1 sm:mb-1.5 font-display"
          >
            Email
          </label>
          <div className="relative">
            <Mail className="w-4.5 h-4.5 sm:w-5 sm:h-5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-neutral-400 stroke-[1.8]" />
            <input
              id="forgot-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full h-11 sm:h-12 pl-11 pr-4 sm:pl-12 sm:pr-4 rounded-xl bg-white border border-neutral-300 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#E50914] focus:ring-4 focus:ring-[#E50914]/10 text-[15px] sm:text-[14px] transition-all shadow-sm auth-input-field"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 sm:h-12 rounded-full text-white font-bold text-[14px] sm:text-[15px] bg-[#E50914] hover:bg-[#CC0813] active:scale-[0.99] disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(229,9,20,0.25)] cursor-pointer auth-btn-primary"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>Gửi mã xác thực OTP</span>
              <ArrowRight className="w-4.5 h-4.5" />
            </>
          )}
        </button>

        {/* Reassurance pill */}
        <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-neutral-50 border border-neutral-100 text-[12px] text-neutral-500 text-center">
          <Info className="w-4 h-4 text-neutral-400 shrink-0" />
          <span>Hệ thống sẽ gửi mã OTP gồm 6 chữ số vào hòm thư của bạn.</span>
        </div>

        <div className="text-center pt-2 sm:pt-3">
          <button
            type="button"
            onClick={onNavigateToLogin}
            className="inline-flex items-center justify-center gap-1.5 text-[13px] sm:text-[14px] font-semibold text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer auth-footer-link"
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
