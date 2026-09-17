import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  Check,
  CheckCircle2,
  Calendar,
  Sparkles,
  Zap,
  Clock,
  Play,
  ArrowRight,
} from 'lucide-react';
import { useLanguage } from '../../i18n';
import { getStreakState } from '../../lib/streak';

interface StreakDropdownProps {
  initialStreakDays?: number;
  onOpenPractice?: () => void;
  onNavigateToLessons?: () => void;
}

export default function StreakDropdown({
  initialStreakDays = 14,
  onOpenPractice,
  onNavigateToLessons,
}: StreakDropdownProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync state with central streak manager
  const [streakState, setStreakState] = useState(() => getStreakState());

  // Listen for real-time streak updates from video watch or practice events
  useEffect(() => {
    const handleUpdate = () => {
      setStreakState(getStreakState());
    };

    // Initial check
    handleUpdate();

    window.addEventListener('hanflix:streak-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('hanflix:streak-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const streakCount = streakState.streakCount || initialStreakDays;
  const isCompletedToday = streakState.isCompletedToday;

  // 7-day strip data (Monday -> Sunday)
  // Day index: Mon=0, Tue=1, Wed=2, Thu=3 (Today), Fri=4, Sat=5, Sun=6
  const weekDays = [
    { key: 'mon', label: t.streak.weekdays.mon, completed: true, isToday: false },
    { key: 'tue', label: t.streak.weekdays.tue, completed: true, isToday: false },
    { key: 'wed', label: t.streak.weekdays.wed, completed: true, isToday: false },
    { key: 'thu', label: t.streak.weekdays.thu, completed: isCompletedToday, isToday: true },
    { key: 'fri', label: t.streak.weekdays.fri, completed: false, isToday: false },
    { key: 'sat', label: t.streak.weekdays.sat, completed: false, isToday: false },
    { key: 'sun', label: t.streak.weekdays.sun, completed: false, isToday: false },
  ];

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button on Header with spring micro-interaction */}
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer select-none shadow-xs ${
          isCompletedToday
            ? 'bg-gradient-to-r from-[#FFFBEB] to-[#FEF3C7] text-[#92400E] border-[#FDE68A] hover:border-[#F59E0B]/50'
            : 'bg-[#FFFDF7] text-[#B45309] border-amber-200/80 hover:bg-[#FFFBEB]'
        }`}
        title={t.streak.title}
        aria-label={t.streak.title}
      >
        <div className="relative flex items-center justify-center">
          {/* Flame Icon with Animated Pulse */}
          <motion.div
            animate={{
              scale: isCompletedToday ? [1, 1.15, 1] : [1, 1.08, 1],
            }}
            transition={{
              repeat: Infinity,
              duration: isCompletedToday ? 2 : 1.5,
              ease: 'easeInOut',
            }}
          >
            <Flame
              className={`w-4 h-4 ${
                isCompletedToday
                  ? 'text-[#D97706] fill-[#F59E0B]'
                  : 'text-[#F59E0B] fill-[#FBBF24]'
              }`}
            />
          </motion.div>

          {/* Status Indicator Dot */}
          {isCompletedToday ? (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#10B981] rounded-full ring-2 ring-white" />
          ) : (
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
          )}
        </div>

        <span className="font-mono text-[13px] font-black">{streakCount}</span>
        <span className="hidden sm:inline font-semibold">{t.streak.daysCount}</span>
      </motion.button>

      {/* Streak Center Dropdown Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="absolute right-0 mt-3 w-[360px] max-w-[calc(100vw-24px)] bg-white rounded-3xl border border-amber-100/90 shadow-[0_25px_60px_-15px_rgba(217,119,6,0.2),0_4px_16px_rgba(0,0,0,0.04)] z-50 overflow-hidden"
          >
            {/* Top Ember Header Banner with Animated Radial Glow */}
            <div className="relative p-5 pb-4 bg-gradient-to-b from-[#FFFDF7] via-[#FFFBEB] to-white border-b border-amber-100/80 overflow-hidden">
              {/* Soft Ambient Radial Blur */}
              <div className="absolute -right-6 -top-6 w-36 h-36 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -left-6 -bottom-6 w-28 h-28 bg-orange-400/10 rounded-full blur-xl pointer-events-none" />

              {/* Watermark Streak Number */}
              <div className="absolute right-3 top-1 text-amber-300/25 font-mono font-black text-6xl select-none pointer-events-none">
                {streakCount}
              </div>

              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-3.5">
                  {/* Glowing Animated Flame Badge */}
                  <motion.div
                    animate={{
                      scale: [1, 1.08, 1],
                      rotate: [0, -2, 2, 0],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 2.8,
                      ease: 'easeInOut',
                    }}
                    className="relative w-13 h-13 rounded-2xl bg-gradient-to-br from-[#F59E0B] via-[#EA580C] to-[#DC2626] text-white flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0"
                  >
                    <Flame className="w-7 h-7 fill-white text-white drop-shadow-xs" />
                    {isCompletedToday && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#10B981] border-2 border-white flex items-center justify-center shadow-xs">
                        <Check className="w-3 h-3 text-white stroke-[3]" />
                      </div>
                    )}
                  </motion.div>

                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black font-mono tracking-tight text-neutral-900">
                        {streakCount}
                      </span>
                      <span className="text-xs font-black uppercase tracking-wider text-amber-800 font-display">
                        {t.streak.daysCount} Liên Tiếp
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          isCompletedToday
                            ? 'bg-[#DCFCE7] text-[#15803D] border border-emerald-200/60'
                            : 'bg-[#FEF3C7] text-[#92400E] border border-amber-200/60'
                        }`}
                      >
                        {isCompletedToday ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                            <span>{t.streak.statusCompletedToday}</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5 text-[#D97706] animate-pulse" />
                            <span>{t.streak.statusPendingToday}</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs text-amber-900/80 leading-relaxed relative z-10 font-medium">
                {isCompletedToday
                  ? 'Tuyệt vời! Bạn đã duy trì thói quen học tập hôm nay và ngọn lửa streak đang bùng cháy rực rỡ.'
                  : 'Học tập mỗi ngày để giữ vững ngọn lửa. Xem video hoặc làm bài ôn tập sẽ tự động cộng chuỗi!'}
              </p>
            </div>

            {/* Body Content */}
            <div className="p-4 sm:p-5 space-y-4">
              {/* 1. 7-Day Week Calendar Strip */}
              <div className="bg-[#FAF9F5] rounded-2xl p-3.5 border border-amber-100/70 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-600 mb-2.5 px-1">
                  <span className="flex items-center gap-1.5 font-bold text-neutral-800">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>Tuần này</span>
                  </span>
                  <span className="text-[11px] text-neutral-500 font-mono font-medium">
                    {isCompletedToday ? '4/7 ngày' : '3/7 ngày'}
                  </span>
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                  {weekDays.map((day) => (
                    <div key={day.key} className="flex flex-col items-center gap-1">
                      <span
                        className={`text-[11px] ${
                          day.isToday
                            ? 'text-amber-700 font-black'
                            : 'text-neutral-400 font-semibold'
                        }`}
                      >
                        {day.label}
                      </span>

                      <motion.div
                        whileHover={{ scale: 1.08 }}
                        className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all ${
                          day.completed
                            ? 'bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white shadow-xs'
                            : day.isToday
                            ? 'border-2 border-dashed border-amber-400 bg-amber-50 text-amber-600'
                            : 'bg-white border border-neutral-200 text-neutral-300'
                        }`}
                      >
                        {day.completed ? (
                          <Flame className="w-4 h-4 fill-white text-white drop-shadow-xs" />
                        ) : day.isToday ? (
                          <Zap className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                        )}

                        {/* Ripple animation around today's active node */}
                        {day.isToday && !day.completed && (
                          <span className="absolute inset-0 rounded-full border border-amber-400 animate-ping opacity-30 pointer-events-none" />
                        )}
                      </motion.div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Today's Goal Tracker with Fluid Liquid Bar */}
              <div className="bg-white rounded-2xl p-3.5 border border-neutral-200/80 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-900">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Mục tiêu hàng ngày</span>
                  </span>
                  <span className="font-mono text-xs text-neutral-500">
                    {isCompletedToday ? 'Hoàn thành (100%)' : 'Đang thực hiện (60%)'}
                  </span>
                </div>

                {/* Animated Progress Bar */}
                <div className="w-full h-2 rounded-full bg-neutral-100 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: isCompletedToday ? '100%' : '60%' }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full rounded-full ${
                      isCompletedToday
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500'
                    }`}
                  />
                </div>

                <div className="text-[11px] text-neutral-500 leading-relaxed font-medium">
                  {isCompletedToday
                    ? 'Bạn đã hoàn thành mục tiêu học hôm nay. Tuyệt vời!'
                    : 'Chỉ cần xem video hoặc làm 1 bài luyện tập ngắn để kích hoạt.'}
                </div>
              </div>

              {/* 3. Automatic Streak Interaction Card (Replaces manual button and removed stat/freeze boxes) */}
              <div
                className={`rounded-2xl p-4 border transition-all ${
                  isCompletedToday
                    ? 'bg-gradient-to-br from-emerald-50/80 to-teal-50/50 border-emerald-200/70 text-emerald-950'
                    : 'bg-gradient-to-br from-amber-50/90 to-orange-50/60 border-amber-200/80 text-amber-950'
                }`}
              >
                {isCompletedToday ? (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4.5 h-4.5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-emerald-900">
                        Đã tự động cộng chuỗi hôm nay!
                      </h4>
                      <p className="text-[11px] text-emerald-700 leading-relaxed">
                        Hệ thống đã ghi nhận tương tác của bạn. Tiếp tục quay lại học vào ngày mai để chuỗi tăng lên{' '}
                        <strong className="font-mono text-emerald-800">{streakCount + 1} ngày</strong>!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Flame className="w-4.5 h-4.5 fill-amber-500 text-amber-600" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-amber-900">
                          Tự động cộng chuỗi khi tương tác
                        </h4>
                        <p className="text-[11px] text-amber-700/90 mt-0.5 leading-relaxed">
                          Không cần bấm thủ công! Khi bạn bắt đầu xem video bài học hoặc làm bài ôn tập, chuỗi streak sẽ tự động kích hoạt ngay.
                        </p>
                      </div>
                    </div>

                    {/* Quick Interaction Buttons */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          if (onNavigateToLessons) onNavigateToLessons();
                        }}
                        className="flex-1 h-8.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Xem video ngay</span>
                      </button>

                      {onOpenPractice && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            onOpenPractice();
                          }}
                          className="flex-1 h-8.5 px-3 rounded-xl bg-white border border-amber-200 hover:bg-amber-100/60 text-amber-900 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <span>Luyện tập nhanh</span>
                          <ArrowRight className="w-3 h-3 text-amber-600" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
