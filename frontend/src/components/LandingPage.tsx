import React, { useState } from 'react';
import { Play, ChevronDown, ChevronUp, ArrowRight, Check, Star, Volume2, Sparkles, Film, BookOpen, Brain, ShieldCheck } from 'lucide-react';
import { SAMPLE_LESSONS } from '../data/hanflixData';
import OrientalThreeCanvas from './OrientalThreeCanvas';

interface LandingPageProps {
  onStartSurvey: () => void;
  onViewSample: (lessonId?: string) => void;
  onSignIn: () => void;
  onSignUp: () => void;
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

export default function LandingPage({ onStartSurvey, onViewSample, onSignIn, onSignUp }: LandingPageProps) {
  const [activeCueIndex, setActiveCueIndex] = useState(0);
  const [showZh, setShowZh] = useState(true);
  const [showPinyin, setShowPinyin] = useState(true);
  const [showVi, setShowVi] = useState(true);
  const [selectedToken, setSelectedToken] = useState<{ text: string; pinyin: string; vi: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'basic' | 'drama' | 'advanced'>('all');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
      <header className="sticky top-0 z-50 h-20 flex items-center justify-between px-6 md:px-12 bg-[#FFF9F5]/90 backdrop-blur-md border-b border-[#F2E4D8]/80 transition-all">
        {/* Logo & Seal mark */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-3 group text-left cursor-pointer"
        >
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#B91B1C] to-[#8F1719] flex items-center justify-center font-extrabold text-white text-xl shadow-md group-hover:scale-105 transition-transform">
            <span className="font-calligraphy text-2xl leading-none">汉</span>
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#E7A92F] border-2 border-white flex items-center justify-center text-[8px] font-black text-[#18181B]">★</div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-black tracking-tight text-[#B91B1C] font-fraunces">HanFlix</span>
              <span className="font-calligraphy text-base text-[#E7A92F] font-bold">汉映</span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#8FB9A7]">Học Tiếng Trung Qua Phim</span>
          </div>
        </button>

        {/* Navigation */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-[#18181B]/80">
          <a href="#method" className="hover:text-[#B91B1C] transition-colors flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8FB9A7]" />
            Phương pháp
          </a>
          <a href="#lessons" className="hover:text-[#B91B1C] transition-colors flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E7A92F]" />
            Bài học mẫu
          </a>
          <a href="#testimonials" className="hover:text-[#B91B1C] transition-colors">
            Học viên
          </a>
          <a href="#faq" className="hover:text-[#B91B1C] transition-colors">
            Hỏi đáp
          </a>
        </nav>

        {/* Header CTAs */}
        <div className="flex items-center gap-4">
          <button
            onClick={onSignIn}
            className="text-sm font-bold text-[#18181B]/80 hover:text-[#B91B1C] px-3 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Đăng nhập
          </button>
          <button
            onClick={onStartSurvey}
            className="h-11 px-5 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs md:text-sm font-bold flex items-center gap-2 glow-crimson transition-all active:scale-[0.98] cursor-pointer"
          >
            <span>Tìm lộ trình của tôi</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── 2. HERO SECTION WITH THREE.JS LIVE AMBIENCE ─────────────── */}
      <section className="relative min-h-[calc(100vh-80px)] flex items-center py-12 md:py-20 px-6 md:px-12 overflow-hidden">
        
        {/* Three.js Interactive 3D Canvas (Lanterns swinging, cherry blossoms falling, embers floating with mouse parallax) */}
        <OrientalThreeCanvas intensity="hero" />

        {/* Ambient Oriental Glows in Background */}
        <div className="absolute top-10 left-1/4 w-[500px] h-[500px] bg-[#FDECE5]/70 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-[#FFF2DE]/70 rounded-full blur-[100px] pointer-events-none -z-10" />

        <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Hero Column: Typography & CTAs (7 cols) */}
          <div className="lg:col-span-7 flex flex-col items-start">
            
            {/* Top Tag */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#8FB9A7]/15 border border-[#8FB9A7]/30 text-[#2F6E62] text-xs font-bold tracking-wide uppercase mb-6 shadow-xs backdrop-blur-sm">
              <span className="text-sm">🏮</span>
              <span>Học Tiếng Trung Qua Phim & Tình Huống</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#B91B1C] leading-[1.12] mb-6 font-fraunces tracking-tight">
              Tiếng Trung Gần Hơn <br />
              <span className="text-[#18181B]">Qua Mỗi Câu Chuyện</span>
            </h1>

            {/* Highlight Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#FFF3DE] border border-[#E7A92F]/40 text-[#B7791F] text-sm font-semibold mb-6 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#E7A92F] animate-ping" />
              <span>Chỉ 15 phút mỗi ngày · Phụ đề 3 lớp Hán - Pinyin - Việt</span>
            </div>

            {/* Value Proposition */}
            <p className="text-base sm:text-lg text-[#5F6368] mb-10 max-w-xl leading-relaxed">
              Phương pháp học ngôn ngữ tự nhiên: xem trích đoạn phim 1–5 phút đời thực, chạm tra từ tức thì, luyện nói cùng AI và ghi nhớ lâu dài với thuật toán lặp lại ngắt quãng (SRS).
            </p>

            {/* Action Buttons (Strictly NO pricing tags) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto mb-10">
              <button
                onClick={onStartSurvey}
                className="h-14 px-8 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] text-white text-base font-bold flex items-center justify-center gap-3 glow-crimson transition-all active:scale-[0.98] cursor-pointer"
              >
                <span>Tìm Lộ Trình Của Tôi</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                onClick={() => onViewSample(SAMPLE_LESSONS[0].id)}
                className="h-14 px-8 rounded-full border-2 border-[#D7AF70] hover:bg-[#FFF3DE] text-[#B7791F] hover:text-[#975A16] text-base font-bold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer"
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

          {/* Right Hero Column: BaoBao Panda Mascot & Oriental Artwork (5 cols) */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            
            {/* Decorative Pagoda / Cloud Frame */}
            <div className="relative w-full max-w-[480px] aspect-square rounded-[36px] bg-gradient-to-b from-[#FFF0E6] to-[#FFF9F5] p-5 shadow-xl border border-[#F2E4D8] flex items-center justify-center overflow-hidden group">
              
              {/* Subtle background Chinese Watermark */}
              <div className="absolute top-2 left-4 text-7xl font-calligraphy text-[#B91B1C]/5 select-none pointer-events-none">
                学
              </div>
              <div className="absolute bottom-4 right-4 text-8xl font-calligraphy text-[#B91B1C]/5 select-none pointer-events-none">
                汉
              </div>

              {/* Chinese Hanging Lantern Graphic */}
              <div className="absolute top-0 right-8 animate-lantern z-20 pointer-events-none">
                <div className="w-0.5 h-8 bg-[#8B5A2B] mx-auto" />
                <div className="w-8 h-10 rounded-full bg-gradient-to-b from-[#E53935] to-[#B91B1C] shadow-md border border-[#E7A92F] flex items-center justify-center text-[10px] font-bold text-white">
                  春
                </div>
                <div className="w-0.5 h-4 bg-[#E7A92F] mx-auto" />
              </div>

              {/* Main Mascot Image */}
              <img
                src="/assets/panda-mascot.jpg"
                alt="Gấu Trúc Bảo Bảo - Linh vật học tiếng Trung HanFlix"
                className="relative z-10 w-full h-full object-contain rounded-2xl drop-shadow-2xl transition-transform duration-700 group-hover:scale-105"
              />

              {/* Floating Speech Bubble from BaoBao */}
              <div className="absolute bottom-6 left-6 z-20 px-4 py-2.5 rounded-2xl bg-white/95 backdrop-blur-md border border-[#E7A92F]/40 shadow-lg flex items-center gap-2.5 animate-float">
                <span className="text-xl">🐼</span>
                <div>
                  <div className="text-xs font-bold text-[#B91B1C]">Gấu Trúc Bảo Bảo</div>
                  <div className="text-[11px] text-[#5F6368] font-medium">你好！Cùng học tiếng Trung nào!</div>
                </div>
              </div>

              {/* Eaves & Cloud Badges */}
              <div className="absolute top-4 left-4 z-20 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm border border-[#8FB9A7]/40 shadow-xs flex items-center gap-1.5 text-[11px] font-bold text-[#2F6E62]">
                <span>🏮</span>
                <span>Khởi đầu cùng HSK 1</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── 3. INTERACTIVE 4-STEP METHOD & VIDEO SUBTITLE DEMO ───────── */}
      <section id="method" className="py-24 px-6 md:px-12 bg-white relative">
        <div className="max-w-7xl mx-auto">
          
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8FB9A7]/15 text-[#2F6E62] text-xs font-bold uppercase tracking-wider mb-3">
              Phương Pháp Đột Phá
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#18181B] font-fraunces mb-4">
              4 Bước Làm Chủ Giao Tiếp Tự Nhiên
            </h2>
            <p className="text-[#5F6368] text-base md:text-lg">
              Không học vẹt danh sách từ vựng khô khan. Bạn học trọn vẹn cảm xúc và phản xạ từ những thước phim sinh động.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Interactive Subtitle Simulation Player (Left 6 cols) */}
            <div className="lg:col-span-6 bg-[#FFF9F5] rounded-3xl p-6 sm:p-8 border border-[#F2E4D8] shadow-lg relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#E53935]" />
                  <div className="w-3 h-3 rounded-full bg-[#E7A92F]" />
                  <div className="w-3 h-3 rounded-full bg-[#8FB9A7]" />
                  <span className="text-xs font-bold text-[#5F6368] ml-2">Trình xem phụ đề thông minh</span>
                </div>
                <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-full border border-[#E7E7EA] text-[11px] font-bold text-[#B91B1C]">
                  <span>HD 1080p</span>
                </div>
              </div>

              {/* Video Mockup Screen */}
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#18181B] shadow-inner mb-6 flex flex-col justify-between p-4 group">
                <img
                  src="https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=450&fit=crop&auto=format"
                  alt="Tình huống giao tiếp phim Trung Quốc"
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />

                {/* Top overlay controls */}
                <div className="relative z-10 flex items-center justify-between text-white/90">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-black/50 backdrop-blur-sm">
                    Tình huống: Nhà hàng Bắc Kinh
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveCueIndex((prev) => (prev === 0 ? 1 : 0))}
                      className="px-2.5 py-1 rounded-md bg-[#B91B1C] text-white text-xs font-bold hover:bg-[#A3181A] transition-colors cursor-pointer"
                    >
                      Đổi câu thoại mẫu
                    </button>
                  </div>
                </div>

                {/* Subtitle Zone */}
                <div className="relative z-10 text-center bg-black/75 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                  {/* Pinyin */}
                  {showPinyin && (
                    <div className="text-xs sm:text-sm font-mono text-[#E7A92F] font-semibold mb-1">
                      {activeCue.pinyin}
                    </div>
                  )}

                  {/* Hanzi Interactive Tokens */}
                  {showZh && (
                    <div className="text-lg sm:text-2xl font-bold text-white tracking-wide flex flex-wrap items-center justify-center gap-1 font-hanzi">
                      {activeCue.tokens.map((token, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedToken(token.vi ? token : null)}
                          className={`px-1 rounded-md transition-all cursor-pointer ${
                            token.vi
                              ? 'hover:bg-[#B91B1C] hover:text-white underline decoration-[#E7A92F] decoration-2 underline-offset-4'
                              : 'cursor-default'
                          }`}
                        >
                          {token.text}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Vietnamese */}
                  {showVi && (
                    <div className="text-xs sm:text-sm text-white/80 font-medium mt-1.5">
                      {activeCue.vi}
                    </div>
                  )}
                </div>
              </div>

              {/* Subtitle Layers Toggles */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#F2E4D8]">
                <div className="text-xs font-bold text-[#5F6368]">Hiển thị các tầng phụ đề:</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowZh(!showZh)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      showZh ? 'bg-[#B91B1C] text-white' : 'bg-white border border-[#E7E7EA] text-[#5F6368]'
                    }`}
                  >
                    Hán tự
                  </button>
                  <button
                    onClick={() => setShowPinyin(!showPinyin)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      showPinyin ? 'bg-[#E7A92F] text-[#18181B]' : 'bg-white border border-[#E7E7EA] text-[#5F6368]'
                    }`}
                  >
                    Pinyin
                  </button>
                  <button
                    onClick={() => setShowVi(!showVi)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      showVi ? 'bg-[#8FB9A7] text-white' : 'bg-white border border-[#E7E7EA] text-[#5F6368]'
                    }`}
                  >
                    Tiếng Việt
                  </button>
                </div>
              </div>

              {/* 1-Tap Dictionary Interactive Popup Demo */}
              {selectedToken && (
                <div className="mt-4 p-4 rounded-2xl bg-white border border-[#E7A92F] shadow-lg flex items-center justify-between animate-float">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-[#B91B1C] font-hanzi">{selectedToken.text}</span>
                      <span className="text-xs font-mono text-[#E7A92F] font-bold">[{selectedToken.pinyin}]</span>
                    </div>
                    <div className="text-xs text-[#18181B] font-medium mt-0.5">Nghĩa: {selectedToken.vi}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => alert(`Phát âm từ: ${selectedToken.text}`)}
                      className="p-2 rounded-full bg-[#FFF3DE] text-[#B7791F] hover:bg-[#E7A92F] hover:text-white transition-colors cursor-pointer"
                      title="Nghe phát âm"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setSelectedToken(null)}
                      className="text-xs text-[#8B9097] hover:text-[#B91B1C] font-bold px-2 py-1 cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Method Steps List (Right 6 cols) */}
            <div className="lg:col-span-6 space-y-6">
              {METHOD_STEPS.map((step) => {
                const IconComponent = step.icon;
                return (
                  <div
                    key={step.n}
                    className="p-6 rounded-3xl bg-[#FFF9F5] border border-[#F2E4D8] hover:border-[#B91B1C]/40 hover:shadow-md transition-all group flex items-start gap-5"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-white border border-[#F2E4D8] group-hover:bg-[#B91B1C] group-hover:text-white group-hover:border-[#B91B1C] flex flex-col items-center justify-center shrink-0 transition-all">
                      <span className="text-base font-black text-[#8FB9A7] group-hover:text-[#FFF9F5] font-fraunces leading-none">
                        {step.n}
                      </span>
                      <IconComponent className="w-4 h-4 text-[#B91B1C] group-hover:text-white mt-1 transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#18181B] group-hover:text-[#B91B1C] transition-colors mb-2">
                        {step.title}
                      </h3>
                      <p className="text-sm text-[#5F6368] leading-relaxed">
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

      {/* ── 4. FEATURED LESSON CATALOG (HSK 1 - 6) ───────────────────── */}
      <section id="lessons" className="py-24 px-6 md:px-12 bg-[#FFF9F5] relative">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E7A92F]/15 text-[#B7791F] text-xs font-bold uppercase tracking-wider mb-3">
                Kho Thư Viện Video
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#18181B] font-fraunces mb-3">
                Bài Học Mẫu Thực Tế
              </h2>
              <p className="text-[#5F6368] text-base">
                Trải nghiệm những thước phim ngắn giúp bạn ghi nhớ sâu câu từ thông dụng.
              </p>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 bg-white p-1.5 rounded-full border border-[#F2E4D8] shadow-xs">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-[#B91B1C] text-white shadow-xs'
                    : 'text-[#5F6368] hover:text-[#B91B1C]'
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setActiveTab('basic')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'basic'
                    ? 'bg-[#B91B1C] text-white shadow-xs'
                    : 'text-[#5F6368] hover:text-[#B91B1C]'
                }`}
              >
                HSK 1 - 2
              </button>
              <button
                onClick={() => setActiveTab('drama')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'drama'
                    ? 'bg-[#B91B1C] text-white shadow-xs'
                    : 'text-[#5F6368] hover:text-[#B91B1C]'
                }`}
              >
                HSK 3 - 4 (Phim ảnh)
              </button>
              <button
                onClick={() => setActiveTab('advanced')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredLessons.slice(0, 6).map((lesson) => (
              <div
                key={lesson.id}
                onClick={() => onViewSample(lesson.id)}
                className="bg-white rounded-3xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-xl transition-all duration-300 border border-[#F2E4D8] flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      src={lesson.thumbnailAsset || 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&h=500&fit=crop&auto=format'}
                      alt={lesson.titleVi}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
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
      <section id="testimonials" className="py-24 px-6 md:px-12 bg-white relative">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B91B1C]/10 text-[#B91B1C] text-xs font-bold uppercase tracking-wider mb-3">
              Cảm Nhận Thực Tế
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#18181B] font-fraunces mb-4">
              Học Viên Nói Gì Về HanFlix?
            </h2>
            <p className="text-[#5F6368] text-base">
              Hàng ngàn bạn trẻ và người đi làm đã chinh phục tiếng Trung tự tin qua phim ảnh.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t, idx) => (
              <div
                key={idx}
                className="p-8 rounded-3xl bg-[#FFF9F5] border border-[#F2E4D8] shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
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
                    className="w-11 h-11 rounded-full object-cover border-2 border-[#E7A92F]"
                  />
                  <div>
                    <div className="font-bold text-sm text-[#18181B]">{t.name}</div>
                    <div className="text-xs text-[#8FB9A7] font-semibold">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── 6. FAQ ACCORDION ────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-6 md:px-12 bg-[#FFF9F5] relative">
        <div className="max-w-3xl mx-auto">
          
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8FB9A7]/15 text-[#2F6E62] text-xs font-bold uppercase tracking-wider mb-3">
              Giải Đáp Thắc Mắc
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#18181B] font-fraunces mb-4">
              Câu Hỏi Thường Gặp
            </h2>
            <p className="text-[#5F6368] text-base">
              Tất cả những điều bạn cần biết trước khi bắt đầu hành trình.
            </p>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-[#F2E4D8] overflow-hidden shadow-xs transition-shadow"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                  className="w-full px-6 py-5 flex items-center justify-between text-left gap-4 cursor-pointer"
                >
                  <span className="font-bold text-[#18181B] text-base hover:text-[#B91B1C] transition-colors">
                    {faq.q}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                      openFaq === i ? 'bg-[#B91B1C] text-white' : 'bg-[#FFF9F5] text-[#18181B]'
                    }`}
                  >
                    {openFaq === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 text-sm text-[#5F6368] leading-relaxed border-t border-[#F2E4D8]/50 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── 7. FINAL CTA BANNER (NO PRICING) ─────────────────────────── */}
      <section className="py-20 px-6 md:px-12 bg-white relative">
        <div className="max-w-5xl mx-auto rounded-[40px] bg-gradient-to-br from-[#FFF9F5] via-[#FFF3DE] to-[#FDECE5] border-2 border-[#E7A92F]/40 p-8 sm:p-14 shadow-xl relative overflow-hidden text-center">
          
          {/* Subtle oriental watermark */}
          <div className="absolute top-0 right-10 text-9xl font-calligraphy text-[#B91B1C]/5 select-none pointer-events-none">
            汉映
          </div>

          <div className="max-w-2xl mx-auto relative z-10">
            {/* Mascot Avatar badge */}
            <div className="w-20 h-20 rounded-full mx-auto mb-6 p-1 bg-white shadow-md border-2 border-[#E7A92F] overflow-hidden">
              <img
                src="/assets/panda-mascot.jpg"
                alt="Gấu Trúc Bảo Bảo"
                className="w-full h-full object-cover rounded-full"
              />
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#B91B1C] font-fraunces mb-4">
              Sẵn Sàng Nói Tiếng Trung Tự Tin?
            </h2>
            
            <p className="text-base sm:text-lg text-[#5F6368] mb-8 leading-relaxed">
              Dành 2 phút làm bài khảo sát định hướng để nhận lộ trình bài học cá nhân hóa phù hợp với mục tiêu của bạn.
            </p>

            <button
              onClick={onStartSurvey}
              className="h-14 px-10 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] text-white font-bold text-base inline-flex items-center justify-center gap-3 glow-crimson transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>Tìm Lộ Trình Của Tôi</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── 8. FOOTER ──────────────────────────────────────────────── */}
      <footer className="bg-[#FFF9F5] border-t border-[#F2E4D8] py-12 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#B91B1C] flex items-center justify-center font-extrabold text-white text-base">
              <span className="font-calligraphy">汉</span>
            </div>
            <span className="text-xl font-bold text-[#18181B] font-fraunces">HanFlix</span>
            <span className="text-xs text-[#8FB9A7] font-medium ml-2">Học tiếng Trung qua tình huống thực tế</span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm font-semibold text-[#5F6368]">
            <a href="#method" className="hover:text-[#B91B1C] transition-colors">Phương pháp</a>
            <a href="#lessons" className="hover:text-[#B91B1C] transition-colors">Bài học mẫu</a>
            <button onClick={onSignIn} className="hover:text-[#B91B1C] transition-colors cursor-pointer">Đăng nhập</button>
            <button onClick={onSignUp} className="hover:text-[#B91B1C] transition-colors cursor-pointer">Đăng ký</button>
          </div>

          <div className="text-xs text-[#8B9097]">
            © {new Date().getFullYear()} HanFlix. Tất cả quyền được bảo lưu.
          </div>
        </div>
      </footer>

    </div>
  );
}
