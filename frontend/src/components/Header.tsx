import { useI18n } from '../i18n';
import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Globe,
  Check,
  X,
  Flame,
  Menu,
  Settings,
  LogOut,
  Compass,
  Sparkles,
  Shield,
  Crown,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import NotificationsDropdown from './notifications/NotificationsDropdown';
import StreakDropdown from './streak/StreakDropdown';
import { useLanguage, Language } from '../i18n';
import { usePandaPet } from './panda-pet';
import UserAvatar from './common/UserAvatar';
import { dashboardQueryKeys } from '../api/queryKeys';
import { getLearnerDashboard } from '../api/learning';

interface HeaderProps {
  onSearchSelect?: (query: string) => void;
  currentLang?: Language;
  onLanguageChange?: (lang: Language) => void;
  onOpenPreferences?: () => void;
  onOpenSettings?: () => void;
  activeNav: string;
  onOpenMenu?: () => void;
  onToggleCollapse?: () => void;
  isSidebarCollapsed?: boolean;
  standaloneMode?: boolean;
  onBack?: () => void;
  currentUser?: {
    name: string;
    email: string;
    role?: string;
    totalXP?: number;
    avatarAsset?: string | null;
    learningProfile?: { hskLevel?: number; dailyMinutes?: number } | null;
    premiumExpiresAt?: Date | string | null;
  };
  onLogout?: () => void;
  streakDays?: number;
  onOpenPractice?: () => void;
  onNavigateToLessons?: () => void;
  onNotificationAction?: (actionUrl?: string) => void;
}

export default function Header({
  onSearchSelect,
  currentLang,
  onLanguageChange,
  onOpenPreferences,
  onOpenSettings,
  activeNav,
  onOpenMenu,
  onToggleCollapse,
  isSidebarCollapsed = false,
  standaloneMode = false,
  onBack,
  currentUser,
  onLogout,
  streakDays = 0,
  onOpenPractice,
  onNavigateToLessons,
  onNotificationAction,
}: HeaderProps) {
  const { tr, ui, locale } = useI18n();
  const { lang, setLang, t } = useLanguage();
  const panda = usePandaPet();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showLangMenu, setShowLanguageMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const dashboardQuery = useQuery({
    queryKey: [...dashboardQueryKeys.detail(), currentUser?.learningProfile?.hskLevel ?? null],
    queryFn: ({ signal }) => getLearnerDashboard({ signal } as never),
    enabled: Boolean(currentUser),
    staleTime: 30000,
  });
  const liveXP = dashboardQuery.data?.metrics?.totalXP ?? currentUser?.totalXP ?? 0;

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const sampleSearchSuggestions = [
    { title: 'Gọi món ở nhà hàng', category: 'Ẩm thực · HSK 3' },
    { title: 'Đặt phòng khách sạn', category: 'Du lịch · HSK 3' },
    { title: 'Rủ bạn đi xem phim', category: 'Giải trí · HSK 3' },
    { title: 'Mặc cả mua sắm', category: 'Mua sắm · HSK 3' },
    { title: 'Phỏng vấn xin việc', category: 'Kinh doanh · HSK 3' },
  ].filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchFocused(false);
      }
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setShowLanguageMenu(false);
      }
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'zh', label: '中文 (简体)', flag: '🇨🇳' },
  ];

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (val.trim()) {
      panda?.triggerReaction('searching', 3500);
    } else {
      panda?.setPandaState('idle');
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    panda?.setPandaState('idle');
  };

  const isUserPremium =
    currentUser?.role === 'admin' ||
    Boolean(currentUser?.premiumExpiresAt && new Date(currentUser.premiumExpiresAt) > new Date());

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-[#E7E7EA] px-2 sm:px-4 md:pr-7 flex items-center justify-between shadow-xs safe-area-top min-h-[64px] sm:min-h-[68px]">
      {/* Left: Hamburger / Back Button + Brand Logo */}
      <div className="flex items-center shrink-0">
        {standaloneMode ? (
          <button
            onClick={() => {
              if (onBack) onBack();
              else navigate(-1);
            }}
            aria-label={tr("Quay lại")}
            title={tr("Quay lại")}
            className="h-10 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold text-[#5F6368] hover:text-[#B91B1C] hover:bg-[#FFF2EE] active:scale-95 transition-all cursor-pointer mr-2"
          >
            <ArrowLeft className="w-4 h-4 text-[#B91B1C]" />
            <span className="hidden sm:inline">{tr("Quay lại")}</span>
          </button>
        ) : (
          <div className="w-10 sm:w-12 lg:w-[72px] flex items-center justify-center shrink-0">
            <button
              onClick={() => {
                if (window.innerWidth < 1024) {
                  onOpenMenu?.();
                } else {
                  onToggleCollapse?.();
                }
              }}
              aria-label={isSidebarCollapsed ? tr("Mở rộng thanh điều hướng") : tr("Thu gọn thanh điều hướng")}
              title={isSidebarCollapsed ? tr("Mở rộng thanh điều hướng") : tr("Thu gọn thanh điều hướng")}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9] active:scale-95 transition-all cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        )}
        <div
          onClick={() => {
            if (currentUser) {
              if (currentUser.role === 'admin') navigate('/admin');
              else navigate('/feed');
            } else {
              navigate('/');
            }
          }}
          className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer select-none py-1"
        >
          <img
            src="/assets/logo.png"
            alt="HanFlix Logo"
            className="h-7 sm:h-8 md:h-10 w-auto max-w-[110px] sm:max-w-[160px] md:max-w-[190px] object-contain hover:scale-105 transition-transform drop-shadow-xs"
          />
          <span className="hidden md:inline-block px-2.5 py-0.5 text-[10px] font-bold text-[#B91B1C] bg-[#FDF1F1] rounded-full border border-[#F0D4D4]">
            {currentUser?.learningProfile?.hskLevel ? `HSK ${currentUser.learningProfile.hskLevel}` : tr("Chưa chọn HSK")}
          </span>
        </div>
      </div>

      {/* Middle: Search bar */}
      <div className="relative flex-1 min-w-0 max-w-[500px] mx-1.5 sm:mx-4" ref={searchContainerRef}>
        <div
          className={`relative flex items-center h-9 sm:h-10 px-3 sm:px-4 rounded-full bg-[#F7F7F9] border transition-all ${
            isSearchFocused
              ? 'border-[#B91B1C] bg-white ring-2 ring-[#B91B1C]/10 shadow-xs'
              : 'border-[#E7E7EA] hover:border-[#D1D5DB]'
          }`}
        >
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8B9097] mr-1.5 sm:mr-2.5 shrink-0" />
          <input
            type="text"
            placeholder={t.header.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => {
              setIsSearchFocused(true);
              if (searchQuery.trim()) panda?.triggerReaction('searching', 3500);
            }}
            className="w-full text-xs sm:text-sm text-[#18181B] bg-transparent outline-none placeholder:text-[#8B9097] truncate"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="p-1 text-[#8B9097] hover:text-[#18181B] rounded-full hover:bg-gray-200 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Suggestions Dropdown */}
        {isSearchFocused && searchQuery.length >= 1 && (
          <div className="absolute left-0 right-0 top-12 bg-white rounded-2xl border border-[#E7E7EA] shadow-lg py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-4 py-1.5 text-xs font-semibold text-[#8B9097] uppercase tracking-wider">
              {t.header.searchSuggestions}
            </div>
            {sampleSearchSuggestions.length > 0 ? (
              sampleSearchSuggestions.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSearchQuery(item.title);
                    setIsSearchFocused(false);
                    panda?.triggerReaction('success', 2000);
                    if (onSearchSelect) onSearchSelect(item.title);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#FDF1F1] flex items-center justify-between group transition-colors cursor-pointer"
                >
                  <span className="text-sm font-medium text-[#18181B] group-hover:text-[#B91B1C]">
                    {item.title}
                  </span>
                  <span className="text-xs text-[#8B9097] bg-[#F7F7F9] px-2 py-0.5 rounded-full">
                    {item.category}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-[#8B9097] text-center">
                {t.header.noResults} &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0">
        {/* Nâng cấp Premium Button (Style chuẩn ảnh Hanzii với Sale badge góc trên) */}
        <div className="relative shrink-0 mr-1 sm:mr-1.5">
          <button
            type="button"
            onClick={() => navigate('/premium')}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95 ${
              isUserPremium
                ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-white shadow-amber-500/20'
                : 'bg-[#FFF2EE] hover:bg-[#FFE6DF] text-[#B91B1C] border border-[#F2D0C7]'
            }`}
          >
            <Crown className={`w-3.5 h-3.5 ${isUserPremium ? 'fill-white text-white' : 'text-[#B91B1C] fill-[#B91B1C]/20'}`} />
            <span>{isUserPremium ? 'VIP' : tr("Nâng cấp")}</span>
          </button>
          {!isUserPremium && (
            <span className="absolute -top-2.5 -right-1 px-1.5 py-0.5 rounded-full bg-[#E53935] text-white text-[9px] font-black tracking-wider uppercase rotate-12 shadow-xs pointer-events-none select-none">
              {tr("Sale")}
            </span>
          )}
        </div>

        {/* Interactive Streak Dropdown Center */}
        <StreakDropdown
          initialStreakDays={streakDays}
          dailyMinutes={currentUser?.learningProfile?.dailyMinutes}
          onOpenPractice={onOpenPractice}
          onNavigateToLessons={onNavigateToLessons}
        />

        {/* Notifications Dropdown */}
        <NotificationsDropdown onSelectAction={onNotificationAction} />

        {/* Language Switcher */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setShowLanguageMenu(!showLangMenu)}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9] transition-colors cursor-pointer"
            title={t.header.language}
            aria-label={t.header.language}
          >
            <Globe className="w-5 h-5" />
          </button>

          {showLangMenu && (
            <div className="absolute right-0 top-12 w-52 max-w-[calc(100vw-24px)] bg-white rounded-2xl border border-[#E7E7EA] shadow-xl py-2 z-50 animate-in fade-in duration-150">
              <div className="px-3.5 py-1.5 text-xs font-bold text-[#8B9097] border-b border-[#E7E7EA] mb-1">
                {t.header.language}
              </div>
              {languages.map((item) => (
                <button
                  key={item.code}
                  onClick={() => {
                    setLang(item.code);
                    if (onLanguageChange !== setLang) onLanguageChange?.(item.code);
                    setShowLanguageMenu(false);
                  }}
                  className={`w-full px-3.5 py-2.5 text-left text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                    lang === item.code ? 'bg-[#FFF5F5] text-[#B91B1C]' : 'hover:bg-[#F7F7F9] text-[#18181B]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-base">{item.flag}</span>
                    <span lang={item.code}>{ui(item.label)}</span>
                  </span>
                  {lang === item.code && <Check className="w-4 h-4 text-[#B91B1C] stroke-[3]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Profile Avatar */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-0.5 sm:p-1 rounded-full hover:bg-[#F7F7F9] transition-colors cursor-pointer"
          >
            <UserAvatar
              user={currentUser}
              size={36}
              className="border-2 border-white shadow-xs"
            />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-12 w-64 max-w-[calc(100vw-24px)] bg-white rounded-2xl border border-[#E7E7EA] shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-3 border-b border-[#E7E7EA]">
                <div className="font-bold text-sm text-[#18181B] truncate">
                  {currentUser?.name || t.header.learner}
                </div>
                <div className="text-xs text-[#8B9097] mt-0.5 truncate">
                  {currentUser?.email || ''}
                </div>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#34363A] text-white text-[11px] font-semibold">
                    <span>{currentUser?.learningProfile?.hskLevel ? `HSK ${currentUser.learningProfile.hskLevel}` : tr("Chưa chọn HSK")}</span>
                    <span>·</span>
                    <span className="text-[#E7A92F]">Intermediate</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate('/leaderboard');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-200/90 text-amber-900 text-[11px] font-bold shadow-2xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    title={tr("Điểm kinh nghiệm (XP) · Nhấn để xem Bảng xếp hạng")}
                  >
                    <Sparkles className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />
                    <span>{liveXP.toLocaleString(locale)} XP</span>
                  </button>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                {/* Admin Dashboard */}
                {currentUser?.role === 'admin' && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate('/admin');
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-bold text-[#B91B1C] hover:bg-[#FDF1F1] flex items-center gap-3 transition-colors cursor-pointer border-b border-[#E7E7EA]"
                  >
                    <Shield className="w-4 h-4 text-[#B91B1C]" />
                    <span>{tr("Trang Quản Trị")}</span>
                  </button>
                )}

                {/* Account Settings */}
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenSettings?.();
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#18181B] hover:bg-[#F7F7F9] flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-[#5F6368]" />
                  <span>{t.header.accountSettings}</span>
                </button>

                {/* Survey */}
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenPreferences?.();
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9] flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <Compass className="w-4 h-4 text-[#B91B1C]" />
                  <span>{t.header.learningSurvey}</span>
                </button>

                {/* Payment History */}
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate('/payment-history');
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9] flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <span
                    className="material-symbols-outlined text-[#5F6368] select-none flex items-center justify-center shrink-0 leading-none"
                    style={{ fontSize: '16px', width: '16px', height: '16px' }}
                    aria-hidden="true"
                  >
                    receipt_long
                  </span>
                  <span>{t.header.paymentHistory}</span>
                </button>
              </div>

              <div className="border-t border-[#E7E7EA] my-1" />

              <button
                onClick={() => {
                  setShowUserMenu(false);
                  if (onLogout) onLogout();
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-[#B91B1C] font-semibold hover:bg-[#FDF1F1] flex items-center gap-3 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-[#B91B1C]" />
                <span>{t.header.logout}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
