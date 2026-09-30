import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, ArrowRight, Menu, X } from 'lucide-react';
import ContactShowcase from './common/ContactShowcase';
import PremiumPricingPage from './premium/PremiumPricingPage';

interface PricingStandalonePageProps {
  currentUser?: any;
  onSignIn?: () => void;
  onSignUp?: () => void;
  onStartSurvey?: () => void;
}

export default function PricingStandalonePage({
  currentUser,
  onSignIn,
  onSignUp,
  onStartSurvey,
}: PricingStandalonePageProps) {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignIn = () => {
    if (onSignIn) onSignIn();
    else navigate('/auth/login', { state: { returnTo: '/premium' } });
  };

  const handleSignUp = () => {
    if (onSignUp) onSignUp();
    else navigate('/auth/signup', { state: { returnTo: '/premium' } });
  };

  const handleStartSurvey = () => {
    if (onStartSurvey) onStartSurvey();
    else navigate('/auth/signup', { state: { returnTo: '/premium' } });
  };

  return (
    <div className="min-h-[100dvh] bg-[#FFF9F5] text-[#18181B] selection:bg-[#B91B1C] selection:text-white font-sans overflow-x-hidden flex flex-col">
      {/* ── 1. HEADER (GIỐNG CÁC TAB KHÁC GẮN VỚI LANDING PAGE) ───────── */}
      <header className="sticky top-0 z-50 h-16 sm:h-20 md:h-[88px] flex items-center justify-between px-4 sm:px-6 md:px-12 bg-[#FFF9F5]/95 backdrop-blur-md border-b border-[#F2E4D8]/80 transition-all safe-area-top">
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center group text-left cursor-pointer py-1"
          aria-label="Về trang chủ HanFlix"
        >
          <img
            src="/assets/logo.png"
            alt="HanFlix Logo"
            className="h-9 sm:h-12 md:h-16 lg:h-[72px] w-auto max-w-[140px] sm:max-w-[220px] md:max-w-[320px] object-contain hover:scale-105 transition-transform drop-shadow-sm"
          />
        </button>

        {/* Desktop Navigation - Thứ tự: Trang chủ -> Giới thiệu -> Học viên -> Hỏi đáp -> Nâng cấp VIP */}
        <nav className="hidden lg:flex items-center gap-7 xl:gap-8 text-sm font-semibold text-[#18181B]/80">
          <button
            onClick={() => {
              navigate('/');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="hover:text-[#B91B1C] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#8FB9A7]" />
            Trang chủ
          </button>
          <button
            onClick={() => navigate('/about')}
            className="hover:text-[#B91B1C] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#E7A92F]" />
            Giới thiệu
          </button>
          <button
            onClick={() => navigate('/testimonials')}
            className="hover:text-[#B91B1C] transition-colors cursor-pointer"
          >
            Học viên
          </button>
          <button
            onClick={() => navigate('/faq')}
            className="hover:text-[#B91B1C] transition-colors cursor-pointer"
          >
            Hỏi đáp
          </button>
          <button
            onClick={() => navigate('/premium')}
            className="text-[#B91B1C] transition-colors flex items-center gap-1.5 group cursor-pointer font-bold"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#B91B1C]" />
            <Crown className="w-4 h-4 text-[#B91B1C] group-hover:scale-110 transition-transform" />
            <span className="relative">
              Nâng cấp
              <span className="absolute -top-2.5 -right-5 px-1.5 py-0.2 bg-[#B91B1C] text-white text-[9px] font-bold rounded-full uppercase tracking-tighter">
                VIP
              </span>
            </span>
          </button>
        </nav>

        {/* Header CTAs */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={handleSignIn}
            className="text-xs sm:text-sm font-bold text-[#18181B]/80 hover:text-[#B91B1C] px-2.5 sm:px-3 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Đăng nhập
          </button>
          <button
            onClick={handleStartSurvey}
            className="h-9 sm:h-11 px-3.5 sm:px-5 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs md:text-sm font-bold flex items-center gap-1.5 sm:gap-2 glow-crimson transition-all active:scale-[0.98] cursor-pointer shrink-0"
          >
            <span className="hidden xs:inline sm:inline">Tìm lộ trình của tôi</span>
            <span className="inline xs:hidden sm:hidden">Lộ trình</span>
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl border border-[#F2E4D8] bg-white text-[#18181B] hover:text-[#B91B1C] hover:border-[#B91B1C] transition-colors cursor-pointer"
            aria-label="Mở bảng chọn di động"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="lg:hidden sticky top-16 sm:top-20 z-40 bg-[#FFF9F5] border-b-2 border-[#F2E4D8] px-4 py-4 space-y-3 shadow-lg animate-in slide-in-from-top-2">
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full text-left flex items-center gap-2 text-sm font-bold text-[#18181B] hover:text-[#B91B1C] p-2 rounded-xl hover:bg-white transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-[#8FB9A7]" />
            Trang chủ
          </button>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/about');
            }}
            className="w-full text-left flex items-center gap-2 text-sm font-bold text-[#18181B] hover:text-[#B91B1C] p-2 rounded-xl hover:bg-white transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-[#E7A92F]" />
            Giới thiệu dự án FPT EXE 2
          </button>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/testimonials');
            }}
            className="w-full text-left flex items-center gap-2 text-sm font-bold text-[#18181B] hover:text-[#B91B1C] p-2 rounded-xl hover:bg-white transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
            Cảm nhận học viên
          </button>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/faq');
            }}
            className="w-full text-left flex items-center gap-2 text-sm font-bold text-[#18181B] hover:text-[#B91B1C] p-2 rounded-xl hover:bg-white transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-[#8FB9A7]" />
            Hỏi đáp thường gặp
          </button>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/premium');
            }}
            className="w-full text-left flex items-center justify-between text-sm font-bold text-[#B91B1C] bg-[#FFF2EE] p-2.5 rounded-xl border border-[#F2D0C7] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-[#B91B1C]" />
              Nâng cấp gói VIP
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#B91B1C] text-white text-[10px] font-bold uppercase">
              Đang xem
            </span>
          </button>
          <div className="pt-2 border-t border-[#F2E4D8] flex flex-col gap-2">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleSignIn();
              }}
              className="w-full py-2.5 rounded-xl border border-[#F2E4D8] bg-white text-xs font-bold text-[#18181B] hover:text-[#B91B1C] transition-colors cursor-pointer"
            >
              Đăng nhập
            </button>
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleStartSurvey();
              }}
              className="w-full py-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all cursor-pointer"
            >
              Tìm lộ trình của tôi
            </button>
          </div>
        </div>
      )}

      {/* ── 2. NỘI DUNG CHÍNH ─────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-8 sm:py-12">
        <PremiumPricingPage
          currentUser={currentUser}
          onNavigateLessons={() => navigate('/lessons')}
        />
      </main>

      {/* ── 3. FOOTER (GIỐNG CÁC TAB KHÁC GẮN VỚI LANDING PAGE) ───────── */}
      <footer className="relative bg-[#FFF9F5] border-t-2 border-[#F2E4D8] pt-12 sm:pt-16 pb-12 px-6 sm:px-10 lg:px-12 xl:px-16 overflow-hidden mt-auto">
        <div className="w-full max-w-[1720px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-8 xl:gap-12 pb-10 sm:pb-12 border-b border-[#F2E4D8]">
            {/* Col 1: Brand & Philosophy */}
            <div className="space-y-4">
              <div className="mb-2 sm:mb-4">
                <img
                  src="/assets/logo.png"
                  alt="HanFlix Logo"
                  className="h-16 sm:h-20 md:h-24 w-auto max-w-[220px] sm:max-w-[280px] object-contain cursor-pointer"
                  onClick={() => navigate('/')}
                />
              </div>
              <p className="text-xs sm:text-sm text-[#5F6368] leading-relaxed max-w-sm">
                Nền tảng học tiếng Trung qua phim ảnh và ngữ cảnh thực tế hàng đầu, kết hợp phụ đề 3 lớp thông minh và thuật toán ghi nhớ Spaced Repetition.
              </p>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-bold text-[#8FB9A7] pt-1">
                <span className="px-2.5 py-1 rounded-full bg-[#8FB9A7]/15 border border-[#8FB9A7]/30">HSK 1 - 6</span>
                <span className="px-2.5 py-1 rounded-full bg-[#E7A92F]/15 border border-[#E7A92F]/30 text-[#B7791F]">AI Pronounce</span>
                <span className="px-2.5 py-1 rounded-full bg-[#B91B1C]/10 border border-[#B91B1C]/20 text-[#B91B1C]">SRS Method</span>
              </div>
            </div>

            {/* Col 2: Khám Phá */}
            <div className="lg:pl-6 xl:pl-10">
              <h4 className="font-bold text-sm text-[#18181B] uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-1.5">
                <span className="text-[#8FB9A7]">🎋</span>
                <span>Khám Phá</span>
              </h4>
              <ul className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm text-[#5F6368]">
                <li>
                  <button onClick={() => navigate('/about')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">
                    Dự án FPT EXE 2
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/premium')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">
                    Gói cước Premium
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/testimonials')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">
                    Cảm nhận học viên
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/faq')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">
                    Hỏi đáp thường gặp
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/#lessons')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">
                    Kho bài học mẫu HSK
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 3: Phương Pháp */}
            <div className="lg:pl-6 xl:pl-10">
              <h4 className="font-bold text-sm text-[#18181B] uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-1.5">
                <span className="text-[#8FB9A7]">🎋</span>
                <span>Phương Pháp</span>
              </h4>
              <ul className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm text-[#5F6368]">
                <li><button onClick={() => { navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Phụ đề 3 tầng</button></li>
                <li><button onClick={() => { navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Tra từ 1-chạm</button></li>
                <li><button onClick={() => { navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Phản xạ cùng AI</button></li>
                <li><button onClick={() => { navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Flashcard SRS</button></li>
                <li><button onClick={handleStartSurvey} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Khảo sát lộ trình</button></li>
              </ul>
            </div>

            {/* Col 4: Liên hệ */}
            <div className="space-y-3.5">
              <ContactShowcase variant="footer" />
            </div>
          </div>

          <div className="pt-6 sm:pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8B9097]">
            <div className="flex items-center gap-2 text-center sm:text-left">
              <span>© {new Date().getFullYear()} HanFlix. Tất cả bản quyền được bảo lưu.</span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">Dự án Khởi nghiệp thực tế EXE 2 · Đại học FPT</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              <button onClick={handleSignIn} className="hover:text-[#B91B1C] transition-colors cursor-pointer">Đăng nhập</button>
              <button onClick={handleStartSurvey} className="hover:text-[#B91B1C] transition-colors cursor-pointer">Đăng ký</button>
              <button onClick={() => navigate('/faq')} className="hover:text-[#B91B1C] transition-colors cursor-pointer">Điều khoản</button>
              <button onClick={() => navigate('/faq')} className="hover:text-[#B91B1C] transition-colors cursor-pointer">Bảo mật</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
