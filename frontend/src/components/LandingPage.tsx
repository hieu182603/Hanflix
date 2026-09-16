import React, { useState } from 'react';
import { Play, ChevronDown, ChevronUp, ArrowRight, Check, Star } from 'lucide-react';
import { SAMPLE_LESSONS } from '../data/hanflixData';

interface LandingPageProps {
  onStartSurvey: () => void;
  onViewSample: (lessonId?: string) => void;
  onSignIn: () => void;
  onSignUp: () => void;
}

const CUES = [
  { zh: '服务员，请拿一下菜单。', pinyin: 'Fúwùyuán, qǐng ná yíxià càidān.', vi: 'Phục vụ ơi, cho tôi xin thực đơn.' },
  { zh: '我想点一个宫保鸡丁。', pinyin: 'Wǒ xiǎng diǎn yīgè gōngbǎo jīdīng.', vi: 'Tôi muốn gọi một phần gà cung bảo.' },
];

const STEPS = [
  { n: '01', title: 'Xem video ngắn', body: 'Tình huống thực tế 1-5 phút: nhà hàng, sân bay, văn phòng, đời sống.' },
  { n: '02', title: 'Tra từ tức thì', body: 'Chạm vào bất kỳ từ nào để xem nghĩa, Pinyin và ví dụ ngay lập tức.' },
  { n: '03', title: 'Làm bài tập', body: 'Trắc nghiệm ngắn dựa đúng trên nội dung vừa xem, không học vẹt.' },
  { n: '04', title: 'Ôn tập thông minh', body: 'Thuật toán SRS nhắc đúng lúc trước khi bạn quên từ vừa học.' },
];

const FAQS = [
  { q: 'Tôi chưa biết gì về tiếng Trung có học được không?', a: 'Được. Các bài bắt đầu từ HSK 1 với phụ đề ba lớp. Chọn "Chưa học bao giờ" trong khảo sát để nhận gợi ý bài phù hợp.' },
  { q: 'Khảo sát hướng học mất bao lâu?', a: 'Khoảng 2-3 phút với 6 câu hỏi về mục tiêu, kinh nghiệm, thời gian học và chủ đề yêu thích.' },
  { q: 'Tôi có thể xem thử mà không cần đăng ký không?', a: 'Có. Nhấn "Xem bài mẫu" để trải nghiệm đầy đủ một bài học bao gồm phụ đề và từ vựng.' },
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function LandingPage({ onStartSurvey, onViewSample, onSignIn, onSignUp }: LandingPageProps) {
  const [activeCue, setActiveCue] = useState(0);
  const [showZh, setShowZh] = useState(true);
  const [showPinyin, setShowPinyin] = useState(true);
  const [showVi, setShowVi] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const cue = CUES[activeCue];

  return (
    <div className="min-h-[100dvh] bg-[#FFF9F5] text-[#252229]">

      {/* ── PUBLIC HEADER ─────────────────────────────────── */}
      <header className="sticky top-0 z-40 h-16 flex items-center justify-between px-6 md:px-10 bg-[#FFF9F5]/90 backdrop-blur-md border-b border-[#8FB9A7]/20 transition-all">
        <button onClick={() => window.scrollTo(0,0)} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#B91B1C] flex items-center justify-center font-extrabold text-white text-lg tracking-tight">H</div>
          <span className="text-lg font-black tracking-tight text-[#252229]" style={{ fontFamily: "'Fraunces', serif" }}>HanFlix</span>
        </button>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#252229]/80">
          <a href="#steps" className="hover:text-[#B91B1C] transition-colors">Cách học</a>
          <a href="#lessons" className="hover:text-[#B91B1C] transition-colors">Bài học mẫu</a>
          <a href="#faq" className="hover:text-[#B91B1C] transition-colors">Hỏi đáp</a>
        </nav>
        <div className="flex items-center gap-3">
          <button
            onClick={onSignIn}
            className="hidden md:block text-sm font-bold text-[#252229]/80 hover:text-[#B91B1C] transition-colors"
          >
            Đăng nhập
          </button>
          <button
            onClick={onStartSurvey}
            className="h-9 px-4 rounded-full bg-[#B91B1C] text-white hover:bg-[#A3181A] text-sm font-bold transition-colors"
          >
            Tìm lộ trình của tôi
          </button>
        </div>
      </header>

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="relative min-h-[calc(100vh-64px-32px)] flex items-center overflow-hidden bg-[#FFF9F5]">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#FCE9E1] rounded-full blur-[100px] opacity-50 pointer-events-none"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 w-full grid grid-cols-1 lg:grid-cols-[52%_48%] gap-12 lg:gap-8 py-12 lg:py-20">
          
          {/* Left: Copy & CTA */}
          <div className="flex flex-col justify-center">
            <div className="mb-4">
              <span className="inline-flex text-[#8FB9A7] font-bold text-sm tracking-widest uppercase">HỌC TIẾNG TRUNG QUA TÌNH HUỐNG</span>
            </div>
            
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-black text-[#B91B1C] leading-[1.1] mb-6"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              Tiếng Trung gần hơn qua mỗi câu chuyện
            </h1>
            
            <p className="text-lg md:text-xl text-[#252229]/80 mb-10 max-w-lg leading-relaxed">
              Video ngắn 1–5 phút, phụ đề Trung–Pinyin–Việt và ôn tập theo nhịp của bạn.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button
                onClick={onStartSurvey}
                className="h-14 px-8 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] active:scale-[0.98] text-white font-bold text-base shadow-lg transition-all w-full sm:w-auto"
              >
                Tìm lộ trình của tôi
              </button>
              
              <button
                onClick={() => onViewSample(SAMPLE_LESSONS[0].id)}
                className="h-14 px-8 rounded-full border-2 border-[#D7AF70] text-[#D7AF70] hover:bg-[#D7AF70] hover:text-white font-bold text-base transition-all w-full sm:w-auto"
              >
                Xem bài mẫu
              </button>
            </div>
          </div>

          {/* Right: Illustration */}
          <div className="relative flex items-center justify-center lg:justify-end min-h-[400px]">
             <img 
               src="https://images.unsplash.com/photo-1543097692-fa13c6cd8595?w=1600&h=1400&fit=crop&auto=format" 
               alt="Gấu trúc mặc trang phục đỏ học tiếng Trung"
               className="w-full max-w-[500px] h-auto object-contain drop-shadow-2xl rounded-2xl mix-blend-multiply"
             />
             <div className="absolute top-10 right-10 w-16 h-16 bg-[#FCE9E1]/80 backdrop-blur-sm rounded-2xl rotate-12 flex items-center justify-center shadow-lg border border-[#FCE9E1]">
                <span className="text-[#B91B1C] font-black text-2xl" lang="zh-Hans">学</span>
             </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────── */}
      <section id="steps" className="bg-white py-24 px-6 md:px-10">
        <div className="max-w-7xl mx-auto text-center mb-16">
          <h2
            className="text-3xl md:text-4xl font-bold text-[#18181B] mb-4"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Học tiếng Trung qua tình huống thực tế
          </h2>
          <p className="text-[#5F6368] max-w-2xl mx-auto">Phương pháp 4 bước giúp bạn làm chủ giao tiếp cơ bản nhanh chóng.</p>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {STEPS.map((step, i) => (
            <div key={step.n} className="bg-[#FDF6F5] rounded-3xl p-8 border border-[#FDF1F1] shadow-sm hover:shadow-md transition-shadow">
              <div
                className="text-4xl font-black text-[#B91B1C]/20 mb-4"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                {step.n}
              </div>
              <h3 className="font-bold text-[#18181B] text-lg mb-3">{step.title}</h3>
              <p className="text-sm text-[#5F6368] leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SAMPLE LESSONS ────────────────────────────────── */}
      <section id="lessons" className="bg-[#FDF6F5] py-24 px-6 md:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
               <h2
                className="text-3xl md:text-4xl font-bold text-[#18181B] mb-3"
                style={{ fontFamily: "'Fraunces', serif" }}
               >
                Bài học mẫu
               </h2>
               <p className="text-[#5F6368]">Học những câu nói bạn thực sự dùng tới.</p>
            </div>
            <button
              onClick={() => onSignIn()} // Route to auth in demo
              className="text-sm font-bold text-[#B91B1C] hover:text-[#A3181A] flex items-center gap-1"
            >
              Xem toàn bộ catalog
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SAMPLE_LESSONS.slice(0, 3).map((lesson) => (
              <div
                key={lesson.id}
                onClick={() => onViewSample(lesson.id)}
                className="bg-white rounded-3xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-xl transition-all duration-300 border border-[#E7E7EA]"
              >
                <div className="relative aspect-video overflow-hidden">
                  <img
                    src={lesson.thumbnailAsset || 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&h=500&fit=crop&auto=format'}
                    alt={lesson.titleVi}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                  
                  <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md rounded-md px-2 py-1 flex items-center gap-1.5">
                    <Play className="w-3 h-3 text-white fill-white" />
                    <span className="text-white text-xs font-medium">{formatDuration(lesson.durationSeconds)}</span>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-full bg-[#FCE9E1] text-[#B91B1C] text-[10px] font-bold uppercase tracking-wider">HSK {lesson.hsk}</span>
                  </div>
                  <h3 className="font-bold text-[#18181B] text-xl mb-1">{lesson.titleVi}</h3>
                  <p className="text-[#5F6368] text-sm" lang="zh" style={{ fontFamily: "'Noto Sans SC', sans-serif" }}>
                    {lesson.titleZh}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────── */}
      <section id="faq" className="bg-white py-24 px-6 md:px-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
             <h2
               className="text-3xl md:text-4xl font-bold text-[#18181B]"
               style={{ fontFamily: "'Fraunces', serif" }}
             >
               Bạn có thắc mắc?
             </h2>
          </div>
          
          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-[#FDF6F5] rounded-2xl border border-[#FDF1F1] overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                  className="w-full px-6 py-6 flex items-center justify-between text-left gap-4"
                >
                  <span className="font-bold text-[#18181B] text-base">{faq.q}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${openFaq === i ? 'bg-[#B91B1C] text-white' : 'bg-white text-[#18181B]'}`}>
                    {openFaq === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 text-sm text-[#5F6368] leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────── */}
      <section className="bg-[#FDF6F5] py-24 px-6 md:px-10 text-center">
        <div className="max-w-2xl mx-auto bg-white rounded-[40px] p-12 shadow-xl border border-[#FDF1F1]">
          <h2
            className="text-3xl md:text-4xl font-bold text-[#B91B1C] mb-6"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Sẵn sàng nói tiếng Trung?
          </h2>
          <p className="text-base text-[#5F6368] mb-8">
            Làm khảo sát ngắn để tìm bài học phù hợp với trình độ của bạn.
          </p>
          <button
            onClick={onStartSurvey}
            className="h-14 px-10 rounded-full bg-[#B91B1C] hover:bg-[#A3181A] active:scale-[0.98] text-white font-bold text-base inline-flex items-center justify-center gap-2 transition-all shadow-lg"
          >
            Bắt đầu khảo sát <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────── */}
      <footer className="bg-white border-t border-[#E7E7EA] py-10 px-6 md:px-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#B91B1C] flex items-center justify-center font-extrabold text-white text-lg tracking-tight">H</div>
            <span className="text-xl font-bold text-[#18181B]" style={{ fontFamily: "'Fraunces', serif" }}>HanFlix</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-[#5F6368]">
            <button onClick={onSignIn} className="hover:text-[#B91B1C] transition-colors">Đăng nhập</button>
            <button onClick={onSignUp} className="hover:text-[#B91B1C] transition-colors">Đăng ký</button>
          </div>
          <div className="text-xs text-[#8B9097]">
            © {new Date().getFullYear()} HanFlix. Dữ liệu demo.
          </div>
        </div>
      </footer>
    </div>
  );
}
