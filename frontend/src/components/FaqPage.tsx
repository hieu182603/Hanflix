import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BookOpen,
  CreditCard,
  GraduationCap,
  ShieldCheck,
  Crown,
  ArrowRight,
  Menu,
  X,
  MessageCircle,
  PhoneCall,
  Mail,
  CheckCircle2,
} from 'lucide-react';
import ContactShowcase from './common/ContactShowcase';

interface FaqPageProps {
  onSignIn?: () => void;
  onSignUp?: () => void;
  onStartSurvey?: () => void;
}

type FaqCategory = 'all' | 'method' | 'billing' | 'learning' | 'account';

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
  { id: 'billing', label: 'Gói VIP & Thanh toán PayOS', icon: CreditCard },
  { id: 'learning', label: 'Lộ trình HSK & Trợ lý AI', icon: GraduationCap },
  { id: 'account', label: 'Tài khoản & Kỹ thuật', icon: ShieldCheck },
];

const FAQS_DATA: FaqItem[] = [
  // Nhóm Phương pháp & Phim ảnh
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
    question: 'Phương pháp học qua trích đoạn phim 1-3 phút của HanFlix khác gì so với xem video trên YouTube?',
    answer:
      'Trên YouTube, video chỉ mang tính chất giải trí thụ động: bạn phải dừng video, mở từ điển ngoài để tra cứu rồi dễ bị phân tâm bởi các đề xuất video khác. Tại HanFlix, mỗi video là một bài học tương tác hoàn chỉnh: chạm chữ tra nghĩa tức thì không cần dừng phát, lưu từ vào Flashcard SRS tự động, luyện nói đối đáp cùng AI và làm bài tập phản xạ củng cố ngay sau video.',
    keyPoints: [
      'Tra từ điển 1-chạm không thoát giao diện',
      'Đồng bộ từ vựng yêu thích vào thuật toán lặp lại ngắt quãng (SRS)',
      'Bài tập trắc nghiệm nghe hiểu và ngữ pháp bám sát khung HSK',
    ],
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
    question: 'Tôi có thể tải video về máy để học khi không có kết nối mạng Internet (Offline) được không?',
    answer:
      'Hiện tại tính năng Flashcard từ vựng và bài tập ngữ pháp được lưu trên trình duyệt của bạn để bạn có thể xem lại khi mạng gián đoạn. Để xem video chất lượng cao và tương tác với trợ lý AI Bảo Bảo theo thời gian thực, bạn cần kết nối Internet (WiFi hoặc 4G/5G).',
  },

  // Nhóm Gói VIP & Thanh toán PayOS
  {
    id: 'b1',
    category: 'billing',
    question: 'HanFlix có những gói cước nào và chi phí ra sao?',
    answer:
      'HanFlix cung cấp các gói dịch vụ linh hoạt phù hợp với nhu cầu và thời gian biểu của từng học viên:\n- Gói 1 Tháng: 99.000đ/tháng (Phù hợp trải nghiệm ngắn hạn)\n- Gói 3 Tháng: 249.000đ/3 tháng (~83.000đ/tháng - Tiết kiệm 16%)\n- Gói 12 Tháng: 699.000đ/năm (~58.000đ/tháng - Tiết kiệm 41%)\nCả 3 gói mở khóa cùng các quyền lợi Premium và chỉ khác nhau về giá, thời hạn. Video được mở theo đúng HSK hiện tại trong hồ sơ: tài khoản HSK 3 chỉ xem video HSK 3, kể cả khi đã nâng cấp. Premium bao gồm lưu từ vựng, quiz/bài luyện tập, AI đề xuất nội dung, theo dõi tiến độ, Flashcard và kho ngữ pháp.',
    badge: 'Bảng giá',
  },
  {
    id: 'b2',
    category: 'billing',
    question: 'Quy trình thanh toán qua cổng PayOS và VietQR diễn ra như thế nào?',
    answer:
      'Thanh toán tại HanFlix hoàn toàn tự động và an toàn thông qua cổng thanh toán quốc gia PayOS (chuẩn VietQR):\n1. Chọn gói cước bạn mong muốn trên trang Nâng cấp.\n2. Hệ thống hiển thị mã VietQR kèm số tiền và nội dung chuyển khoản tự động.\n3. Dùng ứng dụng ngân hàng hoặc ví điện tử bất kỳ quét mã QR và xác nhận.\n4. Sau khi chuyển tiền thành công, hệ thống PayOS kích hoạt gói VIP của bạn chỉ trong 3-5 giây mà không cần nhân viên duyệt thủ công.',
    keyPoints: [
      'Hỗ trợ 100% tất cả các ngân hàng tại Việt Nam',
      'Kích hoạt tài khoản tức thì (Real-time)',
      'Không lưu trữ thông tin thẻ hay tài khoản ngân hàng của học viên',
    ],
  },
  {
    id: 'b3',
    category: 'billing',
    question: 'Gói cước có tự động gia hạn và trừ tiền trong tài khoản ngân hàng của tôi khi hết hạn không?',
    answer:
      'TUYỆT ĐỐI KHÔNG! HanFlix sử dụng phương thức thanh toán từng lần qua mã QR ngân hàng. Chúng tôi cam kết KHÔNG lưu thẻ tín dụng, KHÔNG tự động trừ tiền trong tài khoản của bạn. Khi tài khoản sắp hết hạn, hệ thống sẽ gửi thông báo nhắc nhở và bạn toàn quyền quyết định có tiếp tục gia hạn hay không.',
    keyPoints: [
      'Minh bạch 100% tài chính',
      'Chỉ thanh toán khi bạn chủ động quét mã',
    ],
  },
  {
    id: 'b4',
    category: 'billing',
    question: 'Nếu tài khoản của tôi đang còn hạn VIP mà tôi mua thêm gói mới thì có bị mất ngày cũ không?',
    answer:
      'Không hề! Hệ thống thanh toán thông minh của HanFlix tự động cộng dồn thời hạn mới tiếp nối ngay sau ngày hết hạn hiện tại của bạn. Ví dụ: gói cũ của bạn còn 15 ngày, bạn mua thêm gói 3 Tháng (90 ngày) thì tổng thời hạn sử dụng sẽ là 105 ngày.',
  },

  // Nhóm Lộ trình HSK & Trợ lý AI
  {
    id: 'l1',
    category: 'learning',
    question: 'Khảo sát tìm lộ trình học cá nhân hóa hoạt động như thế nào và mất bao lâu?',
    answer:
      'Khảo sát chỉ mất khoảng 2 phút với 6 câu hỏi ngắn được thiết kế bởi chuyên gia ngôn ngữ: Đánh giá trình độ hiện tại, Mục tiêu học (giao tiếp du lịch, công việc, thi HSK), Thời gian bạn có thể dành mỗi ngày và Thể loại phim yêu thích. Ngay sau khi hoàn thành, hệ thống sẽ tự động tổng hợp danh mục trích đoạn phim và bài học tối ưu nhất cho riêng bạn.',
    keyPoints: [
      'Miễn phí 100% cho mọi học viên',
      'Đề xuất video theo đúng sở thích và trình độ',
    ],
  },
  {
    id: 'l2',
    category: 'learning',
    question: 'Trợ lý AI Bảo Bảo có thể giúp tôi những gì trong quá trình học?',
    answer:
      'Gấu Trúc Bảo Bảo là trợ lý học tập AI thông minh tích hợp trên HanFlix:\n- Phân tích và chấm điểm độ chính xác phát âm từng thanh điệu\n- Đóng vai nhân vật trong phim để trò chuyện đối đáp trực tiếp với bạn\n- Giải thích chi tiết ngữ pháp, cấu trúc câu và sự khác biệt giữa các từ đồng nghĩa\n- Nhắc nhở duy trì chuỗi học tập (Streak) và động viên mỗi ngày.',
  },
  {
    id: 'l3',
    category: 'learning',
    question: 'Học trên HanFlix có thể thay thế hoàn toàn việc học trung tâm để thi chứng chỉ HSK không?',
    answer:
      'HanFlix tập trung tối đa vào 2 kỹ năng cốt lõi là Nghe hiểu phản xạ và Khẩu ngữ đời sống - vốn là điểm yếu lớn nhất của người học khi học vẹt sách vở. Để đạt điểm tối đa trong kỳ thi HSK, bạn nên kết hợp luyện phản xạ phim trên HanFlix với việc làm thêm các đề thi mẫu (mock test). Rất nhiều học viên HanFlix đã đạt HSK 4 và HSK 5 chỉ sau 4-6 tháng tự học.',
  },

  // Nhóm Tài khoản & Kỹ thuật
  {
    id: 'a1',
    category: 'account',
    question: 'Tôi có thể đăng nhập một tài khoản trên cả điện thoại và máy tính cùng lúc không?',
    answer:
      'Có! Tài khoản HanFlix của bạn được đồng bộ dữ liệu trên nền tảng đám mây thời gian thực. Bạn có thể học trên máy tính tại cơ quan và tiếp tục ôn từ vựng trên điện thoại khi đi tàu xe hoặc ở nhà mà không lo mất tiến độ học tập hay chuỗi ngày Streak.',
  },
  {
    id: 'a2',
    category: 'account',
    question: 'Nếu tôi quên mật khẩu đăng nhập thì phải làm sao?',
    answer:
      'Rất đơn giản, tại trang Đăng nhập bạn chỉ cần nhấn vào "Quên mật khẩu?", nhập địa chỉ email đã đăng ký tài khoản. Hệ thống HanFlix sẽ gửi ngay một đường dẫn đặt lại mật khẩu an toàn vào hộp thư của bạn trong vòng vài giây.',
  },
  {
    id: 'a3',
    category: 'account',
    question: 'HanFlix có hỗ trợ xuất hóa đơn hoặc giấy chứng nhận hoàn thành khóa học không?',
    answer:
      'Có! Đối với các doanh nghiệp hoặc cá nhân cần xác nhận chi phí đào tạo, ban điều phối dự án HanFlix (Đại học FPT EXE 2) sẽ hỗ trợ cung cấp giấy xác nhận hoàn thành khóa học và biên lai điện tử tương ứng khi bạn liên hệ qua email hỗ trợ support@hanflix.vn.',
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
  const [openFaqIds, setOpenFaqIds] = useState<Record<string, boolean>>({
    m1: true,
    b1: true,
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  return (
    <div className="min-h-[100dvh] bg-[#FFF9F5] text-[#18181B] selection:bg-[#B91B1C] selection:text-white font-sans overflow-x-hidden flex flex-col">
      {/* ── 1. HEADER ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 h-16 sm:h-20 md:h-[88px] flex items-center justify-between px-4 sm:px-6 md:px-12 bg-[#FFF9F5]/95 backdrop-blur-md border-b border-[#F2E4D8]/80 transition-all safe-area-top">
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
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
            onClick={() => navigate('/#method')}
            className="hover:text-[#B91B1C] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#8FB9A7]" />
            Phương pháp
          </button>
          <button
            onClick={() => navigate('/about')}
            className="hover:text-[#B91B1C] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#E7A92F]" />
            Giới thiệu
          </button>
          <button
            onClick={() => navigate('/testimonials')}
            className="hover:text-[#B91B1C] transition-colors cursor-pointer"
          >
            Học viên
          </button>
          <button
            onClick={() => navigate('/faq')}
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
              navigate('/#method');
            }}
            className="w-full text-left flex items-center gap-2 text-sm font-bold text-[#18181B] hover:text-[#B91B1C] p-2 rounded-xl hover:bg-white transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-[#8FB9A7]" />
            Phương pháp
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
              navigate('/testimonials');
            }}
            className="w-full text-left block text-sm font-bold text-[#18181B] hover:text-[#B91B1C] p-2 rounded-xl hover:bg-white transition-colors cursor-pointer"
          >
            Cảm nhận học viên
          </button>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/faq');
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

      {/* ── 2. HERO SECTION WITH SEARCH ───────────────────────────────── */}
      <section className="relative py-12 sm:py-16 md:py-20 px-4 sm:px-6 md:px-12 bg-gradient-to-b from-[#FFF9F5] via-[#FFF5EC] to-[#FFF9F5] border-b border-[#F2E4D8]/80">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#8FB9A7]/15 border border-[#8FB9A7]/30 text-[#2F6E62] text-xs font-bold tracking-wide uppercase mb-4 sm:mb-6 shadow-xs">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>TRUNG TÂM HỎI ĐÁP & HỖ TRỢ NGƯỜI HỌC</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#B91B1C] leading-[1.15] mb-5 sm:mb-6 font-fraunces tracking-tight">
            Giải Đáp Mọi Thắc Mắc <br />
            <span className="text-[#18181B]">Về Hành Trình Học Tại HanFlix</span>
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-[#5F6368] max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed">
            Mọi thông tin chi tiết về phương pháp học phụ đề 3 lớp, cổng thanh toán PayOS VietQR an toàn, lộ trình HSK và tài khoản học tập.
          </p>

          {/* Interactive Search Bar */}
          <div className="relative max-w-2xl mx-auto">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 text-[#8B9097] absolute left-4 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm câu hỏi (ví dụ: 'phụ đề 3 lớp', 'hoàn tiền', 'mất gốc', 'PayOS')..."
                className="w-full h-13 sm:h-14 pl-12 pr-12 rounded-2xl bg-white border-2 border-[#F2E4D8] focus:border-[#B91B1C] focus:ring-4 focus:ring-[#B91B1C]/10 text-sm sm:text-base text-[#18181B] placeholder-[#8B9097] shadow-sm transition-all outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 p-1 text-[#8B9097] hover:text-[#18181B] cursor-pointer"
                  aria-label="Xóa tìm kiếm"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="text-xs text-[#5F6368] mt-2 text-left pl-2">
                Tìm thấy <span className="font-bold text-[#B91B1C]">{filteredFaqs.length}</span> câu hỏi liên quan đến từ khóa "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 3. CATEGORY TABS & ACCORDION SECTION ─────────────────────── */}
      <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 md:px-12 bg-white flex-1 border-b border-[#F2E4D8]/80">
        <div className="max-w-5xl mx-auto">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-10 sm:mb-12">
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
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    isActive
                      ? 'bg-[#B91B1C] text-white shadow-sm scale-105'
                      : 'bg-[#FFF9F5] border border-[#F2E4D8] text-[#5F6368] hover:border-[#B91B1C]/40 hover:text-[#B91B1C]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
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

          {/* FAQ Accordion List */}
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-16 bg-[#FFF9F5] rounded-3xl border border-[#F2E4D8] p-8">
              <HelpCircle className="w-12 h-12 text-[#B91B1C]/40 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-[#18181B] mb-1">
                Không tìm thấy câu hỏi phù hợp
              </h3>
              <p className="text-xs sm:text-sm text-[#5F6368] mb-4">
                Hãy thử thay đổi từ khóa tìm kiếm hoặc chọn danh mục khác nhé!
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
            <div className="space-y-4">
              {filteredFaqs.map((faq) => {
                const isOpen = Boolean(openFaqIds[faq.id]);
                return (
                  <div
                    key={faq.id}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isOpen
                        ? 'border-[#B91B1C]/40 bg-[#FFF9F5] shadow-xs'
                        : 'border-[#F2E4D8] bg-white hover:border-[#E7A92F]'
                    }`}
                  >
                    <button
                      onClick={() => toggleFaq(faq.id)}
                      className="w-full text-left p-5 sm:p-6 flex items-start justify-between gap-4 cursor-pointer"
                      aria-expanded={isOpen}
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-[#B91B1C]/10 text-[#B91B1C] text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                          ?
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-bold text-sm sm:text-base text-[#18181B] leading-snug">
                              {faq.question}
                            </span>
                            {faq.badge && (
                              <span className="px-2 py-0.5 rounded-full bg-[#E7A92F]/20 text-[#B7791F] text-[10px] font-bold">
                                {faq.badge}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`p-1.5 rounded-full transition-transform shrink-0 ${
                          isOpen ? 'bg-[#B91B1C] text-white rotate-180' : 'bg-[#FFF3DE] text-[#B7791F]'
                        }`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-5 sm:px-6 pb-6 pt-0 text-xs sm:text-sm text-[#5F6368] leading-relaxed border-t border-[#F2E4D8]/60 mt-1">
                        <div className="pt-4 whitespace-pre-line text-[#3C4043] leading-relaxed">
                          {faq.answer}
                        </div>

                        {faq.keyPoints && faq.keyPoints.length > 0 && (
                          <div className="mt-3.5 p-3.5 rounded-xl bg-white border border-[#F2E4D8] space-y-1.5">
                            <div className="text-xs font-bold text-[#8FB9A7] uppercase tracking-wider">
                              Điểm then chốt:
                            </div>
                            {faq.keyPoints.map((kp, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs text-[#18181B]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#2F6E62] shrink-0" />
                                <span>{kp}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Direct Support Showcase Box ── */}
          <div className="mt-14 sm:mt-16 bg-[#FFF9F5] rounded-3xl border-2 border-[#F2E4D8] p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-xs">
            <div className="lg:col-span-4 rounded-2xl overflow-hidden border border-[#E7A92F]/30 shadow-sm">
              <img
                src="/assets/faq_support.jpg"
                alt="Không gian hỗ trợ học tập HanFlix"
                className="w-full h-auto object-cover max-h-[260px]"
              />
            </div>

            <div className="lg:col-span-8 space-y-3.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8FB9A7]/15 text-[#2F6E62] text-xs font-bold">
                <MessageCircle className="w-3.5 h-3.5" />
                HỖ TRỢ TRỰC TIẾP TỪ BAN CỐ VẤN
              </div>

              <h3 className="text-xl sm:text-2xl font-black font-fraunces text-[#18181B]">
                Vẫn Còn Thắc Mắc Chưa Được Giải Đáp?
              </h3>

              <p className="text-xs sm:text-sm text-[#5F6368] leading-relaxed">
                Đội ngũ chuyên môn học thuật và phát triển dự án HanFlix (Đại học FPT EXE 2) luôn sẵn sàng đồng hành, tư vấn lộ trình và hỗ trợ bạn trong suốt quá trình học tập.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href="mailto:support@hanflix.vn"
                  className="px-4 py-2.5 rounded-full bg-white border border-[#F2E4D8] hover:border-[#B91B1C] text-xs font-bold text-[#18181B] hover:text-[#B91B1C] flex items-center gap-2 transition-all shadow-2xs"
                >
                  <Mail className="w-3.5 h-3.5 text-[#B91B1C]" />
                  <span>support@hanflix.vn</span>
                </a>
                <a
                  href="tel:0981234567"
                  className="px-4 py-2.5 rounded-full bg-white border border-[#F2E4D8] hover:border-[#B91B1C] text-xs font-bold text-[#18181B] hover:text-[#B91B1C] flex items-center gap-2 transition-all shadow-2xs"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-[#2F6E62]" />
                  <span>Hotline: 0981 234 567</span>
                </a>
                <button
                  onClick={handleStartSurvey}
                  className="px-5 py-2.5 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer ml-auto"
                >
                  <span>Khảo sát lộ trình miễn phí</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. FOOTER ────────────────────────────────────────────────── */}
      <footer className="relative bg-[#FFF9F5] border-t-2 border-[#F2E4D8] pt-12 sm:pt-16 pb-12 px-6 sm:px-10 lg:px-12 xl:px-16 overflow-hidden">
        <div className="w-full max-w-[1720px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-8 xl:gap-12 pb-10 sm:pb-12 border-b border-[#F2E4D8]">
            {/* Col 1 */}
            <div className="space-y-4">
              <img
                src="/assets/logo.png"
                alt="HanFlix Logo"
                className="h-16 sm:h-20 md:h-24 w-auto max-w-[220px] sm:max-w-[280px] object-contain cursor-pointer"
                onClick={() => navigate('/')}
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
                  <button onClick={() => navigate('/testimonials')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">
                    Cảm nhận học viên
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/faq')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">
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
                <li><button onClick={() => navigate('/#method')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Phụ đề 3 tầng</button></li>
                <li><button onClick={() => navigate('/#method')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Tra từ 1-chạm</button></li>
                <li><button onClick={() => navigate('/#method')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Phản xạ cùng AI</button></li>
                <li><button onClick={() => navigate('/#method')} className="hover:text-[#B91B1C] transition-colors cursor-pointer text-left">Flashcard SRS</button></li>
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
