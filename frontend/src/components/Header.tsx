import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Globe, User, Sparkles, ChevronDown, Check, X, Flame, Menu } from 'lucide-react';
import { MOCK_NOTIFICATIONS } from '../data/hanflixData';

interface HeaderProps {
  onSearchSelect?: (query: string) => void;
  currentLang: string;
  onLanguageChange: (lang: string) => void;
  onOpenPreferences?: () => void;
  onOpenAI?: () => void;
  activeNav: string;
  onOpenMenu?: () => void;
  currentUser?: {
    name: string;
    email: string;
    avatarAsset?: string | null;
    learningProfile?: { hskLevel?: number } | null;
  };
  onLogout?: () => void;
  streakDays?: number;
}

export default function Header({
  onSearchSelect,
  currentLang,
  onLanguageChange,
  onOpenPreferences,
  onOpenAI,
  activeNav,
  onOpenMenu,
  currentUser,
  onLogout,
  streakDays = 14,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLangMenu, setShowLanguageMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(2);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const sampleSearchSuggestions = [
    { title: 'Gọi món ở nhà hàng', category: 'Ẩm thực · HSK 3' },
    { title: 'Đặt phòng khách sạn', category: 'Du lịch · HSK 3' },
    { title: 'Rủ bạn đi xem phim', category: 'Giải trí · HSK 3' },
    { title: 'Mặc cả mua sắm', category: 'Mua sắm · HSK 3' },
    { title: 'Phỏng vấn xin việc', category: 'Kinh doanh · HSK 3' }
  ].filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
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

  const languages = [
    { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳', disabled: false },
    { code: 'en', label: 'English — Sắp có', flag: '🇬🇧', disabled: true },
    { code: 'zh', label: '中文 — Sắp có', flag: '🇨🇳', disabled: true }
  ];

  return (
    <header className="sticky top-0 z-40 w-full h-[68px] bg-white border-b border-[#E7E7EA] px-4 md:px-7 flex items-center justify-between shadow-xs">
      {/* Left: Hamburger (mobile) + Brand Logo */}
      <div className="flex items-center gap-3">
        {onOpenMenu && (
          <button
            onClick={onOpenMenu}
            aria-label="Mở menu"
            className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-[#5F6368] hover:bg-[#F7F7F9] transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <a href="#" className="flex items-center group py-0.5" aria-label="HanFlix Trang chủ">
          <img
            src="/assets/logo.png"
            alt="HanFlix Logo"
            className="h-11 sm:h-12 w-auto max-w-[210px] object-contain group-hover:scale-105 transition-transform"
          />
        </a>
      </div>

      {/* Middle: Search bar */}
      <div className="relative flex-1 max-w-[500px] mx-4" ref={searchContainerRef}>
        <div className={`relative flex items-center h-10 px-4 rounded-full bg-[#F7F7F9] border transition-all ${
          isSearchFocused ? 'border-[#B91B1C] bg-white ring-2 ring-[#B91B1C]/10 shadow-xs' : 'border-[#E7E7EA] hover:border-[#D1D5DB]'
        }`}>
          <Search className="w-4 h-4 text-[#8B9097] mr-2.5 shrink-0" />
          <input
            type="text"
            placeholder="Tìm kiếm video, từ vựng, ngữ pháp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            className="w-full text-sm text-[#18181B] bg-transparent outline-none placeholder:text-[#8B9097]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 text-[#8B9097] hover:text-[#18181B] rounded-full hover:bg-gray-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Suggestions Dropdown */}
        {isSearchFocused && searchQuery.length >= 1 && (
          <div className="absolute left-0 right-0 top-12 bg-white rounded-2xl border border-[#E7E7EA] shadow-lg py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-4 py-1.5 text-xs font-semibold text-[#8B9097] uppercase tracking-wider">
              Gợi ý tìm kiếm
            </div>
            {sampleSearchSuggestions.length > 0 ? (
              sampleSearchSuggestions.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSearchQuery(item.title);
                    setIsSearchFocused(false);
                    if (onSearchSelect) onSearchSelect(item.title);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#FDF1F1] flex items-center justify-between group transition-colors"
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
                Không tìm thấy bài học phù hợp với &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Streak indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF2C8] text-[#9A6A00] text-xs font-bold border border-[#E7A92F]/20">
          <Flame className="w-4 h-4 text-[#E7A92F] fill-[#E7A92F]" />
          <span>{streakDays} ngày streak</span>
        </div>

        {/* Ask AI quick button in header */}
        <button
          onClick={onOpenAI}
          className="hidden lg:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FDF1F1] text-[#B91B1C] hover:bg-[#B91B1C] hover:text-white transition-colors text-xs font-semibold border border-[#B91B1C]/20"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Hỏi AI</span>
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9] transition-colors relative"
            title="Thông báo"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#B91B1C] rounded-full ring-2 ring-white" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl border border-[#E7E7EA] shadow-xl py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 pb-2 border-b border-[#E7E7EA] flex items-center justify-between">
                <span className="font-bold text-sm text-[#18181B]">Thông báo</span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => setUnreadCount(0)}
                    className="text-xs text-[#B91B1C] font-semibold hover:underline"
                  >
                    Đánh dấu đã đọc
                  </button>
                )}
              </div>
              <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {MOCK_NOTIFICATIONS.map((notif) => (
                  <div key={notif.id} className={`p-3.5 hover:bg-[#F7F7F9] transition-colors cursor-pointer ${notif.unread ? 'bg-[#FDF1F1]/50' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-[#18181B]">{notif.title}</span>
                      <span className="text-[10px] text-[#8B9097] shrink-0">{notif.time}</span>
                    </div>
                    <p className="text-xs text-[#5F6368] mt-1 leading-relaxed">{notif.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Language selector */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setShowLanguageMenu(!showLangMenu)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9] transition-colors"
            title="Đổi ngôn ngữ giao diện"
          >
            <Globe className="w-5 h-5" />
          </button>

          {showLangMenu && (
            <div className="absolute right-0 top-12 w-48 bg-white rounded-2xl border border-[#E7E7EA] shadow-xl py-2 z-50">
              <div className="px-3 py-1.5 text-xs font-semibold text-[#8B9097]">Ngôn ngữ giao diện</div>
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    if (!lang.disabled) {
                      onLanguageChange(lang.code);
                      setShowLanguageMenu(false);
                    }
                  }}
                  disabled={lang.disabled}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors ${
                    lang.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#F7F7F9]'
                  }`}
                  title={lang.disabled ? 'Đang cập nhật bản dịch' : ''}
                >
                  <span className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span className="font-medium text-[#18181B]">{lang.label}</span>
                  </span>
                  {currentLang === lang.code && <Check className="w-4 h-4 text-[#B91B1C]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Profile Avatar */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-[#F7F7F9] transition-colors"
          >
            <img
              src={currentUser?.avatarAsset || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces'}
              alt={currentUser?.name || 'Avatar'}
              className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-xs"
              onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/avatar/40/40'; }}
            />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-12 w-56 bg-white rounded-2xl border border-[#E7E7EA] shadow-xl py-2 z-50">
              <div className="px-4 py-3 border-b border-[#E7E7EA]">
                <div className="font-bold text-sm text-[#18181B]">{currentUser?.name || 'Học viên'}</div>
                <div className="text-xs text-[#8B9097] mt-0.5">{currentUser?.email || ''}</div>
                <div className="mt-2 inline-block px-2 py-0.5 rounded-full bg-[#34363A] text-white text-[11px] font-semibold">
                  HSK {currentUser?.learningProfile?.hskLevel || 3} · Intermediate
                </div>
              </div>
              <button
                onClick={() => {
                  if (onOpenPreferences) onOpenPreferences();
                  setShowUserMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9]"
              >
                Cập nhật mục tiêu & sở thích
              </button>
              <div className="border-t border-[#E7E7EA] my-1" />
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  if (onLogout) onLogout();
                }}
                className="w-full text-left px-4 py-2 text-sm text-[#B91B1C] font-semibold hover:bg-[#FDF1F1]"
              >
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
