import React, { useState, useEffect } from 'react';
import { useNotification } from '../notifications';
import { Spinner } from '../notifications';
import { AdminSearchBar } from './AdminSearchBar';
import {
  Search,
  Plus,
  Upload,
  Filter,
  CheckCircle,
  AlertCircle,
  Trash2,
  Edit2,
  X,
  Volume2,
  RefreshCw,
  BookOpen,
  Check,
  FileSpreadsheet,
} from 'lucide-react';
import {
  getAdminVocabularyList,
  getAdminVocabularyStats,
  createAdminVocabulary,
  updateAdminVocabulary,
  deleteAdminVocabulary,
  importAdminVocabulary,
  VocabularyItem,
  VocabularyStats,
  ImportPreviewReport,
} from '../../api/vocabulary';
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

export default function AdminVocabularyManager() {
  const notify = useNotification();
  const [stats, setStats] = useState<VocabularyStats | null>(null);
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: DEFAULT_ADMIN_PAGE_SIZE, total: 0, totalPages: 1 });
  const [pageSize, setPageSize] = useState(DEFAULT_ADMIN_PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [hskFilter, setHskFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);

  // Modals
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VocabularyItem | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Add/Edit Form State (Essential core fields only)
  const [formData, setFormData] = useState({
    simplified: '',
    pinyin: '',
    meaningVi: '',
    hskLevel: '1' as string,
    exampleChinese: '',
    exampleVietnamese: '',
    status: 'published' as 'published' | 'draft' | 'pending_review',
  });

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importJsonText, setImportJsonText] = useState('');
  const [importStrategy, setImportStrategy] = useState<'skip_existing' | 'update_existing' | 'insert_only'>('skip_existing');
  const [importPreview, setImportPreview] = useState<ImportPreviewReport | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  // Load stats
  const fetchStats = async () => {
    try {
      const data = await getAdminVocabularyStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  };

  // Load list
  const fetchList = async (page = 1, limit = pageSize) => {
    setLoading(true);
    try {
      const res = await getAdminVocabularyList({
        page,
        limit,
        hskLevel: hskFilter || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchQuery.trim() || undefined,
      });
      setItems(res.items);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to load vocabulary list', err);
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
    setSpeakingWord(text);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 0.85;
      window.speechSynthesis.speak(u);
    }
    setTimeout(() => setSpeakingWord(null), 1200);
  };

  // Open Add Modal
  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      simplified: '',
      pinyin: '',
      meaningVi: '',
      hskLevel: hskFilter && HSK_LEVELS.includes(hskFilter as any) ? hskFilter : '1',
      exampleChinese: '',
      exampleVietnamese: '',
      status: 'published',
    });
    setIsAddEditOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (item: VocabularyItem) => {
    setEditingItem(item);
    const firstEx = item.examples && item.examples.length > 0 ? item.examples[0] : undefined;
    setFormData({
      simplified: item.simplified,
      pinyin: item.pinyin,
      meaningVi: (item.meanings.vi || []).join(', '),
      hskLevel: String(item.hskLevel),
      exampleChinese: firstEx?.chinese || '',
      exampleVietnamese: firstEx?.vietnamese || '',
      status: item.status,
    });
    setIsAddEditOpen(true);
  };

  // Save Add/Edit
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.simplified.trim() || !formData.pinyin.trim() || !formData.meaningVi.trim()) {
      alert('Vui lòng điền đủ Chữ Hán, Pinyin và Nghĩa tiếng Việt.');
      return;
    }

    try {
      const examples = formData.exampleChinese.trim()
        ? [
            {
              chinese: formData.exampleChinese.trim(),
              vietnamese: formData.exampleVietnamese.trim() || undefined,
            },
          ]
        : editingItem?.examples || [];

      const payload: Partial<VocabularyItem> = {
        simplified: formData.simplified.trim(),
        pinyin: formData.pinyin.trim(),
        meanings: {
          vi: formData.meaningVi.split(',').map((s) => s.trim()).filter(Boolean),
          en: editingItem?.meanings?.en || [], // Preserve any existing English meanings in DB
        },
        hskLevel: (formData.hskLevel === '7-9' ? '7-9' : Number(formData.hskLevel)) as any,
        examples,
        status: formData.status,
      };

      if (editingItem) {
        await updateAdminVocabulary(editingItem._id, payload);
      } else {
        await createAdminVocabulary({
          ...payload,
          source: [{ name: 'Admin HanFlix' }],
        });
      }

      setIsAddEditOpen(false);
      fetchList(pagination.page);
      fetchStats();
    } catch (err: any) {
      alert(err?.message || 'Có lỗi xảy ra khi lưu từ vựng');
    }
  };

  // Quick toggle status
  const toggleStatus = async (item: VocabularyItem) => {
    const nextStatus = item.status === 'published' ? 'draft' : 'published';
    try {
      await updateAdminVocabulary(item._id, { status: nextStatus });
      setItems((prev) => prev.map((it) => (it._id === item._id ? { ...it, status: nextStatus } : it)));
      fetchStats();
    } catch {
      alert('Không thể đổi trạng thái từ vựng');
    }
  };

  // Delete
  const handleDelete = async (item: VocabularyItem) => {
    if (!await notify.confirm({
      title: 'Xóa từ vựng',
      message: `Bạn có chắc muốn xóa từ "${item.simplified}" (${item.pinyin})?`,
      confirmText: 'Xóa',
      tone: 'danger',
    })) return;
    try {
      await deleteAdminVocabulary(item._id);
      setItems((prev) => prev.filter((it) => it._id !== item._id));
      fetchStats();
    } catch {
      alert('Không thể xóa từ vựng');
    }
  };

  // Parse file/text for Import
  const parseImportItems = async (): Promise<any[]> => {
    if (importFile) {
      const text = await importFile.text();
      if (importFile.name.endsWith('.json')) {
        return JSON.parse(text);
      } else {
        // CSV parsing: simplified, pinyin, hskLevel, meaningVi, exampleChinese, exampleVi
        const lines = text.split(/\r?\n/).filter(Boolean);
        const parsedRows = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          if (cols.length < 3) continue;
          parsedRows.push({
            simplified: cols[0],
            pinyin: cols[1],
            hskLevel: cols[2] === '7-9' ? '7-9' : Number(cols[2]) || 1,
            meanings: {
              vi: cols[3] ? [cols[3]] : [],
              en: [],
            },
            examples: cols[4] ? [{ chinese: cols[4], vietnamese: cols[5] || '' }] : [],
          });
        }
        return parsedRows;
      }
    } else if (importJsonText.trim()) {
      return JSON.parse(importJsonText);
    }
    return [];
  };

  const handlePreviewImport = async () => {
    setImportError(null);
    setImportLoading(true);
    try {
      const rawItems = await parseImportItems();
      if (!rawItems || rawItems.length === 0) {
        throw new Error('Dữ liệu rỗng hoặc sai định dạng');
      }

      const res = await importAdminVocabulary({
        mode: 'preview',
        strategy: importStrategy,
        items: rawItems,
      });
      setImportPreview(res);
    } catch (err: any) {
      setImportError(err.message || 'Lỗi khi đọc và xem trước dữ liệu');
      setImportPreview(null);
    } finally {
      setImportLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    setImportError(null);
    setImportLoading(true);
    try {
      const rawItems = await parseImportItems();
      const res = await importAdminVocabulary({
        mode: 'commit',
        strategy: importStrategy,
        items: rawItems,
      });

      setImportSuccessMsg(
        `Nhập thành công: ${res.summary.inserted} từ mới, ${res.summary.updated} từ cập nhật, bỏ qua ${res.summary.skipped} từ trùng lặp.`
      );
      setImportPreview(null);
      setImportFile(null);
      setImportJsonText('');
      fetchList(1);
      fetchStats();
      setTimeout(() => {
        setIsImportOpen(false);
        setImportSuccessMsg(null);
      }, 2500);
    } catch (err: any) {
      setImportError(err.message || 'Lỗi khi nhập dữ liệu vào database');
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="relative overflow-hidden rounded-3xl border border-[#F2E4D8] bg-white p-6 shadow-2xs">
        <div className="pointer-events-none absolute -right-6 -bottom-8 select-none font-serif text-8xl font-black text-[#B91B1C]/5">
          词
        </div>
        <div className="relative z-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FDF1F1] text-[#B91B1C] shadow-2xs ring-1 ring-[#B91B1C]/20">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-[#2B2826]">Kho Từ Vựng HSK 3.0</h1>
                <span className="rounded-full border border-[#F9D2D2] bg-[#FDF1F1] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#B91B1C]">
                  HSK 1 - 9
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#8C827A]">
                Cơ sở dữ liệu từ vựng giản thể cốt lõi cho phụ đề phim và luyện tập, tối giản trường thông tin rườm rà.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <button
              onClick={() => setIsImportOpen(true)}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] px-4 text-xs font-bold text-[#2B2826] shadow-2xs transition-all hover:border-[#B91B1C]/30 hover:bg-white active:scale-[0.98]"
            >
              <Upload className="h-4 w-4 text-[#8C827A]" />
              <span>Nhập File Hàng Loạt</span>
            </button>
            <button
              onClick={openAddModal}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#B91B1C] px-4 text-xs font-bold text-white shadow-2xs shadow-[#B91B1C]/25 transition-all hover:bg-[#A3181A] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm từ vựng</span>
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
            Tất cả HSK
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
            placeholder="Tìm theo chữ Hán, Pinyin hoặc nghĩa tiếng Việt..."
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

      {/* Streamlined Vocabulary Table (Core fields only) */}
      <div className="bg-white rounded-3xl border border-[#F2E4D8] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[720px]">
          <thead className="bg-[#FFF9F5] border-b border-[#F2E4D8] text-[#8C827A] uppercase font-bold text-[10px] tracking-wider">
            <tr>
              <th className="p-4 w-[220px]">Chữ Hán Giản thể</th>
              <th className="p-4 w-[160px]">Phiên âm (Pinyin)</th>
              <th className="p-4">Nghĩa tiếng Việt</th>
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
                    <span>Đang tải kho từ vựng HSK...</span>
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-[#8C827A]">
                  Không tìm thấy từ vựng nào phù hợp với bộ lọc hiện tại.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const lvlKey = String(item.hskLevel);
                const styling = HSK_COLORS[lvlKey] || HSK_COLORS['1'];
                const isSpeaking = speakingWord === item.simplified;

                return (
                  <tr key={item._id} className="hover:bg-[#FFF9F5]/70 transition-colors group">
                    {/* Hanzi + Audio button */}
                    <td className="p-4">
                      <div className="flex items-center gap-2.5">
                        <span className="font-serif text-xl font-black text-[#2B2826] tracking-wide">
                          {item.simplified}
                        </span>
                        <button
                          type="button"
                          onClick={() => playAudio(item.simplified)}
                          className={`p-1.5 rounded-lg border transition-all ${
                            isSpeaking
                              ? 'bg-[#B91B1C] text-white border-[#B91B1C] scale-105'
                              : 'border-[#F2E4D8] bg-white text-[#8C827A] hover:text-[#B91B1C] hover:border-[#B91B1C]'
                          }`}
                          title="Phát âm chữ Hán chuẩn"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Pinyin */}
                    <td className="p-4 font-mono font-bold text-[#B91B1C] text-sm">
                      {item.pinyin}
                    </td>

                    {/* Vietnamese Meaning & optional example preview */}
                    <td className="p-4">
                      <div className="text-[#2B2826] font-semibold text-xs leading-relaxed">
                        {item.meanings.vi && item.meanings.vi.length > 0 ? (
                          item.meanings.vi.join(', ')
                        ) : (
                          <span className="text-[#8C827A] italic text-[11px]">Chưa bổ sung nghĩa</span>
                        )}
                      </div>
                      {item.examples && item.examples.length > 0 && item.examples[0]?.chinese && (
                        <div className="text-[11px] text-[#8C827A] mt-0.5 line-clamp-1 italic">
                          Ví dụ: {item.examples[0].chinese}
                          {item.examples[0].vietnamese ? ` (${item.examples[0].vietnamese})` : ''}
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
                        title="Bấm để chuyển đổi giữa Đã xuất bản và Bản nháp"
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
                          onClick={() => openEditModal(item)}
                          className="p-1.5 rounded-lg border border-[#F2E4D8] bg-white text-[#8C827A] hover:text-[#2B2826] hover:bg-[#FFF9F5] transition-colors"
                          title="Chỉnh sửa từ"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 rounded-lg border border-[#F2E4D8] bg-white text-[#8C827A] hover:text-[#B91B1C] hover:bg-[#FDF1F1] transition-colors"
                          title="Xóa từ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
        unitLabel="từ vựng"
        disabled={loading}
        ariaLabel="Phân trang kho từ vựng"
        onPageChange={(page) => fetchList(page)}
        onPageSizeChange={(size) => {
          setPageSize(size);
          fetchList(1, size);
        }}
      />

      {/* Streamlined Add / Edit Modal (Clean Essential Fields Only) */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-[#F2E4D8] shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#F2E4D8]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FDF1F1] text-[#B91B1C] flex items-center justify-center font-bold ring-1 ring-[#B91B1C]/20 shadow-2xs">
                  {editingItem ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <h2 className="text-lg font-black text-[#2B2826]">
                  {editingItem ? 'Chỉnh Sửa Từ Vựng HSK' : 'Thêm Từ Vựng Mới'}
                </h2>
              </div>
              <button
                onClick={() => setIsAddEditOpen(false)}
                className="p-1 rounded-lg hover:bg-[#FFF9F5] text-[#8C827A] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              {/* Row 1: Hanzi & Pinyin */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#2B2826] mb-1.5">
                    Chữ Hán Giản thể <span className="text-[#B91B1C]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      autoFocus
                      value={formData.simplified}
                      onChange={(e) => setFormData({ ...formData, simplified: e.target.value })}
                      className="w-full pl-3 pr-9 py-2.5 bg-[#FFF9F5] border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] focus:bg-white transition-all font-serif text-lg font-black text-[#2B2826]"
                      placeholder="ví dụ: 喜欢"
                    />
                    {formData.simplified && (
                      <button
                        type="button"
                        onClick={() => playAudio(formData.simplified)}
                        className="absolute right-2.5 top-2.5 text-[#8C827A] hover:text-[#B91B1C]"
                        title="Nghe phát âm"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#2B2826] mb-1.5">
                    Phiên âm Pinyin <span className="text-[#B91B1C]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.pinyin}
                    onChange={(e) => setFormData({ ...formData, pinyin: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#FFF9F5] border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] focus:bg-white transition-all font-mono text-sm font-bold text-[#B91B1C]"
                    placeholder="ví dụ: xǐhuān"
                  />
                </div>
              </div>

              {/* Row 2: Vietnamese Meaning */}
              <div>
                <label className="block font-bold text-[#2B2826] mb-1.5">
                  Nghĩa tiếng Việt <span className="text-[#B91B1C]">*</span>{' '}
                  <span className="font-normal text-[#8C827A]">(phân cách bằng dấu phẩy)</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.meaningVi}
                  onChange={(e) => setFormData({ ...formData, meaningVi: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#FFF9F5] border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] focus:bg-white transition-all text-[#2B2826]"
                  placeholder="ví dụ: thích, yêu mến, ưa chuộng"
                />
              </div>

              {/* Row 3: HSK Level & Status */}
              <div className="grid grid-cols-2 gap-3">
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
                    <option value="7-9">HSK 7–9 (Tổng hợp cao cấp)</option>
                  </select>
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

              {/* Optional Example Sentence */}
              <div className="p-3.5 bg-[#FFF9F5] rounded-2xl border border-[#F2E4D8] space-y-2.5">
                <div className="font-bold text-[#2B2826] flex items-center justify-between">
                  <span>Ví dụ minh họa (Tùy chọn)</span>
                  <span className="text-[10px] text-[#8C827A] font-normal">Hiển thị trong flashcard & bài học</span>
                </div>
                <input
                  type="text"
                  value={formData.exampleChinese}
                  onChange={(e) => setFormData({ ...formData, exampleChinese: e.target.value })}
                  placeholder="Câu tiếng Trung: ví dụ 我很喜欢看电影。"
                  className="w-full px-3 py-2 bg-white border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] text-[#2B2826]"
                />
                <input
                  type="text"
                  value={formData.exampleVietnamese}
                  onChange={(e) => setFormData({ ...formData, exampleVietnamese: e.target.value })}
                  placeholder="Dịch nghĩa tiếng Việt: ví dụ Tôi rất thích xem phim."
                  className="w-full px-3 py-2 bg-white border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] text-[#2B2826]"
                />
              </div>

              {/* Form Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F2E4D8]">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] hover:bg-white text-[#8C827A] font-bold transition-all active:scale-[0.98]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white font-bold transition-all shadow-2xs shadow-[#B91B1C]/25 active:scale-[0.98]"
                >
                  {editingItem ? 'Lưu thay đổi' : 'Tạo từ mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Bulk Import */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 border border-[#F2E4D8] shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#F2E4D8]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#FDF1F1] text-[#B91B1C] flex items-center justify-center ring-1 ring-[#B91B1C]/20 shadow-2xs">
                  <Upload className="w-4 h-4 text-[#B91B1C]" />
                </div>
                <h2 className="text-lg font-black text-[#2B2826]">Nhập Từ Vựng Hàng Loạt</h2>
              </div>
              <button
                onClick={() => {
                  setIsImportOpen(false);
                  setImportPreview(null);
                }}
                className="p-1 rounded-lg hover:bg-[#FFF9F5] text-[#8C827A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {importSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-[#EAF5F1] border border-[#C6E7DA] text-[#188A5A] text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{importSuccessMsg}</span>
              </div>
            )}

            {importError && (
              <div className="p-3.5 rounded-xl bg-[#FDF1F1] border border-[#F9D2D2] text-[#B91B1C] text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-[#FFF9F5] rounded-2xl border border-[#F2E4D8] space-y-2.5">
                <div className="font-bold text-[#2B2826] flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-[#8C827A]" />
                  <span>Chọn file CSV / JSON hoặc Dán dữ liệu</span>
                </div>
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#8C827A] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#2B2826] file:text-white hover:file:bg-[#1C1A19]"
                />
                <textarea
                  rows={3}
                  placeholder='Hoặc dán JSON mảng từ vựng: [{"simplified":"好","pinyin":"hǎo","hskLevel":1,"meanings":{"vi":["tốt"]}}]'
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#F2E4D8] rounded-xl outline-none focus:border-[#B91B1C] font-mono text-[11px] text-[#2B2826]"
                />
              </div>

              {/* Strategy */}
              <div>
                <label className="block font-bold text-[#2B2826] mb-1">Xử lý từ trùng lặp:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[#2B2826]">
                    <input
                      type="radio"
                      name="strategy"
                      checked={importStrategy === 'skip_existing'}
                      onChange={() => setImportStrategy('skip_existing')}
                      className="accent-[#B91B1C]"
                    />
                    <span>Bỏ qua từ đã có (Khuyên dùng)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[#2B2826]">
                    <input
                      type="radio"
                      name="strategy"
                      checked={importStrategy === 'update_existing'}
                      onChange={() => setImportStrategy('update_existing')}
                      className="accent-[#B91B1C]"
                    />
                    <span>Cập nhật đè từ cũ</span>
                  </label>
                </div>
              </div>

              {/* Import Preview summary */}
              {importPreview && (
                <div className="p-3.5 bg-[#FFF9F5] rounded-2xl border border-[#F2E4D8] space-y-2">
                  <div className="font-bold text-[#2B2826]">Kết quả xem trước:</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-white rounded-xl border border-[#F2E4D8]">
                      <div className="text-[10px] text-[#8C827A]">Tổng số từ đọc được</div>
                      <div className="text-base font-black text-[#2B2826]">{importPreview.summary.total}</div>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-[#C6E7DA]">
                      <div className="text-[10px] text-[#188A5A]">Từ mới hợp lệ</div>
                      <div className="text-base font-black text-[#188A5A]">{importPreview.summary.valid}</div>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-[#F9D2D2]">
                      <div className="text-[10px] text-[#B91B1C]">Lỗi định dạng</div>
                      <div className="text-base font-black text-[#B91B1C]">{importPreview.summary.invalid}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#F2E4D8]">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportOpen(false);
                    setImportPreview(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-[#F2E4D8] bg-[#FFF9F5] hover:bg-white text-[#8C827A] font-bold active:scale-[0.98]"
                >
                  Đóng
                </button>
                {!importPreview ? (
                  <button
                    type="button"
                    onClick={handlePreviewImport}
                    disabled={importLoading || (!importFile && !importJsonText.trim())}
                    className="px-4 py-2 rounded-xl bg-[#2B2826] hover:bg-[#1C1A19] text-white font-bold disabled:opacity-40 active:scale-[0.98]"
                  >
                    {importLoading ? 'Đang kiểm tra...' : 'Kiểm tra dữ liệu'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={importLoading || importPreview.summary.valid === 0}
                    className="px-4 py-2 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white font-bold disabled:opacity-40 active:scale-[0.98] shadow-2xs shadow-[#B91B1C]/25"
                  >
                    {importLoading ? 'Đang nhập...' : 'Xác nhận nhập vào kho'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
