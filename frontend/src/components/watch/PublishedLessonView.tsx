import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { explainWord, getPublishedLesson, getPublishedSubtitles, type PublishedLesson, type SubtitleCue, type WordExplanation } from '../../api/learning';
import { ApiRequestError } from '../../api/client';
import { recordLearningActivity } from '../../lib/streak';

export default function PublishedLessonView({ lessonId, onBack }: { lessonId: string; onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [lesson, setLesson] = useState<PublishedLesson | null>(null);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [currentMs, setCurrentMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [explanation, setExplanation] = useState<WordExplanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explanationError, setExplanationError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setLesson(null);
    setCues([]);
    setExplanation(null);
    void Promise.allSettled([getPublishedLesson(lessonId), getPublishedSubtitles(lessonId)]).then(([lessonResult, subtitleResult]) => {
      if (!active) return;
      if (lessonResult.status === 'rejected') {
        setError(lessonResult.reason instanceof ApiRequestError ? lessonResult.reason.message : 'Không thể tải bài học.');
      } else {
        setLesson(lessonResult.value);
        if (subtitleResult.status === 'fulfilled') setCues(subtitleResult.value);
        recordLearningActivity('video');
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [lessonId]);

  const activeCue = cues.find(cue => cue.startMs <= currentMs && currentMs < cue.endMs);

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
    {error && <p className="rounded-2xl bg-red-50 border border-red-200 p-6 text-sm text-red-800" role="alert">{error}</p>}
    {lesson && <>
      <div>
        <p className="text-xs font-bold text-[#B91B1C]">HSK {lesson.hsk} · Bài học đã xuất bản</p>
        <h1 className="text-2xl md:text-3xl font-black mt-1">{lesson.titleVi}</h1>
        {lesson.titleZh && <p className="text-neutral-600 mt-1">{lesson.titleZh} · {lesson.pinyin}</p>}
        {lesson.descriptionVi && <p className="text-sm text-neutral-600 mt-2">{lesson.descriptionVi}</p>}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-5">
        <div className="space-y-4">
          {lesson.media?.url ? <div className="relative rounded-2xl overflow-hidden bg-black">
            <video ref={videoRef} controls preload="metadata" src={lesson.media.url} className="w-full aspect-video" aria-label={`Video ${lesson.titleVi}`}
              onTimeUpdate={event => setCurrentMs(event.currentTarget.currentTime * 1000)} />
            {activeCue && <div className="pointer-events-none absolute bottom-12 left-4 right-4 text-center text-white bg-black/70 rounded-xl p-2">
              <p className="text-lg font-bold">{activeCue.zh}</p>
              <p className="text-sm">{activeCue.pinyin}</p>
              <p className="text-sm">{activeCue.vi}</p>
            </div>}
          </div> : <p className="rounded-2xl bg-neutral-900 p-8 text-white">Video của bài học này chưa sẵn sàng để phát.</p>}
          <p className="text-xs text-neutral-500">Chọn từ trong phụ đề bên cạnh để xem nghĩa và cách dùng theo ngữ cảnh.</p>
        </div>
        <div className="rounded-2xl bg-white border border-[#E7E7EA] p-4 max-h-[540px] overflow-y-auto">
          <h2 className="font-bold mb-3">Phụ đề và từ vựng</h2>
          {cues.length === 0 && <p className="text-sm text-neutral-600">Bài học chưa có phụ đề khả dụng.</p>}
          <div className="space-y-3">
            {cues.map(cue => <div key={cue.cueId} className={`rounded-xl border p-3 ${cue.cueId === activeCue?.cueId ? 'border-[#B91B1C] bg-red-50' : 'border-neutral-200'}`}>
              <button type="button" onClick={() => { if (videoRef.current) videoRef.current.currentTime = cue.startMs / 1000; }}
                className="text-xs text-[#B91B1C] font-semibold mb-1">{Math.floor(cue.startMs / 60000)}:{String(Math.floor(cue.startMs / 1000) % 60).padStart(2, '0')}</button>
              <p className="text-base font-bold">{cue.tokens.length ? cue.tokens.map((token, index) => token.wordId?._id
                ? <button key={`${cue.cueId}-${index}`} type="button" onClick={() => void requestExplanation(cue.cueId, token.wordId!._id)}
                    className="hover:text-[#B91B1C] hover:underline" title={`Giải thích ${token.text}`}>{token.text}</button>
                : <span key={`${cue.cueId}-${index}`}>{token.text}</span>) : cue.zh}</p>
              <p className="text-xs text-neutral-500">{cue.pinyin}</p>
              <p className="text-xs text-neutral-700">{cue.vi}</p>
            </div>)}
          </div>
        </div>
      </div>
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
