import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Sparkles, BookOpen, Calendar, Clock, Edit2 } from 'lucide-react';
import { UserLearningProfile } from '../../data/hanflixData';

interface SurveyDraft {
  step: number;
  goal: string;
  targetHSK: string;
  targetDate: string;
  experience: string;
  selfHSK: string;
  selfHSKSource: string;
  skills: string[];
  dailyMinutes: number;
  daysPerWeek: number;
  topics: string[];
  subtitleMode: string;
  showProposal?: boolean;
}

const DRAFT_KEY = 'hanflix_survey_draft';

function loadDraft(): SurveyDraft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    step: 1,
    goal: '',
    targetHSK: '',
    targetDate: '',
    experience: '',
    selfHSK: '',
    selfHSKSource: '',
    skills: [],
    dailyMinutes: 10,
    daysPerWeek: 5,
    topics: [],
    subtitleMode: '',
    showProposal: false,
  };
}

function saveDraft(draft: SurveyDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {}
}

interface OnboardingViewProps {
  onCompleteOnboarding: (profile: UserLearningProfile) => void;
  onSkip?: () => void;
}

const GOALS = [
  { id: 'daily', label: 'Giao tiếp đời sống và kết bạn' },
  { id: 'travel', label: 'Du lịch và sinh hoạt tự túc' },
  { id: 'business', label: 'Làm việc với đối tác Trung Quốc' },
  { id: 'hsk', label: 'Luyện thi HSK' },
  { id: 'culture', label: 'Văn hóa và giải trí' },
  { id: 'other', label: 'Mục tiêu khác' },
];

const EXPERIENCES = [
  { id: 'never', label: 'Chưa học bao giờ' },
  { id: 'some', label: 'Đã học một chút' },
  { id: 'unsure', label: 'Đã học nhưng chưa chắc trình độ' },
  { id: 'know', label: 'Tôi biết trình độ của mình' },
];

const SKILLS = [
  { id: 'listening', label: 'Luyện nghe' },
  { id: 'reading', label: 'Đọc tiếng Trung' },
  { id: 'vocabulary', label: 'Học từ vựng' },
  { id: 'sentences', label: 'Dùng từ vào câu' },
  { id: 'unknown', label: 'Chưa biết' },
];

const MINUTES = [5, 10, 15, 20, 30];
const DAYS = [2, 3, 4, 5, 6, 7];

const TOPICS = [
  { id: 'food', label: 'Ẩm thực' },
  { id: 'travel', label: 'Du lịch' },
  { id: 'shopping', label: 'Mua sắm' },
  { id: 'entertainment', label: 'Phim ảnh và Âm nhạc' },
  { id: 'business', label: 'Kinh doanh' },
  { id: 'daily-life', label: 'Đời sống hàng ngày' },
  { id: 'health', label: 'Sức khỏe' },
  { id: 'no-pref', label: 'Không có ưu tiên' },
];

const SUBTITLE_MODES = [
  { id: 'all', label: 'Cả ba lớp (Trung - Pinyin - Việt)' },
  { id: 'zh-pinyin', label: 'Trung và Pinyin' },
  { id: 'zh-vi', label: 'Trung và Tiếng Việt' },
  { id: 'zh', label: 'Chỉ tiếng Trung' },
  { id: 'unsure', label: 'Chưa biết, thử tất cả' },
];

const HSK_LEVELS = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'];

export default function OnboardingView({ onCompleteOnboarding, onSkip }: OnboardingViewProps) {
  const [draft, setDraft] = useState<SurveyDraft>(loadDraft);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  const set = (key: keyof SurveyDraft, value: any) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleSkill = (id: string) => {
    if (id === 'unknown') {
      set('skills', draft.skills.includes('unknown') ? [] : ['unknown']);
      return;
    }
    const without = draft.skills.filter((s) => s !== 'unknown');
    if (without.includes(id)) {
      set('skills', without.filter((s) => s !== id));
    } else if (without.length < 2) {
      set('skills', [...without, id]);
    }
  };

  const toggleTopic = (id: string) => {
    if (id === 'no-pref') {
      set('topics', draft.topics.includes('no-pref') ? [] : ['no-pref']);
      return;
    }
    const without = draft.topics.filter((t) => t !== 'no-pref');
    if (without.includes(id)) {
      set('topics', without.filter((t) => t !== id));
    } else if (without.length < 3) {
      set('topics', [...without, id]);
    }
  };

  const goNext = () => set('step', Math.min(draft.step + 1, 7));
  const goBack = () => set('step', Math.max(draft.step - 1, 1));

  const canContinue = () => {
    if (draft.step === 1) return draft.goal !== '';
    if (draft.step === 2) return draft.experience !== '';
    if (draft.step === 3) return draft.skills.length > 0;
    if (draft.step === 4) return true;
    if (draft.step === 5) return true;
    if (draft.step === 6) return draft.subtitleMode !== '';
    return true;
  };

  const showProposalPage = () => {
    set('showProposal', true);
  };

  const handleFinish = () => {
    const subtitleMap: Record<string, { zh: boolean; pinyin: boolean; vi: boolean }> = {
      all: { zh: true, pinyin: true, vi: true },
      'zh-pinyin': { zh: true, pinyin: true, vi: false },
      'zh-vi': { zh: true, pinyin: false, vi: true },
      zh: { zh: true, pinyin: false, vi: false },
      unsure: { zh: true, pinyin: true, vi: true },
    };
    const hskLevelNum = draft.selfHSK
      ? parseInt(draft.selfHSK.replace('HSK ', '')) || 1
      : 1;

    const profile: UserLearningProfile = {
      hskLevel: hskLevelNum,
      goal: draft.goal,
      topics: draft.topics.filter((t) => t !== 'no-pref'),
      dailyMinutes: draft.dailyMinutes,
      preferredDuration: '1-5',
      subtitleDefaults: subtitleMap[draft.subtitleMode] ?? { zh: true, pinyin: true, vi: true },
      defaultSpeed: 1,
      uiLanguage: 'vi',
    };
    sessionStorage.removeItem(DRAFT_KEY);
    onCompleteOnboarding(profile);
  };

  const totalSteps = 6;

  if (draft.showProposal) {
    const goalLabel = GOALS.find((g) => g.id === draft.goal)?.label || 'Giao tiếp đời sống';
    const hskLabel = draft.experience === 'never' ? 'HSK 1 (Người mới bắt đầu)' : draft.selfHSK || 'Chưa xác định';
    const sourceLabel = draft.experience === 'know' ? `Từ ${draft.selfHSKSource || 'Tự đánh giá'}` : 'Tự khai';
    
    return (
      <div className="min-h-[100dvh] bg-[#F7F7F9] flex flex-col">
        <div className="bg-white border-b border-[#E7E7EA] px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center">
            <img
              src="/assets/logo.png"
              alt="HanFlix Logo"
              className="h-8 w-auto object-contain"
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center py-8 px-4">
          <div className="bg-white w-full max-w-[720px] rounded-3xl shadow-sm border border-[#E7E7EA] overflow-hidden p-6 md:p-8 space-y-8">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 bg-[#FCE9E1] text-[#B91B1C] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                Đề xuất minh họa từ câu trả lời của bạn
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-[#18181B]" style={{ fontFamily: "'Fraunces', serif" }}>
                Lộ trình học dành riêng cho bạn
              </h2>
              <p className="text-[#5F6368]">Dựa trên mục tiêu {goalLabel.toLowerCase()} và thời gian {draft.dailyMinutes} phút mỗi ngày.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#F7F7F9] rounded-2xl p-5 border border-[#E7E7EA]">
                <div className="flex items-center gap-2 text-[#8B9097] text-xs font-bold uppercase tracking-wider mb-2">
                  <Check className="w-4 h-4" /> Điểm xuất phát
                </div>
                <div className="text-lg font-bold text-[#18181B]">{hskLabel}</div>
                <div className="text-sm text-[#5F6368]">{sourceLabel}</div>
              </div>
              <div className="bg-[#F7F7F9] rounded-2xl p-5 border border-[#E7E7EA]">
                <div className="flex items-center gap-2 text-[#8B9097] text-xs font-bold uppercase tracking-wider mb-2">
                  <Clock className="w-4 h-4" /> Cam kết thời gian
                </div>
                <div className="text-lg font-bold text-[#18181B]">{draft.dailyMinutes} phút / ngày</div>
                <div className="text-sm text-[#5F6368]">{draft.daysPerWeek} ngày / tuần</div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-[#18181B] mb-4">Lịch học 7 ngày đầu tiên</h3>
              <div className="space-y-3">
                <div className="flex gap-4 items-start">
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-[#FDF1F1] text-[#B91B1C] flex flex-col items-center justify-center font-bold text-sm">
                    Ngày 1
                  </div>
                  <div className="flex-1 bg-white border border-[#E7E7EA] rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-[#18181B]">Chào hỏi và giới thiệu tên</div>
                      <div className="text-xs text-[#5F6368]">Khởi động nhẹ nhàng · 2 phút</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-[#F7F7F9] text-[#5F6368] flex flex-col items-center justify-center font-bold text-sm">
                    Ngày 2
                  </div>
                  <div className="flex-1 bg-white border border-[#E7E7EA] rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-[#18181B]">Hỏi đường đến ga tàu</div>
                      <div className="text-xs text-[#5F6368]">Ứng dụng thực tế · 2 phút</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-[#F7F7F9] text-[#5F6368] flex flex-col items-center justify-center font-bold text-sm">
                    Ngày 3
                  </div>
                  <div className="flex-1 bg-white border border-[#E7E7EA] rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-[#18181B]">Ôn tập 2 bài trước</div>
                      <div className="text-xs text-[#5F6368]">Flashcard từ vựng & bài tập</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#E7E7EA]">
              <button
                onClick={() => set('showProposal', false)}
                className="flex-1 h-12 rounded-xl border border-[#E7E7EA] text-[#5F6368] font-bold text-sm hover:bg-[#F7F7F9] transition-colors"
              >
                Chỉnh sửa câu trả lời
              </button>
              <button
                onClick={handleFinish}
                className="flex-[2] h-12 rounded-xl bg-[#B91B1C] text-white font-bold text-sm hover:bg-[#A3181A] transition-colors"
              >
                Xác nhận lộ trình
              </button>
            </div>
            
            <div className="text-center">
               <button onClick={() => { sessionStorage.removeItem(DRAFT_KEY); if (onSkip) onSkip(); }} className="text-xs text-[#8B9097] hover:text-[#5F6368] underline">
                 Để sau (Lưu bản nháp và vào trang chủ)
               </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F7F7F9] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-[#E7E7EA] px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center">
          <img
            src="/assets/logo.png"
            alt="HanFlix Logo"
            className="h-8 w-auto object-contain"
          />
        </div>
        {draft.step <= totalSteps && (
          <span className="text-xs font-bold text-[#8B9097]">Bước {draft.step}/{totalSteps}</span>
        )}
        {onSkip && (
          <button onClick={onSkip} className="text-xs text-[#8B9097] hover:text-[#18181B] font-semibold">
            Bỏ qua
          </button>
        )}
      </div>

      {/* Progress bar */}
      {draft.step <= totalSteps && (
        <div className="h-1 bg-[#E7E7EA]">
          <div
            className="h-full bg-[#B91B1C] transition-all duration-300"
            style={{ width: `${(draft.step / totalSteps) * 100}%` }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col items-center py-8 px-4">
        <div className="bg-white w-full max-w-[720px] rounded-3xl shadow-sm border border-[#E7E7EA] overflow-hidden">
          <div className="p-6 md:p-8 space-y-6 min-h-[400px] flex flex-col">

            {/* Step 1: Goal */}
            {draft.step === 1 && (
              <div className="flex-1 space-y-4">
                <h2 className="text-xl font-black text-[#18181B]">Mục tiêu chính khi học tiếng Trung của bạn là gì?</h2>
                <p className="text-sm text-[#5F6368]">Chọn một mục tiêu phù hợp nhất.</p>
                <div className="space-y-2.5 pt-1">
                  {GOALS.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => set('goal', g.id)}
                      className={`w-full min-h-[52px] px-4 py-3.5 rounded-2xl border text-left text-sm font-semibold transition-all flex items-center justify-between ${
                        draft.goal === g.id
                          ? 'bg-[#FDF1F1] text-[#B91B1C] border-[#B91B1C]'
                          : 'bg-[#F7F7F9] text-[#18181B] border-[#E7E7EA] hover:bg-white'
                      }`}
                    >
                      <span>{g.label}</span>
                      {draft.goal === g.id && <Check className="w-4 h-4 text-[#B91B1C] shrink-0" />}
                    </button>
                  ))}
                </div>

                {draft.goal === 'hsk' && (
                  <div className="pt-2 space-y-3">
                    <p className="text-xs text-[#5F6368] font-semibold">Mục tiêu HSK (tùy chọn)</p>
                    <div className="grid grid-cols-3 gap-2">
                      {HSK_LEVELS.map((l) => (
                        <button
                          key={l}
                          onClick={() => set('targetHSK', draft.targetHSK === l ? '' : l)}
                          className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${
                            draft.targetHSK === l
                              ? 'bg-[#B91B1C] text-white border-[#B91B1C]'
                              : 'bg-[#F7F7F9] text-[#18181B] border-[#E7E7EA]'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Experience */}
            {draft.step === 2 && (
              <div className="flex-1 space-y-4">
                <h2 className="text-xl font-black text-[#18181B]">Bạn đã từng học tiếng Trung chưa?</h2>
                <p className="text-sm text-[#5F6368]">"Chưa biết trình độ" là câu trả lời hợp lệ.</p>
                <div className="space-y-2.5 pt-1">
                  {EXPERIENCES.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => set('experience', e.id)}
                      className={`w-full min-h-[52px] px-4 py-3.5 rounded-2xl border text-left text-sm font-semibold transition-all flex items-center justify-between ${
                        draft.experience === e.id
                          ? 'bg-[#FDF1F1] text-[#B91B1C] border-[#B91B1C]'
                          : 'bg-[#F7F7F9] text-[#18181B] border-[#E7E7EA] hover:bg-white'
                      }`}
                    >
                      <span>{e.label}</span>
                      {draft.experience === e.id && <Check className="w-4 h-4 text-[#B91B1C] shrink-0" />}
                    </button>
                  ))}
                </div>

                {draft.experience === 'know' && (
                  <div className="pt-2 space-y-3">
                    <p className="text-xs text-[#5F6368] font-semibold">Trình độ hiện tại (theo đánh giá của bạn)</p>
                    <div className="grid grid-cols-3 gap-2">
                      {HSK_LEVELS.map((l) => (
                        <button
                          key={l}
                          onClick={() => set('selfHSK', draft.selfHSK === l ? '' : l)}
                          className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${
                            draft.selfHSK === l
                              ? 'bg-[#B91B1C] text-white border-[#B91B1C]'
                              : 'bg-[#F7F7F9] text-[#18181B] border-[#E7E7EA]'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs text-[#5F6368] font-semibold">Nguồn đánh giá</p>
                      {['Chứng chỉ HSK', 'Sách giáo trình', 'Tự đánh giá', 'Giáo viên nhận xét'].map((src) => (
                        <button
                          key={src}
                          onClick={() => set('selfHSKSource', draft.selfHSKSource === src ? '' : src)}
                          className={`w-full px-4 py-2.5 rounded-xl border text-sm font-semibold text-left transition-all ${
                            draft.selfHSKSource === src
                              ? 'bg-[#FDF1F1] text-[#B91B1C] border-[#B91B1C]'
                              : 'bg-[#F7F7F9] text-[#18181B] border-[#E7E7EA]'
                          }`}
                        >
                          {src}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Skills */}
            {draft.step === 3 && (
              <div className="flex-1 space-y-4">
                <h2 className="text-xl font-black text-[#18181B]">Bạn muốn tập trung luyện kỹ năng nào?</h2>
                <p className="text-sm text-[#5F6368]">Chọn tối đa 2 kỹ năng. "Chưa biết" là lựa chọn hợp lệ.</p>
                <div className="space-y-2.5 pt-1">
                  {SKILLS.map((s) => {
                    const isSelected = draft.skills.includes(s.id);
                    const isDisabled =
                      !isSelected &&
                      !draft.skills.includes('unknown') &&
                      s.id !== 'unknown' &&
                      draft.skills.filter((x) => x !== 'unknown').length >= 2;
                    return (
                      <button
                        key={s.id}
                        onClick={() => !isDisabled && toggleSkill(s.id)}
                        disabled={isDisabled}
                        className={`w-full min-h-[52px] px-4 py-3.5 rounded-2xl border text-left text-sm font-semibold transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#FDF1F1] text-[#B91B1C] border-[#B91B1C]'
                            : isDisabled
                            ? 'bg-[#F7F7F9] text-[#8B9097] border-[#E7E7EA] opacity-50 cursor-not-allowed'
                            : 'bg-[#F7F7F9] text-[#18181B] border-[#E7E7EA] hover:bg-white'
                        }`}
                      >
                        <span>{s.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-[#B91B1C] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                {draft.skills.length > 0 && !draft.skills.includes('unknown') && (
                  <p className="text-xs text-[#8B9097]">Đã chọn {draft.skills.length}/2 kỹ năng</p>
                )}
              </div>
            )}

            {/* Step 4: Schedule */}
            {draft.step === 4 && (
              <div className="flex-1 space-y-6">
                <h2 className="text-xl font-black text-[#18181B]">Bạn có thể dành bao nhiêu thời gian để học?</h2>
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[#5F6368]">Phút mỗi ngày</p>
                  <div className="flex gap-2 flex-wrap">
                    {MINUTES.map((m) => (
                      <button
                        key={m}
                        onClick={() => set('dailyMinutes', m)}
                        className={`h-12 px-5 rounded-xl border text-sm font-bold transition-all ${
                          draft.dailyMinutes === m
                            ? 'bg-[#B91B1C] text-white border-[#B91B1C]'
                            : 'bg-[#F7F7F9] text-[#18181B] border-[#E7E7EA] hover:border-[#B91B1C]'
                        }`}
                      >
                        {m} phút
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[#5F6368]">Ngày học mỗi tuần</p>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS.map((d) => (
                      <button
                        key={d}
                        onClick={() => set('daysPerWeek', d)}
                        className={`h-12 px-5 rounded-xl border text-sm font-bold transition-all ${
                          draft.daysPerWeek === d
                            ? 'bg-[#B91B1C] text-white border-[#B91B1C]'
                            : 'bg-[#F7F7F9] text-[#18181B] border-[#E7E7EA] hover:border-[#B91B1C]'
                        }`}
                      >
                        {d} ngày
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Topics */}
            {draft.step === 5 && (
              <div className="flex-1 space-y-4">
                <h2 className="text-xl font-black text-[#18181B]">Chủ đề nào bạn muốn học?</h2>
                <p className="text-sm text-[#5F6368]">Chọn tối đa 3 chủ đề, hoặc chọn "Không có ưu tiên".</p>
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {TOPICS.map((t) => {
                    const isSelected = draft.topics.includes(t.id);
                    const isDisabled =
                      !isSelected &&
                      !draft.topics.includes('no-pref') &&
                      t.id !== 'no-pref' &&
                      draft.topics.filter((x) => x !== 'no-pref').length >= 3;
                    return (
                      <button
                        key={t.id}
                        onClick={() => !isDisabled && toggleTopic(t.id)}
                        disabled={isDisabled}
                        className={`min-h-[52px] px-4 py-3 rounded-2xl border text-sm font-semibold transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#34363A] text-white border-[#34363A]'
                            : isDisabled
                            ? 'bg-[#F7F7F9] text-[#8B9097] border-[#E7E7EA] opacity-50 cursor-not-allowed'
                            : 'bg-[#F7F7F9] text-[#18181B] border-[#E7E7EA] hover:bg-white'
                        }`}
                      >
                        <span>{t.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 6: Subtitles */}
            {draft.step === 6 && (
              <div className="flex-1 space-y-4">
                <h2 className="text-xl font-black text-[#18181B]">Bạn muốn xem phụ đề như thế nào?</h2>
                <p className="text-sm text-[#5F6368]">Có thể thay đổi bất cứ lúc nào trong phần cài đặt.</p>
                <div className="space-y-2.5 pt-1">
                  {SUBTITLE_MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => set('subtitleMode', m.id)}
                      className={`w-full min-h-[52px] px-4 py-3.5 rounded-2xl border text-left text-sm font-semibold transition-all flex items-center justify-between ${
                        draft.subtitleMode === m.id
                          ? 'bg-[#FDF1F1] text-[#B91B1C] border-[#B91B1C]'
                          : 'bg-[#F7F7F9] text-[#18181B] border-[#E7E7EA] hover:bg-white'
                      }`}
                    >
                      <span>{m.label}</span>
                      {draft.subtitleMode === m.id && <Check className="w-4 h-4 text-[#B91B1C] shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 7: Summary */}
            {draft.step === 7 && (
              <div className="flex-1 space-y-5">
                <h2 className="text-xl font-black text-[#18181B]">Xem lại câu trả lời của bạn</h2>
                <p className="text-sm text-[#5F6368]">Chỉnh sửa bằng cách quay lại các bước trước.</p>
                <div className="space-y-3">
                  {[
                    { label: 'Mục tiêu', value: GOALS.find((g) => g.id === draft.goal)?.label || '(chưa chọn)', step: 1 },
                    { label: 'Kinh nghiệm', value: EXPERIENCES.find((e) => e.id === draft.experience)?.label || '(chưa chọn)', step: 2 },
                    { label: 'Kỹ năng muốn luyện', value: draft.skills.map((s) => SKILLS.find((x) => x.id === s)?.label).join(', ') || '(chưa chọn)', step: 3 },
                    { label: 'Thời gian học', value: `${draft.dailyMinutes} phút/ngày, ${draft.daysPerWeek} ngày/tuần`, step: 4 },
                    { label: 'Chủ đề yêu thích', value: draft.topics.map((t) => TOPICS.find((x) => x.id === t)?.label).join(', ') || '(không có ưu tiên)', step: 5 },
                    { label: 'Phụ đề', value: SUBTITLE_MODES.find((m) => m.id === draft.subtitleMode)?.label || '(chưa chọn)', step: 6 },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-4 p-4 bg-[#F7F7F9] rounded-2xl border border-[#E7E7EA]">
                      <div>
                        <div className="text-xs font-bold text-[#8B9097] mb-0.5">{item.label}</div>
                        <div className="text-sm font-semibold text-[#18181B]">{item.value}</div>
                      </div>
                      <button
                        onClick={() => set('step', item.step)}
                        className="text-xs text-[#B91B1C] font-bold hover:underline shrink-0"
                      >
                        Sửa
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sticky footer nav */}
          <div className="sticky bottom-0 bg-white border-t border-[#E7E7EA] p-4 flex gap-3">
            {draft.step > 1 && (
              <button
                onClick={goBack}
                className="h-12 px-5 rounded-xl border border-[#E7E7EA] text-sm font-bold text-[#5F6368] hover:bg-[#F7F7F9] flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Quay lại
              </button>
            )}

            {draft.step < 7 && (
              <button
                onClick={goNext}
                disabled={!canContinue()}
                className="flex-1 h-12 rounded-xl bg-[#B91B1C] text-white text-sm font-bold hover:bg-[#A3181A] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                <span>Tiếp tục</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {draft.step === 7 && (
              <button
                onClick={showProposalPage}
                className="flex-1 h-12 rounded-xl bg-[#B91B1C] text-white text-sm font-bold hover:bg-[#A3181A] flex items-center justify-center gap-2 transition-colors"
              >
                <Sparkles className="w-4 h-4" style={{ fill: 'white' }} />
                <span>Nhận đề xuất lộ trình</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
