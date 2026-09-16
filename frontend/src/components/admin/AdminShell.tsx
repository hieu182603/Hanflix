import React from 'react';
import { Video, Users, BarChart2, LogOut, Upload, Shield } from 'lucide-react';
import { User } from '../../data/hanflixData';

interface AdminShellProps {
  activeTab: 'overview' | 'videos' | 'upload' | 'users';
  onTabChange: (tab: 'overview' | 'videos' | 'upload' | 'users') => void;
  currentUser: User;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function AdminShell({
  activeTab,
  onTabChange,
  currentUser,
  onLogout,
  children
}: AdminShellProps) {
  const menuItems = [
    { id: 'overview', label: 'Tổng quan', icon: BarChart2 },
    { id: 'videos', label: 'Danh sách Video', icon: Video },
    { id: 'upload', label: 'Tải video mới', icon: Upload },
    { id: 'users', label: 'Quản lý Người dùng', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F9] flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-[68px] bg-white border-b border-[#E7E7EA] px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#B91B1C] text-white flex items-center justify-center font-extrabold text-lg">
            H
          </div>
          <span className="font-black text-xl text-[#B91B1C]">HANFLIX</span>
          <span className="px-2.5 py-0.5 rounded-md bg-[#34363A] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1">
            <Shield className="w-3 h-3" />
            <span>Quản trị</span>
          </span>
        </div>

        <div className="flex items-center gap-4">

          <div className="flex items-center gap-2 border-l border-[#E7E7EA] pl-4">
            <img
              src={currentUser.avatarAsset || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=faces"}
              alt={currentUser.name}
              className="w-8 h-8 rounded-full object-cover"
            />
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-[#18181B]">{currentUser.name}</div>
              <div className="text-[10px] text-[#8B9097]">{currentUser.email}</div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="p-2 rounded-xl text-[#8B9097] hover:text-[#B91B1C] hover:bg-[#FDF1F1] transition-colors"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex max-w-[1920px] w-full mx-auto">
        {/* Admin Left Sidebar */}
        <aside className="w-[240px] shrink-0 bg-white border-r border-[#E7E7EA] p-4 space-y-2 sticky top-[68px] h-[calc(100vh-68px)]">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#8B9097] px-3 py-2">
            Quản trị nội dung
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id as any)}
                className={`w-full h-11 px-3.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[#B91B1C] text-white shadow-2xs'
                    : 'text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#5F6368]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-6 md:p-8 min-w-0 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
