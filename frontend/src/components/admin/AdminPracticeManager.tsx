import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAdminPracticeSet, getAdminPracticeSets, saveAdminPracticeSet, skillLabels, type PracticeQuestion, type PracticeSetInput, type PracticeSkill } from '../../api/practice';

const field = 'w-full rounded-xl border border-[#E7E7EA] p-3';
const button = 'min-h-11 rounded-xl border px-4 py-2 font-bold disabled:opacity-40';
const freshQuestion = (): PracticeQuestion => ({ id: crypto.randomUUID(), type: 'choice', prompt: '', options: [{ id: 'a', text: '' }, { id: 'b', text: '' }], correctOptionId: 'a', acceptedAnswers: [], explanation: '' });
const freshSet = (): PracticeSetInput => ({ title: '', hsk: 1, skill: 'vocabulary', durationSeconds: 600, status: 'draft', questions: [freshQuestion()] });
export default function AdminPracticeManager() {
  const client = useQueryClient();
  const [hsk, setHsk] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<PracticeSetInput | null>(null);
  const [editingId, setEditingId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const list = useQuery({ queryKey: ['admin-practice', hsk, status, page], queryFn: ({ signal }) => getAdminPracticeSets({ hsk: hsk ? Number(hsk) : undefined, status: status || undefined, page }, signal) });
  const open = async (id: string) => { setBusy(true); setError(''); try { setEditor(await getAdminPracticeSet(id)); setEditingId(id); setReviewed(false); } catch (e) { setError(e instanceof Error ? e.message : 'Không tải được bộ luyện'); } finally { setBusy(false); } };
  const save = async (nextStatus: 'draft' | 'published') => {
    if (!editor || busy) return;
    setBusy(true); setError('');
    try {
      const saved = await saveAdminPracticeSet({ ...editor, status: nextStatus }, editingId);
      setEditor(saved); setEditingId(saved._id); setReviewed(false);
      await client.invalidateQueries({ queryKey: ['admin-practice'] });
      await client.invalidateQueries({ queryKey: ['practice', 'sets'] });
    } catch (e) { setError(e instanceof Error ? e.message : 'Không lưu được bộ luyện. Kiểm tra câu hỏi và đáp án.'); }
    finally { setBusy(false); }
  };
  const patchQuestion = (index: number, patch: Partial<PracticeQuestion>) => {
    setReviewed(false); setEditor(prev => prev ? { ...prev, questions: prev.questions.map((q, i) => i === index ? { ...q, ...patch } : q) } : null);
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      if (file.size > 900_000) throw new Error('Tệp tối đa 900 KB');
      const raw = JSON.parse(await file.text()) as PracticeSetInput;
      if (!raw || !Array.isArray(raw.questions) || !raw.questions.length || raw.questions.length > 50 || !Object.keys(skillLabels).includes(raw.skill) || typeof raw.title !== 'string' || !Number.isInteger(raw.hsk) || raw.hsk < 1 || raw.hsk > 9 || !Number.isFinite(raw.durationSeconds)) throw new Error('Tệp không đúng cấu trúc bộ luyện');
      const questions = raw.questions.map((q, i) => {
        if (!q || typeof q.prompt !== 'string' || !['choice', 'short_answer'].includes(q.type) || typeof q.explanation !== 'string' || (q.audioUrl !== undefined && typeof q.audioUrl !== 'string') || (q.acceptedAnswers !== undefined && (!Array.isArray(q.acceptedAnswers) || q.acceptedAnswers.some(a => typeof a !== 'string')))) throw new Error(`Câu ${i + 1} không hợp lệ`);
        const options = Array.isArray(q.options) ? q.options : [];
        if (options.some(o => !o || typeof o.id !== 'string' || typeof o.text !== 'string')) throw new Error(`Lựa chọn câu ${i + 1} không hợp lệ`);
        return { ...q, id: q.id || crypto.randomUUID(), options, acceptedAnswers: q.acceptedAnswers ?? [] };
      });
      setEditor({ title: raw.title, hsk: raw.hsk, skill: raw.skill, durationSeconds: raw.durationSeconds, status: 'draft', questions });
      setEditingId(undefined); setReviewed(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không đọc được tệp'); }
  };
  const download = () => {
    if (!editor) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(editor, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'bo-luyen-hsk.json'; link.click(); URL.revokeObjectURL(url);
  };
  return <div className="mx-auto max-w-5xl space-y-5 text-sm">
    <header className="rounded-2xl border bg-white p-5"><h1 className="text-2xl font-black">Bộ luyện kỹ năng HSK</h1><p className="mt-2 text-neutral-600">Soạn câu hỏi, kiểm tra đáp án rồi duyệt xuất bản. Sửa bộ luyện không thay đổi bài làm đã bắt đầu.</p></header>
    <div className="flex flex-wrap items-center gap-3"><button disabled={busy} className={button} onClick={() => { setEditor(freshSet()); setEditingId(undefined); setReviewed(false); setError(''); }}>Tạo bộ luyện</button><label className={button}>Import JSON<input aria-label="Import bộ luyện JSON" className="block max-w-64" type="file" accept=".json,application/json" onChange={e => void importFile(e.target.files?.[0])} /></label>
      <select aria-label="Lọc cấp HSK" className={button} value={hsk} onChange={e => { setHsk(e.target.value); setPage(1); }}><option value="">Tất cả HSK</option>{Array.from({ length: 9 }, (_, i) => <option key={i} value={i + 1}>HSK {i + 1}</option>)}</select><select aria-label="Lọc trạng thái" className={button} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="published">Đã xuất bản</option></select>
    </div>
    {(error || list.error) && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error || list.error?.message}</p>}
    {list.isPending && <p>Đang tải…</p>}
    <div className="rounded-2xl border bg-white p-4">{list.data?.items.length === 0 && <p>Chưa có bộ luyện.</p>}{list.data?.items.map(item => <button disabled={busy} key={item._id} className="flex w-full justify-between gap-3 border-b p-3 text-left" onClick={() => void open(item._id)}><span>{item.title} · HSK {item.hsk} · {skillLabels[item.skill]}</span><span>{item.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}</span></button>)}</div>
    <div className="flex justify-end gap-3"><button className={button} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Trước</button><span>{page}/{list.data?.totalPages ?? 1}</span><button className={button} disabled={page >= (list.data?.totalPages ?? 1)} onClick={() => setPage(p => p + 1)}>Sau</button></div>
    {editor && <form className="space-y-5 rounded-2xl border bg-white p-5" onSubmit={e => { e.preventDefault(); void save('draft'); }}>
      <fieldset disabled={busy} className="space-y-4" onChange={() => setReviewed(false)}>
        <h2 className="text-xl font-bold">{editingId ? `Chỉnh sửa · phiên bản ${editor.revision}` : 'Bộ luyện mới'}</h2>
        <label className="block">Tên bộ luyện<input required maxLength={160} className={field} value={editor.title} onChange={e => setEditor({ ...editor, title: e.target.value })} /></label>
        <div className="grid gap-3 sm:grid-cols-3"><label>Cấp HSK<select className={field} value={editor.hsk} onChange={e => setEditor({ ...editor, hsk: Number(e.target.value) })}>{Array.from({ length: 9 }, (_, i) => <option key={i} value={i + 1}>HSK {i + 1}</option>)}</select></label><label>Kỹ năng<select className={field} value={editor.skill} onChange={e => setEditor({ ...editor, skill: e.target.value as PracticeSkill })}>{Object.entries(skillLabels).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Thời gian (phút)<input required type="number" min={1} max={120} className={field} value={editor.durationSeconds / 60} onChange={e => setEditor({ ...editor, durationSeconds: Number(e.target.value) * 60 })} /></label></div>
        {editor.questions.map((q, i) => <section key={q.id} className="space-y-3 rounded-xl border p-4"><div className="flex justify-between"><h3 className="font-bold">Câu {i + 1}</h3><button className={button} type="button" disabled={editor.questions.length <= 1} onClick={() => { setEditor({ ...editor, questions: editor.questions.filter((_, j) => j !== i) }); setReviewed(false); }}>Xóa câu</button></div>
          <select aria-label={`Dạng câu ${i + 1}`} className={field} value={q.type} onChange={e => patchQuestion(i, { type: e.target.value as PracticeQuestion['type'] })}><option value="choice">Trắc nghiệm</option><option value="short_answer">Đáp án ngắn xác định</option></select>
          <label className="block">Nội dung<textarea required className={field} value={q.prompt} onChange={e => patchQuestion(i, { prompt: e.target.value })} /></label>
          <label className="block">Audio HTTPS {editor.skill === 'listening' ? '(bắt buộc)' : '(tùy chọn)'}<input type="url" required={editor.skill === 'listening'} className={field} value={q.audioUrl ?? ''} onChange={e => patchQuestion(i, { audioUrl: e.target.value || undefined })} /></label>
          {q.type === 'choice' ? <div className="space-y-2">{q.options.map((o, j) => <label key={o.id} className="flex items-center gap-3"><input aria-label={`Đáp án đúng ${i + 1}-${j + 1}`} type="radio" name={`correct-${q.id}`} checked={q.correctOptionId === o.id} onChange={() => patchQuestion(i, { correctOptionId: o.id })} /><input aria-label={`Lựa chọn ${i + 1}-${j + 1}`} required className={field} value={o.text} onChange={e => patchQuestion(i, { options: q.options.map((opt, k) => k === j ? { ...opt, text: e.target.value } : opt) })} /></label>)}<button type="button" className={button} disabled={q.options.length >= 6} onClick={() => patchQuestion(i, { options: [...q.options, { id: crypto.randomUUID(), text: '' }] })}>Thêm lựa chọn</button><p>Chọn nút tròn bên cạnh đáp án đúng.</p></div>
            : <label className="block">Đáp án chấp nhận (mỗi dòng một đáp án)<textarea required className={field} value={q.acceptedAnswers?.join('\n') ?? ''} onChange={e => patchQuestion(i, { acceptedAnswers: e.target.value.split('\n') })} /></label>}
          <label className="block">Giải thích tiếng Việt<textarea required className={field} value={q.explanation ?? ''} onChange={e => patchQuestion(i, { explanation: e.target.value })} /></label>
        </section>)}
        <button type="button" className={button} disabled={editor.questions.length >= 50} onClick={() => { setEditor({ ...editor, questions: [...editor.questions, freshQuestion()] }); setReviewed(false); }}>Thêm câu hỏi</button>
      </fieldset>
      <label className="block"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} /> Tôi đã kiểm tra nội dung, đáp án và audio để xuất bản.</label>
      <div className="flex flex-wrap gap-3"><button className={button} disabled={busy} type="submit" formNoValidate>Lưu bản nháp / Ẩn</button><button className={`${button} bg-[#B91B1C] text-white`} type="button" disabled={busy || !reviewed} onClick={e => { if (e.currentTarget.form?.reportValidity()) void save('published'); }}>Duyệt xuất bản</button><button type="button" className={button} onClick={download}>Xuất JSON</button></div>
    </form>}
  </div>;
}
