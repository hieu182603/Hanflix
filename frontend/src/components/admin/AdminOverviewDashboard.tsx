import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  UploadSimple,
  CheckCircle,
  Clock,
  WarningCircle,
  ArrowsClockwise,
  Play,
  PencilSimple,
  Sparkle,
  BookBookmark,
  Article,
  Exam,
  UsersThree,
  TrendUp,
  Cpu,
  ShieldCheck,
  CaretRight,
  Broadcast,
  WifiSlash,
} from '@phosphor-icons/react';
import type { AdminLesson, AdminUser, ProcessingJob } from '../../api/admin';

interface AdminOverviewDashboardProps {
  lessons: AdminLesson[];
  users: AdminUser[];
  jobs: ProcessingJob[];
  loading: boolean;
  error: string;
  onReload: () => Promise<void>;
  onNavigateToTab: (tab: 'overview' | 'videos' | 'upload' | 'users' | 'vocabulary' | 'grammar' | 'quiz') => void;
  onSelectLessonToEdit: (lessonId: string) => void;
  onPublishLesson: (lessonId: string) => Promise<void>;
  onRetryProcessing: (lessonId: string) => Promise<void>;
}

export default function AdminOverviewDashboard({
  lessons,
  users,
  jobs,
  loading,
  error,
  onReload,
  onNavigateToTab,
  onSelectLessonToEdit,
  onPublishLesson,
  onRetryProcessing,
}: AdminOverviewDashboardProps) {
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'ready_for_review' | 'draft'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Core metrics calculation
  const totalLessons = lessons.length;
  const publishedLessons = useMemo(() => lessons.filter(l => l.status === 'published'), [lessons]);
  const readyForReviewLessons = useMemo(() => lessons.filter(l => l.status === 'ready_for_review'), [lessons]);
  const draftLessons = useMemo(() => lessons.filter(l => l.status === 'draft'), [lessons]);
  const processingLessons = useMemo(() => lessons.filter(l => ['processing', 'uploading'].includes(l.status)), [lessons]);
  const failedLessons = useMemo(() => lessons.filter(l => l.status === 'failed'), [lessons]);

  // Combined urgent review queue
  const pendingReviewQueue = useMemo(() => {
    return lessons
      .filter(l => {
        if (reviewFilter === 'ready_for_review') return l.status === 'ready_for_review';
        if (reviewFilter === 'draft') return l.status === 'draft';
        return l.status === 'ready_for_review' || l.status === 'draft' || l.status === 'failed';
      })
      .slice(0, 8); // top 8 items for dashboard focus
  }, [lessons, reviewFilter]);

  // Active AI Processing jobs & pipeline
  const activeJobs = useMemo(() => {
    if (jobs.length > 0) return jobs;
    return processingLessons.map(l => ({
      _id: l._id,
      lessonId: l._id,
      status: 'running' as const,
      stage: l.processingStep || 'Phân tích âm thanh Whisper ASR',
      stageProgress: l.processingProgress || 45,
      attempts: 1,
    }));
  }, [jobs, processingLessons]);

  // HSK distribution counts (Supports HSK 1 to 9)
  const hskDistribution = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    lessons.forEach(l => {
      const lvl = Math.min(Math.max(l.hsk || 1, 1), 9);
      counts[lvl] = (counts[lvl] || 0) + 1;
    });
    return counts;
  }, [lessons]);

  const maxHskCount = Math.max(...Object.values(hskDistribution), 1);

  // Total content runtime in minutes
  const totalMinutes = useMemo(() => {
    const seconds = lessons.reduce((acc, l) => acc + (l.durationSeconds || 0), 0);
    return Math.round(seconds / 60);
  }, [lessons]);

  // Handle manual refresh
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await onReload();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Handle direct publish from dashboard
  const handleQuickPublish = async (lessonId: string, titleVi: string) => {
    if (!window.confirm(`Xác nhận phê duyệt và xuất bản bài học: "${titleVi}"?`)) return;
    try {
      setPublishingId(lessonId);
      await onPublishLesson(lessonId);
    } finally {
      setPublishingId(null);
    }
  };

  // Handle retry processing
  const handleRetry = async (lessonId: string) => {
    try {
      setRetryingId(lessonId);
      await onRetryProcessing(lessonId);
    } finally {
      setRetryingId(null);
    }
  };

  // Format seconds to mm:ss
  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-7 pb-12">
      {/* Offline / Connection Notice (Graceful instead of raw error) */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#FFF8F8] border border-[#FCDADA] text-[#90191B]"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#FEECEC] text-[#B91B1C]">
              <WifiSlash size={20} weight="bold" />
            </div>
            <div>
              <p className="text-xs font-bold">Chế độ đồng bộ dữ liệu ngoại tuyến</p>
              <p className="text-[11px] text-[#A53436] mt-0.5">
                Chưa kết nối được máy chủ API ({error}). Hệ thống đang hiển thị dữ liệu bộ nhớ đệm an toàn.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#FDF1F1] border border-[#FCDADA] text-xs font-bold text-[#B91B1C] flex items-center gap-1.5 shadow-2xs transition-all active:scale-[0.98]"
          >
            <ArrowsClockwise size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Đang kết nối…' : 'Thử kết nối lại'}</span>
          </button>
        </motion.div>
      )}

      {/* 1. Header & Strategic Quick Action Hub */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-white p-6 md:p-7 rounded-3xl border border-[#E7E7EA] shadow-2xs relative overflow-hidden">
        {/* Subtle decorative HanFlix oriental watermark background */}
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-[#FFF7F5] to-transparent pointer-events-none opacity-80" />
        <div className="absolute -right-8 -top-8 text-8xl font-black text-[#F6EBE7]/50 select-none pointer-events-none">
          汉
        </div>

        <div className="relative z-10 space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#FDF1F1] text-[#B91B1C] text-[11px] font-bold tracking-wide uppercase flex items-center gap-1 border border-[#F7DADA]">
              <ShieldCheck size={14} weight="fill" />
              <span>Cổng Kiểm Duyệt Độc Quyền</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#5F6368]">
              <span className={`w-2 h-2 rounded-full ${error ? 'bg-amber-500' : 'bg-[#188A5A] animate-pulse'}`} />
              {error ? 'Ngoại tuyến' : 'AI Engine Sẵn sàng'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#18181B] tracking-tight">
            Tổng quan Kiểm duyệt & Xuất bản
          </h1>
          <p className="text-xs sm:text-sm text-[#5F6368] leading-relaxed">
            Kiểm tra chất lượng phụ đề AI, tinh chỉnh câu hỏi bài tập và phát hành nội dung học tiếng Trung đạt chuẩn HSK.
          </p>
        </div>

        {/* Quick Actions Cluster */}
        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigateToTab('upload')}
            className="h-11 px-5 rounded-2xl bg-[#B91B1C] hover:bg-[#A3181A] active:bg-[#8F1719] text-white text-xs font-extrabold flex items-center gap-2 shadow-xs hover:shadow-sm transition-all active:scale-[0.98]"
          >
            <UploadSimple size={16} weight="bold" />
            <span>Thêm video bài học</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToTab('vocabulary')}
            className="h-11 px-4 rounded-2xl bg-[#F7F7F9] hover:bg-[#EFEFF2] active:bg-[#E7E7EA] text-[#18181B] text-xs font-bold flex items-center gap-1.5 border border-[#E7E7EA] transition-all active:scale-[0.98]"
          >
            <BookBookmark size={15} weight="duotone" className="text-[#B91B1C]" />
            <span>Kho Từ vựng HSK</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToTab('quiz')}
            className="h-11 px-4 rounded-2xl bg-[#F7F7F9] hover:bg-[#EFEFF2] active:bg-[#E7E7EA] text-[#18181B] text-xs font-bold flex items-center gap-1.5 border border-[#E7E7EA] transition-all active:scale-[0.98]"
          >
            <Exam size={15} weight="duotone" className="text-[#2F6E62]" />
            <span>Bài Luyện Tập</span>
          </button>

          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing || loading}
            title="Làm mới số liệu"
            className="h-11 w-11 rounded-2xl bg-[#F7F7F9] hover:bg-[#EFEFF2] text-[#5F6368] hover:text-[#18181B] flex items-center justify-center border border-[#E7E7EA] transition-all active:scale-[0.98]"
          >
            <ArrowsClockwise size={16} className={isRefreshing || loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Key Operational Bento Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Chờ Admin kiểm duyệt (TOP PRIORITY) */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
          onClick={() => {
            setReviewFilter('ready_for_review');
            const el = document.getElementById('review-queue-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`p-5 rounded-3xl bg-white border cursor-pointer transition-all ${
            readyForReviewLessons.length > 0
              ? 'border-[#F7C678] ring-2 ring-[#F7C678]/20 bg-gradient-to-b from-[#FFFDF9] to-white shadow-xs'
              : 'border-[#E7E7EA]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8B9097] uppercase tracking-wider">Cần kiểm duyệt</span>
            <span className="px-2 py-0.5 rounded-full bg-[#FFF8E7] text-[#B87A00] text-[11px] font-extrabold flex items-center gap-1 border border-[#FDE2A7]">
              <WarningCircle size={13} weight="fill" />
              <span>Ưu tiên số 1</span>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#B87A00]">{readyForReviewLessons.length}</span>
            <span className="text-xs font-semibold text-[#5F6368]">video sẵn sàng</span>
          </div>
          <p className="text-[11px] text-[#8B9097] mt-2 flex items-center gap-1">
            <span>+ {draftLessons.length} bản nháp đang soạn</span>
          </p>
        </motion.div>

        {/* Card 2: Đã xuất bản công khai */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
          onClick={() => onNavigateToTab('videos')}
          className="p-5 rounded-3xl bg-white border border-[#E7E7EA] hover:border-[#8FB9A7] cursor-pointer transition-all shadow-2xs hover:shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8B9097] uppercase tracking-wider">Đã đăng công khai</span>
            <span className="p-1.5 rounded-xl bg-[#E4F6ED] text-[#188A5A]">
              <CheckCircle size={15} weight="bold" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#188A5A]">{publishedLessons.length}</span>
            <span className="text-xs font-semibold text-[#5F6368]">/ {totalLessons} bài</span>
          </div>
          <p className="text-[11px] text-[#8B9097] mt-2 flex items-center gap-1">
            <TrendUp size={13} className="text-[#188A5A]" />
            <span>{totalLessons > 0 ? Math.round((publishedLessons.length / totalLessons) * 100) : 0}% nội dung đã mở</span>
          </p>
        </motion.div>

        {/* Card 3: Đang xử lý AI & Hàng đợi */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
          onClick={() => {
            const el = document.getElementById('ai-pipeline-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="p-5 rounded-3xl bg-white border border-[#E7E7EA] hover:border-[#B91B1C]/30 cursor-pointer transition-all shadow-2xs hover:shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8B9097] uppercase tracking-wider">Tiến trình AI</span>
            <span className={`p-1.5 rounded-xl ${processingLessons.length > 0 ? 'bg-[#FDF1F1] text-[#B91B1C] animate-pulse' : 'bg-[#F7F7F9] text-[#8B9097]'}`}>
              <Cpu size={15} weight="bold" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-3xl font-black ${processingLessons.length > 0 ? 'text-[#B91B1C]' : 'text-[#18181B]'}`}>
              {processingLessons.length}
            </span>
            <span className="text-xs font-semibold text-[#5F6368]">đang chạy</span>
          </div>
          <p className="text-[11px] text-[#8B9097] mt-2">
            {failedLessons.length > 0 ? (
              <span className="text-[#B91B1C] font-semibold">{failedLessons.length} video gặp lỗi cần thử lại</span>
            ) : (
              <span>Whisper ASR & Quiz Gen tự động</span>
            )}
          </p>
        </motion.div>

        {/* Card 4: Tổng kho thời lượng & Học viên */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
          onClick={() => onNavigateToTab('users')}
          className="p-5 rounded-3xl bg-white border border-[#E7E7EA] hover:border-[#2F6E62]/40 cursor-pointer transition-all shadow-2xs hover:shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8B9097] uppercase tracking-wider">Kho bài & Học viên</span>
            <span className="p-1.5 rounded-xl bg-[#EAF2F0] text-[#2F6E62]">
              <UsersThree size={15} weight="bold" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#18181B]">{users.length}</span>
            <span className="text-xs font-semibold text-[#5F6368]">tài khoản</span>
          </div>
          <p className="text-[11px] text-[#5F6368] mt-2 flex items-center gap-1 font-mono">
            <Clock size={12} />
            <span>Tổng thời lượng: {totalMinutes} phút học</span>
          </p>
        </motion.div>
      </div>

      {/* 3. Main Operational Split: Pending Review Queue vs AI Pipeline Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT / PRIMARY (7 Cols): Hàng chờ kiểm duyệt & Xuất bản */}
        <div id="review-queue-section" className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-3xl border border-[#E7E7EA] p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0F0F3]">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-[#18181B]">
                    Hàng chờ Kiểm duyệt Nội dung
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-[#FFF8E7] text-[#9A6A00] text-xs font-bold">
                    {readyForReviewLessons.length + draftLessons.length}
                  </span>
                </div>
                <p className="text-xs text-[#5F6368] mt-0.5">
                  Bài học đã phân tích xong phụ đề/quiz, chờ Admin phê duyệt để xuất bản
                </p>
              </div>

              {/* Status Filter Pill buttons */}
              <div className="flex items-center gap-1 bg-[#F7F7F9] p-1 rounded-xl border border-[#E7E7EA] self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setReviewFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    reviewFilter === 'all'
                      ? 'bg-white text-[#18181B] shadow-2xs'
                      : 'text-[#5F6368] hover:text-[#18181B]'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('ready_for_review')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    reviewFilter === 'ready_for_review'
                      ? 'bg-[#B91B1C] text-white shadow-2xs'
                      : 'text-[#5F6368] hover:text-[#18181B]'
                  }`}
                >
                  Chờ duyệt ({readyForReviewLessons.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('draft')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    reviewFilter === 'draft'
                      ? 'bg-white text-[#18181B] shadow-2xs'
                      : 'text-[#5F6368] hover:text-[#18181B]'
                  }`}
                >
                  Nháp ({draftLessons.length})
                </button>
              </div>
            </div>

            {/* List of lessons needing review */}
            {pendingReviewQueue.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-3 bg-[#FDFEFE] rounded-2xl border border-dashed border-[#D9DDE2]">
                <div className="w-12 h-12 rounded-2xl bg-[#E4F6ED] text-[#188A5A] flex items-center justify-center mx-auto shadow-2xs">
                  <CheckCircle size={26} weight="fill" />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-sm font-bold text-[#18181B]">Không có bài học chờ duyệt</h3>
                  <p className="text-xs text-[#5F6368] mt-1">
                    Tuyệt vời! Toàn bộ video trong kho đã được kiểm tra và xuất bản hoặc hệ thống đang chờ bạn tải video mới lên.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateToTab('upload')}
                  className="px-4 py-2 rounded-xl bg-[#B91B1C] text-white text-xs font-bold hover:bg-[#A3181A] transition-all inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <UploadSimple size={14} weight="bold" />
                  <span>Tải video mới lên</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#F0F0F3]">
                {pendingReviewQueue.map((item) => {
                  const isReady = item.status === 'ready_for_review';
                  const isFailed = item.status === 'failed';
                  const isPublishing = publishingId === item._id;
                  const isRetrying = retryingId === item._id;

                  return (
                    <div
                      key={item._id}
                      className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FDFDFE] -mx-2 px-2 rounded-xl transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Video Thumbnail / Placeholder */}
                        <div className="w-16 h-11 rounded-xl bg-[#18181B] shrink-0 overflow-hidden relative border border-[#E7E7EA] flex items-center justify-center">
                          <Play size={16} weight="fill" className="text-white/70" />
                          <span className="absolute bottom-0.5 right-1 text-[9px] font-mono font-bold text-white/90 bg-black/60 px-1 rounded">
                            {formatDuration(item.durationSeconds || 120)}
                          </span>
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-sm text-[#18181B] truncate" title={item.titleVi}>
                              {item.titleVi}
                            </h3>
                            <span className="px-1.5 py-0.5 rounded-md bg-[#F4F4F6] text-[#34363A] text-[10px] font-bold font-mono">
                              HSK {item.hsk}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-[#5F6368] flex-wrap">
                            {item.titleZh && (
                              <span className="text-[#B91B1C] font-semibold text-[11px]">
                                {item.titleZh}
                              </span>
                            )}
                            <span className="text-[11px] text-[#8B9097]">·</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isReady
                                  ? 'bg-[#FFF8E7] text-[#9A6A00] border border-[#FCE1A5]'
                                  : isFailed
                                  ? 'bg-[#FFF0F0] text-[#B91B1C] border border-[#FCD2D2]'
                                  : 'bg-[#F4F4F6] text-[#5F6368]'
                              }`}
                            >
                              {isReady ? 'Sẵn sàng duyệt' : isFailed ? 'Lỗi xử lý AI' : 'Bản nháp'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {/* Edit and review cues / quiz */}
                        <button
                          type="button"
                          onClick={() => onSelectLessonToEdit(item._id)}
                          className="h-9 px-3.5 rounded-xl border border-[#E7E7EA] hover:border-[#18181B] hover:bg-white text-xs font-bold text-[#18181B] flex items-center gap-1.5 transition-all shadow-2xs active:scale-[0.98]"
                        >
                          <PencilSimple size={14} weight="bold" />
                          <span>Biên tập & Phụ đề</span>
                        </button>

                        {/* Quick publish if ready */}
                        {isReady && (
                          <button
                            type="button"
                            disabled={isPublishing}
                            onClick={() => void handleQuickPublish(item._id, item.titleVi)}
                            className="h-9 px-3.5 rounded-xl bg-[#188A5A] hover:bg-[#13734B] text-white text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-2xs disabled:opacity-50 active:scale-[0.98]"
                          >
                            <CheckCircle size={14} weight="bold" />
                            <span>{isPublishing ? 'Đang xuất bản…' : 'Duyệt & Đăng'}</span>
                          </button>
                        )}

                        {/* Retry if failed */}
                        {isFailed && (
                          <button
                            type="button"
                            disabled={isRetrying}
                            onClick={() => void handleRetry(item._id)}
                            className="h-9 px-3.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-2xs disabled:opacity-50 active:scale-[0.98]"
                          >
                            <ArrowsClockwise size={14} className={isRetrying ? 'animate-spin' : ''} />
                            <span>Thử lại AI</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Link to full video manager */}
            <div className="pt-2 flex justify-between items-center text-xs">
              <span className="text-[#8B9097]">
                Hiển thị {pendingReviewQueue.length} bài học cần xử lý
              </span>
              <button
                type="button"
                onClick={() => onNavigateToTab('videos')}
                className="font-bold text-[#B91B1C] hover:underline flex items-center gap-1"
              >
                <span>Xem toàn bộ danh sách video ({lessons.length})</span>
                <CaretRight size={13} weight="bold" />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT (5 Cols): AI Pipeline Monitor & HSK Distribution */}
        <div className="lg:col-span-5 space-y-6">
          {/* AI Video Processing Pipeline Monitor */}
          <div id="ai-pipeline-section" className="bg-white rounded-3xl border border-[#E7E7EA] p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0F0F3]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-[#FDF1F1] text-[#B91B1C]">
                  <Cpu size={16} weight="bold" />
                </div>
                <div>
                  <h2 className="text-base font-black text-[#18181B]">Luồng xử lý AI Video</h2>
                  <p className="text-[11px] text-[#5F6368]">Whisper ASR, Pinyin & Tự động tạo Quiz</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#F4F4F6] text-[#5F6368] text-[11px] font-bold">
                {activeJobs.length} tác vụ
              </span>
            </div>

            {activeJobs.length === 0 ? (
              <div className="py-6 px-4 text-center rounded-2xl bg-[#FAFBFB] border border-dashed border-[#E7E7EA] space-y-2">
                <div className="w-8 h-8 rounded-full bg-[#EAF2F0] text-[#2F6E62] flex items-center justify-center mx-auto">
                  <Broadcast size={18} weight="bold" />
                </div>
                <p className="text-xs font-bold text-[#18181B]">Không có tác vụ AI đang chạy</p>
                <p className="text-[11px] text-[#5F6368] max-w-xs mx-auto">
                  Khi bạn tải video mới lên, hệ thống sẽ tự động tách âm thanh, nhận diện tiếng Trung và đồng bộ phụ đề tại đây.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeJobs.map((job) => {
                  const lesson = lessons.find(l => l._id === job.lessonId);
                  const progress = job.stageProgress || 50;

                  return (
                    <div key={job._id} className="p-3.5 rounded-2xl bg-[#F9F9FB] border border-[#E7E7EA] space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-[#18181B] truncate max-w-[200px]">
                            {lesson?.titleVi || job.lessonId}
                          </p>
                          <p className="text-[11px] text-[#B91B1C] font-semibold mt-0.5 flex items-center gap-1">
                            <Sparkle size={12} weight="fill" />
                            <span>{job.stage || 'Đang xử lý Whisper ASR'}</span>
                          </p>
                        </div>
                        <span className="text-xs font-black font-mono text-[#18181B]">
                          {progress}%
                        </span>
                      </div>

                      {/* Animated Progress Bar */}
                      <div className="h-2 w-full bg-[#E7E7EA] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-[#B91B1C] rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-[#8B9097] pt-0.5">
                        <span>1. Âm thanh ➔ 2. Phụ đề ➔ 3. Quiz</span>
                        <span className="font-bold text-[#188A5A]">Đang xử lý tự động</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* HSK Level Distribution & Curriculum Health (Redesigned) */}
          <div className="bg-white rounded-3xl border border-[#E7E7EA] p-6 shadow-2xs space-y-5">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#F0F0F3]">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-[#18181B]">Độ phủ Giáo trình HSK</h2>
                  <span className="px-2 py-0.5 rounded-full bg-[#EAF2F0] text-[#2F6E62] text-[10px] font-extrabold">
                    {Object.values(hskDistribution).filter(c => c > 0).length}/9 Cấp độ đã có bài
                  </span>
                </div>
                <p className="text-[11px] text-[#5F6368] mt-0.5">
                  Phân bổ số lượng video theo 9 cấp độ học chuẩn (HSK 1 - 9)
                </p>
              </div>
            </div>

            {/* Vertical Column Bento Chart (HSK 1 - 9) */}
            <div className="grid grid-cols-9 gap-1 sm:gap-1.5 pt-2 items-end">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => {
                const count = hskDistribution[lvl] || 0;
                const isMax = count === maxHskCount && count > 0;
                const isZero = count === 0;
                const heightPercent = count > 0 ? Math.max(Math.round((count / maxHskCount) * 100), 16) : 0;

                const subLabels: Record<number, string> = {
                  1: 'Sơ cấp',
                  2: 'Sơ cấp',
                  3: 'Sơ cấp',
                  4: 'Trung cấp',
                  5: 'Trung cấp',
                  6: 'Trung cấp',
                  7: 'Cao cấp',
                  8: 'Cao cấp',
                  9: 'Cao cấp',
                };

                return (
                  <div key={lvl} className="flex flex-col items-center gap-1.5 group">
                    {/* Top Count Label */}
                    <span
                      className={`text-[11px] font-mono font-black transition-colors ${
                        isMax ? 'text-[#B91B1C]' : count > 0 ? 'text-[#18181B]' : 'text-[#8B9097]'
                      }`}
                    >
                      {count}
                    </span>

                    {/* Bar Track & Fill */}
                    <div className="w-full max-w-[34px] h-28 bg-[#F7F7F9] rounded-xl p-0.5 sm:p-1 flex flex-col justify-end border border-[#EBEBEF] relative overflow-hidden">
                      {count > 0 ? (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${heightPercent}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className={`w-full rounded-lg shadow-2xs ${
                            isMax
                              ? 'bg-gradient-to-t from-[#B91B1C] to-[#E03A3C]'
                              : lvl <= 3
                              ? 'bg-gradient-to-t from-[#2F6E62] to-[#468E80]'
                              : lvl <= 6
                              ? 'bg-gradient-to-t from-[#B91B1C] to-[#E03A3C]'
                              : 'bg-gradient-to-t from-[#6D28D9] to-[#8B5CF6]'
                          }`}
                        />
                      ) : (
                        <div className="w-full h-1 bg-[#DEDEE4] rounded-full my-0.5" />
                      )}
                    </div>

                    {/* HSK Level Name */}
                    <div className="text-center">
                      <p className="text-[10px] sm:text-[11px] font-extrabold font-mono text-[#18181B] leading-none">
                        H{lvl}
                      </p>
                      <p className="text-[8px] text-[#8B9097] mt-0.5 whitespace-nowrap hidden sm:block">
                        {subLabels[lvl]}
                      </p>
                    </div>

                    {/* Status Badge */}
                    {isZero ? (
                      <button
                        type="button"
                        onClick={() => onNavigateToTab('upload')}
                        title={`Thêm video HSK ${lvl}`}
                        className="text-[8px] sm:text-[9px] font-bold text-[#B91B1C] hover:bg-[#FDF1F1] px-0.5 sm:px-1 py-0.5 rounded border border-dashed border-[#F7C678] transition-colors"
                      >
                        +
                      </button>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#188A5A]" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Insight Note */}
            <div className="p-3 rounded-2xl bg-[#F7F7F9] border border-[#E7E7EA] flex items-start gap-2.5 text-xs">
              <div className="p-1.5 rounded-lg bg-white text-[#B91B1C] border border-[#E7E7EA] shrink-0 mt-0.5 shadow-2xs">
                <Sparkle size={13} weight="fill" />
              </div>
              <div className="text-[11px] text-[#5F6368] leading-relaxed">
                <span className="font-bold text-[#18181B]">Khuyến nghị giáo trình: </span>
                {Object.entries(hskDistribution).filter(([, c]) => c === 0).length > 0 ? (
                  <span>
                    Các cấp độ{' '}
                    <strong className="text-[#B91B1C]">
                      {Object.entries(hskDistribution)
                        .filter(([, c]) => c === 0)
                        .map(([lvl]) => `HSK ${lvl}`)
                        .join(', ')}
                    </strong>{' '}
                    chưa có bài học nào. Bạn nên ưu tiên tải thêm video để học viên có lộ trình liền mạch.
                  </span>
                ) : (
                  <span>Toàn bộ các cấp độ HSK 1 - 6 đều đã có bài học đầy đủ!</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
