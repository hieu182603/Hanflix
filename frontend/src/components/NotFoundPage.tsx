import React from 'react';
import { Home, PlaySquare } from 'lucide-react';

interface NotFoundPageProps {
  onNavigateHome?: () => void;
  onNavigateLessons?: () => void;
  showHeader?: boolean;
  currentUser?: any;
}

export default function NotFoundPage({
  onNavigateHome,
  onNavigateLessons,
}: NotFoundPageProps) {
  const handleHome = () => {
    if (onNavigateHome) return onNavigateHome();
    window.location.href = '/';
  };

  const handleLessons = () => {
    if (onNavigateLessons) return onNavigateLessons();
    if (onNavigateHome) return onNavigateHome();
    window.location.href = '/';
  };

  return (
    <div
      className="h-[100dvh] w-full flex flex-col items-center justify-center text-[#18181B] relative overflow-hidden font-sans select-none px-4 bg-no-repeat"
      style={{
        backgroundImage: "url('/assets/background.png')",
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundColor: '#FFF9F5',
      }}
    >
      {/* ── MAIN 404 STAGE (Centered & Scaled to Fit Background Harmoniously) ── */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-10 text-center max-w-2xl mx-auto w-full my-auto py-4">
        
        {/* ── ARCHITECTURAL 404 & CHINESE MOON GATE + PANDA ── */}
        <div className="relative flex items-center justify-center select-none mb-3 sm:mb-4">
          
          {/* The Big 4-0-4 Lockup */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-3">
            
            {/* Left '4' - Architectural dark wood/charcoal */}
            <span
              className="text-[85px] sm:text-[115px] md:text-[145px] lg:text-[165px] font-black leading-none tracking-tight text-[#332A24] drop-shadow-sm"
              style={{ fontFamily: "'Outfit', 'Inter', sans-serif" }}
            >
              4
            </span>

            {/* Center '0' - Oriental Moon Gate (Nguyệt môn 月亮门) */}
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 lg:w-48 lg:h-48 rounded-full flex items-center justify-center shrink-0">
              
              {/* Moon Gate Outer Frame & Lattice Tracery SVG */}
              <svg
                className="absolute inset-0 w-full h-full text-[#332A24]"
                viewBox="0 0 200 200"
                fill="none"
              >
                {/* Outer concentric wood ring */}
                <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="6" />
                <circle cx="100" cy="100" r="88" stroke="#E5D5C8" strokeWidth="2" />
                <circle cx="100" cy="100" r="84" stroke="currentColor" strokeWidth="2" opacity="0.6" />

                {/* Inner traditional lattice work lines (Chinese window pattern) */}
                <path d="M 25,100 L 45,100 M 155,100 L 175,100" stroke="currentColor" strokeWidth="2" />
                <path d="M 100,25 L 100,45 M 100,155 L 100,175" stroke="currentColor" strokeWidth="2" />
                
                {/* Geometric grid bars inside moon gate */}
                <line x1="30" y1="70" x2="60" y2="70" stroke="currentColor" strokeWidth="1.8" opacity="0.7" />
                <line x1="140" y1="70" x2="170" y2="70" stroke="currentColor" strokeWidth="1.8" opacity="0.7" />
                <line x1="30" y1="130" x2="60" y2="130" stroke="currentColor" strokeWidth="1.8" opacity="0.7" />
                <line x1="140" y1="130" x2="170" y2="130" stroke="currentColor" strokeWidth="1.8" opacity="0.7" />
                <line x1="60" y1="50" x2="60" y2="150" stroke="currentColor" strokeWidth="1.8" opacity="0.6" />
                <line x1="140" y1="50" x2="140" y2="150" stroke="currentColor" strokeWidth="1.8" opacity="0.6" />

                {/* Bamboo Silhouette Background Inside Gate */}
                <g opacity="0.4" fill="none" stroke="#2F6E62" strokeWidth="1.5">
                  <path d="M 80,170 Q 78,130 82,90 Q 84,60 81,30" strokeWidth="2" stroke="#5A7D69" />
                  <path d="M 82,100 C 70,95 65,85 68,75" />
                  <path d="M 83,85 C 92,78 98,75 96,65" />
                  <path d="M 81,60 C 72,55 68,48 74,40" />

                  <path d="M 120,170 Q 122,120 119,80 Q 118,50 121,30" strokeWidth="2" stroke="#5A7D69" />
                  <path d="M 120,110 C 132,105 138,95 135,85" />
                  <path d="M 119,90 C 110,85 106,75 112,68" />
                  <path d="M 120,60 C 130,55 135,48 132,40" />
                </g>
              </svg>

              {/* Center Confused Panda Mascot from /panda/error.webp */}
              <div className="relative z-10 w-22 h-22 sm:w-28 sm:h-28 md:w-34 md:h-34 lg:w-38 lg:h-38 flex items-center justify-center animate-[float-gentle_4s_ease-in-out_infinite]">
                <img
                  src="/panda/error.webp"
                  alt="HanFlix Panda Lạc Đường"
                  className="w-full h-full object-contain filter drop-shadow-md"
                />
              </div>
            </div>

            {/* Right '4' - Architectural dark wood/charcoal */}
            <span
              className="text-[85px] sm:text-[115px] md:text-[145px] lg:text-[165px] font-black leading-none tracking-tight text-[#332A24] drop-shadow-sm"
              style={{ fontFamily: "'Outfit', 'Inter', sans-serif" }}
            >
              4
            </span>
          </div>
        </div>

        {/* ── BADGE, HEADLINE & ENCOURAGING MESSAGE ── */}
        <div className="space-y-2.5 max-w-lg mx-auto mb-6">
          {/* Crimson Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#B91B1C] text-white text-xs sm:text-xs font-bold shadow-md shadow-[#B91B1C]/20 tracking-wide">
            <span>404 · LẠC ĐƯỜNG · 迷路</span>
          </div>

          {/* H1 Headline */}
          <h1 className="text-2xl sm:text-3xl md:text-3xl font-black text-[#18181B] tracking-tight">
            Ối! Bạn đã đi lạc khỏi lộ trình rồi
          </h1>

          {/* Friendly Subtitle */}
          <p className="text-xs sm:text-sm md:text-sm text-[#5F6368] leading-relaxed max-w-md mx-auto font-medium">
            Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển sang địa chỉ mới.
            Đừng lo, cùng HanFlix quay lại đường chính nhé!
          </p>
        </div>

        {/* ── PRIMARY & SECONDARY CTA BUTTONS ── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-sm mx-auto">
          {/* Primary CTA: Quay về Trang chủ */}
          <button
            onClick={handleHome}
            className="w-full sm:w-auto min-w-[170px] h-11 px-6 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#B91B1C]/30 hover:shadow-xl hover:shadow-[#B91B1C]/40 transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Quay về Trang chủ</span>
          </button>

          {/* Secondary CTA: Tiếp tục bài học */}
          <button
            onClick={handleLessons}
            className="w-full sm:w-auto min-w-[170px] h-11 px-6 rounded-full bg-white/90 backdrop-blur-xs border border-[#E5D5C8] hover:border-[#B91B1C] hover:bg-white active:scale-[0.98] text-[#18181B] font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <PlaySquare className="w-4 h-4 text-[#B91B1C]" />
            <span>Tiếp tục bài học</span>
          </button>
        </div>
      </main>
    </div>
  );
}
