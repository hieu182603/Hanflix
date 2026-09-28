import React, { useState, useEffect } from 'react';
import {
  Map,
  CheckCircle2,
  Lock,
  ArrowRight,
  Zap,
  Target,
  Clock,
  Flame,
  BookOpen,
  Sparkles,
  Calendar,
  ChevronRight,
  Play,
  Award,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRoadmap, saveRoadmapPreferences, type RoadmapStage, type ModuleTopic } from '../api/learning';
import { learningQueryKeys } from '../api/queryKeys';

export interface RoadmapPageProps {
  onSelectLesson?: (lessonId: string) => void;
  onStartPractice?: (hsk?: number, skill?: string) => void;
  onNavigateToLessons?: (hsk?: number) => void;
}

export default function RoadmapPage({
  onSelectLesson,
  onStartPractice,
  onNavigateToLessons,
}: RoadmapPageProps) {
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const queryClient = useQueryClient();
  const [preferences, setPreferences] = useState({ currentHsk: 1, targetHsk: 6, dailyMinutes: 15 });
  const preferenceMutation = useMutation({
    mutationFn: saveRoadmapPreferences,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: learningQueryKeys.roadmap() }),
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: learningQueryKeys.roadmap(),
    queryFn: ({ signal }) => getRoadmap({ signal }),
    staleTime: 60 * 1000,
  });

  const stages: RoadmapStage[] = data?.stages || [];
  const currentHsk = data?.currentHsk || 1;
  const targetHsk = data?.targetHsk || 6;
  const overallProgress = data?.overallProgress ?? 0;

  useEffect(() => {
    if (data) setPreferences({ currentHsk: data.currentHsk, targetHsk: data.targetHsk, dailyMinutes: data.dailyMinutes });
  }, [data?.currentHsk, data?.targetHsk, data?.dailyMinutes]);

  // Auto-select current in-progress stage when data loads
  useEffect(() => {
    if (stages.length > 0 && !selectedStageId) {
      const active = stages.find((s) => s.status === 'in_progress') || stages[0];
      if (active) setSelectedStageId(active.id);
    }
  }, [stages, selectedStageId]);

  const selectedStage = stages.find((s) => s.id === selectedStageId) || stages[0];
  const completedStagesCount = stages.filter((s) => s.status === 'completed').length;
  const streakDays = data?.streakDays ?? 0;

  const handleStartLearning = (stage?: RoadmapStage) => {
    if (stage?.nextLessonId && onSelectLesson) {
      onSelectLesson(stage.nextLessonId);
      return;
    }
    const hskLevelNumber = stage ? parseInt(stage.level.replace(/\D/g, ''), 10) : currentHsk;
    if (onNavigateToLessons) {
      onNavigateToLessons(hskLevelNumber);
    } else if (onStartPractice) {
      onStartPractice();
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* 1. Header Banner — Crisp White with HanFlix Styling */}
      <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA] shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#B91B1C] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Map className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-black text-[#18181B] tracking-tight">
                  Lộ Trình Học Cá Nhân Hóa
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-[#FDF1F1] text-[#B91B1C] text-[11px] font-black uppercase tracking-wider">
                  Hiện tại: HSK {currentHsk} · Mục tiêu: HSK {targetHsk}
                </span>
              </div>
              <p className="text-xs text-[#5F6368] mt-1.5 max-w-2xl leading-relaxed">
                Kế hoạch học tập từng chặng bài bản theo mục tiêu tiếng Trung Thương mại & Giao tiếp đời sống thực tế của bạn.
              </p>
            </div>
          </div>

          {/* Quick Metrics Indicators */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 bg-[#F7F7F9] px-3.5 py-2 rounded-2xl border border-[#E7E7EA] text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[#18181B]">
                <Target className="w-4 h-4 text-[#B91B1C]" />
                <span>Mục tiêu:</span>
                <span className="text-[#B91B1C]">HSK {targetHsk}</span>
              </div>
              <div className="w-px h-4 bg-[#E7E7EA]" />
              <div className="flex items-center gap-1.5 font-bold text-[#18181B]">
                <Clock className="w-4 h-4 text-[#188A5A]" />
                <span>Tổng tiến độ:</span>
                <span className="text-[#188A5A]">{overallProgress}%</span>
              </div>
              <div className="w-px h-4 bg-[#E7E7EA]" />
              <div className="flex items-center gap-1.5 font-bold text-[#18181B]">
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                <span>Chuỗi:</span>
                <span className="text-orange-600">{streakDays} ngày</span>
              </div>
            </div>

            <button
              onClick={() => handleStartLearning(selectedStage)}
              className="h-10 px-5 rounded-2xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Tiếp tục học</span>
            </button>
          </div>
        </div>
      </div>

      <section className="grid gap-4 rounded-3xl border border-[#E7E7EA] bg-white p-5 lg:grid-cols-[1fr_auto]">
        <div>
          <h2 className="font-black">Cấu hình lộ trình</h2>
          <p className="mt-1 text-xs text-[#5F6368]">Thay đổi mục tiêu không xóa lịch sử đã học.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="text-xs font-bold">Hiện tại
              <select className="ml-2 rounded-lg border p-2" value={preferences.currentHsk} onChange={e => setPreferences(p => ({ ...p, currentHsk: Number(e.target.value), targetHsk: Math.max(Number(e.target.value), p.targetHsk) }))}>
                {Array.from({ length: 9 }, (_, i) => <option key={i} value={i + 1}>HSK {i + 1}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold">Mục tiêu
              <select className="ml-2 rounded-lg border p-2" value={preferences.targetHsk} onChange={e => setPreferences(p => ({ ...p, targetHsk: Number(e.target.value) }))}>
                {Array.from({ length: 9 }, (_, i) => <option key={i} value={i + 1} disabled={i + 1 < preferences.currentHsk}>HSK {i + 1}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold">Phút/ngày
              <input className="ml-2 w-20 rounded-lg border p-2" type="number" min={5} max={120} value={preferences.dailyMinutes} onChange={e => setPreferences(p => ({ ...p, dailyMinutes: Number(e.target.value) }))} />
            </label>
          </div>
        </div>
        <button disabled={preferenceMutation.isPending || preferences.targetHsk < preferences.currentHsk} onClick={() => preferenceMutation.mutate(preferences)} className="min-h-11 self-end rounded-xl bg-[#B91B1C] px-5 text-xs font-bold text-white disabled:opacity-50">
          {preferenceMutation.isPending ? 'Đang lưu…' : 'Lưu lộ trình'}
        </button>
        {preferenceMutation.isError && <p role="alert" className="text-xs text-red-700">{preferenceMutation.error.message}</p>}
      </section>

      {data ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-[#E7E7EA] bg-white p-5">
            <h2 className="font-black">Kế hoạch hôm nay · {data.dailyMinutes} phút</h2>
            {data.dailyLessons.length ? data.dailyLessons.map(lesson => (
              <button key={lesson.id} onClick={() => onSelectLesson?.(lesson.id)} className="mt-3 flex w-full justify-between rounded-xl border p-3 text-left text-sm">
                <span>{lesson.title}</span><span>{Math.ceil(lesson.durationSeconds / 60)} phút</span>
              </button>
            )) : <p className="mt-3 text-sm text-[#5F6368]">Chưa có bài phù hợp trong chặng đang mở.</p>}
          </div>
          <div className="rounded-3xl border border-[#E7E7EA] bg-white p-5">
            <h2 className="font-black">Kỹ năng cần ôn</h2>
            {data.weakSkills.length ? data.weakSkills.map(item => (
              <button key={`${item.hsk}-${item.skill}`} onClick={() => onStartPractice?.(item.hsk, item.skill)} className="mt-3 flex w-full justify-between rounded-xl border p-3 text-left text-sm">
                <span>HSK {item.hsk} · {item.skill}</span><span>{item.score}%</span>
              </button>
            )) : <p className="mt-3 text-sm text-[#5F6368]">Chưa có kết quả bài luyện để phân tích.</p>}
          </div>
        </section>
      ) : null}

      {/* ERROR STATE */}
      {isError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex items-center justify-between gap-4 text-rose-900 text-sm">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-bold">Không thể tải lộ trình học</p>
              <p className="text-xs text-rose-700 mt-0.5">{error instanceof Error ? error.message : 'Vui lòng kiểm tra lại kết nối mạng.'}</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* LOADING SKELETON */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
          <div className="lg:col-span-2 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 bg-white rounded-3xl border border-[#E7E7EA] p-6" />
            ))}
          </div>
          <div className="space-y-4">
            <div className="h-64 bg-white rounded-3xl border border-[#E7E7EA]" />
            <div className="h-48 bg-white rounded-3xl border border-[#E7E7EA]" />
          </div>
        </div>
      )}

      {/* 2. Main Workspace Layout: 2 Columns */}
      {!isLoading && stages.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left 2 Columns: Vertical Stage Progression Timeline */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-black text-[#18181B] flex items-center gap-2">
                <span>Các Chặng Chinh Phục</span>
                <span className="text-xs font-semibold text-[#8B9097]">
                  ({completedStagesCount}/{stages.length} chặng hoàn thành)
                </span>
              </h2>
            </div>

            <div className="relative pl-6 sm:pl-8 space-y-4">
              {/* Continuous Vertical Timeline Line */}
              <div className="absolute left-2.5 sm:left-3.5 top-5 bottom-6 w-0.5 bg-[#E7E7EA]" />

              {stages.map((stage) => {
                const isCompleted = stage.status === 'completed';
                const isInProgress = stage.status === 'in_progress';
                const isLocked = stage.status === 'locked';
                const isUnavailable = stage.status === 'unavailable';
                const isSelected = stage.id === selectedStageId;

                return (
                  <div key={stage.id} className="relative">
                    {/* Timeline Milestone Dot */}
                    <div
                      className={`absolute -left-6 sm:-left-8 top-5 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                        isCompleted
                          ? 'bg-[#188A5A] border-[#188A5A] text-white'
                          : isInProgress
                          ? 'bg-white border-[#B91B1C] text-[#B91B1C] shadow-sm'
                          : 'bg-[#F7F7F9] border-[#E7E7EA] text-[#8B9097]'
                      }`}
                    >
                      {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {isInProgress && <div className="w-2 h-2 rounded-full bg-[#B91B1C]" />}
                      {(isLocked || isUnavailable) && <Lock className="w-2.5 h-2.5 text-[#8B9097]" />}
                    </div>

                    {/* Stage Card */}
                    <div
                      onClick={() => {
                        setSelectedStageId(stage.id);
                      }}
                      className={`rounded-3xl p-5 sm:p-6 transition-all bg-white border cursor-pointer ${
                        isSelected
                          ? 'border-[#B91B1C] shadow-md ring-2 ring-[#B91B1C]/20'
                          : isInProgress
                          ? 'border-[#B91B1C]/60 hover:border-[#B91B1C]'
                          : isCompleted
                          ? 'border-[#E7E7EA] hover:border-[#188A5A]/50'
                          : 'border-[#E7E7EA] opacity-80 bg-[#F7F7F9]/60 hover:opacity-100'
                      }`}
                    >
                      {/* Top Row: Title, Level & Status Badge */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                isCompleted
                                  ? 'bg-[#E4F6ED] text-[#188A5A]'
                                  : isInProgress
                                  ? 'bg-[#FDF1F1] text-[#B91B1C]'
                                  : 'bg-[#E7E7EA] text-[#5F6368]'
                              }`}
                            >
                              {stage.level}
                            </span>
                            <h3 className="text-lg font-black text-[#18181B] tracking-tight">
                              {stage.title}
                            </h3>
                          </div>
                          <p className="text-xs text-[#5F6368] mt-1 leading-relaxed">
                            {stage.description}
                          </p>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0 flex items-center gap-2">
                          {isCompleted && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E4F6ED] text-[#188A5A]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>100% Hoàn thành</span>
                            </span>
                          )}
                          {isInProgress && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FDF1F1] text-[#B91B1C]">
                              <Zap className="w-3.5 h-3.5 fill-[#B91B1C]" />
                              <span>{stage.progress}% Đang học</span>
                            </span>
                          )}
                          {(isLocked || isUnavailable) && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#F7F7F9] border border-[#E7E7EA] text-[#8B9097]">
                              <Lock className="w-3 h-3" />
                              <span>{isUnavailable ? 'Chưa có nội dung' : 'Chưa mở'}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar (Visible for In-Progress) */}
                      {isInProgress && (
                        <div className="mt-4 pt-4 border-t border-[#E7E7EA]">
                          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                            <span className="text-[#5F6368]">Tiến độ bài học chặng này:</span>
                            <span className="text-[#B91B1C]">{stage.progress}% ({stage.completedLessons}/{stage.totalLessons} bài)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-[#F7F7F9] border border-[#E7E7EA] overflow-hidden">
                            <div
                              className="h-full bg-[#B91B1C] rounded-full transition-all duration-500"
                              style={{ width: `${stage.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Topics / Modules Breakdown */}
                      <div className="mt-4 pt-4 border-t border-[#E7E7EA] space-y-2.5">
                        <div className="text-[11px] font-bold text-[#8B9097] uppercase tracking-wider flex items-center justify-between">
                          <span>Chủ đề trong kho bài học</span>
                          <span>{stage.totalLessons > 0 ? `${stage.totalLessons} bài học kho` : 'Chưa có bài học'}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {stage.topics.map((topic) => (
                            <div
                              key={topic.id}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-colors ${
                                topic.status === 'completed'
                                  ? 'bg-[#F7F7F9]/80 border-[#E7E7EA] text-[#18181B]'
                                  : topic.status === 'in_progress'
                                  ? 'bg-[#FDF1F1]/40 border-[#B91B1C]/30 text-[#18181B]'
                                  : 'bg-white border-[#E7E7EA] text-[#8B9097]'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                {topic.status === 'completed' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#188A5A] shrink-0" />
                                ) : topic.status === 'in_progress' ? (
                                  <div className="w-3 h-3 rounded-full border-2 border-[#B91B1C] shrink-0" />
                                ) : (
                                  <div className="w-3 h-3 rounded-full border-2 border-[#E7E7EA] shrink-0" />
                                )}
                                <span className="font-semibold truncate">{topic.nameVi}</span>
                              </div>
                              <span className="text-[11px] font-bold font-mono shrink-0">
                                {topic.progress}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Card Action Link */}
                      <div className="mt-4 pt-3 border-t border-[#E7E7EA]/60 flex items-center justify-between">
                        <span className="text-xs text-[#5F6368]">
                          {stage.completedLessons > 0 ? `Đã hoàn thành ${stage.completedLessons} bài học` : 'Bắt đầu học chặng này'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartLearning(stage);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#B91B1C] hover:underline"
                        >
                          <span>Xem bài học</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Focus Dashboard & Quick Action Widgets */}
          <div className="space-y-4">
            {/* Widget 1: Focus Stage Detail Card */}
            {selectedStage && (
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E7E7EA] shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#8B9097] uppercase tracking-wider">
                    Chặng Đang Xem Chi Tiết
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#FDF1F1] text-[#B91B1C] text-[11px] font-black">
                    {selectedStage.level}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-black text-[#18181B]">
                    {selectedStage.title}
                  </h3>
                  <p className="text-xs text-[#5F6368] mt-1 leading-relaxed">
                    {selectedStage.description}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F7F7F9] border border-[#E7E7EA] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#5F6368]">Tiến độ bài học:</span>
                    <span className="font-bold text-[#18181B]">{selectedStage.progress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white border border-[#E7E7EA] overflow-hidden">
                    <div
                      className="h-full bg-[#B91B1C] rounded-full transition-all duration-500"
                      style={{ width: `${selectedStage.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#8B9097] pt-1">
                    <span>{selectedStage.wordCount}</span>
                    <span>{selectedStage.grammarCount}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleStartLearning(selectedStage)}
                  className="w-full py-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Học bài học chặng này</span>
                </button>
              </div>
            )}

            {/* Widget 2: Weekly Habit Check-in */}
            <div className="bg-white rounded-3xl p-5 border border-[#E7E7EA] shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#8B9097] uppercase tracking-wider">
                  Mục tiêu tuần này
                </span>
                <span className="text-xs font-bold text-orange-600 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 fill-orange-500" />
                  <span>{streakDays} ngày</span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-1 pt-1">
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day, idx) => (
                  <div key={day} className="flex flex-col items-center gap-1.5 flex-1">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-bold border transition-colors ${
                        data?.weekDays?.[idx]?.completed
                          ? 'bg-[#188A5A] border-[#188A5A] text-white'
                          : data?.weekDays?.[idx]?.isToday
                          ? 'bg-[#FDF1F1] border-[#B91B1C] text-[#B91B1C]'
                          : 'bg-[#F7F7F9] border-[#E7E7EA] text-[#8B9097]'
                      }`}
                    >
                      {data?.weekDays?.[idx]?.completed ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        day
                      )}
                    </div>
                    <span className="text-[10px] text-[#8B9097]">{day}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Widget 3: Quick Action to Lessons */}
            <div className="bg-gradient-to-br from-[#18181B] to-[#27272A] rounded-3xl p-5 text-white shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-xs text-rose-300 font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Kho bài học theo HSK</span>
              </div>
              <h4 className="text-sm font-black text-white">
                Khám phá kho video đã xuất bản
              </h4>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Xem các tình huống thực tế: gọi món nhà hàng, sân bay, công sở, đàm phán hợp đồng.
              </p>
              <button
                type="button"
                onClick={() => handleStartLearning()}
                className="w-full py-2 rounded-xl bg-white text-[#18181B] hover:bg-neutral-100 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Mở kho bài học</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
