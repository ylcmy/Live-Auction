import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Package,
  Eye,
  ArrowUpDown,
  Trash2,
  ArrowUp,
  ArrowDown,
  SquareCheck,
  Square,
} from 'lucide-react';
import api from '../../services/api';
import { useConfirm } from '../../components/admin/ConfirmDialog';
import { toast } from '../../design-system/hooks/use-toast';
import type { Product, PaginatedData } from '../../types/api';

type StatusFilter = 'all' | 'draft' | 'pending' | 'active' | 'ended' | 'cancelled';

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部商品' },
  { value: 'active', label: '竞拍中' },
  { value: 'pending', label: '待上架' },
  { value: 'draft', label: '草稿' },
  { value: 'ended', label: '已结束' },
  { value: 'cancelled', label: '已取消' },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400', label: '草稿' },
  pending: { bg: 'bg-sky-50', text: 'text-sky-600', dot: 'bg-sky-500', label: '待上架' },
  active: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', label: '竞拍中' },
  ended: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500', label: '已结束' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500', label: '已取消' },
  unsold: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400', label: '未售出' },
};

interface ProductRow extends Product {
  currentPrice?: number | null;
  bidCount?: number;
}

export default function ProductList() {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<'name' | 'startPrice' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = { page, limit };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = (await api.get<{ data: PaginatedData<Product> }>('/products', params)) as any;
      const data = response.data as PaginatedData<Product>;
      setProducts((data.items || []) as ProductRow[]);
      setTotal(data.total || 0);
      setSelectedIds(new Set());
    } catch {
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = products.filter((p) =>
    searchQuery
      ? p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(p.id).includes(searchQuery)
      : true
  );

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortField) return 0;
    let cmp = 0;
    if (sortField === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortField === 'startPrice') {
      const pa = a.rule?.startPrice ?? 0;
      const pb = b.rule?.startPrice ?? 0;
      cmp = pa - pb;
    }
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.ceil(total / limit);

  const toggleSort = (field: 'name' | 'startPrice') => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedProducts.length && sortedProducts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedProducts.map((p) => p.id)));
    }
  };

  const handleBatchDelete = async () => {
    const ok = await confirm({
      title: '批量删除商品',
      description: `确定要删除选中的 ${selectedIds.size} 个商品吗？此操作不可撤销。`,
      variant: 'danger',
      confirmText: '确认删除',
    });
    if (!ok) return;
    try {
      await Promise.all([...selectedIds].map((id) => api.delete(`/products/${id}`)));
      toast({ title: '删除成功', description: `已删除 ${selectedIds.size} 个商品`, variant: 'success' });
      fetchProducts();
    } catch {
      toast({ title: '删除失败', description: '请稍后重试', variant: 'destructive' });
    }
  };

  const handleBatchShelf = async (up: boolean) => {
    const ok = await confirm({
      title: up ? '批量上架商品' : '批量取消商品',
      description: up
        ? `确定要上架选中的 ${selectedIds.size} 个商品吗？上架后商品将进入待竞拍状态。`
        : `确定要取消选中的 ${selectedIds.size} 个商品吗？`,
      variant: up ? 'info' : 'warning',
      confirmText: up ? '确认上架' : '确认取消',
    });
    if (!ok) return;
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          api.put(`/products/${id}/status`, { status: up ? 'pending' : 'cancelled' })
        )
      );
      toast({ title: '操作成功', description: `已${up ? '上架' : '取消'} ${selectedIds.size} 个商品`, variant: 'success' });
      fetchProducts();
    } catch {
      toast({ title: '操作失败', description: '请稍后重试', variant: 'destructive' });
    }
  };

  const handleSingleAction = async (id: number, action: 'up' | 'down' | 'delete') => {
    if (action === 'delete') {
      const ok = await confirm({
        title: '删除商品',
        description: '确定要删除此商品吗？此操作不可撤销。',
        variant: 'danger',
        confirmText: '确认删除',
      });
      if (!ok) return;
      try {
        await api.delete(`/products/${id}`);
        toast({ title: '删除成功', variant: 'success' });
        fetchProducts();
      } catch {
        toast({ title: '删除失败', description: '请稍后重试', variant: 'destructive' });
      }
      return;
    }
    if (action === 'up') {
      const ok = await confirm({
        title: '上架商品',
        description: '确定要将此商品上架吗？上架后商品将进入待竞拍状态。',
        variant: 'info',
        confirmText: '确认上架',
      });
      if (!ok) return;
      try {
        await api.put(`/products/${id}/status`, { status: 'pending' });
        toast({ title: '上架成功', description: '商品已进入待竞拍状态', variant: 'success' });
        fetchProducts();
      } catch {
        toast({ title: '上架失败', description: '请稍后重试', variant: 'destructive' });
      }
      return;
    }
    const product = products.find((p) => p.id === id);
    const isActive = product?.status === 'active';
    const ok = await confirm({
      title: isActive ? '取消竞拍' : '取消上架',
      description: isActive
        ? '确定要取消此商品的竞拍吗？当前所有出价将被作废。'
        : '确定要取消此商品的上架吗？商品将回到可重新上架的状态。',
      variant: isActive ? 'warning' : 'warning',
      confirmText: isActive ? '确认取消竞拍' : '确认取消上架',
    });
    if (!ok) return;
    try {
      await api.put(`/products/${id}/status`, { status: 'cancelled' });
      toast({ title: '操作成功', description: isActive ? '竞拍已取消' : '上架已取消', variant: 'success' });
      fetchProducts();
    } catch {
      toast({ title: '操作失败', description: '请稍后重试', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">商品管理</h1>
          <p className="text-text-tertiary text-sm mt-1">管理您的直播竞拍商品，共 {total} 个商品</p>
        </div>
        <button
          onClick={() => navigate('/admin/products/create')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-lg font-medium transition-all shadow-glow-brand hover:shadow-lg active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          添加商品
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setStatusFilter(opt.value);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilter === opt.value
                  ? 'bg-brand text-white shadow-glow-brand'
                  : 'bg-surface-card text-text-secondary hover:bg-surface-secondary hover:text-text-primary border border-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="搜索商品名称或ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 bg-surface-card border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
            />
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-card border border-slate-200 rounded-lg text-text-secondary hover:bg-surface-secondary transition-all">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">筛选</span>
          </button>
        </div>
      </div>

      {/* Batch Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-brand/5 border border-brand/20 rounded-xl px-4 py-3">
          <span className="text-sm text-brand font-medium">已选择 {selectedIds.size} 个商品</span>
          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => handleBatchShelf(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-brand-hover text-white rounded-lg text-xs font-medium transition-all"
            >
              <ArrowUp className="w-3 h-3" />
              上架
            </button>
            <button
              onClick={() => handleBatchShelf(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-card border border-slate-200 hover:bg-surface-secondary text-text-secondary rounded-lg text-xs font-medium transition-all"
            >
              <ArrowDown className="w-3 h-3" />
              下架
            </button>
            <button
              onClick={handleBatchDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium transition-all"
            >
              <Trash2 className="w-3 h-3" />
              删除
            </button>
          </div>
        </div>
      )}

      {/* Product Table */}
      {loading ? (
        <div className="bg-surface-card border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
                <div className="w-5 h-5 bg-slate-200 rounded" />
                <div className="w-12 h-12 bg-slate-200 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/3" />
                </div>
                <div className="h-4 bg-slate-200 rounded w-20" />
              </div>
            ))}
          </div>
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
          <Package className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">暂无商品</p>
          <p className="text-sm mt-1">点击上方按钮添加您的第一个商品</p>
        </div>
      ) : (
        <>
          <div className="bg-surface-card border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {/* Table Header */}
            <div className="hidden lg:grid grid-cols-12 gap-4 px-5 py-3 bg-surface-secondary/50 border-b border-slate-200 text-text-tertiary text-xs font-medium uppercase tracking-wider items-center">
              <div className="col-span-1 flex items-center">
                <button onClick={toggleSelectAll} className="text-text-tertiary hover:text-brand transition-colors">
                  {selectedIds.size === sortedProducts.length && sortedProducts.length > 0 ? (
                    <SquareCheck className="w-4 h-4 text-brand" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="col-span-4">商品信息</div>
              <div className="col-span-1 text-right cursor-pointer hover:text-brand flex items-center justify-end gap-1" onClick={() => toggleSort('startPrice')}>
                起拍价
                <ArrowUpDown className="w-3 h-3" />
              </div>
              <div className="col-span-1 text-right">加价幅度</div>
              <div className="col-span-1 text-right">封顶价</div>
              <div className="col-span-1 text-right">当前出价</div>
              <div className="col-span-1 text-right">出价次数</div>
              <div className="col-span-1 text-center">状态</div>
              <div className="col-span-1 text-right">操作</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-slate-100">
              {sortedProducts.map((product) => {
                const status = STATUS_STYLES[product.status] ?? STATUS_STYLES.draft;
                const isSelected = selectedIds.has(product.id);
                return (
                  <div
                    key={product.id}
                    className="flex flex-col lg:grid lg:grid-cols-12 gap-2 lg:gap-4 px-5 py-4 hover:bg-slate-50 transition-colors items-start lg:items-center"
                  >
                    {/* Checkbox */}
                    <div className="lg:col-span-1 flex items-center">
                      <button
                        onClick={() => toggleSelect(product.id)}
                        className="text-text-tertiary hover:text-brand transition-colors"
                      >
                        {isSelected ? (
                          <SquareCheck className="w-4 h-4 text-brand" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Product Info */}
                    <div className="lg:col-span-4 flex items-center gap-3 min-w-0 w-full">
                      <div className="w-12 h-12 rounded-lg bg-surface-secondary flex-shrink-0 overflow-hidden border border-slate-200">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-5 h-5 text-text-tertiary opacity-30" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-text-primary text-sm font-medium truncate">{product.name}</p>
                        <p className="text-text-tertiary text-xs mt-0.5">ID: {product.id}</p>
                      </div>
                    </div>

                    {/* Start Price */}
                    <div className="lg:col-span-1 lg:text-right flex items-center justify-between lg:block w-full">
                      <span className="lg:hidden text-text-tertiary text-xs">起拍价</span>
                      <span className="text-text-primary text-sm font-medium">
                        ¥{Number(product.rule?.startPrice ?? 0).toLocaleString()}
                      </span>
                    </div>

                    {/* Bid Increment */}
                    <div className="lg:col-span-1 lg:text-right flex items-center justify-between lg:block w-full">
                      <span className="lg:hidden text-text-tertiary text-xs">加价幅度</span>
                      <span className="text-text-secondary text-sm">
                        ¥{Number(product.rule?.bidIncrement ?? 0).toLocaleString()}
                      </span>
                    </div>

                    {/* Ceiling Price */}
                    <div className="lg:col-span-1 lg:text-right flex items-center justify-between lg:block w-full">
                      <span className="lg:hidden text-text-tertiary text-xs">封顶价</span>
                      <span className="text-text-secondary text-sm">
                        {product.rule?.ceilingPrice ? `¥${Number(product.rule.ceilingPrice).toLocaleString()}` : '-'}
                      </span>
                    </div>

                    {/* Current Price */}
                    <div className="lg:col-span-1 lg:text-right flex items-center justify-between lg:block w-full">
                      <span className="lg:hidden text-text-tertiary text-xs">当前出价</span>
                      <span className="text-brand font-bold text-sm">
                        {product.currentPrice ? `¥${Number(product.currentPrice).toLocaleString()}` : '-'}
                      </span>
                    </div>

                    {/* Bid Count */}
                    <div className="lg:col-span-1 lg:text-right flex items-center justify-between lg:block w-full">
                      <span className="lg:hidden text-text-tertiary text-xs">出价次数</span>
                      <span className="text-text-secondary text-sm">{product.bidCount ?? 0}</span>
                    </div>

                    {/* Status */}
                    <div className="lg:col-span-1 lg:text-center flex items-center justify-between lg:block w-full">
                      <span className="lg:hidden text-text-tertiary text-xs">状态</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                        <span className={`w-1 h-1 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="lg:col-span-1 flex items-center justify-end gap-1 w-full">
                      <button
                        onClick={() => navigate(`/admin/products/${product.id}`)}
                        className="p-1.5 text-text-tertiary hover:text-brand hover:bg-brand/5 rounded-lg transition-all"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {product.status === 'draft' || product.status === 'cancelled' ? (
                        <button
                          onClick={() => handleSingleAction(product.id, 'up')}
                          className="p-1.5 text-text-tertiary hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          title="上架"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                      ) : product.status === 'pending' ? (
                        <button
                          onClick={() => handleSingleAction(product.id, 'down')}
                          className="p-1.5 text-text-tertiary hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                          title="取消上架"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      ) : product.status === 'active' ? (
                        <button
                          onClick={() => handleSingleAction(product.id, 'down')}
                          className="p-1.5 text-text-tertiary hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="取消竞拍"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      ) : null}
                      <button
                        onClick={() => handleSingleAction(product.id, 'delete')}
                        className="p-1.5 text-text-tertiary hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-text-tertiary text-sm">
                共 <span className="text-text-primary font-medium">{total}</span> 个商品，第{' '}
                <span className="text-text-primary font-medium">{page}</span> / {totalPages} 页
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg bg-surface-card border border-slate-200 text-text-secondary hover:bg-surface-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                        page === pageNum
                          ? 'bg-brand text-white shadow-glow-brand'
                          : 'bg-surface-card border border-slate-200 text-text-secondary hover:bg-surface-secondary'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg bg-surface-card border border-slate-200 text-text-secondary hover:bg-surface-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
