import React, { useState } from 'react';
import { Users, Lock, Unlock, Shield, Search, UserCheck } from 'lucide-react';
import { User, INITIAL_USERS } from '../../data/hanflixData';

export default function AdminUserList() {
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleUserLock = (userId: string) => {
    setUsers(users.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          status: u.status === 'active' ? 'locked' : 'active'
        };
      }
      return u;
    }));
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-[#18181B]">Quản lý Người Dùng & Học Viên</h1>
        <p className="text-xs text-[#5F6368] mt-1">Xem thông tin tài khoản, cấp độ HSK và trạng thái truy cập</p>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E7E7EA] flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 text-[#8B9097] absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Tìm người dùng theo tên hoặc email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl text-xs outline-none focus:border-[#B91B1C]"
          />
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-2xl border border-[#E7E7EA] overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F7F7F9] border-b border-[#E7E7EA] text-[#8B9097] uppercase font-bold text-[10px]">
            <tr>
              <th className="p-4">Họ và tên</th>
              <th className="p-4">Email</th>
              <th className="p-4">Vai trò</th>
              <th className="p-4">Hồ sơ HSK</th>
              <th className="p-4">Trạng thái</th>
              <th className="p-4 text-right">Khóa / Mở khóa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E7EA]">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-[#F7F7F9]/50 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={user.avatarAsset || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces"}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover border border-[#E7E7EA]"
                    />
                    <span className="font-bold text-sm text-[#18181B]">{user.name}</span>
                  </div>
                </td>
                <td className="p-4 font-mono text-[#5F6368]">{user.email}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    user.role === 'admin' ? 'bg-[#34363A] text-white' : 'bg-[#F7F7F9] text-[#5F6368]'
                  }`}>
                    {user.role === 'admin' ? 'Quản trị viên' : 'Học viên'}
                  </span>
                </td>
                <td className="p-4 font-semibold text-[#18181B]">
                  {user.learningProfile ? `HSK ${user.learningProfile.hskLevel} (${user.learningProfile.goal})` : 'Chưa thiết lập'}
                </td>
                <td className="p-4">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    user.status === 'active' ? 'bg-[#E4F6ED] text-[#188A5A]' : 'bg-[#FDF1F1] text-[#B91B1C]'
                  }`}>
                    {user.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  {user.role !== 'admin' && (
                    <button
                      onClick={() => toggleUserLock(user.id)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ml-auto ${
                        user.status === 'active'
                          ? 'border-[#E7E7EA] text-[#B91B1C] hover:bg-[#FDF1F1]'
                          : 'border-[#188A5A] text-[#188A5A] hover:bg-[#E4F6ED]'
                      }`}
                    >
                      {user.status === 'active' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      <span>{user.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
