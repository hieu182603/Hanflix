import React, { useState } from 'react';
import { Video, Plus, Edit3, Trash2, Eye, Shield, Search } from 'lucide-react';
import { Lesson } from '../../data/hanflixData';

interface AdminVideoListProps {
  lessons: Lesson[];
  onNavigateToUpload: () => void;
  onEditLesson: (lessonId: string) => void;
  onDeleteLesson: (lessonId: string) => void;
}

export default function AdminVideoList({ lessons, onNavigateToUpload, onEditLesson, onDeleteLesson }: AdminVideoListProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredLessons = lessons.filter(l => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false;
    if (searchQuery) {
      return l.titleVi.toLowerCase().includes(searchQuery.toLowerCase()) || l.titleZh.includes(searchQuery);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#18181B]">Danh sách Bài học Video</h1>
          <p className="text-xs text-[#5F6368] mt-1">Quản lý trạng thái đăng, bản nháp, chỉnh sửa phụ đề và câu hỏi</p>
        </div>

        <button
          onClick={onNavigateToUpload}
          className="h-10 px-5 rounded-xl bg-[#B91B1C] text-white text-xs font-bold flex items-center gap-2 shadow-2xs self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm video mới</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E7E7EA] flex flex-col md:flex-row gap-3 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#8B9097] absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Tìm theo tiêu đề Việt / Trung..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl text-xs outline-none focus:border-[#B91B1C]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {['all', 'published', 'draft', 'processing'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                filterStatus === st ? 'bg-[#18181B] text-white' : 'bg-[#F7F7F9] text-[#5F6368] hover:bg-[#E7E7EA]'
              }`}
            >
              {st === 'all' ? 'Tất cả' : st === 'published' ? 'Đã đăng' : st === 'draft' ? 'Bản nháp' : 'Đang xử lý'}
            </button>
          ))}
        </div>
      </div>

      {/* Video Table */}
      <div className="bg-white rounded-2xl border border-[#E7E7EA] overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F7F7F9] border-b border-[#E7E7EA] text-[#8B9097] uppercase font-bold text-[10px]">
            <tr>
              <th className="p-4">Video & Tiêu đề</th>
              <th className="p-4">Trình độ</th>
              <th className="p-4">Chủ đề</th>
              <th className="p-4">Thời lượng</th>
              <th className="p-4">Trạng thái</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E7EA]">
            {filteredLessons.map((lesson) => (
              <tr key={lesson.id} className="hover:bg-[#F7F7F9]/50 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={lesson.thumbnailAsset || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&h=120&fit=crop"}
                      alt={lesson.titleVi}
                      className="w-16 h-10 rounded-lg object-cover border border-[#E7E7EA]"
                    />
                    <div>
                      <div className="font-bold text-sm text-[#18181B]">{lesson.titleVi}</div>
                      <div className="text-xs text-[#5F6368] font-mono">{lesson.titleZh} ({lesson.pinyin})</div>
                    </div>
                  </div>
                </td>
                <td className="p-4 font-bold text-[#34363A]">HSK {lesson.hsk}</td>
                <td className="p-4 font-medium text-[#5F6368]">{lesson.topics.join(', ')}</td>
                <td className="p-4 font-mono text-[#5F6368]">{Math.floor(lesson.durationSeconds / 60)}:{(lesson.durationSeconds % 60 < 10 ? '0' : '') + (lesson.durationSeconds % 60)}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    lesson.status === 'published' ? 'bg-[#E4F6ED] text-[#188A5A]' : 'bg-[#FFF2C8] text-[#9A6A00]'
                  }`}>
                    {lesson.status === 'published' ? 'Đã đăng' : 'Bản nháp'}
                  </span>
                </td>
                <td className="p-4 text-right space-x-2">
                  <button
                    onClick={() => onEditLesson(lesson.id)}
                    className="p-1.5 rounded-lg border border-[#E7E7EA] hover:bg-[#F7F7F9] text-[#18181B]"
                    title="Chỉnh sửa bài học"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteLesson(lesson.id)}
                    className="p-1.5 rounded-lg border border-[#E7E7EA] hover:bg-[#FDF1F1] text-[#B91B1C]"
                    title="Xóa video"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
