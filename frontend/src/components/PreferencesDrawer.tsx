import React, { useState } from 'react';
import { X, SlidersHorizontal, Check, Sparkles } from 'lucide-react';
import { UserProfile } from '../data/hanflixData';

interface PreferencesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onSavePreferences: (updated: Partial<UserProfile>) => void;
}

export default function PreferencesDrawer({
  isOpen,
  onClose,
  userProfile,
  onSavePreferences
}: PreferencesDrawerProps) {
  const [selectedHsk, setSelectedHsk] = useState(userProfile.hskLevel);
  const [selectedGoal, setSelectedGoal] = useState(userProfile.targetGoal);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(userProfile.interests);

  const hskLevels = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'];
  const goalOptions = ['Kinh doanh', 'Du lịch', 'Luyện thi HSK', 'Giao tiếp hằng ngày', 'Văn hóa & Giải trí'];
  const interestTopics = ['Ẩm thực', 'Du lịch', 'Mua sắm', 'Phim ảnh', 'Kinh tế', 'Công nghệ', 'Đời sống', 'Âm nhạc'];

  const toggleInterest = (topic: string) => {
    if (selectedInterests.includes(topic)) {
      setSelectedInterests(selectedInterests.filter((t) => t !== topic));
    } else {
      setSelectedInterests([...selectedInterests, topic]);
    }
  };

  const handleSave = () => {
    onSavePreferences({
      hskLevel: selectedHsk,
      targetGoal: selectedGoal,
      interests: selectedInterests
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-2xs animate-in fade-in duration-200">
      <div className="w-full max-w-[440px] bg-white h-full shadow-2xl flex flex-col border-l border-[#E7E7EA] animate-in slide-in-from-right duration-250">
        {/* Header */}
        <div className="p-5 border-b border-[#E7E7EA] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FDF1F1] text-[#B91B1C] flex items-center justify-center font-bold">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-[#18181B] tracking-tight">Tùy chỉnh Sở thích AI</h3>
              <p className="text-xs text-[#5F6368]">Tối ưu bài học hiển thị trên Bảng tin của bạn</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full border border-[#E7E7EA] text-[#5F6368] hover:bg-[#F7F7F9] hover:text-[#18181B]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Section 1: Trình độ HSK */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#18181B] mb-2.5">
              1. Trình độ HSK mục tiêu
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {hskLevels.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setSelectedHsk(lvl)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                    selectedHsk === lvl
                      ? 'bg-[#B91B1C] text-white border-[#B91B1C] shadow-xs'
                      : 'bg-[#F7F7F9] text-[#5F6368] border-[#E7E7EA] hover:border-[#D1D5DB]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Mục tiêu học */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#18181B] mb-2.5">
              2. Mục tiêu chính
            </label>
            <div className="space-y-2">
              {goalOptions.map((goal) => (
                <button
                  key={goal}
                  onClick={() => setSelectedGoal(goal)}
                  className={`w-full py-2.5 px-4 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                    selectedGoal === goal
                      ? 'bg-[#FDF1F1] text-[#B91B1C] border-[#B91B1C]'
                      : 'bg-[#F7F7F9] text-[#5F6368] border-[#E7E7EA] hover:bg-white'
                  }`}
                >
                  <span>Mục tiêu: {goal}</span>
                  {selectedGoal === goal && <Check className="w-4 h-4 text-[#B91B1C]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Chủ đề yêu thích */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#18181B] mb-2.5">
              3. Chủ đề quan tâm ({selectedInterests.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {interestTopics.map((topic) => {
                const isSelected = selectedInterests.includes(topic);
                return (
                  <button
                    key={topic}
                    onClick={() => toggleInterest(topic)}
                    className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-[#34363A] text-white shadow-xs'
                        : 'bg-[#F7F7F9] text-[#5F6368] border border-[#E7E7EA] hover:bg-[#E7E7EA]'
                    }`}
                  >
                    {topic} {isSelected ? '✓' : '+'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E7E7EA] bg-white flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-[#E7E7EA] text-xs font-bold text-[#5F6368] hover:bg-[#F7F7F9]"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-[#B91B1C] text-white text-xs font-bold hover:bg-[#A3181A] shadow-xs flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 fill-white" />
            <span>Áp dụng gợi ý mới</span>
          </button>
        </div>
      </div>
    </div>
  );
}
