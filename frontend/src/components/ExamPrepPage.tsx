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

type LeaderRow = { rank: number; name: string; xp: string; streak: string; hsk: string; isMe: boolean; seed: string };
const LEADERBOARD_DATA: Record<string, LeaderRow[]> = {
  week: [
    { rank: 1, name: 'Trần Bảo Ngọc', xp: '3,820 XP', streak: '42 ngày', hsk: 'HSK 5', isMe: false, seed: 'ngoc' },
    { rank: 2, name: 'Nguyễn Minh Anh', xp: '2,450 XP', streak: '14 ngày', hsk: 'HSK 3', isMe: true, seed: 'minhanh' },
    { rank: 3, name: 'Lê Hoàng Nam', xp: '2,210 XP', streak: '28 ngày', hsk: 'HSK 4', isMe: false, seed: 'nam' },
    { rank: 4, name: 'Phạm Thu Thảo', xp: '1,890 XP', streak: '19 ngày', hsk: 'HSK 3', isMe: false, seed: 'thao' },
    { rank: 5, name: 'Đặng Việt Anh', xp: '1,540 XP', streak: '7 ngày', hsk: 'HSK 2', isMe: false, seed: 'vietanh' },
  ],
  month: [
    { rank: 1, name: 'Lê Hoàng Nam', xp: '11,910 XP', streak: '28 ngày', hsk: 'HSK 4', isMe: false, seed: 'nam' },
    { rank: 2, name: 'Trần Bảo Ngọc', xp: '10,820 XP', streak: '42 ngày', hsk: 'HSK 5', isMe: false, seed: 'ngoc' },
    { rank: 3, name: 'Nguyễn Minh Anh', xp: '8,450 XP', streak: '14 ngày', hsk: 'HSK 3', isMe: true, seed: 'minhanh' },
    { rank: 4, name: 'Phạm Thu Thảo', xp: '7,800 XP', streak: '19 ngày', hsk: 'HSK 3', isMe: false, seed: 'thao' },
    { rank: 5, name: 'Đặng Việt Anh', xp: '5,540 XP', streak: '7 ngày', hsk: 'HSK 2', isMe: false, seed: 'vietanh' },
  ],
  all: [
    { rank: 1, name: 'Trần Bảo Ngọc', xp: '84,820 XP', streak: '42 ngày', hsk: 'HSK 5', isMe: false, seed: 'ngoc' },
    { rank: 2, name: 'Nguyễn Minh Anh', xp: '71,450 XP', streak: '14 ngày', hsk: 'HSK 3', isMe: true, seed: 'minhanh' },
    { rank: 3, name: 'Lê Hoàng Nam', xp: '60,910 XP', streak: '28 ngày', hsk: 'HSK 4', isMe: false, seed: 'nam' },
    { rank: 4, name: 'Phạm Thu Thảo', xp: '49,800 XP', streak: '19 ngày', hsk: 'HSK 3', isMe: false, seed: 'thao' },
    { rank: 5, name: 'Đặng Việt Anh', xp: '38,540 XP', streak: '7 ngày', hsk: 'HSK 2', isMe: false, seed: 'vietanh' },
  ],
};
export function LeaderboardPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const leaders = LEADERBOARD_DATA[period];

  const rankIcons: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E7A92F] text-white flex items-center justify-center">
              <Trophy className="w-5 h-5 fill-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#18181B] tracking-tight">Bảng Xếp Hạng</h1>
              <p className="text-sm text-[#5F6368] mt-0.5">Thi đua tích lũy XP bài học và chuỗi học tập</p>
            </div>
          </div>
          <div className="flex rounded-xl border border-[#E7E7EA] overflow-hidden self-start sm:self-center">
            {([['week', 'Tuần này'], ['month', 'Tháng này'], ['all', 'Toàn thời gian']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 py-2 text-xs font-bold transition-colors ${
                  period === key ? 'bg-[#B91B1C] text-white' : 'bg-white text-[#5F6368] hover:bg-[#F7F7F9]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-[#E7E7EA] overflow-hidden">
        {/* Top 3 podium strip */}
        <div className="bg-gradient-to-r from-[#FDF6F5] to-[#FFF8F0] px-6 py-4 border-b border-[#E7E7EA] flex items-end justify-center gap-6">
          {leaders.slice(0, 3).map((user, i) => {
            const order = [1, 0, 2][i]; // silver, gold, bronze visual order
            const l = leaders[order];
            const heights = ['h-14', 'h-20', 'h-10'];
            return (
              <div key={l.rank} className="flex flex-col items-center gap-1">
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${l.seed}`}
                  alt={l.name}
                  className="w-10 h-10 rounded-full border-2 border-white shadow-sm bg-[#F7F7F9]"
                />
                <span className="text-lg">{rankIcons[l.rank] || `#${l.rank}`}</span>
                <div className={`w-16 ${heights[i]} rounded-t-xl flex flex-col items-center justify-end pb-1.5 ${
                  l.rank === 1 ? 'bg-[#E7A92F] text-white' : l.rank === 2 ? 'bg-[#C0C3CA] text-white' : 'bg-[#B87333] text-white'
                }`}>
                  <span className="text-[10px] font-black">{l.xp.split(' ')[0]}</span>
                </div>
                <span className="text-[10px] font-bold text-[#18181B] text-center max-w-[64px] leading-tight truncate">{l.name.split(' ').pop()}</span>
              </div>
            );
          })}
        </div>

        <div className="divide-y divide-[#E7E7EA]">
          {leaders.map((user) => (
            <div key={user.rank} className={`px-5 py-4 flex items-center gap-4 transition-colors ${user.isMe ? 'bg-[#FDF1F1]/60' : 'hover:bg-[#F7F7F9]'}`}>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                user.rank === 1 ? 'bg-[#E7A92F] text-white' :
                user.rank === 2 ? 'bg-[#C0C3CA] text-white' :
                user.rank === 3 ? 'bg-[#B87333] text-white' :
                'bg-[#F7F7F9] text-[#5F6368]'
              }`}>
                {user.rank <= 3 ? rankIcons[user.rank] : `${user.rank}`}
              </span>

              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.seed}`}
                alt={user.name}
                className="w-9 h-9 rounded-full border border-[#E7E7EA] bg-[#F7F7F9] shrink-0"
              />

              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  {user.name}
                  {user.isMe && <span className="px-1.5 py-0.5 rounded bg-[#B91B1C] text-white text-[10px] font-bold">Bạn</span>}
                </div>
                <div className="text-xs text-[#8B9097] flex items-center gap-2 mt-0.5">
                  <span>{user.hsk}</span>
                  <span className="flex items-center gap-0.5">
                    <Flame className="w-3 h-3 text-[#E7A92F] fill-[#E7A92F]" />
                    {user.streak}
                  </span>
                </div>
              </div>

              <div className="text-sm font-extrabold text-[#B91B1C] shrink-0">
                {user.xp}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
