import { useEffect, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Clock3, Search } from 'lucide-react';
import { getLearnerDashboard, getLearningActivity, listPublishedLessons, type LearnerDashboard, type LearningActivity, type LessonList } from '../api/learning';
import { InlineBanner } from './notifications';
import { listDueWords, listSavedWords, removeSavedWord, reviewSavedWord, type SavedVocabulary } from '../api/vocabulary';
import AIRecommendationSection from './AIRecommendationSection';
import VocabularyPage from './vocabulary/VocabularyPage';
import RoadmapPage from './RoadmapPage';

type Section = 'feed' | 'lessons' | 'saved' | 'vocabulary' | 'roadmap' | 'history';

export default function ConnectedLearner({ section, onSelectLesson, onOpenPreferences }: {
  section: Section;
  onSelectLesson: (id: string) => void;
  onOpenPreferences: () => void;
}) {
  const [catalog, setCatalog] = useState<LessonList | null>(null);
  const [dashboard, setDashboard] = useState<LearnerDashboard | null>(null);
  const [activity, setActivity] = useState<LearningActivity | null>(null);
  const [saved, setSaved] = useState<SavedVocabulary[]>([]);
  const [due, setDue] = useState<SavedVocabulary[]>([]);
  const [search, setSearch] = useState('');
  const [hsk, setHsk] = useState('');
  const [page, setPage] = useState(1);
  const [showAnswer, setShowAnswer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const requests = section === 'feed' || section === 'lessons'
      ? [listPublishedLessons({ q: search || undefined, hsk: hsk ? Number(hsk) : undefined, page, limit: 12 }).then(data => { if (active) setCatalog(data); }), ...(section === 'feed' ? [getLearnerDashboard().then(data => { if (active) setDashboard(data); })] : [])]
      : section === 'saved' || section === 'vocabulary'
        ? [listSavedWords().then(data => { if (active) setSaved(data.items); }), ...(section === 'saved' ? [listDueWords().then(data => { if (active) setDue(data.items); })] : [])]
        : section === 'roadmap'
          ? [getLearningActivity().then(data => { if (active) setActivity(data); }), getLearnerDashboard().then(data => { if (active) setDashboard(data); })]
          : [getLearnerDashboard().then(data => { if (active) setDashboard(data); })];
    void Promise.all(requests).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [section, search, hsk, page]);

  const mutate = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try {
      await action();
      const [savedResult, dueResult] = await Promise.all([listSavedWords(), listDueWords()]);
      setSaved(savedResult.items); setDue(dueResult.items); setShowAnswer(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Thao tác thất bại.'); }
    finally { setBusy(false); }
  };

  const controls = <div className="flex flex-wrap gap-2">
    <label className="flex items-center gap-2 rounded-xl border bg-white px-3"><Search className="w-4 h-4" /><input className="p-2 text-sm outline-none" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm kiếm" /></label>
    <select className="rounded-xl border bg-white p-2 text-sm" value={hsk} onChange={event => { setHsk(event.target.value); setPage(1); }} aria-label="Lọc HSK"><option value="">Mọi cấp HSK</option>{[1,2,3,4,5,6,7,8,9].map(level => <option key={level} value={level}>HSK {level}</option>)}</select>
  </div>;

  const pagination = (pages: number) => pages > 1 && <div className="flex items-center gap-3 justify-center pt-3">
    <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border bg-white p-2 disabled:opacity-40" aria-label="Trang trước"><ChevronLeft className="w-4 h-4" /></button>
    <span className="text-sm">Trang {page}/{pages}</span>
    <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg border bg-white p-2 disabled:opacity-40" aria-label="Trang sau"><ChevronRight className="w-4 h-4" /></button>
  </div>;

  return <div className="space-y-6">
    {error && <InlineBanner variant="error" message={error} />}
    {section === 'feed' && <>
      <div className="rounded-3xl bg-[#18181B] p-6 text-white md:p-8">
        <p className="text-sm text-red-300">Tiếp tục hành trình tiếng Trung</p>
        <h1 className="mt-1 text-2xl font-black">Bài học của bạn</h1>
        {dashboard?.continueLearning?.lessonId?._id ? <button type="button" onClick={() => onSelectLesson(dashboard.continueLearning!.lessonId!._id)} className="mt-4 rounded-xl bg-[#B91B1C] px-4 py-2 text-sm font-bold">Tiếp tục: {dashboard.continueLearning.lessonId.titleVi}</button>
          : <p className="mt-3 text-sm text-neutral-300">Chọn một bài học đã xuất bản để bắt đầu.</p>}
        {dashboard && <div className="mt-5 flex flex-wrap gap-5 text-sm"><span>{dashboard.metrics.completedLessons} bài hoàn thành</span><span>{dashboard.metrics.savedWords} từ đã lưu</span><span>{dashboard.metrics.dueWords} từ cần ôn</span></div>}
      </div>
      <AIRecommendationSection onSelectLessonId={onSelectLesson} onOpenPreferences={onOpenPreferences} />
    </>}
    {(section === 'feed' || section === 'lessons') && <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Kho bài học đã xuất bản</h2><p className="text-sm text-neutral-500">{catalog?.total ?? 0} bài học</p></div>{controls}</div>
      {loading && <p className="text-sm">Đang tải bài học…</p>}
      {!loading && catalog?.items.length === 0 && <p className="rounded-2xl bg-white p-6 text-sm">Chưa có bài học phù hợp.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{catalog?.items.map(lesson => <button key={lesson._id} type="button" onClick={() => onSelectLesson(lesson._id)} className="rounded-2xl border bg-white p-5 text-left hover:border-[#B91B1C]">
        <span className="text-xs font-bold text-[#B91B1C]">HSK {lesson.hsk} · {Math.round(lesson.durationSeconds / 60)} phút</span>
        <h3 className="mt-2 text-lg font-bold">{lesson.titleVi}</h3><p className="text-sm text-neutral-500">{lesson.titleZh} {lesson.pinyin && `· ${lesson.pinyin}`}</p>
        <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{lesson.descriptionVi}</p>
      </button>)}</div>{pagination(catalog?.pages ?? 0)}
    </section>}
    {section === 'saved' && <section className="space-y-4"><h1 className="text-2xl font-black">Sổ từ và ôn tập</h1>
      {due.length > 0 && <div className="rounded-2xl border bg-white p-5 space-y-3"><p className="text-sm font-bold text-[#B91B1C]">Đến hạn ôn: {due.length} từ</p><h2 className="text-2xl font-black">{due[0].wordId?.hanzi}</h2>
        {showAnswer ? <><p className="text-sm">{due[0].wordId?.pinyin} · {due[0].wordId?.meaningVi}</p><div className="flex flex-wrap gap-2">{(['again','hard','good','easy'] as const).map(rating => <button key={rating} disabled={busy} onClick={() => void mutate(() => reviewSavedWord(due[0].wordId._id, rating))} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">{{ again: 'Chưa nhớ', hard: 'Khó', good: 'Nhớ', easy: 'Dễ' }[rating]}</button>)}</div></>
          : <button type="button" onClick={() => setShowAnswer(true)} className="rounded-lg bg-[#B91B1C] px-4 py-2 text-sm text-white">Xem đáp án</button>}
      </div>}
      {!loading && due.length === 0 && <p className="rounded-2xl bg-white p-5 text-sm">Không có từ đến hạn ôn.</p>}
      <div className="grid gap-3 sm:grid-cols-2">{saved.map(item => <div key={item._id} className="rounded-xl border bg-white p-4 flex justify-between gap-3"><div><p className="font-bold">{item.wordId?.hanzi}</p><p className="text-sm text-neutral-600">{item.wordId?.pinyin} · {item.wordId?.meaningVi}</p><p className="text-xs text-neutral-500">{item.sourceLessonId?.titleVi}</p></div><button type="button" disabled={busy} onClick={() => void mutate(() => removeSavedWord(item.wordId._id))} className="text-xs text-[#B91B1C]">Bỏ lưu</button></div>)}</div>
    </section>}
    {section === 'vocabulary' && (
      <VocabularyPage
        savedWords={saved}
        onStartReviewSession={() => {
          window.location.hash = '#saved';
        }}
        onRemoveWord={(wordId) => void mutate(() => removeSavedWord(wordId))}
      />
    )}
    {section === 'roadmap' && (
      <RoadmapPage
        onSelectLesson={onSelectLesson}
        onStartPractice={() => onSelectLesson('17')}
      />
    )}
    {section === 'history' && <section className="space-y-4"><h1 className="text-2xl font-black">Lịch sử học tập</h1>{dashboard?.recentProgress.length ? dashboard.recentProgress.map((item, index) => <button key={index} type="button" disabled={!item.lessonId?._id} onClick={() => onSelectLesson(item.lessonId!._id)} className="flex w-full items-center justify-between rounded-xl border bg-white p-4 text-left disabled:opacity-60"><span><BookOpen className="mr-2 inline w-4 h-4" />{item.lessonId?.titleVi ?? 'Bài học không còn khả dụng'}</span><span className="text-xs text-neutral-500"><Clock3 className="mr-1 inline w-3 h-3" />{item.completed ? 'Hoàn thành' : `${Math.round(item.lastPositionSeconds)} giây`}</span></button>) : <p className="rounded-xl bg-white p-5 text-sm">Chưa có lịch sử học tập.</p>}</section>}
  </div>;
}

