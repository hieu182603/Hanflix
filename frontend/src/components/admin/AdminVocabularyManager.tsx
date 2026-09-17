import React, { useState, useEffect, useTransition } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  Upload,
  Filter,
  CheckCircle,
  AlertCircle,
  Clock,
  Trash2,
  Edit2,
  X,
  Volume2,
  FileText,
  RefreshCw,
  Eye,
  EyeOff,
  Layers,
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

export default function AdminVocabularyManager() {
  const [stats, setStats] = useState<VocabularyStats | null>(null);
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
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

  // Add/Edit Form State
  const [formData, setFormData] = useState({
    simplified: '',
    traditional: '',
    pinyin: '',
    meaningVi: '',
    meaningEn: '',
    hskLevel: '1' as string,
    partOfSpeech: '',
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
  const fetchList = async (page = 1) => {
    setLoading(true);
    try {
      const res = await getAdminVocabularyList({
        page,
        limit: 20,
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
    setSpeakingWord(text);
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      window.speechSynthesis.speak(u);
    }
    setTimeout(() => setSpeakingWord(null), 1000);
  };

  // Open Add Modal
  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      simplified: '',
      traditional: '',
      pinyin: '',
      meaningVi: '',
      meaningEn: '',
      hskLevel: '1',
      partOfSpeech: '',
      status: 'published',
    });
    setIsAddEditOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (item: VocabularyItem) => {
    setEditingItem(item);
    setFormData({
      simplified: item.simplified,
      traditional: item.traditional || '',
      pinyin: item.pinyin,
      meaningVi: (item.meanings.vi || []).join(', '),
      meaningEn: (item.meanings.en || []).join(', '),
      hskLevel: String(item.hskLevel),
      partOfSpeech: (item.partOfSpeech || []).join(', '),
      status: item.status,
    });
    setIsAddEditOpen(true);
  };

  // Save Add/Edit
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Partial<VocabularyItem> = {
        simplified: formData.simplified.trim(),
        traditional: formData.traditional.trim() || undefined,
        pinyin: formData.pinyin.trim(),
        meanings: {
          vi: formData.meaningVi ? formData.meaningVi.split(',').map(s => s.trim()).filter(Boolean) : [],
          en: formData.meaningEn ? formData.meaningEn.split(',').map(s => s.trim()).filter(Boolean) : [],
        },
        hskLevel: formData.hskLevel === '7-9' ? '7-9' : (Number(formData.hskLevel) as any),
        partOfSpeech: formData.partOfSpeech ? formData.partOfSpeech.split(',').map(s => s.trim()).filter(Boolean) : [],
        status: formData.status,
      };

      if (editingItem) {
        await updateAdminVocabulary(editingItem._id, payload);
      } else {
        await createAdminVocabulary({
          ...payload,
          source: [{ name: 'Admin Manual' }],
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
      setItems(items.map(it => it._id === item._id ? { ...it, status: nextStatus } : it));
      fetchStats();
    } catch (err) {
      alert('Không thể đổi trạng thái');
    }
  };

  // Delete
  const handleDelete = async (item: VocabularyItem) => {
    if (!window.confirm(`Bạn có chắc muốn xóa từ "${item.simplified}" (${item.pinyin})?`)) return;
    try {
      await deleteAdminVocabulary(item._id);
      setItems(items.filter(it => it._id !== item._id));
      fetchStats();
    } catch (err) {
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
        // CSV parsing
        const lines = text.split(/\r?\n/).filter(Boolean);
        const header = lines[0].split(',').map(h => h.trim());
        const parsedRows = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length < 3) continue;
          parsedRows.push({
            simplified: cols[0],
            pinyin: cols[1],
            hskLevel: cols[2] === '7-9' ? '7-9' : Number(cols[2]) || 1,
            meanings: {
              vi: cols[3] ? [cols[3]] : [],
              en: cols[4] ? [cols[4]] : [],
            },
            partOfSpeech: cols[5] ? [cols[5]] : [],
          });
        }
        return parsedRows;
      }
    } else if (importJsonText.trim()) {
      return JSON.parse(importJsonText);
    }
    return [];
  };

  // Run Preview
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

  // Run Commit Import
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
      <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#18181B] tracking-tight">Kho Từ Vựng HSK 3.0</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FDF1F1] text-[#B91B1C] text-[11px] font-black uppercase">
              HSK 1 - 7-9
            </span>
          </div>
          <p className="text-xs text-[#5F6368] mt-1">
            Quản lý cơ sở dữ liệu từ vựng HSK toàn diện, tra cứu phụ đề phim tự động, hỗ trợ phân loại và nhập file hàng loạt.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsImportOpen(true)}
            className="h-10 px-4 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] hover:bg-white text-[#18181B] text-xs font-bold flex items-center gap-2 transition-colors shadow-2xs"
          >
            <Upload className="w-4 h-4 text-[#5F6368]" />
            <span>Import CSV / JSON</span>
          </button>
          <button
            onClick={openAddModal}
            className="h-10 px-4 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm từ mới</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="p-3.5 bg-white rounded-2xl border border-[#E7E7EA]">
            <div className="text-[10px] font-extrabold uppercase text-[#8B9097]">Tổng số từ</div>
            <div className="text-xl font-black text-[#18181B] mt-0.5">{stats.total.toLocaleString()}</div>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#E7E7EA]">
            <div className="text-[10px] font-extrabold uppercase text-[#188A5A]">HSK 1</div>
            <div className="text-xl font-black text-[#18181B] mt-0.5">{stats.byLevel[1]?.toLocaleString() || 0}</div>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#E7E7EA]">
            <div className="text-[10px] font-extrabold uppercase text-[#2563EB]">HSK 2</div>
            <div className="text-xl font-black text-[#18181B] mt-0.5">{stats.byLevel[2]?.toLocaleString() || 0}</div>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#E7E7EA]">
            <div className="text-[10px] font-extrabold uppercase text-[#7C3AED]">HSK 3</div>
            <div className="text-xl font-black text-[#18181B] mt-0.5">{stats.byLevel[3]?.toLocaleString() || 0}</div>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#E7E7EA]">
            <div className="text-[10px] font-extrabold uppercase text-[#D97706]">HSK 4</div>
            <div className="text-xl font-black text-[#18181B] mt-0.5">{stats.byLevel[4]?.toLocaleString() || 0}</div>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#E7E7EA]">
            <div className="text-[10px] font-extrabold uppercase text-[#EA580C]">HSK 5</div>
            <div className="text-xl font-black text-[#18181B] mt-0.5">{stats.byLevel[5]?.toLocaleString() || 0}</div>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#E7E7EA]">
            <div className="text-[10px] font-extrabold uppercase text-[#B91B1C]">HSK 6</div>
            <div className="text-xl font-black text-[#18181B] mt-0.5">{stats.byLevel[6]?.toLocaleString() || 0}</div>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#E7E7EA]">
            <div className="text-[10px] font-extrabold uppercase text-[#64748B]">HSK 7–9</div>
            <div className="text-xl font-black text-[#18181B] mt-0.5">{stats.byLevel['7-9']?.toLocaleString() || 0}</div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E7E7EA] flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-[#8B9097] absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Tìm theo chữ Hán, Pinyin hoặc nghĩa tiếng Việt/Anh..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-20 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl text-xs outline-none focus:border-[#B91B1C]"
          />
          <button
            type="submit"
            className="absolute right-2 top-1.5 px-3 py-1 bg-[#18181B] text-white text-[11px] font-bold rounded-lg hover:bg-black transition-colors"
          >
            Tìm
          </button>
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#8B9097]" />
            <span className="text-xs font-bold text-[#5F6368]">Cấp độ:</span>
            <select
              value={hskFilter}
              onChange={(e) => setHskFilter(e.target.value)}
              className="h-8 px-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-lg text-xs font-bold text-[#18181B] outline-none"
            >
              <option value="">Tất cả HSK</option>
              <option value="1">HSK 1</option>
              <option value="2">HSK 2</option>
              <option value="3">HSK 3</option>
              <option value="4">HSK 4</option>
              <option value="5">HSK 5</option>
              <option value="6">HSK 6</option>
              <option value="7-9">HSK 7–9</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-xs font-bold text-[#5F6368]">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-lg text-xs font-bold text-[#18181B] outline-none"
            >
              <option value="all">Tất cả</option>
              <option value="published">Đã xuất bản (Published)</option>
              <option value="pending_review">Chờ duyệt (Pending)</option>
              <option value="draft">Bản nháp (Draft)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Vocabulary Data Table */}
      <div className="bg-white rounded-2xl border border-[#E7E7EA] overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F7F7F9] border-b border-[#E7E7EA] text-[#8B9097] uppercase font-bold text-[10px]">
            <tr>
              <th className="p-4">Chữ Hán</th>
              <th className="p-4">Pinyin</th>
              <th className="p-4">Nghĩa Tiếng Việt</th>
              <th className="p-4">Nghĩa Tiếng Anh</th>
              <th className="p-4">Cấp độ</th>
              <th className="p-4">Loại từ</th>
              <th className="p-4">Trạng thái</th>
              <th className="p-4">Nguồn</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E7EA]">
            {loading ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-[#8B9097]">
                  <div className="inline-flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#B91B1C]" />
                    <span>Đang tải dữ liệu từ vựng...</span>
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-[#8B9097]">
                  Không tìm thấy từ vựng nào phù hợp với bộ lọc.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item._id} className="hover:bg-[#F7F7F9]/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-black text-[#18181B]">{item.simplified}</span>
                      {item.traditional && item.traditional !== item.simplified && (
                        <span className="text-[11px] text-[#8B9097] font-serif">({item.traditional})</span>
                      )}
                      <button
                        onClick={() => playAudio(item.simplified)}
                        className={`p-1 rounded-full border transition-colors ${
                          speakingWord === item.simplified
                            ? 'bg-[#B91B1C] text-white border-[#B91B1C]'
                            : 'border-[#E7E7EA] text-[#5F6368] hover:text-[#B91B1C]'
                        }`}
                        title="Phát âm"
                      >
                        <Volume2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="p-4 font-mono font-bold text-[#B91B1C]">{item.pinyin}</td>
                  <td className="p-4 text-[#18181B] font-medium max-w-[200px] truncate">
                    {item.meanings.vi && item.meanings.vi.length > 0 ? (
                      item.meanings.vi.join(', ')
                    ) : (
                      <span className="text-[#8B9097] italic text-[11px]">Chưa bổ sung</span>
                    )}
                  </td>
                  <td className="p-4 text-[#5F6368] max-w-[220px] truncate">
                    {item.meanings.en && item.meanings.en.length > 0 ? item.meanings.en.join(', ') : '—'}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-[#F7F7F9] text-[#18181B] border border-[#E7E7EA]">
                      HSK {item.hskLevel}
                    </span>
                  </td>
                  <td className="p-4 text-[#5F6368] text-[11px]">
                    {item.partOfSpeech && item.partOfSpeech.length > 0 ? item.partOfSpeech.join(', ') : '—'}
                  </td>
                  <td className="p-4">
                    {item.status === 'published' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F4EA] text-[#137333]">
                        Xuất bản
                      </span>
                    )}
                    {item.status === 'pending_review' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF7E0] text-[#B06000]">
                        Chờ duyệt
                      </span>
                    )}
                    {item.status === 'draft' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F1F3F4] text-[#5F6368]">
                        Nháp
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-[10px] text-[#8B9097]">
                    {item.source?.map(s => s.name).join(', ') || 'Dataset'}
                  </td>
                  <td className="p-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => toggleStatus(item)}
                        className="p-1.5 rounded-lg border border-[#E7E7EA] hover:bg-[#F7F7F9] text-[#5F6368]"
                        title={item.status === 'published' ? 'Đổi sang nháp' : 'Xuất bản'}
                      >
                        {item.status === 'published' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-1.5 rounded-lg border border-[#E7E7EA] hover:bg-[#F7F7F9] text-[#5F6368]"
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1.5 rounded-lg border border-[#E7E7EA] hover:bg-[#FDF1F1] text-[#B91B1C]"
                        title="Xóa từ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <div className="p-4 bg-[#F7F7F9] border-t border-[#E7E7EA] flex items-center justify-between">
          <div className="text-xs text-[#5F6368]">
            Hiển thị <span className="font-bold text-[#18181B]">{items.length}</span> / <span className="font-bold text-[#18181B]">{pagination.total.toLocaleString()}</span> từ vựng (Trang {pagination.page} / {pagination.totalPages})
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchList(pagination.page - 1)}
              className="px-3 py-1.5 rounded-lg border border-[#E7E7EA] bg-white text-xs font-bold text-[#18181B] disabled:opacity-40 hover:bg-[#F7F7F9]"
            >
              Trang trước
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchList(pagination.page + 1)}
              className="px-3 py-1.5 rounded-lg border border-[#E7E7EA] bg-white text-xs font-bold text-[#18181B] disabled:opacity-40 hover:bg-[#F7F7F9]"
            >
              Trang sau
            </button>
          </div>
        </div>
      </div>

      {/* Modal Add / Edit */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 border border-[#E7E7EA] shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E7EA]">
              <h2 className="text-lg font-black text-[#18181B]">
                {editingItem ? `Chỉnh sửa từ vựng: ${editingItem.simplified}` : 'Thêm từ vựng HSK mới'}
              </h2>
              <button
                onClick={() => setIsAddEditOpen(false)}
                className="p-1 rounded-lg hover:bg-[#F7F7F9] text-[#8B9097]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#18181B] mb-1">Chữ Hán Giản thể *</label>
                  <input
                    type="text"
                    required
                    value={formData.simplified}
                    onChange={(e) => setFormData({ ...formData, simplified: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C]"
                    placeholder="ví dụ: 喜欢"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#18181B] mb-1">Chữ Hán Phồn thể</label>
                  <input
                    type="text"
                    value={formData.traditional}
                    onChange={(e) => setFormData({ ...formData, traditional: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C]"
                    placeholder="ví dụ: 喜歡"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#18181B] mb-1">Phiên âm Pinyin *</label>
                  <input
                    type="text"
                    required
                    value={formData.pinyin}
                    onChange={(e) => setFormData({ ...formData, pinyin: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C]"
                    placeholder="ví dụ: xǐhuān"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#18181B] mb-1">Cấp độ HSK *</label>
                  <select
                    value={formData.hskLevel}
                    onChange={(e) => setFormData({ ...formData, hskLevel: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] font-bold"
                  >
                    <option value="1">HSK 1</option>
                    <option value="2">HSK 2</option>
                    <option value="3">HSK 3</option>
                    <option value="4">HSK 4</option>
                    <option value="5">HSK 5</option>
                    <option value="6">HSK 6</option>
                    <option value="7-9">HSK 7–9</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#18181B] mb-1">Nghĩa tiếng Việt (phân cách bằng dấu phẩy)</label>
                <input
                  type="text"
                  value={formData.meaningVi}
                  onChange={(e) => setFormData({ ...formData, meaningVi: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C]"
                  placeholder="ví dụ: thích, mến, ưa chuộng"
                />
              </div>

              <div>
                <label className="block font-bold text-[#18181B] mb-1">Nghĩa tiếng Anh (phân cách bằng dấu phẩy)</label>
                <input
                  type="text"
                  value={formData.meaningEn}
                  onChange={(e) => setFormData({ ...formData, meaningEn: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C]"
                  placeholder="ví dụ: to like, to be fond of"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#18181B] mb-1">Loại từ (Part of speech)</label>
                  <input
                    type="text"
                    value={formData.partOfSpeech}
                    onChange={(e) => setFormData({ ...formData, partOfSpeech: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C]"
                    placeholder="động từ, danh từ..."
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#18181B] mb-1">Trạng thái</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] font-bold"
                  >
                    <option value="published">Xuất bản (Published)</option>
                    <option value="pending_review">Chờ duyệt (Pending Review)</option>
                    <option value="draft">Bản nháp (Draft)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#E7E7EA]">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] hover:bg-white text-[#5F6368] font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white font-bold"
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
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 border border-[#E7E7EA] shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E7EA]">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#B91B1C]" />
                <h2 className="text-lg font-black text-[#18181B]">Nhập Từ Vựng Hàng Loạt (Bulk Import)</h2>
              </div>
              <button
                onClick={() => { setIsImportOpen(false); setImportPreview(null); }}
                className="p-1 rounded-lg hover:bg-[#F7F7F9] text-[#8B9097]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {importSuccessMsg && (
              <div className="p-4 rounded-xl bg-[#E6F4EA] border border-[#CEEAD6] text-[#137333] text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{importSuccessMsg}</span>
              </div>
            )}

            {importError && (
              <div className="p-4 rounded-xl bg-[#FDF1F1] border border-[#FAD2CF] text-[#B91B1C] text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* Step 1: Upload / Input */}
              <div className="p-4 bg-[#F7F7F9] rounded-2xl border border-[#E7E7EA] space-y-3">
                <div className="font-bold text-[#18181B]">1. Chọn tập tin CSV / JSON hoặc Dán dữ liệu</div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="file"
                    accept=".csv,.json"
                    onChange={(e) => {
                      setImportFile(e.target.files?.[0] || null);
                      setImportPreview(null);
                    }}
                    className="text-xs text-[#5F6368] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#18181B] file:text-white hover:file:bg-black"
                  />
                  {importFile && (
                    <span className="text-[11px] font-bold text-[#137333]">Đã chọn: {importFile.name}</span>
                  )}
                </div>

                <div className="pt-2">
                  <span className="text-[11px] text-[#8B9097] block mb-1">Hoặc dán mảng JSON:</span>
                  <textarea
                    rows={3}
                    placeholder='[{"simplified": "你好", "pinyin": "nǐhǎo", "hskLevel": 1, "meanings": {"vi": ["xin chào"]}}]'
                    value={importJsonText}
                    onChange={(e) => {
                      setImportJsonText(e.target.value);
                      setImportPreview(null);
                    }}
                    className="w-full p-2.5 bg-white border border-[#E7E7EA] rounded-xl font-mono text-[11px] outline-none"
                  />
                </div>
              </div>

              {/* Step 2: Import Mode */}
              <div className="p-4 bg-[#F7F7F9] rounded-2xl border border-[#E7E7EA] space-y-2">
                <div className="font-bold text-[#18181B]">2. Chọn chế độ xử lý bản ghi trùng (Import Mode)</div>
                <div className="grid grid-cols-3 gap-2">
                  <label className={`p-3 rounded-xl border flex flex-col gap-1 cursor-pointer transition-all ${
                    importStrategy === 'skip_existing' ? 'bg-white border-[#B91B1C] shadow-2xs' : 'border-[#E7E7EA] bg-transparent'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="strategy"
                        value="skip_existing"
                        checked={importStrategy === 'skip_existing'}
                        onChange={() => setImportStrategy('skip_existing')}
                      />
                      <span className="font-bold text-[#18181B]">Bỏ qua</span>
                    </div>
                    <span className="text-[10px] text-[#8B9097]">Giữ nguyên từ đã có (Mặc định an toàn)</span>
                  </label>

                  <label className={`p-3 rounded-xl border flex flex-col gap-1 cursor-pointer transition-all ${
                    importStrategy === 'update_existing' ? 'bg-white border-[#B91B1C] shadow-2xs' : 'border-[#E7E7EA] bg-transparent'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="strategy"
                        value="update_existing"
                        checked={importStrategy === 'update_existing'}
                        onChange={() => setImportStrategy('update_existing')}
                      />
                      <span className="font-bold text-[#18181B]">Cập nhật</span>
                    </div>
                    <span className="text-[10px] text-[#8B9097]">Gộp nghĩa mới vào từ đã có</span>
                  </label>

                  <label className={`p-3 rounded-xl border flex flex-col gap-1 cursor-pointer transition-all ${
                    importStrategy === 'insert_only' ? 'bg-white border-[#B91B1C] shadow-2xs' : 'border-[#E7E7EA] bg-transparent'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="strategy"
                        value="insert_only"
                        checked={importStrategy === 'insert_only'}
                        onChange={() => setImportStrategy('insert_only')}
                      />
                      <span className="font-bold text-[#18181B]">Chỉ thêm mới</span>
                    </div>
                    <span className="text-[10px] text-[#8B9097]">Không chỉnh sửa bản ghi cũ</span>
                  </label>
                </div>
              </div>

              {/* Action: Preview */}
              {!importPreview && (
                <button
                  type="button"
                  disabled={(!importFile && !importJsonText.trim()) || importLoading}
                  onClick={handlePreviewImport}
                  className="w-full py-2.5 rounded-xl bg-[#18181B] hover:bg-black text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {importLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  <span>Kiểm tra & Xem trước (Preview)</span>
                </button>
              )}

              {/* Step 3: Preview Report */}
              {importPreview && (
                <div className="p-4 bg-white rounded-2xl border border-[#E7E7EA] space-y-3">
                  <div className="font-bold text-[#18181B] flex items-center justify-between">
                    <span>Kết quả xem trước (Preview Report)</span>
                    <span className="text-[11px] font-normal text-[#5F6368]">Chưa lưu vào cơ sở dữ liệu</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 bg-[#F7F7F9] rounded-xl text-center">
                      <div className="text-[10px] text-[#8B9097]">Tổng số dòng</div>
                      <div className="text-base font-black text-[#18181B]">{importPreview.summary.total}</div>
                    </div>
                    <div className="p-2.5 bg-[#E6F4EA] rounded-xl text-center">
                      <div className="text-[10px] text-[#137333]">Hợp lệ</div>
                      <div className="text-base font-black text-[#137333]">{importPreview.summary.valid}</div>
                    </div>
                    <div className="p-2.5 bg-[#FDF1F1] rounded-xl text-center">
                      <div className="text-[10px] text-[#B91B1C]">Không hợp lệ</div>
                      <div className="text-base font-black text-[#B91B1C]">{importPreview.summary.invalid}</div>
                    </div>
                    <div className="p-2.5 bg-[#FEF7E0] rounded-xl text-center">
                      <div className="text-[10px] text-[#B06000]">Đã tồn tại</div>
                      <div className="text-base font-black text-[#B06000]">{importPreview.summary.existing}</div>
                    </div>
                  </div>

                  <div className="text-xs text-[#5F6368] space-y-1 pt-1">
                    <div>• Sẽ thêm mới: <span className="font-bold text-[#137333]">{importPreview.summary.new}</span> từ</div>
                    {importStrategy === 'update_existing' && (
                      <div>• Sẽ cập nhật: <span className="font-bold text-[#D97706]">{importPreview.summary.existing}</span> từ đã có</div>
                    )}
                    {importStrategy === 'skip_existing' && (
                      <div>• Sẽ bỏ qua: <span className="font-bold text-[#5F6368]">{importPreview.summary.existing}</span> từ đã có</div>
                    )}
                  </div>

                  {importPreview.validationErrors.length > 0 && (
                    <div className="p-2.5 bg-[#FDF1F1] rounded-xl text-[11px] text-[#B91B1C] max-h-24 overflow-y-auto">
                      <div className="font-bold mb-1">Chi tiết lỗi mẫu:</div>
                      {importPreview.validationErrors.slice(0, 5).map((e, idx) => (
                        <div key={idx}>Dòng {e.row}: {e.error}</div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setImportPreview(null)}
                      className="flex-1 py-2.5 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] font-bold text-[#5F6368]"
                    >
                      Chọn lại file
                    </button>
                    <button
                      type="button"
                      disabled={importLoading || importPreview.summary.valid === 0}
                      onClick={handleConfirmImport}
                      className="flex-1 py-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white font-bold flex items-center justify-center gap-2"
                    >
                      {importLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      <span>Xác nhận nhập vào Database</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
