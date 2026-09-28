import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  Headphones,
  BookOpen,
  PenLine,
  Sparkles,
  ListChecks,
  Mic,
  Layers,
  Clock,
  ChevronRight,
  CircleAlert,
  Target,
  TrendingUp,
  Users,
  Calendar,
  Star,
} from 'lucide-react';
import LeaderboardView, { LeaderboardViewProps } from './leaderboard/LeaderboardView';

interface ExamPrepPageProps {
  onStartPractice?: () => void;
}

const HSK_OPTIONS = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6', 'HSK 7', 'HSK 8', 'HSK 9'];

type ExamSection =
  | 'listening'
  | 'reading'
  | 'writing'
  | 'vocabulary';

interface SectionMeta {
  id: ExamSection;
  label: string;
  short: string;
  vi: string;
  durationMin: number;
  questions: number;
  icon: typeof Headphones;
  status: 'live' | 'soon';
  accentClass: string;
  description: string;
}

const SECTION_META: SectionMeta[] = [
  {
    id: 'listening',
    label: 'Nghe',
    short: 'LISTENING',
    vi: 'Nghe hội thoại và chọn đáp án',
    durationMin: 25,
    questions: 35,
    icon: Headphones,
    status: 'soon',
    accentClass: 'bg-[#B91B1C]',
    description: 'Đoạn hội thoại ngắn, đoạn độc thoại, nghe chọn hình, nghe chọn câu trả lời đúng.',
  },
  {
    id: 'reading',
    label: 'Đọc',
    short: 'READING',
    vi: 'Đọc hiểu và sắp xếp câu',
    durationMin: 30,
    questions: 30,
    icon: BookOpen,
    status: 'soon',
    accentClass: 'bg-[#188A5A]',
    description: 'Sắp xếp câu, tìm câu đồng nghĩa trái nghĩa, đọc hiểu đoạn văn ngắn và dài.',
  },
  {
    id: 'writing',
    label: 'Viết',
    short: 'WRITING',
    vi: 'Viết câu và sửa lỗi',
    durationMin: 15,
    questions: 10,
    icon: PenLine,
    status: 'soon',
    accentClass: 'bg-[#2563EB]',
    description: 'Sắp xếp chữ Hán thành câu, viết lại câu đúng ngữ pháp, điền từ vào chỗ trống.',
  },
  {
    id: 'vocabulary',
    label: 'Từ vựng',
    short: 'VOCAB',
    vi: 'Ôn từ vựng theo cấp độ đã chọn',
    durationMin: 10,
    questions: 20,
    icon: ListChecks,
    status: 'live',
    accentClass: 'bg-[#7C3AED]',
    description: 'Dùng kho từ vựng HSK 3.0 đã có sẵn: trắc nghiệm nghĩa, điền từ, ghép cặp.',
  },
];

const SKILL_RECOMMENDATIONS = [
  {
    icon: Target,
    label: 'Luyện phản xạ dịch câu',
    sub: 'Tiếng Trung trong nhà hàng',
    eta: '8 phút',
    level: 'HSK 3',
    tone: 'bg-[#FFE4E2] text-[#B91B1C]',
  },
  {
    icon: Mic,
    label: 'Ghép cặp từ vựng chuyên ngành',
    sub: 'Khách sạn + Đặt phòng',
    eta: '5 phút',
    level: 'HSK 2',
    tone: 'bg-[#E0F1E7] text-[#188A5A]',
  },
  {
    icon: Layers,
    label: 'Sắp xếp chữ Hán thành câu',
    sub: 'Đàm phán giá hợp đồng',
    eta: '10 phút',
    level: 'HSK 3',
    tone: 'bg-[#E2E6FB] text-[#2563EB]',
  },
];

function hskNumber(label: string): number {
  const match = label.match(/\d+/);
  if (!match) return 1;
  const n = parseInt(match[0], 10);
  return Math.min(9, Math.max(1, n));
}

export function ExamPrepPage({ onStartPractice }: ExamPrepPageProps) {
  const [selectedHsk, setSelectedHsk] = useState('HSK 3');
  const [hoveredSection, setHoveredSection] = useState<ExamSection | null>(null);

  const { targetHsk, statusLabel } = useMemo(() => {
    const target = hskNumber(selectedHsk);
    return {
      targetHsk: target,
      statusLabel: target <= 3 ? 'Cơ bản' : target <= 6 ? 'Trung cấp' : 'Cao cấp',
    };
  }, [selectedHsk]);

  const handleStart = (section: ExamSection) => {
    if (section !== 'vocabulary') return;

    onStartPractice?.();
  };

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden bg-white rounded-3xl border border-[#E7E7EA] p-6 md:p-7"
      >
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#18181B] text-white flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-[#8B9097]">
                Exam Prep · {statusLabel}
              </span>
              <h1 className="text-2xl md:text-[28px] font-black text-[#18181B] tracking-tight leading-tight">
                Luyện thi HSK theo dạng bài
              </h1>
              <p className="text-sm text-[#5F6368] mt-1 max-w-xl">
                Mỗi cấp độ gồm 4 dạng bài mô phỏng. Bắt đầu bằng từ vựng, sau đó đi sâu vào Nghe, Đọc, Viết.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-[#5F6368]">
              Cấp độ
              <select
                aria-label="Chọn cấp HSK"
                value={selectedHsk}
                onChange={(e) => setSelectedHsk(e.target.value)}
                className="h-11 pl-4 pr-4 rounded-xl border border-[#E7E7EA] bg-white text-sm font-bold text-[#18181B] outline-none focus:border-[#B91B1C] focus:ring-2 focus:ring-[#B91B1C]/15 cursor-pointer transition-colors"
              >
                {HSK_OPTIONS.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 rounded-2xl bg-[#FFF9F5] border border-[#FCE9E1] p-3.5 pr-4 text-sm text-[#5F6368]">
          <CircleAlert className="w-4 h-4 text-[#B91B1C] shrink-0" />
          <p className="leading-relaxed">
            Đề thi Nghe, Đọc, Viết đang được hoàn thiện. Hiện tại mình đã có bài tập từ vựng theo cấp - dùng tạm để khởi động.
          </p>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4" aria-label="Các dạng bài thi">
          {SECTION_META.map((section, i) => {
            const isLive = section.status === 'live';
            const Icon = section.icon;
            const hovered = hoveredSection === section.id;
            return (
              <motion.button
                key={section.id}
                type="button"
                onClick={() => handleStart(section.id)}
                onMouseEnter={() => setHoveredSection(section.id)}
                onMouseLeave={() => setHoveredSection(null)}
                disabled={!isLive}
                aria-label={`${section.label} - ${isLive ? 'sẵn sàng' : 'sắp có'}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.08 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                whileHover={isLive ? { y: -2 } : undefined}
                className={`group relative text-left p-5 rounded-3xl border bg-white flex flex-col justify-between min-h-[180px] overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91B1C] ${
                  isLive ? 'border-[#E7E7EA] cursor-pointer' : 'border-[#E7E7EA] cursor-not-allowed'
                } ${isLive && hovered ? 'shadow-[0_20px_40px_-15px_rgba(185,28,28,0.18)]' : 'shadow-[0_2px_8px_rgba(15,23,42,0.04)]'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-10 h-10 rounded-2xl ${section.accentClass} text-white flex items-center justify-center`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-[10px] font-mono uppercase tracking-[0.22em] px-2.5 py-1 rounded-full ${
                    isLive
                      ? 'bg-[#E7F7EE] text-[#188A5A]'
                      : 'bg-[#F2F2F5] text-[#8B9097]'
                  }`}>
                    {isLive ? 'Live' : 'Sắp có'}
                  </span>
                </div>

                <div className="mt-4">
                  <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#8B9097]">
                    {section.short}
                  </span>
                  <h3 className="mt-1 text-lg font-extrabold text-[#18181B] leading-tight">
                    {section.label} - {targetHsk <= 3 ? 'Cơ bản' : targetHsk <= 6 ? 'Nâng cao' : 'Chuyên gia'}
                  </h3>
                  <p className="mt-1.5 text-sm text-[#5F6368] leading-relaxed">
                    {section.vi}
                  </p>
                </div>

                <div className={`mt-5 flex items-center justify-between text-xs ${isLive ? 'text-[#18181B]' : 'text-[#8B9097]'}`}>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {section.durationMin} phút
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ListChecks className="w-3.5 h-3.5" />
                      {section.questions} câu
                    </span>
                  </div>
                  {isLive ? (
                    <span className="inline-flex items-center gap-1 font-bold text-[#B91B1C] group-hover:gap-1.5 transition-all">
                      Bắt đầu
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="font-bold">Đang xây</span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </section>

        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5 bg-[#18181B] text-white rounded-3xl p-6 relative overflow-hidden flex flex-col"
        >
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-[#9CA0A8]">
                Lộ trình gợi ý
              </span>
              <h2 className="mt-1 text-lg font-extrabold leading-tight">
                3 bài tập phù hợp với {selectedHsk}
              </h2>
            </div>
            <Sparkles className="w-5 h-5 text-[#FFB454] shrink-0" />
          </div>

          <ul className="space-y-2.5 flex-1">
            {SKILL_RECOMMENDATIONS.map((rec, i) => {
              const Icon = rec.icon;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onStartPractice?.()}
                    className="w-full text-left p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB454]"
                  >
                    <span className={`w-9 h-9 shrink-0 rounded-xl ${rec.tone} flex items-center justify-center`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{rec.label}</p>
                      <p className="text-[11px] text-[#9CA0A8] truncate">{rec.sub}</p>
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#9CA0A8] shrink-0">
                      {rec.eta}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 pt-5 border-t border-white/10 flex items-center justify-between text-sm">
            <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#9CA0A8]">
              Tiến độ hôm nay
            </span>
            <span className="inline-flex items-center gap-1.5 font-bold">
              <TrendingUp className="w-4 h-4 text-[#FFB454]" />
              +3 bài tập
            </span>
          </div>
        </motion.aside>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.42, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-3xl border border-[#E7E7EA] p-6 md:p-7"
      >
        <div className="flex items-end justify-between gap-3 mb-5">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-[#8B9097]">
              Cấu trúc đề thi tham khảo
            </span>
            <h2 className="mt-1 text-lg font-extrabold text-[#18181B]">
              Tổng quan {selectedHsk}
            </h2>
          </div>
          <span className="text-xs text-[#5F6368] hidden sm:inline">
            Thời gian dự kiến 80 phút · 95 câu hỏi
          </span>
        </div>

        <div className="relative pl-4">
          <span className="absolute left-1.5 top-2 bottom-2 w-px bg-[#E7E7EA]" aria-hidden />
          {SECTION_META.map((section, i) => (
            <div key={section.id} className="relative pl-6 pb-5 last:pb-0">
              <span className={`absolute left-0 top-1.5 w-3 h-3 rounded-full ring-4 ring-white ${section.accentClass}`} aria-hidden />
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm font-bold text-[#18181B]">
                  Phần {i + 1}: {section.label}
                </p>
                <p className="text-xs text-[#8B9097] font-mono">
                  {section.durationMin} phút · {section.questions} câu
                </p>
              </div>
              <p className="text-sm text-[#5F6368] mt-1 leading-relaxed">
                {section.description}
              </p>
            </div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}

export function LeaderboardPage(props: LeaderboardViewProps) {
  return <LeaderboardView {...props} />;
}

export function CommunityPage() {
  const features = [
    { icon: '💬', title: 'Diễn đàn hỏi đáp', desc: 'Đặt câu hỏi về bài tập, nhận phản hồi từ cộng đồng và giáo viên' },
    { icon: '🎤', title: 'Luyện nói 1-1', desc: 'Kết nối với học viên khác qua video call ngắn để luyện tiếng Trung thực tế' },
    { icon: '📚', title: 'Chia sẻ ghi chú', desc: 'Đăng và download ghi chú từ vựng, mẹo học của cộng đồng' },
    { icon: '🏆', title: 'Thử thách nhóm', desc: 'Tham gia các thử thách học tập hàng tuần, thi đua cùng bạn bè' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl overflow-hidden border border-[#E7E7EA]">
        <div className="bg-gradient-to-br from-[#B91B1C] to-[#7F1D1D] p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-white/20 border border-white/30 mb-4">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white" style={{ fontFamily: 'Fraunces, serif' }}>Cộng Đồng HanFlix</h2>
          <p className="text-white/80 text-sm mt-2 max-w-md mx-auto">Kết nối với hàng nghìn người học tiếng Trung. Hỏi đáp, luyện nói và thi đua cùng nhau.</p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 text-white text-xs font-bold border border-white/30">
            <Calendar className="w-3.5 h-3.5" />
            Sắp ra mắt · Q1 2027
          </div>
        </div>

        <div className="p-6">
          <p className="text-center text-sm text-[#5F6368] mb-5">Tính năng đang được phát triển. Đây là những gì đang đến:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((f, i) => (
              <div key={i} className="p-4 rounded-2xl bg-[#F7F7F9] border border-[#E7E7EA] flex gap-3">
                <span className="text-2xl shrink-0">{f.icon}</span>
                <div>
                  <div className="font-bold text-sm text-[#18181B]">{f.title}</div>
                  <div className="text-xs text-[#5F6368] mt-0.5 leading-relaxed">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 border border-[#E7E7EA] flex flex-col sm:flex-row items-center gap-4">
        <Star className="w-8 h-8 text-[#E7A92F] fill-[#E7A92F] shrink-0" />
        <div className="flex-1 text-center sm:text-left">
          <div className="font-bold text-[#18181B] text-sm">Đăng ký nhận thông báo sớm</div>
          <div className="text-xs text-[#5F6368] mt-0.5">Bạn sẽ là người đầu tiên trải nghiệm khi cộng đồng ra mắt.</div>
        </div>
        <button className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#B91B1C] text-white font-bold text-sm hover:bg-[#A3181A] transition-colors shrink-0 cursor-pointer">
          Nhận thông báo
        </button>
      </div>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA] space-y-6">
      <h2 className="text-2xl font-extrabold text-[#18181B]">Cài Đặt Tài Khoản</h2>
      <div className="space-y-4 max-w-xl">
        <div className="p-4 rounded-2xl bg-[#F7F7F9] border border-[#E7E7EA]">
          <label className="text-xs font-bold text-[#18181B]">Họ và tên</label>
          <input type="text" defaultValue="Nguyễn Minh Anh" className="w-full mt-1.5 p-2.5 rounded-xl border border-[#E7E7EA] bg-white text-sm" />
        </div>
        <div className="p-4 rounded-2xl bg-[#F7F7F9] border border-[#E7E7EA]">
          <label className="text-xs font-bold text-[#18181B]">Tự động phát phụ đề Pinyin</label>
          <input type="checkbox" defaultChecked className="mt-2 ml-2 scale-125" />
        </div>
      </div>
    </div>
  );
}
