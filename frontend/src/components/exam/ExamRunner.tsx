import { useI18n } from '../../i18n';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { type HskExam, type ExamQuestion, type ExamSkill, type ExamResult } from '../../data/hskExamData';
import { z } from 'zod';
import { examStorageKeys, clearActiveExam } from './exam-storage';
import { submitExam } from '../../services/exam.service';
import { useAntiCheat } from './useAntiCheat';

interface ExamRunnerProps {
  exam: HskExam;
  onExit: () => void;
  onFinish: (result: ExamSubmission) => void;
}

export type ExamSubmission = ExamResult;

const sessionSchema = z.object({
  examId: z.string(), startedAt: z.number().positive(), answers: z.record(z.string(), z.string()),
  currentIndex: z.number().int().min(0), flaggedIds: z.array(z.string()),
  submissionKey: z.string().optional(),
  pendingSubmission: z.object({ answers: z.record(z.string(), z.string()), timeSpentSeconds: z.number().int().min(0) }).optional(),
});

/**
 * Google Material Symbols Outlined Icon Component
 * Thiết kế đồng bộ hoàn toàn theo chuẩn Google Material Design 3 (M3)
 */
export function GoogleIcon({
  name,
  className = '',
  filled = false,
  weight = 400,
}: {
  name: string;
  className?: string;
  filled?: boolean;
  weight?: number;
}) {
  return (
    <span
      className={`material-symbols-outlined select-none inline-flex items-center justify-center leading-none ${className}`}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' 24`,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

export default function ExamRunner({ exam, onExit, onFinish }: ExamRunnerProps) {
  const { tr } = useI18n();
  // 🔒 Kích hoạt khóa F12, DevTools và Chuột phải
  const { warningMessage, dismissWarning } = useAntiCheat({ enabled: true });

  // Danh sách toàn bộ câu hỏi
  const allQuestions = useMemo(() => {
    const list: ExamQuestion[] = [];
    exam.sections.forEach((sec) => {
      sec.questions.forEach((q) => list.push(q));
    });
    return list.sort((a, b) => a.order - b.order);
  }, [exam]);

  const { sessionKey: SESSION_KEY, activeExamKey: ACTIVE_EXAM_ID_KEY } = examStorageKeys(exam.id);

  // 1. Kiểm tra phiên làm bài đã lưu trước đó (nếu reload trang hoặc rớt mạng)
  const savedSession = useMemo(() => {
    try {
      const data = localStorage.getItem(SESSION_KEY);
      if (data) {
        const parsed = sessionSchema.safeParse(JSON.parse(data));
        if (parsed.success && parsed.data.examId === exam.id) {
          return parsed.data;
        }
      }
    } catch (err) {
      console.warn('Lỗi đọc phiên làm bài đã lưu:', err);
    }
    return null;
  }, [SESSION_KEY, exam.id]);

  const initialSeconds = exam.durationMinutes * 60;
  const [submissionKey] = useState(() => savedSession?.submissionKey ?? crypto.randomUUID());
  const pendingSubmission = useRef(savedSession?.pendingSubmission);
  const submittingRef = useRef(false);
  const completedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStarted, setSubmissionStarted] = useState(Boolean(savedSession?.pendingSubmission));
  const [submitError, setSubmitError] = useState('');
  const submitRef = useRef<() => Promise<void>>(async () => {});


  // Thời điểm bắt đầu thi (timestamp)
  const [startedAt] = useState<number>(() => {
    return savedSession?.startedAt || Date.now();
  });

  // Tính thời gian còn lại chuẩn xác (ngăn gian lận reset đồng hồ khi reload trang)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (savedSession?.startedAt) {
      const elapsed = Math.floor((Date.now() - savedSession.startedAt) / 1000);
      return Math.max(0, initialSeconds - elapsed);
    }
    return initialSeconds;
  });

  // Banner thông báo đã khôi phục bài thi từ phiên trước
  const [showRestoreNotice, setShowRestoreNotice] = useState<boolean>(() => Boolean(savedSession));

  // Trạng thái kết nối Internet (Online / Offline Safe Mode)
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [networkBanner, setNetworkBanner] = useState<'offline' | 'reconnected' | null>(null);

  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    return Math.min(savedSession?.currentIndex ?? 0, Math.max(0, allQuestions.length - 1));
  });
  const currentQuestion: ExamQuestion | undefined = allQuestions[currentIndex];

  // Câu trả lời của thí sinh: { questionId: selectedAnswer } (Khôi phục nếu có)
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    return savedSession?.answers || {};
  });

  // Ref luôn giữ giá trị answers mới nhất để timer closure không bị stale (P1)
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // Danh sách câu gắn cờ phân vân (Khôi phục nếu có)
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(() => {
    return new Set(savedSession?.flaggedIds || []);
  });

  // Trạng thái cho dạng bài sắp xếp câu (Sentence ordering)
  const [sentenceOrder, setSentenceOrder] = useState<string[]>([]);

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Bộ lọc câu hỏi ở sidebar: 'all' | 'unanswered' | 'flagged'
  const [paletteFilter, setPaletteFilter] = useState<'all' | 'unanswered' | 'flagged'>('all');

  // Trợ năng học tập: Hiện / Ẩn Pinyin
  const [showPinyin, setShowPinyin] = useState<boolean>(false);

  // Audio Player State cho bài nghe
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioPlaybackVersion = useRef(0);
  const speechIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // HÀM DỌN DẸP BỘ NHỚ KHI NỘP BÀI HOẶC RỜI PHÒNG THI
  const cleanupStorage = useCallback(() => {
    clearActiveExam(exam.id);
  }, [exam.id]);

  // TỰ ĐỘNG LƯU TIẾN ĐỘ VÀO LOCALSTORAGE TRÁNH MẤT BÀI KHI RELOAD
  useEffect(() => {
    if (completedRef.current) return;
    try {
      const sessionData = {
        examId: exam.id,
        submissionKey,
        pendingSubmission: pendingSubmission.current,
        answers,
        flaggedIds: Array.from(flaggedIds),
        currentIndex,
        startedAt,
        initialDurationSeconds: initialSeconds,
        lastSavedAt: Date.now(),
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      localStorage.setItem(ACTIVE_EXAM_ID_KEY, exam.id);
    } catch (err) {
      console.warn('Lỗi tự động lưu bài thi:', err);
    }
  }, [answers, flaggedIds, currentIndex, startedAt, exam.id, initialSeconds, SESSION_KEY, submissionKey, submissionStarted, ACTIVE_EXAM_ID_KEY]);

  // CHẶN RELOAD / TẮT TAB ĐỘT NGỘT (BEFOREUNLOAD)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Bài thi HSK đang diễn ra. Nếu rời khỏi hoặc tải lại trang, đồng hồ thời gian vẫn tiếp tục đếm!';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // THEO DÕI TRẠNG THÁI MẠNG INTERNET (ONLINE / OFFLINE)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setNetworkBanner('reconnected');
      setTimeout(() => setNetworkBanner(null), 5000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setNetworkBanner('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Khóa scroll của document và theo dõi fullscreen
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('fullscreenchange', handleFsChange);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (speechIntervalRef.current) {
        clearInterval(speechIntervalRef.current);
      }
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Read the latest submission callback; never submit a stale initial answer map.
  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, initialSeconds - Math.floor((Date.now() - startedAt) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0) {
        clearInterval(timer);
        if (!pendingSubmission.current) void submitRef.current();
      }
    };
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [initialSeconds, startedAt]);

  // Đồng bộ trạng thái câu sắp xếp khi chuyển câu
  useEffect(() => {
    if (currentQuestion && currentQuestion.type === 'sentence_ordering') {
      const saved = answers[currentQuestion.id];
      if (saved) {
        setSentenceOrder(saved.split(' '));
      } else {
        setSentenceOrder([]);
      }
    }
    // Dừng audio cũ khi chuyển câu
    if (isPlayingAudio) {
      stopAudioPlayback();
    }
  }, [currentIndex]);

  const stopAudioPlayback = useCallback(() => {
    audioPlaybackVersion.current++;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (speechIntervalRef.current) {
      clearInterval(speechIntervalRef.current);
      speechIntervalRef.current = null;
    }
    setIsPlayingAudio(false);
    setAudioProgress(0);
  }, []);

  // Phát audio đoạn hội thoại bằng HTML5 audio hoặc Web Speech Synthesis tiếng Trung
  const startAudioPlayback = () => {
    const version = ++audioPlaybackVersion.current;
    setIsPlayingAudio(true);
    setAudioProgress(0);

    const audioSrc = currentQuestion?.audioUrl || exam.sections.find(section => section.skill === currentQuestion?.skill)?.audioUrl;
    if (audioRef.current && audioSrc && audioSrc.startsWith('http')) {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play().catch(() => {
        if (version === audioPlaybackVersion.current) playSpeechSynthesisChinese();
      });
    } else {
      playSpeechSynthesisChinese();
    }
  };

  const handleToggleAudio = () => {
    if (isPlayingAudio) stopAudioPlayback();
    else startAudioPlayback();
  };

  const playSpeechSynthesisChinese = () => {
    if (!('speechSynthesis' in window)) { setIsPlayingAudio(false); return; }
    const version = audioPlaybackVersion.current;
    window.speechSynthesis.cancel();

    const dialogueText =
      currentQuestion?.dialogue?.map((d) => d.text).join(' ') ||
      currentQuestion?.promptText ||
      '';

    if (!dialogueText) {
      setIsPlayingAudio(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(dialogueText);
    utterance.lang = 'zh-CN';
    utterance.rate = playbackSpeed;

    const estimatedDuration = Math.max(3, (dialogueText.length * 0.45) / playbackSpeed);
    let elapsed = 0;
    if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);

    speechIntervalRef.current = setInterval(() => {
      elapsed += 0.2;
      const pct = Math.min(100, Math.round((elapsed / estimatedDuration) * 100));
      setAudioProgress(pct);
      if (elapsed >= estimatedDuration) {
        if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);
      }
    }, 200);

    utterance.onend = () => {
      if (version !== audioPlaybackVersion.current) return;
      if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);
      setAudioProgress(100);
      setTimeout(() => {
        if (version !== audioPlaybackVersion.current) return;
        setIsPlayingAudio(false);
        setAudioProgress(0);
      }, 500);
    };

    utterance.onerror = () => {
      if (version !== audioPlaybackVersion.current) return;
      if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);
      setIsPlayingAudio(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      const current = audioRef.current.currentTime;
      const duration = audioRef.current.duration;
      setAudioProgress(Math.round((current / duration) * 100));
    }
  };

  const handleAudioEnded = () => {
    setIsPlayingAudio(false);
    setAudioProgress(0);
  };

  const handleSpeedChange = () => {
    const speeds = [1.0, 1.2, 0.8];
    const nextSpeed = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleReplayAudio = () => {
    stopAudioPlayback();
    startAudioPlayback();
  };

  // Chọn đáp án
  const handleSelectOption = (opt: string) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: opt,
    }));
  };

  // Ghép / gỡ từ trong bài sắp xếp câu
  const handleToggleSentenceChunk = (chunk: string) => {
    if (!currentQuestion) return;
    let nextOrder: string[];
    if (sentenceOrder.includes(chunk)) {
      nextOrder = sentenceOrder.filter((c) => c !== chunk);
    } else {
      nextOrder = [...sentenceOrder, chunk];
    }
    setSentenceOrder(nextOrder);
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: nextOrder.join(' '),
    }));
  };

  // Đánh dấu cờ phân vân
  const handleToggleFlag = () => {
    if (!currentQuestion) return;
    setFlaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(currentQuestion.id)) {
        next.delete(currentQuestion.id);
      } else {
        next.add(currentQuestion.id);
      }
      return next;
    });
  };

  // Điều hướng bằng phím tắt
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Bỏ qua nếu đang mở modal
      if (warningMessage || isSubmitModalOpen || isExitModalOpen || pendingSubmission.current) return;

      if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) => Math.min(allQuestions.length - 1, prev + 1));
      } else if (e.key === 'f' || e.key === 'F') {
        handleToggleFlag();
      } else if (currentQuestion?.options && currentQuestion.options.length > 0) {
        // Phím 1, 2, 3, 4 hoặc A, B, C, D
        const keyMap: Record<string, number> = {
          '1': 0,
          '2': 1,
          '3': 2,
          '4': 3,
          a: 0,
          b: 1,
          c: 2,
          d: 3,
          A: 0,
          B: 1,
          C: 2,
          D: 3,
        };
        if (keyMap[e.key] !== undefined && currentQuestion.options[keyMap[e.key]]) {
          handleSelectOption(currentQuestion.options[keyMap[e.key]]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, currentQuestion, warningMessage, isSubmitModalOpen, isExitModalOpen, allQuestions.length]);

  // Freeze the payload and retain it until the server confirms persistence.
  const handleSubmitExam = async () => {
    if (submittingRef.current || completedRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError('');
    pendingSubmission.current ??= {
      answers: { ...answers },
      timeSpentSeconds: Math.min(initialSeconds, Math.max(0, Math.floor((Date.now() - startedAt) / 1000))),
    };
    setSubmissionStarted(true);
    stopAudioPlayback();
    try {
      const result = await submitExam(exam.id, pendingSubmission.current, submissionKey);
      completedRef.current = true;
      cleanupStorage();
      onFinish(result);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Chưa nộp được bài. Câu trả lời đã được giữ lại, vui lòng thử lại.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };
  submitRef.current = handleSubmitExam;

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answers).length;
  const isTimeCritical = secondsRemaining < 300; // Dưới 5 phút

  return (
    <div className="fixed inset-0 z-[100] w-screen h-screen bg-[#FFF9F5] text-[#18181B] flex flex-col font-['Plus_Jakarta_Sans',sans-serif] select-none overflow-y-auto antialiased">
      {/* ========================================================================= */}
      {/* MODAL POPUP CẢNH BÁO BẢO MẬT PHÒNG THI (GOOGLE MATERIAL 3 ALERT DIALOG)   */}
      {/* ========================================================================= */}
      {warningMessage && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[28px] max-w-md w-full p-6 md:p-8 shadow-2xl border border-amber-200 text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
              <GoogleIcon name="gpp_maybe" className="text-4xl text-amber-600" filled />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-black tracking-wider uppercase">
                <GoogleIcon name="lock" className="text-xs text-amber-700" filled />{tr("Cảnh báo bảo mật phòng thi")}</div>
              <h3 className="text-xl font-black text-[#18181B] tracking-tight">{tr("Thao tác bị hạn chế!")}</h3>
              <p className="text-xs md:text-sm text-[#444746] font-medium leading-relaxed px-2">
                {warningMessage}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FFF9F5] border border-[#FCE9E1] text-[11px] text-[#5F6368] leading-relaxed text-left space-y-1">
              <div className="font-bold text-[#18181B] flex items-center gap-1.5">
                <GoogleIcon name="verified_user" className="text-base text-emerald-600" filled />{tr("Quy chế thi HSK trực tuyến (机考):")}</div>
              <p>{tr("Mọi hành vi mở DevTools (F12), kiểm tra phần tử hoặc can thiệp mã nguồn đều bị hạn chế nhằm bảo đảm tính công bằng tuyệt đối cho kỳ thi.")}</p>
            </div>

            <button
              type="button"
              onClick={dismissWarning}
              className="w-full py-3.5 rounded-full bg-[#B91B1C] hover:bg-[#991516] active:scale-98 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <GoogleIcon name="check" className="text-lg" />
              <span>{tr("Tôi đã hiểu & Tiếp tục làm bài")}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOP APP BAR: THANH ĐIỀU KHIỂN CHUẨN GOOGLE MATERIAL DESIGN 3               */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E8E2DB] px-4 sm:px-6 lg:px-8 xl:px-10 py-3 shadow-xs relative">
        <div className="w-full flex items-center justify-between gap-4">
          {/* Bên trái: Nút Rời phòng & Tên đề thi */}
          <div className="flex items-center gap-3 md:gap-4">
            <button
              onClick={() => setIsExitModalOpen(true)}
              className="h-10 px-3.5 rounded-full border border-[#DDD6CE] bg-white hover:bg-[#F7F3EE] text-xs font-bold text-[#444746] hover:text-[#B91B1C] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title={tr("Thoát phòng thi")}
            >
              <GoogleIcon name="close" className="text-base text-[#747775]" />
              <span className="hidden sm:inline">{tr("Rời phòng")}</span>
            </button>

            <div className="h-5 w-px bg-[#E8E2DB]" />

            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-xl bg-[#18181B] text-white font-mono font-black text-xs">
                HSK {exam.level}
              </span>
              <h1 className="text-xs md:text-sm font-black text-[#18181B] tracking-tight truncate max-w-[200px] sm:max-w-md lg:max-w-lg">
                {exam.title}
              </h1>
            </div>
          </div>

          {/* Giữa: Đồng hồ đếm ngược tinh gọn, rõ nét */}
          <div
            className={`h-10 px-4 rounded-full flex items-center gap-2 border shadow-2xs transition-all select-none font-mono font-bold text-sm md:text-base ${
              isTimeCritical
                ? 'bg-rose-50 border-rose-300 text-[#B91B1C] ring-2 ring-rose-200 animate-pulse'
                : 'bg-white border-[#DDD6CE] text-[#18181B]'
            }`}
            title={tr("Thời gian còn lại: {0}", { 0: formatTime(secondsRemaining) })}
          >
            <GoogleIcon
              name="schedule"
              className={`text-lg ${isTimeCritical ? 'text-[#B91B1C]' : 'text-amber-600'}`}
              filled={isTimeCritical}
            />
            <span className="tracking-wider">{formatTime(secondsRemaining)}</span>
          </div>

          {/* Bên phải: Nút Toàn màn hình & Nút Nộp bài */}
          <div className="flex items-center gap-2 md:gap-2.5">
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? tr("Thu nhỏ cửa sổ") : tr("Toàn màn hình")}
              className="w-10 h-10 rounded-full border border-[#DDD6CE] bg-white hover:bg-[#F7F3EE] flex items-center justify-center transition-colors cursor-pointer shadow-2xs text-[#444746]"
            >
              <GoogleIcon name={isFullscreen ? 'fullscreen_exit' : 'fullscreen'} className="text-xl text-[#18181B]" />
            </button>

            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="h-10 px-5 rounded-full bg-[#B91B1C] hover:bg-[#991516] active:scale-95 text-white font-bold text-xs md:text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <GoogleIcon name="send" className="text-base text-white" filled />
              <span>{tr("Nộp bài")}</span>
            </button>
          </div>
        </div>

        {/* Thanh tiến độ thời gian làm bài mảnh và tinh tế ở chân header */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E8E2DB] overflow-hidden">
          <div
            className="h-full bg-[#B91B1C] transition-all duration-1000 ease-linear"
            style={{ width: `${(secondsRemaining / Math.max(1, initialSeconds)) * 100}%` }}
          />
        </div>
      </header>

      {/* ========================================================================= */}
      {/* BANNER BẢO VỆ MẠNG INTERNET (OFFLINE RESILIENCE & AUTO-RESTORE NOTICE)    */}
      {/* ========================================================================= */}
      {(!isOnline || networkBanner === 'offline') && (
        <div className="bg-amber-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-xs font-bold animate-in slide-in-from-top duration-200 sticky top-16 z-30">
          <div className="w-full max-w-[1800px] mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GoogleIcon name="cloud_off" className="text-lg text-amber-100" filled />
              <span>
                <strong>{tr("Đang mất kết nối mạng:")}</strong> {tr("Tiến độ bài thi của bạn đang được tự động lưu an toàn trong trình duyệt (Offline Safe). Bạn cứ tiếp tục làm bài bình thường, không đóng hoặc tải lại trang!")}</span>
            </div>
            <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-mono tracking-wider">
              Offline Safe Active
            </span>
          </div>
        </div>
      )}

      {isOnline && networkBanner === 'reconnected' && (
        <div className="bg-emerald-600 text-white px-4 py-2 shadow-md flex items-center justify-between text-xs font-bold animate-in slide-in-from-top duration-200 sticky top-16 z-30">
          <div className="w-full max-w-[1800px] mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GoogleIcon name="cloud_done" className="text-lg text-emerald-100" filled />
              <span>
                <strong>{tr("Đã kết nối lại Internet:")}</strong> {tr("Toàn bộ dữ liệu bài làm của bạn đã được đồng bộ hóa an toàn.")}</span>
            </div>
            <button type="button" onClick={() => setNetworkBanner(null)} className="text-white/80 hover:text-white cursor-pointer">
              <GoogleIcon name="close" className="text-sm" />
            </button>
          </div>
        </div>
      )}

      {/* BANNER THÔNG BÁO TỰ ĐỘNG KHÔI PHỤC PHIÊN THI NẾU VỪA RELOAD */}
      {showRestoreNotice && (
        <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-900 px-4 py-2 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-300">
          <div className="flex items-center gap-2 mx-auto">
            <GoogleIcon name="history" className="text-base text-emerald-700" filled />
            <span>{tr("Đã khôi phục bài làm từ phiên trước của bạn (")}{Object.keys(answers).length} {tr("câu đã trả lời). Thời gian làm bài tiếp tục được tính chuẩn xác.")}</span>
          </div>
          <button type="button" onClick={() => setShowRestoreNotice(false)} className="text-emerald-700 hover:text-emerald-950 cursor-pointer">
            <GoogleIcon name="close" className="text-sm" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* KHUNG NỘI DUNG: GIAO DIỆN RỘNG (FULL FLUID) LOẠI BỎ KHOẢNG TRẮNG THỪA 2 BÊN */}
      {/* ========================================================================= */}
      <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-4 md:py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================================= */}
        {/* CỘT TRÁI: BÀI THI & AUDIO & KHU VỰC CÂU HỎI (Chiếm 9/12 cột trên màn rộng)*/}
        {/* ======================================================================= */}
        <main className="lg:col-span-8 xl:col-span-9 flex flex-col gap-5">
          {/* Thanh chuyển kỹ năng (Google Material 3 Segmented Switcher) */}
          <div className="bg-white rounded-2xl p-2 border border-[#E8E2DB] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="bg-[#F4EFEA] p-1 rounded-xl flex items-center gap-1 overflow-x-auto">
              {exam.sections.map((sec) => {
                const isActive = currentQuestion?.skill === sec.skill;
                const answeredInSkill = sec.questions.filter((q) => Boolean(answers[q.id])).length;
                const isComplete = answeredInSkill === sec.questions.length;

                return (
                  <button
                    key={sec.skill}
                    type="button"
                    onClick={() => {
                      const firstQ = allQuestions.find((q) => q.skill === sec.skill);
                      if (firstQ) setCurrentIndex(allQuestions.indexOf(firstQ));
                    }}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      isActive
                        ? 'bg-white text-[#B91B1C] shadow-xs ring-1 ring-[#E0DBD3]'
                        : 'text-[#5F6368] hover:text-[#18181B] hover:bg-white/50'
                    }`}
                  >
                    {sec.skill === 'listening' && (
                      <GoogleIcon name="headphones" className={`text-base ${isActive ? 'text-[#B91B1C]' : 'text-[#747775]'}`} filled={isActive} />
                    )}
                    {sec.skill === 'reading' && (
                      <GoogleIcon name="menu_book" className={`text-base ${isActive ? 'text-[#B91B1C]' : 'text-[#747775]'}`} filled={isActive} />
                    )}
                    {sec.skill === 'writing' && (
                      <GoogleIcon name="edit_note" className={`text-base ${isActive ? 'text-[#B91B1C]' : 'text-[#747775]'}`} filled={isActive} />
                    )}
                    <span>{sec.title.split(':')[1]?.trim() || sec.title}</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-[#FDF1F1] text-[#B91B1C] font-bold'
                          : isComplete
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-neutral-200/70 text-neutral-700'
                      }`}
                    >
                      {answeredInSkill}/{sec.questions.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Công cụ bổ trợ: Bật/Tắt Pinyin & Đánh dấu cờ */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPinyin((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                  showPinyin
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-200'
                    : 'bg-white text-[#5F6368] border-[#DDD6CE] hover:bg-[#F7F3EE]'
                }`}
                title={tr("Bật/Tắt hiển thị phiên âm Pinyin")}
              >
                <GoogleIcon name="translate" className="text-base" />
                <span>{showPinyin ? tr("Ẩn Pinyin") : tr("Hiện Pinyin")}</span>
              </button>

              <button
                onClick={handleToggleFlag}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  currentQuestion && flaggedIds.has(currentQuestion.id)
                    ? 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-200'
                    : 'bg-white text-[#5F6368] border-[#DDD6CE] hover:border-amber-300 hover:text-amber-800'
                }`}
              >
                <GoogleIcon
                  name="flag"
                  className={`text-base ${currentQuestion && flaggedIds.has(currentQuestion.id) ? 'text-amber-500' : 'text-[#747775]'}`}
                  filled={currentQuestion ? flaggedIds.has(currentQuestion.id) : false}
                />
                <span>{currentQuestion && flaggedIds.has(currentQuestion.id) ? tr("Đã gắn cờ") : tr("Đánh dấu phân vân")}</span>
              </button>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* AUDIO PLAYER: GOOGLE MATERIAL 3 MEDIA CARD (Phần Nghe Hiểu)           */}
          {/* ===================================================================== */}
          {currentQuestion?.skill === 'listening' && (
            <div className="bg-gradient-to-r from-[#FFF5F2] via-white to-[#FFF8F6] rounded-3xl p-5 md:p-6 shadow-xs border border-[#F5DDD6] flex flex-col md:flex-row items-center justify-between gap-5 relative overflow-hidden">
              <audio
                ref={audioRef}
                src={currentQuestion.audioUrl || exam.sections.find(section => section.skill === currentQuestion.skill)?.audioUrl}
                onTimeUpdate={handleAudioTimeUpdate}
                onEnded={handleAudioEnded}
              />

              <div className="flex items-center gap-4 w-full md:w-auto">
                {/* Nút Play / Pause tròn đỏ thương hiệu chuẩn Google FAB */}
                <button
                  type="button"
                  onClick={handleToggleAudio}
                  className="w-13 h-13 rounded-2xl bg-[#B91B1C] hover:bg-[#991516] active:scale-95 text-white flex items-center justify-center shadow-md transition-all cursor-pointer shrink-0"
                  title={isPlayingAudio ? tr("Tạm dừng audio") : tr("Bấm để nghe audio đoạn hội thoại")}
                >
                  <GoogleIcon name={isPlayingAudio ? 'pause' : 'play_arrow'} className="text-3xl" filled />
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-[#B91B1C] flex items-center gap-1.5 font-mono">
                      <GoogleIcon name="graphic_eq" className="text-base text-[#B91B1C]" filled />{tr("Bài nghe HSK {0}", { 0: exam.level })}</span>
                    {isPlayingAudio && (
                      <span className="flex items-center gap-0.5 h-3">
                        <span className="w-1 h-3 bg-[#B91B1C] animate-pulse rounded-full" />
                        <span className="w-1 h-2 bg-[#B91B1C] animate-pulse delay-75 rounded-full" />
                        <span className="w-1 h-3.5 bg-[#B91B1C] animate-pulse delay-150 rounded-full" />
                        <span className="w-1 h-1.5 bg-[#B91B1C] animate-pulse delay-100 rounded-full" />
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-black text-[#18181B] mt-0.5">
                    {isPlayingAudio ? tr("Đang phát âm thanh đoạn hội thoại...") : tr("Bấm nút để nghe audio đoạn hội thoại")}
                  </h4>
                  <p className="text-[11px] text-[#747775]">{tr("Nghe và chọn đáp án phù hợp.")}</p>
                </div>
              </div>

              {/* Nút Replay & Chỉnh tốc độ đọc & Thanh tiến trình */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleReplayAudio}
                  className="px-3 py-1.5 rounded-xl border border-[#DDD6CE] hover:border-[#B91B1C] text-xs font-bold text-[#444746] hover:text-[#B91B1C] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs bg-white"
                  title={tr("Nghe lại từ đầu")}
                >
                  <GoogleIcon name="replay" className="text-sm" />
                  <span>{tr("Nghe lại")}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSpeedChange}
                  className="px-3 py-1.5 rounded-xl border border-[#DDD6CE] hover:border-[#B91B1C] text-xs font-mono font-bold text-[#18181B] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs bg-white"
                  title={tr("Thay đổi tốc độ phát")}
                >
                  <GoogleIcon name="speed" className="text-sm text-[#747775]" />
                  <span>{playbackSpeed}x</span>
                </button>

                {/* Thanh tiến trình audio */}
                <div className="w-32 sm:w-48 lg:w-64 bg-[#E8E2DB] h-2.5 rounded-full overflow-hidden shrink-0">
                  <div
                    className="bg-[#B91B1C] h-full transition-all duration-150 rounded-full"
                    style={{ width: `${audioProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* NỘI DUNG CÂU HỎI (GOOGLE MATERIAL 3 ELEVATED CARD)                     */}
          {/* ===================================================================== */}
          {currentQuestion && (
            <div className="bg-white rounded-3xl border border-[#E8E2DB] p-6 md:p-8 shadow-xs flex flex-col justify-between flex-1 min-h-[440px] space-y-6">
              <div className="space-y-6">
                {/* Header câu hỏi: Số câu & Hướng dẫn */}
                <div className="flex items-center justify-between border-b border-[#E8E2DB] pb-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="px-3.5 py-1 rounded-xl bg-[#FDF1F1] text-[#B91B1C] font-black font-mono text-sm border border-[#F6D0D0]">{tr("CÂU")} {currentQuestion.order} / {allQuestions.length}
                    </span>
                    <span className="text-[11px] font-bold text-[#747775] uppercase tracking-wider flex items-center gap-1">
                      <GoogleIcon name="info" className="text-sm text-neutral-400" />
                      {currentQuestion.skill === 'listening' ? tr("Nghe hiểu") : currentQuestion.skill === 'reading' ? tr("Đọc hiểu") : tr("Viết câu")}
                    </span>
                  </div>

                  <span className="text-[#5F6368] font-medium text-xs hidden sm:inline bg-[#F7F3EE] px-3 py-1 rounded-lg">
                    {currentQuestion.instruction}
                  </span>
                </div>

                {/* Đoạn hội thoại / Ngữ cảnh tiếng Trung (Script block / Dialogue bubble) */}
                {currentQuestion.skill !== 'listening' && currentQuestion.dialogue && currentQuestion.dialogue.length > 0 && (
                  <div className="bg-[#FDFBF9] rounded-2xl p-5 border border-[#EFE8DF] space-y-3 shadow-2xs">
                    <div className="text-[11px] font-bold text-[#747775] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#EFE8DF] pb-2">
                      <GoogleIcon name="record_voice_over" className="text-sm text-[#B91B1C]" filled />{tr("Đoạn hội thoại đã nghe:")}</div>
                    {currentQuestion.dialogue.map((line, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="text-base md:text-lg leading-relaxed flex items-start gap-2">
                          <span className="font-bold text-[#747775] shrink-0 text-sm mt-0.5">{line.speaker}:</span>
                          <span className="font-['Noto_Sans_SC',sans-serif] font-medium text-[#18181B] text-lg md:text-xl tracking-wide">
                            {line.text}
                          </span>
                        </div>
                        {showPinyin && line.pinyin && (
                          <div className="text-xs text-neutral-500 font-mono pl-6 italic">
                            {line.pinyin}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Nội dung câu hỏi chữ Hán (Prompt text) */}
                {currentQuestion.imageUrl && <img src={currentQuestion.imageUrl} alt="Hình minh họa câu hỏi" className="max-h-72 max-w-full object-contain rounded-2xl" />}
                {currentQuestion.promptText && (
                  <div className="p-4 rounded-2xl bg-[#FFFBF8] border border-[#F6E8DE] space-y-1.5">
                    <span className="text-[11px] font-bold text-[#747775] uppercase tracking-wider block">
                      {currentQuestion.skill === 'listening' ? tr("Câu đối chiếu nghe được:") : tr("Câu trên đề bài:")}
                    </span>
                    <div className="text-lg md:text-2xl font-bold font-['Noto_Sans_SC',sans-serif] text-[#18181B] leading-relaxed tracking-wide">
                      {currentQuestion.promptText.replace(/^(Câu trên đề:\s*|Câu hỏi:\s*)/i, '')}
                    </div>
                    {showPinyin && currentQuestion.pinyinScript && (
                      <div className="text-xs text-neutral-500 font-mono italic">
                        {currentQuestion.pinyinScript}
                      </div>
                    )}
                  </div>
                )}

                {/* DẠNG 1: ĐÚNG / SAI (TRUE / FALSE SELECTION CARDS) */}
                {currentQuestion.type === 'true_false' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {(currentQuestion.options ?? ['True', 'False']).map((opt, optIdx) => {
                      const isSelected = answers[currentQuestion.id] === opt;
                      const isTrueOption = opt === 'True' || opt.includes('Đúng') || opt.includes('正确');

                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleSelectOption(opt)}
                          className={`p-5 rounded-2xl text-left font-medium text-sm border-2 transition-all cursor-pointer flex items-center justify-between group ${
                            isSelected
                              ? 'border-[#B91B1C] bg-[#FDF1F1] text-[#B91B1C] font-black ring-2 ring-[#B91B1C]/20 shadow-xs'
                              : 'border-[#E8E2DB] hover:border-neutral-400 bg-white text-[#18181B] hover:shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            <span
                              className={`w-8 h-8 rounded-xl font-mono text-xs font-black flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-[#B91B1C] text-white'
                                  : 'bg-[#F4EFEA] text-[#5F6368] group-hover:bg-[#18181B] group-hover:text-white'
                              }`}
                            >
                              {optIdx === 0 ? '1' : '2'}
                            </span>
                            <div className="flex items-center gap-2">
                              <GoogleIcon
                                name={isTrueOption ? 'check_circle' : 'cancel'}
                                className={`text-xl ${
                                  isSelected
                                    ? 'text-[#B91B1C]'
                                    : isTrueOption
                                    ? 'text-emerald-600'
                                    : 'text-rose-500'
                                }`}
                                filled={isSelected}
                              />
                              <span className="font-['Noto_Sans_SC',sans-serif] text-base md:text-lg font-bold">
                                {opt}
                              </span>
                            </div>
                          </div>

                          <span
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs transition-colors shrink-0 ${
                              isSelected
                                ? 'border-[#B91B1C] bg-[#B91B1C] text-white'
                                : 'border-[#DDD6CE]'
                            }`}
                          >
                            {isSelected && <GoogleIcon name="check" className="text-sm" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.type === 'fill_in_blank' && !currentQuestion.options?.length && (
                  <label className="block space-y-2 text-sm font-bold">
                    <span>Câu trả lời</span>
                    <input aria-label="Câu trả lời" value={answers[currentQuestion.id] ?? ''} maxLength={20000}
                      onChange={event => handleSelectOption(event.target.value)}
                      className="block w-full rounded-2xl border border-[#DDD6CE] p-4" />
                  </label>
                )}
                {/* DẠNG 2: TRẮC NGHIỆM ĐÁP ÁN (A, B, C, D) */}
                {currentQuestion.type !== 'true_false' && currentQuestion.options && currentQuestion.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                    {currentQuestion.options.map((opt, optIdx) => {
                      const isSelected = answers[currentQuestion.id] === opt;
                      const letter = String.fromCharCode(65 + optIdx); // A, B, C, D

                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleSelectOption(opt)}
                          className={`p-4 md:p-5 rounded-2xl text-left font-medium text-sm border-2 transition-all cursor-pointer flex items-center justify-between group ${
                            isSelected
                              ? 'border-[#B91B1C] bg-[#FDF1F1] text-[#B91B1C] font-black ring-2 ring-[#B91B1C]/20 shadow-xs'
                              : 'border-[#E8E2DB] hover:border-neutral-400 bg-white text-[#18181B] hover:shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-7 h-7 rounded-xl font-mono text-xs font-black flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-[#B91B1C] text-white'
                                  : 'bg-[#F4EFEA] text-[#5F6368] group-hover:bg-[#18181B] group-hover:text-white'
                              }`}
                            >
                              {letter}
                            </span>
                            <span className="font-['Noto_Sans_SC',sans-serif] text-base md:text-lg">
                              {opt}
                            </span>
                          </div>

                          <span
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs transition-colors shrink-0 ${
                              isSelected
                                ? 'border-[#B91B1C] bg-[#B91B1C] text-white'
                                : 'border-[#DDD6CE]'
                            }`}
                          >
                            {isSelected && <GoogleIcon name="check" className="text-xs" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* DẠNG 3: SẮP XẾP CỤM TỪ THÀNH CÂU (SENTENCE ORDERING) */}
                {currentQuestion.type === 'sentence_ordering' && currentQuestion.sentenceChunks && (
                  <div className="space-y-5 pt-2">
                    <div className="min-h-[76px] p-4 md:p-5 rounded-2xl bg-[#FFFBF8] border-2 border-dashed border-[#F5DDD6] flex flex-wrap items-center gap-2.5">
                      {sentenceOrder.length === 0 ? (
                        <div className="flex items-center gap-2 text-xs text-[#747775] italic">
                          <GoogleIcon name="touch_app" className="text-base text-amber-600" />
                          <span>{tr("Bấm vào các thẻ chữ Hán bên dưới theo đúng trật tự ngữ pháp để ghép thành câu...")}</span>
                        </div>
                      ) : (
                        sentenceOrder.map((chunk, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleToggleSentenceChunk(chunk)}
                            className="px-4 py-2.5 rounded-xl bg-[#B91B1C] text-white font-['Noto_Sans_SC',sans-serif] font-black text-base shadow-xs hover:bg-[#991516] transition-colors cursor-pointer flex items-center gap-2"
                            title={tr("Bấm để gỡ cụm này")}
                          >
                            <span>{chunk}</span>
                            <GoogleIcon name="close" className="text-sm text-white/80" />
                          </button>
                        ))
                      )}
                    </div>

                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-[#747775] uppercase tracking-wider block">{tr("Các cụm từ cần sắp xếp:")}</span>
                      <div className="flex flex-wrap gap-3">
                        {currentQuestion.sentenceChunks.map((chunk, idx) => {
                          const isChosen = sentenceOrder.includes(chunk);
                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={isChosen}
                              onClick={() => handleToggleSentenceChunk(chunk)}
                              className={`px-5 py-3 rounded-2xl text-base font-['Noto_Sans_SC',sans-serif] font-bold border transition-all cursor-pointer ${
                                isChosen
                                  ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed line-through'
                                  : 'bg-white border-[#E8E2DB] hover:border-[#B91B1C] text-[#18181B] hover:shadow-xs hover:-translate-y-0.5 active:scale-95'
                              }`}
                            >
                              {chunk}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {sentenceOrder.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSentenceOrder([]);
                          setAnswers((prev) => {
                            const next = { ...prev };
                            delete next[currentQuestion.id];
                            return next;
                          });
                        }}
                        className="text-xs font-bold text-[#747775] hover:text-[#B91B1C] flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <GoogleIcon name="restart_alt" className="text-base" />
                        <span>{tr("Xóa và sắp xếp lại từ đầu")}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* ======================================================================= */}
        {/* CỘT PHẢI: QUESTION PALETTE MA TRẬN CÂU HỎI (3 Cols trên màn rộng)      */}
        {/* ======================================================================= */}
        <aside className="lg:col-span-4 xl:col-span-3 space-y-5 sticky top-20">
          <div className="bg-white rounded-3xl border border-[#E8E2DB] p-5 md:p-6 shadow-xs space-y-5">
            {/* Header Palette */}
            <div className="flex items-center justify-between border-b border-[#E8E2DB] pb-3.5">
              <h3 className="text-sm font-black text-[#18181B] tracking-tight flex items-center gap-2">
                <GoogleIcon name="grid_view" className="text-base text-[#B91B1C]" filled />
                <span>{tr("Bảng tiến độ câu hỏi")}</span>
              </h3>
              <span className="text-xs font-mono font-black text-[#B91B1C] bg-[#FDF1F1] px-2.5 py-0.5 rounded-full border border-[#F6D0D0]">
                {Math.round((answeredCount / allQuestions.length) * 100)}%
              </span>
            </div>

            {/* Thanh tiến độ trực quan */}
            <div className="w-full bg-[#E8E2DB] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#B91B1C] h-full rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / allQuestions.length) * 100}%` }}
              />
            </div>

            {/* Chú giải trạng thái (Legend) */}
            <div className="grid grid-cols-3 gap-2 text-[10px] text-[#5F6368] font-bold border-b border-[#E8E2DB] pb-3.5">
              <button
                type="button"
                onClick={() => setPaletteFilter('all')}
                className={`flex items-center gap-1.5 p-1 rounded-lg transition-colors cursor-pointer ${
                  paletteFilter === 'all' ? 'bg-[#F4EFEA] text-[#18181B]' : 'hover:bg-neutral-50'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-md bg-[#B91B1C]" />
                <span>{tr("Đã làm (")}{answeredCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setPaletteFilter('unanswered')}
                className={`flex items-center gap-1.5 p-1 rounded-lg transition-colors cursor-pointer ${
                  paletteFilter === 'unanswered' ? 'bg-[#F4EFEA] text-[#18181B]' : 'hover:bg-neutral-50'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-md bg-white border border-[#DDD6CE]" />
                <span>{tr("Chưa (")}{allQuestions.length - answeredCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setPaletteFilter('flagged')}
                className={`flex items-center gap-1.5 p-1 rounded-lg transition-colors cursor-pointer ${
                  paletteFilter === 'flagged' ? 'bg-[#F4EFEA] text-[#18181B]' : 'hover:bg-neutral-50'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-md bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700">
                  <GoogleIcon name="flag" className="text-[10px]" filled />
                </span>
                <span>{tr("Cờ (")}{flaggedIds.size})</span>
              </button>
            </div>

            {/* Nhóm các câu theo Kỹ năng */}
            {exam.sections.map((sec) => (
              <div key={sec.skill} className="space-y-2.5">
                <h4 className="text-xs font-black text-[#747775] uppercase tracking-wider flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {sec.skill === 'listening' && <GoogleIcon name="headphones" className="text-sm text-[#B91B1C]" filled />}
                    {sec.skill === 'reading' && <GoogleIcon name="menu_book" className="text-sm text-[#188A5A]" filled />}
                    {sec.skill === 'writing' && <GoogleIcon name="edit_note" className="text-sm text-[#2563EB]" filled />}
                    <span>{sec.title}</span>
                  </div>
                </h4>

                <div className="grid grid-cols-5 gap-2">
                  {sec.questions.map((q) => {
                    const globalIdx = allQuestions.findIndex((item) => item.id === q.id);
                    const isAnswered = Boolean(answers[q.id]);
                    const isCurrent = globalIdx === currentIndex;
                    const isFlagged = flaggedIds.has(q.id);

                    // Lọc hiển thị nếu thí sinh chọn filter
                    const isDimmed =
                      (paletteFilter === 'unanswered' && isAnswered) ||
                      (paletteFilter === 'flagged' && !isFlagged);

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setCurrentIndex(globalIdx)}
                        className={`h-10 rounded-xl font-mono text-xs font-bold transition-all relative flex items-center justify-center cursor-pointer ${
                          isDimmed ? 'opacity-30' : 'opacity-100'
                        } ${
                          isCurrent
                            ? 'ring-2 ring-[#18181B] scale-105 shadow-sm font-black'
                            : ''
                        } ${
                          isAnswered
                            ? 'bg-[#B91B1C] text-white shadow-2xs'
                            : 'bg-[#F4EFEA] hover:bg-neutral-200 text-[#18181B] border border-[#E8E2DB]'
                        }`}
                      >
                        <span>{q.order}</span>
                        {isFlagged && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* CẶP NÚT ĐIỀU HƯỚNG CÂU HỎI (CÂU TRƯỚC / CÂU TIẾP) */}
            <div className="pt-3 border-t border-[#E8E2DB] space-y-2">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="h-11 px-3 rounded-2xl border-2 border-[#DDD6CE] hover:border-[#B91B1C] bg-white text-xs font-bold text-[#18181B] flex items-center justify-center gap-1.5 transition-all disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer shadow-2xs hover:bg-[#F7F3EE] active:scale-95"
                  title={tr("Về câu hỏi trước (Phím ←)")}
                >
                  <GoogleIcon name="arrow_back" className="text-base" />
                  <span>{tr("Câu trước")}</span>
                </button>

                <button
                  type="button"
                  disabled={currentIndex === allQuestions.length - 1}
                  onClick={() => setCurrentIndex((prev) => Math.min(allQuestions.length - 1, prev + 1))}
                  className="h-11 px-3 rounded-2xl bg-[#18181B] hover:bg-neutral-800 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer shadow-2xs active:scale-95"
                  title={tr("Sang câu tiếp theo (Phím →)")}
                >
                  <span>{tr("Câu tiếp")}</span>
                  <GoogleIcon name="arrow_forward" className="text-base text-white" />
                </button>
              </div>

              <div className="text-[11px] text-center font-medium text-[#747775]">{tr("Đang làm câu")} <strong className="text-[#18181B] font-bold">{currentIndex + 1}</strong> / {allQuestions.length} {tr("câu")}</div>
            </div>

            {/* Mẹo phím tắt Google Material Tip */}
            <div className="p-3 rounded-2xl bg-[#FFF9F5] border border-[#F5DDD6] flex items-center gap-2 text-[11px] text-[#747775]">
              <GoogleIcon name="keyboard" className="text-base text-amber-600" />
              <span>{tr("Phím tắt: Dùng")} <strong>←</strong> <strong>→</strong> {tr("để đổi câu, bấm")} <strong>1–4</strong> {tr("để chọn đáp án.")}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* ========================================================================= */}
      {submissionStarted && <div className="fixed inset-0 z-[160] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md space-y-4 shadow-2xl">
          <h2 className="text-xl font-black">{isSubmitting ? 'Đang nộp bài…' : 'Bài làm đang chờ nộp'}</h2>
          <p className="text-sm text-[#5F6368]">Câu trả lời được giữ lại cho đến khi máy chủ xác nhận kết quả.</p>
          {submitError && <p role="alert" className="text-sm text-red-700">{submitError}</p>}
          <button type="button" disabled={isSubmitting} onClick={() => void handleSubmitExam()} className="px-5 py-3 rounded-full bg-[#B91B1C] text-white font-bold disabled:opacity-50">{isSubmitting ? 'Đang xử lý…' : 'Thử nộp lại'}</button>
          {!isSubmitting && <button type="button" onClick={onExit} className="ml-3 text-sm underline">Về danh sách</button>}
        </div>
      </div>}
      {/* MODAL XÁC NHẬN NỘP BÀI (GOOGLE MATERIAL 3 DIALOG)                         */}
      {/* ========================================================================= */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-neutral-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-[#FFF2EE] text-[#B91B1C] flex items-center justify-center mx-auto">
              <GoogleIcon name="send" className="text-3xl text-[#B91B1C]" filled />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-xl font-black text-[#18181B] tracking-tight">{tr("Xác nhận nộp bài thi HSK?")}</h3>
              <p className="text-xs text-[#5F6368] leading-relaxed">{tr("Hệ thống sẽ tiến hành chấm điểm và tổng hợp phân tích báo cáo kết quả của bạn ngay lập tức.")}</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#F7F3EE] border border-[#E8E2DB] space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#5F6368]">{tr("Tổng số câu:")}</span>
                <span className="font-bold text-[#18181B]">{allQuestions.length} {tr("câu")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5F6368]">{tr("Số câu đã làm:")}</span>
                <span className="font-black text-[#188A5A]">{answeredCount} {tr("câu")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5F6368]">{tr("Số câu còn trống:")}</span>
                <span className="font-black text-[#B91B1C]">{allQuestions.length - answeredCount} {tr("câu")}</span>
              </div>
              {flaggedIds.size > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#5F6368]">{tr("Câu đang phân vân:")}</span>
                  <span className="font-bold text-amber-600 flex items-center gap-1">
                    <GoogleIcon name="flag" className="text-xs" filled />
                    {flaggedIds.size} {tr("câu")}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="flex-1 py-3 rounded-full border border-[#DDD6CE] hover:bg-neutral-100 text-xs font-bold text-[#18181B] transition-colors cursor-pointer"
              >{tr("Tiếp tục làm bài")}</button>
              <button
                type="button"
                onClick={() => {
                  setIsSubmitModalOpen(false);
                  handleSubmitExam();
                }}
                className="flex-1 py-3 rounded-full bg-[#B91B1C] hover:bg-[#991516] text-xs font-black text-white shadow-sm transition-colors cursor-pointer"
              >{tr("Nộp bài ngay")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL XÁC NHẬN RỜI PHÒNG THI                                              */}
      {/* ========================================================================= */}
      {isExitModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 md:p-7 shadow-2xl border border-neutral-200 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <GoogleIcon name="warning" className="text-2xl text-amber-600" filled />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#18181B]">{tr("Rời khỏi phòng thi?")}</h3>
              <p className="text-xs text-[#5F6368] mt-1 leading-relaxed">{tr("Tiến độ làm bài của bạn sẽ không được lưu nếu bạn rời khỏi phòng thi trước khi nộp bài.")}</p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsExitModalOpen(false)}
                className="flex-1 py-2.5 rounded-full border border-[#DDD6CE] text-xs font-bold hover:bg-neutral-50 cursor-pointer"
              >{tr("Ở lại làm bài")}</button>
              <button
                type="button"
                onClick={() => {
                  cleanupStorage();
                  setIsExitModalOpen(false);
                  onExit();
                }}
                className="flex-1 py-2.5 rounded-full bg-neutral-900 text-white text-xs font-bold hover:bg-black cursor-pointer"
              >{tr("Xác nhận thoát")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
