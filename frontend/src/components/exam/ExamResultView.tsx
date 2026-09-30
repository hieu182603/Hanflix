import { useI18n } from '../../i18n';
import React, { useState } from 'react';
import { ExamSubmission, GoogleIcon } from './ExamRunner';

interface ExamResultViewProps {
  submission: ExamSubmission;
  onRetake?: () => void;
  onBackToList: () => void;
  onNavigateLesson?: (lessonId: string) => void;
}

export default function ExamResultView({
  submission,
  onRetake,
  onBackToList,
  onNavigateLesson,
}: ExamResultViewProps) {
  const { tr } = useI18n();
  const { exam, score, listeningScore, readingScore, writingScore, isPassed, timeSpentSeconds } = submission;
  const [filterMode, setFilterMode] = useState<'all' | 'wrong' | 'correct'>('all');
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  // Both score and correctness are authoritative server results.
  const questionResults = submission.questionResults.map(item => ({ ...item, userAns: item.userAns || '(Bỏ trống)' }));
  const allQuestions = questionResults.map(item => item.question);

  const wrongQuestions = questionResults.filter((r) => !r.isCorrect);
  const correctQuestions = questionResults.filter((r) => r.isCorrect);

  const displayedResults = questionResults.filter((r) => {
    if (filterMode === 'wrong') return !r.isCorrect;
    if (filterMode === 'correct') return r.isCorrect;
    return true;
  });

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return tr('{0} phút {1} giây', { 0: mins, 1: secs });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300 pb-16 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Nút quay lại */}
      <button
        type="button"
        onClick={onBackToList}
        className="px-4 py-2 rounded-full bg-white border border-[#DDD6CE] hover:border-[#B91B1C] text-xs font-bold text-[#444746] hover:text-[#B91B1C] transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
      >
        <GoogleIcon name="arrow_back" className="text-base" />
        <span>{tr("Danh sách đề thi HSK")}</span>
      </button>

      {/* HEADER BẢNG ĐIỂM (GOOGLE MATERIAL 3 SCORE HERO CARD) */}
      <div className="relative overflow-hidden bg-white rounded-3xl border border-[#E8E2DB] p-6 md:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#E8E2DB]">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#18181B] text-white font-mono font-black text-xs">
                HSK {exam.level}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  isPassed
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}
              >
                <GoogleIcon name={isPassed ? 'workspace_premium' : 'sentiment_dissatisfied'} className="text-base" filled />
                <span>{isPassed ? tr("ĐẠT HỢP CÁCH (PASS)") : tr("CHƯA ĐẠT (CẦN ÔN TẬP)")}</span>
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-[#18181B] tracking-tight">
              {exam.title}
            </h1>
            <p className="text-xs text-[#747775] flex items-center gap-3">
              <span>{tr("Mã đề:")} <strong className="text-[#18181B]">{exam.code}</strong></span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <GoogleIcon name="schedule" className="text-sm" />{tr("Thời gian làm:")} {formatTime(timeSpentSeconds)}
              </span>
            </p>
          </div>

          {/* Vòng tròn điểm tổng */}
          <div className="flex items-center gap-4 bg-[#F4EFEA] p-4 md:p-5 rounded-2xl border border-[#E8E2DB]">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-black text-[#B91B1C]">
                {score}
              </div>
              <span className="text-[11px] font-bold text-[#747775] uppercase tracking-wider">
                / {exam.totalScore} {tr("Điểm")}</span>
            </div>
            <div className="h-10 w-px bg-[#E8E2DB]" />
            <div className="text-xs space-y-1">
              <div className="text-[#747775]">{tr("Điểm chuẩn đỗ:")}</div>
              <div className="font-black text-[#18181B]">{exam.passingScore} {tr("điểm")}</div>
            </div>
          </div>
        </div>

        {/* 3 KỸ NĂNG: NGHE - ĐỌC - VIẾT */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
          {exam.sections.some(section => section.skill === 'listening') && <div className="p-4 rounded-2xl bg-[#FFFBF8] border border-[#F5DDD6] space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#5F6368]">
              <span className="flex items-center gap-1.5 text-[#B91B1C]">
                <GoogleIcon name="headphones" className="text-base" filled />{tr("Nghe hiểu")}</span>
              <span className="font-mono text-sm text-[#18181B]">{listeningScore} / 100</span>
            </div>
            <div className="w-full bg-[#E8E2DB] h-2 rounded-full overflow-hidden">
              <div className="bg-[#B91B1C] h-full rounded-full" style={{ width: `${listeningScore}%` }} />
            </div>
          </div>}

          {exam.sections.some(section => section.skill === 'reading') && <div className="p-4 rounded-2xl bg-[#F6FBF8] border border-[#D5EFE3] space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#5F6368]">
              <span className="flex items-center gap-1.5 text-[#188A5A]">
                <GoogleIcon name="menu_book" className="text-base" filled />{tr("Đọc hiểu")}</span>
              <span className="font-mono text-sm text-[#18181B]">{readingScore} / 100</span>
            </div>
            <div className="w-full bg-[#E8E2DB] h-2 rounded-full overflow-hidden">
              <div className="bg-[#188A5A] h-full rounded-full" style={{ width: `${readingScore}%` }} />
            </div>
          </div>}

          {exam.sections.some(section => section.skill === 'writing') && <div className="p-4 rounded-2xl bg-[#F5F8FF] border border-[#D5E1FB] space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#5F6368]">
              <span className="flex items-center gap-1.5 text-[#2563EB]">
                <GoogleIcon name="edit_note" className="text-base" filled />{tr("Viết câu")}</span>
              <span className="font-mono text-sm text-[#18181B]">{writingScore} / 100</span>
            </div>
            <div className="w-full bg-[#E8E2DB] h-2 rounded-full overflow-hidden">
              <div className="bg-[#2563EB] h-full rounded-full" style={{ width: `${writingScore}%` }} />
            </div>
          </div>}
        </div>

        {/* CÁC NÚT THAO TÁC */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-6">
          {onRetake && <button
            type="button"
            onClick={onRetake}
            className="px-4 py-2.5 rounded-full border border-[#DDD6CE] hover:border-[#B91B1C] text-xs font-bold text-[#18181B] flex items-center gap-2 transition-colors cursor-pointer bg-white"
          >
            <GoogleIcon name="restart_alt" className="text-base" />
            <span>{tr("Làm lại đề này")}</span>
          </button>}
          <button
            type="button"
            onClick={onBackToList}
            className="px-5 py-2.5 rounded-full bg-[#B91B1C] hover:bg-[#991516] text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>{tr("Luyện đề tiếp theo")}</span>
            <GoogleIcon name="arrow_forward" className="text-base text-white" />
          </button>
        </div>
      </div>

      {/* TÍNH NĂNG GỢI Ý VIDEO HANFLIX KHẮC PHỤC ĐIỂM YẾU */}
      {wrongQuestions.length > 0 && (
        <section className="bg-gradient-to-br from-[#FFF9F5] to-white rounded-3xl border border-[#F5DDD6] p-6 md:p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-[#B91B1C]">
              <GoogleIcon name="auto_awesome" className="text-xl text-[#B91B1C]" filled />
              <h2 className="text-lg font-black tracking-tight text-[#18181B]">{tr("Gợi ý bài học khắc phục điểm yếu (AI Smart Recommender)")}</h2>
            </div>
            <span className="text-xs font-bold text-[#747775]">
              {wrongQuestions.length} {tr("chủ điểm cần bù đắp")}</span>
          </div>

          <p className="text-xs text-[#5F6368] leading-relaxed">{tr("Hệ thống AI đã phân tích các câu làm sai và đề xuất các bài học video trên HanFlix chứa chính điểm ngữ pháp hoặc từ vựng tương ứng:")}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
            {wrongQuestions.slice(0, 4).map((item, idx) => {
              const q = item.question;
              return (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-white border border-[#E8E2DB] shadow-2xs space-y-2 flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-extrabold text-[#B91B1C]">{tr("Câu")} {q.order} ({q.skill === 'listening' ? tr("Nghe") : q.skill === 'reading' ? tr("Đọc") : tr("Viết")})
                      </span>
                      <span className="text-[#747775]">{tr("Lỗi sai kiến thức")}</span>
                    </div>
                    <h4 className="text-xs font-bold text-[#18181B]">
                      {q.grammarPoint || tr("Chủ điểm từ vựng & ngữ cảnh HSK 3")}
                    </h4>
                    <p className="text-[11px] text-[#5F6368] line-clamp-1">
                      {q.explanationVi}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#747775] truncate max-w-[200px]">
                      {q.recommendedLessonTitle || tr("Bài học ngữ pháp chuyên đề")}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (q.recommendedLessonId && onNavigateLesson) {
                          onNavigateLesson(q.recommendedLessonId);
                        } else {
                          onBackToList();
                        }
                      }}
                      className="px-3 py-1 rounded-full bg-[#FFF2EE] hover:bg-[#FFE5DE] text-[#B91B1C] text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      <span>{tr("Học ngay")}</span>
                      <GoogleIcon name="open_in_new" className="text-xs" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* XEM LẠI CHI TIẾT TỪNG CÂU (QUESTION BREAKDOWN) */}
      <section className="bg-white rounded-3xl border border-[#E8E2DB] p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2DB] pb-4">
          <div>
            <h2 className="text-lg font-black text-[#18181B] tracking-tight">{tr("Xem lại chi tiết bài làm & Lời giải")}</h2>
            <p className="text-xs text-[#747775] mt-0.5">{tr("Đối chiếu đáp án của bạn với đáp án chuẩn, xem phiên âm Pinyin và phân tích ngữ pháp.")}</p>
          </div>

          <div className="flex items-center gap-1 bg-[#F4EFEA] p-1 rounded-xl border border-[#E8E2DB] text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filterMode === 'all' ? 'bg-white text-[#18181B] shadow-2xs' : 'text-[#5F6368] hover:text-[#18181B]'
              }`}
            >{tr("Tất cả (")}{allQuestions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('wrong')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filterMode === 'wrong' ? 'bg-white text-[#B91B1C] shadow-2xs' : 'text-[#5F6368] hover:text-[#B91B1C]'
              }`}
            >{tr("Câu sai (")}{wrongQuestions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('correct')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filterMode === 'correct' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-[#5F6368] hover:text-emerald-700'
              }`}
            >{tr("Câu đúng (")}{correctQuestions.length})
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {displayedResults.map((item) => {
            const { question: q, userAns, isCorrect } = item;
            const isExpanded = expandedQuestionId === q.id;

            return (
              <div
                key={q.id}
                className={`rounded-2xl border transition-all ${
                  isCorrect
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : 'border-rose-200 bg-rose-50/20'
                }`}
              >
                <div
                  onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                  className="p-4 md:p-5 flex items-start justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <GoogleIcon
                        name={isCorrect ? 'check_circle' : 'cancel'}
                        className={`text-xl ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}
                        filled
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-[#18181B]">{tr("Câu")} {q.order}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-[#747775] px-2 py-0.5 rounded-md bg-white border border-[#E8E2DB]">
                          {q.skill === 'listening' ? tr("Nghe hiểu") : q.skill === 'reading' ? tr("Đọc hiểu") : tr("Viết câu")}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-[#18181B] leading-relaxed">
                        {q.promptText || q.instruction}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <div className={isCorrect ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                        {isCorrect ? tr("Đúng") : 'Sai'}
                      </div>
                    </div>
                    <button type="button" className="text-neutral-400 hover:text-neutral-700">
                      <GoogleIcon name={isExpanded ? 'expand_less' : 'expand_more'} className="text-xl" />
                    </button>
                  </div>
                </div>

                {/* KHU VỰC CHI TIẾT LỜI GIẢI MỞ RỘNG */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 border-t border-neutral-200/60 space-y-3.5 text-xs animate-in fade-in duration-150">
                    {/* Đáp án đối chiếu */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-3 rounded-xl border border-[#E8E2DB]">
                      <div>
                        <span className="text-[#747775] block">{tr("Bạn đã chọn:")}</span>
                        <span className={`font-bold ${isCorrect ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {userAns}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#747775] block">{tr("Đáp án chuẩn:")}</span>
                        <span className="font-black text-emerald-800">
                          {q.correctAnswer}
                        </span>
                      </div>
                    </div>

                    {/* Đoạn hội thoại / Ngữ cảnh */}
                    {q.dialogue && q.dialogue.length > 0 && (
                      <div className="bg-white p-3 rounded-xl border border-[#E8E2DB] space-y-1.5">
                        <span className="font-bold text-[#747775] block uppercase tracking-wider text-[10px]">{tr("Văn bản hội thoại:")}</span>
                        {q.dialogue.map((line, lIdx) => (
                          <div key={lIdx} className="text-sm">
                            <strong className="text-[#5F6368] mr-2">{line.speaker}:</strong>
                            <span className="font-medium text-[#18181B]">{line.text}</span>
                            {line.pinyin && (
                              <span className="block text-xs text-[#747775] font-mono mt-0.5">
                                {line.pinyin}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Dịch nghĩa */}
                    {q.translationVi && (
                      <div>
                        <span className="font-bold text-[#747775] block">{tr("Dịch nghĩa tiếng Việt:")}</span>
                        <p className="text-[#18181B] mt-0.5">{q.translationVi}</p>
                      </div>
                    )}

                    {/* Giải thích chi tiết */}
                    <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 text-amber-950">
                      <span className="font-black block uppercase tracking-wider text-[10px] text-amber-800">{tr("Phân tích giải thích:")}</span>
                      <p className="mt-1 leading-relaxed">{q.explanationVi}</p>
                      {q.grammarPoint && (
                        <div className="mt-2 text-[11px] font-bold text-amber-900">{tr("Điểm ngữ pháp cần nhớ:")} {q.grammarPoint}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
