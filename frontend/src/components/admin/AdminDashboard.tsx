import React from 'react';
import { Video, Clock, CheckCircle2, AlertTriangle, Upload, ChevronRight, Edit3 } from 'lucide-react';
import { Lesson } from '../../data/hanflixData';

interface AdminDashboardProps {
  lessons: Lesson[];
  onNavigateToUpload: () => void;
  onSelectLessonToEdit: (lessonId: string) => void;
}

export default function AdminDashboard({ lessons, onNavigateToUpload, onSelectLessonToEdit }: AdminDashboardProps) {
  const publishedCount = lessons.filter(l => l.status === 'published').length;
  const draftCount = lessons.filter(l => l.status === 'draft').length;
  const processingCount = lessons.filter(l => l.status === 'processing').length;
  const reviewCount = lessons.filter(l => !l.contentReady || l.status === 'draft').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#18181B]">Tổng quan nội dung Video</h1>
          <p className="text-xs text-[#5F6368] mt-1">Quản lý kho bài học, tiến trình AI biên tập và người dùng</p>
        </div>

        <button
          onClick={onNavigateToUpload}
          className="h-10 px-5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold flex items-center gap-2 shadow-2xs"
        >
          <Upload className="w-4 h-4" />
          <span>Tải video mới</span>
        </button>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-[#E7E7EA]">
          <div className="text-xs font-bold text-[#8B9097]">Đã đăng công khai</div>
          <div className="text-2xl font-black text-[#18181B] mt-2">{publishedCount} video</div>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-[#E7E7EA]">
          <div className="text-xs font-bold text-[#8B9097]">Bản nháp / Đang sửa</div>
          <div className="text-2xl font-black text-[#18181B] mt-2">{draftCount} video</div>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-[#E7E7EA]">
          <div className="text-xs font-bold text-[#8B9097]">Đang xử lý AI ASR</div>
          <div className="text-2xl font-black text-[#B91B1C] mt-2">{processingCount} video</div>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-[#E7E7EA]">
          <div className="text-xs font-bold text-[#8B9097]">Cần duyệt phụ đề</div>
          <div className="text-2xl font-black text-[#E7A92F] mt-2">{reviewCount} video</div>
        </div>
      </div>

      {/* Task List */}
      <div className="p-6 rounded-2xl bg-white border border-[#E7E7EA] space-y-4">
        <h2 className="text-base font-extrabold text-[#18181B]">Bài học cần kiểm tra & xuất bản</h2>

        <div className="divide-y divide-[#E7E7EA]">
          {lessons.map((lesson) => (
            <div key={lesson.id} className="py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={lesson.thumbnailAsset || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&h=120&fit=crop"}
                  alt={lesson.titleVi}
                  className="w-16 h-10 rounded-lg object-cover border border-[#E7E7EA]"
                />
                <div>
                  <div className="font-bold text-sm text-[#18181B]">{lesson.titleVi} ({lesson.titleZh})</div>
                  <div className="text-xs text-[#8B9097] font-mono">HSK {lesson.hsk} · {Math.floor(lesson.durationSeconds / 60)} phút</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  lesson.status === 'published' ? 'bg-[#E4F6ED] text-[#188A5A]' : 'bg-[#FFF2C8] text-[#9A6A00]'
                }`}>
                  {lesson.status === 'published' ? 'Đã đăng' : 'Bản nháp'}
                </span>

                <button
                  onClick={() => onSelectLessonToEdit(lesson.id)}
                  className="px-3 py-1.5 rounded-xl border border-[#E7E7EA] hover:bg-[#F7F7F9] text-xs font-bold text-[#18181B] flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Biên tập</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
