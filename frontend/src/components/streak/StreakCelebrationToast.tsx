import { useI18n } from '../../i18n';
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Sparkles, X, CheckCircle2, Play, BookOpen } from 'lucide-react';
import type { LearningActivityType } from '../../lib/streak';
import BurningFlame from './BurningFlame';

interface StreakEventDetail {
  streakCount: number;
  source: LearningActivityType;
  isNewStreak: boolean;
  date: string;
}

export default function StreakCelebrationToast() {
  const { tr, ui } = useI18n();
  const [eventData, setEventData] = useState<StreakEventDetail | null>(null);

  useEffect(() => {
    const handleStreakUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<StreakEventDetail>;
      if (customEvent.detail && customEvent.detail.isNewStreak) {
        setEventData(customEvent.detail);
      }
    };

    window.addEventListener('hanflix:streak-updated', handleStreakUpdated);
    return () => window.removeEventListener('hanflix:streak-updated', handleStreakUpdated);
  }, []);

  // Auto-dismiss after 4.5 seconds
  useEffect(() => {
    if (eventData) {
      const timer = setTimeout(() => {
        setEventData(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [eventData]);

  const sourceLabels: Record<LearningActivityType, { title: string; desc: string; icon: typeof Play }> = {
    video: {
      title: 'Đang xem video bài học',
      desc: 'Hệ thống tự động ghi nhận tương tác xem video hôm nay!',
      icon: Play,
    },
    practice: {
      title: 'Đang làm bài luyện tập',
      desc: 'Hệ thống tự động ghi nhận bài tập ôn luyện vừa hoàn thành!',
      icon: CheckCircle2,
    },
    review: {
      title: 'Đang ôn tập từ vựng SRS',
      desc: 'Hệ thống tự động ghi nhận phiên ôn tập Flashcard hôm nay!',
      icon: BookOpen,
    },
  };

  const activityInfo = eventData ? sourceLabels[eventData.source] || sourceLabels.video : sourceLabels.video;
  const ActivityIcon = activityInfo.icon;

  return (
    <AnimatePresence>
      {eventData && (
        <motion.div
          key="streak-toast"
          initial={{ opacity: 0, y: -50, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 350, damping: 24 }}
          className="fixed top-20 right-4 sm:right-8 z-[9999] max-w-sm sm:max-w-md w-full pointer-events-auto"
        >
          <div className="relative overflow-hidden rounded-[26px] bg-white border border-amber-200/80 p-4 shadow-[0_20px_50px_-10px_rgba(217,119,6,0.35),0_0_0_1px_rgba(251,191,36,0.2)]">
            {/* Background Ambient Ember Halo */}
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gradient-to-br from-amber-400/25 to-rose-500/20 blur-2xl pointer-events-none" />
            <div className="absolute -left-6 -bottom-6 w-24 h-24 rounded-full bg-amber-300/20 blur-xl pointer-events-none" />

            {/* Content Row */}
            <div className="relative z-10 flex items-start gap-3.5">
              {/* Burning Flame Badge with Rising Embers */}
              <div className="relative w-13 h-13 rounded-2xl bg-gradient-to-br from-[#FFFBEB] via-[#FEF3C7] to-[#FDE68A]/70 border border-amber-200/90 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                <BurningFlame size={38} intensity="high" showSparks={true} />
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-white" />
                </span>
              </div>

              {/* Text Info */}
              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider">
                    <Sparkles className="w-3 h-3 text-amber-600" />{tr("Tự động cộng Streak!")}</span>
                  <span className="text-xs text-neutral-400 font-mono">{tr("+1 ngày")}</span>
                </div>

                <h4 className="text-sm font-black text-neutral-900 leading-snug">{tr("Đã đạt")} {eventData.streakCount} {tr("Ngày Chuỗi Liên Tiếp!")}</h4>

                <p className="text-xs text-neutral-600 mt-1 leading-relaxed flex items-center gap-1.5">
                  <ActivityIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{ui(activityInfo.desc)}</span>
                </p>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setEventData(null)}
                className="absolute top-2 right-2 p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                aria-label={tr("Đóng thông báo")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bottom animated progress bar */}
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 4.5, ease: 'linear' }}
              className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
