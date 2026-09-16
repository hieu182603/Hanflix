import React, { useState } from 'react';
import { BookOpen, Search, Filter, Play } from 'lucide-react';
import { VideoLesson, RECOMMENDATION_LESSONS, HERO_LESSON, RIGHT_RAIL_LESSON } from '../data/hanflixData';
import VideoCard from './VideoCard';

interface LessonsPageProps {
  onSelectLesson: (lesson: VideoLesson) => void;
}

export default function LessonsPage({ onSelectLesson }: LessonsPageProps) {
  const [selectedHsk, setSelectedHsk] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const allLessons = Array.from(
    new Map([HERO_LESSON, RIGHT_RAIL_LESSON, ...RECOMMENDATION_LESSONS].map((l) => [l.id, l])).values()
  );

  const categories = ['All', 'Ẩm thực', 'Du lịch', 'Phim ảnh & âm nhạc', 'Mua sắm', 'Kinh doanh', 'Đời sống'];
  const hskLevels = ['All', 'HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'];

  const filtered = allLessons.filter((l) => {
    if (selectedCategory !== 'All' && l.category !== selectedCategory) return false;
    if (selectedHsk !== 'All' && l.hskLevel !== selectedHsk) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-5 border border-[#E7E7EA]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-black text-[#18181B] tracking-tight">Kho Bài Học Video Tiếng Trung</h1>
            <p className="text-sm text-[#5F6368] mt-0.5">Hơn 500+ video ngắn phân loại theo chuẩn HSK 1–6 và tình huống giao tiếp</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5F6368] shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>{filtered.length} bài học</span>
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all"
              style={selectedCategory === cat
                ? { background: '#B91B1C', color: '#fff', boxShadow: '0 3px 10px rgba(185,27,28,0.3)' }
                : { background: '#F7F7F9', color: '#5F6368', border: '1.5px solid #E7E7EA' }
              }
            >
              {cat === 'All' ? 'Tất cả danh mục' : cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1" style={{ scrollbarWidth: 'none' }}>
          <span className="shrink-0 text-[10px] font-bold text-[#8B9097] uppercase tracking-wider">Cấp HSK:</span>
          {hskLevels.map((level) => (
            <button
              key={level}
              onClick={() => setSelectedHsk(level)}
              className="shrink-0 px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all"
              style={selectedHsk === level
                ? { background: '#34363A', color: '#fff' }
                : { background: '#F7F7F9', color: '#5F6368', border: '1.5px solid #E7E7EA' }
              }
            >
              {level === 'All' ? 'Tất cả cấp' : level}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((lesson) => (
            <VideoCard key={lesson.id} lesson={lesson} onSelect={onSelectLesson} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 border border-[#E7E7EA] text-center">
          <BookOpen className="w-10 h-10 text-[#E7E7EA] mx-auto mb-3" />
          <h3 className="font-bold text-[#18181B] mb-1">Không tìm thấy bài học</h3>
          <p className="text-sm text-[#5F6368]">Thử chọn danh mục hoặc cấp độ HSK khác.</p>
          <button
            onClick={() => { setSelectedCategory('All'); setSelectedHsk('All'); }}
            className="mt-4 px-4 py-2 rounded-xl bg-[#B91B1C] text-white text-xs font-bold hover:bg-[#A3181A] transition-colors"
          >
            Xem tất cả bài học
          </button>
        </div>
      )}
    </div>
  );
}
