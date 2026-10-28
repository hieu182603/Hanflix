import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ClipboardList, Copy, Edit2, Filter, Layers, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { Spinner, useNotification } from '../notifications';
import { AdminSearchBar } from './AdminSearchBar';
import AdminPaginationBar, { DEFAULT_ADMIN_PAGE_SIZE } from './AdminPaginationBar';
import AdminExamEditorModal, { EXAM_CATEGORY_LABELS, emptyExam } from './AdminExamEditorModal';
import AdminExamAiModal from './AdminExamAiModal';
import {
  createAdminExam,
  deleteAdminExam,
  getAdminExam,
  getAdminExamList,
  getAdminExamStats,
  setAdminExamPublished,
  updateAdminExam,
  type AdminExamInput,
  type AdminExamStats,
  type AdminExamSummary,
  type ExamCategory,
  type GenerateAdminExamResponse,
} from '../../api/exams';

const HSK_LEVELS = ['1', '2', '3', '4', '5', '6'] as const;

const HSK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '1': { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  '2': { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  '3': { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  '4': { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  '5': { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  '6': { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
};

type EditorState =
  | { mode: 'create'; initial: AdminExamInput; notice?: { title: string; items: string[] } }
  | { mode: 'edit'; id: string; initial: AdminExamInput; attemptCount: number };

export default function AdminExamManager() {
  const notify = useNotification();
  const [stats, setStats] = useState<AdminExamStats | null>(null);
  const [items, setItems] = useState<AdminExamSummary[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: DEFAULT_ADMIN_PAGE_SIZE, total: 0, totalPages: 1 });
  const [pageSize, setPageSize] = useState(DEFAULT_ADMIN_PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const fetchStats = async () => {
    try {
      setStats(await getAdminExamStats());
    } catch (err) {
      console.error('Failed to load exam stats', err);
    }
  };

  const listRequest = useRef(0);
  const fetchList = async (page = 1, limit = pageSize) => {
    const request = ++listRequest.current;
    setLoading(true);
    try {
      const res = await getAdminExamList({
        page,
        limit,
        level: levelFilter || undefined,
        category: categoryFilter || undefined,
        status: statusFilter,
        search: searchQuery.trim() || undefined,
      });
      if (request !== listRequest.current) return;
      setItems(res.items);
      setPagination(res.pagination);
    } catch (err) {
      if (request !== listRequest.current) return;
      setItems([]);
      console.error('Failed to load exam list', err);
    } finally {
      if (request === listRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchList(1);
    return () => { ++listRequest.current; };
  }, [levelFilter, categoryFilter, statusFilter, searchQuery]);

  const refresh = () => {
    fetchStats();
    fetchList(pagination.page);
  };

  const openCreate = () => {
    setEditor({ mode: 'create', initial: emptyExam(levelFilter ? Number(levelFilter) : 1) });
  };

  const handleAiDraft = ({ exam, references, warnings }: GenerateAdminExamResponse) => {
    setAiOpen(false);
    const basis = references.length ? `Tham khảo: ${references.map(r => r.code).join(', ')}.` : 'Không có đề tham khảo cùng cấp.';
    setEditor({
      mode: 'create',
      initial: exam,
      notice: { title: `Bản nháp do Panda AI soạn — kiểm tra kỹ nội dung và đáp án trước khi lưu. ${basis}`, items: warnings },
    });
    if (warnings.length) notify.warning(`Panda AI đã tạo đề, có ${warnings.length} lưu ý cần xem.`);
    else notify.success(`Panda AI đã soạn xong ${exam.totalQuestions} câu hỏi.`);
  };

  // List rows carry metadata only; the editor needs the full document with answer keys.
  const loadDetail = async (item: AdminExamSummary) => {
    setOpeningId(item.id);
    try {
      return await getAdminExam(item.id);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Không thể tải chi tiết đề thi');
      return null;
    } finally {
      setOpeningId(null);
    }
  };

  const openEdit = async (item: AdminExamSummary) => {
    const detail = await loadDetail(item);
    if (!detail) return;
    const { id, attemptCount, ...initial } = detail;
    setEditor({ mode: 'edit', id, initial, attemptCount });
  };

  const openDuplicate = async (item: AdminExamSummary) => {
    const detail = await loadDetail(item);
    if (!detail) return;
    const { id: _id, attemptCount: _count, ...initial } = detail;
    setEditor({
      mode: 'create',
      initial: { ...initial, code: `${initial.code}-COPY`.slice(0, 80), title: `${initial.title} (bản sao)`, isPublished: false },
    });
  };

  const handleSave = async (exam: AdminExamInput) => {
    if (!editor) return;
    setSaving(true);
    try {
      if (editor.mode === 'edit') {
        await updateAdminExam(editor.id, exam);
        notify.success(`Đã cập nhật đề thi "${exam.code}".`);
      } else {
        await createAdminExam(exam);
        notify.success(`Đã tạo đề thi "${exam.code}".`);
      }
      setEditor(null);
      refresh();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu đề thi');
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (item: AdminExamSummary) => {
    const next = !item.isPublished;
    try {
      await setAdminExamPublished(item.id, next);
      setItems(prev => prev.map(it => (it.id === item.id ? { ...it, isPublished: next } : it)));
      fetchStats();
      notify.success(next ? `Đã xuất bản đề "${item.code}".` : `Đã ẩn đề "${item.code}" khỏi học viên.`);
    } catch {
      notify.error('Không thể cập nhật trạng thái đề thi');
    }
  };

  const handleDelete = async (item: AdminExamSummary) => {
    if (!await notify.confirm({
      title: 'Xóa đề thi',
      message: item.attemptCount > 0
        ? `Đề "${item.code}" đã có ${item.attemptCount} lượt làm. Lịch sử bài làm của học viên vẫn được giữ lại, nhưng đề sẽ bị xóa vĩnh viễn. Tiếp tục?`
        : `Bạn có chắc muốn xóa vĩnh viễn đề "${item.code} — ${item.title}"?`,
      confirmText: 'Xóa đề',
      tone: 'danger',
    })) return;
    try {
      await deleteAdminExam(item.id);
      notify.success(`Đã xóa đề thi "${item.code}".`);
      fetchStats();
      fetchList(items.length === 1 && pagination.page > 1 ? pagination.page - 1 : pagination.page);
    } catch {
      notify.error('Không thể xóa đề thi');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-3xl border border-[#F2E4D8] bg-white p-6 shadow-2xs">
        <div className="pointer-events-none absolute -right-6 -bottom-8 select-none font-serif text-8xl font-black text-[#B91B1C]/5">
          考
        </div>
        <div className="relative z-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FDF1F1] text-[#B91B1C] shadow-2xs ring-1 ring-[#B91B1C]/20">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-[#2B2826]">Quản Lý Kho Đề Thi</h1>
                <span className="rounded-full border border-[#F9D2D2] bg-[#FDF1F1] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#B91B1C]">
                  HSK 1 - 6
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#8C827A]">
                Soạn, chỉnh sửa và xuất bản đề thi thử, đề rút gọn và đề luyện từng kỹ năng Nghe · Đọc · Viết.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <button
              onClick={refresh}
              disabled={loading}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-4 text-xs font-bold text-[#2B2826] shadow-2xs transition-all hover:border-[#B91B1C]/30 hover:bg-white disabled:opacity-40 active:scale-[0.98]"
            >
              <RefreshCw className={`h-4 w-4 text-[#8C827A] ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
            <button
              onClick={() => setAiOpen(true)}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#B91B1C]/30 bg-[#FDF1F1] px-4 text-xs font-bold text-[#B91B1C] shadow-2xs transition-all hover:bg-white active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4" />
              <span>Tạo Đề Bằng AI</span>
            </button>
            <button
              onClick={openCreate}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#B91B1C] px-4 text-xs font-bold text-white shadow-2xs shadow-[#B91B1C]/25 transition-all hover:bg-[#A3181A] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>Tạo Đề Thi Mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bento Strip (Total + HSK 1 to 6) */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
        <button
          onClick={() => setLevelFilter('')}
          className={`rounded-2xl border p-3 text-left transition-all active:scale-[0.98] ${
            levelFilter === '' ? 'border-[#2B2826] bg-[#2B2826] text-white shadow-2xs' : 'border-[#F2E4D8] bg-white hover:border-[#B91B1C]/40'
          }`}
        >
          <div className={`text-[10px] font-extrabold uppercase ${levelFilter === '' ? 'text-[#E5DCD3]' : 'text-[#8C827A]'}`}>Tất cả đề</div>
          <div className="mt-0.5 text-lg font-black">{stats ? stats.total.toLocaleString() : '—'}</div>
          {stats && (
            <div className={`text-[10px] font-bold ${levelFilter === '' ? 'text-[#E5DCD3]' : 'text-[#8C827A]'}`}>
              {stats.published} xuất bản · {stats.draft} nháp
            </div>
          )}
        </button>

        {HSK_LEVELS.map((lvl) => {
          const count = stats?.byLevel[lvl] ?? 0;
          const isSelected = levelFilter === lvl;
          const styling = HSK_COLORS[lvl];
          return (
            <button
              key={lvl}
              onClick={() => setLevelFilter(isSelected ? '' : lvl)}
              className={`rounded-2xl border p-3 text-left transition-all active:scale-[0.98] ${
                isSelected ? 'border-transparent bg-[#FDF1F1]/50 shadow-xs ring-2 ring-[#B91B1C]' : 'border-[#F2E4D8] bg-white hover:border-[#B91B1C]/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-black ${styling.bg} ${styling.text} ${styling.border}`}>HSK {lvl}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-[#B91B1C]" />}
              </div>
              <div className="mt-1 text-lg font-black text-[#2B2826]">{count.toLocaleString()}</div>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-[#F2E4D8] bg-white p-4 shadow-2xs md:flex-row">
        <form onSubmit={(e) => { e.preventDefault(); fetchList(1); }} className="relative w-full md:max-w-md">
          <AdminSearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Tìm theo mã đề hoặc tên đề thi..." />
        </form>

        <div className="flex w-full flex-wrap items-center justify-between gap-3 md:w-auto md:justify-end">
          <div className="flex shrink-0 items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-[#8C827A]" />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="h-8 cursor-pointer rounded-lg border border-[#F2E4D8] bg-[#FFF9F5] px-2.5 text-xs font-bold text-[#2B2826] outline-none transition-colors hover:border-[#B91B1C]/40 focus:border-[#B91B1C]"
              aria-label="Lọc theo cấp độ HSK"
            >
              <option value="">Tất cả cấp độ</option>
              {HSK_LEVELS.map(l => <option key={l} value={l}>HSK {l}</option>)}
            </select>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 border-l border-[#F2E4D8] pl-3">
            <Layers className="h-3.5 w-3.5 text-[#8C827A]" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 cursor-pointer rounded-lg border border-[#F2E4D8] bg-[#FFF9F5] px-2.5 text-xs font-bold text-[#2B2826] outline-none transition-colors hover:border-[#B91B1C]/40 focus:border-[#B91B1C]"
              aria-label="Lọc theo loại đề"
            >
              <option value="">Tất cả loại đề</option>
              {(Object.keys(EXAM_CATEGORY_LABELS) as ExamCategory[]).map(c => <option key={c} value={c}>{EXAM_CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 border-l border-[#F2E4D8] pl-3">
            <Filter className="h-3.5 w-3.5 text-[#8C827A]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 cursor-pointer rounded-lg border border-[#F2E4D8] bg-[#FFF9F5] px-2.5 text-xs font-bold text-[#2B2826] outline-none transition-colors hover:border-[#B91B1C]/40 focus:border-[#B91B1C]"
              aria-label="Lọc theo trạng thái"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="published">Đã xuất bản (Published)</option>
              <option value="draft">Bản nháp (Draft)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Exam Table */}
      <div className="overflow-hidden rounded-3xl border border-[#F2E4D8] bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="border-b border-[#F2E4D8] bg-[#FFF9F5] text-[10px] font-bold uppercase tracking-wider text-[#8C827A]">
              <tr>
                <th className="p-4">Đề thi</th>
                <th className="w-[100px] p-4">Cấp độ</th>
                <th className="w-[150px] p-4">Loại đề</th>
                <th className="w-[150px] p-4">Cấu trúc</th>
                <th className="w-[90px] p-4">Lượt làm</th>
                <th className="w-[130px] p-4">Trạng thái</th>
                <th className="w-[130px] p-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2E4D8]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-[#8C827A]">
                    <div className="inline-flex items-center gap-2">
                      <Spinner size="sm" tone="brand" />
                      <span>Đang tải kho đề thi...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-[#8C827A]">
                    Không tìm thấy đề thi nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const styling = HSK_COLORS[String(item.level)] ?? HSK_COLORS['1'];
                  const busy = openingId === item.id;
                  return (
                    <tr key={item.id} className="transition-colors hover:bg-[#FFF9F5]/70">
                      <td className="p-4">
                        <div className="font-mono text-[11px] font-black text-[#B91B1C]">{item.code}</div>
                        <button type="button" onClick={() => void openEdit(item)} className="text-left text-sm font-black text-[#2B2826] hover:text-[#B91B1C]">
                          {item.title}
                        </button>
                        {item.description && <div className="mt-0.5 line-clamp-1 max-w-[380px] text-[11px] text-[#8C827A]">{item.description}</div>}
                      </td>
                      <td className="p-4">
                        <span className={`rounded-md border px-2.5 py-1 text-[10px] font-black ${styling.bg} ${styling.text} ${styling.border}`}>HSK {item.level}</span>
                      </td>
                      <td className="p-4">
                        <span className="rounded border border-[#F2E4D8] bg-[#FFF9F5] px-2 py-0.5 text-[10px] font-bold text-[#6E655F]">
                          {EXAM_CATEGORY_LABELS[item.category] ?? item.category}
                        </span>
                      </td>
                      <td className="p-4 text-[11px] text-[#2B2826]">
                        <div className="font-bold">{item.totalQuestions} câu · {item.durationMinutes} phút</div>
                        <div className="text-[#8C827A]">Đạt {item.passingScore}/{item.totalScore} điểm</div>
                      </td>
                      <td className="p-4 font-bold text-[#2B2826]">{item.attemptCount.toLocaleString()}</td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => void togglePublished(item)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition-all ${
                            item.isPublished
                              ? 'border-[#C6E7DA] bg-[#EAF5F1] text-[#188A5A] hover:bg-[#D4EFE4]'
                              : 'border-[#E5DCD3] bg-[#F4EFEA] text-[#6E655F] hover:bg-[#ECE4DC]'
                          }`}
                          title="Bấm để chuyển đổi giữa Xuất bản và Bản nháp"
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${item.isPublished ? 'bg-[#188A5A]' : 'bg-[#8C827A]'}`} />
                          <span>{item.isPublished ? 'Published' : 'Draft'}</span>
                        </button>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => void openEdit(item)}
                            disabled={busy}
                            className="rounded-lg border border-[#F2E4D8] bg-white p-1.5 text-[#8C827A] transition-colors hover:bg-[#FFF9F5] hover:text-[#2B2826] disabled:opacity-50"
                            title="Chỉnh sửa đề thi"
                            aria-label={`Chỉnh sửa đề ${item.code}`}
                          >
                            {busy ? <Spinner size="sm" tone="muted" /> : <Edit2 className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => void openDuplicate(item)}
                            disabled={busy}
                            className="rounded-lg border border-[#F2E4D8] bg-white p-1.5 text-[#8C827A] transition-colors hover:bg-[#FFF9F5] hover:text-[#2B2826] disabled:opacity-50"
                            title="Nhân bản đề thi"
                            aria-label={`Nhân bản đề ${item.code}`}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => void handleDelete(item)}
                            className="rounded-lg border border-[#F2E4D8] bg-white p-1.5 text-[#8C827A] transition-colors hover:bg-[#FDF1F1] hover:text-[#B91B1C]"
                            title="Xóa đề thi"
                            aria-label={`Xóa đề ${item.code}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdminPaginationBar
        total={pagination.total}
        page={pagination.page}
        pageSize={pageSize}
        visibleCount={items.length}
        unitLabel="đề thi"
        disabled={loading}
        ariaLabel="Phân trang đề thi"
        onPageChange={(page) => fetchList(page)}
        onPageSizeChange={(size) => {
          setPageSize(size);
          fetchList(1, size);
        }}
      />

      {aiOpen && (
        <AdminExamAiModal
          defaultLevel={levelFilter ? Number(levelFilter) : 1}
          onClose={() => setAiOpen(false)}
          onGenerated={handleAiDraft}
        />
      )}

      {editor && (
        <AdminExamEditorModal
          mode={editor.mode}
          initial={editor.initial}
          attemptCount={editor.mode === 'edit' ? editor.attemptCount : 0}
          saving={saving}
          notice={editor.mode === 'create' ? editor.notice : undefined}
          onClose={() => setEditor(null)}
          onSave={(exam) => void handleSave(exam)}
        />
      )}
    </div>
  );
}
