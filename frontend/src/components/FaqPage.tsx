import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  Search,
  ChevronDown,
  Sparkles,
  BookOpen,
  CreditCard,
  GraduationCap,
  ShieldCheck,
  Crown,
  ArrowRight,
  Menu,
  X,
  PhoneCall,
  Mail,
  CheckCircle2,
  Copy,
  Check,
  Send,
  Clock,
  UserCheck,
  ExternalLink,
  MessageSquare,
  Film,
  Compass,
  Bot,
  Zap,
} from 'lucide-react';
import ContactShowcase from './common/ContactShowcase';

interface FaqPageProps {
  onSignIn?: () => void;
  onSignUp?: () => void;
  onStartSurvey?: () => void;
}

type FaqCategory = 'all' | 'method' | 'learning' | 'account' | 'billing';

interface FaqItem {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  keyPoints?: string[];
  badge?: string;
}

const FAQ_CATEGORIES: { id: FaqCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all', label: 'Tất cả câu hỏi', icon: HelpCircle },
  { id: 'method', label: 'Phương pháp & Phim ảnh', icon: BookOpen },
  { id: 'learning', label: 'Lộ trình HSK & Trợ lý AI', icon: GraduationCap },
  { id: 'account', label: 'Tài khoản & Thiết bị', icon: ShieldCheck },
  { id: 'billing', label: 'Thanh toán & Gói học', icon: CreditCard },
];

const FAQS_DATA: FaqItem[] = [
  // ── Nhóm 1: Phương pháp & Phim ảnh ────────────────────────────────
  {
    id: 'm1',
    category: 'method',
    question: 'Tôi là người mới bắt đầu hoặc đã mất gốc hoàn toàn, liệu có thể học theo phương pháp phim ảnh không?',
    answer:
      'Hoàn toàn phù hợp và rất hiệu quả! HanFlix thiết kế kho bài học bắt đầu từ mức cơ bản nhất (HSK 1 - 2). Mọi câu thoại đều được trang bị hệ thống phụ đề thông minh 3 tầng độc quyền: Chữ Hán nguyên bản, Phiên âm Pinyin chuẩn có thanh điệu và Nghĩa tiếng Việt đối chiếu. Bạn có thể tra từ điển 1-chạm vào bất kỳ chữ Hán nào để xem phân tích bộ thủ, nghĩa ngữ cảnh và nghe phát âm chậm.',
    keyPoints: [
      'Lộ trình phân cấp rõ ràng từ HSK 1 đến HSK 6',
      'Phụ đề 3 tầng tùy biến tắt/bật theo nhu cầu luyện nghe sâu',
      'Trợ lý AI Bảo Bảo chấm khẩu âm và nhận xét phát âm từng từ',
    ],
    badge: 'Phổ biến nhất',
  },
  {
    id: 'm2',
    category: 'method',
    question: 'Phương pháp học qua trích đoạn phim 1-3 phút của HanFlix khác gì so với xem video trên YouTube thông thường?',
    answer:
      'Trên YouTube, video chỉ mang tính chất giải trí thụ động: bạn phải dừng video, mở từ điển ngoài để tra cứu rồi dễ bị phân tâm bởi các đề xuất video khác. Tại HanFlix, mỗi video là một bài học tương tác hoàn chỉnh: chạm chữ tra nghĩa tức thì không cần dừng phát, lưu từ vào Flashcard SRS tự động, luyện nói đối đáp cùng AI và làm bài tập phản xạ củng cố ngay sau video.',
    keyPoints: [
      'Tra từ điển 1-chạm không thoát giao diện học',
      'Đồng bộ từ vựng yêu thích vào thuật toán lặp lại ngắt quãng (SRS)',
      'Bài tập trắc nghiệm nghe hiểu và ngữ pháp bám sát ngữ cảnh thực tế',
    ],
    badge: 'Đột phá',
  },
  {
    id: 'm3',
    category: 'method',
    question: 'Thuật toán lặp lại ngắt quãng Spaced Repetition (SRS) trên HanFlix hoạt động như thế nào?',
    answer:
      'Thuật toán SRS dựa trên đường cong lãng quên của não bộ (Ebbinghaus Forgetting Curve). Khi bạn lưu một từ vựng hoặc câu thoại, hệ thống sẽ tính toán thời điểm vàng mà não bạn sắp quên để nhắc bạn ôn tập (ngày 1, ngày 3, ngày 7, ngày 14, ngày 30). Nhờ đó, bạn ghi nhớ vĩnh viễn hàng nghìn từ vựng mà chỉ cần 5-10 phút ôn tập Flashcard mỗi ngày.',
    keyPoints: [
      'Ghi nhớ từ vựng sâu gấp 3 lần so với ghi chép thông thường',
      'Tự động phân loại từ khó để tăng tần suất nhắc lại',
    ],
  },
  {
    id: 'm4',
    category: 'method',
    question: 'Tôi có thể học trên thiết bị di động (smartphone/tablet) thuận tiện không?',
    answer:
      'Giao diện HanFlix được tối ưu hóa toàn diện cho cả máy tính, máy tính bảng và điện thoại di động (Responsive Design). Bạn có thể thao tác chạm tra từ điển 1-chạm, lật thẻ Flashcard vuốt mượt mà và luyện nói AI ngay trên trình duyệt điện thoại mà không cần cài đặt ứng dụng cồng kềnh.',
    keyPoints: [
      'Tương thích mượt mà trên iOS, iPadOS và Android',
      'Thao tác chạm 1-chạm nhạy bén trên màn hình cảm ứng',
    ],
  },

  // ── Nhóm 2: Lộ trình HSK & Trợ lý AI ─────────────────────────────
  {
    id: 'l1',
    category: 'learning',
    question: 'Khảo sát tìm lộ trình học cá nhân hóa hoạt động như thế nào và mất bao lâu?',
    answer:
      'Khảo sát chỉ mất khoảng 2 phút với 6 câu hỏi ngắn được thiết kế bởi chuyên gia ngôn ngữ: Đánh giá trình độ hiện tại, Mục tiêu học (giao tiếp du lịch, công việc, thi HSK), Thời gian bạn có thể dành mỗi ngày và Thể loại phim yêu thích. Ngay sau khi hoàn thành, hệ thống sẽ tự động tổng hợp danh mục trích đoạn phim và bài học tối ưu nhất cho riêng bạn.',
    keyPoints: [
      'Miễn phí 100% cho mọi học viên mới bắt đầu',
      'Đề xuất video theo đúng sở thích và trình độ hiện tại',
    ],
    badge: 'Khuyên dùng',
  },
  {
    id: 'l2',
    category: 'learning',
    question: 'Trợ lý AI Bảo Bảo có thể giúp tôi những gì trong quá trình học?',
    answer:
      'Gấu Trúc Bảo Bảo là trợ lý học tập AI thông minh tích hợp trên HanFlix:\n- Phân tích và chấm điểm độ chính xác phát âm từng thanh điệu\n- Đóng vai nhân vật trong phim để trò chuyện đối đáp trực tiếp với bạn theo ngữ cảnh đời thực\n- Giải thích chi tiết ngữ pháp, cấu trúc câu và sự khác biệt giữa các từ đồng nghĩa\n- Nhắc nhở duy trì chuỗi học tập (Streak) và đồng hành động viên mỗi ngày.',
    keyPoints: [
      'Chấm khẩu âm và ngữ điệu tức thời theo thời gian thực',
      'Mô phỏng hội thoại đời sống xóa bỏ nỗi sợ nói ngập ngừng',
    ],
    badge: 'Trợ lý AI 24/7',
  },
  {
    id: 'l3',
    category: 'learning',
    question: 'Học trên HanFlix có thể giúp tôi chinh phục kỳ thi chứng chỉ HSK không?',
    answer:
      'Hoàn toàn có! HanFlix xây dựng hệ thống từ vựng và câu thoại bám sát 100% chuẩn HSK mới từ cấp 1 đến cấp 6. Phương pháp phản xạ qua phim giúp bạn bứt phá 2 kỹ năng khó nhất trong bài thi HSK là Nghe hiểu (Listening) và Phản xạ ngữ pháp, giúp học viên nhớ từ lâu hơn rất nhiều so với học vẹt danh sách chữ Hán đơn thuần.',
    keyPoints: [
      'Phân loại bài học theo từng cấp độ HSK 1 - 6 rõ ràng',
      'Ghi nhớ ngữ cảnh tự nhiên giúp làm bài thi nhanh và chính xác hơn',
    ],
  },

  // ── Nhóm 3: Tài khoản & Thiết bị ─────────────────────────────────
  {
    id: 'a1',
    category: 'account',
    question: 'Tôi có thể đăng nhập một tài khoản trên cả điện thoại và máy tính cùng lúc không?',
    answer:
      'Có! Tài khoản HanFlix của bạn được đồng bộ dữ liệu trên nền tảng đám mây thời gian thực. Bạn có thể học trên máy tính tại cơ quan và tiếp tục ôn từ vựng trên điện thoại khi đi tàu xe hoặc ở nhà mà không lo mất tiến độ học tập hay chuỗi ngày Streak.',
    keyPoints: [
      'Đồng bộ đám mây dữ liệu học tập tức thì',
      'Không giới hạn thiết bị chuyển đổi linh hoạt',
    ],
  },
  {
    id: 'a2',
    category: 'account',
    question: 'Nếu tôi quên mật khẩu đăng nhập hoặc cần hỗ trợ kỹ thuật thì liên hệ ai?',
    answer:
      'Tại trang Đăng nhập, bạn chỉ cần nhấn "Quên mật khẩu?", nhập email đã đăng ký để nhận liên kết khôi phục an toàn trong vài giây. Ngoài ra, đội ngũ kỹ thuật HanFlix luôn thường trực qua Hotline/Zalo 0355 987 238 và Email để hỗ trợ bạn ngay khi có yêu cầu.',
  },

  // ── Nhóm 4: Thanh toán & Gói học (Đã rút gọn tối đa: 2 câu minh bạch) ──
  {
    id: 'b1',
    category: 'billing',
    question: 'Quy trình thanh toán qua cổng PayOS và VietQR diễn ra như thế nào?',
    answer:
      'Thanh toán tại HanFlix hoàn toàn tự động và an toàn thông qua cổng thanh toán quốc gia PayOS (chuẩn VietQR):\n1. Chọn gói học bạn mong muốn trên trang Nâng cấp.\n2. Hệ thống tạo mã VietQR kèm số tiền và nội dung chuyển khoản tự động.\n3. Dùng ứng dụng ngân hàng hoặc ví điện tử bất kỳ quét mã QR và xác nhận.\n4. Sau khi chuyển tiền thành công, hệ thống PayOS kích hoạt gói VIP của bạn chỉ trong 3-5 giây mà không cần chờ duyệt thủ công.',
    keyPoints: [
      'Hỗ trợ 100% tất cả các ngân hàng và ví điện tử tại Việt Nam',
      'Kích hoạt tài khoản tức thì (Real-time)',
      'Không lưu trữ thông tin thẻ ngân hàng của học viên',
    ],
    badge: 'Tự động PayOS',
  },
  {
    id: 'b2',
    category: 'billing',
    question: 'Gói cước có tự động gia hạn và trừ tiền tài khoản ngân hàng của tôi khi hết hạn không?',
    answer:
      'TUYỆT ĐỐI KHÔNG! HanFlix sử dụng phương thức chuyển khoản từng lần qua mã QR ngân hàng. Chúng tôi cam kết KHÔNG lưu thẻ tín dụng, KHÔNG tự động trừ tiền trong tài khoản của bạn. Khi tài khoản sắp hết hạn, hệ thống sẽ gửi thông báo nhắc nhở và bạn toàn quyền chủ động quyết định có tiếp tục gia hạn hay không.',
    keyPoints: [
      'Minh bạch 100% tài chính người dùng',
      'Chỉ thanh toán khi bạn chủ động quét mã xác nhận',
    ],
    badge: 'Cam kết 100%',
  },
];

export default function FaqPage({
  onSignIn,
  onSignUp,
  onStartSurvey,
}: FaqPageProps) {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<FaqCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqIds, setOpenFaqIds] = useState<Record<string, boolean>>({});
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Quick contact form state
  const [contactForm, setContactForm] = useState({
    name: '',
    contact: '',
    topic: 'Tư vấn lộ trình HSK',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleSignIn = () => {
    if (onSignIn) onSignIn();
    else navigate('/auth/login');
  };

  const handleStartSurvey = () => {
    if (onStartSurvey) onStartSurvey();
    else navigate('/auth/signup');
  };

  const toggleFaq = (id: string) => {
    setOpenFaqIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleExpandAll = () => {
    const allIds: Record<string, boolean> = {};
    FAQS_DATA.forEach((f) => {
      allIds[f.id] = true;
    });
    setOpenFaqIds(allIds);
  };

  const handleCollapseAll = () => {
    setOpenFaqIds({});
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSubmitContactForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.contact.trim() || !contactForm.message.trim()) {
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitSuccess(true);
    }, 600);
  };

  // Filter FAQs by Category & Search
  const filteredFaqs = useMemo(() => {
    return FAQS_DATA.filter((item) => {
      const matchCategory =
        selectedCategory === 'all' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        (item.keyPoints && item.keyPoints.some((p) => p.toLowerCase().includes(q)));
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  // When 'all' is selected and user hasn't searched or expanded, limit to top 4 questions
  const displayedFaqs = useMemo(() => {
    if (selectedCategory === 'all' && !searchQuery.trim() && !showAllFaqs) {
      return filteredFaqs.slice(0, 4);
    }
    return filteredFaqs;
  }, [filteredFaqs, selectedCategory, searchQuery, showAllFaqs]);

  return (
    <div className="min-h-[100dvh] bg-[#FFF9F5] text-[#18181B] selection:bg-[#B91B1C] selection:text-white font-sans overflow-x-hidden flex flex-col">
      {/* ── 1. HEADER ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 h-16 sm:h-20 md:h-[88px] flex items-center justify-between px-4 sm:px-6 md:px-12 bg-[#FFF9F5]/95 backdrop-blur-md border-b border-[#F2E4D8]/80 transition-all safe-area-top">
        {/* Logo */}
        <button
          onClick={() => {
            navigate('/');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center group text-left cursor-pointer py-1"
          aria-label="Về trang chủ HanFlix"
        >
          <img
            src="/assets/logo.png"
            alt="HanFlix Logo"
            className="h-9 sm:h-12 md:h-16 lg:h-[72px] w-auto max-w-[140px] sm:max-w-[220px] md:max-w-[320px] object-contain hover:scale-105 transition-transform drop-shadow-sm"
          />
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-7 xl:gap-8 text-sm font-semibold text-[#18181B]/80">
          <button
            onClick={() => {
              navigate('/');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="hover:text-[#B91B1C] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#8FB9A7]" />
            Trang chủ
          </button>
          <button
            onClick={() => navigate('/about')}
            className="hover:text-[#B91B1C] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#E7A92F]" />
            Giới thiệu
          </button>
          <button
            onClick={() => navigate('/students')}
            className="hover:text-[#B91B1C] transition-colors cursor-pointer"
          >
            Học viên
          </button>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="text-[#B91B1C] transition-colors flex items-center gap-1.5 cursor-pointer font-bold"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#B91B1C]" />
            Hỏi đáp
          </button>
          <button
            onClick={() => navigate('/premium')}
            className="hover:text-[#B91B1C] transition-colors flex items-center gap-1.5 group cursor-pointer"
          >
            <Crown className="w-4 h-4 text-[#B91B1C] group-hover:scale-110 transition-transform" />
            <span className="relative">
              Nâng cấp
              <span className="absolute -top-2.5 -right-5 px-1.5 py-0.2 bg-[#B91B1C] text-white text-[9px] font-bold rounded-full uppercase tracking-tighter">
                VIP
              </span>
            </span>
          </button>
        </nav>

        {/* Header CTAs */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={handleSignIn}
            className="text-xs sm:text-sm font-bold text-[#18181B]/80 hover:text-[#B91B1C] px-2.5 sm:px-3 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Đăng nhập
          </button>
          <button
            onClick={handleStartSurvey}
            className="h-9 sm:h-11 px-3.5 sm:px-5 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs md:text-sm font-bold flex items-center gap-1.5 sm:gap-2 glow-crimson transition-all active:scale-[0.98] cursor-pointer shrink-0"
          >
            <span className="hidden xs:inline sm:inline">Tìm lộ trình của tôi</span>
            <span className="inline xs:hidden sm:hidden">Lộ trình</span>
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl border border-[#F2E4D8] bg-white text-[#18181B] hover:text-[#B91B1C] hover:border-[#B91B1C] transition-colors cursor-pointer"
            aria-label="Mở bảng chọn di động"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="lg:hidden sticky top-16 sm:top-20 z-40 bg-[#FFF9F5] border-b-2 border-[#F2E4D8] px-4 py-4 space-y-3 shadow-lg animate-in slide-in-from-top-2">
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full text-left flex items-center gap-2 text-sm font-bold text-[#18181B] hover:text-[#B91B1C] p-2 rounded-xl hover:bg-white transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-[#8FB9A7]" />
            Trang chủ
          </button>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/about');
            }}
            className="w-full text-left flex items-center gap-2 text-sm font-bold text-[#18181B] hover:text-[#B91B1C] p-2 rounded-xl hover:bg-white transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-[#E7A92F]" />
            Giới thiệu dự án FPT EXE 2
          </button>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/students');
            }}
            className="w-full text-left block text-sm font-bold text-[#18181B] hover:text-[#B91B1C] p-2 rounded-xl hover:bg-white transition-colors cursor-pointer"
          >
            Học viên
          </button>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full text-left flex items-center gap-2 text-sm font-bold text-[#B91B1C] bg-white p-2 rounded-xl border border-[#B91B1C]/20 transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-[#B91B1C]" />
            Hỏi đáp thường gặp
          </button>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/premium');
            }}
            className="w-full flex items-center justify-between text-sm font-bold text-[#B91B1C] p-2.5 rounded-xl bg-white border border-[#B91B1C]/20 shadow-2xs cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-[#B91B1C]" />
              Nâng cấp gói VIP
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#B91B1C] text-white text-[10px] font-bold uppercase">
              Xem gói
            </span>
          </button>
        </div>
      )}

      {/* ── 2. HERO SECTION: EDITORIAL ORIENTAL SANCTUARY ─────────────── */}
      <section className="relative py-12 sm:py-16 md:py-20 px-4 sm:px-6 md:px-12 bg-gradient-to-b from-[#FFF9F5] via-[#FFF5EC] to-[#FFF9F5] border-b border-[#F2E4D8]/80 overflow-hidden">
        {/* Subtle decorative calligraphy watermarks */}
        <div className="absolute top-2 -right-8 text-[140px] sm:text-[220px] font-calligraphy text-[#B91B1C]/4 select-none pointer-events-none">
          問
        </div>
        <div className="absolute bottom-2 -left-8 text-[120px] sm:text-[200px] font-calligraphy text-[#8FB9A7]/5 select-none pointer-events-none">
          答
        </div>

        <div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Heading, Search & Keyword Pills */}
          <div className="lg:col-span-7 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#8FB9A7]/15 border border-[#8FB9A7]/30 text-[#2F6E62] text-xs font-bold tracking-wide uppercase mb-4 shadow-xs backdrop-blur-xs">
              <span className="text-sm">🏮</span>
              <span>Trung Tâm Giải Đáp & Hỗ Trợ Học Thuật</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#B91B1C] leading-[1.12] mb-4 font-fraunces tracking-tight">
              Mọi Câu Trả Lời <br />
              <span className="text-[#18181B]">Cho Hành Trình Tiếng Trung</span>
            </h1>

            <p className="text-sm sm:text-base md:text-lg text-[#5F6368] mb-6 max-w-xl leading-relaxed">
              Khám phá chi tiết phương pháp học tự nhiên qua trích đoạn phim, phụ đề 3 lớp thông minh, trợ lý AI Bảo Bảo và kênh tư vấn 1-1 trực tiếp từ ban dự án FPT EXE 2.
            </p>

            {/* Smart Search Bar */}
            <div className="relative max-w-xl mb-4">
              <div className="relative flex items-center">
                <Search className="w-5 h-5 text-[#8B9097] absolute left-4.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm câu hỏi (ví dụ: 'phụ đề 3 lớp', 'mất gốc', 'AI Bảo Bảo', 'SRS')..."
                  className="w-full h-13 sm:h-14 pl-12 pr-12 rounded-2xl bg-white border-2 border-[#F2E4D8] focus:border-[#B91B1C] focus:ring-4 focus:ring-[#B91B1C]/10 text-sm sm:text-base text-[#18181B] placeholder-[#8B9097] shadow-sm transition-all outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 p-1.5 text-[#8B9097] hover:text-[#18181B] cursor-pointer"
                    aria-label="Xóa tìm kiếm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Quick Suggestion Chips */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[#8B9097] font-semibold">Chủ đề tìm nhiều:</span>
                {[
                  'Phụ đề 3 tầng',
                  'Mất gốc',
                  'Trợ lý AI Bảo Bảo',
                  'Flashcard SRS',
                  'Cổng PayOS',
                ].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setSearchQuery(chip)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-[#F2E4D8] hover:border-[#B91B1C]/40 text-[#5F6368] hover:text-[#B91B1C] font-medium transition-all shadow-2xs cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {searchQuery && (
                <div className="text-xs text-[#5F6368] mt-2.5">
                  Tìm thấy <span className="font-bold text-[#B91B1C]">{filteredFaqs.length}</span> câu hỏi phù hợp với "{searchQuery}"
                </div>
              )}
            </div>

            {/* Trust Metrics Bar */}
            <div className="grid grid-cols-3 gap-3 pt-3 max-w-xl text-left border-t border-[#F2E4D8]/80">
              <div>
                <div className="text-base sm:text-xl font-black text-[#B91B1C] font-fraunces">1.250+</div>
                <div className="text-[11px] text-[#5F6368]">Học viên tích cực</div>
              </div>
              <div>
                <div className="text-base sm:text-xl font-black text-[#2F6E62] font-fraunces">&lt; 30 Phút</div>
                <div className="text-[11px] text-[#5F6368]">Tốc độ giải đáp</div>
              </div>
              <div>
                <div className="text-base sm:text-xl font-black text-[#E7A92F] font-fraunces">100%</div>
                <div className="text-[11px] text-[#5F6368]">Không trừ tiền tự động</div>
              </div>
            </div>
          </div>

          {/* Right Column: Editorial Visual Showcase Image */}
          <div className="lg:col-span-5">
            <div className="relative rounded-3xl overflow-hidden border-2 border-[#F2E4D8] shadow-md group bg-white">
              <img
                src="/assets/faq_hero_study_ambience.jpg"
                alt="Không gian học tiếng Trung hiện đại HanFlix"
                className="w-full h-[280px] sm:h-[360px] lg:h-[420px] object-cover object-center group-hover:scale-102 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#18181B]/85 via-transparent to-transparent flex flex-col justify-end p-6 text-white">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E7A92F]/20 backdrop-blur-md text-[#FFF3DE] text-xs font-bold w-fit mb-2 border border-[#E7A92F]/40">
                  <Sparkles className="w-3.5 h-3.5 text-[#E7A92F]" />
                  <span>Phương Pháp Tự Nhiên & Khoa Học</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white font-fraunces">
                  Học Tiếng Trung Qua Phim & AI Đồng Hành
                </h3>
                <p className="text-xs text-white/80 line-clamp-2 mt-1">
                  15 phút mỗi ngày cùng trích đoạn ngữ cảnh đời thực, ghi nhớ từ vựng vĩnh viễn với thuật toán SRS.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── 3. TRUNG TÂM GIẢI ĐÁP & HỎI ĐÁP TRỌNG TÂM (SPLIT 2-COLUMN VIEW) ─── */}
      <section id="faqs-section" className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 md:px-12 bg-white border-b border-[#F2E4D8]/80">
        <div className="max-w-6xl mx-auto">
          
          {/* Section Header */}
          <div className="text-center sm:text-left max-w-2xl mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B91B1C] uppercase tracking-wider mb-2">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Kho Tri Thức Học Viên</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black font-fraunces text-[#18181B] mb-2">
              Danh Mục Câu Hỏi Trọng Tâm
            </h2>
            <p className="text-xs sm:text-sm text-[#5F6368]">
              Chọn chuyên mục bên dưới để xem giải đáp nhanh hoặc gửi yêu cầu tư vấn 1-1 trực tiếp tới ban dự án.
            </p>
          </div>

          {/* Mobile Category Scroll Pills (< lg) */}
          <div className="lg:hidden flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
            {FAQ_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              const count =
                cat.id === 'all'
                  ? FAQS_DATA.length
                  : FAQS_DATA.filter((f) => f.category === cat.id).length;

              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setShowAllFaqs(false);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? 'bg-[#B91B1C] text-white shadow-2xs'
                      : 'bg-[#FFF9F5] border border-[#F2E4D8] text-[#5F6368] hover:text-[#B91B1C]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[#FFF3DE] text-[#B7791F]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 2-Column Responsive Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Desktop Left Column: Sticky Category Sidebar (lg:col-span-4) */}
            <div className="hidden lg:block lg:col-span-4">
              <div className="sticky top-28 space-y-4">
                
                {/* Category Navigation Box */}
                <div className="bg-[#FFF9F5] rounded-2xl border border-[#F2E4D8] p-3 shadow-2xs">
                  <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#8B9097] flex items-center justify-between border-b border-[#F2E4D8]/60 mb-2">
                    <span>Chuyên mục</span>
                    <span className="text-[10px] bg-[#FFF2EE] text-[#B91B1C] px-2 py-0.5 rounded-full font-bold">
                      {FAQS_DATA.length} câu hỏi
                    </span>
                  </div>

                  <div className="space-y-1">
                    {FAQ_CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isActive = selectedCategory === cat.id;
                      const count =
                        cat.id === 'all'
                          ? FAQS_DATA.length
                          : FAQS_DATA.filter((f) => f.category === cat.id).length;

                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategory(cat.id);
                            setShowAllFaqs(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                            isActive
                              ? 'bg-[#B91B1C] text-white shadow-2xs'
                              : 'text-[#5F6368] hover:bg-white hover:text-[#B91B1C]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#8B9097]'}`} />
                            <span>{cat.label}</span>
                          </div>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                              isActive ? 'bg-white/20 text-white' : 'bg-white border border-[#F2E4D8] text-[#5F6368]'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 1-on-1 Help Callout */}
                <div className="p-4 rounded-2xl bg-white border border-[#F2E4D8] shadow-2xs text-left">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#B91B1C] mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#E7A92F]" />
                    <span>Cần Tư Vấn Riêng 1-1?</span>
                  </div>
                  <p className="text-[11px] text-[#5F6368] leading-relaxed mb-3">
                    Đội ngũ học thuật HanFlix sẵn sàng hỗ trợ định hướng lộ trình HSK và kỹ thuật trong vòng 30 phút.
                  </p>
                  <a
                    href="#contact"
                    className="w-full py-2 px-3 rounded-xl bg-[#FFF9F5] border border-[#B91B1C] text-[#B91B1C] hover:bg-[#B91B1C] hover:text-white text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Gửi câu hỏi ngay</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>

              </div>
            </div>

            {/* Right Column: Accordion Questions (lg:col-span-8) */}
            <div className="lg:col-span-8">
              
              {/* Controls bar */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#F2E4D8]">
                <div className="flex items-center gap-2">
                  <h3 className="font-fraunces text-base sm:text-lg font-bold text-[#18181B]">
                    {FAQ_CATEGORIES.find((c) => c.id === selectedCategory)?.label || 'Tất cả câu hỏi'}
                  </h3>
                  <span className="text-xs text-[#8B9097] font-semibold">({filteredFaqs.length})</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={handleExpandAll}
                    className="px-2.5 py-1 rounded-lg border border-[#F2E4D8] hover:border-[#B91B1C] text-[#5F6368] hover:text-[#B91B1C] font-semibold transition-colors cursor-pointer text-[11px]"
                  >
                    Mở tất cả
                  </button>
                  <button
                    onClick={handleCollapseAll}
                    className="px-2.5 py-1 rounded-lg border border-[#F2E4D8] hover:border-[#B91B1C] text-[#5F6368] hover:text-[#B91B1C] font-semibold transition-colors cursor-pointer text-[11px]"
                  >
                    Thu gọn
                  </button>
                </div>
              </div>

              {/* Accordion Questions List */}
              {filteredFaqs.length === 0 ? (
                <div className="text-center py-12 bg-[#FFF9F5] rounded-2xl border border-[#F2E4D8] p-6">
                  <HelpCircle className="w-10 h-10 text-[#B91B1C]/40 mx-auto mb-2" />
                  <h4 className="text-base font-bold text-[#18181B] mb-1">
                    Không tìm thấy câu hỏi phù hợp
                  </h4>
                  <p className="text-xs text-[#5F6368] mb-4">
                    Thử từ khóa khác hoặc liên hệ trực tiếp với ban cố vấn HanFlix bên dưới.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                    }}
                    className="px-4 py-2 rounded-full bg-[#B91B1C] text-white text-xs font-bold cursor-pointer"
                  >
                    Xem tất cả câu hỏi
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedFaqs.map((faq) => {
                    const isOpen = Boolean(openFaqIds[faq.id]);
                    return (
                      <div
                        key={faq.id}
                        className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                          isOpen
                            ? 'border-[#B91B1C]/40 bg-[#FFF9F5] shadow-2xs'
                            : 'border-[#F2E4D8] bg-white hover:border-[#B91B1C]/30'
                        }`}
                      >
                        <button
                          onClick={() => toggleFaq(faq.id)}
                          className="w-full text-left p-4 sm:p-4.5 flex items-center justify-between gap-3 cursor-pointer"
                          aria-expanded={isOpen}
                        >
                          <div className="flex items-center gap-3 pr-2">
                            <span className="w-5 h-5 rounded-full bg-[#B91B1C]/10 text-[#B91B1C] text-[11px] font-black flex items-center justify-center shrink-0">
                              ?
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-xs sm:text-sm text-[#18181B] leading-snug">
                                {faq.question}
                              </span>
                              {faq.badge && (
                                <span className="px-2 py-0.5 rounded-md bg-[#FFF3DE] text-[#B7791F] text-[10px] font-bold">
                                  {faq.badge}
                                </span>
                              )}
                            </div>
                          </div>

                          <div
                            className={`p-1 rounded-full transition-transform shrink-0 ${
                              isOpen ? 'bg-[#B91B1C] text-white rotate-180' : 'bg-[#FFF3DE] text-[#B7791F]'
                            }`}
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </div>
                        </button>

                        {isOpen && (
                          <div className="px-4 sm:px-4.5 pb-4 pt-0 text-xs sm:text-sm text-[#3C4043] leading-relaxed border-t border-[#F2E4D8]/60 mt-0.5">
                            <div className="pt-3 whitespace-pre-line text-xs sm:text-sm leading-relaxed">
                              {faq.answer}
                            </div>

                            {faq.keyPoints && faq.keyPoints.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-[#F2E4D8]/60 flex flex-wrap gap-2">
                                {faq.keyPoints.map((kp, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#8FB9A7]/40 text-[#2F6E62] text-[11px] font-medium"
                                  >
                                    <Check className="w-3 h-3 text-[#2F6E62]" />
                                    <span>{kp}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Show More / Show Less Toggle when viewing 'All' */}
                  {selectedCategory === 'all' && !searchQuery.trim() && filteredFaqs.length > 4 && (
                    <button
                      onClick={() => setShowAllFaqs(!showAllFaqs)}
                      className="w-full py-2.5 rounded-xl border border-dashed border-[#F2E4D8] hover:border-[#B91B1C] text-xs font-bold text-[#5F6368] hover:text-[#B91B1C] bg-[#FFF9F5] transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-2"
                    >
                      <span>
                        {showAllFaqs
                          ? 'Thu gọn danh sách câu hỏi'
                          : `Xem thêm ${filteredFaqs.length - 4} câu hỏi khác`}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${showAllFaqs ? 'rotate-180' : ''}`}
                      />
                    </button>
                  )}
                </div>
              )}

              {/* VIP Pricing Hint Banner */}
              <div className="mt-6 p-3.5 sm:p-4 rounded-2xl bg-[#FFF9F5] border border-[#F2E4D8] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FFF2EE] border border-[#F2D0C7] text-[#B91B1C] flex items-center justify-center shrink-0">
                    <Crown className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#18181B]">
                      Cần bảng giá chi tiết các gói cước VIP 1 tháng, 3 tháng và 12 tháng?
                    </div>
                    <div className="text-[11px] text-[#5F6368]">
                      Trải nghiệm học không giới hạn với kho video độc quyền tại trang bảng giá.
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/premium')}
                  className="px-3.5 py-1.5 rounded-full bg-white border border-[#B91B1C] text-[#B91B1C] hover:bg-[#B91B1C] hover:text-white text-xs font-bold transition-all shadow-2xs cursor-pointer shrink-0"
                >
                  Xem bảng giá VIP →
                </button>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ── 5. CHUYÊN MỤC LIÊN HỆ & TƯ VẤN TRỰC TIẾP (BENTO GRID CAO CẤP) */}
      <section id="contact" className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 md:px-12 bg-[#FFF9F5] relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-[#8FB9A7]/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#FDECE5]/80 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10">
          
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#8FB9A7]/15 border border-[#8FB9A7]/30 text-[#2F6E62] text-xs font-bold tracking-wide uppercase mb-3 sm:mb-4 shadow-xs">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>KÊNH LIÊN HỆ & ĐỒNG HÀNH TRỰC TIẾP</span>
            </div>

            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-[#18181B] font-fraunces mb-3 sm:mb-4">
              Bạn Cần Hỗ Trợ Riêng Biệt? <br />
              <span className="text-[#B91B1C]">Chúng Tôi Luôn Lắng Nghe Bạn</span>
            </h2>

            <p className="text-[#5F6368] text-xs sm:text-base leading-relaxed">
              Dù là định hướng lộ trình HSK cá nhân, giải đáp phương pháp hay hỗ trợ kỹ thuật, đội ngũ dự án HanFlix (Đại học FPT EXE 2) luôn sẵn sàng đồng hành 1-1 cùng bạn.
            </p>
          </div>

          {/* Bento Grid: Left Information & Right Quick Contact Form */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">
            
            {/* Left 5 Columns: Concierge Photo & Direct Contact Cards */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
              
              {/* Concierge Image Card */}
              <div className="relative rounded-3xl overflow-hidden border-2 border-[#F2E4D8] shadow-xs group bg-white">
                <img
                  src="/assets/faq_contact_concierge.jpg"
                  alt="Không gian tư vấn học thuật HanFlix"
                  className="w-full h-48 sm:h-56 object-cover object-center group-hover:scale-102 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#18181B]/80 via-transparent to-transparent flex flex-col justify-end p-5 text-white">
                  <div className="inline-flex items-center gap-1.5 text-xs text-[#E7A92F] font-bold mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ban Cố Vấn Học Thuật HanFlix</span>
                  </div>
                  <div className="text-sm font-semibold text-white/90">
                    Dự án Khởi nghiệp thực tế EXE 2 · Đại học FPT
                  </div>
                </div>
              </div>

              {/* Direct Channel Cards */}
              <div className="space-y-3 flex-1">
                {/* Hotline Card */}
                <div className="p-4 rounded-2xl bg-white border border-[#F2E4D8] hover:border-[#8FB9A7] transition-all shadow-2xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                      <PhoneCall className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-[#5F6368] font-medium">Hotline / Zalo hỗ trợ 24/7</div>
                      <div className="text-sm sm:text-base font-bold text-[#18181B]">0355 987 238</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyText('0355987238', 'phone')}
                      className="p-2 rounded-xl bg-[#FFF9F5] border border-[#F2E4D8] hover:text-[#B91B1C] text-xs font-semibold text-[#5F6368] transition-colors cursor-pointer"
                      title="Sao chép số điện thoại"
                    >
                      {copiedKey === 'phone' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <a
                      href="tel:0355987238"
                      className="px-3 py-1.5 rounded-xl bg-[#8FB9A7] hover:bg-[#7aa794] text-white text-xs font-bold transition-all"
                    >
                      Gọi ngay
                    </a>
                  </div>
                </div>

                {/* Email Card */}
                <div className="p-4 rounded-2xl bg-white border border-[#F2E4D8] hover:border-blue-300 transition-all shadow-2xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-[#5F6368] font-medium">Hòm thư tiếp nhận</div>
                      <div className="text-xs sm:text-sm font-bold text-[#18181B] truncate">
                        lequynhanh2806s2@gmail.com
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleCopyText('lequynhanh2806s2@gmail.com', 'email')}
                      className="p-2 rounded-xl bg-[#FFF9F5] border border-[#F2E4D8] hover:text-[#B91B1C] text-xs font-semibold text-[#5F6368] transition-colors cursor-pointer"
                      title="Sao chép email"
                    >
                      {copiedKey === 'email' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <a
                      href="mailto:lequynhanh2806s2@gmail.com"
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all"
                    >
                      Gửi thư
                    </a>
                  </div>
                </div>

                {/* Lead Project & Fanpage Card */}
                <div className="p-4 rounded-2xl bg-white border border-[#F2E4D8] shadow-2xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-[#5F6368] font-medium">Trưởng dự án HanFlix</div>
                      <div className="text-sm font-bold text-[#18181B]">Lê Quỳnh Anh</div>
                    </div>
                  </div>
                  <a
                    href="https://facebook.com"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-[#FFF2EE] border border-[#F2D0C7] text-[#B91B1C] hover:bg-[#B91B1C] hover:text-white text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <span>Fanpage</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Service Level Agreement Guarantee */}
              <div className="p-3.5 rounded-2xl bg-[#FFF3DE] border border-[#E7A92F]/40 text-[#B7791F] text-xs flex items-center gap-2.5">
                <Clock className="w-4 h-4 shrink-0 text-[#E7A92F]" />
                <span>Cam kết giải đáp mọi thắc mắc trong vòng <strong>30 phút</strong> từ thời điểm nhận tin.</span>
              </div>
            </div>

            {/* Right 7 Columns: Interactive Inquiry Form */}
            <div className="lg:col-span-7 bg-white rounded-3xl border-2 border-[#F2E4D8] p-6 sm:p-8 lg:p-10 shadow-xs flex flex-col justify-between">
              
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-bold text-[#B91B1C] uppercase tracking-wider mb-2">
                  <Send className="w-3.5 h-3.5" />
                  Gửi Yêu Cầu Tư Vấn Nhanh
                </div>

                <h3 className="text-xl sm:text-2xl font-black font-fraunces text-[#18181B] mb-2">
                  Để Lại Lời Nhắn Cho Đội Ngũ Cố Vấn
                </h3>

                <p className="text-xs sm:text-sm text-[#5F6368] mb-6 leading-relaxed">
                  Bạn băn khoăn về lộ trình phù hợp hoặc cần giải đáp bất kỳ tính năng nào? Điền biểu mẫu dưới đây, chúng tôi sẽ kết nối hỗ trợ bạn ngay lập tức.
                </p>

                {submitSuccess ? (
                  <div className="p-8 rounded-2xl bg-[#FFF9F5] border-2 border-[#8FB9A7] text-center space-y-4 animate-in fade-in zoom-in-95">
                    <div className="w-14 h-14 rounded-full bg-[#8FB9A7]/20 text-[#2F6E62] flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h4 className="text-lg font-black font-fraunces text-[#18181B]">
                      Yêu Cầu Của Bạn Đã Được Tiếp Nhận!
                    </h4>
                    <p className="text-xs sm:text-sm text-[#5F6368] max-w-md mx-auto leading-relaxed">
                      Cảm ơn <strong>{contactForm.name}</strong>! Cố vấn học thuật HanFlix sẽ liên hệ qua <strong>{contactForm.contact}</strong> trong vòng 30 phút để giải đáp chu đáo nhất cho bạn.
                    </p>
                    <button
                      onClick={() => {
                        setSubmitSuccess(false);
                        setContactForm({
                          name: '',
                          contact: '',
                          topic: 'Tư vấn lộ trình HSK',
                          message: '',
                        });
                      }}
                      className="px-6 py-2.5 rounded-full bg-[#B91B1C] text-white text-xs font-bold hover:bg-[#A3181A] transition-all cursor-pointer"
                    >
                      Gửi thêm câu hỏi khác
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitContactForm} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Name Field */}
                      <div>
                        <label className="block text-xs font-bold text-[#18181B] mb-1.5">
                          Họ và tên của bạn <span className="text-[#B91B1C]">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                          placeholder="Ví dụ: Nguyễn Văn An"
                          className="w-full h-11 px-3.5 rounded-xl bg-[#FFF9F5] border border-[#F2E4D8] focus:border-[#B91B1C] focus:bg-white text-xs sm:text-sm text-[#18181B] placeholder-[#8B9097] outline-none transition-all"
                        />
                      </div>

                      {/* Contact Info (Phone/Zalo/Email) */}
                      <div>
                        <label className="block text-xs font-bold text-[#18181B] mb-1.5">
                          Số điện thoại (Zalo) hoặc Email <span className="text-[#B91B1C]">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={contactForm.contact}
                          onChange={(e) => setContactForm({ ...contactForm, contact: e.target.value })}
                          placeholder="Ví dụ: 0912 345 678 hoặc email"
                          className="w-full h-11 px-3.5 rounded-xl bg-[#FFF9F5] border border-[#F2E4D8] focus:border-[#B91B1C] focus:bg-white text-xs sm:text-sm text-[#18181B] placeholder-[#8B9097] outline-none transition-all"
                        />
                      </div>
                    </div>

                    {/* Topic Dropdown */}
                    <div>
                      <label className="block text-xs font-bold text-[#18181B] mb-1.5">
                        Chủ đề cần hỗ trợ
                      </label>
                      <select
                        value={contactForm.topic}
                        onChange={(e) => setContactForm({ ...contactForm, topic: e.target.value })}
                        className="w-full h-11 px-3.5 rounded-xl bg-[#FFF9F5] border border-[#F2E4D8] focus:border-[#B91B1C] focus:bg-white text-xs sm:text-sm text-[#18181B] outline-none transition-all cursor-pointer"
                      >
                        <option value="Tư vấn lộ trình HSK">Tư vấn lộ trình học HSK cá nhân hóa</option>
                        <option value="Phương pháp phụ đề 3 lớp">Phương pháp phụ đề 3 lớp & Flashcard SRS</option>
                        <option value="Hỗ trợ tài khoản & kỹ thuật">Hỗ trợ kỹ thuật / tài khoản học tập</option>
                        <option value="Hợp tác học thuật & đối tác">Hợp tác học thuật / đào tạo doanh nghiệp</option>
                        <option value="Khác">Câu hỏi khác</option>
                      </select>
                    </div>

                    {/* Message Field */}
                    <div>
                      <label className="block text-xs font-bold text-[#18181B] mb-1.5">
                        Nội dung câu hỏi hoặc thắc mắc của bạn <span className="text-[#B91B1C]">*</span>
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={contactForm.message}
                        onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                        placeholder="Hãy chia sẻ chi tiết vấn đề bạn đang quan tâm để chuyên viên hỗ trợ chính xác nhất..."
                        className="w-full p-3.5 rounded-xl bg-[#FFF9F5] border border-[#F2E4D8] focus:border-[#B91B1C] focus:bg-white text-xs sm:text-sm text-[#18181B] placeholder-[#8B9097] outline-none transition-all resize-none"
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-12 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] disabled:opacity-60 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 glow-crimson transition-all active:scale-[0.98] cursor-pointer"
                    >
                      {isSubmitting ? (
                        <span>Đang gửi yêu cầu...</span>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Gửi Câu Hỏi Đến Ban Cố Vấn</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>

              {/* Bottom Guarantee */}
              <div className="pt-6 border-t border-[#F2E4D8] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#8B9097]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#8FB9A7]" />
                  <span>Bảo mật 100% thông tin cá nhân học viên</span>
                </div>
                <div>
                  Dự án EXE 2 · Đại học FPT
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ── 6. BOTTOM CALL TO ACTION ─────────────────────────────────── */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 md:px-12 bg-gradient-to-r from-[#B91B1C] to-[#8C1415] text-white text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10 space-y-4 sm:space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
            <Zap className="w-3.5 h-3.5 text-[#E7A92F]" />
            <span>Khởi Đầu Hành Trình Ngay Hôm Nay</span>
          </div>

          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black font-fraunces">
            Sẵn Sàng Làm Chủ Tiếng Trung Tự Nhiên?
          </h2>

          <p className="text-xs sm:text-base text-white/85 max-w-xl mx-auto leading-relaxed">
            Học qua phim ảnh đời thực, chạm từ tra nghĩa tức thì và luyện khẩu âm cùng AI. Bắt đầu miễn phí chỉ với 2 phút khảo sát.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-2">
            <button
              onClick={handleStartSurvey}
              className="h-12 px-7 rounded-full bg-white text-[#B91B1C] hover:bg-[#FFF9F5] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
            >
              <span>Tìm lộ trình của tôi (Miễn phí)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                navigate('/');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="h-12 px-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer"
            >
              Trải nghiệm bài học mẫu
            </button>
          </div>
        </div>
      </section>

      {/* ── 7. FOOTER ────────────────────────────────────────────────── */}
      <footer className="relative bg-[#FFF9F5] border-t-2 border-[#F2E4D8] pt-12 sm:pt-16 pb-12 px-6 sm:px-10 lg:px-12 xl:px-16 overflow-hidden">
        <div className="w-full max-w-[1720px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-8 xl:gap-12 pb-10 sm:pb-12 border-b border-[#F2E4D8]">
            {/* Col 1 */}
            <div className="space-y-4">
              <img
                src="/assets/logo.png"
                alt="HanFlix Logo"
                className="h-16 sm:h-20 md:h-24 w-auto max-w-[220px] sm:max-w-[280px] object-contain cursor-pointer"
                onClick={() => {
                  navigate('/');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
              <p className="text-xs sm:text-sm text-[#5F6368] leading-relaxed max-w-sm">
                Nền tảng học tiếng Trung qua phim ảnh và ngữ cảnh thực tế hàng đầu, kết hợp phụ đề 3 lớp thông minh và thuật toán ghi nhớ Spaced Repetition.
              </p>
            </div>

            {/* Col 2 */}
            <div className="lg:pl-6 xl:pl-10">
              <h4 className="font-bold text-sm text-[#18181B] uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-1.5">
                <span className="text-[#8FB9A7]">🎋</span>
                <span>Khám Phá</span>
              </h4>
              <ul className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm text-[#5F6368]">
                <li>
                  <button onClick={() => navigate('/about')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">
                    Dự án FPT EXE 2
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/premium')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">
                    Gói cước Premium
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/students')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">
                    Cảm nhận học viên
                  </button>
                </li>
                <li>
                  <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">
                    Hỏi đáp thường gặp
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 3 */}
            <div className="lg:pl-6 xl:pl-10">
              <h4 className="font-bold text-sm text-[#18181B] uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-1.5">
                <span className="text-[#8FB9A7]">🎋</span>
                <span>Phương Pháp</span>
              </h4>
              <ul className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm text-[#5F6368]">
                <li><button onClick={() => { navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Phụ đề 3 tầng</button></li>
                <li><button onClick={() => { navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Tra từ 1-chạm</button></li>
                <li><button onClick={() => { navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Phản xạ cùng AI</button></li>
                <li><button onClick={() => { navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Flashcard SRS</button></li>
              </ul>
            </div>

            {/* Col 4 */}
            <div className="space-y-3.5">
              <ContactShowcase variant="footer" />
            </div>
          </div>

          {/* Bottom Copyright */}
          <div className="pt-6 sm:pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8B9097]">
            <div className="flex items-center gap-2 text-center sm:text-left">
              <span>© {new Date().getFullYear()} HanFlix. Tất cả bản quyền được bảo lưu.</span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">Lan tỏa niềm yêu thích tiếng Trung</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              <button onClick={handleSignIn} className="hover:text-[#B91B1C] transition-colors cursor-pointer">Đăng nhập</button>
              <button onClick={handleStartSurvey} className="hover:text-[#B91B1C] transition-colors cursor-pointer">Đăng ký</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
