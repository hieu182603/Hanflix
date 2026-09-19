import React from 'react';
import { Video, Users, BarChart2, LogOut, Upload, Shield, BookOpen, FileText, ListChecks, ExternalLink, Sparkles } from 'lucide-react';
import { User } from '../../data/hanflixData';
import UserAvatar from '../common/UserAvatar';

type AdminTab = 'overview' | 'videos' | 'upload' | 'users' | 'vocabulary' | 'grammar' | 'quiz';

interface AdminShellProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
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
    { id: 'overview', label: 'Tổng quan hệ thống', icon: BarChart2, badge: 'Realtime' },
    { id: 'videos', label: 'Danh sách Video', icon: Video },
    { id: 'quiz', label: 'Bài Luyện Tập', icon: ListChecks },
    { id: 'vocabulary', label: 'Kho Từ vựng HSK', icon: BookOpen },
    { id: 'grammar', label: 'Quản lý Ngữ pháp', icon: FileText },
    { id: 'upload', label: 'Tải video mới', icon: Upload },
    { id: 'users', label: 'Quản lý Người dùng', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-[#FFF9F5] flex flex-col font-sans selection:bg-[#FDF1F1] selection:text-[#B91B1C]">
      {/* Top Header */}
      <header className="h-[70px] bg-white/90 backdrop-blur-md border-b border-[#F2E4D8] px-6 flex items-center justify-between sticky top-0 z-40 transition-colors shadow-[0_2px_12px_-4px_rgba(24,24,27,0.03)]">
        <div className="flex items-center gap-3.5">
          <img
            src="/assets/logo.png"
            alt="HanFlix Logo"
            className="h-10 w-auto max-w-[190px] object-contain cursor-pointer"
            onClick={() => onTabChange('overview')}
          />
          <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#B91B1C] to-[#8F1719] text-white text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 shadow-xs border border-[#B91B1C]/30">
            <Shield className="w-3 h-3 text-[#FDE6BA]" />
            <span>Trung tâm Quản trị</span>
          </span>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          {/* Quick status pill */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFF5F0] border border-[#F2E4D8] text-[11px] font-medium text-[#8B9097]">
            <span className="w-2 h-2 rounded-full bg-[#188A5A] animate-pulse" />
            <span className="text-[#5F6368] font-semibold">Hệ thống hoạt động ổn định</span>
          </div>

          {/* Link back to Learner View */}
          <a
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#5F6368] hover:text-[#B91B1C] hover:bg-[#FFF5F0] border border-[#F2E4D8] transition-all cursor-pointer"
            title="Xem giao diện học viên"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#B91B1C]" />
            <span className="hidden sm:inline">Trang học viên</span>
          </a>

          <div className="flex items-center gap-2.5 border-l border-[#F2E4D8] pl-4">
            <div className="relative">
              <UserAvatar
                user={currentUser}
                size={34}
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#188A5A] ring-2 ring-white" />
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-[#18181B] flex items-center gap-1">
                <span>{currentUser.name}</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-[#FDF1F1] text-[#B91B1C] border border-[#F9D2D2]">ADMIN</span>
              </div>
              <div className="text-[10px] text-[#8B9097]">{currentUser.email}</div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="p-2.5 rounded-xl text-[#8B9097] hover:text-[#B91B1C] hover:bg-[#FDF1F1] border border-transparent hover:border-[#F9D2D2] transition-all active:scale-95"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex max-w-[1920px] w-full mx-auto">
        {/* Admin Left Sidebar */}
        <aside className="w-[260px] shrink-0 bg-white/90 backdrop-blur-sm border-r border-[#F2E4D8] p-4 flex flex-col justify-between sticky top-[70px] h-[calc(100vh-70px)] z-20">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#8B9097]">
                Danh mục quản trị
              </span>
              <span className="text-xs text-[#B91B1C] font-serif select-none opacity-40">漢</span>
            </div>

            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id as AdminTab)}
                  className={`w-full h-11 px-3.5 rounded-2xl flex items-center justify-between text-xs font-bold transition-all relative group cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#B91B1C] to-[#991415] text-white shadow-sm shadow-[#B91B1C]/25 ring-1 ring-[#B91B1C]'
                      : 'text-[#5F6368] hover:text-[#B91B1C] hover:bg-[#FFF5F0]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-[#5F6368] group-hover:text-[#B91B1C]'}`} />
                    <span className="tracking-tight">{item.label}</span>
                  </div>

                  {item.badge && !isActive && (
                    <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded-full bg-[#EAF5F1] text-[#188A5A] border border-[#C6E7DA]">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FDE6BA] shadow-xs" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom Sidebar Card */}
          <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-br from-[#FFF9F5] to-[#FDF1F1] border border-[#F2E4D8] relative overflow-hidden">
            <div className="absolute right-1 -bottom-2 text-4xl font-serif text-[#B91B1C]/10 select-none pointer-events-none">
              影
            </div>
            <div className="flex items-center gap-2 text-[#B91B1C] text-[11px] font-black mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tiêu chuẩn HSK 3.0</span>
            </div>
            <p className="text-[10px] text-[#5F6368] leading-relaxed">
              Dữ liệu video, phụ đề và từ vựng tự động căn chỉnh theo chuẩn khảo thí HSK mới nhất.
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-6 md:p-8 min-w-0 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
