import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  Quote,
  CheckCircle2,
  TrendingUp,
  Award,
  Sparkles,
  ArrowRight,
  Filter,
  Crown,
  Menu,
  X,
  BookOpen,
  Film,
  Building2,
  GraduationCap,
  MessageSquare,
} from 'lucide-react';
import ContactShowcase from './common/ContactShowcase';

interface TestimonialsPageProps {
  onSignIn?: () => void;
  onSignUp?: () => void;
  onStartSurvey?: () => void;
}

type CategoryType = 'all' | 'starter' | 'career' | 'scholarship' | 'movie_lover';

interface LearnerStory {
  id: string;
  name: string;
  role: string;
  organization: string;
  avatar: string;
  category: CategoryType;
  level: string;
  levelColor: string;
  stars: number;
  highlight: string;
  story: string;
  favoriteQuoteZh: string;
  favoriteQuotePinyin: string;
  favoriteQuoteVi: string;
  timeSpent: string;
  streakDays: number;
}

const METRICS = [
  { value: '4.9 / 5', label: 'Điểm đánh giá trung bình', sub: 'Từ 1.250+ học viên thực tế' },
  { value: '94.8%', label: 'Tỉ lệ duy trì việc học', sub: 'Học đều đặn trên 30 ngày' },
  { value: '15 Phút', label: 'Thời lượng học mỗi ngày', sub: 'Tối ưu cho người bận rộn' },
  { value: '3.600+', label: 'Học viên đỗ HSK 3 - 6', sub: 'Đạt mục tiêu nhanh hơn 2.5 lần' },
];

const CATEGORIES: { id: CategoryType; label: string; count: number }[] = [
  { id: 'all', label: 'Tất cả câu chuyện', count: 9 },
  { id: 'starter', label: 'Mới bắt đầu & Mất gốc', count: 3 },
  { id: 'career', label: 'Đi làm & Thương mại', count: 2 },
  { id: 'scholarship', label: 'Săn học bổng & Du học', count: 2 },
  { id: 'movie_lover', label: 'Đam mê phim ảnh', count: 2 },
];

const LEARNER_STORIES: LearnerStory[] = [
  {
    id: '1',
    name: 'Trần Minh Anh',
    role: 'Chuyên viên Mua hàng (Procurement)',
    organization: 'Tập đoàn Xuất Nhập Khẩu VinLogistics',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face',
    category: 'career',
    level: 'HSK 4 Tự Tin Giao Tiếp',
    levelColor: 'bg-[#B91B1C] text-white',
    stars: 5,
    highlight: 'Từ lo lắng mỗi lần đối tác Trung Quốc gọi điện đến tự tin đàm phán hợp đồng trị giá hàng tỷ đồng.',
    story:
      'Trước đây mình chỉ học giáo trình theo kiểu chép ngữ pháp và làm đề thi, đến lúc gọi WeChat đàm phán tiến độ hàng mẫu với xưởng ở Thâm Quyến thì ú ớ không phản xạ kịp. Học trên HanFlix mình học đúng các đoạn phim thương mại, chạm tra từ chuyên ngành ngay trên câu thoại và luyện nói đối đáp với AI Bảo Bảo. Giờ mình đã dẫn đoàn đối tác đi khảo sát nhà máy hoàn toàn bằng tiếng Trung!',
    favoriteQuoteZh: '我们希望能达成长期合作。',
    favoriteQuotePinyin: 'Wǒmen xīwàng néng dáchéng chángqī hézuò.',
    favoriteQuoteVi: 'Chúng tôi hy vọng có thể đạt được sự hợp tác lâu dài.',
    timeSpent: 'Đã đồng hành 6 tháng',
    streakDays: 142,
  },
  {
    id: '2',
    name: 'Nguyễn Quốc Huy',
    role: 'Du học sinh Thạc sĩ Kinh tế',
    organization: 'Đại học Nhân dân Trung Quốc (RUC, Bắc Kinh)',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
    category: 'scholarship',
    level: 'HSK 5 (268 điểm) & HSKK Cao Cấp',
    levelColor: 'bg-[#E7A92F] text-[#18181B]',
    stars: 5,
    highlight: 'Phụ đề 3 lớp Hán - Pinyin - Việt là vũ khí tối thượng giúp mình nghe sâu và đạt học bổng CSC toàn phần.',
    story:
      'Khó khăn lớn nhất khi chuẩn bị hồ sơ du học là phần phỏng vấn học bổng và nghe giảng chuyên ngành bằng tiếng Trung. Tính năng cho phép tắt bật từng lớp phụ đề trên HanFlix giúp mình rèn kỹ năng nghe đoán nghĩa theo ngữ cảnh cực kỳ sắc bén. Mình thường nghe trước không phụ đề, sau đó mới bật chữ Hán để đối chiếu. Rất đáng giá!',
    favoriteQuoteZh: '千里之行，始于足下。',
    favoriteQuotePinyin: 'Qiānlǐ zhī xíng, shǐ yú zú xià.',
    favoriteQuoteVi: 'Hành trình ngàn dặm khởi đầu từ một bước chân.',
    timeSpent: 'Đã đồng hành 8 tháng',
    streakDays: 210,
  },
  {
    id: '3',
    name: 'Lê Thu Thảo',
    role: 'Thiết kế Đồ họa & Tự do (Freelancer)',
    organization: 'Hà Nội',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
    category: 'movie_lover',
    level: 'HSK 3 Giao Tiếp Hàng Ngày',
    levelColor: 'bg-[#8FB9A7]/20 text-[#2F6E62]',
    stars: 5,
    highlight: 'Không còn phải chờ bản Vietsub, giờ mình đã có thể vừa xem phim cổ trang vừa hiểu sâu các thành ngữ ý vị.',
    story:
      'Mình mê phim tiên hiệp và cổ trang Trung Quốc từ nhỏ, nhưng trước đây đọc phụ đề tiếng Việt hay bị dịch thoát ý mất chất văn thơ. Giao diện phong cách phương Đông của HanFlix rất có hồn, các đoạn trích từ phim được phân tích từng từ tố giúp mình vừa thư giãn vừa tiếp thu từ vựng một cách tự nhiên không gượng ép.',
    favoriteQuoteZh: '山高水长，江湖再见。',
    favoriteQuotePinyin: 'Shāngāo shuǐcháng, jiānghú zàijiàn.',
    favoriteQuoteVi: 'Núi cao sông dài, giang hồ hẹn ngày tương phùng.',
    timeSpent: 'Đã đồng hành 4 tháng',
    streakDays: 88,
  },
  {
    id: '4',
    name: 'Đặng Tuấn Kiệt',
    role: 'Kỹ sư Phần mềm',
    organization: 'Công ty Công nghệ FPT Software',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face',
    category: 'starter',
    level: 'Từ Mất Gốc Lên HSK 2',
    levelColor: 'bg-[#8FB9A7]/20 text-[#2F6E62]',
    stars: 5,
    highlight: 'Thuật toán lặp lại ngắt quãng (SRS) cứu vớt trí nhớ của một kỹ sư bận rộn như mình.',
    story:
      'Học chữ Hán sợ nhất là học trước quên sau. Mình đi làm dự án IT OT triền miên nên không có nhiều thời gian ngồi bàn học. Mỗi sáng lúc uống cà phê 10 phút và giờ nghỉ trưa 10 phút, HanFlix tự nhắc mình ôn lại đúng các từ sắp quên qua Flashcard thông minh. Sau 2 tháng mình đã nhận diện được hơn 300 chữ Hán căn bản mà không hề thấy quá tải.',
    favoriteQuoteZh: '今天的工作完成得很好！',
    favoriteQuotePinyin: 'Jīntiān de gōngzuò wánchéng de hěn hǎo!',
    favoriteQuoteVi: 'Công việc hôm nay hoàn thành rất xuất sắc!',
    timeSpent: 'Đã đồng hành 3 tháng',
    streakDays: 74,
  },
  {
    id: '5',
    name: 'Hoàng Hải Yến',
    role: 'Sinh viên Ngôn ngữ & Thương mại',
    organization: 'Đại học Ngoại Thương (FTU)',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=face',
    category: 'scholarship',
    level: 'HSK 6 Đỉnh Cao Phản Xạ',
    levelColor: 'bg-[#B91B1C] text-white',
    stars: 5,
    highlight: 'Hệ thống bài tập trắc nghiệm và chấm nói AI sau mỗi video giúp mình nâng cấp điểm phần Nghe - Nói HSKK.',
    story:
      'Ở trường mình được học nhiều lý thuyết ngữ pháp, nhưng lại thiếu môi trường luyện ngữ điệu thực tế đời thường (khẩu ngữ). Các trích đoạn đời sống trên HanFlix rất đa dạng từ phim gia đình đến phim công sở, giúp mình bổ sung lượng từ lóng và cách ngắt câu tự nhiên như người bản xứ.',
    favoriteQuoteZh: '机遇总是留给有准备的人。',
    favoriteQuotePinyin: 'Jīyù zǒng shì liú gěi yǒu zhǔnbèi de rén.',
    favoriteQuoteVi: 'Cơ hội luôn luôn dành cho những người có sự chuẩn bị.',
    timeSpent: 'Đã đồng hành 9 tháng',
    streakDays: 245,
  },
  {
    id: '6',
    name: 'Vũ Đức Cường',
    role: 'Quản lý Nhà hàng & Ẩm thực Á Đông',
    organization: 'Chuỗi ẩm thực Dimsum Corner, TP.HCM',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
    category: 'career',
    level: 'HSK 3 Giao Tiếp Nhà Hàng',
    levelColor: 'bg-[#E7A92F] text-[#18181B]',
    stars: 5,
    highlight: 'Ứng dụng ngay các câu chào hỏi, order món ăn vào thực tế phục vụ khách du lịch Trung Quốc và Đài Loan.',
    story:
      'Nhà hàng của mình đón lượng khách nói tiếng Trung rất đông. Trước đây mỗi lần khách hỏi kỹ về gia vị hay yêu cầu đổi món mình đều phải nhờ nhân viên phiên dịch. Nhờ các video tình huống gọi món thực tế trên HanFlix, giờ mình có thể trực tiếp tư vấn thực đơn và giới thiệu đặc sản cho khách.',
    favoriteQuoteZh: '请问您一共几位？这边请！',
    favoriteQuotePinyin: 'Qǐngwèn nín yígòng jǐ wèi? Zhè biān qǐng!',
    favoriteQuoteVi: 'Xin hỏi quý khách đi tổng cộng mấy người? Xin mời đi hướng này!',
    timeSpent: 'Đã đồng hành 5 tháng',
    streakDays: 112,
  },
  {
    id: '7',
    name: 'Phạm Bảo Ngọc',
    role: 'Học sinh THPT chuyên Ngoại ngữ',
    organization: 'Hà Nội',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face',
    category: 'starter',
    level: 'HSK 1 - 2 Khởi Đầu',
    levelColor: 'bg-[#8FB9A7]/20 text-[#2F6E62]',
    stars: 5,
    highlight: 'Linh vật Gấu Trúc Bảo Bảo dễ thương khiến mỗi buổi học 15 phút tràn ngập niềm vui, không hề có áp lực thi cử.',
    story:
      'Em bắt đầu học tiếng Trung như một ngoại ngữ thứ hai. Ban đầu em rất sợ viết chữ Hán vì thấy nhiều nét rối rắm. Nhưng trên HanFlix, mỗi từ đều đi kèm hình ảnh và âm thanh trong trích đoạn phim vui nhộn, làm em nhớ mặt chữ rất nhanh. Bố mẹ rất ủng hộ em học.',
    favoriteQuoteZh: '你好，很高兴认识你！',
    favoriteQuotePinyin: 'Nǐ hǎo, hěn gāoxìng rènshí nǐ!',
    favoriteQuoteVi: 'Xin chào, rất vui được làm quen với bạn!',
    timeSpent: 'Đã đồng hành 2 tháng',
    streakDays: 45,
  },
  {
    id: '8',
    name: 'Bùi Gia Khiêm',
    role: 'Nhà sáng tạo nội dung du lịch',
    organization: 'Kênh Travel With Khiem',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=face',
    category: 'movie_lover',
    level: 'HSK 4 Tự Do Du Lịch',
    levelColor: 'bg-[#B91B1C] text-white',
    stars: 5,
    highlight: 'Tự tin đi du lịch tự túc khắp Vân Nam, Thành Đô và Thượng Hải mà không cần dùng Google Dịch liên tục.',
    story:
      'Du lịch tự túc ở Trung Quốc nếu không biết tiếng thì khá vất vả khi đi tàu cao tốc hay gọi xe ngoài đường. Nhờ học kỹ các tình huống đời sống trên HanFlix, chuyến đi 14 ngày qua Tứ Xuyên vừa rồi mình nói chuyện được với các bác tài xế và chủ quán trà địa phương cực kỳ vui.',
    favoriteQuoteZh: '这里风景真美，我想拍张照片。',
    favoriteQuotePinyin: 'Zhèlǐ fēngjǐng zhēn měi, wǒ xiǎng pāi zhāng zhàopiàn.',
    favoriteQuoteVi: 'Phong cảnh ở đây thật đẹp, tôi muốn chụp một tấm ảnh kỷ niệm.',
    timeSpent: 'Đã đồng hành 7 tháng',
    streakDays: 168,
  },
  {
    id: '9',
    name: 'Nguyễn Thị Cẩm Tú',
    role: 'Kế toán viên',
    organization: 'Doanh nghiệp FDI Đài Loan, Bình Dương',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=face',
    category: 'starter',
    level: 'Từ Mất Gốc Lên HSK 3',
    levelColor: 'bg-[#8FB9A7]/20 text-[#2F6E62]',
    stars: 5,
    highlight: 'Học ngay trên điện thoại vào giờ nghỉ trưa, tăng 30% lương nhờ biết tiếng Trung cơ bản.',
    story:
      'Làm việc tại công ty Đài Loan mà không biết tiếng Trung là một thiệt thòi lớn. Nhờ HanFlix thiết kế bài học trích đoạn ngắn 1-3 phút, mình tranh thủ học mỗi ngày một chút. Sau 4 tháng, sếp rất ngạc nhiên khi thấy mình có thể trao đổi hóa đơn và chứng từ bằng tiếng Trung.',
    favoriteQuoteZh: '请帮我核对一下这份账单。',
    favoriteQuotePinyin: 'Qǐng bāng wǒ héduì yíxià zhè fèn zhàngdān.',
    favoriteQuoteVi: 'Xin làm ơn đối chiếu giúp tôi hóa đơn này.',
    timeSpent: 'Đã đồng hành 4 tháng',
    streakDays: 95,
  },
];

export default function TestimonialsPage({
  onSignIn,
  onSignUp,
  onStartSurvey,
}: TestimonialsPageProps) {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignIn = () => {
    if (onSignIn) onSignIn();
    else navigate('/auth/login');
  };

  const handleStartSurvey = () => {
    if (onStartSurvey) onStartSurvey();
    else navigate('/auth/signup');
  };

  const filteredStories = LEARNER_STORIES.filter((s) => {
    if (selectedCategory === 'all') return true;
    return s.category === selectedCategory;
  });

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
            className="text-[#B91B1C] transition-colors flex items-center gap-1.5 cursor-pointer font-bold"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#B91B1C]" />
            Học viên
          </button>
          <button
            onClick={() => navigate('/faq')}
            className="hover:text-[#B91B1C] transition-colors cursor-pointer"
          >
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
            className="w-full text-left flex items-center gap-2 text-sm font-bold text-[#B91B1C] bg-white p-2 rounded-xl border border-[#B91B1C]/20 transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-[#B91B1C]" />
            Cảm nhận học viên
          </button>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/faq');
            }}
            className="w-full text-left block text-sm font-bold text-[#18181B] hover:text-[#B91B1C] p-2 rounded-xl hover:bg-white transition-colors cursor-pointer"
          >
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

      {/* ── 2. HERO SECTION ─────────────────────────────────────────── */}
      <section className="relative py-12 sm:py-16 md:py-20 px-4 sm:px-6 md:px-12 bg-gradient-to-b from-[#FFF9F5] via-[#FFF3EB] to-[#FFF9F5] border-b border-[#F2E4D8]/80">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#B91B1C]/10 border border-[#B91B1C]/20 text-[#B91B1C] text-xs font-bold tracking-wide uppercase mb-4 sm:mb-6 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>HÀNH TRÌNH CHINH PHỤC · 10.000+ HỌC VIÊN TIN CHỌN</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#B91B1C] leading-[1.15] mb-5 sm:mb-6 font-fraunces tracking-tight">
            Những Câu Chuyện Thật, <br />
            <span className="text-[#18181B]">Bứt Phá Tiếng Trung Cùng HanFlix</span>
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-[#5F6368] max-w-3xl mx-auto mb-8 sm:mb-12 leading-relaxed">
            Từ nỗi sợ phát âm ngập ngừng, học vẹt từ vựng đến tự tin trao đổi với đối tác Thượng Hải, đạt chứng chỉ HSK 4 - 6 và giành học bổng du học toàn phần chỉ sau 3 đến 6 tháng học qua trích đoạn phim điện ảnh.
          </p>

          {/* Social Proof Metrics Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-5xl mx-auto">
            {METRICS.map((m, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-[#F2E4D8] shadow-xs text-center hover:border-[#B91B1C]/30 transition-colors"
              >
                <div className="text-2xl sm:text-3xl md:text-4xl font-black text-[#B91B1C] font-fraunces mb-1">
                  {m.value}
                </div>
                <div className="text-xs sm:text-sm font-bold text-[#18181B] mb-0.5">{m.label}</div>
                <div className="text-[11px] sm:text-xs text-[#8B9097]">{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. FEATURED SPOTLIGHT STORY ──────────────────────────────── */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 md:px-12 bg-white border-b border-[#F2E4D8]/80">
        <div className="max-w-6xl mx-auto">
          <div className="bg-[#FFF9F5] rounded-3xl border-2 border-[#F2E4D8] overflow-hidden shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch p-6 sm:p-8 lg:p-10">
            {/* Visual Column */}
            <div className="lg:col-span-5 relative flex flex-col">
              <div className="relative w-full h-full min-h-[380px] sm:min-h-[460px] rounded-2xl overflow-hidden border border-[#E7A92F]/40 shadow-md">
                <img
                  src="/assets/student_stories.jpg?v=2"
                  alt="Không gian học viên HanFlix tự tin giao tiếp"
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-4 left-4 right-4 text-white text-xs sm:text-sm font-semibold flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm text-xs">
                    <Film className="w-3.5 h-3.5 text-[#E7A92F]" />
                    Học qua phim ảnh
                  </span>
                  <span className="bg-[#B91B1C] px-3 py-1.5 rounded-full font-bold text-xs uppercase shadow-xs">
                    HSK 5 Xuất Sắc
                  </span>
                </div>
              </div>
            </div>

            {/* Content Column */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-4 sm:space-y-5">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E7A92F]/15 border border-[#E7A92F]/30 text-[#B7791F] text-xs font-bold mb-3">
                  ⭐ CÂU CHUYỆN TIÊU BIỂU THÁNG NÀY
                </div>

                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-[#18181B] font-fraunces leading-snug mb-3">
                  "HanFlix đã biến 15 phút rảnh rỗi mỗi ngày thành tấm vé thăng chức và học bổng mơ ước của tôi."
                </h2>

                <p className="text-xs sm:text-sm md:text-base text-[#5F6368] leading-relaxed mb-4">
                  Phương pháp học nhập vai qua trích đoạn phim ngắn 1-3 phút của HanFlix giúp loại bỏ hoàn toàn cảm giác ngượng nghịu khi phát âm. Với phụ đề thông minh 3 lớp Hán - Pinyin - Tiếng Việt cùng thuật toán SRS, người học nhớ từ vựng sâu hơn gấp 3 lần so với cách chép sổ tay truyền thống.
                </p>

                {/* Quote Highlight Box */}
                <div className="p-4 rounded-2xl bg-white border border-[#F2E4D8] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#8FB9A7] uppercase tracking-wider">
                      Châm ngôn tâm đắc:
                    </span>
                    <span className="text-xs font-semibold text-[#8B9097]">Trích đoạn phim HSK 4</span>
                  </div>
                  <div className="text-base sm:text-lg font-bold text-[#B91B1C] font-calligraphy">
                    学无止境，勇往直前。
                  </div>
                  <div className="text-xs text-[#5F6368] italic">
                    Xué wú zhǐjìng, yǒngwǎng zhíqián. (Học vấn vô hạn, dũng cảm tiến bước về phía trước.)
                  </div>
                </div>
              </div>

              {/* Author Strip */}
              <div className="pt-2 flex items-center justify-between border-t border-[#F2E4D8]/60">
                <div>
                  <div className="font-bold text-sm text-[#18181B]">Lê Quỳnh Anh & Học viên cộng đồng</div>
                  <div className="text-xs text-[#8B9097]">Sinh viên Đại học Ngoại Thương & FPT University</div>
                </div>
                <button
                  onClick={handleStartSurvey}
                  className="px-4 py-2.5 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer"
                >
                  <span>Bắt đầu ngay</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. FILTER PILLS & ALL STORIES GRID ──────────────────────── */}
      <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 md:px-12 bg-[#FFF9F5] flex-1">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 sm:mb-10">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold text-[#8FB9A7] uppercase tracking-wider mb-2">
                <Filter className="w-3.5 h-3.5" />
                <span>CHIA SẺ CHÂN THẬT TỪ HỌC VIÊN</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#18181B] font-fraunces">
                Khám Phá Theo Mục Tiêu Học Tập
              </h2>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-[#B91B1C] text-white shadow-xs'
                        : 'bg-white border border-[#F2E4D8] text-[#5F6368] hover:border-[#B91B1C]/40 hover:text-[#B91B1C]'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-[#FFF3DE] text-[#B7791F]'
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
            {filteredStories.map((story) => (
              <div
                key={story.id}
                className="bg-white rounded-3xl p-6 border border-[#F2E4D8] shadow-2xs hover:shadow-md hover:border-[#B91B1C]/30 transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Row: User Avatar & Level */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={story.avatar}
                        alt={story.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-[#E7A92F]/50 shadow-2xs group-hover:scale-105 transition-transform"
                      />
                      <div>
                        <h3 className="font-bold text-sm sm:text-base text-[#18181B] leading-tight">
                          {story.name}
                        </h3>
                        <p className="text-xs text-[#8B9097] leading-tight mt-0.5">{story.role}</p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-tight shrink-0 ${story.levelColor}`}
                    >
                      {story.level}
                    </span>
                  </div>

                  {/* Rating Stars & Organization */}
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <div className="flex items-center gap-0.5 text-[#E7A92F]">
                      {Array.from({ length: story.stars }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-[#E7A92F]" />
                      ))}
                    </div>
                    <span className="text-[11px] text-[#8B9097] truncate max-w-[180px]">
                      {story.organization}
                    </span>
                  </div>

                  {/* Highlight statement */}
                  <div className="text-xs sm:text-sm font-bold text-[#18181B] leading-snug mb-3">
                    "{story.highlight}"
                  </div>

                  {/* Body story */}
                  <p className="text-xs text-[#5F6368] leading-relaxed mb-4">
                    {story.story}
                  </p>

                  {/* Favorite Chinese Phrase Card */}
                  <div className="p-3 rounded-2xl bg-[#FFF9F5] border border-[#F2E4D8] mb-4 space-y-1">
                    <div className="text-[10px] font-bold text-[#8FB9A7] uppercase tracking-wider flex items-center gap-1">
                      <Quote className="w-3 h-3 text-[#B91B1C]" />
                      <span>Câu thoại yêu thích:</span>
                    </div>
                    <div className="text-sm font-bold text-[#B91B1C] font-calligraphy">
                      {story.favoriteQuoteZh}
                    </div>
                    <div className="text-[11px] text-[#5F6368] italic">
                      {story.favoriteQuotePinyin}
                    </div>
                    <div className="text-[11px] text-[#18181B]/80 font-medium">
                      = {story.favoriteQuoteVi}
                    </div>
                  </div>
                </div>

                {/* Bottom Card Footer */}
                <div className="pt-3 border-t border-[#F2E4D8] flex items-center justify-between text-[11px] text-[#8B9097]">
                  <span className="flex items-center gap-1 font-semibold text-[#2F6E62]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#8FB9A7]" />
                    {story.timeSpent}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#FFF3DE] text-[#B7791F] font-bold">
                    🔥 {story.streakDays} ngày liên tiếp
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA Banner */}
          <div className="mt-14 sm:mt-16 bg-gradient-to-r from-[#B91B1C] to-[#8C1415] rounded-3xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="max-w-xl space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                LỘ TRÌNH DÀNH RIÊNG CHO BẠN
              </div>
              <h3 className="text-2xl sm:text-3xl font-black font-fraunces leading-tight">
                Sẵn Sàng Viết Nên Câu Chuyện Thành Công Của Chính Bạn?
              </h3>
              <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                Chỉ 2 phút làm khảo sát định hướng, Gấu Trúc Bảo Bảo sẽ thiết kế danh sách trích đoạn phim phù hợp nhất với trình độ hiện tại của bạn.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full sm:w-auto">
              <button
                onClick={handleStartSurvey}
                className="w-full sm:w-auto h-12 px-6 rounded-full bg-white text-[#B91B1C] hover:bg-[#FFF9F5] text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer"
              >
                <span>Tìm Lộ Trình Của Tôi</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/#lessons')}
                className="w-full sm:w-auto h-12 px-5 rounded-full border border-white/40 hover:bg-white/10 text-white text-sm font-bold flex items-center justify-center transition-colors cursor-pointer"
              >
                Xem Thử Bài Mẫu
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. FOOTER ────────────────────────────────────────────────── */}
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
