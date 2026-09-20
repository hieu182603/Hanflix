import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Edit3,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Clock,
  RotateCcw,
  Trash2,
  X,
  Play,
  LayoutGrid,
  List,
  Filter,
  GraduationCap,
  Layers,
  Sparkles,
  Upload,
  Cpu,
} from 'lucide-react';
import type { AdminLesson } from '../../api/admin';
import AdminPaginationBar, { DEFAULT_ADMIN_PAGE_SIZE } from './AdminPaginationBar';
import { useNotification, StatusBadge } from '../notifications';
import type { NotificationVariant } from '../notifications';
import { AdminSearchBar } from './AdminSearchBar';

interface AdminVideoListProps {
  lessons: AdminLesson[];
  loading: boolean;
  busy: boolean;
  onNavigateToUpload: () => void;
  onEditLesson: (lessonId: string) => void;
  onViewProcessing: (lessonId: string) => void;
  onPublishLesson: (lessonId: string) => Promise<void>;
  onHideLesson: (lessonId: string) => Promise<void>;
  onRestoreLesson: (lessonId: string) => Promise<void>;
  onDeleteLesson: (lessonId: string) => Promise<void>;
  onRetryProcessing: (lessonId: string) => Promise<void>;
}

const TOPIC_LABELS: Record<string, string> = {
  'daily-life': 'Đời sống',
  'food': 'Ẩm thực',
  'travel': 'Du lịch',
  'shopping': 'Mua sắm',
  'business': 'Kinh doanh',
  'entertainment': 'Giải trí',
};

const STATUS_CONFIG: Record<string, { label: string; variant: NotificationVariant }> = {
  published: { label: 'Đã xuất bản', variant: 'success' },
  ready_for_review: { label: 'Chờ duyệt', variant: 'warning' },
  draft: { label: 'Bản nháp', variant: 'neutral' },
  processing: { label: 'Đang xử lý AI', variant: 'error' },
  uploading: { label: 'Đang tải lên', variant: 'info' },
  failed: { label: 'Lỗi xử lý', variant: 'error' },
  hidden: { label: 'Đã ẩn', variant: 'neutral' },
};

// Fallback high-quality thumbnail placeholders by HSK tier
const TIER_THUMBNAILS: Record<string, string> = {
  elementary: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=250&fit=crop&auto=format',
  intermediate: 'https://images.unsplash.com/photo-1528728329032-2972f65dfb3f?w=400&h=250&fit=crop&auto=format',
  advanced: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=400&h=250&fit=crop&auto=format',
};

export default function AdminVideoList({
  lessons,
  loading,
  busy,
  onNavigateToUpload,
  onEditLesson,
  onViewProcessing,
  onPublishLesson,
  onHideLesson,
  onRestoreLesson,
  onDeleteLesson,
  onRetryProcessing,
}: AdminVideoListProps) {
  const notify = useNotification();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hskFilter, setHskFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ADMIN_PAGE_SIZE);

  // Stats calculation
  const totalCount = lessons.length;
  const publishedCount = useMemo(() => lessons.filter(l => l.status === 'published').length, [lessons]);
  const readyCount = useMemo(() => lessons.filter(l => l.status === 'ready_for_review').length, [lessons]);
  const draftCount = useMemo(() => lessons.filter(l => l.status === 'draft').length, [lessons]);
  const processingCount = useMemo(() => lessons.filter(l => ['processing', 'uploading', 'failed'].includes(l.status)).length, [lessons]);
  const hiddenCount = useMemo(() => lessons.filter(l => l.status === 'hidden').length, [lessons]);

  // Reset to first page when search, status or HSK filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, hskFilter, pageSize]);

  // Filtering logic: search + status + HSK 1..9
  const filteredLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      // Status filter
      if (statusFilter !== 'all' && lesson.status !== statusFilter) {
        return false;
      }
      // HSK filter (1 to 9)
      if (hskFilter !== 'all') {
        const targetHsk = Number(hskFilter);
        if (lesson.hsk !== targetHsk) return false;
      }
      // Search query (Vietnamese, Chinese, Pinyin, Description)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const vi = (lesson.titleVi || '').toLowerCase();
        const zh = (lesson.titleZh || '').toLowerCase();
        const py = (lesson.pinyin || '').toLowerCase();
        const desc = (lesson.descriptionVi || '').toLowerCase();
        if (!vi.includes(query) && !zh.includes(query) && !py.includes(query) && !desc.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [lessons, statusFilter, hskFilter, searchQuery]);

  // Pagination Slicing
  const totalFiltered = filteredLessons.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFiltered);
  const paginatedLessons = useMemo(() => {
    return filteredLessons.slice(startIndex, endIndex);
  }, [filteredLessons, startIndex, endIndex]);

  // Format seconds to mm:ss
  const formatDuration = (sec?: number) => {
    const total = sec || 120;
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Get HSK Badge styling and category name (HSK 1..9)
  const getHskMeta = (hsk: number) => {
    if (hsk <= 3) {
      return {
        badge: 'bg-[#EAF5F1] text-[#188A5A] border-[#C6E7DA]',
        tier: 'Sơ cấp',
      };
    }
    if (hsk <= 6) {
      return {
        badge: 'bg-[#FFF8EC] text-[#B45309] border-[#FDE6BA]',
        tier: 'Trung cấp',
      };
    }
    return {
      badge: 'bg-[#FDF1F1] text-[#B91B1C] border-[#F9D2D2]',
      tier: 'Cao cấp (HSK 3.0)',
    };
  };

  // Quick Action Handlers
  const handlePublish = async (id: string, titleVi: string) => {
    if (!await notify.confirm({
      title: 'Duyệt và xuất bản bài học',
      message: `Bạn có chắc chắn muốn duyệt và xuất bản bài học "${titleVi}"?`,
      confirmText: 'Xuất bản',
      tone: 'default',
    })) return;
    try {
      setActionLoadingId(id);
      await onPublishLesson(id);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleHide = async (id: string, titleVi: string) => {
    if (!await notify.confirm({
      title: 'Ẩn bài học',
      message: `Ẩn bài học "${titleVi}" khỏi ứng dụng học viên?`,
      confirmText: 'Ẩn',
      tone: 'default',
    })) return;
    try {
      setActionLoadingId(id);
      await onHideLesson(id);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      setActionLoadingId(id);
      await onRestoreLesson(id);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      setActionLoadingId(id);
      await onRetryProcessing(id);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id: string, titleVi: string, status: string) => {
    const isPublished = status === 'published';
    const message = isPublished
      ? `Xóa vĩnh viễn bài học đã xuất bản "${titleVi}"?\n\nHành động này không thể hoàn tác. Học viên sẽ mất quyền truy cập bài học này.`
      : `Xóa vĩnh viễn bài học "${titleVi}"?\n\nVideo, phụ đề, quiz và tiến trình xử lý liên quan sẽ bị xóa.`;
    if (!await notify.confirm({
      title: 'Xóa bài học',
      message: <span className="whitespace-pre-line">{message}</span>,
      confirmText: 'Xóa vĩnh viễn',
      cancelText: 'Hủy',
      tone: 'danger',
    })) return;
    try {
      setActionLoadingId(id);
      await onDeleteLesson(id);
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderDeleteButton = (id: string, titleVi: string, status: string, compact = false) => (
    <button
      type="button"
      disabled={actionLoadingId === id || busy}
      onClick={() => void handleDelete(id, titleVi, status)}
      className={`${compact ? 'h-8 px-2.5' : 'h-9 px-3'} rounded-xl border border-[#FECACA] hover:border-red-400 hover:bg-red-50 text-red-600 bg-white transition-all flex items-center justify-center`}
      title="Xóa vĩnh viễn"
    >
      <Trash2 size={compact ? 13 : 14} />
    </button>
  );

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* 1. Header & Summary Stats Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 md:p-7 rounded-3xl border border-[#F2E4D8] shadow-2xs relative overflow-hidden">
        <div className="absolute -right-4 -top-8 text-8xl font-serif font-black text-[#B91B1C]/[0.04] select-none pointer-events-none">
          视
        </div>
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#FDF1F1] text-[#B91B1C] text-[11px] font-extrabold uppercase tracking-wide border border-[#F9D2D2]">
              Quản trị Nội dung Video
            </span>
            <span className="text-xs text-[#8B9097] font-semibold">Khung chuẩn HSK 1 đến HSK 9</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#18181B] tracking-tight">
            Kho Bài Học Video
          </h1>
          <p className="text-xs sm:text-sm text-[#5F6368]">
            Quản lý trạng thái đăng, bản nháp, chỉnh sửa phụ đề Whisper ASR và xuất bản bài học.
          </p>
        </div>

        {/* Quick Actions & Total badge */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10">
          <button
            type="button"
            onClick={onNavigateToUpload}
            className="h-11 px-5 rounded-2xl bg-gradient-to-r from-[#B91B1C] to-[#991415] hover:from-[#A3181A] hover:to-[#8F1719] text-white text-xs font-extrabold flex items-center gap-2 shadow-sm shadow-[#B91B1C]/25 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Thêm video mới</span>
          </button>
        </div>
      </div>

      {/* 2. Fast Stats Counter Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { id: 'all', label: 'Tất cả bài học', count: totalCount, color: 'text-[#18181B]', bg: 'bg-white' },
          { id: 'ready_for_review', label: 'Chờ kiểm duyệt', count: readyCount, color: 'text-[#B45309]', bg: 'bg-[#FFF8EC] border-[#FDE6BA]' },
          { id: 'published', label: 'Đã xuất bản', count: publishedCount, color: 'text-[#188A5A]', bg: 'bg-white' },
          { id: 'draft', label: 'Bản nháp', count: draftCount, color: 'text-[#5F6368]', bg: 'bg-white' },
          { id: 'processing', label: 'Tiến trình AI', count: processingCount, color: 'text-[#B91B1C]', bg: 'bg-white' },
          { id: 'hidden', label: 'Đã ẩn bài', count: hiddenCount, color: 'text-[#8B9097]', bg: 'bg-white' },
        ].map((item) => {
          const isActive = statusFilter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatusFilter(item.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer shadow-2xs ${
                item.bg
              } ${
                isActive
                  ? 'border-[#B91B1C] ring-2 ring-[#B91B1C]/20 shadow-xs'
                  : 'border-[#F2E4D8] hover:border-[#B91B1C]/40'
              }`}
            >
              <p className="text-[11px] font-extrabold text-[#8B9097] uppercase tracking-wider truncate">
                {item.label}
              </p>
              <p className={`text-2xl font-black mt-1 font-mono ${item.color}`}>
                {item.count}
              </p>
            </button>
          );
        })}
      </div>

      {/* 3. Advanced Control Bar: Search + Status + HSK + View Mode */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 rounded-2xl border border-[#F2E4D8] bg-white p-3 shadow-2xs">
        {/* Search Box */}
        <div className="relative flex-1 min-w-0 w-full sm:w-auto">
          <AdminSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery('')}
            placeholder="Tìm theo tiêu đề Việt, Trung hoặc Pinyin..."
          />
        </div>

        {/* Right Controls Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter Dropdown */}
          <div className="flex h-10 items-center gap-1.5 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-2.5 transition-colors hover:border-[#B91B1C]/40 focus-within:border-[#B91B1C] focus-within:bg-white">
            <Filter className="h-3.5 w-3.5 shrink-0 text-[#8C827A]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Lọc theo trạng thái bài học"
              className="cursor-pointer bg-transparent text-xs font-bold text-[#2B2826] outline-none"
            >
              <option value="all">Tất cả bài học ({totalCount})</option>
              <option value="ready_for_review">Chờ duyệt ({readyCount})</option>
              <option value="published">Đã xuất bản ({publishedCount})</option>
              <option value="draft">Bản nháp ({draftCount})</option>
              <option value="processing">Đang xử lý ({processingCount})</option>
              <option value="hidden">Đã ẩn ({hiddenCount})</option>
            </select>
          </div>

          {/* HSK Level Filter */}
          <div className="flex h-10 items-center gap-1.5 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-2.5 transition-colors hover:border-[#B91B1C]/40 focus-within:border-[#B91B1C] focus-within:bg-white">
            <GraduationCap className="h-3.5 w-3.5 shrink-0 text-[#8C827A]" />
            <select
              value={hskFilter}
              onChange={(e) => setHskFilter(e.target.value)}
              aria-label="Lọc theo cấp độ HSK"
              className="cursor-pointer bg-transparent text-xs font-bold text-[#2B2826] outline-none"
            >
              <option value="all">Tất cả HSK (1-9)</option>
              <option value="1">HSK 1 (Sơ cấp)</option>
              <option value="2">HSK 2 (Sơ cấp)</option>
              <option value="3">HSK 3 (Sơ cấp)</option>
              <option value="4">HSK 4 (Trung cấp)</option>
              <option value="5">HSK 5 (Trung cấp)</option>
              <option value="6">HSK 6 (Trung cấp)</option>
              <option value="7">HSK 7 (Cao cấp 3.0)</option>
              <option value="8">HSK 8 (Cao cấp 3.0)</option>
              <option value="9">HSK 9 (Chuyên gia)</option>
            </select>
          </div>

          {/* View Mode Toggle: Table/List vs Grid */}
          <div className="flex h-9 items-center rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="Dạng bảng danh sách"
              className={`flex h-7.5 w-7.5 items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-[#18181B] shadow-2xs border border-[#F2E4D8]'
                  : 'text-[#8B9097] hover:text-[#18181B]'
              }`}
            >
              <List size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Dạng lưới thẻ video"
              className={`flex h-7.5 w-7.5 items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-[#18181B] shadow-2xs border border-[#F2E4D8]'
                  : 'text-[#8B9097] hover:text-[#18181B]'
              }`}
            >
              <LayoutGrid size={15} />
            </button>
          </div>

          {/* Reset button if filter active */}
          {(searchQuery || statusFilter !== 'all' || hskFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setHskFilter('all');
              }}
              className="flex h-9 items-center gap-1 rounded-xl border border-[#F2E4D8] bg-[#FDF1F1] px-2.5 text-xs font-bold text-[#B91B1C] transition-colors hover:bg-[#FAD2CF]"
              title="Đặt lại bộ lọc"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Đặt lại</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Lesson Items Rendering (Empty State vs List View vs Grid View) */}
      {filteredLessons.length === 0 ? (
        <div className="py-16 px-6 text-center space-y-3.5 bg-white rounded-3xl border border-dashed border-[#F2E4D8] shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF9F5] text-[#8B9097] border border-[#F2E4D8] flex items-center justify-center mx-auto">
            <Search size={24} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-[#18181B]">Không tìm thấy bài học phù hợp</h3>
            <p className="text-xs text-[#5F6368]">
              Thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn các bộ lọc trạng thái và trình độ HSK.
            </p>
          </div>
          <div className="flex justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setHskFilter('all');
              }}
              className="px-4 py-2 rounded-xl bg-[#FFF9F5] hover:bg-[#FFF0EB] text-xs font-bold text-[#18181B] border border-[#F2E4D8] transition-all cursor-pointer"
            >
              Xóa bộ lọc
            </button>
            <button
              type="button"
              onClick={onNavigateToUpload}
              className="px-4 py-2 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-xs font-bold text-white transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus size={14} />
              <span>Tải video mới lên</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        /* LIST / TABLE VIEW */
        <div className="bg-white rounded-3xl border border-[#F2E4D8] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FFF9F5] border-b border-[#F2E4D8] text-[#8B9097] uppercase font-extrabold text-[10px] tracking-wider">
                  <th className="py-3.5 px-5">Video & Tiêu đề</th>
                  <th className="py-3.5 px-4">Cấp độ HSK</th>
                  <th className="py-3.5 px-4">Chủ đề</th>
                  <th className="py-3.5 px-4">Thời lượng</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-5 text-center">Thao tác Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2E4D8]">
                {paginatedLessons.map((item) => {
                  const statusInfo = STATUS_CONFIG[item.status] || {
                    label: item.status,
                    variant: 'neutral' as NotificationVariant,
                  };
                  const hskMeta = getHskMeta(item.hsk);
                  const isActionBusy = actionLoadingId === item._id || busy;
                  const isReady = item.status === 'ready_for_review';
                  const isProcessing = ['processing', 'uploading', 'failed'].includes(item.status);
                  const isPublished = item.status === 'published';
                  const isHidden = item.status === 'hidden';

                  // Default poster by HSK tier
                  const placeholderImg =
                    item.hsk <= 3
                      ? TIER_THUMBNAILS.elementary
                      : item.hsk <= 6
                      ? TIER_THUMBNAILS.intermediate
                      : TIER_THUMBNAILS.advanced;
                  const thumbnailSrc = item.thumbnailUrl || placeholderImg;

                  return (
                    <tr key={item._id} className="hover:bg-[#FFFDFB] transition-colors group">
                      {/* Video Thumbnail & Titles */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3.5 min-w-[280px]">
                          <div className="w-20 h-13 rounded-xl bg-black shrink-0 overflow-hidden relative border border-[#F2E4D8] group-hover:shadow-xs transition-all shadow-2xs">
                            <img
                              src={thumbnailSrc}
                              alt={item.titleVi}
                              onError={(e) => {
                                if (e.currentTarget.src !== placeholderImg) {
                                  e.currentTarget.src = placeholderImg;
                                }
                              }}
                              className="w-full h-full object-cover opacity-85 group-hover:opacity-95 group-hover:scale-105 transition-all duration-300"
                            />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play size={16} className="text-white fill-white" />
                            </div>
                            <span className="absolute bottom-1 right-1 text-[9px] font-mono font-extrabold text-white bg-black/75 px-1 rounded">
                              {formatDuration(item.durationSeconds)}
                            </span>
                          </div>

                          <div className="space-y-1 min-w-0">
                            <h3 className="font-black text-sm text-[#18181B] group-hover:text-[#B91B1C] transition-colors line-clamp-1">
                              {item.titleVi}
                            </h3>
                            <div className="flex items-center gap-2 text-xs">
                              {item.titleZh && (
                                <span className="text-[#B91B1C] font-semibold">
                                  {item.titleZh}
                                </span>
                              )}
                              {item.pinyin && (
                                <span className="text-[#8B9097] font-mono text-[11px]">
                                  ({item.pinyin})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* HSK Level Badge (1..9) */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-black font-mono border ${hskMeta.badge}`}
                          >
                            HSK {item.hsk}
                          </span>
                          <p className="text-[10px] text-[#8B9097]">{hskMeta.tier}</p>
                        </div>
                      </td>

                      {/* Topic Tags */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {(item.topicIds && item.topicIds.length > 0 ? item.topicIds : ['daily-life']).map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded-md bg-[#FFF9F5] text-[#5F6368] border border-[#F2E4D8] text-[11px] font-semibold"
                            >
                              {TOPIC_LABELS[t] || t}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="py-4 px-4 whitespace-nowrap font-mono text-xs text-[#5F6368]">
                        {formatDuration(item.durationSeconds)}
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <StatusBadge
                          variant={statusInfo.variant}
                          label={statusInfo.label}
                          icon={
                            item.status === 'processing' ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-current animate-ping" aria-hidden="true" />
                            ) : undefined
                          }
                        />
                      </td>

                      {/* Admin Contextual Actions */}
                      <td className="py-4 px-5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Ready for review actions */}
                          {isReady && (
                            <>
                              <button
                                type="button"
                                disabled={isActionBusy}
                                onClick={() => void handlePublish(item._id, item.titleVi)}
                                className="h-8 px-3 rounded-xl bg-[#188A5A] hover:bg-[#13734B] text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1 shadow-2xs cursor-pointer"
                              >
                                <CheckCircle size={13} />
                                <span>Duyệt</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditLesson(item._id)}
                                className="h-8 px-3 rounded-xl border border-[#F2E4D8] hover:border-[#B91B1C] hover:bg-[#FDF1F1] hover:text-[#B91B1C] bg-white text-xs font-bold text-[#18181B] transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                              >
                                <Edit3 size={13} />
                                <span>Biên tập</span>
                              </button>
                            </>
                          )}

                          {/* Draft actions */}
                          {item.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => onEditLesson(item._id)}
                              className="h-8 px-3 rounded-xl border border-[#F2E4D8] hover:border-[#B91B1C] hover:bg-[#FDF1F1] hover:text-[#B91B1C] bg-white text-xs font-bold text-[#18181B] transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              <Edit3 size={13} />
                              <span>Biên tập</span>
                            </button>
                          )}

                          {/* Processing actions */}
                          {isProcessing && (
                            <>
                              <button
                                type="button"
                                onClick={() => onViewProcessing(item._id)}
                                className="h-8 px-3 rounded-xl border border-[#F2E4D8] hover:border-[#B91B1C] hover:bg-[#FDF1F1] bg-white text-xs font-bold text-[#B91B1C] transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                              >
                                <Cpu size={13} />
                                <span>Tiến trình</span>
                              </button>
                              {item.status === 'failed' && (
                                <button
                                  type="button"
                                  disabled={isActionBusy}
                                  onClick={() => void handleRetry(item._id)}
                                  className="h-8 px-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                                  title="Thử lại xử lý AI"
                                >
                                  <RotateCcw size={13} />
                                </button>
                              )}
                            </>
                          )}

                          {/* Published actions */}
                          {isPublished && (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditLesson(item._id)}
                                className="h-8 px-3 rounded-xl border border-[#F2E4D8] hover:border-[#B91B1C] hover:bg-[#FDF1F1] hover:text-[#B91B1C] bg-white text-xs font-bold text-[#18181B] transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                              >
                                <Edit3 size={13} />
                                <span>Sửa</span>
                              </button>
                              <button
                                type="button"
                                disabled={isActionBusy}
                                onClick={() => void handleHide(item._id, item.titleVi)}
                                className="h-8 px-2.5 rounded-xl border border-[#F2E4D8] hover:border-red-300 text-xs text-[#5F6368] hover:text-red-700 bg-white transition-all cursor-pointer shadow-2xs"
                                title="Ẩn bài học khỏi app"
                              >
                                <EyeOff size={13} />
                              </button>
                            </>
                          )}

                          {/* Hidden actions */}
                          {isHidden && (
                            <>
                              <button
                                type="button"
                                disabled={isActionBusy}
                                onClick={() => void handleRestore(item._id)}
                                className="h-8 px-3 rounded-xl border border-[#F2E4D8] hover:border-[#188A5A] hover:bg-[#EAF5F1] text-xs font-bold text-[#188A5A] bg-white transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                              >
                                <Eye size={13} />
                                <span>Khôi phục</span>
                              </button>
                            </>
                          )}

                          {renderDeleteButton(item._id, item.titleVi, item.status, true)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID / CARDS VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedLessons.map((item) => {
            const statusInfo = STATUS_CONFIG[item.status] || {
              label: item.status,
              bg: 'bg-slate-100',
              text: 'text-slate-700',
              border: 'border-slate-200',
            };
            const hskMeta = getHskMeta(item.hsk);
            const isActionBusy = actionLoadingId === item._id || busy;
            const isReady = item.status === 'ready_for_review';
            const isProcessing = ['processing', 'uploading', 'failed'].includes(item.status);
            const isPublished = item.status === 'published';
            const isHidden = item.status === 'hidden';

            const placeholderImg =
              item.hsk <= 3
                ? TIER_THUMBNAILS.elementary
                : item.hsk <= 6
                ? TIER_THUMBNAILS.intermediate
                : TIER_THUMBNAILS.advanced;
            const thumbnailSrc = item.thumbnailUrl || placeholderImg;

            return (
              <div
                key={item._id}
                className="bg-white rounded-3xl border border-[#F2E4D8] hover:border-[#B91B1C]/50 hover:shadow-sm transition-all overflow-hidden flex flex-col justify-between group shadow-2xs"
              >
                <div>
                  {/* Card Thumbnail */}
                  <div className="aspect-video w-full bg-black relative overflow-hidden">
                    <img
                      src={thumbnailSrc}
                      alt={item.titleVi}
                      onError={(e) => {
                        if (e.currentTarget.src !== placeholderImg) {
                          e.currentTarget.src = placeholderImg;
                        }
                      }}
                      className="w-full h-full object-cover opacity-85 group-hover:opacity-95 group-hover:scale-105 transition-all duration-300"
                    />
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-black font-mono border ${hskMeta.badge}`}>
                        HSK {item.hsk}
                      </span>
                    </div>
                    <span className="absolute bottom-2 right-2 text-[10px] font-mono font-extrabold text-white bg-black/75 px-1.5 py-0.5 rounded-md">
                      {formatDuration(item.durationSeconds)}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge variant={statusInfo.variant} label={statusInfo.label} size="sm" />
                      <span className="text-[10px] text-[#8B9097] font-semibold">
                        {TOPIC_LABELS[item.topicIds?.[0] || 'daily-life'] || 'Đời sống'}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-sm text-[#18181B] group-hover:text-[#B91B1C] transition-colors line-clamp-2">
                      {item.titleVi}
                    </h3>

                    {item.titleZh && (
                      <p className="text-xs text-[#B91B1C] font-semibold truncate">
                        {item.titleZh} {item.pinyin && <span className="text-[#8B9097] font-mono text-[10px]">({item.pinyin})</span>}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="p-4 pt-0 border-t border-[#F2E4D8] mt-2 flex items-center justify-between gap-2">
                  {isReady && (
                    <>
                      <button
                        type="button"
                        disabled={isActionBusy}
                        onClick={() => void handlePublish(item._id, item.titleVi)}
                        className="flex-1 h-9 rounded-xl bg-[#188A5A] hover:bg-[#13734B] text-white text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <CheckCircle size={13} />
                        <span>Duyệt đăng</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditLesson(item._id)}
                        className="flex-1 h-9 rounded-xl border border-[#F2E4D8] hover:border-[#B91B1C] hover:bg-[#FDF1F1] hover:text-[#B91B1C] bg-white text-xs font-bold text-[#18181B] transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <Edit3 size={13} />
                        <span>Biên tập</span>
                      </button>
                      {renderDeleteButton(item._id, item.titleVi, item.status)}
                    </>
                  )}

                  {item.status === 'draft' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEditLesson(item._id)}
                        className="flex-1 h-9 rounded-xl border border-[#F2E4D8] hover:border-[#B91B1C] hover:bg-[#FDF1F1] hover:text-[#B91B1C] bg-white text-xs font-bold text-[#18181B] transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <Edit3 size={13} />
                        <span>Biên tập bài học</span>
                      </button>
                      {renderDeleteButton(item._id, item.titleVi, item.status)}
                    </>
                  )}

                  {isProcessing && (
                    <>
                      <button
                        type="button"
                        onClick={() => onViewProcessing(item._id)}
                        className="flex-1 h-9 rounded-xl border border-[#F2E4D8] hover:border-[#B91B1C] hover:bg-[#FDF1F1] bg-white text-xs font-bold text-[#B91B1C] transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <Cpu size={13} />
                        <span>Kiểm tra tiến trình</span>
                      </button>
                      {item.status === 'failed' && (
                        <button
                          type="button"
                          disabled={isActionBusy}
                          onClick={() => void handleRetry(item._id)}
                          className="h-9 px-3 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all flex items-center justify-center cursor-pointer shadow-xs"
                          title="Thử lại xử lý AI"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                      {renderDeleteButton(item._id, item.titleVi, item.status)}
                    </>
                  )}

                  {isPublished && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEditLesson(item._id)}
                        className="flex-1 h-9 rounded-xl border border-[#F2E4D8] hover:border-[#B91B1C] hover:bg-[#FDF1F1] hover:text-[#B91B1C] bg-white text-xs font-bold text-[#18181B] transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <Edit3 size={13} />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        disabled={isActionBusy}
                        onClick={() => void handleHide(item._id, item.titleVi)}
                        className="h-9 px-2.5 rounded-xl border border-[#F2E4D8] hover:border-red-300 text-xs text-[#5F6368] hover:text-red-700 bg-white transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                        title="Ẩn bài học khỏi app"
                      >
                        <EyeOff size={13} />
                      </button>
                      {renderDeleteButton(item._id, item.titleVi, item.status)}
                    </>
                  )}

                  {isHidden && (
                    <>
                      <button
                        type="button"
                        disabled={isActionBusy}
                        onClick={() => void handleRestore(item._id)}
                        className="flex-1 h-9 rounded-xl border border-[#F2E4D8] hover:border-[#188A5A] hover:bg-[#EAF5F1] text-xs font-bold text-[#188A5A] bg-white transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>Khôi phục</span>
                      </button>
                      {renderDeleteButton(item._id, item.titleVi, item.status)}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AdminPaginationBar
        total={totalFiltered}
        page={safeCurrentPage}
        pageSize={pageSize}
        unitLabel="bài học"
        disabled={loading || busy}
        ariaLabel="Phân trang danh sách video"
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
      />
    </div>
  );
}
