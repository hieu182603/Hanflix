import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const DEFAULT_ADMIN_PAGE_SIZE = 8;
export const ADMIN_PAGE_SIZE_OPTIONS = [6, 8, 12, 20, 50] as const;

export function buildAdminPageNumbers(totalPages: number, currentPage: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | 'ellipsis')[] = [1];
  if (currentPage > 3) pages.push('ellipsis');
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (currentPage < totalPages - 2) pages.push('ellipsis');
  pages.push(totalPages);
  return pages;
}

export type AdminPaginationBarProps = {
  total: number;
  page: number;
  pageSize: number;
  unitLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  disabled?: boolean;
  pageSizeOptions?: readonly number[];
  ariaLabel?: string;
  className?: string;
  /** Số mục thực tế trên trang hiện tại (server-side). Mặc định: suy ra từ page/pageSize. */
  visibleCount?: number;
};

export default function AdminPaginationBar({
  total,
  page,
  pageSize,
  unitLabel,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  pageSizeOptions = ADMIN_PAGE_SIZE_OPTIONS,
  ariaLabel = 'Phân trang',
  className = '',
  visibleCount,
}: AdminPaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = total === 0 ? 0 : (safePage - 1) * pageSize;
  const endIndex = visibleCount != null
    ? startIndex + visibleCount
    : Math.min(startIndex + pageSize, total);

  const pageNumbers = useMemo(
    () => buildAdminPageNumbers(totalPages, safePage),
    [totalPages, safePage],
  );

  if (total <= 0) return null;

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-[#F2E4D8] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 shadow-2xs ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-[#8B9097]">
          Hiển thị{' '}
          <span className="font-mono font-bold tabular-nums text-[#18181B]">
            {total === 0 ? 0 : startIndex + 1}-{endIndex}
          </span>
          {' / '}
          <span className="font-mono font-bold tabular-nums text-[#18181B]">{total}</span>
          {' '}
          {unitLabel}
        </p>

        <select
          value={pageSize}
          disabled={disabled}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          aria-label="Số mục mỗi trang"
          className="h-8 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-2.5 text-xs font-semibold text-[#18181B] outline-none transition-colors hover:border-[#D1C3B7] focus:border-[#B91B1C] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} / trang
            </option>
          ))}
        </select>
      </div>

      <nav className="flex items-center gap-1" aria-label={ariaLabel}>
        <button
          type="button"
          disabled={disabled || safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-[#5F6368] transition-colors hover:bg-[#FDF1F1] hover:text-[#B91B1C] disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
          aria-label="Trang trước"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>

        {pageNumbers.map((pageNum, idx) => {
          if (pageNum === 'ellipsis') {
            return (
              <span key={`ellipsis-${idx}`} className="w-7 text-center text-xs text-[#A1A1AA]">
                …
              </span>
            );
          }
          const isCurrent = pageNum === safePage;
          return (
            <button
              key={`page-${pageNum}`}
              type="button"
              disabled={disabled}
              onClick={() => onPageChange(pageNum)}
              aria-current={isCurrent ? 'page' : undefined}
              className={`h-8 min-w-[2rem] rounded-xl px-2 font-mono text-xs tabular-nums transition-all disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${
                isCurrent
                  ? 'bg-[#B91B1C] font-extrabold text-white shadow-xs'
                  : 'text-[#5F6368] hover:bg-[#FDF1F1] hover:text-[#B91B1C]'
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          type="button"
          disabled={disabled || safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-[#5F6368] transition-colors hover:bg-[#FDF1F1] hover:text-[#B91B1C] disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
          aria-label="Trang sau"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </nav>
    </div>
  );
}
