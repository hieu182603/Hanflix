import React, { useState } from 'react';
import { Play, Save, CheckCircle, Plus, Trash2, ArrowLeft, Volume2 } from 'lucide-react';
import { Lesson, SAMPLE_CUES, SAMPLE_QUIZ, Cue, QuizQuestion } from '../../data/hanflixData';

interface AdminVideoEditorProps {
  lesson: Lesson;
  onSaveAndPublish: (updatedLesson: Lesson) => void;
  onCancel: () => void;
}

export default function AdminVideoEditor({ lesson, onSaveAndPublish, onCancel }: AdminVideoEditorProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'cues' | 'quiz'>('cues');
  const [cues, setCues] = useState<Cue[]>(SAMPLE_CUES);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(SAMPLE_QUIZ.questions);
  const [titleVi, setTitleVi] = useState(lesson.titleVi);
  const [titleZh, setTitleZh] = useState(lesson.titleZh);

  const handleUpdateCue = (idx: number, field: keyof Cue, value: any) => {
    const updated = [...cues];
    updated[idx] = { ...updated[idx], [field]: value };
    setCues(updated);
  };

  const handleAddCue = () => {
    const newCue: Cue = {
      id: `cue-${Date.now()}`,
      start: cues.length > 0 ? cues[cues.length - 1].end : 0,
      end: (cues.length > 0 ? cues[cues.length - 1].end : 0) + 10,
      zh: '新句子',
      pinyin: 'Xīn jùzi',
      vi: 'Câu mới',
      tokens: []
    };
    setCues([...cues, newCue]);
  };

  const handleDeleteCue = (idx: number) => {
    setCues(cues.filter((_, i) => i !== idx));
  };

  const handlePublish = () => {
    onSaveAndPublish({
      ...lesson,
      titleVi,
      titleZh,
      status: 'published',
      contentReady: true
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E7E7EA] pb-4">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 rounded-xl border border-[#E7E7EA] text-[#5F6368] hover:bg-[#F7F7F9]">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-black text-[#18181B]">Biên tập Bài học: {titleVi}</h1>
            <p className="text-xs text-[#5F6368]">Kiểm duyệt phụ đề 3 lớp, gán từ vựng và câu hỏi trắc nghiệm trước khi xuất bản</p>
          </div>
        </div>

        <button
          onClick={handlePublish}
          className="px-6 py-2.5 rounded-xl bg-[#188A5A] hover:bg-[#15754a] text-white font-bold text-xs flex items-center gap-2 shadow-2xs"
        >
          <CheckCircle className="w-4 h-4" />
          <span>Duyệt & Đăng công khai</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E7E7EA] bg-white rounded-2xl p-1 gap-2 border">
        {[
          { id: 'cues', label: `Biên tập Phụ đề (${cues.length} câu)` },
          { id: 'quiz', label: `Câu hỏi Trắc nghiệm (${quizQuestions.length} câu)` },
          { id: 'info', label: 'Thông tin chung' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab.id ? 'bg-[#18181B] text-white shadow-xs' : 'text-[#5F6368] hover:text-[#18181B]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Subtitles Cue Editor */}
      {activeTab === 'cues' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-[#8B9097]">Danh sách các câu thoại trích xuất từ AI</span>
            <button
              onClick={handleAddCue}
              className="px-3.5 py-1.5 rounded-xl bg-[#FDF1F1] text-[#B91B1C] font-bold text-xs flex items-center gap-1.5 hover:bg-[#B91B1C] hover:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm câu thoại</span>
            </button>
          </div>

          <div className="space-y-3">
            {cues.map((cue, idx) => (
              <div key={cue.id} className="p-4 rounded-2xl bg-white border border-[#E7E7EA] space-y-3 shadow-2xs">
                <div className="flex items-center justify-between gap-3 text-xs font-mono text-[#8B9097]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#18181B]">Mốc thời gian:</span>
                    <input
                      type="number"
                      value={cue.start}
                      onChange={(e) => handleUpdateCue(idx, 'start', Number(e.target.value))}
                      className="w-16 p-1 border rounded bg-[#F7F7F9] text-center"
                    />
                    <span>s đến</span>
                    <input
                      type="number"
                      value={cue.end}
                      onChange={(e) => handleUpdateCue(idx, 'end', Number(e.target.value))}
                      className="w-16 p-1 border rounded bg-[#F7F7F9] text-center"
                    />
                    <span>s</span>
                  </div>

                  <button
                    onClick={() => handleDeleteCue(idx)}
                    className="p-1 text-[#8B9097] hover:text-[#B91B1C]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#8B9097] mb-1">Chữ Trung (Zh)</label>
                    <input
                      type="text"
                      value={cue.zh}
                      onChange={(e) => handleUpdateCue(idx, 'zh', e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#E7E7EA] font-mono text-sm font-bold text-[#18181B]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#8B9097] mb-1">Phiên âm Pinyin</label>
                    <input
                      type="text"
                      value={cue.pinyin}
                      onChange={(e) => handleUpdateCue(idx, 'pinyin', e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#E7E7EA] font-mono text-xs font-semibold text-[#B91B1C]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#8B9097] mb-1">Bản dịch Tiếng Việt</label>
                    <input
                      type="text"
                      value={cue.vi}
                      onChange={(e) => handleUpdateCue(idx, 'vi', e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#E7E7EA] text-xs font-medium text-[#18181B]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quiz Questions Editor */}
      {activeTab === 'quiz' && (
        <div className="space-y-4">
          <div className="space-y-3">
            {quizQuestions.map((q, idx) => (
              <div key={q.id} className="p-4 rounded-2xl bg-white border border-[#E7E7EA] space-y-2">
                <div className="text-xs font-bold text-[#B91B1C]">Câu hỏi {idx + 1} ({q.type})</div>
                <input
                  type="text"
                  value={q.promptVi}
                  onChange={(e) => {
                    const updated = [...quizQuestions];
                    updated[idx].promptVi = e.target.value;
                    setQuizQuestions(updated);
                  }}
                  className="w-full p-2.5 rounded-xl border border-[#E7E7EA] text-xs font-bold text-[#18181B]"
                />
                <div className="text-xs text-[#5F6368]">Giải thích: {q.explanationVi}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* General Info Editor */}
      {activeTab === 'info' && (
        <div className="space-y-5 max-w-2xl">
          <div className="bg-white rounded-2xl border border-[#E7E7EA] p-5 space-y-4">
            <h3 className="font-bold text-sm text-[#18181B]">Thông tin cơ bản</h3>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase text-[#8B9097]">Tiêu đề tiếng Việt *</label>
              <input
                type="text"
                value={titleVi}
                onChange={(e) => setTitleVi(e.target.value)}
                className="w-full p-3 rounded-xl border border-[#E7E7EA] text-sm font-semibold text-[#18181B] focus:border-[#B91B1C] outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase text-[#8B9097]">Tiêu đề tiếng Trung</label>
              <input
                type="text"
                value={titleZh}
                onChange={(e) => setTitleZh(e.target.value)}
                className="w-full p-3 rounded-xl border border-[#E7E7EA] text-sm font-mono font-bold text-[#18181B] focus:border-[#B91B1C] outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#8B9097] mb-1.5">Cấp độ HSK</label>
                <div className="p-3 rounded-xl border border-[#E7E7EA] text-sm bg-[#F7F7F9] text-[#5F6368]">
                  HSK {lesson.hsk}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#8B9097] mb-1.5">Trạng thái</label>
                <div className={`p-3 rounded-xl border text-sm font-bold ${
                  lesson.status === 'published' ? 'bg-[#F0FFF6] border-[#188A5A]/30 text-[#188A5A]' :
                  lesson.status === 'draft' ? 'bg-[#FFF8F0] border-[#E7A92F]/30 text-[#9A6A00]' :
                  'bg-[#F7F7F9] border-[#E7E7EA] text-[#5F6368]'
                }`}>
                  {lesson.status === 'published' ? 'Đã đăng' : lesson.status === 'draft' ? 'Bản nháp' : 'Đang xử lý'}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#8B9097] mb-1.5">Chủ đề</label>
              <div className="flex flex-wrap gap-2">
                {lesson.topics.map((t) => (
                  <span key={t} className="px-3 py-1 rounded-full bg-[#FDF1F1] text-[#B91B1C] text-xs font-bold">{t}</span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#8B9097] mb-1.5">Thumbnail</label>
              <div className="rounded-xl overflow-hidden border border-[#E7E7EA] bg-[#F7F7F9] aspect-video max-w-xs">
                <img
                  src={lesson.thumbnailAsset || 'https://picsum.photos/seed/thumb/320/180'}
                  alt="thumbnail"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/thumb/320/180'; }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
