import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Clock,
  CheckCircle2,
  BookOpen,
  Trophy,
  Flame,
  Search,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Filter,
  Film,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  getLearningHistory,
  getLearnerDashboard,
  getLearningActivity,
  type HistoryProgressItem,
  type HistoryStats,
  type PublishedLesson,
  type LearningActivity,
} from '../../api/learning';
import AdminPaginationBar, { DEFAULT_ADMIN_PAGE_SIZE } from '../admin/AdminPaginationBar';
import { formatDuration } from '../../utils/text';

export interface StudyHistoryPageProps {
  onSelectLesson: (lessonId: string) => void;
  onNavigateToLessons?: () => void;
}

export default function StudyHistoryPage({
  onSelectLesson,
  onNavigateToLessons,
}: StudyHistoryPageProps) {
  // Filters & Pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed'>('all');
  const [hskFilter, setHskFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_ADMIN_PAGE_SIZE);

  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryProgressItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [stats, setStats] = useState<HistoryStats>({
    totalLessonsLearned: 0,
    completedCount: 0,
    inProgressCount: 0,
    totalStudySeconds: 0,
    averageQuizScore: null,
  });
  const [continueLesson, setContinueLesson] = useState<{
    lesson: PublishedLesson;
    lastPositionSeconds: number;
  } | null>(null);
  const [activity, setActivity] = useState<LearningActivity | null>(null);

  // Fetch History Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Parallel fetch for history list, dashboard resume card, and activity
      const [historyRes, dashboardRes, activityRes] = await Promise.all([
        getLearningHistory({
          page,
          limit: pageSize,
          status: statusFilter === 'all' ? undefined : statusFilter,
          q: searchQuery.trim() || undefined,
          hsk: hskFilter ? Number(hskFilter) : undefined,
        }).catch(() => null),
        getLearnerDashboard().catch(() => null),
        getLearningActivity().catch(() => null),
      ]);

      if (historyRes) {
        setHistoryItems(historyRes.items || []);
        setTotalItems(historyRes.total || 0);
        if (historyRes.stats) {
          setStats(historyRes.stats);
        }
      } else if (dashboardRes) {
        // Fallback: use dashboard recent progress if history endpoint has issues
        const items = (dashboardRes.recentProgress || []).map((p, idx) => ({
          _id: p.lessonId?._id || String(idx),
          lessonId: p.lessonId,
          lesson: p.lessonId,
          lastPositionSeconds: p.lastPositionSeconds || 0,
          completed: p.completed,
          updatedAt: new Date().toISOString(),
        }));
        setHistoryItems(items);
        setTotalItems(items.length);
        setStats({
          totalLessonsLearned: items.length,
          completedCount: dashboardRes.metrics?.completedLessons || 0,
          inProgressCount: Math.max(0, items.length - (dashboardRes.metrics?.completedLessons || 0)),
          totalStudySeconds: items.reduce((sum, i) => sum + i.lastPositionSeconds, 0),
          averageQuizScore: dashboardRes.metrics?.averageQuizScore ?? null,
        });
      }

      if (dashboardRes?.continueLearning?.lessonId) {
        setContinueLesson({
          lesson: dashboardRes.continueLearning.lessonId,
          lastPositionSeconds: dashboardRes.continueLearning.lastPositionSeconds || 0,
        });
      } else if (historyRes?.items) {
        const inProgress = historyRes.items.find((i) => !i.completed && (i.lesson || i.lessonId));
        if (inProgress) {
          const lesson = inProgress.lesson || inProgress.lessonId;
          if (lesson) {
            setContinueLesson({
              lesson,
              lastPositionSeconds: inProgress.lastPositionSeconds || 0,
            });
          }
        }
      }

      if (activityRes) {
        setActivity(activityRes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải lịch sử học tập.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, searchQuery, hskFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Format Total Study Time nicely in Vietnamese
  const formattedStudyTime = useMemo(() => {
    const totalSeconds = stats.totalStudySeconds || 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
      return `${(totalSeconds / 3600).toFixed(1)} giờ`;
    }
    return `${Math.max(1, minutes)} phút`;
  }, [stats.totalStudySeconds]);

  // Calculate completion percentage
  const completionPercent = useMemo(() => {
    if (stats.totalLessonsLearned === 0) return 0;
    return Math.round((stats.completedCount / stats.totalLessonsLearned) * 100);
  }, [stats.completedCount, stats.totalLessonsLearned]);

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-10">
      {/* ========================================================= */}
      {/* 1. TOP HERO BANNER                                        */}
      {/* ========================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-white p-6 md:p-8 border border-[#E7E7EA] shadow-xs">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#B91B1C] via-[#E85D5D] to-[#B91B1C]" />
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-[#B91B1C]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FDF1F1] border border-[#B91B1C]/20 text-[#B91B1C] text-xs font-bold mb-2.5">
              <Flame className="w-3.5 h-3.5 fill-[#B91B1C]" />
              <span>Hành Trình & Tiến Độ Học Tập</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#18181B] tracking-tight">
              Lịch Sử Học Tập
            </h1>
            <p className="text-xs sm:text-sm text-[#5F6368] mt-1.5 max-w-2xl leading-relaxed">
              Theo dõi quá trình chinh phục tiếng Trung qua video, lưu giữ từng cột mốc hoàn thành bài học và kết quả bài tập theo chuẩn HSK.
            </p>
          </div>

          {onNavigateToLessons && (
            <button
              type="button"
              onClick={onNavigateToLessons}
              className="self-start md:self-auto h-11 px-5 rounded-2xl bg-[#F7F7F9] hover:bg-[#FDF1F1] text-[#18181B] hover:text-[#B91B1C] border border-[#E7E7EA] hover:border-[#B91B1C]/30 text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Film className="w-4 h-4" />
              <span>Kho bài học</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. BENTO STATS STRIP (4 MODERN CARDS)                     */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
        {/* Card 1: Thời gian học tích lũy */}
        <div className="bg-white rounded-3xl p-5 border border-[#E7E7EA] shadow-xs relative overflow-hidden group hover:border-[#B91B1C]/40 transition-all duration-300">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-[#5F6368]">Thời gian học</span>
            <div className="w-8 h-8 rounded-xl bg-[#FDF1F1] text-[#B91B1C] flex items-center justify-center border border-[#B91B1C]/15 group-hover:scale-110 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-[#18181B] tracking-tight">
              {formattedStudyTime}
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50/70 border border-amber-200/80 px-2.5 py-1 rounded-lg w-fit">
            <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>Tích lũy theo video</span>
          </div>
        </div>

        {/* Card 2: Đã hoàn thành */}
        <div className="bg-white rounded-3xl p-5 border border-[#E7E7EA] shadow-xs relative overflow-hidden group hover:border-emerald-300 transition-all duration-300">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-[#5F6368]">Đã hoàn thành</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-[#18181B] tracking-tight">
              {stats.completedCount}
            </span>
            <span className="text-xs text-[#8B9097] font-bold">/ {stats.totalLessonsLearned} bài</span>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg w-fit">
            <span>{completionPercent}% hoàn thành</span>
          </div>
        </div>

        {/* Card 3: Đang học dở */}
        <div className="bg-white rounded-3xl p-5 border border-[#E7E7EA] shadow-xs relative overflow-hidden group hover:border-blue-300 transition-all duration-300">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-[#5F6368]">Đang học dở</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 group-hover:scale-110 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-[#18181B] tracking-tight">
              {stats.inProgressCount}
            </span>
            <span className="text-xs text-[#8B9097] font-bold">bài</span>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg w-fit">
            <span>Sẵn sàng tiếp tục</span>
          </div>
        </div>

        {/* Card 4: Điểm Quiz trung bình */}
        <div className="bg-white rounded-3xl p-5 border border-[#E7E7EA] shadow-xs relative overflow-hidden group hover:border-purple-300 transition-all duration-300">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-[#5F6368]">Điểm Quiz TB</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200 group-hover:scale-110 transition-transform">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-[#18181B] tracking-tight">
              {stats.averageQuizScore !== null ? `${stats.averageQuizScore}%` : '—'}
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg w-fit">
            <span>Độ hiểu bài kiểm tra</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. RESUME HERO CARD (TIẾP TỤC BÀI HỌC GẦN NHẤT)           */}
      {/* ========================================================= */}
      {continueLesson && continueLesson.lesson && (
        <div className="bg-white rounded-3xl p-5 sm:p-7 border-2 border-[#B91B1C]/25 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6">
            {/* Thumbnail Preview */}
            <div
              onClick={() => onSelectLesson(continueLesson.lesson._id)}
              className="relative aspect-video w-full md:w-80 rounded-2xl overflow-hidden bg-neutral-900 border border-black/10 shrink-0 select-none group cursor-pointer shadow-xs"
            >
              {continueLesson.lesson.thumbnailUrl ? (
                <img
                  src={continueLesson.lesson.thumbnailUrl}
                  alt={continueLesson.lesson.titleVi}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#1F1F23] via-[#2D1517] to-[#121214] flex flex-col items-center justify-center p-3 relative overflow-hidden">
                  <span className="absolute -right-3 -bottom-4 text-6xl font-black text-white/5 font-hanzi select-none">
                    {continueLesson.lesson.titleZh ? continueLesson.lesson.titleZh.slice(0, 2) : '学'}
                  </span>
                  <div className="w-11 h-11 rounded-full bg-[#B91B1C]/25 border border-[#B91B1C]/50 flex items-center justify-center text-[#B91B1C] mb-2 shadow-inner">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>
              )}

              {/* Play Hover Overlay */}
              <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px] flex items-center justify-center group-hover:bg-black/45 transition-colors">
                <div className="w-12 h-12 rounded-full bg-[#B91B1C] text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                </div>
              </div>

              {/* HSK & Duration Badges */}
              <div className="absolute top-2.5 left-2.5 z-10">
                <span className="px-2.5 py-0.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/20 text-white text-[10px] font-black shadow-sm">
                  HSK {continueLesson.lesson.hsk}
                </span>
              </div>
              <div className="absolute bottom-2.5 right-2.5 z-10">
                <span className="px-2 py-0.5 rounded-lg bg-black/85 backdrop-blur-md border border-white/20 text-white font-mono text-[10px] font-bold shadow-sm flex items-center gap-1">
                  <Clock className="w-3 h-3 text-neutral-300" />
                  {formatDuration(continueLesson.lesson.durationSeconds || 0)}
                </span>
              </div>
            </div>

            {/* Content & Resume CTA */}
            <div className="flex-1 min-w-0 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FDF1F1] text-[#B91B1C] text-[11px] font-bold border border-[#B91B1C]/20 uppercase tracking-wider">
                    Tiếp tục bài học
                  </span>
                  <span className="text-xs text-[#8B9097] font-medium">Gần đây nhất</span>
                </div>

                <h3
                  onClick={() => onSelectLesson(continueLesson.lesson._id)}
                  className="text-lg sm:text-xl font-black text-[#18181B] hover:text-[#B91B1C] transition-colors cursor-pointer line-clamp-1"
                >
                  {continueLesson.lesson.titleVi}
                </h3>

                {continueLesson.lesson.titleZh && (
                  <p className="text-xs sm:text-sm font-serif text-[#5F6368] mt-0.5 line-clamp-1">
                    {continueLesson.lesson.titleZh}
                    {continueLesson.lesson.pinyin && (
                      <span className="font-mono text-[#B91B1C] ml-2 font-bold">
                        ({continueLesson.lesson.pinyin})
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Progress Bar with timestamps */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-[#5F6368]">
                  <span>
                    Đã xem: {formatDuration(continueLesson.lastPositionSeconds)} / {formatDuration(continueLesson.lesson.durationSeconds || 0)}
                  </span>
                  <span className="text-[#B91B1C] font-mono font-black">
                    {continueLesson.lesson.durationSeconds
                      ? `${Math.min(100, Math.round((continueLesson.lastPositionSeconds / continueLesson.lesson.durationSeconds) * 100))}%`
                      : '0%'}
                  </span>
                </div>
                <div className="w-full bg-[#E7E7EA] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#B91B1C] h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        continueLesson.lesson.durationSeconds
                          ? Math.min(100, (continueLesson.lastPositionSeconds / continueLesson.lesson.durationSeconds) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Action Button */}
              <div>
                <button
                  type="button"
                  onClick={() => onSelectLesson(continueLesson.lesson._id)}
                  className="h-11 px-6 rounded-2xl bg-[#B91B1C] hover:bg-[#A3181A] text-white font-bold text-xs sm:text-sm flex items-center gap-2.5 transition-all cursor-pointer shadow-md hover:shadow-lg shadow-[#B91B1C]/20 active:scale-95"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Tiếp tục xem bài học</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. SEARCH & FILTER TOOLBAR                                */}
      {/* ========================================================= */}
      <div className="space-y-4">
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#E7E7EA] shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
          {/* Search Input */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-[#8B9097] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm bài học theo tên tiếng Việt hoặc chữ Hán..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-11 pr-10 py-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-2xl text-xs sm:text-sm font-medium text-[#18181B] placeholder-[#8B9097] outline-none focus:border-[#B91B1C] focus:bg-white transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills & HSK selector */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Pills */}
            <div className="inline-flex rounded-2xl bg-[#F7F7F9] p-1 border border-[#E7E7EA]">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-[#18181B] text-white shadow-2xs'
                    : 'text-[#5F6368] hover:text-[#18181B]'
                }`}
              >
                Tất cả ({stats.totalLessonsLearned})
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter('in_progress');
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'in_progress'
                    ? 'bg-[#B91B1C] text-white shadow-2xs'
                    : 'text-[#5F6368] hover:text-[#18181B]'
                }`}
              >
                Đang học ({stats.inProgressCount})
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter('completed');
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'completed'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-[#5F6368] hover:text-[#18181B]'
                }`}
              >
                Đã xong ({stats.completedCount})
              </button>
            </div>

            {/* HSK Level dropdown */}
            <select
              value={hskFilter}
              onChange={(e) => {
                setHskFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 px-3 rounded-2xl bg-[#F7F7F9] border border-[#E7E7EA] text-xs font-bold text-[#18181B] outline-none hover:border-[#B91B1C] transition-colors cursor-pointer"
            >
              <option value="">Tất cả HSK</option>
              {[1, 2, 3, 4, 5, 6].map((lvl) => (
                <option key={lvl} value={lvl}>
                  HSK {lvl}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 5. HISTORY LESSONS LIST                                   */}
        {/* ========================================================= */}
        {loading ? (
          <div className="bg-white rounded-3xl p-12 border border-[#E7E7EA] text-center space-y-3">
            <div className="w-8 h-8 border-3 border-[#B91B1C] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-[#5F6368]">Đang tải lịch sử học tập...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl p-8 border border-red-200 text-center space-y-2">
            <p className="text-sm font-bold text-red-600">{error}</p>
            <button
              type="button"
              onClick={fetchData}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        ) : historyItems.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-3xl p-10 md:p-16 border border-[#E7E7EA] text-center max-w-2xl mx-auto shadow-2xs">
            <div className="w-16 h-16 rounded-3xl bg-[#FDF1F1] text-[#B91B1C] flex items-center justify-center mx-auto mb-4 border border-[#B91B1C]/15 shadow-inner">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-[#18181B]">
              {searchQuery || statusFilter !== 'all' || hskFilter
                ? 'Không tìm thấy bài học nào phù hợp'
                : 'Chưa có bài học nào trong lịch sử'}
            </h3>
            <p className="text-xs sm:text-sm text-[#5F6368] mt-2 max-w-md mx-auto leading-relaxed">
              {searchQuery || statusFilter !== 'all' || hskFilter
                ? 'Thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn các bộ lọc trạng thái / HSK.'
                : 'Khám phá ngay các video bài học phong phú trên HanFlix để bắt đầu tích lũy kiến thức và xây dựng chuỗi ngày học tập.'}
            </p>
            {onNavigateToLessons && (
              <button
                type="button"
                onClick={onNavigateToLessons}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs sm:text-sm font-bold shadow-md shadow-[#B91B1C]/20 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 fill-white" />
                <span>Khám phá Kho Bài Học ngay</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          /* Lesson History Rows */
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-[#E7E7EA] overflow-hidden shadow-2xs divide-y divide-[#E7E7EA]/70">
              {historyItems.map((item, index) => {
                const lesson = item.lesson || item.lessonId;
                if (!lesson) return null;

                const duration = lesson.durationSeconds || 0;
                const watched = item.lastPositionSeconds || 0;
                const percent = duration > 0 ? Math.min(100, Math.round((watched / duration) * 100)) : item.completed ? 100 : 0;
                const isCompleted = item.completed || percent >= 95;

                return (
                  <div
                    key={item._id || index}
                    className="p-4 sm:p-5 hover:bg-[#FDFBFB] transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 group"
                  >
                    {/* Left: Thumbnail & Lesson Info */}
                    <div className="flex items-start sm:items-center gap-4 min-w-0">
                      {/* 16:9 Thumbnail */}
                      <div
                        onClick={() => onSelectLesson(lesson._id)}
                        className="relative aspect-video w-32 sm:w-44 rounded-xl overflow-hidden bg-neutral-900 border border-black/10 shrink-0 select-none group/thumb cursor-pointer shadow-2xs"
                      >
                        {lesson.thumbnailUrl ? (
                          <img
                            src={lesson.thumbnailUrl}
                            alt={lesson.titleVi}
                            className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#1F1F23] to-[#2D1517] flex items-center justify-center text-white/20 font-hanzi font-black text-2xl">
                            {lesson.titleZh ? lesson.titleZh[0] : '汉'}
                          </div>
                        )}

                        {/* Play Hover Overlay */}
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-[#B91B1C] text-white flex items-center justify-center shadow-lg">
                            <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="absolute top-1.5 left-1.5 z-10">
                          <span className="px-1.5 py-0.5 rounded-md bg-black/80 text-white text-[9px] font-black backdrop-blur-md">
                            HSK {lesson.hsk}
                          </span>
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 z-10">
                          <span className="px-1.5 py-0.5 rounded-md bg-black/80 text-white font-mono text-[9px] font-bold backdrop-blur-md">
                            {formatDuration(duration)}
                          </span>
                        </div>
                      </div>

                      {/* Info & Progress */}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border inline-flex items-center gap-1 ${
                              isCompleted
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {isCompleted ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Đã hoàn thành</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Đang học ({percent}%)</span>
                              </>
                            )}
                          </span>

                          {item.bestQuizScore != null && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold inline-flex items-center gap-1">
                              <Trophy className="w-3 h-3 text-purple-600" />
                              <span>Quiz: {item.bestQuizScore}%</span>
                            </span>
                          )}

                          {item.updatedAt && (
                            <span className="text-[11px] text-[#8B9097] hidden sm:inline-block">
                              Học lúc: {new Date(item.updatedAt).toLocaleDateString('vi-VN')}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h4
                          onClick={() => onSelectLesson(lesson._id)}
                          className="text-sm sm:text-base font-black text-[#18181B] hover:text-[#B91B1C] transition-colors cursor-pointer line-clamp-1"
                        >
                          {lesson.titleVi}
                        </h4>

                        {/* Bilingual subtitle */}
                        {lesson.titleZh && (
                          <p className="text-xs font-serif text-[#5F6368] line-clamp-1">
                            {lesson.titleZh}
                            {lesson.pinyin && (
                              <span className="font-mono text-[#B91B1C] font-bold ml-1.5">
                                {lesson.pinyin}
                              </span>
                            )}
                          </p>
                        )}

                        {/* Small Progress Bar */}
                        <div className="pt-1 flex items-center gap-3 max-w-md">
                          <div className="flex-1 bg-[#E7E7EA] h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isCompleted ? 'bg-emerald-500' : 'bg-[#B91B1C]'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-[#8B9097] shrink-0">
                            {formatDuration(watched)} / {formatDuration(duration)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Action Button */}
                    <div className="flex items-center justify-end gap-2.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#E7E7EA]/40">
                      <button
                        type="button"
                        onClick={() => onSelectLesson(lesson._id)}
                        className={`h-10 px-5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95 ${
                          isCompleted
                            ? 'bg-white hover:bg-[#F7F7F9] text-[#18181B] border border-[#E7E7EA] hover:border-[#B91B1C]/30 hover:text-[#B91B1C]'
                            : 'bg-[#B91B1C] hover:bg-[#A3181A] text-white shadow-md shadow-[#B91B1C]/15'
                        }`}
                      >
                        {isCompleted ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Ôn lại</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-white" />
                            <span>Học tiếp</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <AdminPaginationBar
              total={totalItems}
              page={page}
              pageSize={pageSize}
              visibleCount={historyItems.length}
              unitLabel="bài học"
              ariaLabel="Phân trang lịch sử học tập"
              onPageChange={(newPage) => setPage(newPage)}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
