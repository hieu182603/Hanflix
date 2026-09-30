import { useI18n } from '../../i18n';
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trophy, Star, BookOpen, CheckCircle2, Play, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { learningQueryKeys, dashboardQueryKeys } from '../../api/queryKeys';
import type { XpEventDetail } from '../../lib/xp';

export default function XpCelebrationToast() {
  const { tr } = useI18n();
  const [eventData, setEventData] = useState<XpEventDetail | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleXpAwarded = (e: Event) => {
      const customEvent = e as CustomEvent<XpEventDetail>;
      if (customEvent.detail && customEvent.detail.amount > 0) {
        setEventData(customEvent.detail);

        // Invalidate leaderboard and dashboard queries so user's XP and rank update live!
        void queryClient.invalidateQueries({ queryKey: learningQueryKeys.leaderboard(undefined) });
        void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.detail() });
      }
    };

    window.addEventListener('hanflix:xp-awarded', handleXpAwarded);
    return () => window.removeEventListener('hanflix:xp-awarded', handleXpAwarded);
  }, [queryClient]);

  // Auto-dismiss after 4.5 seconds
  useEffect(() => {
    if (eventData) {
      const timer = setTimeout(() => {
        setEventData(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [eventData]);

  if (!eventData) return null;

  const getIcon = () => {
    switch (eventData.reason) {
      case 'quiz':
        return <Trophy className="w-6 h-6 text-amber-500 fill-amber-500" />;
      case 'lesson':
        return <Play className="w-6 h-6 text-[#B91B1C] fill-[#B91B1C]" />;
      case 'vocab':
        return <BookOpen className="w-6 h-6 text-emerald-600" />;
      default:
        return <Star className="w-6 h-6 text-amber-500 fill-amber-500" />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="xp-toast"
        initial={{ opacity: 0, y: -60, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -30, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="fixed top-20 right-4 sm:right-8 z-[9999] max-w-sm sm:max-w-md w-full pointer-events-auto"
      >
        <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-r from-[#FFFDF8] via-white to-[#FFFDF5] border-2 border-amber-300/80 p-4 shadow-[0_20px_50px_-10px_rgba(245,158,11,0.35),0_0_0_1px_rgba(251,191,36,0.2)]">
          {/* Ambient Lighting Background */}
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gradient-to-br from-amber-400/30 to-orange-500/20 blur-2xl pointer-events-none" />
          <div className="absolute -left-6 -bottom-6 w-24 h-24 rounded-full bg-yellow-300/20 blur-xl pointer-events-none" />

          {/* Content Row */}
          <div className="relative z-10 flex items-center gap-3.5">
            {/* Shiny Gold Badge */}
            <div className="relative w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-100 via-amber-200 to-amber-400/80 border border-amber-300 flex items-center justify-center shadow-md shadow-amber-500/25 shrink-0">
              <motion.div
                animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.12, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}
              >
                {getIcon()}
              </motion.div>
            </div>

            {/* Information */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/90 text-amber-950 font-black text-xs shadow-xs tracking-wide">
                  +{eventData.amount} XP
                </span>
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 fill-amber-500 text-amber-500" />{tr("Đấu Trường")}</span>
              </div>
              <h4 className="font-black text-sm text-neutral-900 mt-1 truncate">
                {eventData.title}
              </h4>
              <p className="text-[11px] text-neutral-500 font-medium">{tr("Điểm kinh nghiệm đã được cộng vào bảng xếp hạng!")}</p>
            </div>

            {/* Dismiss button */}
            <button
              type="button"
              onClick={() => setEventData(null)}
              className="w-7 h-7 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
