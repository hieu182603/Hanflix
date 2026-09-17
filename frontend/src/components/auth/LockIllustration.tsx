import React from 'react';

export default function LockIllustration({ className = "w-56 h-56" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Soft Drop Shadow Filter for 3D realism */}
        <filter id="lockShadow" x="-20%" y="-20%" width="140%" height="150%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="16" stdDeviation="18" floodColor="#E50914" floodOpacity="0.22" />
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000000" floodOpacity="0.08" />
        </filter>

        <filter id="keyGlow" x="-30%" y="-30%" width="160%" height="160%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#F59E0B" floodOpacity="0.3" />
        </filter>

        {/* Shackle Metallic Gold Gradient */}
        <linearGradient id="goldShackle" x1="60" y1="40" x2="160" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF2D6" />
          <stop offset="35%" stopColor="#F5C067" />
          <stop offset="70%" stopColor="#D98A26" />
          <stop offset="100%" stopColor="#FCE7B8" />
        </linearGradient>

        {/* Lock Body Brushed Ruby Red Gradient */}
        <linearGradient id="rubyBody" x1="60" y1="90" x2="180" y2="190" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF334B" />
          <stop offset="30%" stopColor="#E50914" />
          <stop offset="75%" stopColor="#A3060E" />
          <stop offset="100%" stopColor="#660005" />
        </linearGradient>

        {/* Golden Base & Rim Gradient */}
        <linearGradient id="goldRim" x1="60" y1="160" x2="180" y2="190" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="50%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>

        {/* Key Golden Gradient */}
        <linearGradient id="goldKey" x1="140" y1="70" x2="200" y2="130" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="40%" stopColor="#FBBF24" />
          <stop offset="80%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>
      </defs>

      {/* Sparkles around lock */}
      <g opacity="0.85">
        <path d="M42 98L45 86L48 98L60 101L48 104L45 116L42 104L30 101L42 98Z" fill="#FBBF24" />
        <circle cx="45" cy="101" r="2.5" fill="#FFFBEB" />

        <path d="M192 90L194 80L196 90L206 92L196 94L194 104L192 94L182 92L192 90Z" fill="#FBBF24" />
        <circle cx="194" cy="92" r="2" fill="#FFFBEB" />

        <path d="M180 156L181.5 148L183 156L191 157.5L183 159L181.5 167L180 159L172 157.5L180 156Z" fill="#FBBF24" opacity="0.7" />
        
        <circle cx="58" cy="168" r="3" fill="#FBBF24" opacity="0.6" />
        <circle cx="188" cy="62" r="2" fill="#FBBF24" opacity="0.5" />
      </g>

      {/* Shackle (Arch) with realistic 3D volume */}
      <path
        d="M74 115V72C74 48.8 92.8 30 116 30C139.2 30 158 48.8 158 72V115"
        stroke="url(#goldShackle)"
        strokeWidth="20"
        strokeLinecap="round"
      />
      {/* Shackle highlight inner reflection */}
      <path
        d="M78 110V72C78 51.5 95 35 116 35C137 35 154 51.5 154 72V110"
        stroke="#FFFFFF"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* Floating 3D Golden Key behind or over shackle */}
      <g filter="url(#keyGlow)" transform="translate(142, 75) rotate(32)">
        {/* Key Bow (Ring) */}
        <circle cx="18" cy="18" r="16" fill="url(#goldKey)" />
        <circle cx="18" cy="18" r="7" fill="#FAF9F6" />
        <circle cx="18" cy="18" r="14" stroke="#FFFBEB" strokeWidth="2" opacity="0.8" fill="none" />
        {/* Key Shaft */}
        <rect x="14" y="32" width="8" height="38" rx="2" fill="url(#goldKey)" />
        <rect x="15" y="32" width="2" height="38" fill="#FFFBEB" opacity="0.7" />
        {/* Key Bits (Teeth) */}
        <path d="M22 52H32V58H22V52Z" fill="url(#goldKey)" />
        <path d="M22 62H29V68H22V62Z" fill="url(#goldKey)" />
      </g>

      {/* Main Lock Body with 3D drop shadow */}
      <g filter="url(#lockShadow)">
        {/* Lock Body Base (Rounded rect with rich ruby gradient) */}
        <rect x="58" y="96" width="116" height="98" rx="24" fill="url(#rubyBody)" />
        
        {/* Specular curved light reflection on body */}
        <path
          d="M62 114C62 104 70 96 80 96H152C162 96 170 104 170 114V126C170 126 130 112 62 124V114Z"
          fill="#FFFFFF"
          opacity="0.25"
        />

        {/* Bottom Gold Beveled Plate */}
        <path
          d="M58 174H174V178C174 187 166.5 194 157.5 194H74.5C65.5 194 58 187 58 178V174Z"
          fill="url(#goldRim)"
        />

        {/* Gold Circular Keyhole Plate (Bezel) */}
        <circle cx="116" cy="144" r="24" fill="url(#goldRim)" />
        <circle cx="116" cy="144" r="21" fill="#FFF9F5" />
        <circle cx="116" cy="144" r="19" fill="#18181B" opacity="0.08" />

        {/* Center Keyhole */}
        <circle cx="116" cy="139" r="6" fill="#2A0407" />
        <path d="M112 141L110 154H122L120 141H112Z" fill="#2A0407" />
        {/* Keyhole inner bevel highlight */}
        <path d="M113 140A4 4 0 0 1 119 140" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      </g>
    </svg>
  );
}
