import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  GraduationCap,
  Users,
  Award,
  Crown,
  ArrowRight,
  Sparkles,
  Film,
  BookOpen,
  Brain,
  ShieldCheck,
  CheckCircle2,
  Menu,
  X,
} from 'lucide-react';
import ContactShowcase from './common/ContactShowcase';

interface AboutProjectPageProps {
  onSignIn?: () => void;
  onSignUp?: () => void;
  onStartSurvey?: () => void;
}

const PROJECT_MEMBERS = [
  {
    name: 'Lê Quỳnh Anh',
    role: 'Trưởng Dự Án (Project Leader)',
    desc: 'Điều phối tổng thể dự án, hoạch định chiến lược sản phẩm và phát triển quan hệ đối tác.',
  },
  {
    name: 'Nguyễn Thế Minh',
    role: 'Phát Triển Kỹ Thuật & AI',
    desc: 'Phụ trách kiến trúc hệ thống công nghệ, thuật toán SRS và tích hợp AI nhận diện giọng nói.',
  },
  {
    name: 'Đỗ Xuân Nam',
    role: 'Nội Dung & Bản Địa Hóa',
    desc: 'Biên tập kho dữ liệu ngữ liệu phim, chuẩn hóa cấu trúc bài học và hệ thống từ vựng HSK.',
  },
  {
    name: 'Chu Thị Thanh',
    role: 'Thiết Kế Trải Nghiệm (UI/UX)',
    desc: 'Sáng tạo giao diện phong cách Đông Phương hiện đại và tối ưu hóa luồng tương tác người học.',
  },
  {
    name: 'Mai Văn Nghĩa',
    role: 'Vận Hành & Cộng Đồng',
    desc: 'Quản trị vận hành hệ thống, khảo sát phản hồi học viên và kiểm thử chất lượng sản phẩm.',
  },
  {
    name: 'Đặng Quang Bách',
    role: 'Tiếp Thị & Truyền Thông Số',
    desc: 'Xây dựng chiến lược truyền thông thương hiệu và tiếp cận cộng đồng người học tiếng Trung.',
  },
];

export default function AboutProjectPage({
  onSignIn,
  onSignUp,
  onStartSurvey,
}: AboutProjectPageProps) {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignIn = () => {
    if (onSignIn) onSignIn();
    else navigate('/auth/login');
  };

  const handleStartSurvey = () => {
    if (onStartSurvey) onStartSurvey();
    else navigate('/auth/signup');
  };

  return (
    <div className="min-h-[100dvh] bg-[#FFF9F5] text-[#18181B] selection:bg-[#B91B1C] selection:text-white font-sans overflow-x-hidden flex flex-col">
      
      {/* ── HEADER ──────────────────────────────────────────────────── */}
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

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-7 xl:gap-8 text-sm font-semibold text-[#18181B]/80">
          <button
            onClick={() => {
              navigate('/');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="hover:text-[#B91B1C] transition-colors flex items-center gap-1.5 cursor-pointer text-sm font-semibold text-[#18181B]/80"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#8FB9A7]" />
            Trang chủ
          </button>
          <button
            onClick={() => navigate('/about')}
            className="text-[#B91B1C] transition-colors flex items-center gap-1.5 cursor-pointer font-bold"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#B91B1C]" />
            Giới thiệu
          </button>
          <button
            onClick={() => navigate('/students')}
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
            className="hover:text-[#B91B1C] transition-colors flex items-center gap-1.5 group cursor-pointer"
          >
            <Crown className="w-4 h-4 text-[#B91B1C] group-hover:scale-110 transition-transform" />
            <span className="relative">
              Nâng cấp
              <span className="absolute -top-2.5 -right-5 px-1.5 py-0.2 bg-[#B91B1C] text-white text-[9px] font-bold rounded-full uppercase tracking-tighter">VIP</span>
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
            aria-label="Mở menu di động"
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
            onClick={() => { setIsMobileMenuOpen(false); navigate('/about'); }}
            className="w-full text-left flex items-center gap-2 text-sm font-bold text-[#B91B1C] bg-white p-2 rounded-xl border border-[#B91B1C]/20 transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-[#B91B1C]" />
            Giới thiệu dự án FPT EXE 2
          </button>
          <button
            onClick={() => { setIsMobileMenuOpen(false); navigate('/students'); }}
            className="w-full text-left block text-sm font-bold text-[#18181B] hover:text-[#B91B1C] p-2 rounded-xl hover:bg-white transition-colors cursor-pointer"
          >
            Học viên
          </button>
          <button
            onClick={() => { setIsMobileMenuOpen(false); navigate('/faq'); }}
            className="w-full text-left block text-sm font-bold text-[#18181B] hover:text-[#B91B1C] p-2 rounded-xl hover:bg-white transition-colors cursor-pointer"
          >
            Hỏi đáp
          </button>
          <button
            onClick={() => { setIsMobileMenuOpen(false); navigate('/premium'); }}
            className="w-full flex items-center justify-between text-sm font-bold text-[#B91B1C] p-2 rounded-xl bg-white border border-[#B91B1C]/20 shadow-2xs cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-[#B91B1C]" />
              Nâng cấp gói VIP
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#B91B1C] text-white text-[10px] font-bold uppercase">
              Xem gói
            </span>
          </button>
        </div>
      )}

      {/* ── MAIN CONTENT ────────────────────────────────────────────── */}
      <main className="flex-1">
        
        {/* Breadcrumb & Top Title Section */}
        <section className="pt-8 sm:pt-12 pb-6 px-4 sm:px-6 md:px-12 max-w-7xl mx-auto">

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#8FB9A7]/15 border border-[#8FB9A7]/30 text-[#2F6E62] text-xs font-bold uppercase tracking-wider mb-4 shadow-2xs">
            <Building2 className="w-3.5 h-3.5" />
            <span>Đại Học FPT · Khởi Nghiệp Thực Tế EXE 2</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#18181B] font-fraunces leading-[1.15] mb-4 max-w-4xl tracking-tight">
            Dự Án Khởi Nghiệp <span className="text-[#B91B1C]">HanFlix</span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-[#5F6368] leading-relaxed max-w-3xl">
            Nền tảng học tiếng Trung thế hệ mới kết hợp ngữ cảnh phim điện ảnh đời thực và trí tuệ nhân tạo (AI), phát triển bởi nhóm sinh viên Trường Đại học FPT.
          </p>
        </section>

        {/* Project Overview Showcase */}
        <section className="py-8 sm:py-12 px-4 sm:px-6 md:px-12 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Visual Frame */}
            <div className="lg:col-span-7 relative group">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-2 border-[#F2E4D8] bg-[#18181B] aspect-[16/10]">
                <img
                  src="/assets/about.png"
                  alt="Dự án khởi nghiệp HanFlix - FPT University EXE 2"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/assets/fpt_exe2_project.jpg';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                
                {/* Floating Tag */}
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex flex-wrap items-center justify-between gap-3 text-white">
                  <div className="flex items-center gap-2.5 bg-black/60 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/20">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#8FB9A7] animate-ping" />
                    <span className="text-xs sm:text-sm font-bold">FPT Innovation & EdTech Lab</span>
                  </div>
                  <span className="text-xs font-mono text-[#E7A92F] font-semibold bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#E7A92F]/30">
                    Học phần EXE 2 · FPT University
                  </span>
                </div>
              </div>
            </div>

            {/* Description & Narrative */}
            <div className="lg:col-span-5 space-y-5">
              <div className="p-6 rounded-3xl bg-white border border-[#F2E4D8] shadow-sm">
                <h2 className="text-lg sm:text-xl font-bold text-[#18181B] font-fraunces mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#B91B1C]" />
                  <span>Sứ Mệnh Khởi Nghiệp</span>
                </h2>
                <p className="text-xs sm:text-sm text-[#5F6368] leading-relaxed">
                  HanFlix là dự án khởi nghiệp công nghệ giáo dục (EdTech) sinh viên được ấp ủ và phát triển trong khuôn khổ môn học Khởi nghiệp thực tế EXE 2 của Trường Đại học FPT. Dự án ra đời nhằm giải quyết rào cản ngữ âm và phản xạ tự nhiên của người Việt khi học tiếng Trung, thay thế phương pháp học từ vựng truyền thống khô khan bằng trải nghiệm nhập vai qua các trích đoạn phim điện ảnh, phụ đề thông minh 3 tầng (Hán tự, Pinyin, Tiếng Việt) cùng trợ lý AI phân tích phát âm và thuật toán lặp lại ngắt quãng (SRS).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-[#F2E4D8] text-center shadow-2xs">
                  <div className="text-2xl sm:text-3xl font-black text-[#B91B1C] font-fraunces">500+</div>
                  <div className="text-xs text-[#5F6368] font-medium mt-1">Trích đoạn phim thực tế</div>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-[#F2E4D8] text-center shadow-2xs">
                  <div className="text-2xl sm:text-3xl font-black text-[#E7A92F] font-fraunces">3 Tầng</div>
                  <div className="text-xs text-[#5F6368] font-medium mt-1">Phụ đề Hán - Pinyin - Việt</div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* 3 Core Pillars */}
        <section className="py-12 sm:py-16 px-4 sm:px-6 md:px-12 bg-white border-y border-[#F2E4D8]/80">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E7A92F]/15 text-[#B7791F] text-xs font-bold uppercase tracking-wider mb-3">
                Giải Pháp Đột Phá
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-[#18181B] font-fraunces">
                Giá Trị Cốt Lõi Của HanFlix
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              <div className="p-6 sm:p-8 rounded-3xl bg-[#FFF9F5] border border-[#F2E4D8] shadow-xs hover:border-[#B91B1C]/40 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-[#B91B1C]/10 text-[#B91B1C] flex items-center justify-center font-bold text-lg mb-4 font-fraunces">
                  01
                </div>
                <h3 className="text-lg font-bold text-[#18181B] mb-2">Ngữ cảnh phim đời sống</h3>
                <p className="text-xs sm:text-sm text-[#5F6368] leading-relaxed">
                  Học qua các đoạn hội thoại thực tế từ phim ảnh: giao dịch, sân bay, nhà hàng, công sở. Giúp phản xạ tự nhiên thay vì học vẹt câu mẫu.
                </p>
              </div>

              <div className="p-6 sm:p-8 rounded-3xl bg-[#FFF9F5] border border-[#F2E4D8] shadow-xs hover:border-[#E7A92F]/60 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-[#E7A92F]/20 text-[#B7791F] flex items-center justify-center font-bold text-lg mb-4 font-fraunces">
                  02
                </div>
                <h3 className="text-lg font-bold text-[#18181B] mb-2">Phụ đề 3 tầng & Tra từ 1-chạm</h3>
                <p className="text-xs sm:text-sm text-[#5F6368] leading-relaxed">
                  Tùy chỉnh độc lập tầng chữ Hán, Pinyin và Tiếng Việt. Chạm vào bất kỳ chữ Hán nào để xem phát âm, bộ thủ và ví dụ sử dụng.
                </p>
              </div>

              <div className="p-6 sm:p-8 rounded-3xl bg-[#FFF9F5] border border-[#F2E4D8] shadow-xs hover:border-[#8FB9A7]/60 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-[#8FB9A7]/20 text-[#2F6E62] flex items-center justify-center font-bold text-lg mb-4 font-fraunces">
                  03
                </div>
                <h3 className="text-lg font-bold text-[#18181B] mb-2">AI Chỉnh âm & Thuật toán SRS</h3>
                <p className="text-xs sm:text-sm text-[#5F6368] leading-relaxed">
                  Công nghệ AI nhận diện ngữ điệu 4 thanh chuẩn mực, kết hợp Spaced Repetition tối ưu chu kỳ ghi nhớ dài hạn đúng thời điểm vàng.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Mentor & Team Members Showcase */}
        <section className="py-14 sm:py-20 px-4 sm:px-6 md:px-12 max-w-7xl mx-auto">
          
          {/* Mentor Feature Card */}
          <div className="mb-14 rounded-3xl bg-gradient-to-br from-white via-[#FFF9F5] to-[#FFF3DE]/80 border-2 border-[#E7A92F]/50 shadow-xl overflow-hidden p-6 sm:p-10 lg:p-12 relative">
            {/* Background Decorative Stamp */}
            <div className="absolute top-4 right-4 sm:top-8 sm:right-8 w-24 h-24 sm:w-32 sm:h-32 rounded-full border border-[#E7A92F]/20 flex items-center justify-center text-[#E7A92F]/20 font-calligraphy text-4xl sm:text-6xl pointer-events-none select-none">
              师
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              
              {/* Left Column: Portrait Photograph */}
              <div className="lg:col-span-4 flex flex-col items-center text-center">
                <div className="relative group">
                  {/* Subtle Oriental Glow behind portrait */}
                  <div className="absolute -inset-1.5 bg-gradient-to-r from-[#B91B1C]/30 via-[#E7A92F]/40 to-[#8FB9A7]/30 rounded-3xl blur-md opacity-70 group-hover:opacity-100 transition-opacity" />
                  
                  {/* Portrait Card with natural aspect ratio to showcase full poster */}
                  <div className="relative w-52 sm:w-60 aspect-[1037/1516] rounded-2xl overflow-hidden border-2 border-[#E7A92F] shadow-lg bg-[#B91B1C]">
                    <img
                      src="/assets/mentor_vuong_tieu_oanh.png"
                      alt="Thạc sĩ Vương Tiểu Oanh - Giảng viên Bộ môn Quản trị kinh doanh Trường Đại học FPT Hà Nội"
                      className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                </div>

                {/* Badge placed below portrait with NO overlap on the photo */}
                <div className="mt-4 flex flex-col items-center text-center">
                  <span className="px-4 py-1.5 rounded-full bg-[#B91B1C] text-white text-xs font-black uppercase tracking-wider shadow-sm border border-white/20 mb-2 inline-block">
                    Mentor & Giảng Viên Hướng Dẫn
                  </span>
                  <div className="text-xs font-bold text-[#8FB9A7] uppercase tracking-wider">
                    Trường Đại Học FPT Hà Nội
                  </div>
                  <div className="text-xs font-semibold text-[#5F6368] mt-0.5">
                    Bộ Môn Quản Trị Kinh Doanh
                  </div>
                </div>
              </div>

              {/* Right Column: Bio & Mentorship Scope */}
              <div className="lg:col-span-8 space-y-4 sm:space-y-5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E7A92F]/15 border border-[#E7A92F]/30 text-[#B7791F] text-xs font-bold uppercase tracking-wider">
                  <GraduationCap className="w-4 h-4 text-[#B7791F]" />
                  <span>Cố Vấn Chuyên Môn & Giảng Viên Hướng Dẫn</span>
                </div>

                <div>
                  <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-[#18181B] font-fraunces tracking-tight leading-tight">
                    Thạc Sĩ Vương Tiểu Oanh
                  </h2>
                  <div className="text-sm sm:text-base font-bold text-[#B91B1C] mt-1.5 flex flex-wrap items-center gap-2">
                    <span>Giảng viên Bộ môn Quản trị kinh doanh</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E7A92F]" />
                    <span className="text-[#8B5A2B]">Trường Đại học FPT Hà Nội</span>
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-[#5F6368] mt-0.5">
                    Giảng viên hướng dẫn môn học: Khởi nghiệp thực tế (EXE 2) · Đề tài Khởi nghiệp HanFlix
                  </div>
                </div>

                <p className="text-xs sm:text-sm md:text-base text-[#5F6368] leading-relaxed">
                  Đồng hành cùng nhóm sinh viên sáng lập ngay từ những ngày đầu ấp ủ ý tưởng, Thạc sĩ Vương Tiểu Oanh trực tiếp định hướng phương pháp luận nghiên cứu thị trường EdTech, cố vấn chiến lược mô hình kinh doanh khởi nghiệp bền vững và bảo trợ chất lượng học thuật cho phương pháp đào tạo tiếng Trung qua phim ảnh thực tế của HanFlix.
                </p>

                {/* 3 Pillars of Mentorship */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-1">
                  <div className="p-3.5 rounded-2xl bg-white border border-[#F2E4D8] shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#B91B1C]">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Chiến Lược Kinh Doanh</span>
                    </div>
                    <p className="text-[11px] text-[#5F6368] leading-snug">
                      Định hình mô hình Lean Canvas, tối ưu cơ cấu chi phí và thẩm định tiềm năng thương mại hóa thực tế.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white border border-[#F2E4D8] shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#E7A92F]">
                      <Award className="w-3.5 h-3.5" />
                      <span>Học Thuật & Khung HSK</span>
                    </div>
                    <p className="text-[11px] text-[#5F6368] leading-snug">
                      Chuẩn hóa cấu trúc ngữ liệu phim theo khung năng lực HSK 1 - 6 và bảo đảm tính sư phạm chặt chẽ.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white border border-[#F2E4D8] shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#2F6E62]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Khởi Nghiệp Thực Tế</span>
                    </div>
                    <p className="text-[11px] text-[#5F6368] leading-snug">
                      Hướng dẫn triển khai khảo sát học viên, thử nghiệm phiên bản MVP và hoàn thiện báo cáo môn học EXE 2.
                    </p>
                  </div>
                </div>

                {/* Inspirational Quote */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-[#FFF3DE]/60 border border-[#E7A92F]/40 flex items-start gap-3">
                  <span className="text-xl sm:text-2xl text-[#E7A92F] font-serif shrink-0">“</span>
                  <p className="text-xs sm:text-sm font-medium italic text-[#8B5A2B] leading-relaxed">
                    Khởi nghiệp không chỉ là xây dựng một nền tảng công nghệ, mà là giải quyết triệt để nỗi sợ phát âm và tạo động lực học tập tự nhiên mỗi ngày cho cộng đồng người Việt yêu thích tiếng Trung.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Team Members Header */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8FB9A7]/15 text-[#2F6E62] text-xs font-bold uppercase tracking-wider mb-2">
                <Users className="w-3.5 h-3.5" />
                <span>Nhóm Sinh Viên Khởi Nghiệp</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-[#18181B] font-fraunces">
                Đội Ngũ Thực Hiện Dự Án
              </h2>
              <p className="text-xs sm:text-sm text-[#5F6368] mt-1">
                Các thành viên sáng lập và phát triển dự án HanFlix tại Trường Đại học FPT.
              </p>
            </div>
            <span className="text-xs font-bold text-[#2F6E62] bg-[#8FB9A7]/15 px-3.5 py-1.5 rounded-full border border-[#8FB9A7]/30 self-start sm:self-auto">
              6 Thành Viên Nhóm
            </span>
          </div>

          {/* 6 Team Member Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {PROJECT_MEMBERS.map((member, idx) => (
              <div
                key={idx}
                className="p-6 rounded-3xl bg-white border border-[#F2E4D8] hover:border-[#B91B1C]/40 hover:shadow-md transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-13 h-13 rounded-2xl bg-[#FFF9F5] border border-[#F2E4D8] group-hover:bg-[#B91B1C] group-hover:text-white group-hover:border-[#B91B1C] flex items-center justify-center font-fraunces text-lg font-bold text-[#B91B1C] shadow-2xs transition-all">
                      {member.name.charAt(0)}
                    </div>
                    {idx === 0 ? (
                      <span className="px-2.5 py-1 rounded-full bg-[#B91B1C] text-white text-[10px] font-bold tracking-wide uppercase shadow-2xs">
                        Trưởng Dự Án
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-[#FFF9F5] border border-[#F2E4D8] text-[#5F6368] text-[10px] font-semibold">
                        Thành viên
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-[#18181B] group-hover:text-[#B91B1C] transition-colors mb-1">
                    {member.name}
                  </h3>
                  
                  <p className="text-xs font-semibold text-[#B7791F] mb-3">
                    {member.role}
                  </p>

                  <p className="text-xs text-[#5F6368] leading-relaxed">
                    {member.desc}
                  </p>
                </div>

                <div className="pt-4 mt-5 border-t border-[#F2E4D8]/60 flex items-center justify-between text-[11px] text-[#8B9097] font-medium">
                  <span>Trường Đại học FPT</span>
                  <span className="text-[#8FB9A7] font-bold">Khởi Nghiệp EXE 2</span>
                </div>
              </div>
            ))}
          </div>

        </section>

        {/* CTA Bottom Banner */}
        <section className="py-12 sm:py-16 px-4 sm:px-6 md:px-12 bg-[#FFF3DE]/60 border-t border-[#F2E4D8]">
          <div className="max-w-4xl mx-auto text-center space-y-5">
            <h2 className="text-2xl sm:text-4xl font-bold text-[#18181B] font-fraunces">
              Sẵn Sàng Chinh Phục Tiếng Trung Cùng HanFlix?
            </h2>
            <p className="text-xs sm:text-sm text-[#5F6368] max-w-xl mx-auto leading-relaxed">
              Trải nghiệm phương pháp học ngôn ngữ qua phim ảnh đời sống và khám phá lộ trình được cá nhân hóa cho riêng bạn.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={handleStartSurvey}
                className="h-11 sm:h-12 px-6 sm:px-8 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs sm:text-sm font-bold flex items-center gap-2 glow-crimson transition-all active:scale-[0.98] cursor-pointer"
              >
                <span>Tìm Lộ Trình Của Tôi</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/premium')}
                className="h-11 sm:h-12 px-6 sm:px-8 rounded-full bg-white border-2 border-[#D7AF70] hover:bg-[#FFF3DE] text-[#B7791F] text-xs sm:text-sm font-bold flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Crown className="w-4 h-4 text-[#B7791F]" />
                <span>Xem Các Gói Nâng Cấp</span>
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="relative bg-[#FFF9F5] border-t-2 border-[#F2E4D8] pt-12 sm:pt-16 pb-12 px-6 sm:px-10 lg:px-12 xl:px-16 overflow-hidden">
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
                <li><button onClick={() => navigate('/about')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Dự án FPT EXE 2</button></li>
                <li><button onClick={() => navigate('/premium')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Gói cước Premium</button></li>
                <li><button onClick={() => navigate('/students')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Cảm nhận học viên</button></li>
                <li><button onClick={() => navigate('/faq')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Hỏi đáp thường gặp</button></li>
                <li><button onClick={() => navigate('/#lessons')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Kho bài học mẫu HSK</button></li>
              </ul>
            </div>

            {/* Col 3: Phương Pháp */}
            <div className="lg:pl-6 xl:pl-10">
              <h4 className="font-bold text-sm text-[#18181B] uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-1.5">
                <span className="text-[#8FB9A7]">🎋</span>
                <span>Phương Pháp</span>
              </h4>
              <ul className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm text-[#5F6368]">
                <li><button onClick={() => { navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-[#B91B1C] transition-colors cursor-pointer">Phụ đề 3 tầng</button></li>
                <li><button onClick={() => { navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-[#B91B1C] transition-colors cursor-pointer">Tra từ 1-chạm</button></li>
                <li><button onClick={() => { navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-[#B91B1C] transition-colors cursor-pointer">Phản xạ cùng AI</button></li>
                <li><button onClick={() => { navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-[#B91B1C] transition-colors cursor-pointer">Flashcard SRS</button></li>
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
