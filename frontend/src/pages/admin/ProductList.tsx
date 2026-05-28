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
  PlayCircle,
} from 'lucide-react';
import api from '../../services/api';
import { useConfirm } from '../../components/admin/ConfirmDialog';
import { toast } from '../../design-system/hooks/use-toast';
import { PRODUCT_STATUS_STYLES } from '../../lib/statusConfig';
import type { Product, PaginatedData } from '../../types/api';

type StatusFilter = 'all' | 'pending' | 'listed' | 'active' | 'ended' | 'unsold' | 'deleted';

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '竞拍中' },
  { value: 'listed', label: '上架待竞拍' },
  { value: 'pending', label: '等待上架' },
  { value: 'ended', label: '已结束' },
  { value: 'unsold', label: '流拍' },
];

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
      description: `确定要删除选中的 ${selectedIds.size} 个商品吗？删除后商品将移入回收站。`,
      variant: 'danger',
      confirmText: '确认删除',
    });
    if (!ok) return;
    try {
      await Promise.all([...selectedIds].map((id) => api.put(`/products/${id}/status`, { status: 'deleted' })));
      toast({ title: '删除成功', description: `已删除 ${selectedIds.size} 个商品`, variant: 'success' });
      fetchProducts();
    } catch {
      toast({ title: '删除失败', description: '请稍后重试', variant: 'destructive' });
    }
  };

  const handleBatchShelf = async (up: boolean) => {
    const ok = await confirm({
      title: up ? '批量上架商品' : '批量下架商品',
      description: up
        ? `确定要上架选中的 ${selectedIds.size} 个商品吗？上架后商品将进入待竞拍状态。`
        : `确定要下架选中的 ${selectedIds.size} 个商品吗？下架后商品将回到等待上架状态。`,
      variant: up ? 'info' : 'warning',
      confirmText: up ? '确认上架' : '确认下架',
    });
    if (!ok) return;
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          api.put(`/products/${id}/status`, { status: up ? 'listed' : 'pending' })
        )
      );
      toast({ title: '操作成功', description: `已${up ? '上架' : '下架'} ${selectedIds.size} 个商品`, variant: 'success' });
      fetchProducts();
    } catch {
      toast({ title: '操作失败', description: '请稍后重试', variant: 'destructive' });
    }
  };

  const handleSingleAction = async (id: number, action: 'up' | 'down' | 'cancel_auction' | 'delete') => {
    if (action === 'delete') {
      const ok = await confirm({
        title: '删除商品',
        description: '确定要删除此商品吗？删除后商品将移入回收站。',
        variant: 'danger',
        confirmText: '确认删除',
      });
      if (!ok) return;
      try {
        await api.put(`/products/${id}/status`, { status: 'deleted' });
        toast({ title: '删除成功', variant: 'success' });
        fetchProducts();
      } catch {
        toast({ title: '删除失败', description: '请稍后重试', variant: 'destructive' });
      }
      return;
    }
    if (action === 'up') {
      const product = products.find((p) => p.id === id);
      const isRelist = product?.status === 'unsold';
      const ok = await confirm({
        title: isRelist ? '重新上架商品' : '上架商品',
        description: '确定要上架此商品吗？上架后商品将进入待竞拍状态。',
        variant: 'info',
        confirmText: isRelist ? '确认重新上架' : '确认上架',
      });
      if (!ok) return;
      try {
        await api.put(`/products/${id}/status`, { status: 'listed' });
        toast({ title: isRelist ? '重新上架成功' : '上架成功', description: '商品已进入待竞拍状态', variant: 'success' });
        fetchProducts();
      } catch {
        toast({ title: '上架失败', description: '请稍后重试', variant: 'destructive' });
      }
      return;
    }
    if (action === 'down') {
      const ok = await confirm({
        title: '下架商品',
        description: '确定要下架此商品吗？下架后商品将回到等待上架状态。',
        variant: 'warning',
        confirmText: '确认下架',
      });
      if (!ok) return;
      try {
        await api.put(`/products/${id}/status`, { status: 'pending' });
        toast({ title: '下架成功', description: '商品已回到等待上架状态', variant: 'success' });
        fetchProducts();
      } catch {
        toast({ title: '下架失败', description: '请稍后重试', variant: 'destructive' });
      }
      return;
    }
    if (action === 'cancel_auction') {
      const ok = await confirm({
        title: '取消竞拍',
        description: '确定要取消此商品的竞拍吗？当前所有出价将被作废，商品将回到上架待竞拍状态。',
        variant: 'warning',
        confirmText: '确认取消竞拍',
      });
      if (!ok) return;
      try {
        await api.put(`/products/${id}/status`, { status: 'listed' });
        toast({ title: '竞拍已取消', description: '商品已回到上架待竞拍状态', variant: 'success' });
        fetchProducts();
      } catch {
        toast({ title: '取消竞拍失败', description: '请稍后重试', variant: 'destructive' });
      }
      return;
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
                const status = PRODUCT_STATUS_STYLES[product.status] ?? PRODUCT_STATUS_STYLES.pending;
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
                      {product.status === 'pending' ? (
                        <button
                          onClick={() => handleSingleAction(product.id, 'up')}
                          className="p-1.5 text-text-tertiary hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          title="上架"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                      ) : product.status === 'listed' ? (
                        <>
                          <button
                            onClick={() => navigate(`/admin/auction?productId=${product.id}`)}
                            className="p-1.5 text-text-tertiary hover:text-brand hover:bg-brand/5 rounded-lg transition-all"
                            title="开始竞拍"
                          >
                            <PlayCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSingleAction(product.id, 'down')}
                            className="p-1.5 text-text-tertiary hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                            title="下架"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </>
                      ) : product.status === 'active' ? (
                        <button
                          onClick={() => handleSingleAction(product.id, 'cancel_auction')}
                          className="p-1.5 text-text-tertiary hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="取消竞拍"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      ) : product.status === 'unsold' ? (
                        <button
                          onClick={() => handleSingleAction(product.id, 'up')}
                          className="p-1.5 text-text-tertiary hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          title="重新上架"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                      ) : null}
                      {product.status !== 'deleted' && (
                        <button
                          onClick={() => handleSingleAction(product.id, 'delete')}
                          className="p-1.5 text-text-tertiary hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
