import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Shield,
  Search,
  Filter,
  Lock,
  Unlock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  Copy,
  Check,
  GraduationCap,
  Target,
  Calendar,
  UserCheck,
  UserX,
  Mail,
  MoreHorizontal,
} from 'lucide-react';
import { listAdminUsers, setAdminUserStatus, type AdminUser } from '../../api/admin';

const HSK_LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

const HSK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '1': { bg: 'bg-[#E6F4EA]', text: 'text-[#137333]', border: 'border-[#CEEAD6]' },
  '2': { bg: 'bg-[#E8F0FE]', text: 'text-[#1A73E8]', border: 'border-[#D2E3FC]' },
  '3': { bg: 'bg-[#F3E8FD]', text: 'text-[#9334E6]', border: 'border-[#E9D5FF]' },
  '4': { bg: 'bg-[#FEF7E0]', text: 'text-[#B06000]', border: 'border-[#FEEFC3]' },
  '5': { bg: 'bg-[#FFF0E6]', text: 'text-[#EA580C]', border: 'border-[#FED7AA]' },
  '6': { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#FAD2CF]' },
  '7': { bg: 'bg-[#F1F5F9]', text: 'text-[#475569]', border: 'border-[#CBD5E1]' },
  '8': { bg: 'bg-[#F8FAFC]', text: 'text-[#334155]', border: 'border-[#94A3B8]' },
  '9': { bg: 'bg-[#0F172A]', text: 'text-white', border: 'border-[#1E293B]' },
};

function getInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-[#B91B1C] text-white',
  'bg-[#2F6E62] text-white',
  'bg-[#E7A92F] text-[#18181B]',
  'bg-[#1D4ED8] text-white',
  'bg-[#7C3AED] text-white',
  'bg-[#059669] text-white',
  'bg-[#D97706] text-white',
  'bg-[#374151] text-white',
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

export default function AdminUserManager() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked'>('all');
  const [hskFilter, setHskFilter] = useState<string>('');

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

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

  const showMsg = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 4000);
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

    if (!window.confirm(`Bạn có chắc chắn muốn ${actionName} tài khoản "${user.name}" (${user.email})?`)) {
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
        const q = searchQuery.toLowerCase();
        const matchesName = u.name?.toLowerCase().includes(q);
        const matchesEmail = u.email?.toLowerCase().includes(q);
        const matchesGoal = u.learningProfile?.goal?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesGoal) return false;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, hskFilter, searchQuery]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page, pageSize]);

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
      <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FDF1F1] text-[#B91B1C] flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-[#18181B] tracking-tight">Quản Lý Người Dùng & Học Viên</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-[#FDF1F1] text-[#B91B1C] text-[11px] font-black uppercase tracking-wider">
                User Directory
              </span>
            </div>
            <p className="text-xs text-[#5F6368] mt-0.5">
              Theo dõi danh sách học viên, phân bổ trình độ HSK 1 đến 9, mục tiêu học tập và kiểm soát trạng thái tài khoản.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => fetchUsers(searchQuery)}
            disabled={loading}
            className="h-10 px-4 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] hover:bg-white text-[#18181B] text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-40 shadow-2xs"
          >
            <RefreshCw className={`w-4 h-4 text-[#5F6368] ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới danh sách</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {statusMsg && (
        <div
          className={`rounded-2xl p-4 flex items-center gap-3 text-xs font-bold border animate-in fade-in slide-in-from-top-2 duration-200 ${
            statusMsg.type === 'success'
              ? 'bg-[#E6F4EA] border-[#CEEAD6] text-[#137333]'
              : 'bg-[#FDF1F1] border-[#FAD2CF] text-[#B91B1C]'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Bento Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Users */}
        <div className="p-4 bg-white rounded-3xl border border-[#E7E7EA] shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-[#8B9097] tracking-wider">Tổng Học Viên</span>
            <div className="w-7 h-7 rounded-xl bg-[#F7F7F9] flex items-center justify-center text-[#5F6368]">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#18181B]">{stats.total.toLocaleString()}</div>
          <div className="text-[11px] text-[#5F6368]">Tài khoản đã đăng ký trên hệ thống</div>
        </div>

        {/* Active Accounts */}
        <div className="p-4 bg-white rounded-3xl border border-[#E7E7EA] shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-[#188A5A] tracking-wider">Tài Khoản Hoạt Động</span>
            <div className="w-7 h-7 rounded-xl bg-[#E6F4EA] flex items-center justify-center text-[#188A5A]">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#18181B]">{stats.active.toLocaleString()}</div>
          <div className="text-[11px] text-[#188A5A] font-bold">
            {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% trên tổng người dùng
          </div>
        </div>

        {/* Locked Accounts */}
        <div className="p-4 bg-white rounded-3xl border border-[#E7E7EA] shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-[#B91B1C] tracking-wider">Tài Khoản Bị Khóa</span>
            <div className="w-7 h-7 rounded-xl bg-[#FDF1F1] flex items-center justify-center text-[#B91B1C]">
              <UserX className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#18181B]">{stats.locked.toLocaleString()}</div>
          <div className="text-[11px] text-[#5F6368]">Tạm khóa hoặc vi phạm chính sách</div>
        </div>

        {/* Admins & HSK Distribution */}
        <div className="p-4 bg-white rounded-3xl border border-[#E7E7EA] shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-[#2563EB] tracking-wider">Quản Trị Viên</span>
            <div className="w-7 h-7 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">
              <Shield className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#18181B]">{stats.admins.toLocaleString()}</div>
          <div className="text-[11px] text-[#5F6368]">Tài khoản có quyền quản trị tối cao</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-[#E7E7EA] flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-[#8B9097] absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Tìm theo tên học viên, email hoặc mục tiêu học..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl text-xs outline-none focus:border-[#B91B1C] transition-colors"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          {/* Role Filter Pills */}
          <div className="flex items-center gap-1 bg-[#F7F7F9] p-1 rounded-xl border border-[#E7E7EA]">
            {(['all', 'user', 'admin'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRoleFilter(r);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  roleFilter === r
                    ? 'bg-[#18181B] text-white shadow-2xs'
                    : 'text-[#5F6368] hover:text-[#18181B]'
                }`}
              >
                {r === 'all' ? 'Tất cả vai trò' : r === 'admin' ? 'Quản trị' : 'Học viên'}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#8B9097]" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="h-8 px-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl text-xs font-bold text-[#18181B] outline-none cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="locked">Tài khoản bị khóa</option>
            </select>
          </div>

          {/* HSK Level Filter */}
          <select
            value={hskFilter}
            onChange={(e) => {
              setHskFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl text-xs font-bold text-[#18181B] outline-none cursor-pointer"
          >
            <option value="">Tất cả HSK</option>
            {HSK_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                HSK {lvl}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-white rounded-3xl border border-[#E7E7EA] overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F7F7F9] border-b border-[#E7E7EA] text-[#8B9097] uppercase font-bold text-[10px] tracking-wider">
            <tr>
              <th className="p-4 w-[260px]">Người dùng</th>
              <th className="p-4 w-[240px]">Email</th>
              <th className="p-4 w-[130px]">Vai trò</th>
              <th className="p-4 w-[120px]">Trình độ HSK</th>
              <th className="p-4">Mục tiêu học tập</th>
              <th className="p-4 w-[140px]">Trạng thái</th>
              <th className="p-4 text-right w-[120px]">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E7EA]">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-[#8B9097]">
                  <div className="inline-flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#B91B1C]" />
                    <span>Đang tải danh sách người dùng...</span>
                  </div>
                </td>
              </tr>
            ) : currentUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-[#8B9097]">
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
                  <tr key={user._id} className="hover:bg-[#F7F7F9]/60 transition-colors group">
                    {/* User Profile info */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs ${getAvatarColor(
                            user._id
                          )}`}
                        >
                          {getInitials(user.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-[#18181B] truncate">{user.name}</p>
                          <span className="text-[10px] text-[#8B9097] flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            <span>Gia nhập: {formatDate(user.createdAt)}</span>
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="p-4 font-medium text-[#5F6368]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{user.email}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(user.email, `email-${user._id}`)}
                          className="text-[#8B9097] hover:text-[#18181B] p-0.5 rounded"
                          title="Sao chép email"
                        >
                          {copiedField === `email-${user._id}` ? (
                            <Check className="w-3 h-3 text-[#137333]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Role badge */}
                    <td className="p-4">
                      {isUserAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-[#18181B] text-white tracking-wide">
                          <Shield className="w-3 h-3 text-[#E7A92F]" />
                          <span>Admin</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#F7F7F9] text-[#5F6368] border border-[#E7E7EA]">
                          <span>Học viên</span>
                        </span>
                      )}
                    </td>

                    {/* HSK Level badge */}
                    <td className="p-4">
                      {styling ? (
                        <span
                          className={`px-2.5 py-1 rounded-md font-black text-[10px] border ${styling.bg} ${styling.text} ${styling.border}`}
                        >
                          HSK {hskLevel}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#8B9097] italic">Chưa đặt</span>
                      )}
                    </td>

                    {/* Learning Goal */}
                    <td className="p-4">
                      {user.learningProfile?.goal ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FEF7E0] text-[#B06000] border border-[#FEEFC3] text-[11px] font-bold">
                          <Target className="w-3 h-3" />
                          <span className="truncate max-w-[200px]">{user.learningProfile.goal}</span>
                        </span>
                      ) : (
                        <span className="text-[#8B9097] text-[11px] italic">—</span>
                      )}
                    </td>

                    {/* Status Pill Toggle */}
                    <td className="p-4">
                      <button
                        type="button"
                        disabled={isUserAdmin || actionBusy}
                        onClick={() => handleToggleStatus(user)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase transition-all ${
                          user.status === 'active'
                            ? 'bg-[#E6F4EA] text-[#137333] hover:bg-[#CEEAD6]'
                            : 'bg-[#FDF1F1] text-[#B91B1C] hover:bg-[#FAD2CF]'
                        } ${isUserAdmin ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                        title={
                          isUserAdmin
                            ? 'Không thể khóa tài khoản quản trị'
                            : user.status === 'active'
                            ? 'Bấm để khóa tài khoản này'
                            : 'Bấm để mở khóa tài khoản này'
                        }
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            user.status === 'active' ? 'bg-[#188A5A]' : 'bg-[#B91B1C]'
                          }`}
                        />
                        <span>{user.status === 'active' ? 'Hoạt động' : 'Bị khóa'}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedUser(user)}
                          className="p-1.5 rounded-lg border border-[#E7E7EA] bg-white text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9] transition-colors"
                          title="Xem hồ sơ chi tiết"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {!isUserAdmin && (
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => handleToggleStatus(user)}
                            className={`p-1.5 rounded-lg border border-[#E7E7EA] bg-white transition-colors ${
                              user.status === 'active'
                                ? 'text-[#5F6368] hover:text-[#B91B1C] hover:bg-[#FDF1F1]'
                                : 'text-[#188A5A] hover:bg-[#E6F4EA]'
                            }`}
                            title={user.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}
                          >
                            {user.status === 'active' ? (
                              <Lock className="w-3.5 h-3.5" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5" />
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

        {/* Pagination Strip */}
        <div className="p-4 bg-[#F7F7F9] border-t border-[#E7E7EA] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5F6368]">
          <div>
            Hiển thị <span className="font-bold text-[#18181B]">{currentUsers.length}</span> /{' '}
            <span className="font-bold text-[#18181B]">{filteredUsers.length}</span> người dùng (Trang{' '}
            <span className="font-bold text-[#18181B]">{page}</span> / {totalPages})
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="h-8 px-3 rounded-lg border border-[#E7E7EA] bg-white text-[#18181B] font-bold text-xs flex items-center gap-1 disabled:opacity-40 hover:bg-[#F7F7F9] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Trước</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="h-8 px-3 rounded-lg border border-[#E7E7EA] bg-white text-[#18181B] font-bold text-xs flex items-center gap-1 disabled:opacity-40 hover:bg-[#F7F7F9] transition-colors"
            >
              <span>Tiếp</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#E7E7EA] shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E7EA]">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs ${getAvatarColor(
                    selectedUser._id
                  )}`}
                >
                  {getInitials(selectedUser.name)}
                </div>
                <div>
                  <h3 className="text-base font-black text-[#18181B]">{selectedUser.name}</h3>
                  <span className="text-[11px] text-[#8B9097]">{selectedUser.email}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1.5 rounded-lg hover:bg-[#F7F7F9] text-[#8B9097] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Information List */}
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#F7F7F9] rounded-2xl border border-[#E7E7EA] flex items-center justify-between">
                <span className="text-[#5F6368] font-bold">Mã định danh (User ID):</span>
                <span className="font-mono text-[11px] font-bold text-[#18181B]">{selectedUser._id}</span>
              </div>

              <div className="p-3 bg-[#F7F7F9] rounded-2xl border border-[#E7E7EA] flex items-center justify-between">
                <span className="text-[#5F6368] font-bold">Vai trò:</span>
                {selectedUser.role === 'admin' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#18181B] text-white">
                    <Shield className="w-3 h-3 text-[#E7A92F]" />
                    <span>Quản trị viên (Admin)</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-[#5F6368] border border-[#E7E7EA]">
                    Học viên thông thường
                  </span>
                )}
              </div>

              <div className="p-3 bg-[#F7F7F9] rounded-2xl border border-[#E7E7EA] flex items-center justify-between">
                <span className="text-[#5F6368] font-bold">Trạng thái tài khoản:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                    selectedUser.status === 'active'
                      ? 'bg-[#E6F4EA] text-[#137333]'
                      : 'bg-[#FDF1F1] text-[#B91B1C]'
                  }`}
                >
                  {selectedUser.status === 'active' ? 'Đang hoạt động' : 'Tài khoản bị khóa'}
                </span>
              </div>

              <div className="p-3 bg-[#F7F7F9] rounded-2xl border border-[#E7E7EA] flex items-center justify-between">
                <span className="text-[#5F6368] font-bold">Trình độ HSK hiện tại:</span>
                {selectedUser.learningProfile?.currentHsk ? (
                  <span className="px-2.5 py-0.5 rounded-md font-black text-[10px] bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]">
                    HSK {selectedUser.learningProfile.currentHsk}
                  </span>
                ) : (
                  <span className="text-[#8B9097] italic">Chưa thiết lập</span>
                )}
              </div>

              <div className="p-3 bg-[#F7F7F9] rounded-2xl border border-[#E7E7EA] space-y-1">
                <span className="text-[#5F6368] font-bold block">Mục tiêu học tập:</span>
                <p className="text-[#18181B] font-semibold text-xs">
                  {selectedUser.learningProfile?.goal || 'Chưa đặt mục tiêu học'}
                </p>
              </div>

              <div className="p-3 bg-[#F7F7F9] rounded-2xl border border-[#E7E7EA] flex items-center justify-between">
                <span className="text-[#5F6368] font-bold">Ngày đăng ký tham gia:</span>
                <span className="text-[#18181B] font-bold">{formatDate(selectedUser.createdAt)}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E7E7EA]">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] hover:bg-white text-[#5F6368] text-xs font-bold transition-colors"
              >
                Đóng
              </button>
              {selectedUser.role !== 'admin' && (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleToggleStatus(selectedUser)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors shadow-2xs ${
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
