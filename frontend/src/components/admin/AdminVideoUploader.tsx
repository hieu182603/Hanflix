import React, { useState, useRef, useEffect } from 'react';
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
  ChevronDown,
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
  onEditLesson?: (id: string) => void;
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
  onEditLesson,
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

  // Cleanup any lingering legacy portal element from document body
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const oldPortal = document.getElementById('hanflix-fab-root');
    if (oldPortal) oldPortal.remove();
  }, []);

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
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${activeTab === 'upload'
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
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${activeTab === 'processing'
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

      {/* Upload In-Flight Progress Bar (Top - spans both tabs) */}
      {uploadStage !== 'idle' && (
        <div className="overflow-hidden rounded-2xl border border-[#F2E4D8] bg-white shadow-2xs animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F2E4D8] bg-[#FFF9F5] px-5 py-3 text-xs">
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

          <div className="px-5 py-3">
            <div className="h-2.5 w-full overflow-hidden rounded-full border border-[#F2E4D8] bg-[#FFF9F5]">
              <div
                className={`h-full rounded-full transition-all duration-300 ${uploadStage === 'uploading'
                  ? 'bg-linear-to-r from-[#B91B1C] via-[#B45309] to-[#188A5A]'
                  : uploadStage === 'confirming'
                    ? 'bg-[#188A5A]'
                    : 'bg-[#B45309] animate-pulse'
                  }`}
                style={{ width: `${uploadStage === 'uploading' ? uploadProgress.percent : uploadStage === 'confirming' ? 100 : 5}%` }}
              />
            </div>
            {uploadStage === 'uploading' && (
              <div className="mt-2 flex items-center justify-between text-[11px] text-[#8C827A]">
                <span>Đã tải: {formatFileSize(uploadProgress.bytesSent)}</span>
                <span>Tổng dung lượng: {formatFileSize(uploadProgress.totalBytes)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: UPLOAD FORM & DRAG-AND-DROP                                        */}
      {/* ========================================================================= */}
      {activeTab === 'upload' && (
        <form id="admin-video-uploader-form" onSubmit={onSubmitUpload} className="space-y-6">
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
                className={`flex min-h-[340px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition-all shadow-2xs ${isDragOver
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
                  className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${file
                    ? 'bg-[#EAF5F1] text-[#188A5A]'
                    : isDragOver
                      ? 'bg-[#B91B1C] text-white'
                      : 'border border-[#F2E4D8] bg-[#FFF9F5] text-[#8C827A]'
                    }`}
                >
                  {file ? <CheckCircle2 className="h-7 w-7" /> : <Upload className="h-7 w-7" />}
                </div>

                {file ? (
                  <div className="space-y-1.5">
                    <p className="max-w-[280px] truncate text-sm font-black text-[#2B2826]">{file.name}</p>
                    <p className="text-xs font-bold text-[#188A5A]">
                      {formatFileSize(file.size)} · {file.type.replace('video/', '').toUpperCase()}
                    </p>
                    <p className="mt-1 text-[11px] text-[#8C827A]">Bấm hoặc kéo thả tệp khác để thay thế</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-sm font-black text-[#2B2826]">Kéo thả video vào đây hoặc chọn tệp</p>
                    <p className="text-xs text-[#8C827A]">Hỗ trợ định dạng MP4 và WebM (tối đa 500 MB)</p>
                    <span className="mt-3 inline-block rounded-xl bg-[#2B2826] px-4 py-2 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-[#1A1817]">
                      Chọn tệp video từ máy
                    </span>
                  </div>
                )}
              </div>

              {/* Technical Specifications Guide */}
              <div className="rounded-3xl border border-[#F2E4D8] bg-white p-4 text-[11px] shadow-2xs">
                <div className="mb-2.5 flex items-center gap-1.5 font-black text-[#2B2826]">
                  <Info className="h-3.5 w-3.5 text-[#B91B1C]" />
                  <span>Tiêu chuẩn kỹ thuật video HanFlix</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5 text-[#5F5852]">
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-[#FFF9F5] px-2.5 py-1.5">
                    <span className="shrink-0">Độ phân giải</span>
                    <strong className="text-right text-[#2B2826]">1080p / 720p</strong>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-[#FFF9F5] px-2.5 py-1.5">
                    <span className="shrink-0">Tỉ lệ khung hình</span>
                    <strong className="text-right text-[#2B2826]">16:9</strong>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-[#FFF9F5] px-2.5 py-1.5">
                    <span className="shrink-0">Thời lượng</span>
                    <strong className="text-right text-[#2B2826]">60s – 300s</strong>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-[#EAF5F1]/40 px-2.5 py-1.5">
                    <span className="shrink-0">Âm thanh</span>
                    <strong className="text-right text-[#188A5A]">Tiếng Trong rõ</strong>
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
                    rows={2}
                    required
                    minLength={10}
                    maxLength={1000}
                    value={descriptionVi}
                    onChange={(e) => setDescriptionVi(e.target.value)}
                    placeholder="Tóm tắt ngắn gọn tình huống trong video, từ khóa chính và mẫu câu đàm thoại người học sẽ học được..."
                    className="w-full resize-none rounded-xl border border-[#F2E4D8] bg-[#FFFDFB] p-2.5 text-xs leading-relaxed text-[#2B2826] transition-colors outline-none focus:border-[#B91B1C] focus:ring-2 focus:ring-[#B91B1C]/10"
                  />
                </div>

                {/* Hàng kết hợp: Cấp độ HSK (Dropdown), Chủ đề (Dropdown) & Thời lượng (giây) */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  {/* Cấp độ HSK 3.0 Dropdown */}
                  <div className="sm:col-span-4">
                    <label htmlFor="video-hsk-select" className="mb-1.5 block text-xs font-bold text-[#2B2826]">
                      Cấp độ HSK 3.0 <span className="text-[#B91B1C]">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="video-hsk-select"
                        value={hsk}
                        onChange={(e) => setHsk(Number(e.target.value))}
                        className="w-full cursor-pointer appearance-none rounded-xl border border-[#F2E4D8] bg-[#FFFDFB] px-3 py-2 pr-8 text-xs font-black text-[#2B2826] outline-none transition-colors focus:border-[#B91B1C] focus:ring-2 focus:ring-[#B91B1C]/10"
                      >
                        {HSK_LEVELS.map((level) => (
                          <option key={level} value={level}>
                            HSK {level} {level <= 3 ? '(Sơ cấp)' : level <= 6 ? '(Trung cấp)' : '(Cao cấp)'}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#8C827A]">
                        <ChevronDown className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>

                  {/* Chủ đề bài học Dropdown */}
                  <div className="sm:col-span-5">
                    <label htmlFor="video-topic-select" className="mb-1.5 block text-xs font-bold text-[#2B2826]">
                      Chủ đề bài học
                    </label>
                    <div className="relative">
                      <select
                        id="video-topic-select"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="w-full cursor-pointer appearance-none rounded-xl border border-[#F2E4D8] bg-[#FFFDFB] px-3 py-2 pr-8 text-xs font-bold text-[#2B2826] outline-none transition-colors focus:border-[#B91B1C] focus:ring-2 focus:ring-[#B91B1C]/10"
                      >
                        {TOPIC_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#8C827A]">
                        <ChevronDown className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>

                  {/* Thời lượng video */}
                  <div className="sm:col-span-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="video-duration" className="text-xs font-bold text-[#2B2826]">
                        Thời lượng (giây)
                      </label>
                      <span className="text-[10px] font-black text-[#188A5A]">≈ {formatTime(duration)}</span>
                    </div>
                    <input
                      id="video-duration"
                      type="number"
                      required
                      min={30}
                      max={600}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#F2E4D8] bg-[#FFFDFB] px-3 py-2 text-xs font-bold text-[#2B2826] outline-none transition-colors focus:border-[#B91B1C] focus:ring-2 focus:ring-[#B91B1C]/10"
                    />
                  </div>
                </div>

                {/* Số câu hỏi tự động tạo cho AI Quiz (tùy chọn) - Thanh ngang gọn gàng */}
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[#F2E4D8] bg-[#FFFAF3] px-3.5 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[#FDE6BA] bg-[#FFF8EC] text-[#B45309]">
                      <Sparkles className="h-3 w-3" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-[#2B2826]">Số câu hỏi AI Quiz:</span>
                      <span className="ml-1.5 text-[11px] text-[#7A6F66] hidden sm:inline">
                        để trống = tự động theo HSK (3 – 7 câu). Hoặc nhập 1 – 15
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min={1}
                      max={15}
                      placeholder="Tự động"
                      value={autoGenerateQuizCount}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') return setAutoGenerateQuizCount('');
                        const n = parseInt(raw, 10);
                        if (!Number.isFinite(n)) return;
                        setAutoGenerateQuizCount(Math.min(15, Math.max(1, n)));
                      }}
                      className="w-24 rounded-lg border border-[#F2E4D8] bg-white px-2 py-1 text-center text-xs font-bold text-[#2B2826] outline-none transition-colors focus:border-[#B91B1C] focus:ring-2 focus:ring-[#B91B1C]/10"
                    />
                    <span className="text-[11px] font-bold text-[#8C827A]">câu</span>
                  </div>
                </div>

                {/* Error Message */}
                {uploadError && (
                  <div className="flex items-center gap-2 rounded-2xl border border-[#F9D2D2] bg-[#FDF1F1] p-4 text-xs font-bold text-[#B91B1C]">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Form Action & Launch Footer */}
                <div className="border-t border-[#F2E4D8] pt-4 mt-2">
                  {/* Primary Action Button */}
                  <button
                    type="submit"
                    disabled={busy || !file}
                    className={`group relative flex h-12 w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-6 text-xs font-black uppercase tracking-[0.08em] transition-all duration-200 select-none cursor-pointer ${busy || !file
                      ? 'bg-[#EFE9E2] text-[#9E948B] border border-[#E2DAD0] cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-[#B91B1C] via-[#B91B1C] to-[#991415] text-white shadow-[0_8px_20px_-4px_rgba(185,27,28,0.42),inset_0_1px_0_rgba(255,255,255,0.22)] hover:from-[#A3181A] hover:to-[#831112] hover:shadow-[0_12px_28px_-4px_rgba(185,27,28,0.52)] active:scale-[0.985] active:translate-y-px'
                      }`}
                  >
                    {/* Shimmer sweep */}
                    {!busy && file && (
                      <span
                        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                        aria-hidden
                      />
                    )}

                    {busy ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin text-white" />
                        <span>Đang xử lý tải video…</span>
                      </>
                    ) : !file ? (
                      <>
                        <Upload className="h-4 w-4 text-[#9E948B]" />
                        <span>Tạo Bài Học & Khởi Động AI</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-[#FDE6BA] transition-transform duration-300 group-hover:rotate-12" />
                        <span>Tạo Bài Học & Khởi Động AI</span>
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </>
                    )}
                  </button>
                </div>
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
                  {(selectedLesson.status === 'ready_for_review' ||
                    selectedLesson.status === 'published' ||
                    processingStatus?.status === 'completed') && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onEditLesson) {
                          onEditLesson(selectedLesson._id);
                        } else {
                          onTabChange('editor');
                        }
                      }}
                      className="flex h-10 items-center gap-2 rounded-xl bg-[#188A5A] px-5 text-xs font-black text-white shadow-2xs transition-all hover:bg-[#137333] active:scale-[0.98] cursor-pointer"
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
                    Tiến độ: {uploadStage === 'uploading' && selectedLesson.status === 'uploading'
                      ? `Đang lưu trữ R2 (${uploadProgress.percent}%)`
                      : `${processingStatus?.stageProgress ?? selectedLesson.processingProgress ?? 0}%`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {PIPELINE_STAGES.map((st, i) => {
                    const isUploadingR2 = uploadStage !== 'idle' && selectedLesson.status === 'uploading';
                    const currentProgress = isUploadingR2 ? 0 : (processingStatus?.stageProgress ?? selectedLesson.processingProgress ?? 0);
                    const completed = !isUploadingR2 && (processingStatus?.status === 'completed' || selectedLesson.status === 'ready_for_review' || selectedLesson.status === 'published');
                    const failed = processingStatus?.status === 'failed' || selectedLesson.status === 'failed';
                    const queued = processingStatus?.status === 'queued';
                    const stageIndex = isUploadingR2 ? 0 : (currentProgress < 10 ? 0 : currentProgress < 35 ? 1 : currentProgress < 60 ? 2 : 3);
                    const isPassed = !isUploadingR2 && (completed || i < stageIndex || (i === 0 && selectedLesson.status !== 'uploading'));
                    const isCurrent = isUploadingR2 ? (i === 0) : (!completed && i === stageIndex);

                    return (
                      <div
                        key={st.key}
                        className={`rounded-2xl border p-3.5 transition-all ${isPassed
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
                        <div className="mt-0.5 text-[10px] opacity-80">
                          {i === 0 && isUploadingR2
                            ? `Đang tải: ${uploadProgress.percent}%`
                            : st.desc}
                        </div>
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
                  const isSelected = selectedLesson?._id === job.lessonId;
                  return (
                    <div
                      key={job._id}
                      onClick={() => onSelectLesson(job.lessonId)}
                      className={`flex cursor-pointer items-center justify-between gap-4 p-4 transition-all ${
                        isSelected
                          ? 'border-l-4 border-l-[#B91B1C] bg-[#FFF8EC]'
                          : 'hover:bg-[#FFF9F5]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                            isSelected
                              ? 'border-[#FDE6BA] bg-white text-[#B91B1C]'
                              : 'border-[#F2E4D8] bg-[#FFF9F5] text-[#5F5852]'
                          }`}
                        >
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
                        {isSelected && (
                          <span className="rounded-full bg-[#B91B1C]/10 px-2 py-0.5 text-[10px] font-black text-[#B91B1C]">
                            Đang xem
                          </span>
                        )}
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${job.status === 'completed'
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
