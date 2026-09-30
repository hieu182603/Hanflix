import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  DollarSign,
  Users,
  ShoppingBag,
  Edit2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Save,
  X,
  RefreshCw,
  Search,
  Filter,
  RotateCcw
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAdminBillingPlans,
  patchAdminBillingPlan,
  resetAdminBillingPlans,
  getAdminBillingOrders,
  type PremiumPlan,
  type PaymentOrder,
  type AdminPatchPlanInput
} from '../../api/billing';

export default function AdminBillingManager() {
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<PremiumPlan | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; price: number; active: boolean }>({
    name: '',
    price: 0,
    active: true,
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [orderPage, setOrderPage] = useState<number>(1);

  // Lấy danh sách gói cước
  const plansQuery = useQuery({
    queryKey: ['admin', 'billing', 'plans'],
    queryFn: ({ signal }) => getAdminBillingPlans(signal),
    staleTime: 30000,
  });

  // Lấy danh sách đơn hàng
  const ordersQuery = useQuery({
    queryKey: ['admin', 'billing', 'orders', orderPage],
    queryFn: ({ signal }) => getAdminBillingOrders({ page: orderPage, limit: 15 }, signal),
    staleTime: 15000,
  });

  // Mutation khôi phục 3 gói mặc định
  const resetPlansMutation = useMutation({
    mutationFn: async () => resetAdminBillingPlans(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'billing', 'plans'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'plans'] });
    },
  });

  // Mutation cập nhật gói
  const updatePlanMutation = useMutation({
    mutationFn: async ({ code, data }: { code: string; data: AdminPatchPlanInput }) => {
      return patchAdminBillingPlan(code, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'billing', 'plans'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'plans'] });
      setEditingPlan(null);
      setEditError(null);
    },
    onError: (err: any) => {
      setEditError(err.message || 'Không thể cập nhật gói.');
    },
  });

  const handleOpenEdit = (plan: PremiumPlan) => {
    setEditingPlan(plan);
    setEditForm({
      name: plan.name,
      price: plan.price,
      active: plan.active !== false,
    });
    setEditError(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    updatePlanMutation.mutate({
      code: editingPlan.code,
      data: {
        name: editForm.name.trim(),
        price: Number(editForm.price),
        active: editForm.active,
        revision: editingPlan.revision ?? 1,
      },
    });
  };

  const handleQuickToggleActive = (plan: PremiumPlan) => {
    updatePlanMutation.mutate({
      code: plan.code,
      data: {
        active: !plan.active,
        revision: plan.revision ?? 1,
      },
    });
  };

  // Tính toán số liệu tổng quan
  const paidOrders = ordersQuery.data?.items?.filter((o: PaymentOrder) => o.status === 'PAID') || [];
  const totalRevenue = paidOrders.reduce((sum: number, o: PaymentOrder) => sum + o.amount, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header Studio */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#E7E7EA]">
        <div>
          <h2 className="text-2xl font-black text-[#18181B] tracking-tight flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-[#B91B1C]" />
            <span>Quản lý Gói & Doanh thu PayOS</span>
          </h2>
          <p className="text-xs text-[#5F6368] mt-1">
            Điều chỉnh giá gói linh hoạt, kiểm soát mở bán và theo dõi dòng tiền thanh toán trực tiếp từ PayOS.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            plansQuery.refetch();
            ordersQuery.refetch();
          }}
          className="px-3.5 py-2 rounded-xl bg-white border border-[#E7E7EA] hover:border-[#B91B1C] text-xs font-bold text-[#18181B] flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${plansQuery.isFetching ? 'animate-spin' : ''}`} />
          <span>Làm mới dữ liệu</span>
        </button>
      </div>

      {/* Thẻ chỉ số tổng quan (Top Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-[#E7E7EA] shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8B9097] uppercase tracking-wider">Doanh thu ghi nhận</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#18181B]">
            {totalRevenue.toLocaleString('vi-VN')} đ
          </div>
          <p className="text-[11px] text-[#5F6368]">Từ các đơn hàng thành công gần đây</p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-[#E7E7EA] shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8B9097] uppercase tracking-wider">Gói cước hoạt động</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#18181B]">
            {plansQuery.data?.items?.filter((p: PremiumPlan) => p.active !== false).length ?? 0} / {plansQuery.data?.items?.length ?? 0}
          </div>
          <p className="text-[11px] text-[#5F6368]">Đang được mở bán công khai cho học viên</p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-[#E7E7EA] shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8B9097] uppercase tracking-wider">Tổng đơn hàng PayOS</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#18181B]">
            {ordersQuery.data?.total ?? 0} đơn
          </div>
          <p className="text-[11px] text-[#5F6368]">Bao gồm đơn thành công, chờ và đã hủy</p>
        </div>
      </div>

      <p className="text-sm text-[#5F6368]">Cấp gói thủ công tại <Link to="/admin/users" className="font-bold text-[#B91B1C] underline">Quản lý người dùng</Link> → mở chi tiết học viên → Kích hoạt gói Premium.</p>
      {(plansQuery.isError || ordersQuery.isError || resetPlansMutation.isError || (editError && !editingPlan)) && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {editError || (resetPlansMutation.error instanceof Error ? resetPlansMutation.error.message : 'Chưa tải được dữ liệu thanh toán. Vui lòng thử lại.')}
          <button type="button" className="ml-3 underline" onClick={() => { setEditError(null); void plansQuery.refetch(); void ordersQuery.refetch(); }}>Tải lại</button>
        </div>
      )}
      {/* Bảng Quản lý Giá Gói (Plan Management) */}
      <div className="bg-white rounded-3xl border border-[#E7E7EA] shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-[#E7E7EA] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-base text-[#18181B]">Cấu hình Gói đăng ký (Plans)</h3>
            <p className="text-xs text-[#5F6368]">Thay đổi giá gói sẽ có hiệu lực ngay lập tức cho các lượt mua tiếp theo.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Khôi phục 3 gói mặc định (1 Tháng: 99.000đ, 3 Tháng: 249.000đ, 1 Năm: 699.000đ)?')) {
                resetPlansMutation.mutate();
              }
            }}
            disabled={resetPlansMutation.isPending}
            className="px-3.5 py-1.5 rounded-xl bg-[#F7F7F9] hover:bg-[#FDF1F1] text-xs font-bold text-[#5F6368] hover:text-[#B91B1C] border border-[#E7E7EA] hover:border-[#B91B1C]/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Đồng bộ hoặc khôi phục lại 3 gói cước chuẩn ban đầu"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetPlansMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{resetPlansMutation.isPending ? 'Đang thiết lập...' : 'Khôi phục giá mặc định'}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E7E7EA] bg-[#F7F7F9] text-[#8B9097] font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Mã gói</th>
                <th className="py-3 px-4">Tên hiển thị</th>
                <th className="py-3 px-4">Thời hạn</th>
                <th className="py-3 px-4">Giá bán (VNĐ)</th>
                <th className="py-3 px-4">Trạng thái bán</th>
                <th className="py-3 px-4">Ngày sửa</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E7EA]">
              {plansQuery.isLoading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[#5F6368]">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#B91B1C]" />
                      <span>Đang tải danh sách gói cước...</span>
                    </div>
                  </td>
                </tr>
              )}
              {plansQuery.isError && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-rose-600 space-y-2">
                    <p>Không thể kết nối hoặc tải danh sách gói cước.</p>
                    <button
                      type="button"
                      onClick={() => resetPlansMutation.mutate()}
                      className="px-3 py-1.5 rounded-xl bg-[#B91B1C] text-white font-bold text-xs hover:bg-[#991516] transition-colors cursor-pointer"
                    >
                      Khởi tạo ngay 3 gói mặc định
                    </button>
                  </td>
                </tr>
              )}
              {!plansQuery.isLoading && !plansQuery.isError && (!plansQuery.data?.items || plansQuery.data.items.length === 0) && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[#5F6368]">
                    <div className="space-y-3 max-w-sm mx-auto">
                      <p>Chưa có gói cước nào trong cơ sở dữ liệu.</p>
                      <button
                        type="button"
                        onClick={() => resetPlansMutation.mutate()}
                        disabled={resetPlansMutation.isPending}
                        className="px-4 py-2 rounded-xl bg-[#B91B1C] text-white font-bold text-xs hover:bg-[#991516] transition-colors inline-flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${resetPlansMutation.isPending ? 'animate-spin' : ''}`} />
                        <span>Khởi tạo 3 gói mặc định (1 Tháng, 3 Tháng, 1 Năm)</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {plansQuery.data?.items?.map((plan: PremiumPlan) => (
                <tr key={plan.code} className="hover:bg-[#FDF1F1]/30 transition-colors">
                  <td className="py-4 px-4 font-mono font-bold text-[#18181B]">
                    {plan.code}
                  </td>
                  <td className="py-4 px-4 font-bold text-[#18181B]">
                    {plan.name}
                    {plan.code === 'quarterly' && (
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                        Nổi bật
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 font-semibold text-[#5F6368]">
                    {plan.durationMonths} tháng
                  </td>
                  <td className="py-4 px-4 font-black text-sm text-[#B91B1C]">
                    {plan.price.toLocaleString('vi-VN')} đ
                  </td>
                  <td className="py-4 px-4">
                    <button
                      type="button"
                      onClick={() => handleQuickToggleActive(plan)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
                        plan.active !== false
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${plan.active !== false ? 'bg-emerald-600' : 'bg-neutral-400'}`} />
                      <span>{plan.active !== false ? 'ĐANG MỞ BÁN' : 'TẠM TẮT'}</span>
                    </button>
                  </td>
                  <td className="py-4 px-4 text-[#5F6368] font-medium text-xs whitespace-nowrap">
                    {plan.updatedAt ? (
                      <span>{new Date(plan.updatedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    ) : (
                      <span className="text-[#8B9097] italic">Gốc</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(plan)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-[#E7E7EA] hover:border-[#B91B1C] text-xs font-bold text-[#18181B] hover:text-[#B91B1C] transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Sửa giá</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bảng Đơn Hàng Gần Đây (Recent Orders Table) */}
      <div className="bg-white rounded-3xl border border-[#E7E7EA] shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-[#E7E7EA] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-base text-[#18181B]">Lịch sử Giao dịch PayOS</h3>
            <p className="text-xs text-[#5F6368]">Danh sách giao dịch nạp tiền và nâng cấp của học viên.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E7E7EA] bg-[#F7F7F9] text-[#8B9097] font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Mã đơn</th>
                <th className="py-3 px-4">User ID</th>
                <th className="py-3 px-4">Gói đăng ký</th>
                <th className="py-3 px-4">Số tiền</th>
                <th className="py-3 px-4">Ngày tạo</th>
                <th className="py-3 px-4">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E7EA]">
              {ordersQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[#5F6368]">
                    Đang tải đơn hàng...
                  </td>
                </tr>
              )}
              {!ordersQuery.isLoading && !ordersQuery.isError && (!ordersQuery.data?.items || ordersQuery.data.items.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[#5F6368]">
                    Chưa có giao dịch nào được ghi nhận.
                  </td>
                </tr>
              )}
              {ordersQuery.data?.items?.map((order: PaymentOrder) => (
                <tr key={order.orderCode} className="hover:bg-[#FDF1F1]/30 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-[#18181B]">
                    #{order.orderCode}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[#5F6368]">
                    {order.userId ? <Link to={`/admin/users/${order.userId}`} className="underline" title="Mở chi tiết người dùng">{String(order.userId).slice(-8)}</Link> : '-'}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-[#18181B]">
                    {order.planName} ({order.durationMonths}T)
                  </td>
                  <td className="py-3.5 px-4 font-black text-xs text-[#B91B1C]">
                    {order.amount.toLocaleString('vi-VN')} đ
                  </td>
                  <td className="py-3.5 px-4 text-[#5F6368]">
                    {new Date(order.createdAt).toLocaleString('vi-VN')}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        order.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : order.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : order.status === 'CANCELLED'
                          ? 'bg-neutral-100 text-neutral-600'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        <div className="p-4 border-t border-[#E7E7EA] flex items-center justify-between text-xs text-[#5F6368]">
          <span>
            Trang {orderPage} / {Math.max(1, Math.ceil((ordersQuery.data?.total ?? 0) / 15))}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={orderPage <= 1}
              onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-xl border border-[#E7E7EA] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 font-bold"
            >
              Trước
            </button>
            <button
              type="button"
              disabled={orderPage >= Math.ceil((ordersQuery.data?.total ?? 0) / 15)}
              onClick={() => setOrderPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-xl border border-[#E7E7EA] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 font-bold"
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      {/* Modal Chỉnh sửa Gói Cước */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E7E7EA] overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E7EA]">
              <h3 className="font-extrabold text-base text-[#18181B]">
                Chỉnh sửa Gói: {editingPlan.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#5F6368] hover:text-[#18181B] hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#18181B] block">
                  Tên hiển thị gói
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E7E7EA] text-sm focus:outline-hidden focus:border-[#B91B1C] transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#18181B] block">
                  Giá bán (VNĐ)
                </label>
                <input
                  type="number"
                  required
                  min={2000}
                  max={50000000}
                  step={1000}
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })}
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E7E7EA] text-sm font-bold text-[#B91B1C] focus:outline-hidden focus:border-[#B91B1C] transition-colors"
                />
                <span className="text-[11px] text-[#8B9097] block">
                  Thời hạn gói: {editingPlan.durationMonths} tháng
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-[#E7E7EA]">
                <label className="text-xs font-bold text-[#18181B]">
                  Trạng thái mở bán
                </label>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, active: !editForm.active })}
                  className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-colors cursor-pointer ${
                    editForm.active ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {editForm.active ? 'Đang mở bán' : 'Tạm ẩn gói'}
                </button>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-4 py-2 rounded-xl border border-[#E7E7EA] text-xs font-bold text-[#5F6368] hover:bg-neutral-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={updatePlanMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{updatePlanMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
