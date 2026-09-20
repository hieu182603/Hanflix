import React, { useState, useEffect } from 'react';
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
  RotateCcw,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import BurningFlame from '../streak/BurningFlame';
import { getLeaderboard, type LeaderUser, type LeaderboardPeriod } from '../../api/learning';
import { learningQueryKeys } from '../../api/queryKeys';
import { getStreakState } from '../../lib/streak';

export interface LeaderboardViewProps {
  onStartPractice?: () => void;
  onSelectLesson?: () => void;
}

function getAvatarSrc(avatar?: string, name?: string): string {
  if (avatar && avatar.trim().length > 0) return avatar;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Hoc Vien')}&background=B91B1C&color=fff&size=150`;
}

export default function LeaderboardView({ onStartPractice, onSelectLesson }: LeaderboardViewProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const [isRulesModalOpen, setIsRulesModalOpen] = useState<boolean>(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: learningQueryKeys.leaderboard(period),
    queryFn: ({ signal }) => getLeaderboard({ period, signal }),
    staleTime: 30 * 1000,
  });

  const leaders = data?.items || [];
  const [localStreakCount, setLocalStreakCount] = useState(() => getStreakState().streakCount);

  useEffect(() => {
    const handleUpdate = () => setLocalStreakCount(getStreakState().streakCount);
    window.addEventListener('hanflix:streak-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('hanflix:streak-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const maxXP = leaders[0]?.xp || 1;

  // Podium arrangement: [Rank 2 (Silver), Rank 1 (Gold), Rank 3 (Bronze)]
  const top1 = leaders.find((u) => u.rank === 1) || leaders[0];
  const top2 = leaders.find((u) => u.rank === 2) || leaders[1];
  const top3 = leaders.find((u) => u.rank === 3) || leaders[2];

  const rawMyUser = data?.currentUserRank || leaders.find((u) => u.isMe) || null;
  const myUser = rawMyUser
    ? {
        ...rawMyUser,
        streakDays: Math.max(rawMyUser.streakDays || 0, localStreakCount),
      }
    : null;
  const gapToFirst = top1 && myUser && top1.id !== myUser.id ? Math.max(0, top1.xp - myUser.xp) : 0;

  return (
    <div className="space-y-6 w-full mx-auto pb-12 animate-in fade-in duration-200">
      {/* 1. HERO LEAGUE BANNER */}
      <div className="relative bg-white rounded-3xl p-6 sm:p-8 border border-[#E7E7EA] overflow-hidden shadow-xs">
        {/* Ambient background decoration */}
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-gradient-to-br from-amber-400/10 to-orange-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-gradient-to-tr from-rose-500/10 to-transparent blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-extrabold uppercase tracking-wider">
              <Trophy className="w-3.5 h-3.5 text-amber-600" />
              <span>Đấu Trường Kim Cương · Mùa 4</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight" style={{ fontFamily: 'Fraunces, serif' }}>
              Bảng Xếp Hạng Học Tập
            </h1>
            <p className="text-neutral-500 text-xs sm:text-sm max-w-xl leading-relaxed">
              Thi đua cùng hàng nghìn học viên HanFlix. Tích lũy điểm kinh nghiệm (XP) qua từng video bài học, làm bài tập và duy trì chuỗi Streak mỗi ngày.
            </p>
          </div>

          {/* Right Action: Rules & League Tier */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsRulesModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-neutral-500" />
              <span>Quy tắc tính XP</span>
            </button>
          </div>
        </div>

        {/* PERIOD TABS (Week / Month / All-time) */}
        <div className="mt-8 pt-6 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex p-1 rounded-2xl bg-neutral-100/90 border border-neutral-200/70 shadow-inner">
            <button
              type="button"
              onClick={() => setPeriod('week')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                period === 'week'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Tuần này
            </button>
            <button
              type="button"
              onClick={() => setPeriod('month')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                period === 'month'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Tháng này
            </button>
            <button
              type="button"
              onClick={() => setPeriod('all')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                period === 'all'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Mọi lúc
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Clock className="w-3.5 h-3.5 text-neutral-400" />
            <span>{period === 'week' ? 'Cập nhật theo thời gian thực' : period === 'month' ? 'Tổng kết trong tháng' : 'Toàn thời gian'}</span>
            <span className="font-semibold text-neutral-700">• {data?.totalParticipants ?? leaders.length} học viên tham gia</span>
          </div>
        </div>
      </div>

      {/* ERROR STATE */}
      {isError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex items-center justify-between gap-4 text-rose-900 text-sm">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-bold">Không thể tải bảng xếp hạng</p>
              <p className="text-xs text-rose-700 mt-0.5">{error instanceof Error ? error.message : 'Vui lòng kiểm tra kết nối mạng.'}</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* LOADING SKELETON */}
      {isLoading && (
        <div className="space-y-6 animate-pulse">
          <div className="bg-white rounded-3xl p-8 border border-[#E7E7EA] h-80 flex items-end justify-center gap-6">
            <div className="w-36 h-48 bg-neutral-100 rounded-t-2xl" />
            <div className="w-44 h-64 bg-amber-50 rounded-t-2xl" />
            <div className="w-36 h-40 bg-neutral-100 rounded-t-2xl" />
          </div>
          <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA] space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-neutral-50 rounded-xl" />
            ))}
          </div>
        </div>
      )}

      {/* 2. THE PODIUM (TOP 3 WINNERS) */}
      {!isLoading && leaders.length > 0 && (
        <div className="relative bg-gradient-to-b from-[#FFFDF8] via-white to-white rounded-3xl p-6 sm:p-8 border border-[#E7E7EA] shadow-xs">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-700 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>BỤC VINH DANH TOP 3</span>
            </div>
          </div>

          <div className="flex items-end justify-center gap-1.5 sm:gap-6 md:gap-10 pt-4 max-w-3xl mx-auto">
            {/* PODIUM #2 (SILVER - LEFT) */}
            {top2 && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="flex flex-col items-center flex-1 max-w-[100px] sm:max-w-[180px] md:max-w-[220px]"
              >
                {/* Avatar + Badge */}
                <div className="relative mb-2 sm:mb-3 flex flex-col items-center">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full p-1 bg-gradient-to-br from-slate-200 via-slate-400 to-slate-500 shadow-md">
                    <img
                      src={getAvatarSrc(top2.avatar, top2.name)}
                      alt={top2.name}
                      className="w-full h-full object-cover rounded-full bg-white"
                    />
                  </div>
                  <div className="absolute -bottom-1.5 sm:-bottom-2 w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 text-white font-black text-[10px] sm:text-xs flex items-center justify-center border-2 border-white shadow-sm">
                    2
                  </div>
                </div>

                {/* Info */}
                <div className="text-center space-y-0.5 w-full px-0.5 sm:px-1">
                  <div className="font-extrabold text-[11px] sm:text-sm text-neutral-900 truncate">
                    {top2.name}
                  </div>
                  <div className="flex items-center justify-center gap-1 text-[10px] sm:text-[11px] text-neutral-500 pt-0.5">
                    <span className="font-semibold text-neutral-700">{top2.hskLevel}</span>
                    <span>•</span>
                    <span className="inline-flex items-center text-amber-700 font-bold">
                      <Flame className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500 fill-amber-500 mr-0.5" />
                      {top2.streakDays}n
                    </span>
                  </div>
                </div>

                {/* Silver Pillar */}
                <div className="w-full h-20 sm:h-28 md:h-36 mt-2 sm:mt-3 rounded-t-2xl sm:rounded-t-3xl bg-gradient-to-b from-slate-100 via-slate-200/90 to-slate-300/80 border-t-2 border-x-2 border-slate-300 flex flex-col items-center justify-between py-2 sm:py-3 shadow-inner">
                  <span className="font-black text-[10px] sm:text-sm text-slate-800">
                    {top2.xp.toLocaleString()} XP
                  </span>
                  <span className="text-2xl sm:text-4xl font-black text-slate-400/40 select-none">
                    2
                  </span>
                </div>
              </motion.div>
            )}

            {/* PODIUM #1 (GOLD - CENTER HIGHEST) */}
            {top1 && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center flex-1 max-w-[120px] sm:max-w-[210px] md:max-w-[260px] z-10"
              >
                {/* Floating Crown Animation */}
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                  className="mb-0.5 sm:mb-1"
                >
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30">
                    <Crown className="w-3.5 h-3.5 sm:w-5 sm:h-5 fill-white" />
                  </div>
                </motion.div>

                {/* Avatar + Golden Ring */}
                <div className="relative mb-2 sm:mb-3 flex flex-col items-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full p-1 sm:p-1.5 bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 shadow-xl shadow-amber-400/20">
                    <img
                      src={getAvatarSrc(top1.avatar, top1.name)}
                      alt={top1.name}
                      className="w-full h-full object-cover rounded-full bg-white"
                    />
                  </div>
                  <div className="absolute -bottom-2 sm:-bottom-2.5 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black text-xs sm:text-sm flex items-center justify-center border-2 border-white shadow-md">
                    1
                  </div>
                </div>

                {/* Info */}
                <div className="text-center space-y-0.5 w-full px-0.5 sm:px-1">
                  <div className="font-black text-xs sm:text-base text-neutral-900 truncate">
                    {top1.name}
                  </div>
                  <span className="inline-block px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full bg-amber-100 text-amber-900 text-[9px] sm:text-[10px] font-bold border border-amber-300/80">
                    {top1.badge || 'Quán Quân'}
                  </span>
                  <div className="flex items-center justify-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-neutral-500 pt-0.5">
                    <span className="font-semibold text-neutral-700">{top1.hskLevel}</span>
                    <span>•</span>
                    <span className="inline-flex items-center text-amber-700 font-bold">
                      <Flame className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-amber-500 fill-amber-500 mr-0.5" />
                      {top1.streakDays} ngày
                    </span>
                  </div>
                </div>

                {/* Gold Pillar */}
                <div className="w-full h-28 sm:h-36 md:h-48 mt-2 sm:mt-3 rounded-t-2xl sm:rounded-t-3xl bg-gradient-to-b from-amber-200 via-amber-300/90 to-amber-400/90 border-t-2 border-x-2 border-amber-300 flex flex-col items-center justify-between py-2 sm:py-3 shadow-lg shadow-amber-400/20">
                  <span className="font-black text-xs sm:text-base text-amber-950">
                    {top1.xp.toLocaleString()} XP
                  </span>
                  <span className="text-3xl sm:text-5xl font-black text-amber-600/30 select-none">
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
                className="flex flex-col items-center flex-1 max-w-[100px] sm:max-w-[180px] md:max-w-[220px]"
              >
                {/* Avatar + Badge */}
                <div className="relative mb-2 sm:mb-3 flex flex-col items-center">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full p-1 bg-gradient-to-br from-amber-700 to-amber-900 shadow-md">
                    <img
                      src={getAvatarSrc(top3.avatar, top3.name)}
                      alt={top3.name}
                      className="w-full h-full object-cover rounded-full bg-white"
                    />
                  </div>
                  <div className="absolute -bottom-1.5 sm:-bottom-2 w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-amber-700 to-amber-900 text-white font-black text-[10px] sm:text-xs flex items-center justify-center border-2 border-white shadow-sm">
                    3
                  </div>
                </div>

                {/* Info */}
                <div className="text-center space-y-0.5 w-full px-0.5 sm:px-1">
                  <div className="font-extrabold text-[11px] sm:text-sm text-neutral-900 truncate">
                    {top3.name}
                  </div>
                  <div className="flex items-center justify-center gap-1 text-[10px] sm:text-[11px] text-neutral-500 pt-0.5">
                    <span className="font-semibold text-neutral-700">{top3.hskLevel}</span>
                    <span>•</span>
                    <span className="inline-flex items-center text-amber-700 font-bold">
                      <Flame className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500 fill-amber-500 mr-0.5" />
                      {top3.streakDays}n
                    </span>
                  </div>
                </div>

                {/* Bronze Pillar */}
                <div className="w-full h-16 sm:h-24 md:h-32 mt-2 sm:mt-3 rounded-t-2xl sm:rounded-t-3xl bg-gradient-to-b from-orange-100 via-orange-200/90 to-amber-300/60 border-t-2 border-x-2 border-amber-300/80 flex flex-col items-center justify-between py-2 sm:py-3 shadow-inner">
                  <span className="font-black text-[10px] sm:text-sm text-amber-950">
                    {top3.xp.toLocaleString()} XP
                  </span>
                  <span className="text-2xl sm:text-4xl font-black text-amber-700/30 select-none">
                    3
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* 3. YOUR STANDING & PROGRESSION CARD (STICKY / HIGHLIGHT) */}
      {!isLoading && myUser && (
        <div className="relative bg-gradient-to-r from-[#FFFBF2] via-[#FEF7EC] to-[#FFF5F5] rounded-3xl p-5 sm:p-6 border-2 border-amber-300/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {/* User Avatar with Rank Pill */}
            <div className="relative shrink-0">
              <img
                src={getAvatarSrc(myUser.avatar, myUser.name)}
                alt={myUser.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-sm"
              />
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#B91B1C] text-white font-black text-xs flex items-center justify-center border-2 border-white shadow-xs">
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

              {gapToFirst > 0 && top1 && (
                <div className="text-xs text-amber-800 font-medium mt-1 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                  <span>Cách vị trí #1 ({top1.name}) <strong>{gapToFirst.toLocaleString()} XP</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* Quick CTA Actions */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 self-stretch sm:self-center w-full sm:w-auto justify-end">
            {onStartPractice && (
              <button
                type="button"
                onClick={onStartPractice}
                className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98 cursor-pointer"
              >
                <BookOpenCheck className="w-4 h-4" />
                <span>Luyện tập tích XP</span>
              </button>
            )}

            {onSelectLesson && (
              <button
                type="button"
                onClick={onSelectLesson}
                className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-50 text-neutral-900 border border-neutral-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Xem video</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. DETAILED LEADERBOARD ROSTER TABLE */}
      {!isLoading && (
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

          {/* Empty State */}
          {leaders.length === 0 && (
            <div className="p-12 text-center text-neutral-500 text-sm">
              Chưa có dữ liệu học tập trong kỳ này. Hãy xem một bài học để ghi danh đầu tiên!
            </div>
          )}

          {/* Table Rows */}
          <div className="divide-y divide-neutral-100">
            {leaders.map((user) => {
              const isTop3 = user.rank <= 3;
              const progressPercent = Math.min(100, Math.round((user.xp / maxXP) * 100));

              return (
                <div
                  key={user.id || user.rank}
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
                    src={getAvatarSrc(user.avatar, user.name)}
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
                        {user.isMe ? Math.max(user.streakDays || 0, localStreakCount) : user.streakDays} ngày liên tiếp
                      </span>
                    </div>
                  </div>

                  {/* XP Score & Progress bar */}
                  <div className="text-right shrink-0 w-20 sm:w-48 md:w-60">
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
      )}

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
                      <div className="text-[11px] text-amber-700 font-bold">+50 XP / bài hoàn thành</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-center gap-2.5">
                    <BookOpenCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-neutral-900">Làm bài tập Quiz</div>
                      <div className="text-[11px] text-amber-700 font-bold">+25 XP / lần luyện tập</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-neutral-900">Thời gian chủ động học</div>
                      <div className="text-[11px] text-blue-700 font-bold">+2 XP / phút học</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-center gap-2.5">
                    <Flame className="w-4 h-4 text-orange-600 shrink-0 fill-current" />
                    <div>
                      <div className="text-xs font-bold text-neutral-900">Duy trì Streak mỗi ngày</div>
                      <div className="text-[11px] text-orange-700 font-bold">+10 XP / ngày streak</div>
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
                  Mỗi tuần sẽ tổng kết vào lúc 23:59 Chủ Nhật. <strong>Top 3 học viên</strong> đứng đầu bảng đấu Kim Cương sẽ được vinh danh tại sảnh danh dự và nhận huy hiệu danh giá.
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
