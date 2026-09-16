import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { User as UserType } from '../../data/hanflixData';
import * as auth from '../../api/auth';

interface LoginViewProps {
  onLoginSuccess: (user: UserType) => void;
  onNavigateToSignup: () => void;
}

export default function LoginView({ onLoginSuccess, onNavigateToSignup }: LoginViewProps) {
  const [view, setView] = useState<'login' | 'forgot-password' | 'forgot-password-success'>('login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [forgotEmail, setForgotEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);
    try {
      const user = await auth.login(email, password);
      onLoginSuccess(user);
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      setErrorMsg('Vui lòng nhập địa chỉ email.');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);
    try {
      await auth.forgotPassword(forgotEmail);
      setView('forgot-password-success');
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

  return (
    <div className="min-h-screen w-full flex" style={{ fontFamily: "'Inter', sans-serif", background: '#F8F5F2' }}>
      <style>{`
        .bright-input {
          background: #fff;
          border: 1.5px solid #E8E3DD;
          color: #1a1a1a;
          transition: all 0.18s;
          font-size: 14px;
        }
        .bright-input::placeholder { color: #B0A89E; }
        .bright-input:focus {
          outline: none;
          border-color: #B91B1C;
          box-shadow: 0 0 0 4px rgba(185,27,28,0.09);
          background: #fff;
        }
        @keyframes floatUp {
          0%,100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .float-card { animation: floatUp 5s ease-in-out infinite; }
        .float-card-2 { animation: floatUp 5s ease-in-out 1.6s infinite; }
        .float-card-3 { animation: floatUp 5s ease-in-out 3.2s infinite; }
      `}</style>

      {/* ── LEFT: Visual Panel ── */}
      <div className="hidden lg:flex w-[48%] xl:w-[52%] relative flex-col overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #FFF0F0 0%, #FFE4E4 40%, #FFF5ED 100%)' }}>

        {/* Decorative circles */}
        <div className="absolute top-[-80px] left-[-80px] w-[320px] h-[320px] rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, #B91B1C 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-60px] right-[-60px] w-[280px] h-[280px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #FF6B35 0%, transparent 70%)' }} />
        <div className="absolute top-[45%] right-[-40px] w-[180px] h-[180px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #B91B1C 0%, transparent 70%)' }} />

        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, #B91B1C 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* Brand */}
        <div className="relative z-10 px-10 pt-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white text-2xl shadow-lg"
            style={{ background: 'linear-gradient(135deg, #B91B1C 0%, #D94040 100%)', boxShadow: '0 8px 24px rgba(185,27,28,0.35)' }}>
            H
          </div>
          <div>
            <span className="block font-black text-[#B91B1C] text-xl tracking-[0.1em] leading-none">HANFLIX</span>
            <span className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-[#B91B1C]/50">Chinese Video Platform</span>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-10 xl:px-14 pb-8">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#B91B1C]/60 mb-4">Nền tảng học tiếng Trung #1</p>
          <h1 className="font-black leading-[1.07] tracking-tight text-[#1A0A0A] mb-5"
            style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 'clamp(2.6rem, 4vw, 3.6rem)' }}>
            Học Tiếng<br />
            Trung Qua<br />
            <span className="text-[#B91B1C]">Short Videos</span>
          </h1>
          <p className="text-[15px] text-[#7A6060] leading-relaxed mb-10 max-w-[340px]">
            Phụ đề Pinyin thông minh, tra từ 1-click và trợ lý AI cá nhân hóa theo trình độ HSK của bạn.
          </p>

          {/* Floating character cards */}
          <div className="flex gap-3 flex-wrap">
            {[
              { zh: '你好', py: 'nǐ hǎo', vi: 'Xin chào', hsk: 1, cls: 'float-card' },
              { zh: '学习', py: 'xuéxí', vi: 'Học tập', hsk: 2, cls: 'float-card-2' },
              { zh: '机会', py: 'jīhuì', vi: 'Cơ hội', hsk: 3, cls: 'float-card-3' },
            ].map(card => (
              <div key={card.zh} className={`${card.cls} rounded-2xl px-4 py-3 shadow-md`}
                style={{ background: '#fff', border: '1.5px solid #F0E8E8' }}>
                <div className="text-2xl font-black text-[#1A0A0A]" style={{ fontFamily: 'serif' }}>{card.zh}</div>
                <div className="text-[11px] font-semibold text-[#B91B1C] mt-0.5">{card.py}</div>
                <div className="text-[10px] text-[#B0A89E]">{card.vi}</div>
                <span className="mt-1.5 inline-block text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#FFF0F0', color: '#B91B1C' }}>HSK {card.hsk}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats footer */}
        <div className="relative z-10 px-10 pb-10">
          <div className="flex gap-8 pt-6" style={{ borderTop: '1.5px solid rgba(185,27,28,0.12)' }}>
            {[['5,000+', 'Video bài học'], ['HSK 1–6', 'Trình độ'], ['AI', 'Trợ lý thông minh']].map(([v, l]) => (
              <div key={l}>
                <div className="text-xl font-black text-[#B91B1C]">{v}</div>
                <div className="text-xs text-[#B0A89E] mt-0.5">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Form Panel ── */}
      <div className="flex-1 flex flex-col justify-center overflow-y-auto px-8 sm:px-12 lg:px-14 xl:px-16 py-12 bg-white">

        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-md"
            style={{ background: 'linear-gradient(135deg, #B91B1C, #D94040)' }}>H</div>
          <span className="font-black text-[#B91B1C] text-lg tracking-widest">HANFLIX</span>
        </div>

        {view === 'login' && (
          <div className="max-w-[400px] w-full mx-auto lg:mx-0">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#B91B1C]/60 mb-2">Chào mừng trở lại</p>
            <h2 className="font-black text-[#1A0A0A] tracking-tight mb-1"
              style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '2.4rem' }}>
              Đăng nhập
            </h2>
            <p className="text-sm text-[#9A8878] mb-8">Tiếp tục lộ trình học tiếng Trung của bạn</p>

            {/* Error */}
            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-2xl text-sm font-semibold flex items-center gap-2"
                style={{ background: '#FFF0F0', border: '1.5px solid #F5CACA', color: '#B91B1C' }}>
                <div className="w-2 h-2 rounded-full bg-[#B91B1C] shrink-0" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold tracking-widest uppercase text-[#9A8878] mb-2">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#C0B4AC]" />
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="bright-input w-full pl-11 pr-4 py-3.5 rounded-2xl" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold tracking-widest uppercase text-[#9A8878] mb-2">Mật khẩu</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#C0B4AC]" />
                  <input type={showPassword ? 'text' : 'password'} required value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                    className="bright-input w-full pl-11 pr-12 py-3.5 rounded-2xl" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#C0B4AC] hover:text-[#7A6060] transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded accent-red-700" />
                  <span className="text-sm text-[#9A8878]">Ghi nhớ đăng nhập</span>
                </label>
                <button type="button" className="text-xs font-semibold text-[#B91B1C] hover:underline"
                  onClick={() => { setView('forgot-password'); setErrorMsg(''); }}>
                  Quên mật khẩu?
                </button>
              </div>

              <button type="submit" disabled={isLoading}
                className="w-full py-4 rounded-2xl text-white font-black text-[15px] tracking-wide transition-all hover:scale-[1.02] active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #B91B1C 0%, #D94040 100%)', boxShadow: '0 6px 24px rgba(185,27,28,0.35)' }}>
                {isLoading
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><span>Đăng nhập ngay</span><ArrowRight className="w-5 h-5" /></>}
              </button>
            </form>

            <p className="text-center text-sm text-[#B0A89E] mt-8">
              Chưa có tài khoản?{' '}
              <button onClick={onNavigateToSignup} className="font-black text-[#B91B1C] hover:underline">
                Đăng ký miễn phí
              </button>
            </p>
          </div>
        )}

        {view === 'forgot-password' && (
          <div className="max-w-[400px] w-full mx-auto lg:mx-0 animate-in fade-in slide-in-from-right-4 duration-300">
            <button onClick={() => { setView('login'); setErrorMsg(''); }} className="flex items-center gap-2 text-sm font-semibold text-[#9A8878] hover:text-[#1A0A0A] mb-8 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Quay lại đăng nhập
            </button>
            
            <h2 className="font-black text-[#1A0A0A] tracking-tight mb-2"
              style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '2.4rem' }}>
              Quên mật khẩu
            </h2>
            <p className="text-sm text-[#9A8878] mb-8 leading-relaxed">
              Nhập email liên kết với tài khoản của bạn và chúng tôi sẽ gửi liên kết đặt lại mật khẩu.
            </p>

            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-2xl text-sm font-semibold flex items-center gap-2"
                style={{ background: '#FFF0F0', border: '1.5px solid #F5CACA', color: '#B91B1C' }}>
                <div className="w-2 h-2 rounded-full bg-[#B91B1C] shrink-0" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div>
                <label className="block text-xs font-bold tracking-widest uppercase text-[#9A8878] mb-2">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#C0B4AC]" />
                  <input type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="bright-input w-full pl-11 pr-4 py-3.5 rounded-2xl" />
                </div>
              </div>

              <button type="submit" disabled={isLoading}
                className="w-full py-4 rounded-2xl text-white font-black text-[15px] tracking-wide transition-all hover:scale-[1.02] active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #B91B1C 0%, #D94040 100%)', boxShadow: '0 6px 24px rgba(185,27,28,0.35)' }}>
                {isLoading
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><span>Gửi liên kết đặt lại</span></>}
              </button>
            </form>
          </div>
        )}

        {view === 'forgot-password-success' && (
          <div className="max-w-[400px] w-full mx-auto lg:mx-0 animate-in fade-in zoom-in-95 duration-300 text-center">
            <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32] mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="font-black text-[#1A0A0A] tracking-tight mb-3"
              style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '2rem' }}>
              Đã gửi liên kết!
            </h2>
            <p className="text-sm text-[#9A8878] mb-8 leading-relaxed">
              Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu đến email <strong>{forgotEmail}</strong>. Vui lòng kiểm tra hộp thư (bao gồm mục Spam).
            </p>
            <button onClick={() => setView('login')}
              className="w-full py-4 rounded-2xl font-black text-[15px] tracking-wide transition-all hover:bg-[#F8F5F2]"
              style={{ border: '1.5px solid #E8E3DD', color: '#1A0A0A' }}>
              Quay lại đăng nhập
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
