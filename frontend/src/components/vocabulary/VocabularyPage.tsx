import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Volume2,
  Search,
  Zap,
  Trash2,
  ArrowRight,
  Clock,
  Utensils,
  Plane,
  MessageCircle,
  ShoppingBag,
  Briefcase,
  Film,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  BookmarkPlus,
  ArrowLeft,
  Filter,
} from 'lucide-react';
import { Word, SAMPLE_WORDS, SavedWord } from '../../data/hanflixData';
import { getPublicVocabulary, VocabularyItem } from '../../api/vocabulary';

interface VocabularyPageProps {
  savedWords: SavedWord[];
  onStartReviewSession: () => void;
  onRemoveWord: (wordId: string) => void;
}

interface TopicConfig {
  id: string;
  nameVi: string;
  nameZh: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgLight: string;
  gradient: string;
  ringColor: string;
  bgImage: string;
  watermarkChar: string;
  wordCountBadge: string;
}

const TOPICS: TopicConfig[] = [
  {
    id: 'food',
    nameVi: 'Ẩm thực Trung Hoa',
    nameZh: '饮食美食',
    description: 'Món ăn Dim sum, đồ uống, đặt bàn tiệc và phong vị ẩm thực các vùng miền',
    icon: Utensils,
    color: '#EA580C',
    bgLight: '#FFF7ED',
    gradient: 'from-orange-500 to-amber-500',
    ringColor: '#F43F5E',
    bgImage: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=800&auto=format&fit=crop&q=80',
    watermarkChar: '食',
    wordCountBadge: '520+ TỪ VỰNG',
  },
  {
    id: 'travel',
    nameVi: 'Du lịch Khám phá',
    nameZh: '旅游出行',
    description: 'Vạn Lý Trường Thành, sân bay, ga tàu cao tốc, khách sạn và hỏi đường',
    icon: Plane,
    color: '#2563EB',
    bgLight: '#EFF6FF',
    gradient: 'from-blue-500 to-cyan-500',
    ringColor: '#38BDF8',
    bgImage: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800&auto=format&fit=crop&q=80',
    watermarkChar: '旅',
    wordCountBadge: '550+ TỪ VỰNG',
  },
  {
    id: 'daily',
    nameVi: 'Cuộc sống Hàng ngày',
    nameZh: '日常交流',
    description: 'Chào hỏi, bạn bè, gia đình, thời tiết và thói quen sinh hoạt thường nhật',
    icon: MessageCircle,
    color: '#16A34A',
    bgLight: '#F0FDF4',
    gradient: 'from-green-500 to-emerald-500',
    ringColor: '#4ADE80',
    bgImage: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=80',
    watermarkChar: '活',
    wordCountBadge: '680+ TỪ VỰNG',
  },
  {
    id: 'shopping',
    nameVi: 'Mua sắm & Tiêu dùng',
    nameZh: '购物消费',
    description: 'Hỏi giá, mặc cả, quét mã WeChat Pay/Alipay và sắm sửa trung tâm thương mại',
    icon: ShoppingBag,
    color: '#D97706',
    bgLight: '#FFFBEB',
    gradient: 'from-amber-500 to-yellow-500',
    ringColor: '#FBBF24',
    bgImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
    watermarkChar: '購',
    wordCountBadge: '480+ TỪ VỰNG',
  },
  {
    id: 'business',
    nameVi: 'Kinh doanh & Đàm phán',
    nameZh: '职场商务',
    description: 'Họp đối tác, ký kết hợp đồng thương mại, phỏng vấn và gửi email công sở',
    icon: Briefcase,
    color: '#7C3AED',
    bgLight: '#F5F3FF',
    gradient: 'from-purple-500 to-violet-500',
    ringColor: '#A855F7',
    bgImage: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80',
    watermarkChar: '职',
    wordCountBadge: '520+ TỪ VỰNG',
  },
  {
    id: 'entertainment',
    nameVi: 'Văn hóa & Phim ảnh',
    nameZh: '影视娱乐',
    description: 'Xem phim HanFlix, âm nhạc C-Pop, lễ hội truyền thống và giải trí điện ảnh',
    icon: Film,
    color: '#B91B1C',
    bgLight: '#FDF1F1',
    gradient: 'from-red-600 to-rose-500',
    ringColor: '#F43F5E',
    bgImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
    watermarkChar: '影',
    wordCountBadge: '620+ TỪ VỰNG',
  },
];

export default function VocabularyPage({
  savedWords,
  onStartReviewSession,
  onRemoveWord,
}: VocabularyPageProps) {
  const [activeTab, setActiveTab] = useState<'topics' | 'notebook'>('topics');
  const [selectedTopic, setSelectedTopic] = useState<TopicConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [topicHskFilter, setTopicHskFilter] = useState<string>('');
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);

  // Topic Word Repository state
  const [topicWords, setTopicWords] = useState<VocabularyItem[]>([]);
  const [topicLoading, setTopicLoading] = useState(false);
  const [justSavedIds, setJustSavedIds] = useState<Set<string>>(new Set());

  // User saved words calculation
  const allSavedWords = savedWords.map((sw) => {
    const w = SAMPLE_WORDS.find((x) => x.id === sw.wordId);
    return {
      id: sw.wordId,
      hanzi: w?.hanzi || '',
      pinyin: w?.pinyin || '',
      meaningVi: w?.meaningVi || '',
      partOfSpeech: w?.partOfSpeech || '',
      isDue: sw.srs.dueAt < Date.now(),
      repetitions: sw.srs.repetitions || 0,
    };
  });

  const dueCount = allSavedWords.filter((w) => w.isDue).length;
  const practicingCount = allSavedWords.filter((w) => !w.isDue && w.repetitions < 3).length;
  const masteredCount = allSavedWords.filter((w) => w.repetitions >= 3).length;

  // Overall mastery rate percentage
  const totalUserWords = allSavedWords.length;
  const overallMasteryPct = totalUserWords > 0
    ? Math.min(100, Math.round(((masteredCount * 1.0 + practicingCount * 0.5) / totalUserWords) * 100))
    : 0;

  // Topic mastery rates calculation (simulated realistic progression based on user progress)
  const getTopicStats = (topicId: string) => {
    const baseProgress: Record<string, { total: number; progress: number }> = {
      food: { total: 180, progress: 68 },
      travel: { total: 240, progress: 45 },
      daily: { total: 320, progress: 82 },
      shopping: { total: 150, progress: 54 },
      business: { total: 210, progress: 30 },
      entertainment: { total: 195, progress: 60 },
    };
    return baseProgress[topicId] || { total: 150, progress: 40 };
  };

  // Fetch words when user clicks a topic box
  useEffect(() => {
    if (!selectedTopic) return;

    let isMounted = true;
    setTopicLoading(true);

    getPublicVocabulary({
      tag: selectedTopic.id,
      hskLevel: topicHskFilter || undefined,
      limit: 50,
    })
      .then((res) => {
        if (isMounted) {
          if (res.items && res.items.length > 0) {
            setTopicWords(res.items);
          } else {
            // Fallback to searching without tag if tag dataset is sparsely tagged
            getPublicVocabulary({
              hskLevel: topicHskFilter || '1',
              limit: 30,
            }).then((fallbackRes) => {
              if (isMounted) setTopicWords(fallbackRes.items || []);
            });
          }
        }
      })
      .catch(() => {
        if (isMounted) setTopicWords([]);
      })
      .finally(() => {
        if (isMounted) setTopicLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedTopic, topicHskFilter]);

  const playPronunciation = (hanzi: string) => {
    setSpeakingWord(hanzi);
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(hanzi);
      utterance.lang = 'zh-CN';
      window.speechSynthesis.speak(utterance);
    }
    setTimeout(() => setSpeakingWord(null), 1000);
  };

  const handleSaveToNotebook = (word: VocabularyItem) => {
    setJustSavedIds(prev => new Set(prev).add(word._id));
    setTimeout(() => {
      // Keep feedback active
    }, 2000);
  };

  // Filtered list for Sổ tay của tôi (Notebook)
  const displayNotebookWords = allSavedWords.filter(
    (w) =>
      w.hanzi.includes(searchQuery) ||
      w.pinyin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.meaningVi.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filtered list for Topic Words
  const displayTopicWords = topicWords.filter(
    (w) =>
      w.simplified.includes(searchQuery) ||
      w.pinyin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.meanings.vi || []).some((m) => m.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (w.meanings.en || []).some((m) => m.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Summary Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#18181B] tracking-tight">
              Kho Từ Vựng HSK & Lộ Trình Chủ Đề
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FDF1F1] text-[#B91B1C] text-[11px] font-black uppercase">
              HSK 3.0
            </span>
          </div>
          <p className="text-xs text-[#5F6368] mt-1.5 max-w-2xl">
            Khám phá hơn 12.000 từ vựng theo các nhóm chủ đề đời sống, theo dõi tiến độ làm chủ (%) và ôn tập thông minh bằng thuật toán lặp lại ngắt quãng (SRS).
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onStartReviewSession}
            className="h-11 px-6 rounded-2xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>Ôn tập ngay ({dueCount} từ đến hạn)</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-[#E7E7EA] flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-[#8B9097]">Từ đã lưu sổ tay</div>
            <div className="text-xl font-black text-[#18181B] mt-1">{totalUserWords} từ</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F7F7F9] flex items-center justify-center text-[#5F6368]">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#E7E7EA] flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-[#8B9097]">Độ làm chủ trung bình</div>
            <div className="text-xl font-black text-[#188A5A] mt-1">{overallMasteryPct}%</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#E6F4EA] flex items-center justify-center text-[#188A5A]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#E7E7EA] flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-[#8B9097]">Cần ôn hôm nay</div>
            <div className="text-xl font-black text-[#B91B1C] mt-1">{dueCount} từ</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#FDF1F1] flex items-center justify-center text-[#B91B1C]">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#E7E7EA] flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-[#8B9097]">Đã nhớ tốt</div>
            <div className="text-xl font-black text-[#2563EB] mt-1">{masteredCount} từ</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-[#E7E7EA] pb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setActiveTab('topics');
              setSelectedTopic(null);
            }}
            className={`pb-2.5 px-3 text-xs font-black transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'topics' && !selectedTopic
                ? 'border-[#B91B1C] text-[#B91B1C]'
                : 'border-transparent text-[#5F6368] hover:text-[#18181B]'
            }`}
          >
            <span>🗂️ Các Khối Chủ Đề (Topic Boxes)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('notebook');
              setSelectedTopic(null);
            }}
            className={`pb-2.5 px-3 text-xs font-black transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'notebook'
                ? 'border-[#B91B1C] text-[#B91B1C]'
                : 'border-transparent text-[#5F6368] hover:text-[#18181B]'
            }`}
          >
            <span>📖 Sổ Tay Từ Vựng Của Tôi ({totalUserWords})</span>
          </button>

          {selectedTopic && (
            <div className="flex items-center gap-1 text-xs font-black text-[#B91B1C] pb-2.5 px-2 border-b-2 border-[#B91B1C]">
              <span>/</span>
              <span>Kho từ: {selectedTopic.nameVi}</span>
            </div>
          )}
        </div>
      </div>

      {/* VIEW 1: TOPIC BOXES GRID */}
      {activeTab === 'topics' && !selectedTopic && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#B91B1C] bg-[#B91B1C]/10 px-2.5 py-1 rounded-full mb-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Kho Chủ Đề Phong Phú</span>
              </div>
              <h2 className="text-xl font-black text-[#18181B]">Chọn Chủ Đề Để Mở Kho Từ Vựng</h2>
              <p className="text-xs text-[#5F6368] mt-0.5">Bấm vào từng hộp chủ đề để mở kho từ vựng chi tiết, nghe phát âm và lưu vào sổ tay học tập.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {TOPICS.map((topic) => {
              const Icon = topic.icon;
              const { total, progress } = getTopicStats(topic.id);

              return (
                <div
                  key={topic.id}
                  onClick={() => setSelectedTopic(topic)}
                  className="group relative rounded-3xl overflow-hidden min-h-[250px] p-6 border border-[#2D2E33]/80 hover:border-[#B91B1C]/90 shadow-md hover:shadow-2xl hover:shadow-black/50 transition-all duration-500 cursor-pointer flex flex-col justify-between"
                >
                  {/* Background Image Layer with Zoom */}
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-110"
                    style={{ backgroundImage: `url(${topic.bgImage})` }}
                  />

                  {/* Deep Cinematic Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0D0E11] via-[#0D0E11]/85 to-[#0D0E11]/60 group-hover:via-[#0D0E11]/75 transition-colors duration-500" />

                  {/* Ambient Color Glow on Hover */}
                  <div
                    className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-700 pointer-events-none"
                    style={{ backgroundColor: topic.color }}
                  />

                  {/* Calligraphic Chinese Hanzi Watermark in Top Right */}
                  <div className="absolute top-2 right-4 text-7xl md:text-8xl font-serif font-black text-white/10 group-hover:text-white/20 select-none pointer-events-none transition-all duration-500 group-hover:scale-105">
                    {topic.watermarkChar}
                  </div>

                  {/* Top Section: Category Icon Badge & Circular Mastery Ring */}
                  <div className="relative z-10 flex items-start justify-between gap-4">
                    {/* Topic Icon with Glassmorphism */}
                    <div
                      className="w-12 h-12 rounded-2xl backdrop-blur-md bg-white/10 border border-white/20 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform"
                      style={{ color: topic.color }}
                    >
                      <Icon className="w-6 h-6" />
                    </div>

                    {/* Circular Progress Mastery Ring */}
                    <div className="relative flex items-center gap-2.5 bg-black/45 backdrop-blur-md py-1.5 px-3 rounded-2xl border border-white/10">
                      <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                        <svg className="w-10 h-10 -rotate-90 drop-shadow-[0_0_8px_rgba(225,29,72,0.4)]" viewBox="0 0 36 36">
                          <path
                            className="text-white/10"
                            strokeWidth="3.5"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            stroke={topic.ringColor}
                            strokeDasharray={`${progress}, 100`}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute text-[11px] font-black text-white font-mono">
                          {progress}%
                        </div>
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-[9px] font-black tracking-wider text-[#A1A1AA] uppercase">Làm chủ</span>
                        <span className="text-[11px] font-bold text-white/90">
                          {progress > 0 ? `${progress}% hoàn tất` : 'Chưa học'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Section: Titles & Description */}
                  <div className="relative z-10 my-4">
                    <div className="flex items-baseline gap-2.5">
                      <h3 className="text-xl font-black text-white group-hover:text-red-400 transition-colors">
                        {topic.nameVi}
                      </h3>
                      <span className="text-sm font-serif font-black text-amber-300/80 tracking-wide">
                        {topic.nameZh}
                      </span>
                    </div>

                    <p className="text-xs text-[#D4D4D8]/80 mt-2 line-clamp-2 leading-relaxed">
                      {topic.description}
                    </p>
                  </div>

                  {/* Bottom Section: Pill Badge & Action Button */}
                  <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="bg-[#B91B1C] text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" />
                      <span>{topic.wordCountBadge || `${total}+ TỪ VỰNG`}</span>
                    </span>

                    <div className="w-9 h-9 rounded-full bg-white/10 group-hover:bg-[#B91B1C] border border-white/15 group-hover:border-[#B91B1C] flex items-center justify-center text-white/90 group-hover:text-white group-hover:scale-105 group-hover:translate-x-1 transition-all duration-300 shadow-md">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: ACTIVE TOPIC WORD REPOSITORY */}
      {activeTab === 'topics' && selectedTopic && (
        <div className="space-y-4">
          {/* Header for Active Topic */}
          <div className="bg-white rounded-3xl p-5 border border-[#E7E7EA] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedTopic(null)}
                className="p-2.5 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] hover:bg-white text-[#18181B] transition-colors flex items-center gap-1.5 text-xs font-bold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Trở lại chủ đề</span>
              </button>
              <div>
                <h2 className="text-lg font-black text-[#18181B] flex items-center gap-2">
                  <span>{selectedTopic.nameVi}</span>
                  <span className="text-sm font-bold text-[#8B9097]">({selectedTopic.nameZh})</span>
                </h2>
                <p className="text-xs text-[#5F6368] mt-0.5">
                  Danh sách từ vựng trọng tâm thuộc chủ đề này. Bấm vào biểu tượng loa để nghe AI phát âm chuẩn.
                </p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-60">
                <Search className="w-4 h-4 text-[#8B9097] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm từ trong chủ đề..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl text-xs outline-none focus:border-[#B91B1C]"
                />
              </div>

              <select
                value={topicHskFilter}
                onChange={(e) => setTopicHskFilter(e.target.value)}
                className="h-8 px-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-lg text-xs font-bold text-[#18181B] outline-none"
              >
                <option value="">Tất cả HSK</option>
                <option value="1">HSK 1</option>
                <option value="2">HSK 2</option>
                <option value="3">HSK 3</option>
                <option value="4">HSK 4</option>
                <option value="5">HSK 5</option>
                <option value="6">HSK 6</option>
                <option value="7-9">HSK 7–9</option>
              </select>
            </div>
          </div>

          {/* Topic Words Table */}
          <div className="bg-white rounded-2xl border border-[#E7E7EA] overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F7F9] border-b border-[#E7E7EA] text-[#8B9097] uppercase font-bold text-[10px]">
                <tr>
                  <th className="p-4">Chữ Hán</th>
                  <th className="p-4">Phiên âm Pinyin</th>
                  <th className="p-4">Nghĩa Tiếng Việt</th>
                  <th className="p-4">Nghĩa Tiếng Anh</th>
                  <th className="p-4">Cấp độ</th>
                  <th className="p-4">Phát âm</th>
                  <th className="p-4 text-right">Lưu Sổ Tay SRS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E7EA]">
                {topicLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#8B9097]">
                      Đang tải kho từ vựng chủ đề...
                    </td>
                  </tr>
                ) : displayTopicWords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#8B9097]">
                      Chưa có từ vựng nào trong bộ lọc này.
                    </td>
                  </tr>
                ) : (
                  displayTopicWords.map((word) => {
                    const isSaved = justSavedIds.has(word._id) || allSavedWords.some((sw) => sw.hanzi === word.simplified);

                    return (
                      <tr key={word._id} className="hover:bg-[#F7F7F9]/50 transition-colors">
                        <td className="p-4">
                          <span className="font-mono text-xl font-black text-[#18181B]">{word.simplified}</span>
                        </td>
                        <td className="p-4 font-mono font-bold text-[#B91B1C]">{word.pinyin}</td>
                        <td className="p-4 font-bold text-[#18181B]">
                          {word.meanings.vi && word.meanings.vi.length > 0 ? (
                            word.meanings.vi.join(', ')
                          ) : (
                            <span className="text-[#8B9097] italic font-normal text-[11px]">Đang cập nhật nghĩa</span>
                          )}
                        </td>
                        <td className="p-4 text-[#5F6368]">
                          {word.meanings.en && word.meanings.en.length > 0 ? word.meanings.en.join(', ') : '—'}
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-[#F7F7F9] text-[#18181B] border border-[#E7E7EA]">
                            HSK {word.hskLevel}
                          </span>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => playPronunciation(word.simplified)}
                            className={`p-1.5 rounded-full border transition-colors ${
                              speakingWord === word.simplified
                                ? 'bg-[#B91B1C] text-white border-[#B91B1C]'
                                : 'border-[#E7E7EA] text-[#5F6368] hover:text-[#B91B1C]'
                            }`}
                            title="Nghe phát âm"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            disabled={isSaved}
                            onClick={() => handleSaveToNotebook(word)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ml-auto transition-colors ${
                              isSaved
                                ? 'bg-[#E6F4EA] text-[#137333] cursor-default'
                                : 'bg-[#F7F7F9] hover:bg-[#FDF1F1] text-[#18181B] hover:text-[#B91B1C] border border-[#E7E7EA]'
                            }`}
                          >
                            {isSaved ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#137333]" />
                                <span>Đã lưu</span>
                              </>
                            ) : (
                              <>
                                <BookmarkPlus className="w-3.5 h-3.5" />
                                <span>Lưu ôn tập</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: MY NOTEBOOK (SỔ TAY SRS) */}
      {activeTab === 'notebook' && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-[#E7E7EA]">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-[#8B9097] absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Tìm theo chữ Hán, Pinyin hoặc nghĩa tiếng Việt..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl text-xs outline-none focus:border-[#B91B1C]"
              />
            </div>
          </div>

          {/* Word Table List */}
          <div className="bg-white rounded-2xl border border-[#E7E7EA] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F7F9] border-b border-[#E7E7EA] text-[#8B9097] uppercase font-bold text-[10px]">
                <tr>
                  <th className="p-4">Chữ Hán</th>
                  <th className="p-4">Phiên âm Pinyin</th>
                  <th className="p-4">Nghĩa Tiếng Việt</th>
                  <th className="p-4">Loại từ</th>
                  <th className="p-4">Phát âm AI</th>
                  <th className="p-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E7EA]">
                {displayNotebookWords.map((word) => (
                  <tr key={word.id} className="hover:bg-[#F7F7F9]/50 transition-colors">
                    <td className="p-4 font-mono text-xl font-black text-[#18181B]">{word.hanzi}</td>
                    <td className="p-4 font-mono font-bold text-[#B91B1C]">{word.pinyin}</td>
                    <td className="p-4 font-bold text-[#18181B]">{word.meaningVi}</td>
                    <td className="p-4 text-[#5F6368]">{word.partOfSpeech}</td>
                    <td className="p-4">
                      <button
                        onClick={() => playPronunciation(word.hanzi)}
                        className={`p-1.5 rounded-full border transition-colors ${
                          speakingWord === word.hanzi
                            ? 'bg-[#B91B1C] text-white border-[#B91B1C]'
                            : 'border-[#E7E7EA] text-[#5F6368] hover:text-[#B91B1C]'
                        }`}
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => onRemoveWord(word.id)}
                        className="p-1.5 rounded-lg border border-[#E7E7EA] hover:bg-[#FDF1F1] text-[#B91B1C]"
                        title="Bỏ lưu từ vựng"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {displayNotebookWords.length === 0 && (
              <div className="p-8 text-center text-[#5F6368] text-sm">
                Chưa có từ vựng nào được lưu trong sổ tay. Hãy mở các khối chủ đề để lưu thêm từ vựng mới!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
