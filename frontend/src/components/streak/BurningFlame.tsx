import React from 'react';
import { motion } from 'framer-motion';

interface BurningFlameProps {
  size?: number;
  className?: string;
  showSparks?: boolean;
  intensity?: 'normal' | 'high';
}

export default function BurningFlame({
  size = 24,
  className = '',
  showSparks = true,
  intensity = 'normal',
}: BurningFlameProps) {
  // Generate a unique ID prefix for SVG gradients
  const gradId = React.useId().replace(/:/g, '');

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* 1. Ambient Fire Heat Glow behind the flame */}
      <motion.div
        animate={{
          scale: [0.9, 1.25, 0.95, 1.15, 0.9],
          opacity: [0.55, 0.85, 0.6, 0.8, 0.55],
        }}
        transition={{
          repeat: Infinity,
          duration: intensity === 'high' ? 1.4 : 1.8,
          ease: 'easeInOut',
        }}
        className="absolute inset-0 rounded-full blur-[6px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(251,146,60,0.85) 0%, rgba(239,68,68,0.4) 60%, transparent 80%)',
        }}
      />

      {/* 2. Floating Sparks & Embers (Micro-particles rising from fire) */}
      {showSparks && (
        <>
          {/* Spark Left */}
          <motion.span
            animate={{
              y: [0, -size * 0.75, -size * 1.2],
              x: [0, -size * 0.22, -size * 0.35],
              opacity: [0, 0.9, 0],
              scale: [0.5, 1, 0.2],
            }}
            transition={{
              repeat: Infinity,
              duration: 1.6,
              ease: 'easeOut',
              delay: 0.2,
            }}
            className="absolute top-1 left-1/4 rounded-full pointer-events-none"
            style={{
              width: Math.max(2, size * 0.1),
              height: Math.max(2, size * 0.1),
              background: '#FEF08A',
              boxShadow: '0 0 4px #F59E0B',
            }}
          />

          {/* Spark Right */}
          <motion.span
            animate={{
              y: [0, -size * 0.7, -size * 1.3],
              x: [0, size * 0.25, size * 0.38],
              opacity: [0, 1, 0],
              scale: [0.4, 0.9, 0.2],
            }}
            transition={{
              repeat: Infinity,
              duration: 1.9,
              ease: 'easeOut',
              delay: 0.8,
            }}
            className="absolute top-1 right-1/4 rounded-full pointer-events-none"
            style={{
              width: Math.max(2, size * 0.09),
              height: Math.max(2, size * 0.09),
              background: '#FDE047',
              boxShadow: '0 0 4px #EA580C',
            }}
          />

          {/* Spark Center Upward */}
          <motion.span
            animate={{
              y: [0, -size * 0.85, -size * 1.4],
              x: [0, size * 0.05, -size * 0.08],
              opacity: [0, 0.85, 0],
              scale: [0.6, 1.1, 0.1],
            }}
            transition={{
              repeat: Infinity,
              duration: 1.4,
              ease: 'easeOut',
              delay: 1.3,
            }}
            className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
            style={{
              width: Math.max(2, size * 0.11),
              height: Math.max(2, size * 0.11),
              background: '#FFFBEB',
              boxShadow: '0 0 5px #FBBF24',
            }}
          />
        </>
      )}

      {/* 3. Main SVG Animated Flame */}
      <motion.svg
        viewBox="3.5 0.5 17 22"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: size, height: size, originX: '50%', originY: '90%' }}
        animate={{
          scaleY: [1, 1.12, 0.97, 1.09, 0.98, 1],
          scaleX: [1, 0.95, 1.04, 0.96, 1.02, 1],
          rotate: [-1.5, 2, -2.5, 1.5, -0.5, -1.5],
          skewX: [-1, 1.5, -1.5, 1, 0],
        }}
        transition={{
          repeat: Infinity,
          duration: intensity === 'high' ? 1.2 : 1.6,
          ease: 'easeInOut',
        }}
        className="relative z-10 drop-shadow-[0_2px_6px_rgba(234,88,12,0.45)]"
      >
        <defs>
          {/* Outer Flame Gradient: Red-Orange base up to vivid Gold */}
          <linearGradient id={`${gradId}-outer`} x1="12" y1="22" x2="12" y2="2" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#DC2626" />
            <stop offset="35%" stopColor="#EA580C" />
            <stop offset="70%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#FBBF24" />
          </linearGradient>

          {/* Inner Flame Core Gradient: Golden orange up to pure bright yellow-white */}
          <linearGradient id={`${gradId}-inner`} x1="12" y1="20" x2="12" y2="9" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F97316" />
            <stop offset="50%" stopColor="#FBBF24" />
            <stop offset="85%" stopColor="#FEF08A" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>

          {/* Hot Core Gradient */}
          <radialGradient id={`${gradId}-core`} cx="12" cy="18" r="4" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#FEF08A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FBBF24" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer Flame Tongue */}
        <path
          d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
          fill={`url(#${gradId}-outer)`}
        />

        {/* Inner Dancing Flame Tongue */}
        <motion.path
          animate={{
            scaleY: [1, 1.18, 0.93, 1.14, 1],
            scaleX: [1, 0.92, 1.06, 0.94, 1],
            y: [0, -0.6, 0.3, -0.4, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: intensity === 'high' ? 1.0 : 1.3,
            ease: 'easeInOut',
          }}
          style={{ originX: '50%', originY: '85%' }}
          d="M10.5 16c0-.9-.3-1.4-.7-2.1-.7-1.4-.1-2.6 1.4-3.9.3 1.6 1.3 3.2 2.6 4.2 1.3 1 1.9 2.2 1.9 3.5a4.5 4.5 0 0 1-9 0c0-.7.3-1.5.7-2 .3.9.8 1.4 1.6 1.4z"
          fill={`url(#${gradId}-inner)`}
        />

        {/* White-Hot Core Spark */}
        <circle cx="12" cy="17" r="2.2" fill={`url(#${gradId}-core)`} />
      </motion.svg>
    </div>
  );
}
