import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Plus,
  Filter,
  Edit2,
  Trash2,
  X,
  RefreshCw,
  Eye,
  EyeOff,
  BookOpen,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Volume2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
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

const HSK_LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

const HSK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '1': { bg: 'bg-[#E6F4EA]', text: 'text-[#137333]', border: 'border-[#CEEAD6]' },
  '2': { bg: 'bg-[#E8F0FE]', text: 'text-[#1A73E8]', border: 'border-[#D2E3FC]' },
  '3': { bg: 'bg-[#F3E8FD]', text: 'text-[#9334E6]', border: 'border-[#E9D5FF]' },
  '4': { bg: 'bg-[#FEF7E0]', text: 'text-[#B06000]', border: 'border-[#FEEFC3]' },
  '5': { bg: 'bg-[#FFF0E6]', text: 'text-[#EA580C]', border: 'border-[#FED7AA]' },
  '6': { bg: 'bg-[#FDF1F1]', text: 'text-[#B91B1C]', border: 'border-[#FAD2CF]' },
  '7': { bg: 'bg-[#F1F5F9]', text: 'text-[#475569]', border: 'border-[#CBD5E1]' },
  '8': { bg: 'bg-[#F8FAFC]', text: 'text-[#334155]', border: 'border-[#94A3B8]' },
  '9': { bg: 'bg-[#0F172A]', text: 'text-white', border: 'border-[#1E293B]' },
  '7-9': { bg: 'bg-[#F1F5F9]', text: 'text-[#475569]', border: 'border-[#CBD5E1]' },
};

export default function AdminGrammarManager() {
  const [stats, setStats] = useState<GrammarStats | null>(null);
  const [items, setItems] = useState<GrammarItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [hskFilter, setHskFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Expanded details row
  const [expandedId, setExpandedId] = useState<string | null>(null);
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

  const fetchList = async (page = 1) => {
    setLoading(true);
    try {
      const res = await getAdminGrammarList({
        page,
        limit: 20,
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
    if (!window.confirm(`Bạn có chắc muốn xóa điểm ngữ pháp "${item.structure}"?`)) return;
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
      <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FDF1F1] text-[#B91B1C] flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-[#18181B] tracking-tight">Quản Lý Ngữ Pháp HSK 3.0</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-[#FDF1F1] text-[#B91B1C] text-[11px] font-black uppercase tracking-wider">
                HSK 1 - 9
              </span>
            </div>
            <p className="text-xs text-[#5F6368] mt-0.5">
              Hệ thống công thức, cấu trúc câu và câu ví dụ minh họa phân cấp chuẩn từ HSK 1 đến HSK 9.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              fetchStats();
              fetchList(pagination.page);
            }}
            disabled={loading}
            className="h-10 px-4 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] hover:bg-white text-[#18181B] text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-40 shadow-2xs"
          >
            <RefreshCw className={`w-4 h-4 text-[#5F6368] ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
          <button
            onClick={openAddModal}
            className="h-10 px-4 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Điểm Ngữ Pháp</span>
          </button>
        </div>
      </div>

      {/* Stats Bento Strip (Total + HSK 1 to 9) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2.5">
        <button
          onClick={() => setHskFilter('')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            hskFilter === ''
              ? 'bg-[#18181B] text-white border-[#18181B] shadow-2xs'
              : 'bg-white border-[#E7E7EA] hover:border-[#18181B]/40'
          }`}
        >
          <div className={`text-[10px] font-extrabold uppercase ${hskFilter === '' ? 'text-[#A1A1AA]' : 'text-[#8B9097]'}`}>
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
              className={`p-3 rounded-2xl border text-left transition-all ${
                isSelected
                  ? 'ring-2 ring-[#B91B1C] bg-white border-transparent shadow-xs'
                  : 'bg-white border-[#E7E7EA] hover:border-[#18181B]/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${styling.bg} ${styling.text}`}>
                  HSK {lvl}
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#B91B1C]" />}
              </div>
              <div className="text-lg font-black text-[#18181B] mt-1">{count.toLocaleString()}</div>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E7E7EA] flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-[#8B9097] absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Tìm theo cấu trúc, công thức hoặc giải thích nghĩa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-20 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl text-xs outline-none focus:border-[#B91B1C] transition-colors"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1 px-3 py-1.5 bg-[#18181B] text-white text-[11px] font-bold rounded-lg hover:bg-black transition-colors"
          >
            Tìm kiếm
          </button>
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto justify-between md:justify-end">
          {/* Quick HSK Selector Pills */}
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            <span className="text-[11px] font-bold text-[#8B9097] mr-1 hidden lg:inline">Cấp độ:</span>
            {HSK_LEVELS.map((lvl) => (
              <button
                key={lvl}
                onClick={() => setHskFilter(hskFilter === lvl ? '' : lvl)}
                className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-colors ${
                  hskFilter === lvl
                    ? 'bg-[#B91B1C] text-white'
                    : 'bg-[#F7F7F9] text-[#5F6368] hover:bg-[#E7E7EA]'
                }`}
              >
                H{lvl}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 shrink-0 border-l border-[#E7E7EA] pl-3">
            <Filter className="w-3.5 h-3.5 text-[#8B9097]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-lg text-xs font-bold text-[#18181B] outline-none cursor-pointer"
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
      <div className="bg-white rounded-3xl border border-[#E7E7EA] overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F7F7F9] border-b border-[#E7E7EA] text-[#8B9097] uppercase font-bold text-[10px] tracking-wider">
            <tr>
              <th className="p-4 w-[230px]">Cấu trúc ngữ pháp</th>
              <th className="p-4 w-[240px]">Công thức / Quy tắc</th>
              <th className="p-4">Ý nghĩa tiếng Việt</th>
              <th className="p-4 w-[110px]">Cấp độ</th>
              <th className="p-4 w-[140px]">Trạng thái</th>
              <th className="p-4 text-right w-[110px]">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E7EA]">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-[#8B9097]">
                  <div className="inline-flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#B91B1C]" />
                    <span>Đang tải danh sách ngữ pháp HSK...</span>
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-[#8B9097]">
                  Không tìm thấy điểm ngữ pháp nào phù hợp với bộ lọc hiện tại.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const lvlKey = String(item.hskLevel);
                const styling = HSK_COLORS[lvlKey] || HSK_COLORS['1'];
                const isExpanded = expandedId === item._id;
                const ex = item.examples && item.examples.length > 0 ? item.examples[0] : null;

                return (
                  <React.Fragment key={item._id}>
                    <tr className="hover:bg-[#F7F7F9]/60 transition-colors group">
                      {/* Structure + Group */}
                      <td className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-serif text-base font-black text-[#18181B] tracking-wide">
                              {item.structure}
                            </div>
                            {item.group && (
                              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#F7F7F9] text-[#5F6368] border border-[#E7E7EA]">
                                {item.group}
                              </span>
                            )}
                          </div>
                          {ex && (
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : item._id)}
                              className={`p-1 rounded-lg border transition-all ${
                                isExpanded
                                  ? 'bg-[#18181B] text-white border-[#18181B]'
                                  : 'bg-white text-[#5F6368] border-[#E7E7EA] hover:border-[#B91B1C] hover:text-[#B91B1C]'
                              }`}
                              title={isExpanded ? 'Thu gọn ví dụ' : 'Xem ví dụ minh họa'}
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Pattern / Formula */}
                      <td className="p-4">
                        {item.pattern ? (
                          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#18181B] bg-[#F7F7F9] px-2.5 py-1.5 rounded-xl border border-[#E7E7EA] max-w-[230px]">
                            <span className="truncate flex-1">{item.pattern}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.pattern!, item._id)}
                              className="text-[#8B9097] hover:text-[#18181B] shrink-0"
                              title="Sao chép công thức"
                            >
                              {copiedId === item._id ? <Check className="w-3.5 h-3.5 text-[#137333]" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[#8B9097] text-[11px] italic">—</span>
                        )}
                      </td>

                      {/* Vietnamese Explanation */}
                      <td className="p-4">
                        <div className="text-[#18181B] font-semibold text-xs leading-relaxed max-w-[320px]">
                          {item.explanationVi}
                        </div>
                        {ex && !isExpanded && (
                          <div className="text-[11px] text-[#8B9097] mt-0.5 line-clamp-1 italic">
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
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase transition-all ${
                            item.status === 'published'
                              ? 'bg-[#E6F4EA] text-[#137333] hover:bg-[#CEEAD6]'
                              : item.status === 'pending_review'
                              ? 'bg-[#FEF7E0] text-[#B06000] hover:bg-[#FEEFC3]'
                              : 'bg-[#F1F3F4] text-[#5F6368] hover:bg-[#E8EAED]'
                          }`}
                          title="Bấm để chuyển đổi giữa Xuất bản và Bản nháp"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'published' ? 'bg-[#188A5A]' : 'bg-[#8B9097]'}`} />
                          <span>{item.status === 'published' ? 'Published' : item.status === 'pending_review' ? 'Pending' : 'Draft'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 rounded-lg border border-[#E7E7EA] bg-white text-[#5F6368] hover:text-[#18181B] hover:bg-[#F7F7F9] transition-colors"
                            title="Chỉnh sửa ngữ pháp"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1.5 rounded-lg border border-[#E7E7EA] bg-white text-[#5F6368] hover:text-[#B91B1C] hover:bg-[#FDF1F1] transition-colors"
                            title="Xóa ngữ pháp"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Example Drawer */}
                    {isExpanded && ex && (
                      <tr className="bg-[#FAF9F5] border-t border-b border-[#E7E7EA]">
                        <td colSpan={6} className="p-4 pl-8">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-[#8B9097]">
                                <Sparkles className="w-3.5 h-3.5 text-[#E7A92F]" />
                                <span>Ví dụ câu thực tế chuẩn HSK</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-serif text-base font-bold text-[#18181B]">
                                  {ex.chinese}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => playAudio(ex.chinese)}
                                  className={`p-1 rounded-lg border transition-colors ${
                                    speakingText === ex.chinese
                                      ? 'bg-[#B91B1C] text-white border-[#B91B1C]'
                                      : 'border-[#E7E7EA] bg-white text-[#5F6368] hover:text-[#B91B1C]'
                                  }`}
                                  title="Nghe phát âm câu mẫu"
                                >
                                  <Volume2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {ex.pinyin && (
                                <p className="font-mono text-xs font-bold text-[#B91B1C]">
                                  {ex.pinyin}
                                </p>
                              )}
                              {ex.vietnamese && (
                                <p className="text-xs text-[#5F6368]">
                                  {ex.vietnamese}
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => setExpandedId(null)}
                              className="text-[11px] font-bold text-[#8B9097] hover:text-[#18181B]"
                            >
                              Đóng
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Strip */}
        <div className="p-4 bg-[#F7F7F9] border-t border-[#E7E7EA] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5F6368]">
          <div>
            Hiển thị <span className="font-bold text-[#18181B]">{items.length}</span> /{' '}
            <span className="font-bold text-[#18181B]">{pagination.total.toLocaleString()}</span> điểm ngữ pháp (Trang{' '}
            <span className="font-bold text-[#18181B]">{pagination.page}</span> / {pagination.totalPages || 1})
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchList(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="h-8 px-3 rounded-lg border border-[#E7E7EA] bg-white text-[#18181B] font-bold text-xs flex items-center gap-1 disabled:opacity-40 hover:bg-[#F7F7F9] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Trước</span>
            </button>
            <button
              onClick={() => fetchList(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="h-8 px-3 rounded-lg border border-[#E7E7EA] bg-white text-[#18181B] font-bold text-xs flex items-center gap-1 disabled:opacity-40 hover:bg-[#F7F7F9] transition-colors"
            >
              <span>Tiếp</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Streamlined Modal Add / Edit (Core Fields Only) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-[#E7E7EA] shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E7EA]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FDF1F1] text-[#B91B1C] flex items-center justify-center font-bold">
                  {editingItem ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <h2 className="text-lg font-black text-[#18181B]">
                  {editingItem ? 'Chỉnh Sửa Ngữ Pháp' : 'Thêm Điểm Ngữ Pháp HSK'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#F7F7F9] text-[#8B9097] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              {/* Row 1: Structure & HSK Level */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#18181B] mb-1.5">
                    Cấu trúc ngữ pháp <span className="text-[#B91B1C]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={formData.structure}
                    onChange={(e) => setFormData({ ...formData, structure: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] font-serif text-base font-black text-[#18181B]"
                    placeholder="ví dụ: 不但……而且……"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#18181B] mb-1.5">
                    Cấp độ HSK <span className="text-[#B91B1C]">*</span>
                  </label>
                  <select
                    value={formData.hskLevel}
                    onChange={(e) => setFormData({ ...formData, hskLevel: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] font-bold text-xs"
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
                <label className="block font-bold text-[#18181B] mb-1.5">
                  Công thức mẫu / Quy tắc cú pháp (Pattern)
                </label>
                <input
                  type="text"
                  value={formData.pattern}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] font-mono text-xs font-bold"
                  placeholder="ví dụ: S + 不但 + V/Adj1 + 而且 + V/Adj2"
                />
              </div>

              {/* Row 3: Vietnamese Explanation */}
              <div>
                <label className="block font-bold text-[#18181B] mb-1.5">
                  Giải thích ý nghĩa tiếng Việt <span className="text-[#B91B1C]">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={formData.explanationVi}
                  onChange={(e) => setFormData({ ...formData, explanationVi: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] resize-none leading-relaxed"
                  placeholder="ví dụ: Không những... mà còn... Biểu thị quan hệ tăng tiến giữa hai phân câu."
                />
              </div>

              {/* Row 4: Group & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#18181B] mb-1.5">Nhóm phân loại</label>
                  <input
                    type="text"
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C]"
                    placeholder="Câu phức, Trợ từ, Câu chữ 把..."
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#18181B] mb-1.5">Trạng thái xuất bản</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2.5 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] font-bold text-xs"
                  >
                    <option value="published">Xuất bản (Published)</option>
                    <option value="draft">Bản nháp (Draft)</option>
                    <option value="pending_review">Chờ duyệt (Pending Review)</option>
                  </select>
                </div>
              </div>

              {/* Row 5: Example Sentence */}
              <div className="p-3.5 bg-[#F7F7F9] rounded-2xl border border-[#E7E7EA] space-y-2">
                <span className="font-bold text-[#18181B] block">Câu ví dụ minh họa (Tùy chọn):</span>
                <input
                  type="text"
                  value={formData.exampleZh}
                  onChange={(e) => setFormData({ ...formData, exampleZh: e.target.value })}
                  placeholder="Chữ Hán: 他不但聪明，而且很努力。"
                  className="w-full px-3 py-2 bg-white border border-[#E7E7EA] rounded-xl outline-none font-serif font-bold text-xs"
                />
                <input
                  type="text"
                  value={formData.examplePinyin}
                  onChange={(e) => setFormData({ ...formData, examplePinyin: e.target.value })}
                  placeholder="Phiên âm: Tā búdàn cōngmíng, érqiě hěn nǔlì."
                  className="w-full px-3 py-2 bg-white border border-[#E7E7EA] rounded-xl outline-none font-mono text-xs text-[#B91B1C]"
                />
                <input
                  type="text"
                  value={formData.exampleVi}
                  onChange={(e) => setFormData({ ...formData, exampleVi: e.target.value })}
                  placeholder="Dịch nghĩa: Anh ấy không những thông minh mà còn rất chăm chỉ."
                  className="w-full px-3 py-2 bg-white border border-[#E7E7EA] rounded-xl outline-none text-xs"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E7E7EA]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] hover:bg-white text-[#5F6368] font-bold transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white font-bold transition-colors shadow-2xs"
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
