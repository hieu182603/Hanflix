import React, { useState } from 'react';
import { Upload, FileVideo, ArrowRight, X, AlertCircle } from 'lucide-react';
import { TOPICS } from '../../data/hanflixData';

interface AdminVideoUploadProps {
  onStartProcessing: (newLessonData: {
    titleVi: string;
    titleZh: string;
    hsk: number;
    topics: string[];
    descriptionVi: string;
    fileName: string;
  }) => void;
  onCancel: () => void;
}

export default function AdminVideoUpload({ onStartProcessing, onCancel }: AdminVideoUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [titleVi, setTitleVi] = useState('');
  const [titleZh, setTitleZh] = useState('');
  const [hsk, setHsk] = useState(3);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(['food']);
  const [descriptionVi, setDescriptionVi] = useState('');
  const [simulatedFileName, setSimulatedFileName] = useState('Lesson_Video_Sample.mp4');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleVi) return;

    onStartProcessing({
      titleVi,
      titleZh: titleZh || '新课 (Bài học mới)',
      hsk,
      topics: selectedTopics,
      descriptionVi,
      fileName: file ? file.name : simulatedFileName
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-[#E7E7EA] pb-4">
        <div>
          <h1 className="text-2xl font-black text-[#18181B]">Thêm Video Bài Học Mới</h1>
          <p className="text-xs text-[#5F6368] mt-1">Tải lên video MP4/WebM để tự động trích xuất phụ đề Pinyin & tiếng Việt qua AI</p>
        </div>
        <button onClick={onCancel} className="p-2 rounded-xl text-[#5F6368] hover:bg-[#E7E7EA]">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-3xl border border-[#E7E7EA]">
        {/* Upload Dropzone */}
        <div className="border-2 border-dashed border-[#E7E7EA] hover:border-[#B91B1C] rounded-2xl p-8 text-center bg-[#F7F7F9] transition-colors cursor-pointer">
          <Upload className="w-10 h-10 text-[#B91B1C] mx-auto mb-3" />
          <div className="text-sm font-bold text-[#18181B]">
            {file ? file.name : 'Kéo thả tệp video MP4/WebM vào đây'}
          </div>
          <p className="text-xs text-[#8B9097] mt-1">Thời lượng khuyến nghị: 1 - 5 phút (Tối đa 100MB)</p>
          <input
            type="file"
            accept="video/mp4,video/webm"
            onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
            className="hidden"
            id="video-file-input"
          />
          <label
            htmlFor="video-file-input"
            className="mt-4 inline-block px-4 py-2 bg-white border border-[#E7E7EA] rounded-xl text-xs font-bold text-[#18181B] cursor-pointer hover:bg-[#F7F7F9]"
          >
            Chọn file từ máy tính
          </label>
        </div>

        {/* Metadata Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-extrabold uppercase text-[#18181B] mb-1">
              Tên bài học (Tiếng Việt) *
            </label>
            <input
              type="text"
              required
              placeholder="VD: Gọi cà phê và dặn khẩu vị ít đường"
              value={titleVi}
              onChange={(e) => setTitleVi(e.target.value)}
              className="w-full p-3 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] text-xs font-medium outline-none focus:border-[#B91B1C] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase text-[#18181B] mb-1">
              Tên bài học (Chữ Trung giản thể)
            </label>
            <input
              type="text"
              placeholder="VD: 点咖啡 (Diǎn kāfēi)"
              value={titleZh}
              onChange={(e) => setTitleZh(e.target.value)}
              className="w-full p-3 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] text-xs font-medium outline-none focus:border-[#B91B1C] focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold uppercase text-[#18181B] mb-1">
                Trình độ HSK
              </label>
              <select
                value={hsk}
                onChange={(e) => setHsk(Number(e.target.value))}
                className="w-full p-3 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] text-xs font-bold outline-none"
              >
                {[1, 2, 3, 4, 5, 6].map((l) => (
                  <option key={l} value={l}>HSK {l}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-[#18181B] mb-1">
                Chủ đề chính
              </label>
              <select
                value={selectedTopics[0]}
                onChange={(e) => setSelectedTopics([e.target.value])}
                className="w-full p-3 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] text-xs font-bold outline-none"
              >
                {TOPICS.map((t) => (
                  <option key={t.id} value={t.id}>{t.labelVi}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase text-[#18181B] mb-1">
              Mô tả tình huống
            </label>
            <textarea
              rows={3}
              placeholder="Mô tả nội dung bài học giúp người học nắm bắt bối cảnh..."
              value={descriptionVi}
              onChange={(e) => setDescriptionVi(e.target.value)}
              className="w-full p-3 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] text-xs font-medium outline-none focus:border-[#B91B1C] focus:bg-white"
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[#E7E7EA]">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-[#E7E7EA] text-xs font-bold text-[#5F6368] hover:bg-[#F7F7F9]"
          >
            Hủy bỏ
          </button>

          <button
            type="submit"
            disabled={!titleVi}
            className="px-6 py-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] disabled:opacity-40 text-white text-xs font-bold shadow-2xs flex items-center gap-2"
          >
            <span>Bắt đầu xử lý AI ASR</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
