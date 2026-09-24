import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useNotification } from '../notifications';
import { Spinner } from '../notifications';
import {
  Users,
  Shield,
  Search,
  Filter,
  Lock,
  Unlock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  Copy,
  Check,
  GraduationCap,
  Calendar,
  UserCheck,
  UserX,
  Mail,
  MoreHorizontal,
} from 'lucide-react';
import { listAdminUsers, setAdminUserStatus, type AdminUser } from '../../api/admin';
import AdminPaginationBar, { DEFAULT_ADMIN_PAGE_SIZE } from './AdminPaginationBar';

const HSK_LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

const HSK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '1': { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  '2': { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  '3': { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  '4': { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  '5': { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  '6': { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  '7': { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
  '8': { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
  '9': { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
};

function getInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-[#B91B1C] text-white',
  'bg-[#188A5A] text-white',
  'bg-[#B45309] text-white',
  'bg-[#8F1719] text-white',
  'bg-[#2F6E62] text-white',
  'bg-[#78350F] text-white',
  'bg-[#2B2826] text-white',
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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

export default function AdminUserManager({ userId: propUserId }: { userId?: string } = {}) {
  const params = useParams<{ userId?: string }>();
  const activeUserId = propUserId || params.userId || '';
  const navigate = useNavigate();
  const notify = useNotification();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked'>('all');
  const [hskFilter, setHskFilter] = useState<string>('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ADMIN_PAGE_SIZE);

  // Selected User Detail Modal
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchUsers = async (query?: string) => {
    setLoading(true);
    try {
      const items = await listAdminUsers(query);
      setUsers(items);
    } catch (err: any) {
      console.error(err);
      showMsg('error', err?.message || 'Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Sync route param with selectedUser
  useEffect(() => {
    if (!activeUserId) {
      setSelectedUser(null);
      return;
    }
    const found = users.find((u) => u._id === activeUserId);
    if (found) {
      setSelectedUser(found);
    }
  }, [activeUserId, users]);

  const handleCloseModal = () => {
    setSelectedUser(null);
    navigate('/admin/users');
  };

  const showMsg = (type: 'success' | 'error', text: string) => {
    notify.toast(type, text);
  };

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleToggleStatus = async (user: AdminUser) => {
    if (user.role === 'admin') {
      showMsg('error', 'Không thể khóa tài khoản quản trị viên.');
      return;
    }

    const nextStatus = user.status === 'active' ? 'locked' : 'active';
    const actionName = nextStatus === 'locked' ? 'khóa' : 'mở khóa';

    if (!await notify.confirm({
      title: `${actionName.charAt(0).toUpperCase() + actionName.slice(1)} tài khoản`,
      message: `Bạn có chắc chắn muốn ${actionName} tài khoản "${user.name}" (${user.email})?`,
      confirmText: actionName.charAt(0).toUpperCase() + actionName.slice(1),
      tone: nextStatus === 'locked' ? 'danger' : 'default',
    })) {
      return;
    }

    setActionBusy(true);
    try {
      await setAdminUserStatus(user._id, nextStatus);
      setUsers((prev) => prev.map((u) => (u._id === user._id ? { ...u, status: nextStatus } : u)));
      if (selectedUser && selectedUser._id === user._id) {
        setSelectedUser({ ...selectedUser, status: nextStatus });
      }
      showMsg('success', `Đã ${actionName} tài khoản thành công.`);
    } catch (err: any) {
      showMsg('error', err?.message || `Không thể ${actionName} tài khoản`);
    } finally {
      setActionBusy(false);
    }
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Role filter
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      // Status filter
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      // HSK Level filter
      if (hskFilter && String(u.learningProfile?.currentHsk) !== hskFilter) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = u.name?.toLowerCase().includes(q);
        const matchesEmail = u.email?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail) return false;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, hskFilter, searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, roleFilter, statusFilter, hskFilter, pageSize]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const currentUsers = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, safePage, pageSize]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === 'active').length;
    const locked = users.filter((u) => u.status === 'locked').length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const hskCounts: Record<string, number> = {};
    HSK_LEVELS.forEach((lvl) => {
      hskCounts[lvl] = users.filter((u) => String(u.learningProfile?.currentHsk) === lvl).length;
    });
    return { total, active, locked, admins, hskCounts };
  }, [users]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="relative overflow-hidden rounded-3xl border border-[#F2E4D8] bg-white p-6 shadow-2xs">
        <div className="pointer-events-none absolute -right-6 -bottom-8 select-none font-serif text-8xl font-black text-[#B91B1C]/5">
          生
        </div>
        <div className="relative z-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FDF1F1] text-[#B91B1C] shadow-2xs ring-1 ring-[#B91B1C]/20">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-[#2B2826]">Quản Lý Người Dùng & Học Viên</h1>
                <span className="rounded-full border border-[#F9D2D2] bg-[#FDF1F1] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#B91B1C]">
                  User Directory
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#8C827A]">
                Theo dõi danh sách học viên, phân bổ trình độ HSK 1 đến 9, mục tiêu học tập và kiểm soát trạng thái tài khoản.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <button
              onClick={() => fetchUsers()}
              disabled={loading}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-4 text-xs font-bold text-[#2B2826] shadow-2xs transition-all hover:border-[#B91B1C]/30 hover:bg-white disabled:opacity-40 active:scale-[0.98]"
            >
              <RefreshCw className={`h-4 w-4 text-[#8C827A] ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới danh sách</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bento Stats Row */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {/* Total Users */}
        <div className="space-y-1.5 rounded-3xl border border-[#F2E4D8] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8C827A]">Tổng Học Viên</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#FFF9F5] text-[#8C827A] border border-[#F2E4D8]">
              <Users className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#2B2826]">{stats.total.toLocaleString()}</div>
          <div className="text-[11px] text-[#8C827A]">Tài khoản đã đăng ký trên hệ thống</div>
        </div>

        {/* Active Accounts */}
        <div className="space-y-1.5 rounded-3xl border border-[#C6E7DA] bg-[#EAF5F1]/30 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#188A5A]">Tài Khoản Hoạt Động</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#EAF5F1] text-[#188A5A] border border-[#C6E7DA]">
              <UserCheck className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#2B2826]">{stats.active.toLocaleString()}</div>
          <div className="text-[11px] font-bold text-[#188A5A]">
            {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% trên tổng người dùng
          </div>
        </div>

        {/* Locked Accounts */}
        <div className="space-y-1.5 rounded-3xl border border-[#F9D2D2] bg-[#FDF1F1]/30 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#B91B1C]">Tài Khoản Bị Khóa</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#FDF1F1] text-[#B91B1C] border border-[#F9D2D2]">
              <UserX className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#2B2826]">{stats.locked.toLocaleString()}</div>
          <div className="text-[11px] text-[#8C827A]">Tạm khóa hoặc vi phạm chính sách</div>
        </div>

        {/* Admins */}
        <div className="space-y-1.5 rounded-3xl border border-[#FDE6BA] bg-[#FFF8EC]/40 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#B45309]">Quản Trị Viên</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#FFF8EC] text-[#B45309] border border-[#FDE6BA]">
              <Shield className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#2B2826]">{stats.admins.toLocaleString()}</div>
          <div className="text-[11px] text-[#8C827A]">Tài khoản có quyền quản trị hệ thống</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 rounded-2xl border border-[#F2E4D8] bg-white p-3 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 min-w-0 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C827A]" />
          <input
            type="text"
            placeholder="Tìm theo tên học viên, email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="h-10 w-full rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] pl-9 pr-8 text-xs text-[#2B2826] outline-none transition-all placeholder:text-[#8C827A]/70 focus:border-[#B91B1C] focus:bg-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C827A] hover:text-[#2B2826] transition-colors"
              title="Xóa tìm kiếm"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <div className="flex h-9 items-center gap-1.5 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-2.5 transition-colors hover:border-[#B91B1C]/40 focus-within:border-[#B91B1C] focus-within:bg-white">
            <Shield className="h-3.5 w-3.5 shrink-0 text-[#8C827A]" />
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value as 'all' | 'user' | 'admin');
                setPage(1);
              }}
              aria-label="Lọc theo vai trò"
              className="cursor-pointer bg-transparent text-xs font-bold text-[#2B2826] outline-none"
            >
              <option value="all">Tất cả vai trò</option>
              <option value="user">Học viên</option>
              <option value="admin">Quản trị</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex h-9 items-center gap-1.5 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-2.5 transition-colors hover:border-[#B91B1C]/40 focus-within:border-[#B91B1C] focus-within:bg-white">
            <Filter className="h-3.5 w-3.5 shrink-0 text-[#8C827A]" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | 'active' | 'locked');
                setPage(1);
              }}
              aria-label="Lọc theo trạng thái"
              className="cursor-pointer bg-transparent text-xs font-bold text-[#2B2826] outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="locked">Tài khoản bị khóa</option>
            </select>
          </div>

          {/* HSK Level Filter */}
          <div className="flex h-9 items-center gap-1.5 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-2.5 transition-colors hover:border-[#B91B1C]/40 focus-within:border-[#B91B1C] focus-within:bg-white">
            <GraduationCap className="h-3.5 w-3.5 shrink-0 text-[#8C827A]" />
            <select
              value={hskFilter}
              onChange={(e) => {
                setHskFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Lọc theo cấp độ HSK"
              className="cursor-pointer bg-transparent text-xs font-bold text-[#2B2826] outline-none"
            >
              <option value="">Tất cả HSK</option>
              {HSK_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  HSK {lvl}
                </option>
              ))}
            </select>
          </div>

          {/* Reset button if active */}
          {(searchQuery || roleFilter !== 'all' || statusFilter !== 'all' || hskFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setRoleFilter('all');
                setStatusFilter('all');
                setHskFilter('');
                setPage(1);
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

      {/* Users Data Table */}
      <div className="overflow-hidden rounded-3xl border border-[#F2E4D8] bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
          <thead className="border-b border-[#F2E4D8] bg-[#FFF9F5] text-[10px] font-bold uppercase tracking-wider text-[#8C827A]">
            <tr>
              <th className="p-4 w-[260px]">Người dùng</th>
              <th className="p-4">Email</th>
              <th className="p-4 w-[130px]">Vai trò</th>
              <th className="p-4 w-[130px]">Trình độ HSK</th>
              <th className="p-4 w-[140px]">Trạng thái</th>
              <th className="p-4 text-center w-[120px]">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2E4D8]">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-[#8C827A]">
                  <div className="inline-flex items-center gap-2">
                    <Spinner size="sm" tone="brand" />
                    <span>Đang tải danh sách người dùng...</span>
                  </div>
                </td>
              </tr>
            ) : currentUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-[#8C827A]">
                  Không tìm thấy người dùng nào phù hợp với bộ lọc.
                </td>
              </tr>
            ) : (
              currentUsers.map((user) => {
                const isUserAdmin = user.role === 'admin';
                const hskLevel = user.learningProfile?.currentHsk;
                const hskKey = hskLevel ? String(hskLevel) : '';
                const styling = hskKey ? HSK_COLORS[hskKey] || HSK_COLORS['1'] : null;

                return (
                  <tr key={user._id} className="transition-colors hover:bg-[#FFF9F5]/70 group">
                    {/* User Profile info */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-xs font-black shadow-2xs ${getAvatarColor(
                            user._id
                          )}`}
                        >
                          {getInitials(user.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-sm text-[#2B2826]">{user.name}</p>
                          <span className="mt-0.5 flex items-center gap-1 text-[10px] text-[#8C827A]">
                            <Calendar className="h-3 w-3" />
                            <span>Gia nhập: {formatDate(user.createdAt)}</span>
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="p-4 font-medium text-[#6E655F]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{user.email}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(user.email, `email-${user._id}`)}
                          className="rounded p-0.5 text-[#8C827A] hover:text-[#2B2826]"
                          title="Sao chép email"
                        >
                          {copiedField === `email-${user._id}` ? (
                            <Check className="h-3 w-3 text-[#188A5A]" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Role badge */}
                    <td className="p-4">
                      {isUserAdmin ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#2B2826] px-2.5 py-1 text-[10px] font-black tracking-wide text-white">
                          <Shield className="h-3 w-3 text-[#B45309]" />
                          <span>Admin</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#F2E4D8] bg-[#FFF9F5] px-2.5 py-1 text-[10px] font-bold text-[#6E655F]">
                          <span>Học viên</span>
                        </span>
                      )}
                    </td>

                    {/* HSK Level badge */}
                    <td className="p-4">
                      {styling ? (
                        <span
                          className={`rounded-md px-2.5 py-1 text-[10px] font-black border ${styling.bg} ${styling.text} ${styling.border}`}
                        >
                          HSK {hskLevel}
                        </span>
                      ) : (
                        <span className="italic text-[11px] text-[#8C827A]">Chưa đặt</span>
                      )}
                    </td>

                    {/* Status Pill Toggle */}
                    <td className="p-4">
                      <button
                        type="button"
                        disabled={isUserAdmin || actionBusy}
                        onClick={() => handleToggleStatus(user)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black tracking-wide uppercase transition-all border ${
                          user.status === 'active'
                            ? 'border-[#C6E7DA] bg-[#EAF5F1] text-[#188A5A] hover:bg-[#D4EFE4]'
                            : 'border-[#F9D2D2] bg-[#FDF1F1] text-[#B91B1C] hover:bg-[#FAD2CF]'
                        } ${isUserAdmin ? 'cursor-not-allowed opacity-70' : 'cursor-pointer active:scale-[0.98]'}`}
                        title={
                          isUserAdmin
                            ? 'Không thể khóa tài khoản quản trị'
                            : user.status === 'active'
                            ? 'Bấm để khóa tài khoản này'
                            : 'Bấm để mở khóa tài khoản này'
                        }
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            user.status === 'active' ? 'bg-[#188A5A]' : 'bg-[#B91B1C]'
                          }`}
                        />
                        <span>{user.status === 'active' ? 'Hoạt động' : 'Bị khóa'}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUser(user);
                            navigate(`/admin/users/${user._id}`);
                          }}
                          className="rounded-lg border border-[#F2E4D8] bg-white p-1.5 text-[#8C827A] transition-colors hover:bg-[#FFF9F5] hover:text-[#2B2826]"
                          title="Xem hồ sơ chi tiết"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {!isUserAdmin && (
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => handleToggleStatus(user)}
                            className={`rounded-lg border border-[#F2E4D8] bg-white p-1.5 transition-colors ${
                              user.status === 'active'
                                ? 'text-[#8C827A] hover:bg-[#FDF1F1] hover:text-[#B91B1C]'
                                : 'text-[#188A5A] hover:bg-[#EAF5F1]'
                            }`}
                            title={user.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}
                          >
                            {user.status === 'active' ? (
                              <Lock className="h-3.5 w-3.5" />
                            ) : (
                              <Unlock className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      <AdminPaginationBar
        total={filteredUsers.length}
        page={safePage}
        pageSize={pageSize}
        visibleCount={currentUsers.length}
        unitLabel="người dùng"
        disabled={loading}
        ariaLabel="Phân trang người dùng"
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md space-y-5 rounded-3xl border border-[#F2E4D8] bg-white p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#F2E4D8] pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl font-black text-xs shadow-2xs ${getAvatarColor(
                    selectedUser._id
                  )}`}
                >
                  {getInitials(selectedUser.name)}
                </div>
                <div>
                  <h3 className="text-base font-black text-[#2B2826]">{selectedUser.name}</h3>
                  <span className="text-[11px] text-[#8C827A]">{selectedUser.email}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-lg p-1.5 text-[#8C827A] transition-colors hover:bg-[#FFF9F5] hover:text-[#2B2826]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Profile Information List */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between rounded-2xl border border-[#F2E4D8] bg-[#FFFDFB] p-3">
                <span className="font-bold text-[#8C827A]">Mã định danh (User ID):</span>
                <span className="font-mono text-[11px] font-bold text-[#2B2826]">{selectedUser._id}</span>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-[#F2E4D8] bg-[#FFFDFB] p-3">
                <span className="font-bold text-[#8C827A]">Vai trò:</span>
                {selectedUser.role === 'admin' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#2B2826] px-2.5 py-0.5 text-[10px] font-black text-white shadow-2xs">
                    <Shield className="h-3 w-3 text-[#E7A92F]" />
                    <span>Quản trị viên (Admin)</span>
                  </span>
                ) : (
                  <span className="rounded-full border border-[#F2E4D8] bg-white px-2.5 py-0.5 text-[10px] font-bold text-[#5F5852]">
                    Học viên thông thường
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-[#F2E4D8] bg-[#FFFDFB] p-3">
                <span className="font-bold text-[#8C827A]">Trạng thái tài khoản:</span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black tracking-wide uppercase ${
                    selectedUser.status === 'active'
                      ? 'border-[#C6E7DA] bg-[#EAF5F1] text-[#188A5A]'
                      : 'border-[#F9D2D2] bg-[#FDF1F1] text-[#B91B1C]'
                  }`}
                >
                  {selectedUser.status === 'active' ? 'Đang hoạt động' : 'Tài khoản bị khóa'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-[#F2E4D8] bg-[#FFFDFB] p-3">
                <span className="font-bold text-[#8C827A]">Trình độ HSK hiện tại:</span>
                {selectedUser.learningProfile?.currentHsk ? (
                  <span className="rounded-md border border-[#C6E7DA] bg-[#EAF5F1] px-2.5 py-0.5 text-[10px] font-black text-[#188A5A]">
                    HSK {selectedUser.learningProfile.currentHsk}
                  </span>
                ) : (
                  <span className="text-[#8C827A] italic">Chưa thiết lập</span>
                )}
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-[#F2E4D8] bg-[#FFFDFB] p-3">
                <span className="font-bold text-[#8C827A]">Ngày đăng ký tham gia:</span>
                <span className="font-bold text-[#2B2826]">{formatDate(selectedUser.createdAt)}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 border-t border-[#F2E4D8] pt-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-4 py-2 text-xs font-bold text-[#5F5852] transition-colors hover:bg-white hover:text-[#2B2826]"
              >
                Đóng
              </button>
              {selectedUser.role !== 'admin' && (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleToggleStatus(selectedUser)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-2xs transition-all active:scale-[0.98] ${
                    selectedUser.status === 'active'
                      ? 'bg-[#B91B1C] hover:bg-[#A3181A]'
                      : 'bg-[#188A5A] hover:bg-[#137333]'
                  }`}
                >
                  {selectedUser.status === 'active' ? 'Khóa tài khoản này' : 'Mở khóa tài khoản'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
