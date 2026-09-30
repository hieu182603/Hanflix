import { useI18n } from '../../i18n';
import React, { useState, useRef, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Bell,
  CheckCheck,
  Flame,
  Play,
  GraduationCap,
  Bookmark,
  X,
  ArrowRight,
  BellOff,
  Video,
  Loader2,
  ChevronDown,
} from "lucide-react"
import { useLanguage } from "../../i18n"
import { LOCALES } from '../../i18n/messages';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllAsRead,
  markNotificationAsRead,
  deleteNotification,
  type ApiNotificationItem,
} from "../../api/notifications"
import { notificationQueryKeys } from "../../api/queryKeys"
import { useNotification } from "./NotificationProvider"

interface NotificationListResponse {
  items: ApiNotificationItem[]
  total: number
  unreadCount: number
  page: number
  limit: number
  totalPages: number
}

interface UnreadCountResponse {
  unreadCount: number
}

type Filter = "all" | "unread" | "study" | "system"

const PAGE_SIZE = 20

/**
 * Format "X phút trước" đa ngôn ngữ. Hook phải re-render mỗi phút để "1
 * phút trước" → "2 phút trước" khi user mở dropdown lâu.
 */
function formatRelativeTime(
  dateString: string,
  lang: "vi" | "en" | "zh",
): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = Math.max(0, now.getTime() - date.getTime())
    const diffMin = Math.floor(diffMs / 1000 / 60)
    const diffHours = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMin < 1) {
      return lang === "en" ? "Just now" : lang === "zh" ? "刚刚" : "Vừa xong"
    }
    if (diffMin < 60) {
      return lang === "en"
        ? `${diffMin}m ago`
        : lang === "zh"
          ? `${diffMin}分钟前`
          : `${diffMin} phút trước`
    }
    if (diffHours < 24) {
      return lang === "en"
        ? `${diffHours}h ago`
        : lang === "zh"
          ? `${diffHours}小时前`
          : `${diffHours} giờ trước`
    }
    if (diffDays === 1) {
      return lang === "en" ? "Yesterday" : lang === "zh" ? "昨天" : "Hôm qua"
    }
    if (diffDays < 30) {
      return lang === "en"
        ? `${diffDays}d ago`
        : lang === "zh"
          ? `${diffDays}天前`
          : `${diffDays} ngày trước`
    }
    return date.toLocaleDateString(LOCALES[lang])
  } catch {
    return ""
  }
}

/**
 * Custom hook: re-render mỗi 60s để formatRelativeTime cập nhật tự động
 * (vd. "5 phút trước" → "6 phút trước" mà không cần user đóng/mở dropdown).
 */
function useMinuteTicker(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return tick
}

export default function NotificationsDropdown({
  onSelectAction,
}: {
  onSelectAction?: (actionUrl?: string) => void
}) {
  const { tr, ui } = useI18n();
  const { lang, t } = useLanguage()
  const notify = useNotification()
  const [isOpen, setIsOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState<Filter>("all")
  const [page, setPage] = useState(1)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const queryClient = useQueryClient()
  useMinuteTicker()

  const { data: unreadData } = useQuery({
    queryKey: notificationQueryKeys.unreadCount(),
    queryFn: () => fetchUnreadCount(),
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const unreadCount = unreadData?.unreadCount ?? 0

  const {
    data: listData,
    isLoading: isListLoading,
    isFetching,
  } = useQuery({
    queryKey: notificationQueryKeys.list({ filter: activeFilter, page }),
    queryFn: () =>
      fetchNotifications({ filter: activeFilter, page, limit: PAGE_SIZE }),
    enabled: isOpen,
    staleTime: 5_000,
  })

  const notifications = listData?.items ?? []
  const totalPages = listData?.totalPages ?? 1

  const markAllMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: (data) => {
      queryClient.setQueryData<UnreadCountResponse>(
        notificationQueryKeys.unreadCount(),
        { unreadCount: 0 },
      )
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.root })
      notify.success(
        lang === "en"
          ? `Marked ${data.updatedCount} as read`
          : lang === "zh"
            ? `已标记 ${data.updatedCount} 条为已读`
            : `Đã đánh dấu ${data.updatedCount} thông báo đã đọc`,
      )
    },
    onError: () => {
      notify.error(
        lang === "en"
          ? "Failed to mark all as read"
          : lang === "zh"
            ? "无法标记全部已读"
            : "Không thể đánh dấu tất cả đã đọc",
      )
    },
  })

  const toggleReadMutation = useMutation({
    mutationFn: ({ id, isRead }: { id: string; isRead: boolean }) =>
      markNotificationAsRead(id, isRead),
    onMutate: async ({ id, isRead }) => {
      await queryClient.cancelQueries({ queryKey: notificationQueryKeys.root })
      const previousLists =
        queryClient.getQueriesData<NotificationListResponse>({
          queryKey: notificationQueryKeys.root,
        })
      const previousCount = queryClient.getQueryData<UnreadCountResponse>(
        notificationQueryKeys.unreadCount(),
      )

      queryClient.setQueriesData<NotificationListResponse>(
        { queryKey: notificationQueryKeys.root, exact: false },
        (old) => {
          if (!old) return old
          const delta = (() => {
            const target = old.items.find((n) => n._id === id)
            if (!target) return 0
            if (target.isRead === isRead) return 0
            return isRead ? -1 : 1
          })()
          return {
            ...old,
            items: old.items.map((n) => (n._id === id ? { ...n, isRead } : n)),
            unreadCount: Math.max(0, old.unreadCount + delta),
          }
        },
      )
      queryClient.setQueryData<UnreadCountResponse>(
        notificationQueryKeys.unreadCount(),
        (old) =>
          old
            ? {
                unreadCount: Math.max(0, old.unreadCount + (isRead ? -1 : 1)),
              }
            : old,
      )

      return { previousLists, previousCount }
    },
    onError: (_err, _vars, context) => {
      if (!context) return
      for (const [key, data] of context.previousLists) {
        queryClient.setQueryData(key, data)
      }
      if (context.previousCount) {
        queryClient.setQueryData(
          notificationQueryKeys.unreadCount(),
          context.previousCount,
        )
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: notificationQueryKeys.unreadCount(),
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationQueryKeys.root })
      const previousLists =
        queryClient.getQueriesData<NotificationListResponse>({
          queryKey: notificationQueryKeys.root,
        })
      queryClient.setQueriesData<NotificationListResponse>(
        { queryKey: notificationQueryKeys.root, exact: false },
        (old) => {
          if (!old) return old
          const removed = old.items.find((n) => n._id === id)
          return {
            ...old,
            items: old.items.filter((n) => n._id !== id),
            total: Math.max(0, old.total - 1),
            unreadCount:
              removed && !removed.isRead
                ? Math.max(0, old.unreadCount - 1)
                : old.unreadCount,
          }
        },
      )
      return { previousLists }
    },
    onError: (_err, _vars, context) => {
      if (!context) return
      for (const [key, data] of context.previousLists) {
        queryClient.setQueryData(key, data)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.root })
    },
  })

  // Close on click outside + ESC + restore focus
  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKey)
    }
  }, [isOpen])

  // Reset page when switching filter
  useEffect(() => {
    setPage(1)
  }, [activeFilter])

  const handleMarkAllAsRead = () => {
    markAllMutation.mutate()
  }

  const handleToggleRead = (notif: ApiNotificationItem) => {
    toggleReadMutation.mutate({ id: notif._id, isRead: !notif.isRead })
  }

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteMutation.mutate(id)
  }

  const handleActionClick = (
    e: React.MouseEvent,
    notif: ApiNotificationItem,
  ) => {
    e.stopPropagation()
    setIsOpen(false)
    if (!notif.isRead) {
      toggleReadMutation.mutate({ id: notif._id, isRead: true })
    }
    onSelectAction?.(notif.actionUrl)
  }

  const renderIcon = useMemo(
    () => (type: ApiNotificationItem["type"]) => {
      const common =
        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
      switch (type) {
        case "streak":
          return (
            <div
              className={`${common} bg-[#FFF8E6] border border-[#E7A92F]/30 text-[#D97706]`}
            >
              <Flame className="w-4 h-4 fill-current" />
            </div>
          )
        case "lesson":
          return (
            <div
              className={`${common} bg-[#FDF1F1] border border-[#B91B1C]/20 text-[#B91B1C]`}
            >
              <Play className="w-4 h-4 fill-current" />
            </div>
          )
        case "quiz":
          return (
            <div
              className={`${common} bg-[#EBF5EE] border border-[#1E7E44]/25 text-[#1E7E44]`}
            >
              <GraduationCap className="w-4 h-4" />
            </div>
          )
        case "vocab":
          return (
            <div
              className={`${common} bg-[#EFF6FF] border border-[#2563EB]/25 text-[#2563EB]`}
            >
              <Bookmark className="w-4 h-4 fill-current" />
            </div>
          )
        case "video_pipeline":
          return (
            <div
              className={`${common} bg-[#F3E8FF] border border-[#9333EA]/20 text-[#9333EA]`}
            >
              <Video className="w-4 h-4" />
            </div>
          )
        default:
          return (
            <div
              className={`${common} bg-[#F4F4F6] border border-[#E7E7EA] text-[#5F6368]`}
            >
              <Bell className="w-4 h-4" />
            </div>
          )
      }
    },
    [],
  )

  const tabs: Array<{ id: Filter; label: string }> = useMemo(
    () => [
      { id: "all", label: t.header.all },
      { id: "unread", label: t.header.unread },
      { id: "study", label: t.header.study },
      { id: "system", label: t.header.system },
    ],
    [t.header.all, t.header.unread, t.header.study, t.header.system],
  )

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t.header.notifications}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        // SR-only announcement khi unread count thay đổi (aria-live="polite"
        // để không interrupt user đang focus khác).
        className="w-10 h-10 rounded-full flex items-center justify-center text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9] transition-colors relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C]"
        title={t.header.notifications}
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        <span aria-live="polite" aria-atomic="true" className="sr-only">
          {unreadCount > 0
            ? lang === "en"
              ? `${unreadCount} unread notifications`
              : lang === "zh"
                ? `${unreadCount} 条未读通知`
                : tr("{0} thông báo chưa đọc", { 0: unreadCount })
            : ""}
        </span>
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-[#B91B1C] text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white shadow-xs"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && // Mobile: dropdown tràn viewport. Dùng fixed + safe inset.
      (
        <div
          role="dialog"
          aria-label={t.header.notifications}
          className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 top-14 sm:top-12 w-auto sm:w-[400px] bg-white rounded-3xl border border-[#E7E7EA] shadow-2xl py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col max-h-[85vh]"
        >
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
                disabled={markAllMutation.isPending}
                className="text-xs text-[#B91B1C] hover:text-[#9B1516] font-bold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C] rounded"
                title={t.header.markAllRead}
              >
                <CheckCheck
                  className="w-3.5 h-3.5 stroke-[2.5]"
                  aria-hidden="true"
                />
                <span>{t.header.markAllRead}</span>
              </button>
            )}
          </div>

          <div
            role="tablist"
            aria-label={t.header.notifications}
            className="flex items-center gap-1 px-4 py-2 bg-[#FAF9FA] border-b border-[#E7E7EA] shrink-0 text-xs font-bold overflow-x-auto"
          >
            {tabs.map((tab) => {
              const selected = activeFilter === tab.id
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={selected}
                  type="button"
                  onClick={() => {
                    setActiveFilter(tab.id)
                    setPage(1)
                  }}
                  className={`px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C] ${
                    selected
                      ? "bg-[#18181B] text-white shadow-2xs"
                      : "text-[#5F6368] hover:text-[#18181B] hover:bg-[#EAEAEF]"
                  }`}
                >
                  {ui(tab.label)}
                </button>
              )
            })}
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-gray-100 min-h-[160px]">
            {isListLoading ? (
              <div className="p-8 flex flex-col items-center justify-center space-y-2 text-[#8B9097]">
                <Loader2
                  className="w-6 h-6 animate-spin text-[#B91B1C]"
                  aria-hidden="true"
                />
                <span className="text-xs font-medium">
                  {lang === "en"
                    ? "Loading notifications..."
                    : lang === "zh"
                      ? "正在加载通知..."
                      : tr("Đang tải thông báo...")}
                </span>
              </div>
            ) : notifications.length > 0 ? (
              notifications.map((notif) => (
                <div
                  key={notif._id}
                  role="article"
                  onClick={() => handleToggleRead(notif)}
                  className={`p-4 hover:bg-[#F9F9FB] transition-colors cursor-pointer flex items-start gap-3.5 group relative focus-within:bg-[#F9F9FB] ${
                    !notif.isRead ? "bg-[#FFF8F8]/60" : "bg-white"
                  }`}
                >
                  {renderIcon(notif.type)}

                  <div className="flex-1 min-w-0 pr-4">
                    <h4
                      className={`text-xs font-bold leading-snug truncate ${
                        !notif.isRead ? "text-[#18181B]" : "text-[#5F6368]"
                      }`}
                    >
                      {notif.title[lang] || notif.title.vi}
                    </h4>

                    <p className="text-xs text-[#5F6368] mt-1 leading-relaxed line-clamp-2">
                      {notif.message[lang] || notif.message.vi}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-1 gap-2">
                      <span className="text-[10px] text-[#8B9097] font-medium whitespace-nowrap">
                        {formatRelativeTime(notif.createdAt, lang)}
                      </span>

                      {notif.actionText && (
                        <button
                          type="button"
                          onClick={(e) => handleActionClick(e, notif)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B91B1C] hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C] rounded"
                        >
                          <span>
                            {notif.actionText[lang] || notif.actionText.vi}
                          </span>
                          <ArrowRight className="w-3 h-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="absolute right-3.5 top-4 flex items-center gap-1">
                    {!notif.isRead && (
                      <span
                        aria-hidden="true"
                        className="w-2 h-2 rounded-full bg-[#B91B1C] group-hover:opacity-0 transition-opacity"
                      />
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDismiss(e, notif._id)}
                      className="p-1 rounded-md text-[#8B9097] hover:text-[#18181B] hover:bg-gray-200 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C]"
                      aria-label={
                        lang === "en"
                          ? "Delete notification"
                          : lang === "zh"
                            ? "删除通知"
                            : tr("Xóa thông báo")
                      }
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#F7F7F9] text-[#8B9097] flex items-center justify-center">
                  <BellOff
                    className="w-6 h-6 stroke-[1.5]"
                    aria-hidden="true"
                  />
                </div>
                <div className="font-bold text-sm text-[#18181B]">
                  {t.header.noNotifications}
                </div>
                <p className="text-xs text-[#5F6368] max-w-[220px]">
                  {t.header.noNotificationsSub}
                </p>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="px-5 py-2.5 border-t border-[#E7E7EA] flex items-center justify-between shrink-0 text-xs">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isFetching}
                className="font-bold text-[#5F6368] hover:text-[#18181B] disabled:opacity-40 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C] rounded px-2 py-1"
              >
                ‹ {lang === "en" ? "Prev" : lang === "zh" ? "上一页" : tr("Trước")}
              </button>
              <span className="text-[#8B9097] font-medium">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || isFetching}
                className="font-bold text-[#5F6368] hover:text-[#18181B] disabled:opacity-40 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C] rounded px-2 py-1 inline-flex items-center gap-1"
              >
                {lang === "en" ? "Next" : lang === "zh" ? "下一页" : tr("Sau")}{" "}
                <ChevronDown
                  className="w-3 h-3 -rotate-90"
                  aria-hidden="true"
                />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
