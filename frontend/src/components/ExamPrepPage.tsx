import React, { useState } from 'react';
import { GraduationCap, Trophy, Users, Clock, CheckCircle, Flame, Star, Calendar, ArrowRight, AlertTriangle } from 'lucide-react';

interface ExamPrepPageProps {
  onStartPractice?: () => void;
}

export function ExamPrepPage({ onStartPractice }: ExamPrepPageProps) {
  const [selectedHsk, setSelectedHsk] = useState('HSK 3');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#34363A] text-white flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#18181B] tracking-tight">Luyện tập theo dạng bài HSK</h1>
            <p className="text-sm text-[#5F6368] mt-0.5">Bản mô phỏng đang được hoàn thiện</p>
          </div>
        </div>
      </div>

      <div className="bg-[#FFF9F5] rounded-3xl p-6 border border-[#FCE9E1] flex items-start gap-4">
         <div className="w-8 h-8 rounded-full bg-[#FCE9E1] text-[#B91B1C] flex items-center justify-center shrink-0">
           <AlertTriangle className="w-4 h-4" />
         </div>
         <div>
           <h3 className="font-bold text-[#18181B] mb-1">Chưa có đề thi hoàn chỉnh</h3>
           <p className="text-sm text-[#5F6368] mb-4">
             Tính năng thi thử HSK đầy đủ với các phần Nghe, Đọc, Viết đang trong quá trình phát triển.
             Hiện tại, bạn có thể luyện tập các kỹ năng lẻ dựa trên kho bài học hiện có.
           </p>
           
           <div className="flex flex-col sm:flex-row gap-3">
             <select 
               value={selectedHsk}
               onChange={(e) => setSelectedHsk(e.target.value)}
               className="h-10 px-4 rounded-xl border border-[#E7E7EA] bg-white text-sm font-bold text-[#18181B] outline-none focus:border-[#B91B1C]"
             >
               {['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'].map(h => (
                 <option key={h} value={h}>{h}</option>
               ))}
             </select>
             
             <button
                onClick={onStartPractice}
                className="h-10 px-6 rounded-xl bg-[#B91B1C] text-white font-bold text-sm hover:bg-[#A3181A] transition-colors flex items-center justify-center gap-2"
              >
                Ôn kỹ năng theo {selectedHsk} <ArrowRight className="w-4 h-4" />
              </button>
           </div>
         </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 opacity-60">
        <div className="p-6 rounded-3xl bg-white border border-[#E7E7EA] flex flex-col justify-between">
           <div>
             <div className="flex items-center justify-between mb-3">
               <span className="px-3 py-1 rounded-full bg-[#F7F7F9] text-[#5F6368] text-xs font-bold">HSK 3</span>
             </div>
             <h3 className="font-extrabold text-lg text-[#18181B]">Đề thi mô phỏng</h3>
             <p className="text-xs text-[#5F6368] mt-1">Đang xây dựng ngân hàng câu hỏi</p>
           </div>

           <div className="mt-6 pt-4 border-t border-[#E7E7EA] flex items-center justify-between">
             <div className="flex items-center gap-1.5 text-xs text-[#8B9097]">
               <Clock className="w-3.5 h-3.5" />
               Chưa có thời gian
             </div>
             <button
               disabled
               className="px-4 py-2 rounded-xl bg-[#F7F7F9] text-[#8B9097] font-bold text-xs cursor-not-allowed border border-[#E7E7EA]"
             >
               Thi thử đầy đủ — Sắp có
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}

import LeaderboardView, { LeaderboardViewProps } from './leaderboard/LeaderboardView';

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
        <button className="px-5 py-2.5 rounded-xl bg-[#B91B1C] text-white font-bold text-sm hover:bg-[#A3181A] transition-colors shrink-0">
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
