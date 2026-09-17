import React from 'react';

/**
 * HanFlixLoadingScreen
 * ====================
 * Brand-locked Oriental Art Loading Screen for HanFlix.
 * Features:
 *  - Fullscreen /assets/background.png backdrop (100% 100% fit, no scrolling)
 *  - Intertwined Chinese calligraphy Enso ring with dual-tone crimson (#B91B1C) & amber gold (#E7A92F)
 *  - Golden calligraphy character 学 (Study / Learn) with subtle breathing glow
 *  - Floating golden micro-ember sparks drifting softly
 *  - Slender progress pill bar with animated percentage
 *  - Pure CSS animation for maximum performance & zero lag
 */
export default function HanFlixLoadingScreen() {
  return (
    <div
      className="fixed inset-0 z-[9999] h-[100dvh] w-full flex flex-col items-center justify-center text-[#18181B] select-none overflow-hidden bg-no-repeat"
      style={{
        backgroundImage: "url('/assets/background.png')",
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundColor: '#FFF9F5',
      }}
    >
      {/* Ambient center radial warmth */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-gradient-to-r from-[#B91B1C]/8 to-[#E7A92F]/10 blur-3xl pointer-events-none" />

      {/* Main Enso & Character Lockup */}
      <div className="relative z-10 flex flex-col items-center my-auto py-6">
        
        {/* Enso Brush Ring & Calligraphy Center */}
        <div className="relative w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 flex items-center justify-center mb-6">
          
          {/* Outer Calligraphic Brushstroke SVG Ring with Continuous Rotation */}
          <svg
            className="absolute inset-0 w-full h-full animate-[spin_8s_linear_infinite]"
            viewBox="0 0 200 200"
            fill="none"
          >
            <defs>
              <linearGradient id="ensoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#B91B1C" stopOpacity="0.95" />
                <stop offset="45%" stopColor="#C8382D" stopOpacity="0.9" />
                <stop offset="70%" stopColor="#E7A92F" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#F5C058" stopOpacity="0.9" />
              </linearGradient>

              {/* Filter for ink softness & glow */}
              <filter id="ensoGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Inner background track */}
            <circle
              cx="100"
              cy="100"
              r="76"
              stroke="#E5D5C8"
              strokeWidth="4"
              opacity="0.35"
            />

            {/* Brushstroke Enso Path with tapered calligraphic endpoints */}
            <circle
              cx="100"
              cy="100"
              r="76"
              stroke="url(#ensoGrad)"
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray="460"
              strokeDashoffset="110"
              filter="url(#ensoGlow)"
              className="transition-all duration-300"
            />

            {/* Accent brush highlight ring */}
            <circle
              cx="100"
              cy="100"
              r="68"
              stroke="#E7A92F"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="400"
              strokeDashoffset="260"
              opacity="0.75"
            />
          </svg>

          {/* Reverse counter-rotating inner accent aura */}
          <svg
            className="absolute inset-3 w-[calc(100%-24px)] h-[calc(100%-24px)] animate-[spin_12s_linear_infinite_reverse]"
            viewBox="0 0 180 180"
            fill="none"
          >
            <circle
              cx="90"
              cy="90"
              r="62"
              stroke="#B91B1C"
              strokeWidth="1.5"
              strokeDasharray="8 16"
              opacity="0.35"
            />
          </svg>

          {/* Floating Golden Micro-Ember Sparks */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-2 left-10 w-1.5 h-1.5 rounded-full bg-[#E7A92F] shadow-sm shadow-[#E7A92F] animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite]" />
            <div className="absolute bottom-6 right-8 w-2 h-2 rounded-full bg-[#E7A92F] shadow-sm shadow-[#E7A92F] animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite_0.7s]" />
            <div className="absolute top-12 right-6 w-1 h-1 rounded-full bg-[#F59E0B] animate-[pulse_2s_ease-in-out_infinite_1.2s]" />
            <div className="absolute bottom-10 left-8 w-1.5 h-1.5 rounded-full bg-[#B91B1C] animate-[pulse_2.2s_ease-in-out_infinite_0.4s]" />
          </div>

          {/* Center Calligraphy Character: 学 (Study / Learn) with Golden Shimmer */}
          <div className="relative z-10 flex items-center justify-center animate-[pulse-subtle_2.5s_ease-in-out_infinite]">
            <span
              className="text-5xl sm:text-6xl md:text-7xl font-calligraphy font-bold select-none tracking-normal drop-shadow-md"
              style={{
                background: 'linear-gradient(135deg, #B45309 0%, #D97706 30%, #F59E0B 60%, #FCD34D 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 2px 8px rgba(217, 119, 6, 0.25))',
              }}
            >
              学
            </span>
          </div>
        </div>

        {/* Text Messaging & Subtitle */}
        <div className="space-y-1.5 text-center">
          <h2
            className="text-lg sm:text-xl font-bold text-[#18181B] tracking-tight"
            style={{ fontFamily: "'Fraunces', 'DM Sans', serif" }}
          >
            Đang tải học liệu...
          </h2>
          <p className="text-xs sm:text-sm font-medium text-[#78716C] tracking-wider">
            正在加载 · <span className="font-sans">Zhèngzài jiāzài</span>
          </p>
        </div>
      </div>
    </div>
  );
}
