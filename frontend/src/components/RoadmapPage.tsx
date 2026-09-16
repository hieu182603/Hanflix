import React from 'react';
import { Map, CheckCircle2, Circle, ArrowRight, Award, Zap } from 'lucide-react';

export default function RoadmapPage() {
  const roadmapStages = [
    {
      level: "HSK 1 - Nhập môn Giao tiếp",
      status: "completed",
      progress: "100%",
      topics: ["Chào hỏi & Giới thiệu", "Con số & Mua sắm cơ bản", "Hỏi giờ giấc & Thời tiết"]
    },
    {
      level: "HSK 2 - Sơ cấp Đời sống",
      status: "completed",
      progress: "100%",
      topics: ["Giao thông & Phương tiện", "Sở thích & Cuối tuần", "Ăn uống & Gọi món"]
    },
    {
      level: "HSK 3 - Trung cấp Thương mại & Du lịch",
      status: "in_progress",
      progress: "71%",
      topics: ["Gọi món nhà hàng đặc sản", "Đặt phòng & Check-in Khách sạn", "Phỏng vấn & Email công việc", "Thương lượng giá cả"]
    },
    {
      level: "HSK 4 - Cao cấp Công việc",
      status: "locked",
      progress: "0%",
      topics: ["Đàm phán Hợp đồng", "Thuyết trình Dự án", "Xử lý Khủng hoảng Truyền thông"]
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#B91B1C] text-white flex items-center justify-center font-bold">
            <Map className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#18181B] tracking-tight">Lộ Trình Học Cá Nhân Hóa</h1>
            <p className="text-sm text-[#5F6368] mt-0.5">Tiến trình chinh phục HSK 3 & ứng dụng tiếng Trung Thương mại</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {roadmapStages.map((stage, idx) => (
          <div
            key={idx}
            className={`p-6 rounded-3xl border bg-white transition-all ${
              stage.status === 'in_progress' ? 'border-[#B91B1C] shadow-md ring-1 ring-[#B91B1C]/20' : 'border-[#E7E7EA]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {stage.status === 'completed' && <CheckCircle2 className="w-6 h-6 text-[#188A5A]" />}
                {stage.status === 'in_progress' && <Zap className="w-6 h-6 text-[#B91B1C] animate-pulse" />}
                {stage.status === 'locked' && <Circle className="w-6 h-6 text-[#8B9097]" />}

                <h3 className="text-lg font-bold text-[#18181B]">{stage.level}</h3>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                stage.status === 'completed' ? 'bg-[#E4F6ED] text-[#188A5A]' :
                stage.status === 'in_progress' ? 'bg-[#FDF1F1] text-[#B91B1C]' : 'bg-[#F7F7F9] text-[#8B9097]'
              }`}>
                {stage.progress}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4 pt-4 border-t border-[#E7E7EA]">
              {stage.topics.map((topic, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-medium text-[#5F6368]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B91B1C]" />
                  <span>{topic}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
