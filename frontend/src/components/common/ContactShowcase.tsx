import React, { useState } from 'react';
import {
  MessageCircle,
  Mail,
  PhoneCall,
  UserCheck,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  HeartHandshake,
} from 'lucide-react';

interface ContactShowcaseProps {
  variant?: 'full' | 'sidebar' | 'footer';
  className?: string;
}

export default function ContactShowcase({
  variant = 'full',
  className = '',
}: ContactShowcaseProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const contactData = [
    {
      id: 'fanpage',
      title: 'Fanpage chính thức',
      value: 'Hanflix',
      subtitle: 'Kênh tin tức & giải đáp nhanh',
      badge: 'Cộng đồng',
      icon: MessageCircle,
      iconColor: 'text-[#B91B1C]',
      iconBg: 'bg-[#FFF2EE] border-[#F2D0C7]',
      href: 'https://facebook.com',
      isLink: true,
      actionText: 'Ghé thăm trang',
    },
    {
      id: 'lead',
      title: 'Trưởng dự án',
      value: 'Lê Quỳnh Anh',
      subtitle: 'Trực tiếp tiếp nhận đóng góp',
      badge: 'Project Lead',
      icon: UserCheck,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50 border-amber-200',
      isLink: false,
    },
    {
      id: 'email',
      title: 'Hộp thư điện tử',
      value: 'lequynhanh2806s2@gmail.com',
      subtitle: 'Tiếp nhận phản hồi & đối soát',
      badge: 'Email',
      icon: Mail,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50 border-blue-200',
      href: 'mailto:lequynhanh2806s2@gmail.com',
      isLink: true,
      canCopy: true,
      actionText: 'Gửi thư',
    },
    {
      id: 'phone',
      title: 'Hotline / Zalo',
      value: '0355987238',
      subtitle: 'Hỗ trợ trực tiếp 24/7',
      badge: 'Điện thoại',
      icon: PhoneCall,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50 border-emerald-200',
      href: 'tel:0355987238',
      isLink: true,
      canCopy: true,
      actionText: 'Gọi ngay',
    },
  ];

  // =========================================================================
  // VARIANT 1: SIDEBAR (Dành cho sidebar trang Lịch sử thanh toán)
  // =========================================================================
  if (variant === 'sidebar') {
    return (
      <div className={`p-5 rounded-3xl bg-white border border-[#E7E7EA] shadow-xs space-y-3.5 ${className}`}>
        <div className="flex items-center gap-2 text-[#18181B]">
          <div className="w-8 h-8 rounded-xl bg-[#FFF2EE] border border-[#F2D0C7] text-[#B91B1C] flex items-center justify-center shrink-0">
            <HeartHandshake className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-[#18181B] leading-tight">Liên hệ & Hỗ trợ</h3>
            <p className="text-[11px] text-[#5F6368]">Mọi thắc mắc và đóng góp ý kiến</p>
          </div>
        </div>

        <div className="space-y-2">
          {contactData.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="p-2.5 rounded-2xl bg-[#FAF9F7] border border-[#E7E7EA]/80 hover:border-[#F2D0C7] transition-all flex items-center justify-between gap-2.5 group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${item.iconBg} ${item.iconColor}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-[#8B9097] uppercase tracking-wider">
                      {item.title}
                    </div>
                    <div className="text-xs font-black text-[#18181B] truncate">
                      {item.isLink && item.href ? (
                        <a
                          href={item.href}
                          target={item.href.startsWith('http') ? '_blank' : undefined}
                          rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
                          className="hover:text-[#B91B1C] transition-colors"
                        >
                          {item.value}
                        </a>
                      ) : (
                        item.value
                      )}
                    </div>
                  </div>
                </div>

                {item.canCopy && (
                  <button
                    type="button"
                    onClick={() => handleCopy(item.value, item.id)}
                    className="p-1.5 rounded-lg text-[#8B9097] hover:text-[#18181B] hover:bg-white transition-colors cursor-pointer shrink-0"
                    title={`Sao chép ${item.title}`}
                  >
                    {copiedType === item.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VARIANT 2: FOOTER (Dành cho chân trang Landing Page)
  // =========================================================================
  if (variant === 'footer') {
    return (
      <div className={`space-y-3.5 ${className}`}>
        <div className="space-y-1">
          <h4 className="font-bold text-sm text-[#18181B] uppercase tracking-wider flex items-center gap-1.5">
            <span className="text-[#B91B1C]">🏮</span>
            <span>Liên Hệ & Đóng Góp</span>
          </h4>
          <p className="text-xs text-[#5F6368] leading-relaxed">
            Mọi thắc mắc và ý kiến đóng góp xin vui lòng liên hệ:
          </p>
        </div>

        <div className="space-y-2 text-xs">
          {contactData.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="p-2.5 rounded-2xl bg-white/90 hover:bg-white border border-[#F2E4D8] hover:border-[#B91B1C]/35 flex items-center justify-between gap-3 transition-all shadow-2xs group"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${item.iconBg} ${item.iconColor}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-[#8B9097] font-semibold block uppercase tracking-wider">
                      {item.title}
                    </span>
                    <div className="font-bold text-[#18181B] text-xs">
                      {item.isLink && item.href ? (
                        <a
                          href={item.href}
                          target={item.href.startsWith('http') ? '_blank' : undefined}
                          rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
                          className="hover:text-[#B91B1C] transition-colors inline-flex items-center gap-1 break-all"
                        >
                          <span>{item.value}</span>
                          {item.id === 'fanpage' && (
                            <ExternalLink className="w-3 h-3 text-[#8B9097] group-hover:text-[#B91B1C] transition-colors shrink-0" />
                          )}
                        </a>
                      ) : (
                        <span className="break-all">{item.value}</span>
                      )}
                    </div>
                  </div>
                </div>

                {item.canCopy && (
                  <button
                    type="button"
                    onClick={() => handleCopy(item.value, item.id)}
                    className="p-1.5 rounded-lg text-[#8B9097] hover:text-[#18181B] hover:bg-[#FAF9F7] border border-transparent hover:border-[#F2E4D8] transition-all cursor-pointer shrink-0"
                    title="Sao chép"
                  >
                    {copiedType === item.id ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                        <Check className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Đã chép</span>
                      </span>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VARIANT 3: FULL SHOWCASE (Dành cho trang Bảng giá / Cộng đồng)
  // =========================================================================
  return (
    <div
      className={`rounded-3xl bg-gradient-to-br from-[#FFF9F6] via-white to-[#FFF4EE] border border-[#F2D0C7] p-6 sm:p-8 shadow-xs space-y-6 ${className}`}
    >
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#F2D0C7]/60 pb-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF2EE] border border-[#F2D0C7] text-[#B91B1C] text-[11px] font-black uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            <span>Kênh tiếp nhận & phản hồi chính thức</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-[#18181B] tracking-tight">
            Mọi thắc mắc và đóng góp xin vui lòng liên hệ
          </h3>
          <p className="text-xs sm:text-sm text-[#5F6368] max-w-xl">
            Đội ngũ phát triển HanFlix luôn trân trọng mọi ý kiến đóng góp của bạn để không ngừng hoàn thiện trải nghiệm học tiếng Trung chất lượng cao.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF2EE] border border-[#F2D0C7] text-[#B91B1C] flex items-center justify-center shadow-xs">
            <HeartHandshake className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 4 Bento Contact Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {contactData.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E7E7EA] hover:border-[#B91B1C] shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between group relative overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${item.iconBg} ${item.iconColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-[#5F6368] font-bold text-[10px] uppercase tracking-wider">
                    {item.badge}
                  </span>
                </div>

                <div className="text-[11px] font-bold text-[#8B9097] uppercase tracking-wider">
                  {item.title}
                </div>
                <div className="text-sm font-black text-[#18181B] mt-1 break-words">
                  {item.value}
                </div>
                <p className="text-xs text-[#5F6368] mt-1 line-clamp-1">
                  {item.subtitle}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#F2E4D8]/50 flex items-center justify-between text-xs">
                {item.isLink && item.href ? (
                  <a
                    href={item.href}
                    target={item.href.startsWith('http') ? '_blank' : undefined}
                    rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
                    className="inline-flex items-center gap-1.5 font-bold text-[#B91B1C] hover:text-[#A3181A] transition-colors"
                  >
                    <span>{item.actionText}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-[#8B9097] font-medium text-[11px]">Đại diện HanFlix</span>
                )}

                {item.canCopy && (
                  <button
                    type="button"
                    onClick={() => handleCopy(item.value, item.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FAF9F7] hover:bg-neutral-100 text-[#5F6368] hover:text-[#18181B] font-semibold text-[11px] transition-colors cursor-pointer"
                  >
                    {copiedType === item.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Chép</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
