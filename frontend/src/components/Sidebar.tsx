import React from 'react';
import {
  Home,
  BookOpen,
  Bookmark,
  Map,
  GraduationCap,
  Trophy,
  Users,
  Zap,
  X,
  BookMarked,
  History,
  Sparkles,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { dashboardQueryKeys } from '../api/queryKeys';
import { getLearnerDashboard } from '../api/learning';
import { UserProfile } from '../data/hanflixData';
import { useLanguage } from '../i18n';
import UserAvatar from './common/UserAvatar';

interface SidebarProps {
  activeNav: string;
  onNavChange: (navId: string) => void;
  userProfile: UserProfile;
  onStartPractice: () => void;
  isDrawerOpen?: boolean;
  onCloseDrawer?: () => void;
  isCollapsed?: boolean;
}

function NavButton({
  item,
  isActive,
  onNavChange,
  isCollapsed,
}: {
  item: { id: string; label: string; icon: React.ElementType };
  isActive: boolean;
  onNavChange: (id: string) => void;
  isCollapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <div className="relative group">
      <button
        onClick={() => onNavChange(item.id)}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
        className={`w-full h-[46px] rounded-xl flex items-center gap-3 text-sm font-semibold transition-all duration-150 cursor-pointer ${
          isCollapsed ? 'justify-center px-2' : 'px-4'
        } ${
          isActive
            ? 'bg-[#B91B1C] text-white shadow-sm'
            : 'text-[#5F6368] hover:text-[#18181B] hover:bg-[#FDF1F1]'
        }`}
      >
        <Icon className={`shrink-0 w-5 h-5 ${isActive ? 'text-white' : 'text-[#5F6368] group-hover:text-[#B91B1C]'}`} />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
      </button>

      {/* Floating Tooltip in Collapsed Rail Mode */}
      {isCollapsed && (
        <div className="hidden lg:block absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-xl bg-[#18181B] text-white text-xs font-bold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">
          {item.label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#18181B]" />
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  activeNav,
  onNavChange,
  userProfile,
  onStartPractice,
  isDrawerOpen = false,
  onCloseDrawer,
  isCollapsed = false,
}: SidebarProps) {
  const { t } = useLanguage();

  const dashboardQuery = useQuery({
    queryKey: dashboardQueryKeys.detail(),
    queryFn: ({ signal }) => getLearnerDashboard({ signal } as never),
    enabled: Boolean(userProfile?.id),
    staleTime: 30000,
  });
  const liveXP = dashboardQuery.data?.metrics?.totalXP ?? userProfile?.totalXP ?? 0;

  const navItems = [
    { id: 'feed', label: t.nav.feed, icon: Home },
    { id: 'lessons', label: t.nav.lessons, icon: BookOpen },
    { id: 'saved', label: t.nav.saved, icon: Bookmark },
    { id: 'vocabulary', label: t.nav.vocabulary, icon: BookMarked },
    { id: 'roadmap', label: t.nav.roadmap, icon: Map },
    { id: 'history', label: t.nav.history, icon: History },
    { id: 'exam', label: t.nav.exam, icon: GraduationCap },
    { id: 'leaderboard', label: t.nav.leaderboard, icon: Trophy },
    { id: 'community', label: t.nav.community, icon: Users },
  ];

  const renderContent = (collapsed: boolean) => (
    <div className="flex flex-col h-full select-none">
      {/* Mobile drawer header */}
      {isDrawerOpen && onCloseDrawer && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E7E7EA] shrink-0">
          <img
            src="/assets/logo.png"
            alt="HanFlix Logo"
            className="h-8 w-auto object-contain"
          />
          <button
            onClick={onCloseDrawer}
            aria-label="Đóng menu"
            className="p-1.5 rounded-full hover:bg-[#F7F7F9] text-[#5F6368] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Main Nav Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-4">
        {/* Profile Card (Expanded) */}
        {!collapsed && (
          <div className="bg-[#F7F7F9] rounded-2xl p-4 border border-[#E7E7EA] flex flex-col items-center text-center transition-opacity duration-200">
            <div className="relative mb-2.5">
              <UserAvatar
                user={{ id: userProfile.id, name: userProfile.name, avatarConfig: userProfile.avatarConfig, avatar: userProfile.avatar }}
                size={56}
                className="border-2 border-white shadow-md"
              />
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#188A5A] rounded-full border-2 border-white" />
            </div>
            <h3 className="font-bold text-sm text-[#18181B] tracking-tight truncate max-w-full">{userProfile.name}</h3>
            
            {/* Badges row: HSK Level + XP points */}
            <div className="mt-1.5 flex items-center justify-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#34363A] text-white text-[11px] font-semibold shadow-2xs">
                {userProfile.level}
              </span>
              <button
                type="button"
                onClick={() => {
                  onNavChange('leaderboard');
                  onCloseDrawer?.();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-200/90 hover:border-amber-300 text-amber-900 text-[11px] font-bold shadow-2xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="Điểm kinh nghiệm (XP) · Nhấn để xem Bảng xếp hạng"
              >
                <Sparkles className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />
                <span>{liveXP.toLocaleString('vi-VN')} XP</span>
              </button>
            </div>

            {userProfile.hskProgress > 0 && <div className="w-full mt-3 text-left">
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
            </div>}
          </div>
        )}

        {/* Profile Mini Avatar (Collapsed) */}
        {collapsed && (
          <div className="flex justify-center py-1 group relative">
            <div className="relative cursor-pointer" title={userProfile.name}>
              <UserAvatar
                user={{ id: userProfile.id, name: userProfile.name, avatarConfig: userProfile.avatarConfig, avatar: userProfile.avatar }}
                size={40}
                className="border-2 border-white shadow"
              />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#188A5A] rounded-full border-2 border-white" />
            </div>
            {/* Tooltip on mini avatar */}
            <div className="hidden lg:block absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-xl bg-[#18181B] text-white text-xs font-bold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">
              {userProfile.name} ({userProfile.hskLevel}) · {liveXP.toLocaleString('vi-VN')} XP
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#18181B]" />
            </div>
          </div>
        )}

        {/* Navigation Items */}
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
              isCollapsed={collapsed}
            />
          ))}
        </nav>
      </div>

      {/* CTA Bottom Button */}
      <div className="shrink-0 px-3 pb-4 pt-3 border-t border-[#E7E7EA]">
        <div className="relative group">
          <button
            onClick={onStartPractice}
            aria-label={t.nav.startReview}
            className={`w-full h-[44px] bg-[#B91B1C] hover:bg-[#A3181A] active:scale-[0.98] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
              collapsed ? 'px-2' : 'px-4'
            }`}
          >
            <Zap className="w-4 h-4 shrink-0 fill-current" />
            {!collapsed && <span className="truncate">{t.nav.startReview}</span>}
          </button>

          {collapsed && (
            <div className="hidden lg:block absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-xl bg-[#18181B] text-white text-xs font-bold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">
              {t.nav.startReview}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#18181B]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Collapsible Sidebar (≥1024px) */}
      <aside
        className={`hidden lg:flex shrink-0 bg-white border-r border-[#E7E7EA] flex-col h-[calc(100vh-68px)] sticky top-[68px] overflow-hidden transition-[width] duration-300 ease-in-out z-30 ${
          isCollapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
      >
        {renderContent(isCollapsed)}
      </aside>

      {/* Mobile Drawer Overlay (<1024px) */}
      {isDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onCloseDrawer}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[280px] bg-white h-full shadow-2xl flex flex-col">
            {renderContent(false)}
          </aside>
        </div>
      )}
    </>
  );
}
