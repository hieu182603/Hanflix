import React, { useEffect, useState } from 'react';
import { Sparkles, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

interface AdminVideoProcessingProps {
  lessonData: {
    titleVi: string;
    titleZh: string;
    hsk: number;
    topics: string[];
    descriptionVi: string;
    fileName: string;
  };
  onCompleteProcessing: () => void;
}

export default function AdminVideoProcessing({ lessonData, onCompleteProcessing }: AdminVideoProcessingProps) {
  const [activeStage, setActiveStage] = useState(0);

  const stages = [
    { title: 'Tải tệp video & Kiểm tra định dạng', desc: 'Đã hoàn thành kiểm tra độ phân giải và chất lượng âm thanh.' },
    { title: 'Trích xuất luồng âm thanh Audio', desc: 'Đã phân tách kênh tiếng nói để nhận dạng tốt nhất.' },
    { title: 'Nhận dạng giọng nói tiếng Trung (ASR)', desc: 'Đang trích xuất chữ Trung giản thể theo từng câu...' },
    { title: 'Tự động tạo phiên âm Pinyin chuẩn', desc: 'Thêm dấu thanh và tách từ ghép có nghĩa.' },
    { title: 'Dịch thuật phụ đề tiếng Việt', desc: 'Đã hoàn tất bản dịch ngữ cảnh tự nhiên.' },
    { title: 'Sẵn sàng kiểm tra & biên tập', desc: 'Hoàn tất tự động xử lý. Mời Admin duyệt phụ đề.' }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStage((prev) => {
        if (prev < stages.length - 1) return prev + 1;
        clearInterval(timer);
        return prev;
      });
    }, 800);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-center py-8">
      <div className="w-16 h-16 rounded-3xl bg-[#FDF1F1] text-[#B91B1C] flex items-center justify-center mx-auto shadow-md">
        <Sparkles className="w-8 h-8 fill-current" />
      </div>

      <div>
        <span className="px-3 py-1 rounded-full bg-[#FFF2C8] text-[#9A6A00] text-xs font-bold border border-[#E7A92F]/30">
          Mô phỏng AI Pipeline
        </span>
        <h1 className="text-2xl font-black text-[#18181B] mt-2">Đang xử lý Video: {lessonData.titleVi}</h1>
        <p className="text-xs text-[#5F6368] mt-1">Tệp: {lessonData.fileName} · HSK {lessonData.hsk}</p>
      </div>

      {/* Vertical Processing Stages */}
      <div className="bg-white p-6 rounded-3xl border border-[#E7E7EA] text-left space-y-4 shadow-2xs">
        {stages.map((stage, idx) => {
          const isDone = idx < activeStage;
          const isCurrent = idx === activeStage;

          return (
            <div key={idx} className="flex items-start gap-4">
              <div className="mt-0.5">
                {isDone && <CheckCircle2 className="w-5 h-5 text-[#188A5A]" />}
                {isCurrent && <Loader2 className="w-5 h-5 text-[#B91B1C] animate-spin" />}
                {!isDone && !isCurrent && <div className="w-5 h-5 rounded-full border-2 border-[#E7E7EA]" />}
              </div>

              <div className="flex-1">
                <div className={`text-sm font-bold ${isCurrent ? 'text-[#B91B1C]' : isDone ? 'text-[#18181B]' : 'text-[#8B9097]'}`}>
                  {stage.title}
                </div>
                <div className="text-xs text-[#5F6368] mt-0.5">{stage.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      {activeStage === stages.length - 1 && (
        <button
          onClick={onCompleteProcessing}
          className="px-8 py-3 rounded-2xl bg-[#B91B1C] hover:bg-[#A3181A] text-white font-bold text-sm shadow-md flex items-center gap-2 mx-auto animate-bounce"
        >
          <span>Kiểm tra & Biên tập Phụ đề ngay</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
