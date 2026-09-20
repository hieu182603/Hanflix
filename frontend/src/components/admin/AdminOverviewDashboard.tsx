import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  UploadSimple,
  CheckCircle,
  WarningCircle,
  ArrowsClockwise,
  Play,
  PencilSimple,
  Sparkle,
  UsersThree,
  Cpu,
  CaretRight,
  WifiSlash,
  VideoCamera,
  Check,
  GraduationCap,
} from '@phosphor-icons/react';
import type { AdminLesson, AdminUser, ProcessingJob } from '../../api/admin';
import { useNotification } from '../notifications';

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

// Deterministic avatar color palette
const AVATAR_BG_COLORS = [
  'bg-[#B91B1C] text-white',
  'bg-[#188A5A] text-white',
  'bg-[#B45309] text-white',
  'bg-[#8F1719] text-white',
  'bg-[#2F6E62] text-white',
  'bg-[#78350F] text-white',
  'bg-[#18181B] text-white',
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length];
}

function getInitials(name: string): string {
  if (!name) return 'HV';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
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

  const notify = useNotification();

  // ==========================================
  // METRICS COMPUTATION
  // ==========================================
  const totalLessons = lessons.length;
  const publishedLessons = useMemo(() => lessons.filter((l) => l.status === 'published'), [lessons]);
  const readyForReviewLessons = useMemo(() => lessons.filter((l) => l.status === 'ready_for_review'), [lessons]);
  const draftLessons = useMemo(() => lessons.filter((l) => l.status === 'draft'), [lessons]);
  const processingLessons = useMemo(
    () => lessons.filter((l) => ['processing', 'uploading'].includes(l.status)),
    [lessons],
  );
  const failedLessons = useMemo(() => lessons.filter((l) => l.status === 'failed'), [lessons]);

  const newVideosLast7Days = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return lessons.filter(
      (l) => l.status === 'published' && l.createdAt && new Date(l.createdAt) >= sevenDaysAgo,
    ).length;
  }, [lessons]);

  // Video review queue or recent lessons list
  const displayLessons = useMemo(() => {
    const queue = lessons.filter((l) => {
      if (reviewFilter === 'ready_for_review') return l.status === 'ready_for_review';
      if (reviewFilter === 'draft') return l.status === 'draft';
      return true;
    });
    // Priority: ready_for_review -> failed -> draft -> published
    return queue
      .sort((a, b) => {
        const order: Record<string, number> = { ready_for_review: 0, failed: 1, draft: 2, published: 3, hidden: 4 };
        return (order[a.status] ?? 5) - (order[b.status] ?? 5);
      })
      .slice(0, 6);
  }, [lessons, reviewFilter]);

  // HSK distribution counts (1 to 9)
  const hskDistribution = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    lessons.forEach((l) => {
      const lvl = Math.min(Math.max(l.hsk || 1, 1), 9);
      counts[lvl] = (counts[lvl] || 0) + 1;
    });
    return counts;
  }, [lessons]);

  const maxHskCount = Math.max(...Object.values(hskDistribution), 1);

  // User metrics
  const totalUsers = users.length;
  const activeUsers = useMemo(() => users.filter((u) => u.status === 'active').length, [users]);
  const adminUsers = useMemo(() => users.filter((u) => u.role === 'admin').length, [users]);

  const newUsersLast7Days = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return users.filter((u) => u.createdAt && new Date(u.createdAt) >= sevenDaysAgo).length;
  }, [users]);

  const recentUsers = useMemo(() => {
    return [...users]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);
  }, [users]);

  // Learner HSK demographics
  const learnerHskLevels = useMemo(() => {
    let beginner = 0; // HSK 1 - 3
    let intermediate = 0; // HSK 4 - 6
    let advanced = 0; // HSK 7 - 9

    users.forEach((u) => {
      const lvl = u.learningProfile?.currentHsk;
      if (!lvl || lvl <= 3) beginner++;
      else if (lvl <= 6) intermediate++;
      else advanced++;
    });

    return { beginner, intermediate, advanced };
  }, [users]);

  // Handlers
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await onReload();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleQuickPublish = async (lessonId: string, titleVi: string) => {
    if (
      !(await notify.confirm({
        title: 'Phê duyệt và xuất bản',
        message: `Xác nhận phê duyệt và phát hành bài học: "${titleVi}"?`,
        confirmText: 'Duyệt bài ngay',
        tone: 'default',
      }))
    )
      return;
    try {
      setPublishingId(lessonId);
      await onPublishLesson(lessonId);
    } finally {
      setPublishingId(null);
    }
  };

  const handleRetry = async (lessonId: string) => {
    try {
      setRetryingId(lessonId);
      await onRetryProcessing(lessonId);
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Offline / Connection Notice */}
      {error && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#FFF8F8] border border-[#FCDADA] text-[#90191B]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#FEECEC] text-[#B91B1C]">
              <WifiSlash size={20} weight="bold" />
            </div>
            <div>
              <p className="text-xs font-bold">Chế độ đồng bộ dữ liệu ngoại tuyến</p>
              <p className="text-[11px] text-[#A53436] mt-0.5">
                Chưa kết nối được máy chủ ({error}). Đang hiển thị dữ liệu đã lưu trữ.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#FDF1F1] border border-[#FCDADA] text-xs font-bold text-[#B91B1C] flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <ArrowsClockwise size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* 1. Header Bar: Minimalist title + 2 Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#18181B] tracking-tight">Tổng quan hệ thống</h1>
          <p className="text-xs text-[#5F6368] mt-0.5">
            Trung tâm điều hành nội dung phim học tiếng Trung & cộng đồng học viên HanFlix
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigateToTab('upload')}
            className="h-10 px-4 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <UploadSimple size={15} weight="bold" />
            <span>Tải video mới</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToTab('users')}
            className="h-10 px-4 rounded-xl bg-white hover:bg-[#FFF9F5] border border-[#F2E4D8] text-[#18181B] hover:text-[#B91B1C] text-xs font-bold flex items-center gap-2 shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <UsersThree size={15} weight="bold" />
            <span>Quản lý học viên</span>
          </button>

          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            title="Làm mới dữ liệu"
            className="h-10 w-10 rounded-xl bg-white hover:bg-[#FFF9F5] border border-[#F2E4D8] text-[#5F6368] hover:text-[#18181B] flex items-center justify-center shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <ArrowsClockwise size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Top 4 Stat Cards in 1 Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Video bài học */}
        <div
          onClick={() => onNavigateToTab('videos')}
          className="p-5 rounded-2xl bg-white border border-[#F2E4D8] hover:border-[#188A5A]/50 transition-all shadow-2xs cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#5F6368] group-hover:text-[#18181B] transition-colors">
              <VideoCamera size={16} weight="bold" />
              <span className="text-xs font-bold">Video bài học</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#EAF5F1] text-[#188A5A] text-[10px] font-black font-mono">
              +{newVideosLast7Days}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-[#18181B]">+{newVideosLast7Days}</span>
            <span className="text-xs text-[#5F6368] font-medium">bài tuần này</span>
          </div>
          <p className="text-[11px] text-[#8B9097] mt-1">
            Tổng cộng: <strong className="text-[#18181B] font-mono">{totalLessons}</strong> video ({publishedLessons.length} đã đăng)
          </p>
        </div>

        {/* Card 2: Chờ kiểm duyệt */}
        <div
          onClick={() => setReviewFilter('ready_for_review')}
          className={`p-5 rounded-2xl bg-white border transition-all shadow-2xs cursor-pointer group ${
            readyForReviewLessons.length > 0
              ? 'border-[#FDE6BA] ring-1 ring-[#FDE6BA]'
              : 'border-[#F2E4D8] hover:border-[#B45309]/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#5F6368] group-hover:text-[#18181B] transition-colors">
              <WarningCircle size={16} weight="bold" />
              <span className="text-xs font-bold">Chờ kiểm duyệt</span>
            </div>
            <span
              className={`p-1 rounded-lg ${
                readyForReviewLessons.length > 0
                  ? 'bg-[#FFF8EC] text-[#B45309]'
                  : 'bg-[#EAF5F1] text-[#188A5A]'
              }`}
            >
              <Check size={12} weight="bold" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-[#18181B]">{readyForReviewLessons.length}</span>
            <span className="text-xs text-[#5F6368] font-medium">bài cần duyệt</span>
          </div>
          <p className="text-[11px] text-[#8B9097] mt-1">
            {draftLessons.length > 0 ? `+ ${draftLessons.length} bản nháp đang soạn` : 'Toàn bộ nội dung đã duyệt'}
          </p>
        </div>

        {/* Card 3: Học viên nền tảng */}
        <div
          onClick={() => onNavigateToTab('users')}
          className="p-5 rounded-2xl bg-white border border-[#F2E4D8] hover:border-[#188A5A]/50 transition-all shadow-2xs cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#5F6368] group-hover:text-[#18181B] transition-colors">
              <UsersThree size={16} weight="bold" />
              <span className="text-xs font-bold">Học viên nền tảng</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#EAF5F1] text-[#188A5A] text-[10px] font-black font-mono">
              +{newUsersLast7Days}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-[#18181B]">+{newUsersLast7Days}</span>
            <span className="text-xs text-[#5F6368] font-medium">học viên mới</span>
          </div>
          <p className="text-[11px] text-[#8B9097] mt-1">
            Tổng: <strong className="text-[#18181B] font-mono">{totalUsers}</strong> ({activeUsers} đang hoạt động)
          </p>
        </div>

        {/* Card 4: Tiến trình Whisper AI */}
        <div
          onClick={() => onNavigateToTab('videos')}
          className="p-5 rounded-2xl bg-white border border-[#F2E4D8] hover:border-[#B91B1C]/50 transition-all shadow-2xs cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#5F6368] group-hover:text-[#18181B] transition-colors">
              <Cpu size={16} weight="bold" />
              <span className="text-xs font-bold">Tiến trình Whisper AI</span>
            </div>
            <span
              className={`w-2 h-2 rounded-full ${
                processingLessons.length > 0 ? 'bg-[#B91B1C] animate-ping' : 'bg-[#188A5A]'
              }`}
            />
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-base font-black text-[#188A5A]">
              {processingLessons.length > 0 ? `${processingLessons.length} tác vụ đang chạy` : 'Đang hoạt động'}
            </span>
          </div>
          <p className="text-[11px] text-[#8B9097] mt-1">
            {failedLessons.length > 0 ? (
              <span className="text-[#B91B1C] font-bold">{failedLessons.length} bài cần thử lại</span>
            ) : (
              'Đường ống nhận dạng giọng nói ổn định'
            )}
          </p>
        </div>
      </div>

      {/* 3. Main Dashboard Layout (62% Left vs 38% Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Hàng chờ & Danh sách Video (7 Cols)         */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#F2E4D8] p-5 shadow-2xs space-y-5">
          {/* Card Header & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F2E4D8]">
            <div>
              <h2 className="text-base font-black text-[#18181B]">Hàng chờ & Danh sách Video</h2>
              <p className="text-xs text-[#5F6368] mt-0.5">
                Các bài học gần đây cần kiểm tra phụ đề, duyệt hoặc chỉnh sửa
              </p>
            </div>

            <div className="flex items-center gap-1 bg-[#FFF9F5] p-1 rounded-xl border border-[#F2E4D8]">
              <button
                type="button"
                onClick={() => setReviewFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  reviewFilter === 'all'
                    ? 'bg-white text-[#18181B] shadow-2xs border border-[#F2E4D8]'
                    : 'text-[#5F6368] hover:text-[#B91B1C]'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter('ready_for_review')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  reviewFilter === 'ready_for_review'
                    ? 'bg-[#B91B1C] text-white shadow-xs'
                    : 'text-[#5F6368] hover:text-[#B91B1C]'
                }`}
              >
                Chờ duyệt ({readyForReviewLessons.length})
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter('draft')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  reviewFilter === 'draft'
                    ? 'bg-white text-[#18181B] shadow-2xs border border-[#F2E4D8]'
                    : 'text-[#5F6368] hover:text-[#B91B1C]'
                }`}
              >
                Bản nháp ({draftLessons.length})
              </button>
            </div>
          </div>

          {/* Video Table List */}
          {displayLessons.length === 0 ? (
            <div className="py-12 text-center space-y-2 bg-[#FFFDFB] rounded-xl border border-dashed border-[#F2E4D8]">
              <CheckCircle size={32} className="text-[#188A5A] mx-auto" weight="fill" />
              <p className="text-xs font-bold text-[#18181B]">Không có video nào trong hàng chờ</p>
              <p className="text-[11px] text-[#5F6368]">Toàn bộ video đã được xuất bản hoặc chưa tải video mới</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F2E4D8]">
              {displayLessons.map((item) => {
                const isReady = item.status === 'ready_for_review';
                const isFailed = item.status === 'failed';
                const isPublishing = publishingId === item._id;
                const isRetrying = retryingId === item._id;

                return (
                  <div
                    key={item._id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FFFDFB] -mx-2 px-2.5 rounded-xl transition-colors"
                  >
                    {/* Left: Thumbnail & Title Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Video Thumbnail with 16:9 preview & duration */}
                      <div className="w-20 h-12 rounded-lg bg-[#18181B] shrink-0 overflow-hidden relative border border-[#F2E4D8] flex items-center justify-center">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.titleVi}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Play size={16} weight="fill" className="text-white/60" />
                        )}
                        <span className="absolute bottom-0.5 right-1 text-[8px] font-mono font-bold text-white bg-black/80 px-1 rounded">
                          {formatDuration(item.durationSeconds || 0)}
                        </span>
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-xs text-[#18181B] truncate max-w-[200px]" title={item.titleVi}>
                            {item.titleVi}
                          </p>
                          <span className="px-1.5 py-0.2 rounded bg-[#FFF5F0] text-[#B91B1C] border border-[#F9D2D2] text-[9px] font-black font-mono">
                            HSK {item.hsk}
                          </span>
                        </div>
                        {item.titleZh && (
                          <p className="text-[11px] text-[#8B9097] truncate">{item.titleZh}</p>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {isReady && (
                        <button
                          type="button"
                          disabled={isPublishing}
                          onClick={() => void handleQuickPublish(item._id, item.titleVi)}
                          className="h-8 px-3 rounded-lg bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all active:scale-[0.98] cursor-pointer shadow-2xs"
                        >
                          {isPublishing ? 'Đang duyệt…' : 'Duyệt bài'}
                        </button>
                      )}

                      {isFailed && (
                        <button
                          type="button"
                          disabled={isRetrying}
                          onClick={() => void handleRetry(item._id)}
                          className="h-8 px-3 rounded-lg bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all active:scale-[0.98] cursor-pointer shadow-2xs"
                        >
                          {isRetrying ? 'Đang thử lại…' : 'Thử lại'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onSelectLessonToEdit(item._id)}
                        className="h-8 px-3 rounded-lg bg-white hover:bg-[#FFF9F5] border border-[#F2E4D8] text-[#18181B] text-xs font-bold transition-all active:scale-[0.98] cursor-pointer shadow-2xs"
                      >
                        Biên tập
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Chart: HSK 1-9 Distribution */}
          <div className="pt-3 border-t border-[#F2E4D8] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#18181B]">Phân bổ video theo cấp độ HSK 1 - 9</span>
              <span className="text-[11px] text-[#8B9097]">
                {Object.values(hskDistribution).filter((c) => c > 0).length}/9 cấp độ đã có bài
              </span>
            </div>

            <div className="grid grid-cols-9 gap-1 sm:gap-2 items-end pt-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => {
                const count = hskDistribution[lvl] || 0;
                const isMax = count === maxHskCount && count > 0;
                const heightPercent = count > 0 ? Math.max(Math.round((count / maxHskCount) * 100), 18) : 0;

                return (
                  <div key={lvl} className="flex flex-col items-center gap-1">
                    <span
                      className={`text-[10px] font-mono font-bold leading-none ${
                        isMax ? 'text-[#188A5A]' : count > 0 ? 'text-[#18181B]' : 'text-[#8B9097]'
                      }`}
                    >
                      {count}
                    </span>

                    <div className="w-full max-w-[28px] h-20 bg-[#FFF9F5] rounded-md p-0.5 flex flex-col justify-end border border-[#F2E4D8]">
                      {count > 0 ? (
                        <div
                          className="w-full rounded bg-[#188A5A] transition-all"
                          style={{ height: `${heightPercent}%` }}
                        />
                      ) : (
                        <div className="w-full h-0.5 bg-[#F2E4D8] rounded my-0.5" />
                      )}
                    </div>

                    <span className="text-[10px] font-mono font-bold text-[#5F6368]">H{lvl}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Học viên & Con người (5 Cols)              */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card: Học viên mới đăng ký */}
          <div className="bg-white rounded-2xl border border-[#F2E4D8] p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F2E4D8]">
              <div>
                <h2 className="text-base font-black text-[#18181B]">Học viên mới đăng ký</h2>
                <p className="text-xs text-[#5F6368] mt-0.5">Danh sách người dùng đăng ký gần đây nhất</p>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#EAF5F1] text-[#188A5A] text-[10px] font-bold font-mono">
                {totalUsers} học viên
              </span>
            </div>

            {recentUsers.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#8B9097]">Chưa có dữ liệu học viên</div>
            ) : (
              <div className="divide-y divide-[#F2E4D8]">
                {recentUsers.map((u) => {
                  const isAdmin = u.role === 'admin';

                  return (
                    <div key={u._id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${getAvatarColor(
                            u._id,
                          )}`}
                        >
                          {getInitials(u.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-xs text-[#18181B] truncate">{u.name}</p>
                            {isAdmin && (
                              <span className="px-1 py-0.2 rounded text-[8px] font-black bg-[#FDF1F1] text-[#B91B1C]">
                                ADMIN
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#8B9097] truncate">{u.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-1.5 py-0.5 rounded bg-[#FFF8EC] text-[#B45309] border border-[#FDE6BA] text-[9px] font-bold font-mono">
                          HSK {u.learningProfile?.currentHsk || 1}
                        </span>
                        <span className="text-[10px] text-[#8B9097] font-mono">{formatDate(u.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-2 border-t border-[#F2E4D8] flex justify-end">
              <button
                type="button"
                onClick={() => onNavigateToTab('users')}
                className="text-xs font-bold text-[#B91B1C] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Xem tất cả học viên</span>
                <CaretRight size={12} weight="bold" />
              </button>
            </div>
          </div>

          {/* Card: Phân bổ học viên (Learner Demographics) */}
          <div className="bg-white rounded-2xl border border-[#F2E4D8] p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F2E4D8]">
              <div className="flex items-center gap-2">
                <GraduationCap size={16} weight="bold" className="text-[#188A5A]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#18181B]">
                  Phân bố mục tiêu học viên
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              {/* Sơ cấp */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[#18181B]">Sơ cấp (HSK 1 - 3)</span>
                  <span className="font-mono text-[#188A5A]">
                    {learnerHskLevels.beginner} ({totalUsers > 0 ? Math.round((learnerHskLevels.beginner / totalUsers) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-2 w-full bg-[#FFF9F5] rounded-full overflow-hidden border border-[#F2E4D8]">
                  <div
                    className="h-full bg-[#188A5A] rounded-full transition-all"
                    style={{
                      width: `${totalUsers > 0 ? Math.round((learnerHskLevels.beginner / totalUsers) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Trung cấp */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[#18181B]">Trung cấp (HSK 4 - 6)</span>
                  <span className="font-mono text-[#B45309]">
                    {learnerHskLevels.intermediate} ({totalUsers > 0 ? Math.round((learnerHskLevels.intermediate / totalUsers) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-2 w-full bg-[#FFF9F5] rounded-full overflow-hidden border border-[#F2E4D8]">
                  <div
                    className="h-full bg-[#B45309] rounded-full transition-all"
                    style={{
                      width: `${totalUsers > 0 ? Math.round((learnerHskLevels.intermediate / totalUsers) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Cao cấp */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[#18181B]">Cao cấp (HSK 7 - 9)</span>
                  <span className="font-mono text-[#B91B1C]">
                    {learnerHskLevels.advanced} ({totalUsers > 0 ? Math.round((learnerHskLevels.advanced / totalUsers) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-2 w-full bg-[#FFF9F5] rounded-full overflow-hidden border border-[#F2E4D8]">
                  <div
                    className="h-full bg-[#B91B1C] rounded-full transition-all"
                    style={{
                      width: `${totalUsers > 0 ? Math.round((learnerHskLevels.advanced / totalUsers) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
