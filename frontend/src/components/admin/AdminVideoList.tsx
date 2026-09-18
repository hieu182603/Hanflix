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
  Layers,
  Sparkles,
  Upload,
  Cpu,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { AdminLesson } from '../../api/admin';

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

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  published: { label: 'Đã xuất bản', bg: 'bg-[#E4F6ED]', text: 'text-[#188A5A]', border: 'border-[#BFE7D3]' },
  ready_for_review: { label: 'Chờ duyệt', bg: 'bg-[#FFF8E7]', text: 'text-[#B87A00]', border: 'border-[#FDE2A7]' },
  draft: { label: 'Bản nháp', bg: 'bg-[#F4F4F6]', text: 'text-[#5F6368]', border: 'border-[#E7E7EA]' },
  processing: { label: 'Đang xử lý AI', bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
  uploading: { label: 'Đang tải lên', bg: 'bg-[#EFF6FF]', text: 'text-[#1D4ED8]', border: 'border-[#BFDBFE]' },
  failed: { label: 'Lỗi xử lý', bg: 'bg-[#FEF2F2]', text: 'text-[#DC2626]', border: 'border-[#FECACA]' },
  hidden: { label: 'Đã ẩn', bg: 'bg-[#F3F4F6]', text: 'text-[#9CA3AF]', border: 'border-[#E5E7EB]' },
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hskFilter, setHskFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

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

  // Smart page numbers calculation (with ellipsis)
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) pages.push('...');
      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safeCurrentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, safeCurrentPage]);

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
        badge: 'bg-[#E4F6ED] text-[#188A5A] border-[#BFE7D3]',
        tier: 'Sơ cấp',
      };
    }
    if (hsk <= 6) {
      return {
        badge: 'bg-[#FDF1F1] text-[#B91B1C] border-[#F9D2D2]',
        tier: 'Trung cấp',
      };
    }
    return {
      badge: 'bg-[#F3E8FF] text-[#7C3AED] border-[#DDD6FE]',
      tier: 'Cao cấp (HSK 3.0)',
    };
  };

  // Quick Action Handlers
  const handlePublish = async (id: string, titleVi: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn duyệt và xuất bản bài học: "${titleVi}"?`)) return;
    try {
      setActionLoadingId(id);
      await onPublishLesson(id);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleHide = async (id: string, titleVi: string) => {
    if (!window.confirm(`Ẩn bài học "${titleVi}" khỏi ứng dụng học viên?`)) return;
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
      ? `XÓA VĨNH VIỄN bài học đã xuất bản "${titleVi}"?\n\nHành động này không thể hoàn tác. Học viên sẽ mất quyền truy cập bài học này.`
      : `Xóa vĩnh viễn bài học "${titleVi}"?\n\nVideo, phụ đề, quiz và tiến trình xử lý liên quan sẽ bị xóa.`;
    if (!window.confirm(message)) return;
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 md:p-7 rounded-3xl border border-[#E7E7EA] shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#FDF1F1] text-[#B91B1C] text-[11px] font-extrabold uppercase tracking-wide border border-[#F7DADA]">
              Quản trị Nội dung Video
            </span>
            <span className="text-xs text-[#8B9097] font-medium">HSK 1 đến HSK 9</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#18181B] tracking-tight">
            Kho Bài Học Video
          </h1>
          <p className="text-xs sm:text-sm text-[#5F6368]">
            Quản lý trạng thái đăng, bản nháp, chỉnh sửa phụ đề Whisper ASR và xuất bản bài học.
          </p>
        </div>

        {/* Quick Actions & Total badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onNavigateToUpload}
            className="h-11 px-5 rounded-2xl bg-[#B91B1C] hover:bg-[#A3181A] active:bg-[#8F1719] text-white text-xs font-extrabold flex items-center gap-2 shadow-xs transition-all active:scale-[0.98]"
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
          { id: 'ready_for_review', label: 'Chờ kiểm duyệt', count: readyCount, color: 'text-[#B87A00]', bg: 'bg-[#FFFDF9] border-[#FDE2A7]' },
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
              className={`p-3.5 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                item.bg
              } ${
                isActive
                  ? 'border-[#B91B1C] ring-2 ring-[#B91B1C]/15 shadow-2xs'
                  : 'border-[#E7E7EA] hover:border-[#8B9097]'
              }`}
            >
              <p className="text-[11px] font-bold text-[#8B9097] uppercase tracking-wider truncate">
                {item.label}
              </p>
              <p className={`text-2xl font-black mt-1 font-mono ${item.color}`}>
                {item.count}
              </p>
            </button>
          );
        })}
      </div>

      {/* 3. Advanced Control Bar: Search + Status Filter + HSK 1-9 Dropdown + View Toggle */}
      <div className="bg-white p-4 rounded-3xl border border-[#E7E7EA] shadow-2xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#8B9097] absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Tìm theo tiêu đề Việt, Trung hoặc Pinyin..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-2xl text-xs outline-none focus:border-[#B91B1C] focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-[#8B9097] hover:text-[#18181B]"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Right Controls: HSK 1..9 Selector & View Mode Toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* HSK Filter Dropdown (Supports HSK 1 to 9) */}
            <div className="flex items-center gap-1.5 bg-[#F7F7F9] px-3 py-1.5 rounded-2xl border border-[#E7E7EA]">
              <span className="text-xs font-extrabold text-[#18181B]">Trình độ:</span>
              <select
                value={hskFilter}
                onChange={(e) => setHskFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#B91B1C] outline-none cursor-pointer"
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
            <div className="flex items-center bg-[#F7F7F9] p-1 rounded-2xl border border-[#E7E7EA]">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="Dạng bảng danh sách"
                className={`p-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-[#18181B] shadow-2xs'
                    : 'text-[#8B9097] hover:text-[#18181B]'
                }`}
              >
                <List size={16} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Dạng lưới thẻ video"
                className={`p-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-[#18181B] shadow-2xs'
                    : 'text-[#8B9097] hover:text-[#18181B]'
                }`}
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter Horizontal Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
          {[
            { id: 'all', label: `Tất cả (${totalCount})` },
            { id: 'ready_for_review', label: `Chờ duyệt (${readyCount})`, badge: true },
            { id: 'published', label: `Đã xuất bản (${publishedCount})` },
            { id: 'draft', label: `Bản nháp (${draftCount})` },
            { id: 'processing', label: `Đang xử lý (${processingCount})` },
            { id: 'hidden', label: `Đã ẩn (${hiddenCount})` },
          ].map((st) => {
            const isActive = statusFilter === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#18181B] text-white shadow-2xs'
                    : 'bg-[#F7F7F9] text-[#5F6368] hover:bg-[#EFEFF2] hover:text-[#18181B]'
                }`}
              >
                {st.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Lesson Items Rendering (Empty State vs List View vs Grid View) */}
      {filteredLessons.length === 0 ? (
        <div className="py-16 px-6 text-center space-y-3.5 bg-white rounded-3xl border border-dashed border-[#D9DDE2] shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-[#F7F7F9] text-[#8B9097] flex items-center justify-center mx-auto">
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
              className="px-4 py-2 rounded-xl bg-[#F7F7F9] hover:bg-[#E7E7EA] text-xs font-bold text-[#18181B] transition-all"
            >
              Xóa bộ lọc
            </button>
            <button
              type="button"
              onClick={onNavigateToUpload}
              className="px-4 py-2 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-xs font-bold text-white transition-all inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Tải video mới lên</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        /* LIST / TABLE VIEW */
        <div className="bg-white rounded-3xl border border-[#E7E7EA] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F9F9FB] border-b border-[#E7E7EA] text-[#8B9097] uppercase font-extrabold text-[10px] tracking-wider">
                  <th className="py-3.5 px-5">Video & Tiêu đề</th>
                  <th className="py-3.5 px-4">Cấp độ HSK</th>
                  <th className="py-3.5 px-4">Chủ đề</th>
                  <th className="py-3.5 px-4">Thời lượng</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-5 text-right">Thao tác Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F3]">
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

                  // Default poster by HSK tier
                  const placeholderImg =
                    item.hsk <= 3
                      ? TIER_THUMBNAILS.elementary
                      : item.hsk <= 6
                      ? TIER_THUMBNAILS.intermediate
                      : TIER_THUMBNAILS.advanced;

                  return (
                    <tr key={item._id} className="hover:bg-[#FDFDFE] transition-colors group">
                      {/* Video Thumbnail & Titles */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3.5 min-w-[280px]">
                          <div className="w-20 h-13 rounded-xl bg-black shrink-0 overflow-hidden relative border border-[#E7E7EA] group-hover:shadow-xs transition-all">
                            <img
                              src={placeholderImg}
                              alt={item.titleVi}
                              className="w-full h-full object-cover opacity-85 group-hover:opacity-95 group-hover:scale-105 transition-all duration-300"
                            />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play size={16} className="text-white fill-white" />
                            </div>
                            <span className="absolute bottom-1 right-1 text-[9px] font-mono font-extrabold text-white bg-black/70 px-1 rounded">
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
                              className="px-2 py-0.5 rounded-md bg-[#F7F7F9] text-[#5F6368] text-[11px] font-medium"
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
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.status === 'published'
                                ? 'bg-[#188A5A]'
                                : item.status === 'ready_for_review'
                                ? 'bg-[#B87A00]'
                                : item.status === 'processing'
                                ? 'bg-[#B91B1C] animate-ping'
                                : 'bg-[#8B9097]'
                            }`}
                          />
                          <span>{statusInfo.label}</span>
                        </span>
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
                                className="h-8 px-3 rounded-xl bg-[#188A5A] hover:bg-[#13734B] text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1"
                              >
                                <CheckCircle size={13} />
                                <span>Duyệt</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditLesson(item._id)}
                                className="h-8 px-3 rounded-xl border border-[#E7E7EA] hover:border-[#18181B] bg-white text-xs font-bold text-[#18181B] transition-all flex items-center gap-1"
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
                              className="h-8 px-3 rounded-xl border border-[#E7E7EA] hover:border-[#18181B] bg-white text-xs font-bold text-[#18181B] transition-all flex items-center gap-1"
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
                                className="h-8 px-3 rounded-xl border border-[#E7E7EA] hover:border-[#B91B1C] bg-white text-xs font-bold text-[#B91B1C] transition-all flex items-center gap-1"
                              >
                                <Cpu size={13} />
                                <span>Tiến trình</span>
                              </button>
                              {item.status === 'failed' && (
                                <button
                                  type="button"
                                  disabled={isActionBusy}
                                  onClick={() => void handleRetry(item._id)}
                                  className="h-8 px-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all"
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
                                className="h-8 px-3 rounded-xl border border-[#E7E7EA] hover:border-[#18181B] bg-white text-xs font-bold text-[#18181B] transition-all flex items-center gap-1"
                              >
                                <Edit3 size={13} />
                                <span>Sửa</span>
                              </button>
                              <button
                                type="button"
                                disabled={isActionBusy}
                                onClick={() => void handleHide(item._id, item.titleVi)}
                                className="h-8 px-2.5 rounded-xl border border-[#E7E7EA] hover:border-red-300 text-xs text-[#5F6368] hover:text-red-700 bg-white transition-all"
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
                                className="h-8 px-3 rounded-xl border border-[#E7E7EA] hover:border-[#188A5A] text-xs font-bold text-[#188A5A] bg-white transition-all flex items-center gap-1"
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

            return (
              <div
                key={item._id}
                className="bg-white rounded-3xl border border-[#E7E7EA] hover:border-[#B91B1C]/40 hover:shadow-xs transition-all overflow-hidden flex flex-col justify-between group"
              >
                <div>
                  {/* Card Thumbnail */}
                  <div className="aspect-video w-full bg-black relative overflow-hidden">
                    <img
                      src={placeholderImg}
                      alt={item.titleVi}
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
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
                      >
                        {statusInfo.label}
                      </span>
                      <span className="text-[10px] text-[#8B9097] font-medium">
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
                <div className="p-4 pt-0 border-t border-[#F0F0F3] mt-2 flex items-center justify-between gap-2">
                  {isReady && (
                    <>
                      <button
                        type="button"
                        disabled={isActionBusy}
                        onClick={() => void handlePublish(item._id, item.titleVi)}
                        className="flex-1 h-9 rounded-xl bg-[#188A5A] hover:bg-[#13734B] text-white text-xs font-bold transition-all flex items-center justify-center gap-1"
                      >
                        <CheckCircle size={13} />
                        <span>Duyệt đăng</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditLesson(item._id)}
                        className="flex-1 h-9 rounded-xl border border-[#E7E7EA] hover:border-[#18181B] bg-white text-xs font-bold text-[#18181B] transition-all flex items-center justify-center gap-1"
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
                        className="flex-1 h-9 rounded-xl border border-[#E7E7EA] hover:border-[#18181B] bg-white text-xs font-bold text-[#18181B] transition-all flex items-center justify-center gap-1"
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
                        className="flex-1 h-9 rounded-xl border border-[#E7E7EA] hover:border-[#B91B1C] bg-white text-xs font-bold text-[#B91B1C] transition-all flex items-center justify-center gap-1"
                      >
                        <Cpu size={13} />
                        <span>Kiểm tra tiến trình</span>
                      </button>
                      {item.status === 'failed' && (
                        <button
                          type="button"
                          disabled={isActionBusy}
                          onClick={() => void handleRetry(item._id)}
                          className="h-9 px-3 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all flex items-center justify-center"
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
                        className="flex-1 h-9 rounded-xl border border-[#E7E7EA] hover:border-[#18181B] bg-white text-xs font-bold text-[#18181B] transition-all flex items-center justify-center gap-1"
                      >
                        <Edit3 size={13} />
                        <span>Biên tập</span>
                      </button>
                      <button
                        type="button"
                        disabled={isActionBusy}
                        onClick={() => void handleHide(item._id, item.titleVi)}
                        className="h-9 px-3 rounded-xl border border-[#E7E7EA] hover:border-red-300 text-xs text-[#5F6368] hover:text-red-700 bg-white transition-all flex items-center justify-center"
                        title="Ẩn bài"
                      >
                        <EyeOff size={14} />
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
                        className="flex-1 h-9 rounded-xl border border-[#E7E7EA] hover:border-[#188A5A] text-xs font-bold text-[#188A5A] bg-white transition-all flex items-center justify-center gap-1"
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

      {/* 5. Pagination & Control Bar */}
      {totalFiltered > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 sm:px-6 rounded-3xl border border-[#E7E7EA] shadow-2xs">
          {/* Sliced Info */}
          <div className="text-xs text-[#5F6368]">
            <span>
              Hiển thị <strong className="text-[#18181B] font-mono">{startIndex + 1}</strong> -{' '}
              <strong className="text-[#18181B] font-mono">{endIndex}</strong> trong tổng số{' '}
              <strong className="text-[#18181B] font-mono">{totalFiltered}</strong> bài học
            </span>
          </div>

          {/* Center: Page Size Selector */}
          <div className="flex items-center gap-2 text-xs text-[#5F6368]">
            <span className="hidden md:inline font-medium">Mỗi trang:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-[#F7F7F9] border border-[#E7E7EA] text-[#18181B] text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none cursor-pointer hover:border-[#8B9097] transition-colors"
            >
              <option value={6}>6 bài / trang</option>
              <option value={8}>8 bài / trang</option>
              <option value={12}>12 bài / trang</option>
              <option value={20}>20 bài / trang</option>
              <option value={50}>50 bài / trang</option>
            </select>
          </div>

          {/* Right: Page Navigation Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Prev Button */}
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 px-3 rounded-xl border border-[#E7E7EA] bg-white text-xs font-bold text-[#18181B] hover:bg-[#F7F7F9] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all active:scale-[0.98]"
            >
              <ChevronLeft size={14} />
              <span className="hidden sm:inline">Trước</span>
            </button>

            {/* Page numbers */}
            {pageNumbers.map((page, idx) => {
              if (page === '...') {
                return (
                  <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs text-[#8B9097] font-mono">
                    …
                  </span>
                );
              }
              const isCurrent = page === safeCurrentPage;
              return (
                <button
                  key={`page-${page}`}
                  type="button"
                  onClick={() => setCurrentPage(Number(page))}
                  className={`w-8 h-8 rounded-xl text-xs font-black font-mono transition-all active:scale-[0.98] ${
                    isCurrent
                      ? 'bg-[#B91B1C] text-white shadow-2xs'
                      : 'border border-[#E7E7EA] bg-white hover:bg-[#F7F7F9] text-[#18181B]'
                  }`}
                >
                  {page}
                </button>
              );
            })}

            {/* Next Button */}
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 px-3 rounded-xl border border-[#E7E7EA] bg-white text-xs font-bold text-[#18181B] hover:bg-[#F7F7F9] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all active:scale-[0.98]"
            >
              <span className="hidden sm:inline">Sau</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-[#8B9097] px-2">
        <span>
          Đang hiển thị <strong className="text-[#18181B]">{filteredLessons.length}</strong> / {totalCount} bài học video
        </span>
        <span>Hỗ trợ chuẩn giáo trình HSK 1.0, 2.0 và 3.0 (Cấp 1 - 9)</span>
      </div>
    </div>
  );
}
