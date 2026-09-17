import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  Flame,
  Play,
  GraduationCap,
  Bookmark,
  Sparkles,
  X,
  Clock,
  ArrowRight,
  BellOff,
  Check,
} from 'lucide-react';
import { useLanguage } from '../../i18n';

export interface NotificationItem {
  id: string;
  type: 'streak' | 'lesson' | 'exam' | 'vocab' | 'system';
  category: 'study' | 'system';
  title: {
    vi: string;
    en: string;
    zh: string;
  };
  message: {
    vi: string;
    en: string;
    zh: string;
  };
  time: {
    vi: string;
    en: string;
    zh: string;
  };
  unread: boolean;
  actionUrl?: string;
  actionText?: {
    vi: string;
    en: string;
    zh: string;
  };
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    type: 'streak',
    category: 'study',
    title: {
      vi: 'Duy trì chuỗi học 14 ngày!',
      en: 'Keep your 14-day streak alive!',
      zh: '保持14天连续学习纪录！',
    },
    message: {
      vi: 'Bạn chỉ còn 1 bài học ngắn nữa để hoàn thành mục tiêu ngày hôm nay.',
      en: 'Complete 1 short video lesson today to protect your study streak.',
      zh: '今天只需再完成1个简短视频课程即可保护您的连续打卡。',
    },
    time: {
      vi: '10 phút trước',
      en: '10m ago',
      zh: '10分钟前',
    },
    unread: true,
    actionText: {
      vi: 'Học ngay',
      en: 'Learn Now',
      zh: '立即学习',
    },
  },
  {
    id: 'notif-2',
    type: 'lesson',
    category: 'study',
    title: {
      vi: 'Bài học mới phù hợp mục tiêu của bạn',
      en: 'New lesson matched to your goal',
      zh: '为您推荐的新课程已上线',
    },
    message: {
      vi: 'Khóa học "Đàm phán giá & Hợp đồng thương mại" cấp độ HSK 3 đã sẵn sàng.',
      en: '"Price Negotiation & Commercial Contracts" (HSK 3) is now available.',
      zh: '《商务谈判与合同签约》（HSK 3级）新课程已准备就绪。',
    },
    time: {
      vi: '1 giờ trước',
      en: '1h ago',
      zh: '1小时前',
    },
    unread: true,
    actionText: {
      vi: 'Xem bài học',
      en: 'View Lesson',
      zh: '查看课程',
    },
  },
  {
    id: 'notif-3',
    type: 'exam',
    category: 'study',
    title: {
      vi: 'Kết quả bài thi thử HSK 3',
      en: 'HSK 3 Mock Exam Results',
      zh: 'HSK 3级模拟考试结果',
    },
    message: {
      vi: 'Bạn đạt 88/100 điểm phần Nghe hiểu. Rất xuất sắc!',
      en: 'You scored 88/100 on the Listening section. Great work!',
      zh: '您的听力理解部分获得 88/100 分。表现优异！',
    },
    time: {
      vi: 'Hôm qua',
      en: 'Yesterday',
      zh: '昨天',
    },
    unread: false,
    actionText: {
      vi: 'Xem chi tiết',
      en: 'View Report',
      zh: '查看报告',
    },
  },
  {
    id: 'notif-4',
    type: 'system',
    category: 'system',
    title: {
      vi: 'Cập nhật tính năng xem video mới',
      en: 'New YouTube-style video player update',
      zh: '全新影院级沉浸式播放器更新',
    },
    message: {
      vi: 'Trải nghiệm xem video liền mạch trong trang kèm phụ đề song ngữ tương tác.',
      en: 'Enjoy seamless in-page theater playback with interactive bilingual subtitles.',
      zh: '体验剧场级无缝播放与可交互双语对白字幕。',
    },
    time: {
      vi: '2 ngày trước',
      en: '2 days ago',
      zh: '2天前',
    },
    unread: false,
  },
];

export default function NotificationsDropdown({
  onSelectAction,
}: {
  onSelectAction?: (actionUrl?: string) => void;
}) {
  const { lang, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hanflix_notifications');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // fallback to initial
        }
      }
    }
    return INITIAL_NOTIFICATIONS;
  });

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'study' | 'system'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveNotifications = (updated: NotificationItem[]) => {
    setNotifications(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hanflix_notifications', JSON.stringify(updated));
    }
  };

  const handleMarkAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, unread: false }));
    saveNotifications(updated);
  };

  const handleToggleRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, unread: !n.unread } : n));
    saveNotifications(updated);
  };

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = notifications.filter((n) => n.id !== id);
    saveNotifications(updated);
  };

  const filteredNotifications = notifications.filter((item) => {
    if (activeFilter === 'unread') return item.unread;
    if (activeFilter === 'study') return item.category === 'study';
    if (activeFilter === 'system') return item.category === 'system';
    return true;
  });

  const renderIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'streak':
        return (
          <div className="w-9 h-9 rounded-xl bg-[#FFF8E6] border border-[#E7A92F]/30 text-[#D97706] flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4 fill-current" />
          </div>
        );
      case 'lesson':
        return (
          <div className="w-9 h-9 rounded-xl bg-[#FDF1F1] border border-[#B91B1C]/20 text-[#B91B1C] flex items-center justify-center shrink-0">
            <Play className="w-4 h-4 fill-current" />
          </div>
        );
      case 'exam':
        return (
          <div className="w-9 h-9 rounded-xl bg-[#EBF5EE] border border-[#1E7E44]/25 text-[#1E7E44] flex items-center justify-center shrink-0">
            <GraduationCap className="w-4 h-4" />
          </div>
        );
      case 'vocab':
        return (
          <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] border border-[#2563EB]/25 text-[#2563EB] flex items-center justify-center shrink-0">
            <Bookmark className="w-4 h-4 fill-current" />
          </div>
        );
      case 'system':
      default:
        return (
          <div className="w-9 h-9 rounded-xl bg-[#F4F4F6] border border-[#E7E7EA] text-[#5F6368] flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t.header.notifications}
        className="w-10 h-10 rounded-full flex items-center justify-center text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9] transition-colors relative cursor-pointer"
        title={t.header.notifications}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-[#B91B1C] text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Redesigned Notification Dropdown Card */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-[340px] sm:w-[400px] bg-white rounded-3xl border border-[#E7E7EA] shadow-2xl py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col max-h-[85vh]">
          {/* Top Bar */}
          <div className="px-5 py-2.5 border-b border-[#E7E7EA] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base text-[#18181B] tracking-tight">
                {t.header.notifications}
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#FFF5F5] text-[#B91B1C] text-[11px] font-bold">
                  {unreadCount} {t.header.unread.toLowerCase()}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-xs text-[#B91B1C] hover:text-[#9B1516] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title={t.header.markAllRead}
              >
                <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{t.header.markAllRead}</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 px-4 py-2 bg-[#FAF9FA] border-b border-[#E7E7EA] shrink-0 text-xs font-bold overflow-x-auto">
            {[
              { id: 'all', label: t.header.all },
              { id: 'unread', label: t.header.unread },
              { id: 'study', label: t.header.study },
              { id: 'system', label: t.header.system },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                  activeFilter === tab.id
                    ? 'bg-[#18181B] text-white shadow-2xs'
                    : 'text-[#5F6368] hover:text-[#18181B] hover:bg-[#EAEAEF]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notification List Body */}
          <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleToggleRead(notif.id)}
                  className={`p-4 hover:bg-[#F9F9FB] transition-colors cursor-pointer flex items-start gap-3.5 group relative ${
                    notif.unread ? 'bg-[#FFF8F8]/60' : 'bg-white'
                  }`}
                >
                  {/* Type Icon */}
                  {renderIcon(notif.type)}

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-start justify-between gap-1">
                      <h4
                        className={`text-xs font-bold leading-snug truncate ${
                          notif.unread ? 'text-[#18181B]' : 'text-[#5F6368]'
                        }`}
                      >
                        {notif.title[lang] || notif.title.vi}
                      </h4>
                    </div>

                    <p className="text-xs text-[#5F6368] mt-1 leading-relaxed line-clamp-2">
                      {notif.message[lang] || notif.message.vi}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-1">
                      <span className="text-[10px] text-[#8B9097] font-medium">
                        {notif.time[lang] || notif.time.vi}
                      </span>

                      {notif.actionText && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                            onSelectAction?.(notif.actionUrl);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B91B1C] hover:underline cursor-pointer"
                        >
                          <span>{notif.actionText[lang] || notif.actionText.vi}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Unread dot or Dismiss button on hover */}
                  <div className="absolute right-3.5 top-4 flex items-center">
                    {notif.unread && (
                      <span className="w-2 h-2 rounded-full bg-[#B91B1C] group-hover:opacity-0 transition-opacity" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDismiss(e, notif.id)}
                      className="p-1 rounded-md text-[#8B9097] hover:text-[#18181B] hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Xóa thông báo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              /* Empty State */
              <div className="p-8 text-center flex flex-col items-center justify-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#F7F7F9] text-[#8B9097] flex items-center justify-center">
                  <BellOff className="w-6 h-6 stroke-[1.5]" />
                </div>
                <div className="font-bold text-sm text-[#18181B]">{t.header.noNotifications}</div>
                <p className="text-xs text-[#5F6368] max-w-[220px]">
                  {t.header.noNotificationsSub}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
