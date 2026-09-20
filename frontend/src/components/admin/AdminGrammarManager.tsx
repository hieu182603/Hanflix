import React, { useState, useEffect } from 'react';
import { useNotification } from '../notifications';
import { Spinner } from '../notifications';
import { AdminSearchBar } from './AdminSearchBar';
import {
  FileText,
  Search,
  Plus,
  Filter,
  Edit2,
  Trash2,
  X,
  RefreshCw,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Volume2,
  Copy,
  Check,
} from 'lucide-react';
import {
  getAdminGrammarList,
  getAdminGrammarStats,
  createAdminGrammar,
  updateAdminGrammar,
  deleteAdminGrammar,
  GrammarItem,
  GrammarStats,
} from '../../api/grammar';
import AdminPaginationBar, { DEFAULT_ADMIN_PAGE_SIZE } from './AdminPaginationBar';

const HSK_LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

const HSK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '1': { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  '2': { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  '3': { bg: 'bg-[#EAF5F1]', text: 'text-[#188A5A]', border: 'border-[#C6E7DA]' },
  '4': { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  '5': { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  '6': { bg: 'bg-[#FFF8EC]', text: 'text-[#B45309]', border: 'border-[#FDE6BA]' },
  '7': { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
  '8': { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
  '9': { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
  '7-9': { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#F9D2D2]' },
};

export default function AdminGrammarManager() {
  const notify = useNotification();
  const [stats, setStats] = useState<GrammarStats | null>(null);
  const [items, setItems] = useState<GrammarItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: DEFAULT_ADMIN_PAGE_SIZE, total: 0, totalPages: 1 });
  const [pageSize, setPageSize] = useState(DEFAULT_ADMIN_PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [hskFilter, setHskFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Audio playback + clipboard
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GrammarItem | null>(null);

  // Streamlined Form State (Core fields only)
  const [formData, setFormData] = useState({
    structure: '',
    pattern: '',
    group: 'Cấu trúc câu',
    explanationVi: '',
    hskLevel: '1',
    exampleZh: '',
    examplePinyin: '',
    exampleVi: '',
    status: 'published' as 'published' | 'draft' | 'pending_review',
  });

  const fetchStats = async () => {
    try {
      const data = await getAdminGrammarStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load grammar stats', err);
    }
  };

  const fetchList = async (page = 1, limit = pageSize) => {
    setLoading(true);
    try {
      const res = await getAdminGrammarList({
        page,
        limit,
        hskLevel: hskFilter || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchQuery.trim() || undefined,
      });
      setItems(res.items);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to load grammar list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchList(1);
  }, [hskFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchList(1);
  };

  const playAudio = (text: string) => {
    if (!text) return;
    setSpeakingText(text);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 0.85;
      window.speechSynthesis.speak(u);
    }
    setTimeout(() => setSpeakingText(null), 1400);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      structure: '',
      pattern: '',
      group: 'Cấu trúc câu',
      explanationVi: '',
      hskLevel: hskFilter && HSK_LEVELS.includes(hskFilter as any) ? hskFilter : '1',
      exampleZh: '',
      examplePinyin: '',
      exampleVi: '',
      status: 'published',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: GrammarItem) => {
    setEditingItem(item);
    const ex = item.examples?.[0];
    setFormData({
      structure: item.structure,
      pattern: item.pattern || '',
      group: item.group || 'Cấu trúc câu',
      explanationVi: item.explanationVi,
      hskLevel: String(item.hskLevel),
      exampleZh: ex?.chinese || '',
      examplePinyin: ex?.pinyin || '',
      exampleVi: ex?.vietnamese || '',
      status: item.status,
    });
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.structure.trim() || !formData.explanationVi.trim()) {
      alert('Vui lòng điền đủ Cấu trúc ngữ pháp và Giải thích ý nghĩa.');
      return;
    }

    try {
      const payload: Partial<GrammarItem> = {
        structure: formData.structure.trim(),
        pattern: formData.pattern.trim() || undefined,
        group: formData.group.trim() || undefined,
        explanationVi: formData.explanationVi.trim(),
        explanationEn: editingItem?.explanationEn || undefined,
        hskLevel: (formData.hskLevel === '7-9' ? '7-9' : Number(formData.hskLevel)) as any,
        status: formData.status,
        examples: formData.exampleZh.trim()
          ? [
              {
                chinese: formData.exampleZh.trim(),
                pinyin: formData.examplePinyin.trim() || undefined,
                vietnamese: formData.exampleVi.trim() || undefined,
              },
            ]
          : editingItem?.examples || [],
      };

      if (editingItem) {
        await updateAdminGrammar(editingItem._id, payload);
      } else {
        await createAdminGrammar(payload);
      }

      setIsModalOpen(false);
      fetchList(pagination.page);
      fetchStats();
    } catch (err: any) {
      alert(err?.message || 'Có lỗi xảy ra khi lưu ngữ pháp');
    }
  };

  const toggleStatus = async (item: GrammarItem) => {
    const nextStatus = item.status === 'published' ? 'draft' : 'published';
    try {
      await updateAdminGrammar(item._id, { status: nextStatus });
      setItems((prev) => prev.map((it) => (it._id === item._id ? { ...it, status: nextStatus } : it)));
      fetchStats();
    } catch {
      alert('Không thể cập nhật trạng thái');
    }
  };

  const handleDelete = async (item: GrammarItem) => {
    if (!await notify.confirm({
      title: 'Xóa điểm ngữ pháp',
      message: `Bạn có chắc muốn xóa điểm ngữ pháp "${item.structure}"?`,
      confirmText: 'Xóa',
      tone: 'danger',
    })) return;
    try {
      await deleteAdminGrammar(item._id);
      setItems((prev) => prev.filter((it) => it._id !== item._id));
      fetchStats();
    } catch {
      alert('Không thể xóa điểm ngữ pháp');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-3xl border border-[#F2E4D8] bg-white p-6 shadow-2xs">
        <div className="pointer-events-none absolute -right-6 -bottom-8 select-none font-serif text-8xl font-black text-[#B91B1C]/5">
          法
        </div>
        <div className="relative z-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FDF1F1] text-[#B91B1C] shadow-2xs ring-1 ring-[#B91B1C]/20">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-[#2B2826]">Quản Lý Ngữ Pháp HSK 3.0</h1>
                <span className="rounded-full border border-[#F9D2D2] bg-[#FDF1F1] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#B91B1C]">
                  HSK 1 - 9
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#8C827A]">
                Hệ thống công thức, cấu trúc câu và câu ví dụ minh họa phân cấp chuẩn từ HSK 1 đến HSK 9.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <button
              onClick={() => {
                fetchStats();
                fetchList(pagination.page);
              }}
              disabled={loading}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-4 text-xs font-bold text-[#2B2826] shadow-2xs transition-all hover:border-[#B91B1C]/30 hover:bg-white disabled:opacity-40 active:scale-[0.98]"
            >
              <RefreshCw className={`h-4 w-4 text-[#8C827A] ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
            <button
              onClick={openAddModal}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#B91B1C] px-4 text-xs font-bold text-white shadow-2xs shadow-[#B91B1C]/25 transition-all hover:bg-[#A3181A] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm Điểm Ngữ Pháp</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bento Strip (Total + HSK 1 to 9) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2.5">
        <button
          onClick={() => setHskFilter('')}
          className={`p-3 rounded-2xl border text-left transition-all active:scale-[0.98] ${
            hskFilter === ''
              ? 'bg-[#2B2826] text-white border-[#2B2826] shadow-2xs'
              : 'bg-white border-[#F2E4D8] hover:border-[#B91B1C]/40'
          }`}
        >
          <div className={`text-[10px] font-extrabold uppercase ${hskFilter === '' ? 'text-[#E5DCD3]' : 'text-[#8C827A]'}`}>
            Tất cả NP
          </div>
          <div className="text-lg font-black mt-0.5">{stats ? stats.total.toLocaleString() : '—'}</div>
        </button>

        {HSK_LEVELS.map((lvl) => {
          const count = stats?.byLevel[lvl] || (lvl === '7' || lvl === '8' || lvl === '9' ? stats?.byLevel['7-9'] : 0) || 0;
          const isSelected = hskFilter === lvl;
          const styling = HSK_COLORS[lvl] || HSK_COLORS['1'];

          return (
            <button
              key={lvl}
              onClick={() => setHskFilter(hskFilter === lvl ? '' : lvl)}
              className={`p-3 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                isSelected
                  ? 'ring-2 ring-[#B91B1C] bg-[#FDF1F1]/50 border-transparent shadow-xs'
                  : 'bg-white border-[#F2E4D8] hover:border-[#B91B1C]/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black border ${styling.bg} ${styling.text} ${styling.border}`}>
                  HSK {lvl}
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#B91B1C]" />}
              </div>
              <div className="text-lg font-black text-[#2B2826] mt-1">{count.toLocaleString()}</div>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#F2E4D8] flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-md">
          <AdminSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Tìm theo cấu trúc, công thức hoặc giải thích nghĩa..."
          />
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {/* HSK Filter Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            <BookOpen className="w-3.5 h-3.5 text-[#8C827A]" />
            <select
              value={hskFilter}
              onChange={(e) => setHskFilter(e.target.value)}
              className="h-8 min-w-[160px] px-2.5 bg-[#FFF9F5] border border-[#F2E4D8] rounded-lg text-xs font-bold text-[#2B2826] outline-none cursor-pointer hover:border-[#B91B1C]/40 focus:border-[#B91B1C] transition-colors"
              aria-label="Lọc theo cấp độ HSK"
            >
              <option value="">Tất cả cấp độ (HSK 1–9)</option>
              <option value="1">HSK 1 — Sơ cấp</option>
              <option value="2">HSK 2 — Sơ cấp</option>
              <option value="3">HSK 3 — Sơ cấp</option>
              <option value="4">HSK 4 — Trung cấp</option>
              <option value="5">HSK 5 — Trung cấp</option>
              <option value="6">HSK 6 — Trung cấp</option>
              <option value="7">HSK 7 — Cao cấp 3.0</option>
              <option value="8">HSK 8 — Cao cấp 3.0</option>
              <option value="9">HSK 9 — Chuyên gia</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 shrink-0 border-l border-[#F2E4D8] pl-3">
            <Filter className="w-3.5 h-3.5 text-[#8C827A]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-2.5 bg-[#FFF9F5] border border-[#F2E4D8] rounded-lg text-xs font-bold text-[#2B2826] outline-none cursor-pointer hover:border-[#B91B1C]/40 focus:border-[#B91B1C] transition-colors"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="published">Đã xuất bản (Published)</option>
              <option value="draft">Bản nháp (Draft)</option>
              <option value="pending_review">Chờ duyệt (Pending)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Streamlined Grammar Table */}
      <div className="bg-white rounded-3xl border border-[#F2E4D8] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[720px]">
          <thead className="bg-[#FFF9F5] border-b border-[#F2E4D8] text-[#8C827A] uppercase font-bold text-[10px] tracking-wider">
            <tr>
              <th className="p-4 w-[230px]">Cấu trúc ngữ pháp</th>
              <th className="p-4 w-[240px]">Công thức / Quy tắc</th>
              <th className="p-4">Ý nghĩa tiếng Việt</th>
              <th className="p-4 w-[110px]">Cấp độ</th>
              <th className="p-4 w-[140px]">Trạng thái</th>
              <th className="p-4 text-center w-[110px]">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2E4D8]">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-[#8C827A]">
                  <div className="inline-flex items-center gap-2">
                    <Spinner size="sm" tone="brand" />
                    <span>Đang tải danh sách ngữ pháp HSK...</span>
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-[#8C827A]">
                  Không tìm thấy điểm ngữ pháp nào phù hợp với bộ lọc hiện tại.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const lvlKey = String(item.hskLevel);
                const styling = HSK_COLORS[lvlKey] || HSK_COLORS['1'];
                const ex = item.examples && item.examples.length > 0 ? item.examples[0] : null;

                return (
                  <React.Fragment key={item._id}>
                    <tr className="hover:bg-[#FFF9F5]/70 transition-colors group">
                      {/* Structure + Group */}
                      <td className="p-4">
                        <div className="font-serif text-base font-black text-[#2B2826] tracking-wide">
                          {item.structure}
                        </div>
                        {item.group && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFF9F5] text-[#8C827A] border border-[#F2E4D8]">
                            {item.group}
                          </span>
                        )}
                      </td>

                      {/* Pattern / Formula */}
                      <td className="p-4">
                        {item.pattern ? (
                          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#2B2826] bg-[#FFF9F5] px-2.5 py-1.5 rounded-xl border border-[#F2E4D8] max-w-[230px]">
                            <span className="truncate flex-1">{item.pattern}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.pattern!, item._id)}
                              className="text-[#8C827A] hover:text-[#2B2826] shrink-0"
                              title="Sao chép công thức"
                            >
                              {copiedId === item._id ? <Check className="w-3.5 h-3.5 text-[#188A5A]" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[#8C827A] text-[11px] italic">—</span>
                        )}
                      </td>

                      {/* Vietnamese Explanation */}
                      <td className="p-4">
                        <div className="text-[#2B2826] font-semibold text-xs leading-relaxed max-w-[320px]">
                          {item.explanationVi}
                        </div>
                        {ex && (
                          <div className="text-[11px] text-[#8C827A] mt-0.5 line-clamp-1 italic">
                            Ví dụ: {ex.chinese} {ex.vietnamese ? `(${ex.vietnamese})` : ''}
                          </div>
                        )}
                      </td>

                      {/* HSK Level badge */}
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-md font-black text-[10px] border ${styling.bg} ${styling.text} ${styling.border}`}>
                          HSK {item.hskLevel}
                        </span>
                      </td>

                      {/* Status toggle pill */}
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => toggleStatus(item)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase transition-all border ${
                            item.status === 'published'
                              ? 'bg-[#EAF5F1] text-[#188A5A] border-[#C6E7DA] hover:bg-[#D4EFE4]'
                              : item.status === 'pending_review'
                              ? 'bg-[#FFF8EC] text-[#B45309] border-[#FDE6BA] hover:bg-[#FEEFC3]'
                              : 'bg-[#F4EFEA] text-[#6E655F] border-[#E5DCD3] hover:bg-[#ECE4DC]'
                          }`}
                          title="Bấm để chuyển đổi giữa Xuất bản và Bản nháp"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            item.status === 'published' ? 'bg-[#188A5A]' : item.status === 'pending_review' ? 'bg-[#B45309]' : 'bg-[#8C827A]'
                          }`} />
                          <span>{item.status === 'published' ? 'Published' : item.status === 'pending_review' ? 'Pending' : 'Draft'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => playAudio(item.structure)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              speakingText === item.structure
                                ? 'bg-[#B91B1C] text-white border-[#B91B1C] scale-105'
                                : 'bg-white text-[#8C827A] border-[#F2E4D8] hover:border-[#B91B1C] hover:text-[#B91B1C]'
                            }`}
                            title="Nghe phát âm cấu trúc ngữ pháp"
                            aria-label={`Phát âm cấu trúc ${item.structure}`}
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 rounded-lg border border-[#F2E4D8] bg-white text-[#8C827A] hover:text-[#2B2826] hover:bg-[#FFF9F5] transition-colors"
                            title="Chỉnh sửa ngữ pháp"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1.5 rounded-lg border border-[#F2E4D8] bg-white text-[#8C827A] hover:text-[#B91B1C] hover:bg-[#FDF1F1] transition-colors"
                            title="Xóa ngữ pháp"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
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
        unitLabel="điểm ngữ pháp"
        disabled={loading}
        ariaLabel="Phân trang ngữ pháp"
        onPageChange={(page) => fetchList(page)}
        onPageSizeChange={(size) => {
          setPageSize(size);
          fetchList(1, size);
        }}
      />

      {/* Streamlined Modal Add / Edit (Core Fields Only) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-[#F2E4D8] shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#F2E4D8]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FDF1F1] text-[#B91B1C] flex items-center justify-center font-bold ring-1 ring-[#B91B1C]/20 shadow-2xs">
                  {editingItem ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <h2 className="text-lg font-black text-[#2B2826]">
                  {editingItem ? 'Chỉnh Sửa Ngữ Pháp' : 'Thêm Điểm Ngữ Pháp HSK'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#FFF9F5] text-[#8C827A] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              {/* Row 1: Structure & HSK Level */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#2B2826] mb-1.5">
                    Cấu trúc ngữ pháp <span className="text-[#B91B1C]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={formData.structure}
                    onChange={(e) => setFormData({ ...formData, structure: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#FFF9F5] border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] focus:bg-white transition-all font-serif text-base font-black text-[#2B2826]"
                    placeholder="ví dụ: 不但……而且……"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#2B2826] mb-1.5">
                    Cấp độ HSK <span className="text-[#B91B1C]">*</span>
                  </label>
                  <select
                    value={formData.hskLevel}
                    onChange={(e) => setFormData({ ...formData, hskLevel: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#FFF9F5] border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] font-bold text-xs text-[#2B2826]"
                  >
                    {HSK_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        HSK {lvl}
                      </option>
                    ))}
                    <option value="7-9">HSK 7–9 (Cao cấp)</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Pattern Formula */}
              <div>
                <label className="block font-bold text-[#2B2826] mb-1.5">
                  Công thức mẫu / Quy tắc cú pháp (Pattern)
                </label>
                <input
                  type="text"
                  value={formData.pattern}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#FFF9F5] border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] focus:bg-white transition-all font-mono text-xs font-bold text-[#2B2826]"
                  placeholder="ví dụ: S + 不但 + V/Adj1 + 而且 + V/Adj2"
                />
              </div>

              {/* Row 3: Vietnamese Explanation */}
              <div>
                <label className="block font-bold text-[#2B2826] mb-1.5">
                  Giải thích ý nghĩa tiếng Việt <span className="text-[#B91B1C]">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={formData.explanationVi}
                  onChange={(e) => setFormData({ ...formData, explanationVi: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FFF9F5] border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] focus:bg-white transition-all text-[#2B2826] resize-none leading-relaxed"
                  placeholder="ví dụ: Không những... mà còn... Biểu thị quan hệ tăng tiến giữa hai phân câu."
                />
              </div>

              {/* Row 4: Group & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#2B2826] mb-1.5">Nhóm phân loại</label>
                  <input
                    type="text"
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#FFF9F5] border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] focus:bg-white transition-all text-[#2B2826]"
                    placeholder="Câu phức, Trợ từ, Câu chữ 把..."
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#2B2826] mb-1.5">Trạng thái xuất bản</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2.5 bg-[#FFF9F5] border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] font-bold text-xs text-[#2B2826]"
                  >
                    <option value="published">Xuất bản (Published)</option>
                    <option value="draft">Bản nháp (Draft)</option>
                    <option value="pending_review">Chờ duyệt (Pending Review)</option>
                  </select>
                </div>
              </div>

              {/* Row 5: Example Sentence */}
              <div className="p-3.5 bg-[#FFF9F5] rounded-2xl border border-[#F2E4D8] space-y-2">
                <span className="font-bold text-[#2B2826] block">Câu ví dụ minh họa (Tùy chọn):</span>
                <input
                  type="text"
                  value={formData.exampleZh}
                  onChange={(e) => setFormData({ ...formData, exampleZh: e.target.value })}
                  placeholder="Chữ Hán: 他不但聪明，而且很努力。"
                  className="w-full px-3 py-2 bg-white border border-[#F2E4D8] rounded-xl outline-none font-serif font-bold text-xs text-[#2B2826]"
                />
                <input
                  type="text"
                  value={formData.examplePinyin}
                  onChange={(e) => setFormData({ ...formData, examplePinyin: e.target.value })}
                  placeholder="Phiên âm: Tā búdàn cōngmíng, érqiě hěn nǔlì."
                  className="w-full px-3 py-2 bg-white border border-[#F2E4D8] rounded-xl outline-none font-mono text-xs text-[#B91B1C]"
                />
                <input
                  type="text"
                  value={formData.exampleVi}
                  onChange={(e) => setFormData({ ...formData, exampleVi: e.target.value })}
                  placeholder="Dịch nghĩa: Anh ấy không những thông minh mà còn rất chăm chỉ."
                  className="w-full px-3 py-2 bg-white border border-[#F2E4D8] rounded-xl outline-none text-xs text-[#2B2826]"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F2E4D8]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] hover:bg-white text-[#8C827A] font-bold transition-all active:scale-[0.98]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white font-bold transition-all shadow-2xs shadow-[#B91B1C]/25 active:scale-[0.98]"
                >
                  {editingItem ? 'Lưu thay đổi' : 'Tạo điểm ngữ pháp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
