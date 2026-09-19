import React, { useState, useRef } from 'react';
import {
  Upload,
  Video,
  FileVideo,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  X,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldAlert,
  Info,
  ExternalLink,
  RefreshCw,
  Cpu,
} from 'lucide-react';
import type { AdminLesson, ProcessingJob, ProcessingStatus, UploadProgressEvent } from '../../api/admin';

const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

// Unified 3-Tier Imperial & Scholar Palette
const HSK_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  2: { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  3: { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  4: { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  5: { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  6: { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  7: { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
  8: { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
  9: { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
};

const TOPIC_OPTIONS = [
  { id: 'daily-life', label: 'Đời sống thường nhật (Daily Life)' },
  { id: 'food', label: 'Ẩm thực & Nhà hàng (Food & Dining)' },
  { id: 'travel', label: 'Du lịch & Giao thông (Travel & Transport)' },
  { id: 'shopping', label: 'Mua sắm & Giá cả (Shopping & Market)' },
  { id: 'business', label: 'Công việc & Thương mại (Business & Work)' },
  { id: 'entertainment', label: 'Giải trí & Phim ảnh (Entertainment & Cinema)' },
];

export interface AdminVideoUploaderProps {
  activeTab: 'upload' | 'processing';
  onTabChange: (tab: 'upload' | 'processing' | 'editor' | 'videos') => void;
  titleVi: string;
  setTitleVi: (v: string) => void;
  titleZh: string;
  setTitleZh: (v: string) => void;
  descriptionVi: string;
  setDescriptionVi: (v: string) => void;
  hsk: number;
  setHsk: (v: number) => void;
  autoGenerateQuizCount: number | '';
  setAutoGenerateQuizCount: (v: number | '') => void;
  topic: string;
  setTopic: (v: string) => void;
  duration: number;
  setDuration: (v: number) => void;
  file: File | null;
  setFile: (f: File | null) => void;
  busy: boolean;
  uploadStage: 'idle' | 'presigning' | 'uploading' | 'confirming';
  uploadProgress: { percent: number; bytesSent: number; totalBytes: number };
  uploadError: string;
  onSubmitUpload: (e: React.FormEvent) => void;
  onCancelUpload: () => void;
  selectedLesson?: AdminLesson;
  processingStatus?: ProcessingStatus | null;
  jobs: ProcessingJob[];
  lessons: AdminLesson[];
  onSelectLesson: (id: string) => void;
  onRetryProcessing: (id: string) => Promise<void>;
  onCancelVideoUpload: (id: string) => Promise<void>;
}

export default function AdminVideoUploader({
  activeTab,
  onTabChange,
  titleVi,
  setTitleVi,
  titleZh,
  setTitleZh,
  descriptionVi,
  setDescriptionVi,
  hsk,
  setHsk,
  autoGenerateQuizCount,
  setAutoGenerateQuizCount,
  topic,
  setTopic,
  duration,
  setDuration,
  file,
  setFile,
  busy,
  uploadStage,
  uploadProgress,
  uploadError,
  onSubmitUpload,
  onCancelUpload,
  selectedLesson,
  processingStatus,
  jobs,
  lessons,
  onSelectLesson,
  onRetryProcessing,
  onCancelVideoUpload,
}: AdminVideoUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && ['video/mp4', 'video/webm'].includes(droppedFile.type)) {
      setFile(droppedFile);
      extractVideoDuration(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    if (selected) {
      setFile(selected);
      extractVideoDuration(selected);
    }
  };

  const extractVideoDuration = (videoFile: File) => {
    try {
      const url = URL.createObjectURL(videoFile);
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        const sec = Math.round(v.duration);
        if (sec >= 30 && sec <= 600) {
          setDuration(sec);
        }
      };
      v.src = url;
    } catch {
      // Ignore if browser fails metadata parse
    }
  };

  const formatFileSize = (bytes: number): string => {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  // Pipeline stages definition
  const PIPELINE_STAGES = [
    { key: 'upload', label: '1. Lưu Trữ R2', desc: 'Tải video lên Cloud' },
    { key: 'audio', label: '2. Tách Âm Thanh', desc: 'FFmpeg Audio Extract' },
    { key: 'speech', label: '3. Nhận Diện Lời Thoại', desc: 'Azure Speech ASR' },
    { key: 'subtitles', label: '4. Phân Đoạn & Dịch', desc: 'Cue Segmentation' },
    { key: 'review', label: '5. Sẵn Sàng Duyệt', desc: 'Ready for Review' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Navigation */}
      <div className="relative overflow-hidden rounded-3xl border border-[#F2E4D8] bg-white p-6 shadow-2xs">
        <div className="pointer-events-none absolute -right-6 -bottom-8 select-none font-serif text-8xl font-black text-[#B91B1C]/5">
          传
        </div>
        <div className="relative z-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FDF1F1] text-[#B91B1C] shadow-2xs ring-1 ring-[#B91B1C]/20">
              {activeTab === 'upload' ? <Upload className="h-5 w-5" /> : <Cpu className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-[#2B2826]">
                  {activeTab === 'upload' ? 'Tải Lên Video Bài Học' : 'Tiến Trình Xử Lý AI Pipeline'}
                </h1>
                <span className="rounded-full border border-[#F9D2D2] bg-[#FDF1F1] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#B91B1C]">
                  HSK 1 - 9
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#8C827A]">
                {activeTab === 'upload'
                  ? 'Chuẩn bị tệp video MP4/WebM, nhập thông tin bài học và kích hoạt chuỗi AI tự động trích xuất phụ đề song ngữ.'
                  : 'Theo dõi thời gian thực tiến trình bóc tách âm thanh, nhận diện Azure Speech ASR và phân đoạn câu thoại.'}
              </p>
            </div>
          </div>

          {/* View Switcher */}
          <div className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-[#F2E4D8] bg-[#FFF9F5] p-1.5 shadow-2xs">
            <button
              type="button"
              onClick={() => onTabChange('upload')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === 'upload'
                  ? 'border border-[#F2E4D8] bg-white text-[#2B2826] shadow-2xs'
                  : 'text-[#8C827A] hover:text-[#2B2826]'
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Tải video mới</span>
            </button>
            <button
              type="button"
              onClick={() => onTabChange('processing')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === 'processing'
                  ? 'bg-[#B91B1C] text-white shadow-2xs'
                  : 'text-[#8C827A] hover:text-[#2B2826]'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>Theo dõi tiến trình AI ({jobs.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: UPLOAD FORM & DRAG-AND-DROP                                        */}
      {/* ========================================================================= */}
      {activeTab === 'upload' && (
        <form onSubmit={onSubmitUpload} className="space-y-6">
          {/* Main 2-Column Bento Form */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column: Drag & Drop Zone & Video Specs */}
            <div className="space-y-4 lg:col-span-5">
              {/* Dropzone Card */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-6 text-center transition-all shadow-2xs ${
                  isDragOver
                    ? 'scale-[1.01] border-[#B91B1C] bg-[#FDF1F1]/60'
                    : file
                    ? 'border-[#188A5A] bg-[#EAF5F1]/40'
                    : 'border-[#F2E4D8] bg-[#FFFDFB] hover:border-[#B91B1C]/50 hover:bg-[#FFF9F5]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  aria-label="Video MP4/WebM"
                  accept="video/mp4,video/webm"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div
                  className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${
                    file
                      ? 'bg-[#EAF5F1] text-[#188A5A]'
                      : isDragOver
                      ? 'bg-[#B91B1C] text-white'
                      : 'border border-[#F2E4D8] bg-[#FFF9F5] text-[#8C827A]'
                  }`}
                >
                  {file ? <CheckCircle2 className="h-7 w-7" /> : <Upload className="h-7 w-7" />}
                </div>

                {file ? (
                  <div className="space-y-1">
                    <p className="max-w-[280px] truncate text-sm font-black text-[#2B2826]">{file.name}</p>
                    <p className="text-xs font-bold text-[#188A5A]">
                      {formatFileSize(file.size)} · {file.type.replace('video/', '').toUpperCase()}
                    </p>
                    <p className="mt-1 text-[11px] text-[#8C827A]">Bấm hoặc kéo thả tệp khác để thay thế</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-black text-[#2B2826]">Kéo thả video vào đây hoặc chọn tệp</p>
                    <p className="text-xs text-[#8C827A]">Hỗ trợ định dạng MP4 và WebM (tối đa 500 MB)</p>
                    <span className="mt-2 inline-block rounded-lg bg-[#2B2826] px-3.5 py-1.5 text-[11px] font-bold text-white shadow-2xs transition-colors hover:bg-[#1A1817]">
                      Chọn tệp video từ máy
                    </span>
                  </div>
                )}
              </div>

              {/* Technical Specifications Guide */}
              <div className="space-y-3 rounded-3xl border border-[#F2E4D8] bg-white p-5 text-xs shadow-2xs">
                <div className="flex items-center gap-2 font-black text-[#2B2826]">
                  <Info className="h-4 w-4 text-[#B91B1C]" />
                  <span>Tiêu chuẩn kỹ thuật video HanFlix</span>
                </div>
                <div className="space-y-2 text-[#5F5852]">
                  <div className="flex items-center justify-between border-b border-[#F2E4D8] pb-1.5">
                    <span>Độ phân giải khuyến nghị:</span>
                    <strong className="text-[#2B2826]">1080p (Full HD) hoặc 720p</strong>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#F2E4D8] pb-1.5">
                    <span>Tỉ lệ khung hình:</span>
                    <strong className="text-[#2B2826]">16:9 ngang chuẩn điện ảnh</strong>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#F2E4D8] pb-1.5">
                    <span>Thời lượng video bài học:</span>
                    <strong className="text-[#2B2826]">1 – 5 phút (60s – 300s)</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Chất lượng âm thanh:</span>
                    <strong className="text-[#188A5A]">Rõ thoại tiếng Trung bản xứ</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Metadata Form Fields */}
            <div className="space-y-4 lg:col-span-7">
              <div className="space-y-4 rounded-3xl border border-[#F2E4D8] bg-white p-6 shadow-2xs">
                <h3 className="border-b border-[#F2E4D8] pb-2 text-sm font-black text-[#2B2826]">
                  Thông tin bài học & Phân loại trình độ
                </h3>

                {/* Tiêu đề tiếng Việt */}
                <div>
                  <label htmlFor="video-title-vi" className="mb-1.5 block text-xs font-bold text-[#2B2826]">
                    Tiêu đề bài học (Tiếng Việt) <span className="text-[#B91B1C]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={160}
                    value={titleVi}
                    id="video-title-vi"
                    onChange={(e) => setTitleVi(e.target.value)}
                    placeholder="ví dụ: Đoạn trích phim: Lần đầu đi nhà hàng gọi món"
                    className="w-full rounded-xl border border-[#F2E4D8] bg-[#FFFDFB] px-3.5 py-2.5 text-xs font-bold text-[#2B2826] transition-colors outline-none focus:border-[#B91B1C] focus:ring-2 focus:ring-[#B91B1C]/10"
                  />
                </div>

                {/* Tiêu đề tiếng Trung */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#2B2826]">
                    Tiêu đề nguyên bản tiếng Trung (Hán tự)
                  </label>
                  <input
                    type="text"
                    value={titleZh}
                    onChange={(e) => setTitleZh(e.target.value)}
                    placeholder="ví dụ: 电影剪辑：第一次在餐厅点餐"
                    className="w-full rounded-xl border border-[#F2E4D8] bg-[#FFFDFB] px-3.5 py-2.5 font-serif text-sm font-bold text-[#2B2826] transition-colors outline-none focus:border-[#B91B1C] focus:ring-2 focus:ring-[#B91B1C]/10"
                  />
                </div>

                {/* Mô tả nội dung */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="video-description" className="text-xs font-bold text-[#2B2826]">
                      Mô tả nội dung bài học <span className="text-[#B91B1C]">*</span>
                    </label>
                    <span className="text-[10px] text-[#8C827A]">{descriptionVi.length}/1000 ký tự</span>
                  </div>
                  <textarea
                    id="video-description"
                    rows={3}
                    required
                    minLength={10}
                    maxLength={1000}
                    value={descriptionVi}
                    onChange={(e) => setDescriptionVi(e.target.value)}
                    placeholder="Tóm tắt ngắn gọn tình huống trong video, từ khóa chính và mẫu câu đàm thoại người học sẽ học được..."
                    className="w-full resize-none rounded-xl border border-[#F2E4D8] bg-[#FFFDFB] p-3 text-xs leading-relaxed text-[#2B2826] transition-colors outline-none focus:border-[#B91B1C] focus:ring-2 focus:ring-[#B91B1C]/10"
                  />
                </div>

                {/* Cấp độ HSK (1-9 Pills) */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#2B2826]">
                    Cấp độ HSK 3.0 mục tiêu <span className="text-[#B91B1C]">*</span>
                  </label>
                  <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-9">
                    {HSK_LEVELS.map((level) => {
                      const isSelected = hsk === level;
                      const styling = HSK_COLORS[level];
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setHsk(level)}
                          className={`rounded-xl border py-2 text-xs font-black transition-all ${
                            isSelected
                              ? 'border-transparent bg-[#B91B1C] text-white shadow-xs ring-2 ring-[#B91B1C]'
                              : `${styling.bg} ${styling.text} ${styling.border} hover:opacity-85`
                          }`}
                        >
                          H{level}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Số câu hỏi tự động tạo cho AI Quiz (tùy chọn) */}
                <div className="rounded-xl border border-dashed border-[#F2E4D8] bg-[#FFFAF3] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <label className="mb-0.5 flex items-center gap-1.5 text-xs font-bold text-[#2B2826]">
                        <Sparkles size={12} className="text-[#B45309]" />
                        Số câu hỏi AI Quiz
                      </label>
                      <p className="text-[11px] leading-relaxed text-[#7A6F66]">
                        Để trống = theo HSK (1-2: 3 câu, 3-4: 5, 5-6: 6, 7-9: 7). Nhập 1-15 để override.
                      </p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={15}
                      placeholder="Số"
                      value={autoGenerateQuizCount}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') return setAutoGenerateQuizCount('');
                        const n = parseInt(raw, 10);
                        if (!Number.isFinite(n)) return;
                        setAutoGenerateQuizCount(Math.min(15, Math.max(1, n)));
                      }}
                      className="w-28 rounded-lg border border-[#F2E4D8] bg-white px-2.5 py-2 text-center text-xs font-bold text-[#2B2826] outline-none transition-colors focus:border-[#B91B1C] focus:ring-2 focus:ring-[#B91B1C]/10"
                    />
                  </div>
                </div>

                {/* Chủ đề & Thời lượng */}
                <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#2B2826]">Chủ đề bài học</label>
                    <select
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full cursor-pointer rounded-xl border border-[#F2E4D8] bg-[#FFFDFB] px-3 py-2.5 text-xs font-bold text-[#2B2826] outline-none transition-colors focus:border-[#B91B1C]"
                    >
                      {TOPIC_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-xs font-bold text-[#2B2826]">Thời lượng video (giây)</label>
                      <span className="text-[11px] font-bold text-[#188A5A]">≈ {formatTime(duration)}</span>
                    </div>
                    <input
                      type="number"
                      required
                      min={30}
                      max={600}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#F2E4D8] bg-[#FFFDFB] px-3 py-2 text-xs font-bold text-[#2B2826] outline-none transition-colors focus:border-[#B91B1C]"
                    />
                  </div>
                </div>
              </div>

              {/* Upload In-Flight Progress Widget */}
              {uploadStage !== 'idle' && (
                <div className="space-y-3 rounded-3xl border border-[#F2E4D8] bg-white p-5 shadow-2xs animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-black text-[#2B2826]">
                      <RefreshCw className="h-4 w-4 animate-spin text-[#B91B1C]" />
                      {uploadStage === 'presigning' && 'Đang xin mã cấp quyền tải lên Cloudflare R2...'}
                      {uploadStage === 'uploading' && `Đang truyền luồng video lên R2 (${uploadProgress.percent}%)`}
                      {uploadStage === 'confirming' && 'Đang xác nhận tệp và khởi động AI Pipeline...'}
                    </span>
                    {uploadStage === 'uploading' && (
                      <button
                        type="button"
                        onClick={onCancelUpload}
                        className="rounded-lg border border-[#F9D2D2] bg-[#FDF1F1] px-2.5 py-1 text-[11px] font-bold text-[#B91B1C] transition-colors hover:bg-[#FCE8E8]"
                      >
                        Hủy tải lên
                      </button>
                    )}
                  </div>

                  {uploadStage === 'uploading' && (
                    <div className="space-y-1.5">
                      <div className="h-2.5 w-full overflow-hidden rounded-full border border-[#F2E4D8] bg-[#FFF9F5]">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-[#B91B1C] via-[#B45309] to-[#188A5A] transition-all duration-300"
                          style={{ width: `${uploadProgress.percent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#8C827A]">
                        <span>Đã tải: {formatFileSize(uploadProgress.bytesSent)}</span>
                        <span>Tổng dung lượng: {formatFileSize(uploadProgress.totalBytes)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {uploadError && (
                <div className="flex items-center gap-2 rounded-2xl border border-[#F9D2D2] bg-[#FDF1F1] p-4 text-xs font-bold text-[#B91B1C]">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Action Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={busy || !file}
                  className="flex h-12 items-center gap-2 rounded-2xl bg-linear-to-r from-[#B91B1C] to-[#991415] px-6 text-xs font-black text-white shadow-md transition-all hover:from-[#A3181A] hover:to-[#881112] active:scale-[0.98] disabled:opacity-40"
                >
                  <Upload className="h-4 w-4" />
                  <span>{busy ? 'Đang xử lý tải video...' : 'Tạo Bài Học & Khởi Động AI Pipeline'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: AI PROCESSING PIPELINE TRACKER                                     */}
      {/* ========================================================================= */}
      {activeTab === 'processing' && (
        <div className="space-y-6">
          {/* Active Lesson Progress Card */}
          {selectedLesson ? (
            <div className="space-y-6 rounded-3xl border border-[#F2E4D8] bg-white p-6 shadow-2xs">
              <div className="flex flex-col justify-between gap-3 border-b border-[#F2E4D8] pb-4 sm:flex-row sm:items-center">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded bg-[#2B2826] px-2 py-0.5 text-[10px] font-black text-white">
                      HSK {selectedLesson.hsk}
                    </span>
                    <span className="text-xs text-[#8C827A]">{formatTime(selectedLesson.durationSeconds)}</span>
                  </div>
                  <h2 className="text-xl font-black text-[#2B2826]">{selectedLesson.titleVi}</h2>
                  {selectedLesson.titleZh && (
                    <p className="mt-0.5 font-serif text-xs text-[#8C827A]">{selectedLesson.titleZh}</p>
                  )}
                </div>

                {/* Status Action Buttons */}
                <div className="flex shrink-0 items-center gap-2">
                  {selectedLesson.status === 'ready_for_review' && (
                    <button
                      type="button"
                      onClick={() => onTabChange('editor')}
                      className="flex h-10 items-center gap-2 rounded-xl bg-[#188A5A] px-5 text-xs font-black text-white shadow-2xs transition-all hover:bg-[#137333] active:scale-[0.98]"
                    >
                      <span>Kiểm Tra & Biên Tập Phụ Đề</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}

                  {selectedLesson.status === 'failed' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRetryProcessing(selectedLesson._id)}
                      className="flex h-10 items-center gap-2 rounded-xl bg-[#B91B1C] px-4 text-xs font-bold text-white shadow-2xs transition-all hover:bg-[#A3181A] active:scale-[0.98]"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>Thử lại tiến trình</span>
                    </button>
                  )}

                  {selectedLesson.status === 'uploading' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onCancelVideoUpload(selectedLesson._id)}
                      className="h-10 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-4 text-xs font-bold text-[#B91B1C] transition-colors hover:bg-[#FDF1F1]"
                    >
                      Hủy tải lên
                    </button>
                  )}
                </div>
              </div>

              {/* 5-Stage Stepper Tracker */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#2B2826]">
                  <span>Quy trình xử lý AI tự động:</span>
                  <span className="text-[#B91B1C]">
                    Tiến độ: {processingStatus?.stageProgress ?? selectedLesson.processingProgress ?? 0}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {PIPELINE_STAGES.map((st, i) => {
                    const currentProgress = processingStatus?.stageProgress ?? selectedLesson.processingProgress ?? 0;
                    const completed = processingStatus?.status === 'completed' || selectedLesson.status === 'ready_for_review' || selectedLesson.status === 'published';
                    const failed = processingStatus?.status === 'failed' || selectedLesson.status === 'failed';
                    const queued = processingStatus?.status === 'queued';
                    const stageIndex = currentProgress < 10 ? 0 : currentProgress < 35 ? 1 : currentProgress < 60 ? 2 : 3;
                    const isPassed = completed || i < stageIndex;
                    const isCurrent = !completed && i === stageIndex;

                    return (
                      <div
                        key={st.key}
                        className={`rounded-2xl border p-3.5 transition-all ${
                          isPassed
                            ? 'border-[#C6E7DA] bg-[#EAF5F1] text-[#188A5A]'
                            : isCurrent
                            ? 'border-[#FDE6BA] bg-[#FFF8EC] text-[#B45309] ring-2 ring-[#F59E0B]'
                            : 'border-[#F2E4D8] bg-[#FFFDFB] text-[#8C827A]'
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-mono text-[10px] font-black">BƯỚC 0{i + 1}</span>
                          {isPassed ? (
                            <CheckCircle2 className="h-4 w-4 text-[#188A5A]" />
                          ) : isCurrent && failed ? (
                            <AlertCircle className="h-4 w-4 text-[#B91B1C]" />
                          ) : isCurrent && !queued ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#B45309]" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-[#8C827A]" />
                          )}
                        </div>
                        <div className="text-xs font-bold">{st.label}</div>
                        <div className="mt-0.5 text-[10px] opacity-80">{st.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Error Box if Failed */}
              {selectedLesson.processingError && (
                <div className="flex items-center gap-2 rounded-2xl border border-[#F9D2D2] bg-[#FDF1F1] p-4 text-xs font-bold text-[#B91B1C]">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-black">Lỗi trong quá trình xử lý AI:</p>
                    <p className="mt-0.5 font-normal">{selectedLesson.processingError}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-[#F2E4D8] bg-white p-8 text-center text-[#8C827A] shadow-2xs">
              <Layers className="mx-auto mb-2 h-8 w-8 text-[#D8C7B8]" />
              <p className="text-xs font-bold text-[#2B2826]">Chưa chọn video để xem chi tiết tiến trình</p>
              <p className="mt-0.5 text-[11px] text-[#8C827A]">
                Bấm vào một tác vụ bên dưới hoặc quay lại danh sách video để theo dõi.
              </p>
            </div>
          )}

          {/* Background Jobs List */}
          <div className="overflow-hidden rounded-3xl border border-[#F2E4D8] bg-white shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#F2E4D8] px-5 py-4">
              <h3 className="text-sm font-black text-[#2B2826]">Hàng đợi xử lý tác vụ nền ({jobs.length})</h3>
              <span className="text-[11px] text-[#8C827A]">Tự động cập nhật mỗi 5 giây</span>
            </div>

            {jobs.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#8C827A]">
                Hiện không có tác vụ nào đang chạy trong hàng đợi.
              </div>
            ) : (
              <div className="divide-y divide-[#F2E4D8]">
                {jobs.map((job) => {
                  const lesson = lessons.find((l) => l._id === job.lessonId);
                  return (
                    <div
                      key={job._id}
                      onClick={() => onSelectLesson(job.lessonId)}
                      className="flex cursor-pointer items-center justify-between gap-4 p-4 transition-colors hover:bg-[#FFF9F5]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] text-[#5F5852]">
                          <Video className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[#2B2826]">
                            {lesson?.titleVi || `Bài học #${job.lessonId.slice(-6)}`}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#8C827A]">
                            Giai đoạn: <strong className="text-[#2B2826]">{job.stage}</strong> · Tiến độ:{' '}
                            <strong className="text-[#B91B1C]">{job.stageProgress}%</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${
                            job.status === 'completed'
                              ? 'border-[#C6E7DA] bg-[#EAF5F1] text-[#188A5A]'
                              : job.status === 'running'
                              ? 'border-[#FDE6BA] bg-[#FFF8EC] text-[#B45309]'
                              : job.status === 'failed'
                              ? 'border-[#F9D2D2] bg-[#FDF1F1] text-[#B91B1C]'
                              : 'border-[#F2E4D8] bg-[#FFF9F5] text-[#8C827A]'
                          }`}
                        >
                          {job.status}
                        </span>
                        <ArrowRight className="h-4 w-4 text-[#D8C7B8]" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
