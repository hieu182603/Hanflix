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

const HSK_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-[#E6F4EA]', text: 'text-[#137333]', border: 'border-[#CEEAD6]' },
  2: { bg: 'bg-[#E8F0FE]', text: 'text-[#1A73E8]', border: 'border-[#D2E3FC]' },
  3: { bg: 'bg-[#F3E8FD]', text: 'text-[#9334E6]', border: 'border-[#E9D5FF]' },
  4: { bg: 'bg-[#FEF7E0]', text: 'text-[#B06000]', border: 'border-[#FEEFC3]' },
  5: { bg: 'bg-[#FFF0E6]', text: 'text-[#EA580C]', border: 'border-[#FED7AA]' },
  6: { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#FAD2CF]' },
  7: { bg: 'bg-[#F1F5F9]', text: 'text-[#475569]', border: 'border-[#CBD5E1]' },
  8: { bg: 'bg-[#F8FAFC]', text: 'text-[#334155]', border: 'border-[#94A3B8]' },
  9: { bg: 'bg-[#0F172A]', text: 'text-white', border: 'border-[#1E293B]' },
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
    { key: 'whisper', label: '3. Nhận Diện Lời Thoại', desc: 'Whisper AI ASR' },
    { key: 'subtitles', label: '4. Phân Đoạn & Dịch', desc: 'Cue Segmentation' },
    { key: 'review', label: '5. Sẵn Sàng Duyệt', desc: 'Ready for Review' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Navigation */}
      <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FDF1F1] text-[#B91B1C] flex items-center justify-center font-bold">
              {activeTab === 'upload' ? <Upload className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-[#18181B] tracking-tight">
                  {activeTab === 'upload' ? 'Tải Lên Video Bài Học' : 'Tiến Trình Xử Lý AI Pipeline'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-[#FDF1F1] text-[#B91B1C] text-[11px] font-black uppercase tracking-wider">
                  HSK 1 - 9
                </span>
              </div>
              <p className="text-xs text-[#5F6368] mt-0.5">
                {activeTab === 'upload'
                  ? 'Chuẩn bị tệp video MP4/WebM, nhập thông tin bài học và kích hoạt chuỗi AI tự động trích xuất phụ đề song ngữ.'
                  : 'Theo dõi thời gian thực tiến trình bóc tách âm thanh, nhận diện Whisper ASR và phân đoạn câu thoại.'}
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1.5 bg-[#F7F7F9] p-1.5 rounded-2xl border border-[#E7E7EA] shrink-0">
          <button
            type="button"
            onClick={() => onTabChange('upload')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-white text-[#18181B] shadow-2xs'
                : 'text-[#5F6368] hover:text-[#18181B]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Tải video mới</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('processing')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'processing'
                ? 'bg-[#18181B] text-white shadow-2xs'
                : 'text-[#5F6368] hover:text-[#18181B]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Theo dõi tiến trình AI ({jobs.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: UPLOAD FORM & DRAG-AND-DROP                                        */}
      {/* ========================================================================= */}
      {activeTab === 'upload' && (
        <form onSubmit={onSubmitUpload} className="space-y-6">
          {/* Main 2-Column Bento Form */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Drag & Drop Zone & Video Specs */}
            <div className="lg:col-span-5 space-y-4">
              {/* Dropzone Card */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`bg-white rounded-3xl p-6 border-2 border-dashed text-center cursor-pointer transition-all shadow-2xs flex flex-col items-center justify-center min-h-[260px] ${
                  isDragOver
                    ? 'border-[#B91B1C] bg-[#FDF1F1]/50 scale-[1.01]'
                    : file
                    ? 'border-[#188A5A] bg-[#E6F4EA]/20'
                    : 'border-[#E7E7EA] hover:border-[#B91B1C]/50 hover:bg-[#F7F7F9]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-colors ${
                    file
                      ? 'bg-[#E6F4EA] text-[#137333]'
                      : isDragOver
                      ? 'bg-[#B91B1C] text-white'
                      : 'bg-[#F7F7F9] text-[#5F6368]'
                  }`}
                >
                  {file ? <CheckCircle2 className="w-7 h-7" /> : <Upload className="w-7 h-7" />}
                </div>

                {file ? (
                  <div className="space-y-1">
                    <p className="text-sm font-black text-[#18181B] max-w-[280px] truncate">{file.name}</p>
                    <p className="text-xs text-[#137333] font-bold">
                      {formatFileSize(file.size)} · {file.type.replace('video/', '').toUpperCase()}
                    </p>
                    <p className="text-[11px] text-[#8B9097] mt-1">Bấm hoặc kéo thả tệp khác để thay thế</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-black text-[#18181B]">Kéo thả video vào đây hoặc chọn tệp</p>
                    <p className="text-xs text-[#8B9097]">Hỗ trợ định dạng MP4 và WebM (tối đa 500 MB)</p>
                    <span className="inline-block mt-2 px-3 py-1 bg-[#18181B] text-white text-[11px] font-bold rounded-lg hover:bg-black transition-colors">
                      Chọn tệp video từ máy
                    </span>
                  </div>
                )}
              </div>

              {/* Technical Specifications Guide */}
              <div className="bg-white rounded-3xl p-5 border border-[#E7E7EA] shadow-2xs space-y-3 text-xs">
                <div className="flex items-center gap-2 font-black text-[#18181B]">
                  <Info className="w-4 h-4 text-[#B91B1C]" />
                  <span>Tiêu chuẩn kỹ thuật video HanFlix</span>
                </div>
                <div className="space-y-2 text-[#5F6368]">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#E7E7EA]">
                    <span>Độ phân giải khuyến nghị:</span>
                    <strong className="text-[#18181B]">1080p (Full HD) hoặc 720p</strong>
                  </div>
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#E7E7EA]">
                    <span>Tỉ lệ khung hình:</span>
                    <strong className="text-[#18181B]">16:9 ngang chuẩn điện ảnh</strong>
                  </div>
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#E7E7EA]">
                    <span>Thời lượng video bài học:</span>
                    <strong className="text-[#18181B]">1 – 5 phút (60s – 300s)</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Chất lượng âm thanh:</span>
                    <strong className="text-[#137333]">Rõ thoại tiếng Trung bản xứ</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Metadata Form Fields */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA] shadow-2xs space-y-4">
                <h3 className="text-sm font-black text-[#18181B] pb-2 border-b border-[#E7E7EA]">
                  Thông tin bài học & Phân loại trình độ
                </h3>

                {/* Tiêu đề tiếng Việt */}
                <div>
                  <label className="block text-xs font-bold text-[#18181B] mb-1.5">
                    Tiêu đề bài học (Tiếng Việt) <span className="text-[#B91B1C]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={160}
                    value={titleVi}
                    onChange={(e) => setTitleVi(e.target.value)}
                    placeholder="ví dụ: Đoạn trích phim: Lần đầu đi nhà hàng gọi món"
                    className="w-full px-3.5 py-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] text-xs font-bold transition-colors"
                  />
                </div>

                {/* Tiêu đề tiếng Trung */}
                <div>
                  <label className="block text-xs font-bold text-[#18181B] mb-1.5">
                    Tiêu đề nguyên bản tiếng Trung (Hán tự)
                  </label>
                  <input
                    type="text"
                    value={titleZh}
                    onChange={(e) => setTitleZh(e.target.value)}
                    placeholder="ví dụ: 电影剪辑：第一次在餐厅点餐"
                    className="w-full px-3.5 py-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] text-sm font-serif font-bold transition-colors"
                  />
                </div>

                {/* Mô tả nội dung */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-[#18181B]">
                      Mô tả nội dung bài học <span className="text-[#B91B1C]">*</span>
                    </label>
                    <span className="text-[10px] text-[#8B9097]">{descriptionVi.length}/1000 ký tự</span>
                  </div>
                  <textarea
                    rows={3}
                    required
                    minLength={10}
                    maxLength={1000}
                    value={descriptionVi}
                    onChange={(e) => setDescriptionVi(e.target.value)}
                    placeholder="Tóm tắt ngắn gọn tình huống trong video, từ khóa chính và mẫu câu đàm thoại người học sẽ học được..."
                    className="w-full p-3 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] text-xs resize-none leading-relaxed transition-colors"
                  />
                </div>

                {/* Cấp độ HSK (1-9 Pills) */}
                <div>
                  <label className="block text-xs font-bold text-[#18181B] mb-1.5">
                    Cấp độ HSK 3.0 mục tiêu <span className="text-[#B91B1C]">*</span>
                  </label>
                  <div className="grid grid-cols-5 sm:grid-cols-9 gap-1.5">
                    {HSK_LEVELS.map((level) => {
                      const isSelected = hsk === level;
                      const styling = HSK_COLORS[level];
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setHsk(level)}
                          className={`py-2 rounded-xl text-xs font-black transition-all border ${
                            isSelected
                              ? 'ring-2 ring-[#B91B1C] bg-[#B91B1C] text-white border-transparent shadow-xs'
                              : `${styling.bg} ${styling.text} ${styling.border} hover:opacity-80`
                          }`}
                        >
                          H{level}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Chủ đề & Thời lượng */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-[#18181B] mb-1.5">Chủ đề bài học</label>
                    <select
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl text-xs font-bold outline-none cursor-pointer"
                    >
                      {TOPIC_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-[#18181B]">Thời lượng video (giây)</label>
                      <span className="text-[11px] font-bold text-[#137333]">≈ {formatTime(duration)}</span>
                    </div>
                    <input
                      type="number"
                      required
                      min={30}
                      max={600}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl text-xs font-bold outline-none focus:border-[#B91B1C]"
                    />
                  </div>
                </div>
              </div>

              {/* Upload In-Flight Progress Widget */}
              {uploadStage !== 'idle' && (
                <div className="rounded-3xl border border-[#E7E7EA] bg-white p-5 space-y-3 shadow-2xs animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-[#18181B] flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#B91B1C]" />
                      {uploadStage === 'presigning' && 'Đang xin mã cấp quyền tải lên Cloudflare R2...'}
                      {uploadStage === 'uploading' && `Đang truyền luồng video lên R2 (${uploadProgress.percent}%)`}
                      {uploadStage === 'confirming' && 'Đang xác nhận tệp và khởi động AI Pipeline...'}
                    </span>
                    {uploadStage === 'uploading' && (
                      <button
                        type="button"
                        onClick={onCancelUpload}
                        className="px-2.5 py-1 rounded-lg border border-[#FAD2CF] bg-[#FDF1F1] text-[11px] font-bold text-[#B91B1C] hover:bg-[#FCE8E8] transition-colors"
                      >
                        Hủy tải lên
                      </button>
                    )}
                  </div>

                  {uploadStage === 'uploading' && (
                    <div className="space-y-1.5">
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F7F7F9] border border-[#E7E7EA]">
                        <div
                          className="h-full bg-linear-to-r from-[#B91B1C] to-[#E7A92F] transition-all duration-300 rounded-full"
                          style={{ width: `${uploadProgress.percent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#8B9097]">
                        <span>Đã tải: {formatFileSize(uploadProgress.bytesSent)}</span>
                        <span>Tổng dung lượng: {formatFileSize(uploadProgress.totalBytes)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {uploadError && (
                <div className="p-4 rounded-2xl bg-[#FDF1F1] border border-[#FAD2CF] text-[#B91B1C] text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Action Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={busy || !file}
                  className="h-12 px-6 rounded-2xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-black flex items-center gap-2 transition-all shadow-md disabled:opacity-40"
                >
                  <Upload className="w-4 h-4" />
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
            <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA] shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E7E7EA]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded font-black text-[10px] bg-[#18181B] text-white">
                      HSK {selectedLesson.hsk}
                    </span>
                    <span className="text-xs text-[#8B9097]">{formatTime(selectedLesson.durationSeconds)}</span>
                  </div>
                  <h2 className="text-xl font-black text-[#18181B]">{selectedLesson.titleVi}</h2>
                  {selectedLesson.titleZh && (
                    <p className="text-xs text-[#8B9097] font-serif mt-0.5">{selectedLesson.titleZh}</p>
                  )}
                </div>

                {/* Status Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {selectedLesson.status === 'ready_for_review' && (
                    <button
                      type="button"
                      onClick={() => onTabChange('editor')}
                      className="h-10 px-5 rounded-xl bg-[#188A5A] hover:bg-[#137333] text-white text-xs font-black flex items-center gap-2 transition-colors shadow-2xs"
                    >
                      <span>Kiểm Tra & Biên Tập Phụ Đề</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}

                  {selectedLesson.status === 'failed' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRetryProcessing(selectedLesson._id)}
                      className="h-10 px-4 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-2xs"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Thử lại tiến trình</span>
                    </button>
                  )}

                  {selectedLesson.status === 'uploading' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onCancelVideoUpload(selectedLesson._id)}
                      className="h-10 px-4 rounded-xl border border-[#E7E7EA] bg-white text-[#B91B1C] text-xs font-bold hover:bg-[#FDF1F1]"
                    >
                      Hủy tải lên
                    </button>
                  )}
                </div>
              </div>

              {/* 5-Stage Stepper Tracker */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#18181B]">
                  <span>Quy trình xử lý AI tự động:</span>
                  <span className="text-[#B91B1C]">
                    Tiến độ: {processingStatus?.stageProgress ?? selectedLesson.processingProgress ?? 0}%
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {PIPELINE_STAGES.map((st, i) => {
                    const currentProgress = processingStatus?.stageProgress ?? selectedLesson.processingProgress ?? 0;
                    const stageThreshold = (i + 1) * 20;
                    const isPassed = currentProgress >= stageThreshold || selectedLesson.status === 'ready_for_review';
                    const isCurrent =
                      currentProgress >= i * 20 &&
                      currentProgress < stageThreshold &&
                      selectedLesson.status !== 'ready_for_review';

                    return (
                      <div
                        key={st.key}
                        className={`p-3 rounded-2xl border transition-all ${
                          isPassed
                            ? 'bg-[#E6F4EA] border-[#CEEAD6] text-[#137333]'
                            : isCurrent
                            ? 'bg-[#FEF7E0] border-[#FEEFC3] text-[#B06000] ring-2 ring-[#E7A92F]'
                            : 'bg-[#F7F7F9] border-[#E7E7EA] text-[#8B9097]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-[10px] font-black">BƯỚC 0{i + 1}</span>
                          {isPassed ? (
                            <CheckCircle2 className="w-4 h-4 text-[#137333]" />
                          ) : isCurrent ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#B06000]" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-[#8B9097]" />
                          )}
                        </div>
                        <div className="font-bold text-xs">{st.label}</div>
                        <div className="text-[10px] opacity-80 mt-0.5">{st.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Error Box if Failed */}
              {selectedLesson.processingError && (
                <div className="p-4 rounded-2xl bg-[#FDF1F1] border border-[#FAD2CF] text-[#B91B1C] text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-black">Lỗi trong quá trình xử lý AI:</p>
                    <p className="font-normal mt-0.5">{selectedLesson.processingError}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-8 border border-[#E7E7EA] text-center text-[#8B9097] shadow-2xs">
              <Layers className="w-8 h-8 mx-auto mb-2 text-[#CBD5E1]" />
              <p className="text-xs font-bold text-[#18181B]">Chưa chọn video để xem chi tiết tiến trình</p>
              <p className="text-[11px] text-[#8B9097] mt-0.5">
                Bấm vào một tác vụ bên dưới hoặc quay lại danh sách video để theo dõi.
              </p>
            </div>
          )}

          {/* Background Jobs List */}
          <div className="bg-white rounded-3xl border border-[#E7E7EA] overflow-hidden shadow-2xs">
            <div className="px-5 py-4 border-b border-[#E7E7EA] flex items-center justify-between">
              <h3 className="text-sm font-black text-[#18181B]">Hàng đợi xử lý tác vụ nền ({jobs.length})</h3>
              <span className="text-[11px] text-[#8B9097]">Tự động cập nhật mỗi 5 giây</span>
            </div>

            {jobs.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#8B9097]">
                Hiện không có tác vụ nào đang chạy trong hàng đợi.
              </div>
            ) : (
              <div className="divide-y divide-[#E7E7EA]">
                {jobs.map((job) => {
                  const lesson = lessons.find((l) => l._id === job.lessonId);
                  return (
                    <div
                      key={job._id}
                      onClick={() => onSelectLesson(job.lessonId)}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-[#F7F7F9] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-[#F7F7F9] border border-[#E7E7EA] flex items-center justify-center text-[#5F6368] shrink-0">
                          <Video className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#18181B] truncate">
                            {lesson?.titleVi || `Bài học #${job.lessonId.slice(-6)}`}
                          </p>
                          <p className="text-[11px] text-[#8B9097] mt-0.5">
                            Giai đoạn: <strong className="text-[#18181B]">{job.stage}</strong> · Tiến độ:{' '}
                            <strong className="text-[#B91B1C]">{job.stageProgress}%</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            job.status === 'completed'
                              ? 'bg-[#E6F4EA] text-[#137333]'
                              : job.status === 'running'
                              ? 'bg-[#FEF7E0] text-[#B06000]'
                              : job.status === 'failed'
                              ? 'bg-[#FDF1F1] text-[#B91B1C]'
                              : 'bg-[#F1F3F4] text-[#5F6368]'
                          }`}
                        >
                          {job.status}
                        </span>
                        <ArrowRight className="w-4 h-4 text-[#CBD5E1]" />
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
