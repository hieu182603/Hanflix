import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Sparkles, Eye, EyeOff } from 'lucide-react';
import { User as UserType } from '../../data/hanflixData';

interface SignupViewProps {
  onSignupSuccess: (newUser: UserType) => void;
  onNavigateToLogin: () => void;
}

const HSK_DESC: Record<number, string> = {
  1: 'Sơ cấp', 2: 'Cơ bản', 3: 'Trung cấp', 4: 'Khá', 5: 'Cao cấp', 6: 'Thành thạo'
};

const PERKS = [
  'Thiết lập trình độ HSK mong muốn',
  'Flashcards SRS đồng bộ tự động',
  'Không giới hạn bài học tương tác',
  'Trợ lý AI cá nhân hóa theo bạn',
];

export default function SignupView({ onSignupSuccess, onNavigateToLogin }: SignupViewProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [targetHsk, setTargetHsk] = useState<number>(3);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (password !== confirmPassword) { setErrorMsg('Mật khẩu xác nhận không trùng khớp.'); return; }
    if (password.length < 6) { setErrorMsg('Mật khẩu phải chứa ít nhất 6 ký tự.'); return; }
    setIsLoading(true);
    setTimeout(() => {
      const newUser: UserType = {
        id: `user-${Date.now()}`,
        role: 'user',
        status: 'active',
        name: name.trim(),
        email: email.trim(),
        avatarAsset: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=faces',
        learningProfile: {
          hskLevel: targetHsk, goal: 'business',
          topics: ['food', 'travel', 'office'], dailyMinutes: 15,
          preferredDuration: '1-3', subtitleDefaults: { zh: true, pinyin: true, vi: true },
          defaultSpeed: 1, uiLanguage: 'vi'
        }
      };
      setIsLoading(false);
      onSignupSuccess(newUser);
    }, 400);
  };

  return (
    <div className="min-h-screen w-full flex" style={{ fontFamily: "'Inter', sans-serif", background: '#fff' }}>
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
        }
      `}</style>

      {/* ── LEFT: Form ── */}
      <div className="flex-1 flex flex-col justify-center overflow-y-auto px-8 sm:px-12 lg:px-14 xl:px-16 py-10 bg-white">

        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-md"
            style={{ background: 'linear-gradient(135deg, #B91B1C, #D94040)' }}>H</div>
          <span className="font-black text-[#B91B1C] text-lg tracking-widest">HANFLIX</span>
        </div>

        <div className="max-w-[420px] w-full mx-auto lg:mx-0">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#B91B1C]/60 mb-2">Bắt đầu miễn phí</p>
          <h2 className="font-black text-[#1A0A0A] tracking-tight mb-1"
            style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '2.4rem' }}>
            Tạo tài khoản
          </h2>
          <p className="text-sm text-[#9A8878] mb-7">Chinh phục tiếng Trung qua video tình huống đời thực</p>

          {/* Error */}
          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-2xl text-sm font-semibold flex items-center gap-2"
              style={{ background: '#FFF0F0', border: '1.5px solid #F5CACA', color: '#B91B1C' }}>
              <div className="w-2 h-2 rounded-full bg-[#B91B1C] shrink-0" />
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-[#9A8878] mb-2">Họ và tên</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#C0B4AC]" />
                <input type="text" required placeholder="VD: Nguyễn Văn A" value={name}
                  onChange={e => setName(e.target.value)}
                  className="bright-input w-full pl-11 pr-4 py-3.5 rounded-2xl" />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-[#9A8878] mb-2">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#C0B4AC]" />
                <input type="email" required placeholder="email@example.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bright-input w-full pl-11 pr-4 py-3.5 rounded-2xl" />
              </div>
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold tracking-widest uppercase text-[#9A8878] mb-2">Mật khẩu</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#C0B4AC]" />
                  <input type={showPassword ? 'text' : 'password'} required placeholder="Ít nhất 6 ký tự"
                    value={password} onChange={e => setPassword(e.target.value)}
                    className="bright-input w-full pl-11 pr-10 py-3.5 rounded-2xl" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#C0B4AC] hover:text-[#7A6060] transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold tracking-widest uppercase text-[#9A8878] mb-2">Xác nhận</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#C0B4AC]" />
                  <input type={showPassword ? 'text' : 'password'} required placeholder="Nhập lại"
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    className="bright-input w-full pl-11 pr-4 py-3.5 rounded-2xl" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={isLoading}
              className="w-full py-4 rounded-2xl text-white font-black text-[15px] tracking-wide transition-all hover:scale-[1.02] active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
              style={{ background: 'linear-gradient(135deg, #B91B1C 0%, #D94040 100%)', boxShadow: '0 6px 24px rgba(185,27,28,0.35)' }}>
              {isLoading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><span>Tạo tài khoản & Bắt đầu học</span><ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>

          <p className="text-center text-sm text-[#B0A89E] mt-7">
            Đã có tài khoản?{' '}
            <button onClick={onNavigateToLogin} className="font-black text-[#B91B1C] hover:underline">
              Đăng nhập ngay
            </button>
          </p>
        </div>
      </div>

      {/* ── RIGHT: Visual Panel ── */}
      <div className="hidden lg:flex w-[46%] xl:w-[48%] relative flex-col overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #FFF0F0 0%, #FFE8E8 40%, #FFF5ED 100%)' }}>

        {/* Decorative circles */}
        <div className="absolute top-[-80px] right-[-60px] w-[300px] h-[300px] rounded-full opacity-35"
          style={{ background: 'radial-gradient(circle, #B91B1C 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-60px] left-[-50px] w-[260px] h-[260px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #FF8C42 0%, transparent 70%)' }} />

        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, #B91B1C 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* Brand */}
        <div className="relative z-10 px-10 pt-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white text-2xl shadow-lg"
            style={{ background: 'linear-gradient(135deg, #B91B1C, #D94040)', boxShadow: '0 8px 24px rgba(185,27,28,0.35)' }}>
            H
          </div>
          <div>
            <span className="block font-black text-[#B91B1C] text-xl tracking-[0.1em] leading-none">HANFLIX</span>
            <span className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-[#B91B1C]/50">Start Your Journey</span>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-10 xl:px-14 py-10">
          <span className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-6 w-fit"
            style={{ background: 'rgba(185,27,28,0.1)', border: '1.5px solid rgba(185,27,28,0.2)', color: '#B91B1C' }}>
            <Sparkles className="w-3 h-3" /> Miễn phí khởi đầu 100%
          </span>

          <h1 className="font-black leading-[1.07] tracking-tight text-[#1A0A0A] mb-6"
            style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 'clamp(2.4rem, 3.5vw, 3.2rem)' }}>
            Hành Trình<br />
            <span className="text-[#B91B1C]">HSK</span> Của<br />
            Bạn Bắt Đầu
          </h1>

          <div className="space-y-3.5 mb-10">
            {PERKS.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-black text-xs text-white"
                  style={{ background: 'linear-gradient(135deg, #B91B1C, #D94040)', boxShadow: '0 3px 10px rgba(185,27,28,0.3)' }}>
                  ✓
                </div>
                <span className="text-sm font-medium text-[#5A3A3A]">{item}</span>
              </div>
            ))}
          </div>

          {/* Testimonial card */}
          <div className="rounded-2xl p-5 shadow-sm" style={{ background: '#fff', border: '1.5px solid #F0E8E8' }}>
            <div className="flex gap-0.5 mb-3">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-sm text-[#B91B1C]">★</span>
              ))}
            </div>
            <p className="text-sm text-[#7A6060] leading-relaxed italic mb-4">
              "Sau 3 tháng dùng HanFlix, mình vượt qua HSK 4 lần đầu. Học qua video tình huống giúp nhớ từ vựng cực lâu!"
            </p>
            <div className="flex items-center gap-3">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=40&h=40&fit=crop&crop=faces"
                className="w-9 h-9 rounded-full object-cover" alt="Học viên" />
              <div>
                <div className="text-xs font-bold text-[#3A1A1A]">Nguyễn Minh Anh</div>
                <div className="text-[10px] text-[#B0A89E]">HSK 4 · Hà Nội</div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 px-10 pb-8 text-xs text-[#C0B4AC]">
          © 2026 HanFlix · Học tự nhiên — Nhớ lâu dài
        </div>
      </div>
    </div>
  );
}
