import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Crown,
  Medal,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  HelpCircle,
  X,
  ChevronRight,
  Clock,
  Zap,
  ShieldAlert,
  ShieldCheck,
  BookOpenCheck,
  Play,
  ArrowUpRight,
} from 'lucide-react';
import BurningFlame from '../streak/BurningFlame';

export interface LeaderboardViewProps {
  onStartPractice?: () => void;
  onSelectLesson?: () => void;
}

interface LeaderUser {
  rank: number;
  name: string;
  avatar: string;
  xp: number;
  streakDays: number;
  hskLevel: string;
  isMe: boolean;
  trend: 'up' | 'down' | 'same';
  trendValue?: number;
  badge?: string;
}

const LEADERBOARD_PERIODS: Record<string, LeaderUser[]> = {
  week: [
    {
      rank: 1,
      name: 'Trần Bảo Ngọc',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop&crop=faces',
      xp: 3820,
      streakDays: 42,
      hskLevel: 'HSK 5',
      isMe: false,
      trend: 'same',
      badge: 'Quán quân tuần trước',
    },
    {
      rank: 2,
      name: 'Nguyễn Minh Anh',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=faces',
      xp: 2450,
      streakDays: 14,
      hskLevel: 'HSK 3',
      isMe: true,
      trend: 'up',
      trendValue: 2,
      badge: 'Đang bứt phá',
    },
    {
      rank: 3,
      name: 'Lê Hoàng Nam',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces',
      xp: 2210,
      streakDays: 28,
      hskLevel: 'HSK 4',
      isMe: false,
      trend: 'down',
      trendValue: 1,
      badge: 'Cao thủ HSK 4',
    },
    {
      rank: 4,
      name: 'Phạm Thu Thảo',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=faces',
      xp: 1890,
      streakDays: 19,
      hskLevel: 'HSK 3',
      isMe: false,
      trend: 'up',
      trendValue: 1,
    },
    {
      rank: 5,
      name: 'Đặng Việt Anh',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=faces',
      xp: 1540,
      streakDays: 7,
      hskLevel: 'HSK 2',
      isMe: false,
      trend: 'down',
      trendValue: 2,
    },
    {
      rank: 6,
      name: 'Vũ Tuấn Kiệt',
      avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&h=150&fit=crop&crop=faces',
      xp: 1420,
      streakDays: 12,
      hskLevel: 'HSK 4',
      isMe: false,
      trend: 'up',
      trendValue: 3,
    },
    {
      rank: 7,
      name: 'Hoàng Mai Phương',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=faces',
      xp: 1280,
      streakDays: 21,
      hskLevel: 'HSK 3',
      isMe: false,
      trend: 'same',
    },
    {
      rank: 8,
      name: 'Đỗ Quang Huy',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=faces',
      xp: 980,
      streakDays: 5,
      hskLevel: 'HSK 1',
      isMe: false,
      trend: 'down',
      trendValue: 1,
    },
  ],
  month: [
    {
      rank: 1,
      name: 'Lê Hoàng Nam',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces',
      xp: 11910,
      streakDays: 28,
      hskLevel: 'HSK 4',
      isMe: false,
      trend: 'up',
      trendValue: 1,
      badge: 'Thống trị tháng',
    },
    {
      rank: 2,
      name: 'Trần Bảo Ngọc',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop&crop=faces',
      xp: 10820,
      streakDays: 42,
      hskLevel: 'HSK 5',
      isMe: false,
      trend: 'down',
      trendValue: 1,
    },
    {
      rank: 3,
      name: 'Nguyễn Minh Anh',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=faces',
      xp: 8450,
      streakDays: 14,
      hskLevel: 'HSK 3',
      isMe: true,
      trend: 'up',
      trendValue: 2,
      badge: 'Top 3 Tháng',
    },
    {
      rank: 4,
      name: 'Phạm Thu Thảo',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=faces',
      xp: 7800,
      streakDays: 19,
      hskLevel: 'HSK 3',
      isMe: false,
      trend: 'same',
    },
    {
      rank: 5,
      name: 'Đặng Việt Anh',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=faces',
      xp: 5540,
      streakDays: 7,
      hskLevel: 'HSK 2',
      isMe: false,
      trend: 'down',
      trendValue: 1,
    },
  ],
  all: [
    {
      rank: 1,
      name: 'Trần Bảo Ngọc',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop&crop=faces',
      xp: 84820,
      streakDays: 42,
      hskLevel: 'HSK 5',
      isMe: false,
      trend: 'same',
      badge: 'Huyền thoại',
    },
    {
      rank: 2,
      name: 'Nguyễn Minh Anh',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=faces',
      xp: 71450,
      streakDays: 14,
      hskLevel: 'HSK 3',
      isMe: true,
      trend: 'same',
    },
    {
      rank: 3,
      name: 'Lê Hoàng Nam',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces',
      xp: 60910,
      streakDays: 28,
      hskLevel: 'HSK 4',
      isMe: false,
      trend: 'same',
    },
    {
      rank: 4,
      name: 'Phạm Thu Thảo',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=faces',
      xp: 49800,
      streakDays: 19,
      hskLevel: 'HSK 3',
      isMe: false,
      trend: 'same',
    },
    {
      rank: 5,
      name: 'Đặng Việt Anh',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=faces',
      xp: 38540,
      streakDays: 7,
      hskLevel: 'HSK 2',
      isMe: false,
      trend: 'same',
    },
  ],
};

export default function LeaderboardView({ onStartPractice, onSelectLesson }: LeaderboardViewProps) {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [isRulesModalOpen, setIsRulesModalOpen] = useState<boolean>(false);

  const leaders = LEADERBOARD_PERIODS[period];
  const maxXP = leaders[0]?.xp || 1;

  // Podium arrangement: [Rank 2 (Silver), Rank 1 (Gold), Rank 3 (Bronze)]
  const top1 = leaders.find((u) => u.rank === 1) || leaders[0];
  const top2 = leaders.find((u) => u.rank === 2) || leaders[1];
  const top3 = leaders.find((u) => u.rank === 3) || leaders[2];

  const myUser = leaders.find((u) => u.isMe) || leaders[1];
  const gapToFirst = top1 && myUser ? top1.xp - myUser.xp : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. HERO LEAGUE BANNER */}
      <div className="relative bg-white rounded-3xl p-6 sm:p-8 border border-[#E7E7EA] overflow-hidden shadow-xs">
        {/* Ambient background decoration */}
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-gradient-to-br from-amber-400/10 to-orange-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-gradient-to-tr from-rose-500/10 to-transparent blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs">
                <Crown className="w-3.5 h-3.5 fill-white" />
                <span>GIẢI ĐẤU KIM CƯƠNG</span>
              </div>
              <span className="text-xs font-bold text-neutral-400">•</span>
              <span className="text-xs font-bold text-neutral-500">Mùa giải 38</span>

              {/* Countdown Timer Pill */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF5F5] border border-rose-200 text-rose-700 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <Clock className="w-3.5 h-3.5" />
                <span>Kết thúc sau: 2 ngày 14 giờ</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
              Đấu Trường Xếp Hạng HanFlix
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 max-w-xl leading-relaxed font-medium">
              Tích lũy điểm kinh nghiệm (XP) qua mỗi video bài học, câu trắc nghiệm đúng và chuỗi học tập hàng ngày để thăng hạng Tinh Anh.
            </p>
          </div>

          {/* Right Header Actions */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Period Switcher Tabs */}
            <div className="flex items-center bg-neutral-100 p-1 rounded-2xl border border-neutral-200/80">
              {(
                [
                  ['week', 'Tuần này'],
                  ['month', 'Tháng này'],
                  ['all', 'Toàn thời gian'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPeriod(key)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    period === key
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Help / Rules Button */}
            <button
              type="button"
              onClick={() => setIsRulesModalOpen(true)}
              className="w-10 h-10 rounded-2xl border border-neutral-200 bg-white hover:bg-neutral-50 flex items-center justify-center text-neutral-500 hover:text-neutral-900 transition-colors shadow-2xs cursor-pointer"
              title="Cách tính điểm XP & quy tắc thăng hạng"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. 3D ILLUMINATED CHAMPIONS PODIUM */}
      <div className="relative bg-gradient-to-b from-[#FFFDF9] via-[#FAF8F5] to-white rounded-3xl p-6 sm:p-8 border border-amber-100/80 overflow-hidden shadow-xs">
        {/* Glow Behind First Place */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-gradient-to-b from-amber-300/25 to-transparent blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-end justify-center gap-3 sm:gap-6 pt-10 pb-2">
          {/* PODIUM #2 (SILVER - LEFT) */}
          {top2 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex flex-col items-center flex-1 max-w-[170px]"
            >
              {/* Avatar + Badge */}
              <div className="relative mb-3 flex flex-col items-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-1 bg-gradient-to-br from-slate-200 to-slate-400 shadow-md">
                  <img
                    src={top2.avatar}
                    alt={top2.name}
                    className="w-full h-full object-cover rounded-full bg-white"
                  />
                </div>
                <div className="absolute -bottom-2 w-7 h-7 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-white font-black text-xs flex items-center justify-center border-2 border-white shadow-sm">
                  2
                </div>
              </div>

              {/* Info */}
              <div className="text-center space-y-0.5 w-full px-1">
                <div className="font-extrabold text-xs sm:text-sm text-neutral-900 truncate">
                  {top2.name}
                </div>
                {top2.isMe && (
                  <span className="inline-block px-2 py-0.5 rounded-full bg-[#B91B1C] text-white text-[10px] font-bold">
                    Bạn
                  </span>
                )}
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-500 pt-0.5">
                  <span className="font-semibold text-neutral-700">{top2.hskLevel}</span>
                  <span>•</span>
                  <span className="inline-flex items-center text-amber-700 font-bold">
                    <Flame className="w-3 h-3 text-amber-500 fill-amber-500 mr-0.5" />
                    {top2.streakDays}n
                  </span>
                </div>
              </div>

              {/* Silver Pillar */}
              <div className="w-full h-28 sm:h-36 mt-3 rounded-t-3xl bg-gradient-to-b from-slate-100 via-slate-200/90 to-slate-300/80 border-t-2 border-x-2 border-slate-300/80 flex flex-col items-center justify-between py-3 shadow-inner">
                <span className="font-black text-xs sm:text-sm text-slate-700">
                  {top2.xp.toLocaleString()} XP
                </span>
                <span className="text-3xl sm:text-4xl font-black text-slate-400/40 select-none">
                  2
                </span>
              </div>
            </motion.div>
          )}

          {/* PODIUM #1 (GOLD - CENTER) */}
          {top1 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center flex-1 max-w-[200px] z-10"
            >
              {/* Floating Crown Animation */}
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                className="mb-1"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30">
                  <Crown className="w-5 h-5 fill-white" />
                </div>
              </motion.div>

              {/* Avatar + Golden Ring */}
              <div className="relative mb-3 flex flex-col items-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1.5 bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 shadow-xl shadow-amber-400/20">
                  <img
                    src={top1.avatar}
                    alt={top1.name}
                    className="w-full h-full object-cover rounded-full bg-white"
                  />
                </div>
                <div className="absolute -bottom-2.5 w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black text-sm flex items-center justify-center border-2 border-white shadow-md">
                  1
                </div>
              </div>

              {/* Info */}
              <div className="text-center space-y-0.5 w-full px-1">
                <div className="font-black text-sm sm:text-base text-neutral-900 truncate">
                  {top1.name}
                </div>
                <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-300/80">
                  Quán Quân Tuần
                </span>
                <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-500 pt-0.5">
                  <span className="font-semibold text-neutral-700">{top1.hskLevel}</span>
                  <span>•</span>
                  <span className="inline-flex items-center text-amber-700 font-bold">
                    <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500 mr-0.5" />
                    {top1.streakDays} ngày
                  </span>
                </div>
              </div>

              {/* Gold Pillar */}
              <div className="w-full h-36 sm:h-48 mt-3 rounded-t-3xl bg-gradient-to-b from-amber-200 via-amber-300/90 to-amber-400/90 border-t-2 border-x-2 border-amber-300 flex flex-col items-center justify-between py-3 shadow-lg shadow-amber-400/20">
                <span className="font-black text-sm sm:text-base text-amber-950">
                  {top1.xp.toLocaleString()} XP
                </span>
                <span className="text-4xl sm:text-5xl font-black text-amber-600/30 select-none">
                  1
                </span>
              </div>
            </motion.div>
          )}

          {/* PODIUM #3 (BRONZE - RIGHT) */}
          {top3 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-col items-center flex-1 max-w-[170px]"
            >
              {/* Avatar + Badge */}
              <div className="relative mb-3 flex flex-col items-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-1 bg-gradient-to-br from-amber-700 to-amber-900 shadow-md">
                  <img
                    src={top3.avatar}
                    alt={top3.name}
                    className="w-full h-full object-cover rounded-full bg-white"
                  />
                </div>
                <div className="absolute -bottom-2 w-7 h-7 rounded-full bg-gradient-to-br from-amber-700 to-amber-900 text-white font-black text-xs flex items-center justify-center border-2 border-white shadow-sm">
                  3
                </div>
              </div>

              {/* Info */}
              <div className="text-center space-y-0.5 w-full px-1">
                <div className="font-extrabold text-xs sm:text-sm text-neutral-900 truncate">
                  {top3.name}
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-500 pt-0.5">
                  <span className="font-semibold text-neutral-700">{top3.hskLevel}</span>
                  <span>•</span>
                  <span className="inline-flex items-center text-amber-700 font-bold">
                    <Flame className="w-3 h-3 text-amber-500 fill-amber-500 mr-0.5" />
                    {top3.streakDays}n
                  </span>
                </div>
              </div>

              {/* Bronze Pillar */}
              <div className="w-full h-24 sm:h-32 mt-3 rounded-t-3xl bg-gradient-to-b from-orange-100 via-orange-200/90 to-amber-300/60 border-t-2 border-x-2 border-amber-300/80 flex flex-col items-center justify-between py-3 shadow-inner">
                <span className="font-black text-xs sm:text-sm text-amber-950">
                  {top3.xp.toLocaleString()} XP
                </span>
                <span className="text-3xl sm:text-4xl font-black text-amber-700/30 select-none">
                  3
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* 3. YOUR STANDING & PROGRESSION CARD (STICKY / HIGHLIGHT) */}
      {myUser && (
        <div className="relative bg-gradient-to-r from-[#FFFBF2] via-[#FEF7EC] to-[#FFF5F5] rounded-3xl p-5 sm:p-6 border-2 border-amber-300/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {/* User Avatar with Rank Pill */}
            <div className="relative shrink-0">
              <img
                src={myUser.avatar}
                alt={myUser.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-sm"
              />
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-700 text-white font-black text-xs flex items-center justify-center border-2 border-white">
                #{myUser.rank}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-neutral-900">
                  {myUser.name}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[#B91B1C] text-white text-[10px] font-bold">
                  Bạn
                </span>
                <span className="text-xs font-mono font-bold text-neutral-500 bg-white px-2 py-0.5 rounded-md border border-neutral-200">
                  {myUser.hskLevel}
                </span>
              </div>

              <p className="text-xs text-neutral-600 mt-1 flex items-center gap-2">
                <span>Điểm: <strong className="text-amber-800 font-extrabold">{myUser.xp.toLocaleString()} XP</strong></span>
                <span>•</span>
                <span className="inline-flex items-center gap-0.5 text-amber-700 font-bold">
                  <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  Chuỗi {myUser.streakDays} ngày
                </span>
              </p>

              {gapToFirst > 0 && (
                <div className="text-xs text-amber-800 font-medium mt-1 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                  <span>Chỉ còn cách vị trí #1 ({top1.name}) <strong>{gapToFirst.toLocaleString()} XP</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* Quick CTA Actions */}
          <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
            {onStartPractice && (
              <button
                type="button"
                onClick={onStartPractice}
                className="px-4 py-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-all active:scale-98 cursor-pointer"
              >
                <BookOpenCheck className="w-4 h-4" />
                <span>Luyện tập tích XP</span>
              </button>
            )}

            {onSelectLesson && (
              <button
                type="button"
                onClick={onSelectLesson}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-50 text-neutral-900 border border-neutral-200 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Xem video</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. DETAILED LEADERBOARD ROSTER TABLE */}
      <div className="bg-white rounded-3xl border border-[#E7E7EA] overflow-hidden shadow-xs">
        {/* Table Header Info */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-500">
            <Trophy className="w-4 h-4 text-amber-600" />
            <span>DANH SÁCH XẾP HẠNG CHI TIẾT</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-neutral-500">
            <span className="flex items-center gap-1 text-emerald-700">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Top 3 Thăng hạng Tinh Anh</span>
            </span>
          </div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-neutral-100">
          {leaders.map((user) => {
            const isTop3 = user.rank <= 3;
            const progressPercent = Math.min(100, Math.round((user.xp / maxXP) * 100));

            return (
              <div
                key={user.rank}
                className={`px-5 sm:px-7 py-3.5 flex items-center gap-3 sm:gap-4 transition-colors ${
                  user.isMe
                    ? 'bg-amber-50/70 hover:bg-amber-50 border-l-4 border-[#B91B1C]'
                    : isTop3
                    ? 'hover:bg-neutral-50/80'
                    : 'hover:bg-neutral-50'
                }`}
              >
                {/* Rank Badge */}
                <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs sm:text-sm shrink-0">
                  {user.rank === 1 ? (
                    <span className="w-7 h-7 rounded-lg bg-amber-400 text-amber-950 flex items-center justify-center font-black shadow-xs">
                      1
                    </span>
                  ) : user.rank === 2 ? (
                    <span className="w-7 h-7 rounded-lg bg-slate-300 text-slate-800 flex items-center justify-center font-black shadow-xs">
                      2
                    </span>
                  ) : user.rank === 3 ? (
                    <span className="w-7 h-7 rounded-lg bg-amber-700 text-white flex items-center justify-center font-black shadow-xs">
                      3
                    </span>
                  ) : (
                    <span className="text-neutral-400 font-bold">#{user.rank}</span>
                  )}
                </div>

                {/* Avatar */}
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-10 h-10 rounded-xl object-cover border border-neutral-200 bg-neutral-100 shrink-0"
                />

                {/* Name & Tags */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-xs sm:text-sm text-neutral-900 truncate">
                      {user.name}
                    </span>
                    {user.isMe && (
                      <span className="px-1.5 py-0.2 rounded-full bg-[#B91B1C] text-white text-[10px] font-bold">
                        Bạn
                      </span>
                    )}
                    {user.badge && (
                      <span className="px-2 py-0.2 rounded-full bg-amber-100/80 text-amber-900 text-[10px] font-semibold border border-amber-200 hidden sm:inline">
                        {user.badge}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-neutral-500 mt-0.5">
                    <span className="font-mono font-medium">{user.hskLevel}</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-0.5 text-amber-700 font-bold">
                      <Flame className="w-3 h-3 text-amber-500 fill-amber-500" />
                      {user.streakDays} ngày liên tiếp
                    </span>
                  </div>
                </div>

                {/* XP Score & Progress bar */}
                <div className="text-right shrink-0 w-28 sm:w-44">
                  <div className="text-xs sm:text-sm font-black text-neutral-900">
                    {user.xp.toLocaleString()} <span className="text-[10px] text-amber-700 font-bold">XP</span>
                  </div>
                  {/* Fluid Progress Bar relative to leader */}
                  <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden mt-1 hidden sm:block">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        user.rank === 1
                          ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                          : user.isMe
                          ? 'bg-gradient-to-r from-rose-500 to-[#B91B1C]'
                          : 'bg-neutral-300'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Trend Indicator */}
                <div className="w-8 flex items-center justify-center shrink-0">
                  {user.trend === 'up' && (
                    <span className="flex items-center text-emerald-600 text-xs font-bold" title={`Tăng ${user.trendValue} bậc`}>
                      <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                      <span className="text-[10px]">+{user.trendValue}</span>
                    </span>
                  )}
                  {user.trend === 'down' && (
                    <span className="flex items-center text-rose-500 text-xs font-bold" title={`Tụt ${user.trendValue} bậc`}>
                      <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                      <span className="text-[10px]">-{user.trendValue}</span>
                    </span>
                  )}
                  {user.trend === 'same' && (
                    <span className="text-neutral-300" title="Giữ nguyên vị trí">
                      <Minus className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. XP RULES & LEAGUE REWARDS MODAL */}
      <AnimatePresence>
        {isRulesModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-neutral-200 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-neutral-900">
                      Quy Tắc Đấu Trường & Điểm XP
                    </h3>
                    <p className="text-xs text-neutral-500">Cách thăng hạng và tích lũy XP hàng ngày</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRulesModalOpen(false)}
                  className="w-8 h-8 rounded-lg text-neutral-400 hover:text-neutral-900 flex items-center justify-center hover:bg-neutral-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* XP Earning Mechanics */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Cách kiếm điểm kinh nghiệm (XP)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-center gap-2.5">
                    <Play className="w-4 h-4 text-[#B91B1C] shrink-0 fill-current" />
                    <div>
                      <div className="text-xs font-bold text-neutral-900">Xem video bài học</div>
                      <div className="text-[11px] text-amber-700 font-bold">+20 XP / video</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-center gap-2.5">
                    <BookOpenCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-neutral-900">Luyện tập Quizlet</div>
                      <div className="text-[11px] text-amber-700 font-bold">+50 XP / bộ đề</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-neutral-900">Đạt 100% điểm thi</div>
                      <div className="text-[11px] text-emerald-700 font-bold">+30 XP thưởng</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-center gap-2.5">
                    <Flame className="w-4 h-4 text-orange-600 shrink-0 fill-current" />
                    <div>
                      <div className="text-xs font-bold text-neutral-900">Duy trì Streak mỗi ngày</div>
                      <div className="text-[11px] text-orange-700 font-bold">+15 XP / ngày</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* League Promotion rules */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 text-xs text-amber-950 space-y-1.5">
                <div className="font-extrabold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Quy chế thăng & rớt hạng</span>
                </div>
                <p className="leading-relaxed text-neutral-700">
                  Mỗi tuần sẽ tổng kết vào lúc 23:59 Chủ Nhật. <strong>Top 3 học viên</strong> đứng đầu bảng đấu Kim Cương sẽ được vinh danh tại sảnh danh dự và nhận cúp lưu niệm.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsRulesModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Đã hiểu
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
