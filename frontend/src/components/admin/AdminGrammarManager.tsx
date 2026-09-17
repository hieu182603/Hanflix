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

export default function AdminGrammarManager() {
  const [stats, setStats] = useState<GrammarStats | null>(null);
  const [items, setItems] = useState<GrammarItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [hskFilter, setHskFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GrammarItem | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    structure: '',
    pattern: '',
    group: 'Ngữ pháp',
    category: '',
    details: '',
    explanationVi: '',
    explanationEn: '',
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

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      code: '',
      structure: '',
      pattern: '',
      group: 'Cấu trúc câu',
      category: '',
      details: '',
      explanationVi: '',
      explanationEn: '',
      hskLevel: '1',
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
      code: item.code || '',
      structure: item.structure,
      pattern: item.pattern || '',
      group: item.group || 'Ngữ pháp',
      category: item.category || '',
      details: item.details || '',
      explanationVi: item.explanationVi,
      explanationEn: item.explanationEn || '',
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
    try {
      const payload: Partial<GrammarItem> = {
        code: formData.code.trim() || undefined,
        structure: formData.structure.trim(),
        pattern: formData.pattern.trim() || undefined,
        group: formData.group.trim() || undefined,
        category: formData.category.trim() || undefined,
        details: formData.details.trim() || undefined,
        explanationVi: formData.explanationVi.trim(),
        explanationEn: formData.explanationEn.trim() || undefined,
        hskLevel: formData.hskLevel === '7-9' ? '7-9' : (Number(formData.hskLevel) as any),
        status: formData.status,
        examples: formData.exampleZh.trim()
          ? [
              {
                chinese: formData.exampleZh.trim(),
                pinyin: formData.examplePinyin.trim() || undefined,
                vietnamese: formData.exampleVi.trim() || undefined,
              },
            ]
          : [],
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
      setItems(items.map((it) => (it._id === item._id ? { ...it, status: nextStatus } : it)));
      fetchStats();
    } catch (err) {
      alert('Không thể cập nhật trạng thái');
    }
  };

  const handleDelete = async (item: GrammarItem) => {
    if (!window.confirm(`Bạn có chắc muốn xóa điểm ngữ pháp "${item.structure}"?`)) return;
    try {
      await deleteAdminGrammar(item._id);
      setItems(items.filter((it) => it._id !== item._id));
      fetchStats();
    } catch (err) {
      alert('Không thể xóa điểm ngữ pháp');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-6 border border-[#E7E7EA] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#18181B] tracking-tight">Quản Lý Ngữ Pháp HSK</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FDF1F1] text-[#B91B1C] text-[11px] font-black uppercase">
              HSK 3.0 Syllabus
            </span>
          </div>
          <p className="text-xs text-[#5F6368] mt-1">
            Hệ thống điểm ngữ pháp, cấu trúc câu, từ loại và công thức phân theo từng cấp độ HSK 1 đến HSK 6.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="h-10 px-4 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-2xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Điểm Ngữ Pháp</span>
        </button>
      </div>

      {/* Stats Cards (matching design mockup) */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="p-3.5 bg-white rounded-2xl border border-[#E7E7EA]">
            <div className="text-[10px] font-extrabold uppercase text-[#8B9097]">Tổng điểm NP</div>
            <div className="text-xl font-black text-[#18181B] mt-0.5">{stats.total.toLocaleString()}</div>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#E7E7EA]">
            <div className="text-[10px] font-extrabold uppercase text-[#188A5A]">HSK 1</div>
            <div className="text-xl font-black text-[#18181B] mt-0.5">{stats.byLevel[1] || 0}</div>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#E7E7EA]">
            <div className="text-[10px] font-extrabold uppercase text-[#2563EB]">HSK 2</div>
            <div className="text-xl font-black text-[#18181B] mt-0.5">{stats.byLevel[2] || 0}</div>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#E7E7EA]">
            <div className="text-[10px] font-extrabold uppercase text-[#7C3AED]">HSK 3</div>
            <div className="text-xl font-black text-[#18181B] mt-0.5">{stats.byLevel[3] || 0}</div>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#E7E7EA]">
            <div className="text-[10px] font-extrabold uppercase text-[#D97706]">HSK 4</div>
            <div className="text-xl font-black text-[#18181B] mt-0.5">{stats.byLevel[4] || 0}</div>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#E7E7EA]">
            <div className="text-[10px] font-extrabold uppercase text-[#EA580C]">HSK 5</div>
            <div className="text-xl font-black text-[#18181B] mt-0.5">{stats.byLevel[5] || 0}</div>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#E7E7EA]">
            <div className="text-[10px] font-extrabold uppercase text-[#B91B1C]">HSK 6</div>
            <div className="text-xl font-black text-[#18181B] mt-0.5">{stats.byLevel[6] || 0}</div>
          </div>
          <div className="p-3.5 bg-white rounded-2xl border border-[#E7E7EA]">
            <div className="text-[10px] font-extrabold uppercase text-[#B06000]">Chờ duyệt</div>
            <div className="text-xl font-black text-[#B06000] mt-0.5">{stats.byStatus.pending_review || 0}</div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E7E7EA] flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-[#8B9097] absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Tìm theo cấu trúc, công thức hoặc giải thích..."
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
              <option value="published">Đã xuất bản</option>
              <option value="pending_review">Chờ duyệt</option>
              <option value="draft">Bản nháp</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grammar Table */}
      <div className="bg-white rounded-2xl border border-[#E7E7EA] overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F7F7F9] border-b border-[#E7E7EA] text-[#8B9097] uppercase font-bold text-[10px]">
            <tr>
              <th className="p-4 w-24">Mã số</th>
              <th className="p-4">Cấu trúc ngữ pháp</th>
              <th className="p-4">Công thức / Quy tắc</th>
              <th className="p-4">Giải thích ý nghĩa</th>
              <th className="p-4">Cấp độ</th>
              <th className="p-4">Trạng thái</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E7EA]">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[#8B9097]">
                  <div className="inline-flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#B91B1C]" />
                    <span>Đang tải danh sách ngữ pháp...</span>
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[#8B9097]">
                  Không tìm thấy điểm ngữ pháp nào phù hợp.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item._id} className="hover:bg-[#F7F7F9]/50 transition-colors">
                  <td className="p-4 font-mono font-bold text-[#8B9097] text-[11px]">
                    {item.code || `GF-${item._id.slice(-4)}`}
                  </td>
                  <td className="p-4">
                    <div className="font-mono text-base font-black text-[#18181B]">{item.structure}</div>
                    {item.group && (
                      <div className="text-[10px] text-[#8B9097] font-sans mt-0.5">{item.group}</div>
                    )}
                  </td>
                  <td className="p-4 text-[#5F6368] font-mono text-[11px] max-w-[240px] truncate">
                    {item.pattern || '—'}
                  </td>
                  <td className="p-4 font-medium text-[#18181B] max-w-[260px] truncate">
                    {item.explanationVi}
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-0.5 rounded-md font-bold text-[10px] bg-[#F7F7F9] text-[#18181B] border border-[#E7E7EA]">
                      HSK {item.hskLevel}
                    </span>
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
                  <td className="p-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => toggleStatus(item)}
                        className="p-1.5 rounded-lg border border-[#E7E7EA] hover:bg-[#F7F7F9] text-[#5F6368]"
                        title={item.status === 'published' ? 'Chuyển sang nháp' : 'Xuất bản'}
                      >
                        {item.status === 'published' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-1.5 rounded-lg border border-[#E7E7EA] hover:bg-[#F7F7F9] text-[#5F6368]"
                        title="Sửa"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1.5 rounded-lg border border-[#E7E7EA] hover:bg-[#FDF1F1] text-[#B91B1C]"
                        title="Xóa"
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
            Hiển thị <span className="font-bold text-[#18181B]">{items.length}</span> /{' '}
            <span className="font-bold text-[#18181B]">{pagination.total.toLocaleString()}</span> điểm ngữ pháp (Trang{' '}
            {pagination.page} / {pagination.totalPages})
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

      {/* Modal Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 border border-[#E7E7EA] shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E7EA]">
              <h2 className="text-lg font-black text-[#18181B]">
                {editingItem ? `Chỉnh sửa ngữ pháp: ${editingItem.structure}` : 'Thêm Điểm Ngữ Pháp HSK Mới'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#F7F7F9] text-[#8B9097]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#18181B] mb-1">Cấu trúc / Điểm ngữ pháp *</label>
                  <input
                    type="text"
                    required
                    value={formData.structure}
                    onChange={(e) => setFormData({ ...formData, structure: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C]"
                    placeholder="ví dụ: 不但...而且..."
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
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#18181B] mb-1">Công thức mẫu (Pattern)</label>
                <input
                  type="text"
                  value={formData.pattern}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C] font-mono"
                  placeholder="ví dụ: S + 不但 + V1/Adj1 + 而且 + V2/Adj2"
                />
              </div>

              <div>
                <label className="block font-bold text-[#18181B] mb-1">Giải thích nghĩa tiếng Việt *</label>
                <input
                  type="text"
                  required
                  value={formData.explanationVi}
                  onChange={(e) => setFormData({ ...formData, explanationVi: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C]"
                  placeholder="ví dụ: Không những... mà còn... (biểu thị ý tăng tiến)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#18181B] mb-1">Nhóm ngữ pháp</label>
                  <input
                    type="text"
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl outline-none focus:border-[#B91B1C]"
                    placeholder="Cụm từ, Câu phức, Trợ từ..."
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

              {/* Example sentence */}
              <div className="p-3 bg-[#F7F7F9] rounded-2xl border border-[#E7E7EA] space-y-2">
                <span className="font-bold text-[#18181B] block">Câu ví dụ minh họa:</span>
                <input
                  type="text"
                  value={formData.exampleZh}
                  onChange={(e) => setFormData({ ...formData, exampleZh: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-[#E7E7EA] rounded-xl outline-none"
                  placeholder="Chữ Hán: 他不但聪明，而且很努力。"
                />
                <input
                  type="text"
                  value={formData.exampleVi}
                  onChange={(e) => setFormData({ ...formData, exampleVi: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-[#E7E7EA] rounded-xl outline-none"
                  placeholder="Dịch nghĩa: Anh ấy không những thông minh mà còn rất chăm chỉ."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#E7E7EA]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] hover:bg-white text-[#5F6368] font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-white font-bold"
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
