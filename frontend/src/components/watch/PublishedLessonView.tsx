import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { explainWord, getLessonProgress, getLessonQuiz, getPublishedLesson, getPublishedSubtitles, submitLessonQuiz, updateLessonProgress, type LessonProgress, type LearningTip, type PublicQuestion, type QuizResult, type PublishedLesson, type SubtitleCue, type WordExplanation } from '../../api/learning';
import { InlineBanner } from '../notifications';
import { saveSubtitleWord } from '../../api/vocabulary';
import { ApiRequestError } from '../../api/client';
import { SubtitleOverlay, type SubtitleLanguageTrack } from './SubtitleOverlay';
import { SubtitleTrackPicker } from './SubtitleTrackPicker';
import SubtitleToggleButton from './SubtitleToggleButton';
import LearningTipsPanel from './LearningTipsPanel';
import AiImprovedBadge from './AiImprovedBadge';
import { useSubtitlePreferences } from '../../hooks/useSubtitlePreferences';

export default function PublishedLessonView({ lessonId, onBack, subtitlePreference = 'all' }: { lessonId: string; onBack: () => void; subtitlePreference?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [lesson, setLesson] = useState<PublishedLesson | null>(null);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [translationImproved, setTranslationImproved] = useState(false);
  const [learningTips, setLearningTips] = useState<LearningTip[]>([]);
  const [drillWords, setDrillWords] = useState<string[]>([]);
  const [currentMs, setCurrentMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [explanation, setExplanation] = useState<WordExplanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explanationError, setExplanationError] = useState('');
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [quiz, setQuiz] = useState<PublicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizBusy, setQuizBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pendingRange = useRef<{ start: number; end: number } | null>(null);
  const lastPosition = useRef<number | null>(null);
  const lastFlush = useRef(0);
  const progressRequest = useRef<Promise<void>>(Promise.resolve());
  const quizAttemptKey = useRef(crypto.randomUUID());

  const { prefs: subtitlePrefs, setTop: setSubtitleTop, setBottom: setSubtitleBottom, setStyle: setSubtitleStyle } = useSubtitlePreferences();
  const setSubtitleTracks = useCallback(
    (next: { top: SubtitleLanguageTrack; bottom: SubtitleLanguageTrack }) => {
      setSubtitleTop(next.top);
      setSubtitleBottom(next.bottom);
    },
    [setSubtitleTop, setSubtitleBottom],
  );

  const flushProgress = (position: number) => {
    const range = pendingRange.current;
    pendingRange.current = null;
    lastFlush.current = Date.now();
    if (!range) return;
    const duration = lesson?.durationSeconds ?? position;
    const boundedPosition = Math.min(Math.max(position, 0), duration);
    progressRequest.current = progressRequest.current.catch(() => undefined).then(async () => {
      const result = await updateLessonProgress(lessonId, {
        positionSeconds: boundedPosition,
        watchedRange: { start: Math.max(0, range.start), end: Math.min(range.end, duration) },
        activeStudyDeltaSeconds: Math.min(120, Math.max(0, Math.round(range.end - range.start))),
      });
      setProgress(previous => previous ? { ...previous, coverage: result.coverage, completed: result.coverage >= 0.9 } : previous);
      window.dispatchEvent(new Event('hanflix:activity-updated'));
    }).catch(() => setMessage('Chưa lưu được tiến độ. Hãy thử phát lại video.'));
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setLesson(null);
    setCues([]);
    setTranslationImproved(false);
    setLearningTips([]);
    setDrillWords([]);
    setExplanation(null);
    setProgress(null);
    setQuiz([]);
    setQuizResult(null);
    pendingRange.current = null;
    lastPosition.current = null;
    quizAttemptKey.current = crypto.randomUUID();
    void Promise.allSettled([getPublishedLesson(lessonId), getPublishedSubtitles(lessonId), getLessonProgress(lessonId), getLessonQuiz(lessonId)]).then(([lessonResult, subtitleResult, progressResult, quizResult]) => {
      if (!active) return;
      if (lessonResult.status === 'rejected') {
        setError(lessonResult.reason instanceof ApiRequestError ? lessonResult.reason.message : 'Không thể tải bài học.');
      } else {
        setLesson(lessonResult.value);
        if (subtitleResult.status === 'fulfilled') {
          const track = subtitleResult.value;
          setCues(track.cues ?? []);
          setTranslationImproved(Boolean(track.translationImproved));
          setLearningTips(track.learningTips ?? []);
          setDrillWords(track.drillWords ?? []);
        }
        if (progressResult.status === 'fulfilled') setProgress(progressResult.value);
        if (quizResult.status === 'fulfilled') setQuiz(quizResult.value.questions);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [lessonId]);

  const activeCue = cues.find(cue => cue.startMs <= currentMs && currentMs < cue.endMs);

  const onVideoTimeUpdate = (video: HTMLVideoElement) => {
    const position = video.currentTime;
    setCurrentMs(position * 1000);
    const previous = lastPosition.current;
    lastPosition.current = position;
    if (video.paused || previous === null) return;
    const delta = position - previous;
    if (delta <= 0 || delta > 3) return;
    const pending = pendingRange.current;
    if (pending && previous - pending.end < 1) pending.end = position;
    else {
      if (pending) flushProgress(previous);
      pendingRange.current = { start: previous, end: position };
    }
    if (Date.now() - lastFlush.current > 15000) flushProgress(position);
  };

  const submitQuiz = async () => {
    if (quiz.some(question => !answers[question.questionId]?.trim())) {
      setMessage('Hãy trả lời tất cả câu hỏi trước khi nộp.');
      return;
    }
    setQuizBusy(true);
    setMessage('');
    try {
      const result = await submitLessonQuiz(lessonId, quiz.map(question => ({
        questionId: question.questionId,
        ...(question.type === 'multiple_choice' ? { selectedOptionId: answers[question.questionId] } : { textAnswer: answers[question.questionId] }),
      })), quizAttemptKey.current);
      setQuizResult(result);
      window.dispatchEvent(new Event('hanflix:activity-updated'));
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : 'Không thể nộp bài.');
    } finally { setQuizBusy(false); }
  };

  const saveWord = async (cueId: string, wordId: string) => {
    setMessage('');
    try { await saveSubtitleWord(wordId, lessonId, cueId); setMessage('Đã lưu từ vào sổ ôn tập.'); }
    catch (requestError) { setMessage(requestError instanceof Error ? requestError.message : 'Không thể lưu từ.'); }
  };

  const requestExplanation = async (cueId: string, wordId: string) => {
    setExplaining(true);
    setExplanation(null);
    setExplanationError('');
    try {
      setExplanation(await explainWord(lessonId, cueId, wordId));
    } catch (requestError) {
      setExplanationError(requestError instanceof ApiRequestError ? requestError.message : 'Không thể giải thích từ này lúc này.');
    } finally {
      setExplaining(false);
    }
  };

  return <section className="max-w-6xl mx-auto space-y-5 pb-8">
    <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:text-[#B91B1C]">
      <ArrowLeft className="w-4 h-4" /> Quay lại gợi ý
    </button>
    {loading && <p className="rounded-2xl bg-white border border-neutral-200 p-6 text-sm">Đang tải bài học…</p>}
    {error && <div className="my-4"><InlineBanner variant="error" message={error} /></div>}
    {lesson && <>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold text-[#B91B1C]">HSK {lesson.hsk} · Bài học đã xuất bản</p>
          <AiImprovedBadge visible={translationImproved} size="sm" />
        </div>
        <h1 className="text-2xl md:text-3xl font-black mt-1">{lesson.titleVi}</h1>
        {lesson.titleZh && <p className="text-neutral-600 mt-1">{lesson.titleZh} · {lesson.pinyin}</p>}
        {lesson.descriptionVi && <p className="text-sm text-neutral-600 mt-2">{lesson.descriptionVi}</p>}
        {progress && <p className="text-xs text-neutral-600 mt-2">Đã xem {Math.round(progress.coverage * 100)}% · {progress.completed ? 'Hoàn thành bài học' : 'Đang học'}{progress.bestQuizScore !== null ? ` · Điểm cao nhất: ${progress.bestQuizScore}%` : ''}</p>}
      </div>

      {/* AI learning tips tailored to this lesson */}
      {(learningTips.length > 0 || drillWords.length > 0) && (
        <div className="mt-4">
          <LearningTipsPanel tips={learningTips} drillWords={drillWords} audience="learner" />
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-5">
        <div className="space-y-4">
          {lesson.media?.url ? <div className="relative rounded-2xl overflow-hidden bg-black">
            <video ref={videoRef} controls preload="metadata" src={lesson.media.url} className="w-full aspect-video" aria-label={`Video ${lesson.titleVi}`}
              onLoadedMetadata={event => {
                if (progress?.lastPositionSeconds && progress.lastPositionSeconds < lesson.durationSeconds - 2) event.currentTarget.currentTime = progress.lastPositionSeconds;
                const speed = Number(localStorage.getItem('hanflix_playback_speed') ?? 1);
                if ([0.75, 1, 1.25].includes(speed)) event.currentTarget.playbackRate = speed;
              }}
              onTimeUpdate={event => onVideoTimeUpdate(event.currentTarget)}
              onSeeking={() => { if (videoRef.current) { flushProgress(videoRef.current.currentTime); lastPosition.current = null; } }}
              onPause={() => { if (videoRef.current) flushProgress(videoRef.current.currentTime); }}
              onEnded={() => { flushProgress(lesson.durationSeconds); setQuizOpen(true); }} />
            <SubtitleOverlay
              cues={cues}
              currentMs={currentMs}
              topTrack={subtitlePrefs.top}
              bottomTrack={subtitlePrefs.bottom}
              style={subtitlePrefs.style}
              onTokenClick={(cueId, wordId) => void requestExplanation(cueId, wordId)}
              onSaveWord={(cueId, wordId) => void saveWord(cueId, wordId)}
            />
            <SubtitleToggleButton
              topTrack={subtitlePrefs.top}
              bottomTrack={subtitlePrefs.bottom}
              onQuickToggle={setSubtitleTracks}
            />
          </div> : <p className="rounded-2xl bg-neutral-900 p-8 text-white">Video của bài học này chưa sẵn sàng để phát.</p>}
          <SubtitleTrackPicker
            topTrack={subtitlePrefs.top}
            bottomTrack={subtitlePrefs.bottom}
            style={subtitlePrefs.style}
            onChangeTop={setSubtitleTop}
            onChangeBottom={setSubtitleBottom}
            onChangeStyle={setSubtitleStyle}
          />
          <p className="text-xs text-neutral-500">Bấm vào từ tiếng Trung trong phụ đề để xem nghĩa và cách dùng theo ngữ cảnh. Tuỳ chỉnh hiển thị được lưu tự động cho lần xem sau.</p>
          {quiz.length > 0 && <button type="button" onClick={() => setQuizOpen(value => !value)} className="rounded-xl bg-[#B91B1C] px-4 py-2 text-sm font-bold text-white">{quizOpen ? 'Ẩn bài luyện tập' : 'Làm bài luyện tập'}</button>}
        </div>
        <div className="rounded-2xl bg-white border border-[#E7E7EA] p-4 max-h-[540px] overflow-y-auto">
          <h2 className="font-bold mb-3">Phụ đề và từ vựng</h2>
          {cues.length === 0 && <p className="text-sm text-neutral-600">Bài học chưa có phụ đề khả dụng.</p>}
          <div className="space-y-3">
            {cues.map(cue => <div key={cue.cueId} className={`rounded-xl border p-3 ${cue.cueId === activeCue?.cueId ? 'border-[#B91B1C] bg-red-50' : 'border-neutral-200'}`}>
              <button type="button" onClick={() => { if (videoRef.current) videoRef.current.currentTime = cue.startMs / 1000; }}
                className="text-xs text-[#B91B1C] font-semibold mb-1">{Math.floor(cue.startMs / 60000)}:{String(Math.floor(cue.startMs / 1000) % 60).padStart(2, '0')}</button>
              <p className="text-base font-bold">{cue.tokens?.length ? cue.tokens.map((token, index) => token.wordId?._id
                ? <span key={`${cue.cueId}-${index}`}><button type="button" onClick={() => void requestExplanation(cue.cueId, token.wordId!._id)}
                    className="hover:text-[#B91B1C] hover:underline" title={`Giải thích ${token.text}`}>{token.text}</button><button type="button" onClick={() => void saveWord(cue.cueId, token.wordId!._id)} className="text-xs text-[#B91B1C] ml-1" title={`Lưu ${token.text}`}>＋</button></span>
                : <span key={`${cue.cueId}-${index}`}>{token.text}</span>) : cue.zh}</p>
              {['all', 'zh_pinyin'].includes(subtitlePreference) && <p className="text-xs text-neutral-500">{cue.pinyin}</p>}
              {['all', 'zh_vi'].includes(subtitlePreference) && <p className="text-xs text-neutral-700">{cue.vi}</p>}
            </div>)}
          </div>
        </div>
      </div>
      {message && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
      {quizOpen && quiz.length > 0 && <div className="rounded-2xl border border-[#E7E7EA] bg-white p-5 space-y-5">
        <h2 className="font-bold text-lg">Bài luyện tập sau video</h2>
        {quiz.map((question, index) => <div key={question.questionId} className="space-y-2">
          <p className="font-semibold text-sm">{index + 1}. {question.prompt}</p>
          {question.type === 'multiple_choice' ? <div className="grid gap-2">{question.options.map(option => <label key={option.optionId} className="flex gap-2 text-sm"><input type="radio" name={question.questionId} checked={answers[question.questionId] === option.optionId} disabled={!!quizResult} onChange={() => setAnswers(current => ({ ...current, [question.questionId]: option.optionId }))} />{option.text}</label>)}</div>
            : <input className="w-full rounded-lg border p-2 text-sm" value={answers[question.questionId] ?? ''} disabled={!!quizResult} onChange={event => setAnswers(current => ({ ...current, [question.questionId]: event.target.value }))} placeholder="Nhập đáp án" />}
          {quizResult && <p className={`text-sm ${quizResult.answers[index]?.correct ? 'text-green-700' : 'text-red-700'}`}>{quizResult.answers[index]?.correct ? 'Đúng' : 'Chưa đúng'} · {quizResult.answers[index]?.explanationVi}</p>}
        </div>)}
        {quizResult ? <p className="font-bold">Kết quả: {quizResult.score}% ({quizResult.correctCount}/{quizResult.totalCount})</p>
          : <button type="button" disabled={quizBusy} onClick={() => void submitQuiz()} className="rounded-xl bg-[#B91B1C] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{quizBusy ? 'Đang nộp…' : 'Nộp bài'}</button>}
      </div>}
      {(explaining || explanation || explanationError) && <div className="rounded-2xl bg-white border border-[#E7E7EA] p-5" aria-live="polite">
        <h2 className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#B91B1C]" /> Giải thích từ vựng</h2>
        {explaining && <p className="text-sm mt-3">Panda AI đang phân tích từ…</p>}
        {explanationError && <p className="text-sm text-red-800 mt-3">{explanationError}</p>}
        {explanation && <div className="space-y-2 text-sm mt-3">
          <p><strong>Nghĩa:</strong> {explanation.meaningVi}</p>
          <p><strong>Cách dùng:</strong> {explanation.usageVi}</p>
          <p><strong>Ví dụ:</strong> {explanation.exampleZh} ({explanation.examplePinyin}) — {explanation.exampleVi}</p>
          {explanation.cautionVi && <p><strong>Lưu ý:</strong> {explanation.cautionVi}</p>}
        </div>}
      </div>}
    </>}
  </section>;
}
