import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Check,
  Star,
  Volume2,
  Sparkles,
  Film,
  BookOpen,
  Brain,
  ShieldCheck,
  Crown,
  Menu,
  X,
} from 'lucide-react';
import { SAMPLE_LESSONS } from '../data/hanflixData';
import OrientalThreeCanvas from './OrientalThreeCanvas';
import ContactShowcase from './common/ContactShowcase';

interface LandingPageProps {
  onStartSurvey: () => void;
  onViewSample: (lessonId?: string) => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onNavigateToPricing?: () => void;
  onNavigateToAbout?: () => void;
  onNavigateToTestimonials?: () => void;
  onNavigateToFaq?: () => void;
}

const CUES = [
  {
    zh: '服务员，请拿一下菜单。',
    pinyin: 'Fúwùyuán, qǐng ná yíxià càidān.',
    vi: 'Phục vụ ơi, cho tôi xin thực đơn.',
    tokens: [
      { text: '服务员', pinyin: 'fú wù yuán', vi: 'Người phục vụ / bồi bàn' },
      { text: '，', pinyin: '', vi: '' },
      { text: '请', pinyin: 'qǐng', vi: 'Xin, mời, làm ơn' },
      { text: '拿一下', pinyin: 'ná yí xià', vi: 'Lấy giúp một chút' },
      { text: '菜单', pinyin: 'cài dān', vi: 'Thực đơn, menu món ăn' },
      { text: '。', pinyin: '', vi: '' },
    ]
  },
  {
    zh: '我想点一个宫保鸡丁。',
    pinyin: 'Wǒ xiǎng diǎn yīgè gōngbǎo jīdīng.',
    vi: 'Tôi muốn gọi một phần gà cung bảo.',
    tokens: [
      { text: '我', pinyin: 'wǒ', vi: 'Tôi' },
      { text: '想', pinyin: 'xiǎng', vi: 'Muốn, nghĩ' },
      { text: '点', pinyin: 'diǎn', vi: 'Gọi (món), chọn' },
      { text: '一个', pinyin: 'yí gè', vi: 'Một phần / cái' },
      { text: '宫保鸡丁', pinyin: 'gōng bǎo jī dīng', vi: 'Gà xào Cung Bảo (món Tứ Xuyên)' },
      { text: '。', pinyin: '', vi: '' },
    ]
  },
];

const METHOD_STEPS = [
  {
    n: '01',
    icon: Film,
    title: 'Xem video ngữ cảnh 1–3 phút',
    body: 'Đắm chìm trong các thước phim thực tế: gọi món nhà hàng, sân bay, công sở, đàm phán và cổ trang đời sống.'
  },
  {
    n: '02',
    icon: BookOpen,
    title: 'Tra từ 1-chạm tức thì',
    body: 'Chạm vào bất kỳ chữ Hán nào để xem Pinyin có dấu thanh điệu, nghĩa tiếng Việt, phân tích ngữ pháp và phát âm chuẩn.'
  },
  {
    n: '03',
    icon: Sparkles,
    title: 'Luyện phản xạ cùng AI',
    body: 'Nhận xét ngữ điệu tức thời, mô phỏng tình huống đối đáp trực tiếp giúp bạn xóa bỏ nỗi sợ nói tiếng Trung ngập ngừng.'
  },
  {
    n: '04',
    icon: Brain,
    title: 'Ôn tập thông minh SRS',
    body: 'Thuật toán lặp lại ngắt quãng (Spaced Repetition) tự động nhắc bạn ôn luyện đúng thời điểm vàng trước khi não bộ lãng quên.'
  },
];

const TESTIMONIALS = [
  {
    name: 'Trần Minh Anh',
    role: 'Học viên HSK 4 · Nhân viên Logistics',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
    content: 'Trước đây mình học giáo trình truyền thống rất nhanh chán. Xem phim trên HanFlix vừa xem vừa bấm tra từ cực kỳ tiện, giờ mình đã tự tin giao dịch với đối tác Trung Quốc!',
    level: 'HSK 4',
    stars: 5,
  },
  {
    name: 'Nguyễn Quốc Huy',
    role: 'Du học sinh Bắc Kinh',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    content: 'Phụ đề 3 lớp Hán - Pinyin - Việt là điểm khác biệt lớn nhất. Tính năng tắt/bật từng lớp phụ đề giúp mình luyện nghe cực sâu trước khi thi HSKK.',
    level: 'HSK 5',
    stars: 5,
  },
  {
    name: 'Lê Thu Thảo',
    role: 'Người đam mê phim cổ trang',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
    content: 'Giao diện cổ phong rất đẹp và linh vật Gấu Trúc đáng yêu tạo cảm giác vừa học vừa giải trí. Mỗi ngày mình chỉ cần dành 15 phút là đã tích lũy được rất nhiều từ vựng hay.',
    level: 'HSK 3',
    stars: 5,
  },
];

const FAQS = [
  {
    q: 'Tôi chưa biết gì về tiếng Trung (mất gốc/mới bắt đầu) có học được không?',
    a: 'Hoàn toàn được! HanFlix thiết kế lộ trình bắt đầu từ HSK 1 với phụ đề 3 lớp đầy đủ Pinyin và nghĩa tiếng Việt. Bạn chỉ cần chọn "Chưa học bao giờ" trong khảo sát định hướng để nhận các video phù hợp nhất.'
  },
  {
    q: 'Phương pháp học qua phim ngắn trên HanFlix khác gì YouTube?',
    a: 'Trên YouTube, phụ đề thường chỉ có 1 thứ tiếng và bạn phải tạm dừng để mở app từ điển ngoài. Trên HanFlix, hệ thống phụ đề thông minh tương tác trực tiếp: chạm tra từ tức thì, lưu từ vào Flashcard SRS và làm bài tập phản xạ ngay sau video.'
  },
  {
    q: 'Khảo sát tìm lộ trình học mất bao lâu?',
    a: 'Chỉ mất khoảng 2 phút với 6 câu hỏi ngắn về mục tiêu (giao tiếp, du học, công việc), thời gian rảnh và chủ đề bạn yêu thích để tạo lộ trình cá nhân hóa hoàn toàn miễn phí.'
  },
  {
    q: 'Tôi có thể trải nghiệm thử bài học trước khi đăng ký tài khoản không?',
    a: 'Có! Bạn có thể nhấn nút "Xem bài học mẫu" trên trang để trải nghiệm đầy đủ trình chiếu video tương tác, tra từ vựng và xem phụ đề mẫu mà không cần tạo tài khoản trước.'
  }
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function LandingPage({
  onStartSurvey,
  onViewSample,
  onSignIn,
  onSignUp,
  onNavigateToPricing,
  onNavigateToAbout,
  onNavigateToTestimonials,
  onNavigateToFaq,
}: LandingPageProps) {
  const navigate = useNavigate();
  const [activeCueIndex, setActiveCueIndex] = useState(0);
  const [showZh, setShowZh] = useState(true);
  const [showPinyin, setShowPinyin] = useState(true);
  const [showVi, setShowVi] = useState(true);
  const [selectedToken, setSelectedToken] = useState<{ text: string; pinyin: string; vi: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'basic' | 'drama' | 'advanced'>('all');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Smooth scroll to hash anchor on mount if present
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth' });
        }, 120);
      }
    }
  }, []);

  const handleGoToAbout = () => {
    if (onNavigateToAbout) onNavigateToAbout();
    else navigate('/about');
  };

  const handleGoToPricing = () => {
    if (onNavigateToPricing) onNavigateToPricing();
    else navigate('/premium');
  };

  const handleGoToStudents = () => {
    if (onNavigateToTestimonials) {
      onNavigateToTestimonials();
      return;
    }
    navigate('/students');
  };

  const handleGoToTestimonials = handleGoToStudents;

  const handleGoToFaq = () => {
    if (onNavigateToFaq) onNavigateToFaq();
    else navigate('/faq');
  };

  const handleGoToHome = () => {
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (window.location.hash === '#method' || window.location.hash === '#') {
      window.history.replaceState(null, '', window.location.pathname);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  const activeCue = CUES[activeCueIndex];

  const filteredLessons = SAMPLE_LESSONS.filter((lesson) => {
    if (activeTab === 'basic') return lesson.hsk <= 2;
    if (activeTab === 'drama') return lesson.hsk === 3 || lesson.hsk === 4;
    if (activeTab === 'advanced') return lesson.hsk >= 5;
    return true;
  });

  return (
    <div className="relative min-h-[100dvh] bg-[#FFF9F5] text-[#18181B] selection:bg-[#B91B1C] selection:text-white font-sans overflow-x-hidden">

      {/* ── 1. PUBLIC HEADER ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 h-16 sm:h-20 md:h-[88px] flex items-center justify-between px-4 sm:px-6 md:px-12 bg-[#FFF9F5]/95 backdrop-blur-md border-b border-[#F2E4D8]/80 transition-all safe-area-top">
        {/* Logo */}
        <button
          onClick={handleGoToHome}
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
            onClick={handleGoToHome}
            className="text-[#B91B1C] transition-colors flex items-center gap-1.5 cursor-pointer font-bold"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#B91B1C]" />
            Trang chủ
          </button>
          <button
            onClick={handleGoToAbout}
            className="hover:text-[#B91B1C] transition-colors flex items-center gap-1.5 cursor-pointer text-sm font-semibold text-[#18181B]/80"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#E7A92F]" />
            Giới thiệu
          </button>
          <button
            onClick={handleGoToStudents}
            className="hover:text-[#B91B1C] transition-colors cursor-pointer text-sm font-semibold text-[#18181B]/80"
          >
            Học viên
          </button>
          <button
            onClick={handleGoToFaq}
            className="hover:text-[#B91B1C] transition-colors cursor-pointer text-sm font-semibold text-[#18181B]/80"
          >
            Hỏi đáp
          </button>
          <button
            onClick={handleGoToPricing}
            className="hover:text-[#B91B1C] transition-colors flex items-center gap-1.5 group cursor-pointer text-sm font-semibold text-[#18181B]/80"
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
            onClick={onSignIn}
            className="text-xs sm:text-sm font-bold text-[#18181B]/80 hover:text-[#B91B1C] px-2.5 sm:px-3 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Đăng nhập
          </button>
          <button
            onClick={onStartSurvey}
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
              handleGoToHome();
            }}
            className="w-full text-left flex items-center gap-2 text-sm font-bold text-[#B91B1C] p-2 rounded-xl bg-white shadow-2xs cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-[#B91B1C]" />
            Trang chủ
          </button>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              handleGoToAbout();
            }}
            className="w-full text-left flex items-center gap-2 text-sm font-bold text-[#18181B] hover:text-[#B91B1C] p-2 rounded-xl hover:bg-white transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-[#E7A92F]" />
            Giới thiệu dự án FPT EXE 2
          </button>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              handleGoToStudents();
            }}
            className="w-full text-left block text-sm font-bold text-[#18181B] hover:text-[#B91B1C] p-2 rounded-xl hover:bg-white transition-colors cursor-pointer"
          >
            Học viên
          </button>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              handleGoToFaq();
            }}
            className="w-full text-left block text-sm font-bold text-[#18181B] hover:text-[#B91B1C] p-2 rounded-xl hover:bg-white transition-colors cursor-pointer"
          >
            Hỏi đáp
          </button>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              handleGoToPricing();
            }}
            className="w-full flex items-center justify-between text-sm font-bold text-[#B91B1C] p-2.5 rounded-xl bg-white border border-[#B91B1C]/20 shadow-2xs cursor-pointer"
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

      {/* ── 2. HERO SECTION WITH THREE.JS LIVE AMBIENCE ─────────────── */}
      <section className="relative min-h-[calc(100vh-80px)] flex items-center py-8 sm:py-12 md:py-20 px-4 sm:px-6 md:px-12 overflow-hidden">
        
        {/* Three.js Interactive 3D Canvas (Lanterns swinging, cherry blossoms falling, embers floating with mouse parallax) */}
        <OrientalThreeCanvas intensity="hero" />

        {/* Ambient Oriental Glows in Background */}
        <div className="absolute top-10 left-1/4 w-[500px] h-[500px] bg-[#FDECE5]/70 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-[#FFF2DE]/70 rounded-full blur-[100px] pointer-events-none -z-10" />

        <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          
          {/* Left Hero Column: Typography & CTAs (50% width) */}
          <div className="flex flex-col items-start">
            
            {/* Top Tag */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#8FB9A7]/15 border border-[#8FB9A7]/30 text-[#2F6E62] text-xs font-bold tracking-wide uppercase mb-4 sm:mb-6 shadow-xs backdrop-blur-sm">
              <span className="text-sm">🏮</span>
              <span>Học Tiếng Trung Qua Phim & Tình Huống</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#B91B1C] leading-[1.14] mb-4 sm:mb-6 font-fraunces tracking-tight text-clamp-hero">
              Tiếng Trung Gần Hơn <br />
              <span className="text-[#18181B]">Qua Mỗi Câu Chuyện</span>
            </h1>

            {/* Highlight Badge */}
            <div className="inline-flex items-center gap-2.5 px-3.5 sm:px-4 py-2 rounded-2xl bg-[#FFF3DE] border border-[#E7A92F]/40 text-[#B7791F] text-xs sm:text-sm font-semibold mb-4 sm:mb-6 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#E7A92F] animate-ping shrink-0" />
              <span>Chỉ 15 phút mỗi ngày · Phụ đề 3 lớp Hán - Pinyin - Việt</span>
            </div>

            {/* Value Proposition */}
            <p className="text-sm sm:text-base md:text-lg text-[#5F6368] mb-8 sm:mb-10 max-w-xl leading-relaxed">
              Phương pháp học ngôn ngữ tự nhiên: xem trích đoạn phim 1–5 phút đời thực, chạm tra từ tức thì, luyện nói cùng AI và ghi nhớ lâu dài với thuật toán lặp lại ngắt quãng (SRS).
            </p>

            {/* Action Buttons (Strictly NO pricing tags) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto mb-8 sm:mb-10">
              <button
                onClick={onStartSurvey}
                className="h-12 sm:h-14 px-6 sm:px-8 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] text-white text-sm sm:text-base font-bold flex items-center justify-center gap-3 glow-crimson transition-all active:scale-[0.98] cursor-pointer"
              >
                <span>Tìm Lộ Trình Của Tôi</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                onClick={() => onViewSample(SAMPLE_LESSONS[0].id)}
                className="h-12 sm:h-14 px-6 sm:px-8 rounded-full border-2 border-[#D7AF70] hover:bg-[#FFF3DE] text-[#B7791F] hover:text-[#975A16] text-sm sm:text-base font-bold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-[#D7AF70]/20 flex items-center justify-center">
                  <Play className="w-3.5 h-3.5 fill-[#B7791F]" />
                </div>
                <span>Xem Bài Học Mẫu</span>
              </button>
            </div>

            {/* Value Checkpoints */}
            <div className="flex flex-wrap items-center gap-6 pt-6 border-t border-[#F2E4D8] w-full text-xs font-semibold text-[#5F6368]">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8FB9A7]" />
                <span>Kho bài HSK 1 - 6</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8FB9A7]" />
                <span>Không cần kiến thức nền tảng</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8FB9A7]" />
                <span>Phụ đề tương tác thông minh</span>
              </div>
            </div>

          </div>

          {/* Right Hero Column: Liberated BaoBao Panda Floating on Clouds (50% width) */}
          <div className="relative flex items-center justify-center min-h-[360px] sm:min-h-[460px] lg:min-h-[540px] group">
            
            {/* Luminous Golden Sun / Halo behind the Panda */}
            <div className="absolute inset-0 m-auto w-[280px] sm:w-[420px] md:w-[460px] h-[280px] sm:h-[420px] md:h-[460px] rounded-full bg-gradient-to-tr from-[#FFF0DE] via-[#FDECE5]/70 to-transparent blur-3xl -z-10 pointer-events-none" />

            {/* Floating Chinese Calligraphy Seal in Background */}
            <div className="absolute -top-6 left-6 text-7xl sm:text-9xl font-calligraphy text-[#B91B1C]/5 select-none pointer-events-none">
              学
            </div>
            <div className="absolute -bottom-8 right-6 text-7xl sm:text-9xl font-calligraphy text-[#B91B1C]/5 select-none pointer-events-none">
              汉
            </div>

            {/* Dynamic Animated Cloud Layer 1: Back Clouds (Slow Drift) */}
            <div className="absolute top-8 -left-8 w-32 sm:w-44 opacity-75 animate-cloud-slow pointer-events-none">
              <svg viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full drop-shadow-sm">
                <path d="M20 35C12 35 5 28 5 20C5 12 12 5 22 5C26 2 32 0 38 0C48 0 56 6 58 15C63 12 70 12 75 16C82 16 88 22 88 30C88 35 83 35 80 35Z" fill="#FFF2E2" />
                <path d="M22 35C15 35 10 30 10 24C10 18 16 12 24 12C28 10 32 8 38 8C46 8 52 13 54 20C58 18 64 18 68 21C74 21 80 25 80 32C80 35 76 35 74 35Z" fill="#FFFFFF" fillOpacity="0.8" />
              </svg>
            </div>

            {/* Dynamic Animated Cloud Layer 2: Right Flank Cloud */}
            <div className="absolute top-24 -right-10 w-36 sm:w-52 opacity-80 animate-cloud-reverse pointer-events-none">
              <svg viewBox="0 0 120 45" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full drop-shadow-sm">
                <path d="M25 40C15 40 8 32 8 22C8 13 16 6 27 6C32 2 40 0 48 0C60 0 70 7 73 17C79 14 87 14 93 18C102 18 110 25 110 34C110 40 104 40 100 40Z" fill="#FFF3DE" />
                <path d="M28 40C20 40 14 34 14 27C14 20 21 14 30 14C35 12 40 10 48 10C57 10 65 15 67 23C73 21 80 21 85 24C92 24 98 29 98 37C98 40 94 40 90 40Z" fill="#FFFFFF" fillOpacity="0.9" />
              </svg>
            </div>

            {/* Hanging Lantern with Sway Animation */}
            <div className="absolute top-2 right-4 animate-lantern z-20 pointer-events-none">
              <div className="w-0.5 h-8 sm:h-10 bg-[#8B5A2B] mx-auto" />
              <div className="w-8 sm:w-9 h-10 sm:h-11 rounded-full bg-gradient-to-b from-[#E53935] to-[#B91B1C] shadow-lg border border-[#E7A92F] flex items-center justify-center text-xs font-bold text-white">
                春
              </div>
              <div className="w-0.5 h-4 sm:h-5 bg-[#E7A92F] mx-auto" />
            </div>

            {/* MAIN PANDA MASCOT (UNBOXED, FREELY SITTING ON CLOUDS) */}
            <div className="relative z-10 w-full max-w-[280px] sm:max-w-[380px] md:max-w-[460px] animate-mascot-float flex flex-col items-center">
              <img
                src="/assets/panda-mascot-transparent.png"
                alt="Gấu Trúc Bảo Bảo - Linh vật HanFlix"
                className="w-full h-auto object-contain drop-shadow-[0_20px_35px_rgba(185,27,28,0.15)] group-hover:scale-105 transition-transform duration-700 select-none"
              />

              {/* Dynamic Animated Cloud Layer 3: Billowing Cloud Pedestal Under Panda's Seat */}
              <div className="w-full -mt-12 sm:-mt-16 md:-mt-20 opacity-90 animate-cloud pointer-events-none flex justify-center">
                <svg viewBox="0 0 260 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[85%] drop-shadow-md">
                  <path d="M40 55C20 55 5 42 5 28C5 14 20 5 38 5C45 2 56 0 68 0C85 0 100 8 105 20C115 15 130 15 140 22C155 12 175 12 188 20C198 16 210 16 220 22C235 22 250 32 250 45C250 55 240 55 230 55Z" fill="#FFF0DB" />
                  <path d="M45 55C30 55 18 45 18 33C18 21 30 12 45 12C52 10 60 8 70 8C84 8 96 14 100 24C110 20 122 20 130 26C144 18 160 18 172 25C182 22 192 22 200 27C214 27 228 35 228 47C228 55 220 55 210 55Z" fill="#FFFFFF" fillOpacity="0.9" />
                </svg>
              </div>
            </div>

            {/* Floating Speech Bubble from BaoBao */}
            <div className="absolute bottom-2 sm:bottom-4 left-1 sm:left-4 z-20 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#E7A92F]/40 shadow-xl flex items-center gap-2 sm:gap-2.5 animate-float">
              <span className="text-xl sm:text-2xl">🐼</span>
              <div>
                <div className="text-xs font-bold text-[#B91B1C]">Gấu Trúc Bảo Bảo</div>
                <div className="text-[10px] sm:text-[11px] text-[#5F6368] font-medium">你好！Cùng học tiếng Trung nào!</div>
              </div>
            </div>

            {/* Floating Celestial Badge */}
            <div className="absolute top-2 sm:top-4 left-1 sm:left-6 z-20 px-3 py-1 sm:py-1.5 rounded-full bg-white/95 backdrop-blur-sm border border-[#8FB9A7]/50 shadow-md flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-[#2F6E62]">
              <span>🏮</span>
              <span>Khởi đầu cùng HSK 1</span>
            </div>

          </div>

        </div>
      </section>

      {/* ── 3. INTERACTIVE 4-STEP METHOD & VIDEO SUBTITLE DEMO ───────── */}
      <section id="features" className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 md:px-12 bg-white relative">
        <div className="max-w-7xl mx-auto">
          
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8FB9A7]/15 text-[#2F6E62] text-xs font-bold uppercase tracking-wider mb-3">
              Phương Pháp Đột Phá
            </div>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-[#18181B] font-fraunces mb-3 sm:mb-4">
              4 Bước Làm Chủ Giao Tiếp Tự Nhiên
            </h2>
            <p className="text-[#5F6368] text-sm sm:text-base md:text-lg">
              Không học vẹt danh sách từ vựng khô khan. Bạn học trọn vẹn cảm xúc và phản xạ từ những thước phim sinh động.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
            
            {/* Interactive Subtitle Simulation Player (Left 50% - Expanded to match Right Height) */}
            <div className="bg-[#FFF9F5] rounded-3xl p-4 sm:p-6 md:p-8 border border-[#F2E4D8] shadow-lg relative flex flex-col justify-between h-full">
              
              {/* Window Header */}
              <div className="flex items-center justify-between mb-4 sm:mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#E53935]" />
                  <div className="w-3 h-3 rounded-full bg-[#E7A92F]" />
                  <div className="w-3 h-3 rounded-full bg-[#8FB9A7]" />
                  <span className="text-[11px] sm:text-xs font-bold text-[#5F6368] ml-1.5 truncate max-w-[160px] sm:max-w-none">Trình xem phụ đề HanFlix</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="bg-[#8FB9A7]/15 text-[#2F6E62] px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-bold">HSK 3</span>
                  <span className="bg-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-[#E7E7EA] text-[10px] sm:text-[11px] font-bold text-[#B91B1C]">HD 1080p</span>
                </div>
              </div>

              {/* Video Mockup Screen - Expanded for Rich Immersion */}
              <div className="relative flex-1 min-h-[260px] sm:min-h-[340px] md:min-h-[400px] rounded-2xl overflow-hidden bg-[#18181B] shadow-inner mb-4 sm:mb-5 flex flex-col justify-between p-3 sm:p-5 group">
                <img
                  src="https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1000&h=650&fit=crop&auto=format"
                  alt="Tình huống giao tiếp phim Trung Quốc"
                  crossOrigin="anonymous"
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="650" viewBox="0 0 1000 650"><rect width="1000" height="650" fill="%2318181B"/></svg>';
                  }}
                />

                {/* Top overlay controls */}
                <div className="relative z-10 flex items-center justify-between text-white/90 gap-2">
                  <span className="text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-1.5 sm:gap-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-[#8FB9A7] animate-ping shrink-0" />
                    <span className="truncate">Tình huống: Gọi món ở nhà hàng</span>
                  </span>
                  <button
                    onClick={() => setActiveCueIndex((prev) => (prev === 0 ? 1 : 0))}
                    className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-[#B91B1C] hover:bg-[#A3181A] text-white text-[11px] sm:text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                  >
                    Đổi câu ↻
                  </button>
                </div>

                {/* Center Subtitle & Interactive Vocabulary Area */}
                <div className="relative z-10 text-center bg-black/80 backdrop-blur-md rounded-2xl p-3 sm:p-5 border border-white/15 shadow-2xl">
                  
                  {/* Pinyin Layer */}
                  {showPinyin && (
                    <div className="text-xs sm:text-sm md:text-base font-mono text-[#E7A92F] font-semibold mb-1.5 sm:mb-2 tracking-wide">
                      {activeCue.pinyin}
                    </div>
                  )}

                  {/* Hanzi Interactive Tokens Layer */}
                  {showZh && (
                    <div className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-wider flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 font-hanzi my-1">
                      {activeCue.tokens.map((token, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedToken(token.vi ? token : null)}
                          className={`px-1 sm:px-1.5 py-0.5 rounded-lg transition-all cursor-pointer ${
                            token.vi
                              ? 'hover:bg-[#B91B1C] hover:text-white underline decoration-[#E7A92F] decoration-2 underline-offset-4'
                              : 'cursor-default'
                          }`}
                          title={token.vi ? 'Chạm để tra từ' : undefined}
                        >
                          {token.text}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Vietnamese Meaning Layer */}
                  {showVi && (
                    <div className="text-xs sm:text-sm text-white/85 font-medium mt-1.5 sm:mt-2">
                      {activeCue.vi}
                    </div>
                  )}

                  {/* Hint */}
                  <div className="text-[10px] text-white/50 mt-2 italic">
                    💡 Chạm vào bất kỳ chữ Hán nào để tra từ và nghe phát âm
                  </div>
                </div>

                {/* Video Playback Scrubber simulation */}
                <div className="relative z-10 pt-2">
                  <div className="w-full h-1.5 rounded-full bg-white/25 overflow-hidden mb-2">
                    <div className="w-2/5 h-full bg-[#B91B1C] rounded-full" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-white/70 font-mono">
                    <span>01:15</span>
                    <span>03:20</span>
                  </div>
                </div>

              </div>

              {/* 1-Tap Dictionary Interactive Popup Demo */}
              {selectedToken && (
                <div className="mb-4 p-3.5 sm:p-4 rounded-2xl bg-white border-2 border-[#E7A92F] shadow-lg flex items-center justify-between animate-float">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl sm:text-2xl font-black text-[#B91B1C] font-hanzi">{selectedToken.text}</span>
                      <span className="text-xs font-mono text-[#E7A92F] font-bold">[{selectedToken.pinyin}]</span>
                    </div>
                    <div className="text-xs text-[#18181B] font-semibold mt-0.5">Nghĩa: {selectedToken.vi}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => alert(`Phát âm từ: ${selectedToken.text}`)}
                      className="p-2 sm:p-2.5 rounded-full bg-[#FFF3DE] text-[#B7791F] hover:bg-[#E7A92F] hover:text-white transition-colors cursor-pointer"
                      title="Nghe phát âm"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setSelectedToken(null)}
                      className="text-xs text-[#8B9097] hover:text-[#B91B1C] font-bold px-2 py-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Subtitle Layers Toggles Bottom Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-4 border-t border-[#F2E4D8]">
                <div className="text-xs font-bold text-[#5F6368]">Hiển thị tầng phụ đề:</div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setShowZh(!showZh)}
                    className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      showZh ? 'bg-[#B91B1C] text-white shadow-xs' : 'bg-white border border-[#E7E7EA] text-[#5F6368]'
                    }`}
                  >
                    Hán tự
                  </button>
                  <button
                    onClick={() => setShowPinyin(!showPinyin)}
                    className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      showPinyin ? 'bg-[#E7A92F] text-[#18181B] shadow-xs' : 'bg-white border border-[#E7E7EA] text-[#5F6368]'
                    }`}
                  >
                    Pinyin
                  </button>
                  <button
                    onClick={() => setShowVi(!showVi)}
                    className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      showVi ? 'bg-[#8FB9A7] text-white shadow-xs' : 'bg-white border border-[#E7E7EA] text-[#5F6368]'
                    }`}
                  >
                    Tiếng Việt
                  </button>
                </div>
              </div>

            </div>

            {/* Method Steps List (Right 50% - Equal Height & Balanced Spacing) */}
            <div className="flex flex-col justify-between h-full space-y-3 sm:space-y-4">
              {METHOD_STEPS.map((step) => {
                const IconComponent = step.icon;
                return (
                  <div
                    key={step.n}
                    className="p-4 sm:p-5 md:p-6 rounded-3xl bg-[#FFF9F5] border border-[#F2E4D8] hover:border-[#B91B1C]/40 hover:shadow-md transition-all group flex items-start gap-3 sm:gap-4 flex-1"
                  >
                    <div className="w-11 sm:w-13 h-11 sm:h-13 rounded-2xl bg-white border border-[#F2E4D8] group-hover:bg-[#B91B1C] group-hover:text-white group-hover:border-[#B91B1C] flex flex-col items-center justify-center shrink-0 transition-all shadow-xs">
                      <span className="text-xs sm:text-sm font-black text-[#8FB9A7] group-hover:text-[#FFF9F5] font-fraunces leading-none">
                        {step.n}
                      </span>
                      <IconComponent className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#B91B1C] group-hover:text-white mt-1 transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base md:text-lg font-bold text-[#18181B] group-hover:text-[#B91B1C] transition-colors mb-1">
                        {step.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#5F6368] leading-relaxed">
                        {step.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

        </div>
      </section>

      {/* ── 3. FEATURED LESSON CATALOG (HSK 1 - 6) ───────────────────── */}
      <section id="lessons" className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 md:px-12 bg-[#FFF9F5] relative">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-12 gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E7A92F]/15 text-[#B7791F] text-xs font-bold uppercase tracking-wider mb-3">
                Kho Thư Viện Video
              </div>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-[#18181B] font-fraunces mb-2 sm:mb-3">
                Bài Học Mẫu Thực Tế
              </h2>
              <p className="text-[#5F6368] text-sm sm:text-base">
                Trải nghiệm những thước phim ngắn giúp bạn ghi nhớ sâu câu từ thông dụng.
              </p>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-white p-1.5 rounded-full border border-[#F2E4D8] shadow-xs overflow-x-auto no-scrollbar max-w-full flex-nowrap shrink-0">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'all'
                    ? 'bg-[#B91B1C] text-white shadow-xs'
                    : 'text-[#5F6368] hover:text-[#B91B1C]'
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setActiveTab('basic')}
                className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'basic'
                    ? 'bg-[#B91B1C] text-white shadow-xs'
                    : 'text-[#5F6368] hover:text-[#B91B1C]'
                }`}
              >
                HSK 1 - 2
              </button>
              <button
                onClick={() => setActiveTab('drama')}
                className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'drama'
                    ? 'bg-[#B91B1C] text-white shadow-xs'
                    : 'text-[#5F6368] hover:text-[#B91B1C]'
                }`}
              >
                HSK 3 - 4 (Phim ảnh)
              </button>
              <button
                onClick={() => setActiveTab('advanced')}
                className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'advanced'
                    ? 'bg-[#B91B1C] text-white shadow-xs'
                    : 'text-[#5F6368] hover:text-[#B91B1C]'
                }`}
              >
                HSK 5 - 6
              </button>
            </div>
          </div>

          {/* Video Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredLessons.slice(0, 6).map((lesson) => (
              <div
                key={lesson.id}
                onClick={() => onViewSample(lesson.id)}
                className="bg-white rounded-3xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-xl transition-all duration-300 border border-[#F2E4D8] flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-video overflow-hidden bg-stone-900">
                    <img
                      src={lesson.thumbnailAsset || 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&h=500&fit=crop&auto=format'}
                      alt={lesson.titleVi}
                      loading="lazy"
                      crossOrigin="anonymous"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="350" viewBox="0 0 600 350"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2318181B"/><stop offset="100%" stop-color="%232D201A"/></linearGradient></defs><rect width="600" height="350" fill="url(%23g)"/><text x="50%" y="45%" fill="%23ffffff" font-family="system-ui,sans-serif" font-size="24" font-weight="bold" text-anchor="middle">${encodeURIComponent(lesson.titleZh || '')}</text><text x="50%" y="62%" fill="%23E7A92F" font-family="system-ui,sans-serif" font-size="16" font-weight="600" text-anchor="middle">${encodeURIComponent(lesson.titleVi || '')}</text></svg>`;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
                    
                    {/* Play button overlay */}
                    <div className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-[#B91B1C] text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-all">
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </div>

                    {/* Duration badge */}
                    <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md rounded-md px-2.5 py-1 flex items-center gap-1.5 text-white text-xs font-medium">
                      <span>{formatDuration(lesson.durationSeconds)}</span>
                    </div>

                    {/* HSK Level tag */}
                    <div className="absolute top-3 left-3 bg-[#8FB9A7] text-white rounded-full px-3 py-0.5 text-[10px] font-black tracking-wider uppercase shadow-xs">
                      HSK {lesson.hsk}
                    </div>
                  </div>

                  <div className="p-6">
                    <h3 className="font-bold text-[#18181B] text-xl mb-1.5 group-hover:text-[#B91B1C] transition-colors line-clamp-1">
                      {lesson.titleVi}
                    </h3>
                    <p className="text-[#B91B1C] text-sm font-medium mb-3 font-hanzi">
                      {lesson.titleZh}
                    </p>
                    <p className="text-xs text-[#5F6368] line-clamp-2 leading-relaxed">
                      Luyện phản xạ tình huống thực tế, tra nghĩa từng câu thoại và ghi nhớ từ vựng tự nhiên.
                    </p>
                  </div>
                </div>

                <div className="px-6 pb-6 pt-2 border-t border-[#F2E4D8]/60 flex items-center justify-between text-xs font-bold text-[#8FB9A7]">
                  <span>Học thử miễn phí</span>
                  <span className="flex items-center gap-1 text-[#B91B1C] group-hover:translate-x-1 transition-transform">
                    Xem bài này <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <button
              onClick={onSignIn}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white border-2 border-[#B91B1C] text-[#B91B1C] hover:bg-[#B91B1C] hover:text-white font-bold text-sm transition-all shadow-xs cursor-pointer"
            >
              <span>Xem toàn bộ 500+ bài học trong Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </section>

      {/* ── 5. LEARNER TESTIMONIALS ──────────────────────────────────── */}
      <section id="students" className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 md:px-12 bg-white relative">
        <span id="community" className="sr-only" />
        <span id="testimonials" className="sr-only" />
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B91B1C]/10 text-[#B91B1C] text-xs font-bold uppercase tracking-wider mb-3">
              Cảm Nhận Thực Tế
            </div>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-[#18181B] font-fraunces mb-3 sm:mb-4">
              Học Viên Nói Gì Về HanFlix?
            </h2>
            <p className="text-[#5F6368] text-sm sm:text-base">
              Hàng ngàn bạn trẻ và người đi làm đã chinh phục tiếng Trung tự tin qua phim ảnh.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {TESTIMONIALS.map((t, idx) => (
              <div
                key={idx}
                className="p-6 sm:p-8 rounded-3xl bg-[#FFF9F5] border border-[#F2E4D8] shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-1 text-[#E7A92F] mb-4">
                    {[...Array(t.stars)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-[#E7A92F]" />
                    ))}
                  </div>
                  <p className="text-sm text-[#252229] leading-relaxed mb-6 italic">
                    "{t.content}"
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-[#F2E4D8]">
                  <img
                    src={t.avatar}
                    alt={t.name}
                    crossOrigin="anonymous"
                    loading="lazy"
                    className="w-11 h-11 rounded-full object-cover border-2 border-[#E7A92F]"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><rect width="44" height="44" rx="22" fill="%23E7A92F"/><text x="50%" y="58%" fill="%23ffffff" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">${encodeURIComponent(t.name.charAt(0))}</text></svg>`;
                    }}
                  />
                  <div>
                    <div className="font-bold text-sm text-[#18181B]">{t.name}</div>
                    <div className="text-xs text-[#8FB9A7] font-semibold">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 sm:mt-12 text-center">
            <button
              onClick={() => navigate('/students')}
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 rounded-full bg-white border border-[#E7A92F] text-[#B7791F] hover:bg-[#FFF3DE] font-bold text-sm transition-all shadow-xs cursor-pointer"
            >
              <span>Xem thêm câu chuyện học viên chi tiết</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </section>

      {/* ── 6. FAQ & BAOBAO ASSISTANT SECTION ──────────────────────── */}
      <section id="faq" className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 md:px-12 bg-[#FFF9F5] relative overflow-hidden">
        {/* Subtle decorative background watermark */}
        <div className="absolute -top-10 -left-10 text-[120px] sm:text-[180px] font-calligraphy text-[#B91B1C]/3 select-none pointer-events-none">
          答
        </div>

        <div className="max-w-7xl mx-auto">
          
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#8FB9A7]/15 border border-[#8FB9A7]/30 text-[#2F6E62] text-xs font-bold uppercase tracking-wider mb-3">
              <span>🏮</span>
              <span>Giải Đáp Tận Tâm</span>
            </div>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-[#18181B] font-fraunces mb-3 sm:mb-4">
              Câu Hỏi Thường Gặp
            </h2>
            <p className="text-[#5F6368] text-sm sm:text-base">
              Tất cả những điều bạn cần biết trước khi bắt đầu hành trình cùng HanFlix.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-10 items-stretch">
            
            {/* FAQ Accordion List (50% width) */}
            <div className="space-y-3.5 sm:space-y-4 flex flex-col justify-between">
              {FAQS.map((faq, i) => {
                const isOpen = openFaq === i;
                const num = `0${i + 1}`;
                return (
                  <div
                    key={i}
                    className={`bg-white/95 rounded-2xl border-2 transition-all duration-300 overflow-hidden shadow-xs ${
                      isOpen
                        ? 'border-[#B91B1C]/40 shadow-md ring-1 ring-[#B91B1C]/15'
                        : 'border-[#F2E4D8] hover:border-[#E7A92F]/60'
                    }`}
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="w-full px-4 sm:px-5 py-4 sm:py-4.5 flex items-center justify-between text-left gap-3 cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                        <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#8FB9A7]/15 border border-[#8FB9A7]/30 text-[#2F6E62] flex items-center justify-center font-fraunces text-xs font-black shrink-0">
                          {num}
                        </span>
                        <span className="font-bold text-[#18181B] text-sm sm:text-base group-hover:text-[#B91B1C] transition-colors leading-snug">
                          {faq.q}
                        </span>
                      </div>
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-all shrink-0 font-mono text-base font-bold ${
                          isOpen
                            ? 'bg-[#B91B1C] text-white rotate-180'
                            : 'bg-[#FFF9F5] border border-[#F2E4D8] text-[#E7A92F] group-hover:border-[#E7A92F]'
                        }`}
                      >
                        {isOpen ? '−' : '+'}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2 text-xs sm:text-sm text-[#5F6368] leading-relaxed border-t border-[#F2E4D8]/60 ml-9 sm:ml-11">
                        <p>{faq.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* BaoBao Panda Assistant Help Card (50% width, balanced height) */}
            <div className="rounded-3xl bg-gradient-to-b from-white via-[#FFFDF9] to-[#FFF3DE] border-2 border-[#E7A92F]/40 p-6 sm:p-8 shadow-lg relative overflow-hidden flex flex-col justify-between text-center h-full">
              
              {/* Decorative corner lantern */}
              <div className="absolute top-0 right-6 animate-lantern pointer-events-none">
                <div className="w-0.5 h-7 bg-[#8B5A2B] mx-auto" />
                <div className="w-7 h-8 rounded-full bg-[#B91B1C] shadow-xs flex items-center justify-center text-[9px] text-[#E7A92F] font-bold">
                  福
                </div>
              </div>

              <div>
                {/* Avatar */}
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-white border-2 border-[#E7A92F] shadow-md mx-auto mb-4 sm:mb-5 group">
                  <img
                    src="/assets/panda-mascot-transparent.png"
                    alt="Trợ lý Bảo Bảo"
                    className="w-full h-full object-contain select-none"
                  />
                  <span className="absolute bottom-1 right-2 w-4 h-4 rounded-full bg-[#8FB9A7] border-2 border-white shadow-xs" title="Trực tuyến" />
                </div>

                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#8FB9A7]/15 text-[#2F6E62] text-xs font-bold mb-3">
                  <span>🏮 Trợ Lý Đồng Hành 24/7</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-[#18181B] font-fraunces mb-2">
                  Bạn Cần Tư Vấn Riêng?
                </h3>

                <p className="text-xs sm:text-sm text-[#5F6368] leading-relaxed max-w-md mx-auto mb-5 sm:mb-6">
                  Chưa biết trình độ của mình ở đâu? Hãy để Gấu Trúc Bảo Bảo gợi ý lộ trình phù hợp qua 6 câu hỏi ngắn nhé!
                </p>
              </div>

              <div>
                <button
                  onClick={onStartSurvey}
                  className="w-full py-3.5 sm:py-4 px-6 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 glow-crimson transition-all active:scale-[0.98] cursor-pointer mb-3"
                >
                  <span>Tìm Lộ Trình Của Tôi</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => onViewSample(SAMPLE_LESSONS[0].id)}
                  className="w-full py-3 sm:py-3.5 px-6 rounded-full border-2 border-[#D7AF70] hover:bg-[#FFF3DE] text-[#B7791F] font-bold text-xs sm:text-sm transition-colors cursor-pointer mb-4 sm:mb-5"
                >
                  Trải nghiệm bài học mẫu ngay
                </button>

                <div className="pt-4 border-t border-[#F2E4D8] w-full flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-[11px] sm:text-xs font-semibold text-[#8B9097]">
                  <span className="flex items-center gap-1 text-[#2F6E62]">✓ Miễn phí 100%</span>
                  <span className="flex items-center gap-1 text-[#2F6E62]">✓ Kết quả sau 2 phút</span>
                  <span className="flex items-center gap-1 text-[#2F6E62]">✓ Lộ trình chuẩn HSK</span>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ── 8. LUXURY ORIENTAL FOOTER ───────────────────────────────── */}
      <footer className="relative bg-[#FFF9F5] border-t-2 border-[#F2E4D8] pt-12 sm:pt-16 pb-12 px-6 sm:px-10 lg:px-12 xl:px-16 overflow-hidden">
        
        {/* Architectural Pagoda Eaves Silhouette Top Transition */}
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-72 h-5 flex items-center justify-center pointer-events-none">
          <div className="w-full h-2 rounded-full bg-gradient-to-r from-transparent via-[#D7AF70]/50 to-transparent" />
          <div className="absolute w-8 h-8 rounded-full bg-[#FFF9F5] border-2 border-[#D7AF70] flex items-center justify-center text-[#B91B1C] font-calligraphy text-xs font-bold">
            汉
          </div>
        </div>

        <div className="w-full max-w-[1720px] mx-auto">
          
          {/* Main Footer Grid - 4 Balanced Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-8 xl:gap-12 pb-10 sm:pb-12 border-b border-[#F2E4D8]">
            
            {/* Col 1: Brand & Philosophy */}
            <div className="space-y-4">
              <div className="mb-2 sm:mb-4">
                <img
                  src="/assets/logo.png"
                  alt="HanFlix Logo"
                  className="h-16 sm:h-20 md:h-24 w-auto max-w-[220px] sm:max-w-[280px] object-contain"
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

            {/* Col 2: Khóa học & Dự án */}
            <div className="lg:pl-6 xl:pl-10">
              <h4 className="font-bold text-sm text-[#18181B] uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-1.5">
                <span className="text-[#8FB9A7]">🎋</span>
                <span>Khám Phá</span>
              </h4>
              <ul className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm text-[#5F6368]">
                <li>
                  <button
                    onClick={handleGoToAbout}
                    className="hover:text-[#B91B1C] transition-colors font-semibold text-[#B91B1C] cursor-pointer text-left"
                  >
                    Dự án FPT EXE 2
                  </button>
                </li>
                <li>
                  <button
                    onClick={handleGoToPricing}
                    className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left"
                  >
                    Gói cước Premium
                  </button>
                </li>
                <li>
                  <button
                    onClick={handleGoToStudents}
                    className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left"
                  >
                    Cảm nhận học viên
                  </button>
                </li>
                <li>
                  <button
                    onClick={handleGoToFaq}
                    className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left"
                  >
                    Hỏi đáp thường gặp
                  </button>
                </li>
                <li><a href="#lessons" className="hover:text-[#B91B1C] transition-colors">Kho bài học mẫu HSK</a></li>
              </ul>
            </div>

            {/* Col 3: Phương pháp */}
            <div className="lg:pl-6 xl:pl-10">
              <h4 className="font-bold text-sm text-[#18181B] uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-1.5">
                <span className="text-[#8FB9A7]">🎋</span>
                <span>Phương Pháp</span>
              </h4>
              <ul className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm text-[#5F6368]">
                <li><a href="#features" className="hover:text-[#B91B1C] transition-colors">Phụ đề 3 tầng</a></li>
                <li><a href="#features" className="hover:text-[#B91B1C] transition-colors">Tra từ 1-chạm</a></li>
                <li><a href="#features" className="hover:text-[#B91B1C] transition-colors">Phản xạ cùng AI</a></li>
                <li><a href="#features" className="hover:text-[#B91B1C] transition-colors">Flashcard SRS</a></li>
                <li><button onClick={onStartSurvey} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Khảo sát lộ trình</button></li>
              </ul>
            </div>

            {/* Col 4: Thông tin liên hệ & Kết nối */}
            <div className="space-y-3.5">
              <ContactShowcase variant="footer" />

              {/* Social Media Links */}
              <div className="mt-3.5 flex flex-wrap items-center gap-2.5 pt-1">
                <span className="text-xs font-bold text-[#8B9097]">Mạng xã hội:</span>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { name: 'Facebook', href: 'https://facebook.com' },
                    { name: 'YouTube', href: 'https://youtube.com' },
                    { name: 'TikTok', href: 'https://tiktok.com' },
                    { name: 'Instagram', href: 'https://instagram.com' },
                  ].map((s) => (
                    <a
                      key={s.name}
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-xl bg-white border border-[#F2E4D8] text-[#5F6368] hover:text-[#B91B1C] hover:border-[#B91B1C]/40 text-xs font-semibold transition-all shadow-2xs hover:shadow-xs"
                    >
                      {s.name}
                    </a>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Bottom Copyright */}
          <div className="pt-6 sm:pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8B9097]">
            <div className="flex items-center gap-2 text-center sm:text-left">
              <span>© {new Date().getFullYear()} HanFlix. Tất cả bản quyền được bảo lưu.</span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">Lan tỏa niềm yêu thích tiếng Trung</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              <button onClick={onSignIn} className="hover:text-[#B91B1C] transition-colors cursor-pointer">Đăng nhập</button>
              <button onClick={onSignUp} className="hover:text-[#B91B1C] transition-colors cursor-pointer">Đăng ký</button>
              <button onClick={handleGoToFaq} className="hover:text-[#B91B1C] transition-colors cursor-pointer">Điều khoản</button>
              <button onClick={handleGoToFaq} className="hover:text-[#B91B1C] transition-colors cursor-pointer">Bảo mật</button>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}
