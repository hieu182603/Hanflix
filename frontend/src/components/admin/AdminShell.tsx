import React, { useState, useEffect } from 'react';
import { Video, Users, BarChart2, LogOut, Upload, Shield, BookOpen, FileText, ListChecks, Sparkles, Menu, X, CreditCard, ClipboardList } from 'lucide-react';
import { User } from '../../data/hanflixData';
import UserAvatar from '../common/UserAvatar';

type AdminTab = 'overview' | 'videos' | 'upload' | 'users' | 'vocabulary' | 'grammar' | 'exams' | 'quiz' | 'billing';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: 'overview', label: 'Tổng quan hệ thống', icon: BarChart2 },
    { id: 'videos', label: 'Danh sách Video', icon: Video },
    { id: 'quiz', label: 'Bài Luyện Tập', icon: ListChecks },
    { id: 'vocabulary', label: 'Kho Từ vựng HSK', icon: BookOpen },
    { id: 'grammar', label: 'Quản lý Ngữ pháp', icon: FileText },
    { id: 'exams', label: 'Kho Đề Thi HSK', icon: ClipboardList },
    { id: 'billing', label: 'Gói Cước & Doanh Thu', icon: CreditCard },
    { id: 'upload', label: 'Tải video mới', icon: Upload },
    { id: 'users', label: 'Quản lý Người dùng', icon: Users },
  ];

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsMobileMenuOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isMobileMenuOpen]);

  const handleSelectTab = (tab: AdminTab) => {
    onTabChange(tab);
    setIsMobileMenuOpen(false);
  };

  const renderNavButtons = () => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-[#8B9097]">
          Danh mục quản trị
        </span>
      </div>

      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleSelectTab(item.id as AdminTab)}
            className={`w-full min-h-[44px] px-3.5 rounded-2xl flex items-center justify-between text-xs font-bold transition-all relative group cursor-pointer ${
              isActive
                ? 'bg-gradient-to-r from-[#B91B1C] to-[#991415] text-white shadow-sm shadow-[#B91B1C]/25 ring-1 ring-[#B91B1C]'
                : 'text-[#5F6368] hover:text-[#B91B1C] hover:bg-[#FFF5F0]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-[#5F6368] group-hover:text-[#B91B1C]'}`} />
              <span className="tracking-tight text-left">{item.label}</span>
            </div>

            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#FDE6BA] shadow-xs" />
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FFF9F5] flex flex-col font-sans selection:bg-[#FDF1F1] selection:text-[#B91B1C]">
      {/* Top Header */}
      <header className="h-[70px] bg-white/90 backdrop-blur-md border-b border-[#F2E4D8] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 transition-colors shadow-[0_2px_12px_-4px_rgba(24,24,27,0.03)] safe-area-top">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-xl text-[#5F6368] hover:text-[#18181B] hover:bg-[#FFF5F0] border border-[#F2E4D8] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Mở danh mục quản trị"
          >
            <Menu className="w-5 h-5" />
          </button>

          <img
            src="/assets/logo.png"
            alt="HanFlix Logo"
            className="h-8 sm:h-10 w-auto max-w-[150px] sm:max-w-[190px] object-contain cursor-pointer"
            onClick={() => onTabChange('overview')}
          />
          <span className="hidden sm:inline-flex px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#B91B1C] to-[#8F1719] text-white text-[10px] font-extrabold uppercase tracking-widest items-center gap-1.5 shadow-xs border border-[#B91B1C]/30">
            <Shield className="w-3 h-3 text-[#FDE6BA]" />
            <span>Trung tâm Quản trị</span>
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <UserAvatar
                user={currentUser}
                size={34}
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#188A5A] ring-2 ring-white" />
            </div>
            <div className="text-left hidden md:block">
              <div className="text-xs font-bold text-[#18181B] flex items-center gap-1">
                <span>{currentUser.name}</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-[#FDF1F1] text-[#B91B1C] border border-[#F9D2D2]">ADMIN</span>
              </div>
              <div className="text-[10px] text-[#8B9097] truncate max-w-[150px]">{currentUser.email}</div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="p-2 sm:p-2.5 rounded-xl text-[#8B9097] hover:text-[#B91B1C] hover:bg-[#FDF1F1] border border-transparent hover:border-[#F9D2D2] transition-all active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            title="Đăng xuất"
            aria-label="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-2xs animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside
            className="relative z-10 w-[min(300px,85vw)] bg-white h-full p-4 flex flex-col justify-between shadow-2xl border-r border-[#F2E4D8] animate-in slide-in-from-left duration-250 safe-area-bottom overflow-y-auto"
            aria-label="Danh mục quản trị di động"
          >
            <div className="space-y-3">
              {/* Drawer Top Row with Close Button */}
              <div className="flex items-center justify-between pb-3 border-b border-[#F2E4D8]">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#B91B1C] text-white text-[10px] font-extrabold uppercase tracking-wider">
                    Admin
                  </span>
                  <span className="font-bold text-sm text-[#18181B]">Menu Quản Trị</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-xl text-[#5F6368] hover:text-[#18181B] hover:bg-[#FFF5F0] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  aria-label="Đóng menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {renderNavButtons()}
            </div>

            {/* Bottom Sidebar Card */}
            <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-br from-[#FFF9F5] to-[#FDF1F1] border border-[#F2E4D8] relative overflow-hidden shrink-0">
              <div className="flex items-center gap-2 text-[#B91B1C] text-[11px] font-black mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tiêu chuẩn HSK 3.0</span>
              </div>
              <p className="text-[10px] text-[#5F6368] leading-relaxed">
                Dữ liệu video, phụ đề và từ vựng tự động căn chỉnh theo chuẩn khảo thí HSK mới nhất.
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex max-w-[1920px] w-full mx-auto">
        {/* Desktop Admin Left Sidebar */}
        <aside className="hidden lg:flex w-[260px] shrink-0 bg-white/90 backdrop-blur-sm border-r border-[#F2E4D8] p-4 flex-col justify-between fixed top-[70px] left-0 h-[calc(100vh-70px)] z-20">
          {renderNavButtons()}
        </aside>

        {/* Content Area */}
        <main className="flex-1 lg:ml-[260px]">
          <div className="h-[calc(100vh-70px)] overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
