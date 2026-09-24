import React, { useState } from 'react';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Target,
  GraduationCap,
  Heart,
  Clock,
  Briefcase,
  Plane,
  MessageSquare,
  Film,
  Utensils,
  MapPin,
  ShoppingBag,
  TrendingUp,
  Smartphone,
  Coffee,
  Music,
  Compass,
} from 'lucide-react';
import { UserProfile } from '../../data/hanflixData';
import { saveLearningProfile } from '../../api/learning';
import { InlineBanner } from '../notifications';

interface LearningSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile?: UserProfile;
  onSavePreferences: (updated: Partial<UserProfile>) => void;
  currentUser?: {
    id?: string;
    name: string;
    email?: string;
    learningProfile?: any;
  } | null;
}

const HSK_LEVELS = [
  {
    level: 'HSK 1',
    stage: 'Mới bắt đầu',
    vocabCount: '150 từ vựng',
    desc: 'Nhận diện bảng chữ cái Pinyin, phát âm chuẩn và chào hỏi cơ bản',
    badge: 'Cơ bản',
  },
  {
    level: 'HSK 2',
    stage: 'Sơ cấp',
    vocabCount: '300 từ vựng',
    desc: 'Giao tiếp tình huống ngắn, hỏi giá, thời gian và chỉ dẫn đường',
    badge: 'Sơ cấp',
  },
  {
    level: 'HSK 3',
    stage: 'Trung cấp thông dụng',
    vocabCount: '600 từ vựng',
    desc: 'Xem video sinh hoạt, gọi món ăn, đặt phòng khách sạn, mua sắm',
    badge: 'Khuyên dùng',
  },
  {
    level: 'HSK 4',
    stage: 'Giao tiếp tự nhiên',
    vocabCount: '1.200 từ vựng',
    desc: 'Thảo luận nhiều chủ đề xã hội, phản xạ đối thoại lưu loát',
    badge: 'Nâng cao',
  },
  {
    level: 'HSK 5',
    stage: 'Thành thạo',
    vocabCount: '2.500 từ vựng',
    desc: 'Xem phim và show truyền hình không cần phụ đề tiếng Việt, đọc báo chí',
    badge: 'Lưu loát',
  },
  {
    level: 'HSK 6',
    stage: 'Chuyên sâu',
    vocabCount: '5.000 từ vựng',
    desc: 'Làm việc chuyên môn, đàm phán thương mại và nghiên cứu học thuật',
    badge: 'Chuyên gia',
  },
  {
    level: 'HSK 7',
    stage: 'Cao cấp 1',
    vocabCount: '5.000+ từ vựng',
    desc: 'Làm chủ các chủ đề liên ngành: ngoại giao, luật pháp, khoa học kỹ thuật',
    badge: 'Thành thạo',
  },
  {
    level: 'HSK 8',
    stage: 'Cao cấp 2',
    vocabCount: '5.000+ từ vựng',
    desc: 'Nắm vững ngôn ngữ học thuật, phân tích văn bản phức tạp đa ngữ cảnh',
    badge: 'Chuyên gia',
  },
  {
    level: 'HSK 9',
    stage: 'Hoàn mỹ',
    vocabCount: '5.000+ từ vựng',
    desc: 'Năng lực sử dụng tiếng Trung hoàn hảo ở tầm chuyên gia quốc tế',
    badge: 'Bậc thầy',
  },
];

const GOAL_OPTIONS = [
  {
    id: 'Kinh doanh',
    title: 'Kinh doanh & Đi làm',
    desc: 'Giao tiếp công sở, email đối tác, văn hóa đàm phán thương mại',
    icon: Briefcase,
    tag: 'Công việc',
  },
  {
    id: 'Du lịch',
    title: 'Du lịch & Trải nghiệm',
    desc: 'Đặt phòng, gọi món ăn, thủ tục sân bay, mua sắm và hỏi đường',
    icon: Plane,
    tag: 'Thực tế',
  },
  {
    id: 'Luyện thi HSK',
    title: 'Luyện thi chứng chỉ HSK',
    desc: 'Nắm chắc ngữ pháp bẫy đề thi, nâng cao phản xạ nghe và đọc hiểu',
    icon: GraduationCap,
    tag: 'Học thuật',
  },
  {
    id: 'Giao tiếp hằng ngày',
    title: 'Giao tiếp đời sống hằng ngày',
    desc: 'Cách nói tự nhiên như người bản xứ qua tình huống đời thực',
    icon: MessageSquare,
    tag: 'Đời sống',
  },
  {
    id: 'Văn hóa & Giải trí',
    title: 'Văn hóa, Phim ảnh & Show thực tế',
    desc: 'Đu idol, xem phim cổ trang, gameshow Trung Quốc không rào cản',
    icon: Film,
    tag: 'Giải trí',
  },
];

const TOPIC_OPTIONS = [
  { id: 'Ẩm thực', label: 'Ẩm thực & Nhà hàng', icon: Utensils },
  { id: 'Du lịch', label: 'Du lịch & Khách sạn', icon: MapPin },
  { id: 'Mua sắm', label: 'Mua sắm & Tiêu dùng', icon: ShoppingBag },
  { id: 'Phim ảnh', label: 'Phim ảnh & Giải trí', icon: Film },
  { id: 'Kinh tế', label: 'Kinh doanh & Thương mại', icon: TrendingUp },
  { id: 'Công nghệ', label: 'Công nghệ & Đời sống số', icon: Smartphone },
  { id: 'Đời sống', label: 'Giao tiếp hàng ngày', icon: Coffee },
  { id: 'Âm nhạc', label: 'Âm nhạc & Nghệ thuật', icon: Music },
];

const STUDY_HABITS = [
  { minutes: 5, label: '5 phút / ngày', sub: 'Mỗi ngày 1-2 video tình huống ngắn' },
  { minutes: 15, label: '15 phút / ngày', sub: 'Cân bằng lý tưởng để duy trì phản xạ đều đặn' },
  { minutes: 30, label: '30 phút / ngày', sub: 'Tăng tốc trình độ nhanh và bứt phá HSK' },
];

export default function LearningSurveyModal({
  isOpen,
  onClose,
  userProfile,
  onSavePreferences,
  currentUser,
}: LearningSurveyModalProps) {
  const [step, setStep] = useState<number>(1);
  const totalSteps = 4;

  const [selectedHsk, setSelectedHsk] = useState<string>(
    userProfile?.hskLevel || `HSK ${currentUser?.learningProfile?.hskLevel || 3}`
  );
  const [selectedGoal, setSelectedGoal] = useState<string>(
    userProfile?.targetGoal || currentUser?.learningProfile?.goal || 'Kinh doanh'
  );
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    userProfile?.interests || currentUser?.learningProfile?.topics || ['Ẩm thực', 'Du lịch']
  );
  const [dailyMinutes, setDailyMinutes] = useState<number>(
    currentUser?.learningProfile?.dailyMinutes || 15
  );
  const [subtitleDefault, setSubtitleDefault] = useState<'all' | 'zh-pinyin' | 'zh'>('all');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  if (!isOpen) return null;

  const toggleInterest = (topicId: string) => {
    if (selectedInterests.includes(topicId)) {
      if (selectedInterests.length > 1) {
        setSelectedInterests(selectedInterests.filter((t) => t !== topicId));
      }
    } else {
      setSelectedInterests([...selectedInterests, topicId]);
    }
  };

  // Map frontend Vietnamese goal names to backend enum values
  const goalMap: Record<string, string> = {
    'Kinh doanh': 'work',
    'Du lịch': 'travel',
    'Luyện thi HSK': 'hsk',
    'Giao tiếp hằng ngày': 'daily',
    'Văn hóa & Giải trí': 'culture',
  };

  const subtitleMap: Record<string, string> = {
    'all': 'all',
    'zh-pinyin': 'zh_pinyin',
    'zh': 'zh_only',
  };

  const topicMap: Record<string, string> = {
    'Ẩm thực': 'food', 'Du lịch': 'travel', 'Mua sắm': 'shopping',
    'Phim ảnh': 'entertainment', 'Kinh tế': 'business', 'Công nghệ': 'technology',
    'Đời sống': 'daily-life', 'Âm nhạc': 'entertainment',
  };

  const handleComplete = async () => {
    setSaving(true);
    setSaveError('');
    const hskNum = Number(selectedHsk.replace(/\D/g, '')) || 3;
    try {
      await saveLearningProfile({
        currentHsk: hskNum,
        currentHskSource: 'self_reported',
        goal: goalMap[selectedGoal] || 'daily',
        topicIds: [...new Set(selectedInterests.map(value => topicMap[value] ?? value))].slice(0, 3),
        dailyMinutes,
        subtitlePreference: subtitleMap[subtitleDefault] || 'all',
        surveyVersion: 1,
      });
      onSavePreferences({ hskLevel: selectedHsk, targetGoal: goalMap[selectedGoal] || 'daily', interests: selectedInterests.map(value => topicMap[value] ?? value) });
      if (currentUser?.id) localStorage.setItem(`hanflix_survey_completed_${currentUser.id}`, 'true');
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Không thể lưu hồ sơ học tập.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => onClose();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-none sm:rounded-3xl overflow-hidden shadow-2xl border-0 sm:border border-[#E7E7EA] flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh]">
        {/* Top Header Bar */}
        <div className="px-4 sm:px-6 pt-10 pb-6 sm:pt-12 sm:pb-7 border-b border-[#E7E7EA] flex items-center justify-between bg-white shrink-0 safe-area-top">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FDF1F1] text-[#B91B1C] flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-[#18181B] tracking-tight">
                  Thiết Lập Lộ Trình Học Tập
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[#F4F4F6] text-[#5F6368] text-[11px] font-bold">
                  Bước {step} / {totalSteps}
                </span>
              </div>
              <p className="text-xs text-[#5F6368] line-clamp-1">
                Tùy chỉnh nội dung video và lộ trình tiếng Trung phù hợp với bạn
              </p>
            </div>
          </div>

          <button
            onClick={handleSkip}
            aria-label="Đóng"
            className="p-2 rounded-xl text-[#8B9097] hover:text-[#18181B] hover:bg-[#F7F7F9] transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Crisp Brand Progress Bar */}
        <div className="w-full h-1 bg-[#F1F1F4] shrink-0">
          <div
            className="h-full bg-[#B91B1C] transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        {/* Mascot Welcome Card on Step 1 (Using official favicon.png) */}
        {step === 1 && (
          <div className="mx-6 mt-5 p-4 rounded-2xl bg-[#FBFBFC] border border-[#E7E7EA] flex items-center gap-4 shrink-0">
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white border border-[#E7E7EA] shadow-xs flex items-center justify-center shrink-0 p-1.5 overflow-hidden">
              <img
                src="/favicon.png"
                alt="HanFlix Mascot"
                className="w-full h-full object-contain select-none"
              />
            </div>
            <div className="text-xs leading-relaxed text-[#5F6368] min-w-0">
              <span className="font-extrabold text-[#18181B] text-sm block truncate">
                Chào mừng {currentUser?.name || 'học viên'} đến với HanFlix!
              </span>
              Chỉ mất khoảng 30 giây để chọn trình độ và mục tiêu của bạn, giúp hệ thống gợi ý các bài học video sát với nhu cầu thực tế nhất.
            </div>
          </div>
        )}

        {/* Survey Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* STEP 1: HSK Level Selection */}
          {step === 1 && (
            <div className="space-y-3.5">
              <div>
                <h3 className="text-sm font-black text-[#18181B] flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-[#B91B1C]" />
                  <span>Trình độ tiếng Trung hiện tại của bạn là gì?</span>
                </h3>
                <p className="text-xs text-[#5F6368] mt-0.5">
                  Hệ thống sẽ sắp xếp các bài học có độ khó từ vựng và ngữ pháp vừa vặn nhất.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {HSK_LEVELS.map((item) => {
                  const isSelected = selectedHsk === item.level;
                  return (
                    <button
                      key={item.level}
                      type="button"
                      onClick={() => setSelectedHsk(item.level)}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3.5 cursor-pointer active:scale-[0.99] ${
                        isSelected
                          ? 'bg-[#FFF8F8] border-[#B91B1C] ring-1 ring-[#B91B1C] shadow-2xs'
                          : 'bg-white border-[#E7E7EA] hover:border-[#D1D5DB] hover:bg-[#FAF9FA]'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#F7F7F9] border border-[#E7E7EA] flex flex-col items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-black text-[#18181B] font-mono leading-none">
                          {item.level.replace('HSK ', 'H')}
                        </span>
                        <span className="text-[9px] font-bold text-[#8B9097] leading-none mt-0.5">
                          HSK
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-extrabold text-sm text-[#18181B]">{item.level}</span>
                            <span className="text-xs font-semibold text-[#5F6368]">· {item.stage}</span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              isSelected
                                ? 'bg-[#B91B1C] text-white'
                                : 'bg-[#F1F1F4] text-[#5F6368]'
                            }`}
                          >
                            {item.vocabCount}
                          </span>
                        </div>
                        <p className="text-xs text-[#5F6368] mt-1.5 leading-snug">{item.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Main Learning Goal */}
          {step === 2 && (
            <div className="space-y-3.5">
              <div>
                <h3 className="text-sm font-black text-[#18181B] flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#B91B1C]" />
                  <span>Mục tiêu chính khi bạn học tiếng Trung là gì?</span>
                </h3>
                <p className="text-xs text-[#5F6368] mt-0.5">
                  Chọn mục tiêu ưu tiên để hệ thống phân loại bài giảng trên trang chủ của bạn.
                </p>
              </div>

              <div className="space-y-2.5">
                {GOAL_OPTIONS.map((goal) => {
                  const isSelected = selectedGoal === goal.id;
                  const Icon = goal.icon;
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => setSelectedGoal(goal.id)}
                      className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] ${
                        isSelected
                          ? 'bg-[#FFF8F8] border-[#B91B1C] ring-1 ring-[#B91B1C] shadow-2xs'
                          : 'bg-white border-[#E7E7EA] hover:border-[#D1D5DB] hover:bg-[#FAF9FA]'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                            isSelected
                              ? 'bg-[#B91B1C] border-[#B91B1C] text-white'
                              : 'bg-[#F7F7F9] border-[#E7E7EA] text-[#5F6368]'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#18181B]">{goal.title}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F4F4F6] text-[#5F6368] font-semibold">
                              {goal.tag}
                            </span>
                          </div>
                          <p className="text-xs text-[#5F6368] mt-0.5 leading-snug">{goal.desc}</p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[#B91B1C] border-[#B91B1C] text-white'
                            : 'border-[#D1D5DB] bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Favorite Topics */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-[#18181B] flex items-center gap-2">
                  <Heart className="w-4 h-4 text-[#B91B1C]" />
                  <span>Những chủ đề bạn quan tâm nhất khi xem video?</span>
                </h3>
                <p className="text-xs text-[#5F6368] mt-0.5">
                  Chọn các chủ đề bạn muốn học (có thể chọn nhiều). Đã chọn: {selectedInterests.length} chủ đề.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {TOPIC_OPTIONS.map((topic) => {
                  const isSelected = selectedInterests.includes(topic.id);
                  const Icon = topic.icon;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => toggleInterest(topic.id)}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer active:scale-[0.99] ${
                        isSelected
                          ? 'bg-[#FFF8F8] border-[#B91B1C] text-[#18181B] font-bold shadow-2xs'
                          : 'bg-white border-[#E7E7EA] text-[#5F6368] hover:border-[#D1D5DB] hover:bg-[#FAF9FA]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-[#FDF1F1] text-[#B91B1C]'
                              : 'bg-[#F7F7F9] text-[#5F6368]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-[#18181B]">{topic.label}</span>
                      </div>

                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold transition-colors ${
                          isSelected
                            ? 'bg-[#B91B1C] text-white'
                            : 'bg-[#F1F1F4] text-[#8B9097]'
                        }`}
                      >
                        {isSelected ? 'Đã chọn' : '+ Thêm'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Habits & Subtitles */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-black text-[#18181B] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#B91B1C]" />
                  <span>Thói quen học tập & Chế độ phụ đề</span>
                </h3>
                <p className="text-xs text-[#5F6368] mt-0.5">
                  Thiết lập thời lượng xem video và chế độ hiển thị phù hợp với bạn.
                </p>
              </div>

              {/* Study duration */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#18181B] uppercase tracking-wider block">
                  Thời lượng dự kiến học mỗi ngày
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {STUDY_HABITS.map((item) => {
                    const isSelected = dailyMinutes === item.minutes;
                    return (
                      <button
                        key={item.minutes}
                        type="button"
                        onClick={() => setDailyMinutes(item.minutes)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.99] ${
                          isSelected
                            ? 'bg-[#FFF8F8] border-[#B91B1C] ring-1 ring-[#B91B1C] shadow-2xs'
                            : 'bg-white border-[#E7E7EA] hover:border-[#D1D5DB]'
                        }`}
                      >
                        <div className="font-extrabold text-xs text-[#18181B]">{item.label}</div>
                        <div className="text-[11px] text-[#5F6368] mt-1 leading-snug">{item.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subtitle mode */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-[#18181B] uppercase tracking-wider block">
                  Chế độ hiển thị phụ đề mặc định
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'all', title: 'Song ngữ đầy đủ', desc: 'Hán tự + Pinyin + Dịch tiếng Việt' },
                    { id: 'zh-pinyin', title: 'Trung & Pinyin', desc: 'Rèn luyện phản xạ hiểu nghĩa trực tiếp' },
                    { id: 'zh', title: 'Chỉ chữ Hán', desc: 'Dành cho luyện đọc chuyên sâu' },
                  ].map((sub) => {
                    const isSelected = subtitleDefault === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setSubtitleDefault(sub.id as any)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.99] ${
                          isSelected
                            ? 'bg-[#FFF8F8] border-[#B91B1C] ring-1 ring-[#B91B1C] shadow-2xs'
                            : 'bg-white border-[#E7E7EA] hover:border-[#D1D5DB]'
                        }`}
                      >
                        <div className="font-bold text-xs text-[#18181B]">{sub.title}</div>
                        <div className="text-[11px] text-[#5F6368] mt-1 leading-snug">{sub.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {saveError && <div className="px-6 mb-3"><InlineBanner variant="error" message={saveError} /></div>}
        {/* Modal Footer */}
        <div className="px-4 sm:px-6 pt-6 pb-10 sm:pt-7 sm:pb-12 border-t border-[#E7E7EA] bg-[#FAFAFC] flex items-center justify-between shrink-0 safe-area-bottom">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2.5 min-h-[44px] rounded-xl border border-[#E7E7EA] bg-white text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Quay lại</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs font-semibold text-[#8B9097] hover:text-[#5F6368] px-2 py-1 min-h-[44px] inline-flex items-center transition-colors cursor-pointer"
              >
                Bỏ qua lần này
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step < totalSteps ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="px-6 py-2.5 min-h-[44px] rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
              >
                <span>Tiếp tục</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                disabled={saving}
                className="px-6 py-2.5 min-h-[44px] rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{saving ? 'Đang lưu…' : 'Lưu & Bắt đầu học'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
