import { useI18n } from '../../i18n';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Clock,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Crown,
  Search,
  HelpCircle,
  CheckCircle2,
  FileText,
  CreditCard,
  Zap,
} from 'lucide-react';
import { getUserOrders, getUserSubscription, type PaymentOrder, type OrderStatusFilter } from '../../api/billing';

interface PaymentHistoryPageProps {
  currentUser?: {
    name?: string;
    email?: string;
    role?: string;
    premiumExpiresAt?: Date | string | null;
  } | null;
}

const STATUS_CONFIG: Record<
  PaymentOrder['status'],
  { label: string; text: string; bg: string; border: string; dot: string }
> = {
  PAID: {
    label: 'Đã thanh toán',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50/80',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  PENDING: {
    label: 'Chờ thanh toán',
    text: 'text-amber-700',
    bg: 'bg-amber-50/80',
    border: 'border-amber-200',
    dot: 'bg-amber-500 animate-pulse',
  },
  CREATING: {
    label: 'Đang tạo đơn',
    text: 'text-blue-700',
    bg: 'bg-blue-50/80',
    border: 'border-blue-200',
    dot: 'bg-blue-500 animate-pulse',
  },
  PROCESSING: {
    label: 'Đang xử lý',
    text: 'text-blue-700',
    bg: 'bg-blue-50/80',
    border: 'border-blue-200',
    dot: 'bg-blue-500 animate-pulse',
  },
  UNDERPAID: {
    label: 'Chưa đủ tiền',
    text: 'text-orange-700',
    bg: 'bg-orange-50/80',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
  },
  CANCELLED: {
    label: 'Đã hủy',
    text: 'text-neutral-600',
    bg: 'bg-neutral-100/80',
    border: 'border-neutral-200',
    dot: 'bg-neutral-400',
  },
  EXPIRED: {
    label: 'Hết hạn',
    text: 'text-neutral-500',
    bg: 'bg-neutral-100/80',
    border: 'border-neutral-200',
    dot: 'bg-neutral-400',
  },
  FAILED: {
    label: 'Thất bại',
    text: 'text-rose-700',
    bg: 'bg-rose-50/80',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
};

export default function PaymentHistoryPage({ currentUser }: PaymentHistoryPageProps) {
  const { tr, ui, locale } = useI18n();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<number | null>(null);

  // Lấy dữ liệu gói cước của người dùng
  const subscriptionQuery = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: ({ signal }) => getUserSubscription(signal),
    staleTime: 30000,
  });

  // Lấy danh sách lịch sử đơn hàng
  const ordersQuery = useQuery({
    queryKey: ['billing', 'orders', page, statusFilter, searchQuery.trim()],
    queryFn: ({ signal }) => getUserOrders({ page, limit: 12, status: statusFilter, search: searchQuery.trim() }, signal),
    staleTime: 15000,
  });

  const isUserPremium =
    currentUser?.role === 'admin' ||
    (subscriptionQuery.data
      ? subscriptionQuery.data.tier === 'premium'
      : Boolean(currentUser?.premiumExpiresAt && new Date(currentUser.premiumExpiresAt) > new Date()));

  const expiresDate =
    subscriptionQuery.data?.premiumExpiresAt ?? currentUser?.premiumExpiresAt;

  const handleCopy = (orderCode: number) => {
    navigator.clipboard.writeText(String(orderCode));
    setCopiedCode(orderCode);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredOrders = ordersQuery.data?.items ?? [];
  const summary = ordersQuery.data?.summary;
  const totalPaidOrders = summary?.paidOrders ?? 0;
  const pendingOrders = summary?.pendingOrders ?? 0;
  const totalSpent = summary?.totalSpent ?? 0;

  const changeStatus = (status: OrderStatusFilter) => {
    setStatusFilter(status);
    setPage(1);
  };
  const changeSearch = (search: string) => {
    setSearchQuery(search);
    setPage(1);
  };

  return (
    <div className="w-full space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ===============================================================
          TOP BREADCRUMB & HEADER BANNER (FULL WIDTH EXPANSIVE)
      =============================================================== */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-[#D8CFBF] shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="space-y-2">

          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF2EE] border border-[#F2D0C7] flex items-center justify-center text-[#B91B1C] shrink-0">
              <span className="material-symbols-outlined text-[26px] leading-none select-none">
                receipt_long
              </span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#18181B] tracking-tight">{tr("Lịch sử thanh toán & Đơn hàng")}</h1>
              <p className="text-xs sm:text-sm text-[#5F6368] mt-0.5">{tr("Quản lý các giao dịch đăng ký gói, kiểm tra hóa đơn điện tử và đối soát thanh toán PayOS")}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => void ordersQuery.refetch()}
            disabled={ordersQuery.isFetching}
            className="px-4 py-2.5 rounded-xl bg-white border border-[#D8CFBF] hover:border-[#18181B] text-xs font-bold text-[#5F6368] hover:text-[#18181B] flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            title={tr("Làm mới danh sách")}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${ordersQuery.isFetching ? 'animate-spin' : ''}`} />
            <span>{tr("Làm mới")}</span>
          </button>

          <Link
            to="/premium"
            className="px-5 py-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold flex items-center gap-2 transition-all shadow-sm hover:shadow cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{tr("Nâng cấp / Gia hạn gói")}</span>
          </Link>
        </div>
      </div>

      {/* ===============================================================
          4-COLUMN EXPANSIVE BENTO OVERVIEW CARDS
      =============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Gói hiện tại */}
        <div className="p-5 rounded-3xl bg-white border border-[#D8CFBF] shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8B9097] uppercase tracking-wider">{tr("Tài khoản hiện tại")}</span>
            <div
              className={`p-2 rounded-xl ${
                isUserPremium ? 'bg-amber-50 text-amber-600' : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              <Crown className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-[#18181B]">
                {isUserPremium ? tr("HanFlix Premium") : tr("Gói Miễn phí")}
              </span>
              {isUserPremium && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-black text-[10px] tracking-wider uppercase">
                  VIP
                </span>
              )}
            </div>
            <p className="text-xs text-[#5F6368] mt-1.5 line-clamp-1">
              {isUserPremium
                ? tr("Hạn dùng: {0}", { 0: expiresDate ? new Date(expiresDate).toLocaleDateString(locale) : tr('Vô thời hạn') })
                : tr("Mở khóa toàn bộ video, phụ đề & AI")}
            </p>
          </div>
        </div>

        {/* Card 2: Đơn đã thanh toán */}
        <div className="p-5 rounded-3xl bg-white border border-[#D8CFBF] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8B9097] uppercase tracking-wider">{tr("Giao dịch thành công")}</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Check className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xl font-black text-[#18181B]">
              {ordersQuery.isLoading ? '...' : tr("{0} đơn hàng", { 0: totalPaidOrders })}
            </div>
            <p className="text-xs text-[#5F6368] mt-1.5">{tr("Đã kích hoạt quyền lợi học tập")}</p>
          </div>
        </div>

        {/* Card 3: Tổng chi tiêu tích lũy */}
        <div className="p-5 rounded-3xl bg-white border border-[#D8CFBF] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8B9097] uppercase tracking-wider">{tr("Tổng chi tiêu")}</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xl font-black text-[#18181B]">
              {ordersQuery.isLoading ? '...' : tr("{0} đ", { 0: totalSpent.toLocaleString(locale) })}
            </div>
            <p className="text-xs text-[#5F6368] mt-1.5">
              {pendingOrders > 0 ? tr("{0} đơn đang chờ xử lý", { 0: pendingOrders }) : tr("Tất cả đơn đã được đồng bộ")}
            </p>
          </div>
        </div>

        {/* Card 4: Phương thức VietQR */}
        <div className="p-5 rounded-3xl bg-white border border-[#D8CFBF] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8B9097] uppercase tracking-wider">{tr("Cổng thanh toán")}</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xl font-black text-[#18181B]">
              PayOS VietQR
            </div>
            <p className="text-xs text-[#5F6368] mt-1.5">{tr("Bảo mật Napas247 & kích hoạt tự động")}</p>
          </div>
        </div>
      </div>

      {/* ===============================================================
          MAIN 12-COLUMN LAYOUT: TABLE (COL 9) + HELPER SIDEBAR (COL 3)
      =============================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT MAIN AREA (COL 9) ================= */}
        <div className="xl:col-span-9 space-y-4">
          {/* SEARCH & FILTER CONTROLS */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-2xl border border-[#D8CFBF] shadow-xs">
            {/* Filter Pills */}
            <div className="inline-flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => changeStatus('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  statusFilter === 'ALL'
                    ? 'bg-[#B91B1C] text-white shadow-xs'
                    : 'text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9]'
                }`}
              >{tr("Tất cả (")}{summary?.totalOrders ?? 0})
              </button>

              <button
                type="button"
                onClick={() => changeStatus('PAID')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  statusFilter === 'PAID'
                    ? 'bg-[#B91B1C] text-white shadow-xs'
                    : 'text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9]'
                }`}
              >{tr("Đã thanh toán (")}{totalPaidOrders})
              </button>

              <button
                type="button"
                onClick={() => changeStatus('PENDING')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  statusFilter === 'PENDING'
                    ? 'bg-[#B91B1C] text-white shadow-xs'
                    : 'text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9]'
                }`}
              >{tr("Chờ thanh toán (")}{pendingOrders})
              </button>

              <button
                type="button"
                onClick={() => changeStatus('OTHER')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  statusFilter === 'OTHER'
                    ? 'bg-[#B91B1C] text-white shadow-xs'
                    : 'text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9]'
                }`}
              >{tr("Khác (")}{summary?.otherOrders ?? 0})
              </button>
            </div>

            {/* Quick Search Box */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-3.5 h-3.5 text-[#8B9097] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                maxLength={100}
                onChange={(e) => changeSearch(e.target.value)}
                placeholder={tr("Tìm mã đơn hoặc gói...")}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[#F6F4EE] border border-[#D8CFBF]/70 focus:border-[#B91B1C] focus:bg-white transition-all text-[#18181B] outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => changeSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8B9097] hover:text-[#18181B]"
                >×</button>
              )}
            </div>
          </div>

          {/* TABLE CONTAINER */}
          <div className="rounded-3xl bg-white border border-[#D8CFBF] shadow-xs overflow-hidden">
            {ordersQuery.isLoading && (
              <div className="py-20 text-center space-y-3">
                <RefreshCw className="w-7 h-7 text-[#B91B1C] animate-spin mx-auto" />
                <p className="text-xs font-semibold text-[#5F6368]">{tr("Đang tải dữ liệu đơn hàng...")}</p>
              </div>
            )}

            {ordersQuery.isError && (
              <div className="p-10 text-center space-y-3">
                <AlertCircle className="w-9 h-9 text-rose-500 mx-auto" />
                <p className="text-sm font-bold text-[#18181B]">{tr("Không thể tải lịch sử thanh toán")}</p>
                <p className="text-xs text-[#5F6368]">{tr("Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.")}</p>
                <button
                  type="button"
                  onClick={() => void ordersQuery.refetch()}
                  className="px-4 py-2 rounded-xl bg-[#18181B] text-white text-xs font-bold hover:bg-neutral-800 transition-colors"
                >{tr("Thử lại")}</button>
              </div>
            )}

            {!ordersQuery.isLoading && !ordersQuery.isError && filteredOrders.length === 0 && (
              <div className="py-20 px-4 text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-[#FFF9F5] border border-[#F2D0C7] flex items-center justify-center text-[#B91B1C] mx-auto">
                  <span className="material-symbols-outlined text-[32px] leading-none select-none">
                    receipt_long
                  </span>
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-base font-bold text-[#18181B]">
                    {searchQuery
                      ? tr("Không tìm thấy đơn hàng nào khớp với từ khóa")
                      : statusFilter === 'ALL'
                      ? tr("Bạn chưa có giao dịch nào")
                      : tr("Không tìm thấy giao dịch với bộ lọc này")}
                  </h3>
                  <p className="text-xs text-[#5F6368] leading-relaxed">{tr("Khi bạn đăng ký các gói học Premium qua PayOS, toàn bộ thông tin đơn hàng và hóa đơn điện tử sẽ hiển thị tại đây.")}</p>
                </div>
                {statusFilter === 'ALL' && !searchQuery && (
                  <Link
                    to="/premium"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{tr("Khám phá các gói học ngay")}</span>
                  </Link>
                )}
              </div>
            )}

            {!ordersQuery.isLoading && !ordersQuery.isError && filteredOrders.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#F2ECE2] border-b border-[#D8CFBF] text-[#716A62] font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3.5 px-5 sm:px-6">{tr("Mã đơn hàng")}</th>
                      <th className="py-3.5 px-4">{tr("Gói học")}</th>
                      <th className="py-3.5 px-4">{tr("Số tiền")}</th>
                      <th className="py-3.5 px-4">{tr("Thời gian")}</th>
                      <th className="py-3.5 px-4">{tr("Trạng thái")}</th>
                      <th className="py-3.5 px-5 sm:px-6 text-right">{tr("Thao tác")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE3D8]">
                    {filteredOrders.map((ord) => {
                      const statusInfo = STATUS_CONFIG[ord.status] ?? {
                        label: ord.status,
                        text: 'text-neutral-700',
                        bg: 'bg-neutral-100',
                        border: 'border-neutral-200',
                        dot: 'bg-neutral-400',
                      };

                      return (
                        <tr
                          key={ord.orderCode}
                          className="hover:bg-[#FFFDFB] transition-colors group"
                        >
                          {/* Mã đơn */}
                          <td className="py-4 px-5 sm:px-6 font-mono">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#18181B] text-[13px]">
                                #{ord.orderCode}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(ord.orderCode)}
                                className="p-1 rounded-md text-[#8B9097] hover:text-[#18181B] hover:bg-neutral-100 transition-colors cursor-pointer"
                                title={tr("Sao chép mã đơn")}
                              >
                                {copiedCode === ord.orderCode ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Gói học */}
                          <td className="py-4 px-4">
                            <div className="font-bold text-[#18181B] text-xs">
                              {ord.planName}
                            </div>
                            <div className="text-[11px] text-[#8B9097] mt-0.5">{tr("Thời hạn:")} {ord.durationMonths} {tr("tháng")}</div>
                          </td>

                          {/* Số tiền */}
                          <td className="py-4 px-4">
                            <span className="font-black text-[#18181B] text-sm">
                              {ord.amount.toLocaleString(locale)}
                            </span>
                            <span className="text-[11px] text-[#8B9097] ml-1">{tr("đ")}</span>
                          </td>

                          {/* Thời gian */}
                          <td className="py-4 px-4">
                            <div className="text-[#18181B] font-medium">
                              {new Date(ord.createdAt).toLocaleDateString(locale)}
                            </div>
                            <div className="text-[11px] text-[#8B9097] mt-0.5">
                              {new Date(ord.createdAt).toLocaleTimeString(locale, {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>

                          {/* Trạng thái */}
                          <td className="py-4 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                              <span>{ui(statusInfo.label)}</span>
                            </span>
                          </td>

                          {/* Thao tác */}
                          <td className="py-4 px-5 sm:px-6 text-right">
                            {ord.status === 'PENDING' || ord.status === 'CREATING' ? (
                              <Link
                                to={`/premium/payment?orderCode=${ord.orderCode}`}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all shadow-xs"
                              >
                                <span>{tr("Thanh toán ngay")}</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Link>
                            ) : (
                              <Link
                                to={`/premium/payment?orderCode=${ord.orderCode}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#5F6368] hover:text-[#18181B] hover:bg-neutral-100 transition-colors"
                              >
                                <span>{tr("Xem chi tiết")}</span>
                                <ExternalLink className="w-3.5 h-3.5 text-[#8B9097]" />
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Phân trang */}
            {ordersQuery.data && ordersQuery.data.total > 12 && (
              <div className="p-4 border-t border-[#D8CFBF] flex items-center justify-between bg-[#F7F4EE] text-xs">
                <button
                  type="button"
                  disabled={page === 1 || ordersQuery.isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-[#D8CFBF] hover:border-[#18181B] font-bold text-[#18181B] disabled:opacity-40 transition-colors cursor-pointer"
                >{tr("Trang trước")}</button>
                <span className="text-[#5F6368] font-medium">
                  {tr("Trang")} <strong className="text-[#18181B]">{page}</strong> /{' '}
                  {Math.ceil(ordersQuery.data.total / 12)}
                </span>
                <button
                  type="button"
                  disabled={page * 12 >= ordersQuery.data.total || ordersQuery.isFetching}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-[#D8CFBF] hover:border-[#18181B] font-bold text-[#18181B] disabled:opacity-40 transition-colors cursor-pointer"
                >{tr("Trang sau")}</button>
              </div>
            )}
          </div>
        </div>

        {/* ================= RIGHT SIDEBAR HELPER (COL 3) ================= */}
        <div className="xl:col-span-3 space-y-4">
          {/* Card: Quyền lợi Premium */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-[#FFF7F2] to-white border border-[#E8BFB4] shadow-xs space-y-3.5">
            <div className="flex items-center gap-2 text-[#B91B1C]">
              <Sparkles className="w-4 h-4" />
              <h3 className="font-extrabold text-sm text-[#18181B]">{tr("Đặc quyền HanFlix VIP")}</h3>
            </div>
            <ul className="space-y-2.5 text-xs text-[#5F6368]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{tr("Mở khóa 100% kho video thực tế, phụ đề song ngữ")}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{tr("Trợ lý AI phân tích ngữ pháp & hội thoại theo ngữ cảnh")}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{tr("Luyện thi và mô phỏng đề thi HSK 机考 trực tuyến")}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{tr("Cộng dồn thời hạn tự động khi bạn mua thêm gói")}</span>
              </li>
            </ul>

            <Link
              to="/premium"
              className="block w-full text-center py-2.5 px-4 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all shadow-xs"
            >{tr("Nâng cấp gói ngay")}</Link>
          </div>


        </div>
      </div>
    </div>
  );
}
