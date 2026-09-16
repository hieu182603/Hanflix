import React from 'react';
import {
  Home,
  BookOpen,
  Bookmark,
  Map,
  GraduationCap,
  Trophy,
  Users,
  Settings,
  Zap,
  X,
  BookMarked,
  History,
  User as UserIcon
} from 'lucide-react';
import { UserProfile } from '../data/hanflixData';

interface SidebarProps {
  activeNav: string;
  onNavChange: (navId: string) => void;
  userProfile: UserProfile;
  onStartPractice: () => void;
  isDrawerOpen?: boolean;
  onCloseDrawer?: () => void;
  isCompact?: boolean;
}

const navItems = [
  { id: 'feed', label: 'Bảng tin', icon: Home },
  { id: 'lessons', label: 'Bài học', icon: BookOpen },
  { id: 'saved', label: 'Kho lưu trữ', icon: Bookmark },
  { id: 'vocabulary', label: 'Từ vựng', icon: BookMarked },
  { id: 'roadmap', label: 'Lộ trình', icon: Map },
  { id: 'history', label: 'Lịch sử học', icon: History },
  { id: 'exam', label: 'Thi HSK', icon: GraduationCap },
  { id: 'leaderboard', label: 'Bảng xếp hạng', icon: Trophy },
  { id: 'community', label: 'Cộng đồng', icon: Users },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
];

function NavButton({
  item,
  isActive,
  onNavChange,
  compact,
}: {
  item: { id: string; label: string; icon: React.ElementType };
  isActive: boolean;
  onNavChange: (id: string) => void;
  compact: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      key={item.id}
      onClick={() => onNavChange(item.id)}
      title={compact ? item.label : undefined}
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
      className={`w-full h-[46px] rounded-xl flex items-center gap-3 text-sm font-semibold transition-all duration-150 ${
        compact ? 'justify-center px-2' : 'px-4'
      } ${
        isActive
          ? 'bg-[#B91B1C] text-white shadow-sm'
          : 'text-[#5F6368] hover:text-[#18181B] hover:bg-[#FDF1F1]'
      }`}
    >
      <Icon className={`shrink-0 w-5 h-5 ${isActive ? 'text-white' : 'text-[#5F6368]'}`} />
      {!compact && <span>{item.label}</span>}
    </button>
  );
}

export default function Sidebar({
  activeNav,
  onNavChange,
  userProfile,
  onStartPractice,
  isDrawerOpen = false,
  onCloseDrawer,
  isCompact = false,
}: SidebarProps) {
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Drawer close button (drawer mode only) */}
      {isDrawerOpen && onCloseDrawer && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E7E7EA] shrink-0">
          <span className="font-black text-base text-[#B91B1C]">Menu</span>
          <button
            onClick={onCloseDrawer}
            aria-label="Đóng menu"
            className="p-1.5 rounded-full hover:bg-[#F7F7F9] text-[#5F6368]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-5 px-3 space-y-5">
        {/* Profile Card */}
        {!isCompact && (
          <div className="bg-[#F7F7F9] rounded-2xl p-4 border border-[#E7E7EA] flex flex-col items-center text-center">
            <div className="relative mb-3">
              <img
                src={userProfile.avatar}
                alt={userProfile.name}
                className="w-[64px] h-[64px] rounded-full object-cover border-2 border-white shadow-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://picsum.photos/seed/avatar-default/64/64';
                }}
              />
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#188A5A] rounded-full border-2 border-white" />
            </div>
            <h3 className="font-bold text-sm text-[#18181B] tracking-tight leading-tight">{userProfile.name}</h3>
            <div className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#34363A] text-white text-[11px] font-medium">
              {userProfile.level}
            </div>
            <div className="w-full mt-3 text-left">
              <div className="flex justify-between items-center text-[11px] font-semibold mb-1">
                <span className="text-[#5F6368]">{userProfile.hskLevel}</span>
                <span className="text-[#B91B1C] font-bold">{userProfile.hskProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#E7E7EA] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#E7A92F] to-[#B91B1C] rounded-full transition-all duration-500"
                  style={{ width: `${userProfile.hskProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Compact: avatar only */}
        {isCompact && (
          <div className="flex justify-center">
            <div className="relative">
              <img
                src={userProfile.avatar}
                alt={userProfile.name}
                title={userProfile.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-white shadow"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://picsum.photos/seed/avatar-default/64/64';
                }}
              />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#188A5A] rounded-full border-2 border-white" />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="space-y-1" aria-label="Điều hướng chính">
          {navItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeNav === item.id}
              onNavChange={(id) => {
                onNavChange(id);
                onCloseDrawer?.();
              }}
              compact={isCompact}
            />
          ))}
        </nav>
      </div>

      {/* CTA Bottom */}
      <div className={`shrink-0 px-3 pb-5 border-t border-[#E7E7EA] pt-4`}>
        <button
          onClick={onStartPractice}
          title={isCompact ? 'Bắt đầu ôn tập' : undefined}
          aria-label="Bắt đầu ôn tập"
          className={`w-full h-[44px] bg-[#B91B1C] hover:bg-[#A3181A] active:bg-[#8F1719] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all ${
            isCompact ? 'px-2' : 'px-4'
          }`}
        >
          <Zap className="w-4 h-4 shrink-0" style={{ fill: 'white' }} />
          {!isCompact && <span>Bắt đầu ôn tập</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop full sidebar (≥1280px) */}
      <aside className="hidden xl:flex w-[272px] shrink-0 bg-white border-r border-[#E7E7EA] flex-col h-[calc(100vh-88px)] sticky top-[88px] overflow-hidden">
        {sidebarContent}
      </aside>

      {/* Desktop compact rail (1024–1279px) */}
      <aside className="hidden lg:flex xl:hidden w-[68px] shrink-0 bg-white border-r border-[#E7E7EA] flex-col h-[calc(100vh-88px)] sticky top-[88px] overflow-hidden">
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto py-5 px-2 space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <img
                  src={userProfile.avatar}
                  alt={userProfile.name}
                  title={userProfile.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-white shadow"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/avatar-default/64/64';
                  }}
                />
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#188A5A] rounded-full border-2 border-white" />
              </div>
            </div>
            <nav className="space-y-1" aria-label="Điều hướng chính">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavChange(item.id)}
                    title={item.label}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full h-[44px] rounded-xl flex items-center justify-center transition-all duration-150 ${
                      isActive
                        ? 'bg-[#B91B1C] text-white'
                        : 'text-[#5F6368] hover:bg-[#FDF1F1]'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="px-2 pb-5 pt-3 border-t border-[#E7E7EA]">
            <button
              onClick={onStartPractice}
              title="Bắt đầu ôn tập"
              aria-label="Bắt đầu ôn tập"
              className="w-full h-[44px] bg-[#B91B1C] hover:bg-[#A3181A] text-white rounded-xl flex items-center justify-center shadow-sm transition-all"
            >
              <Zap className="w-4 h-4" style={{ fill: 'white' }} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer overlay (<1024px) */}
      {isDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onCloseDrawer}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[280px] bg-white h-full shadow-2xl flex flex-col">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
