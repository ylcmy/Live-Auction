import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Package,
  XCircle,
  RefreshCw,
  Timer,
} from 'lucide-react';
import api from '../../services/api';
import { useConfirm } from '../../components/admin/ConfirmDialog';
import { toast } from '../../design-system/hooks/use-toast';
import { formatPrice, formatTime } from '../../lib/format';
import { ORDER_STATUS_CONFIG } from '../../lib/statusConfig';
import { getOrderDisplayStatus } from '../../lib/order-utils';
import type { Order, OrderStatus } from '../../types/api';

type StatusFilter = 'all' | OrderStatus;

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部订单' },
  { value: 'pending_payment', label: '待支付' },
  { value: 'paid', label: '已支付' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
];

export default function OrderList() {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = { page, limit };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = (await api.get<{ data: { items: Order[]; total: number } }>('/orders', params)) as any;
      const data = response.data;
      setOrders(data?.items || []);
      setTotal(data?.total || 0);
    } catch {
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const setLoadingFor = (id: number, v: boolean) => {
    setActionLoading((prev) => ({ ...prev, [id]: v }));
  };

  const handleCancel = async (orderId: number) => {
    const ok = await confirm({
      title: '取消订单',
      description: `确定要取消订单 #${orderId} 吗？`,
      variant: 'warning',
      confirmText: '确认取消',
    });
    if (!ok) return;
    setLoadingFor(orderId, true);
    try {
      await api.put(`/orders/${orderId}/status`, { status: 'cancelled' });
      toast({ title: '订单已取消', variant: 'success' });
      fetchOrders();
    } catch (err: any) {
      toast({ title: '取消失败', description: err?.message || '请稍后重试', variant: 'destructive' });
    } finally {
      setLoadingFor(orderId, false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">订单管理</h1>
          <p className="text-text-tertiary text-sm mt-1">管理所有竞拍成交订单，共 {total} 个订单</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
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

      {/* Orders Table */}
      {loading ? (
        <div className="bg-surface-card border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 bg-slate-200 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/3" />
                </div>
                <div className="h-4 bg-slate-200 rounded w-20" />
              </div>
            ))}
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
          <ShoppingCart className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">暂无订单</p>
          <p className="text-sm mt-1">订单将在此显示</p>
        </div>
      ) : (
        <>
          <div className="bg-surface-card border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 bg-surface-secondary/50 border-b border-slate-200 text-text-tertiary text-xs font-medium uppercase tracking-wider">
              <div className="col-span-1">订单号</div>
              <div className="col-span-2">商品</div>
              <div className="col-span-1">买家</div>
              <div className="col-span-2">成交价</div>
              <div className="col-span-1">状态</div>
              <div className="col-span-2">支付信息</div>
              <div className="col-span-2">时间</div>
              <div className="col-span-1 text-right">操作</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-slate-100">
              {orders.map((order) => {
                const displayStatus = getOrderDisplayStatus(order);
                const isExpired = displayStatus === 'expired';
                const status = ORDER_STATUS_CONFIG[displayStatus as keyof typeof ORDER_STATUS_CONFIG] ?? ORDER_STATUS_CONFIG.pending_payment;
                const isLoading = actionLoading[order.id];
                return (
                  <div
                    key={order.id}
                    onClick={() => navigate(`/merchant/orders/${order.id}`)}
                    className="flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:gap-4 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between sm:col-span-1">
                      <span className="sm:hidden text-text-tertiary text-xs">订单号</span>
                      <span className="text-text-primary font-mono text-sm font-medium">#{order.id}</span>
                    </div>
                    <div className="flex items-center justify-between sm:col-span-2">
                      <span className="sm:hidden text-text-tertiary text-xs">商品</span>
                      <div className="flex items-center gap-2">
                        {order.productImageUrl ? (
                          <img src={order.productImageUrl} alt={order.productName || ''} className="w-8 h-8 rounded object-cover border border-slate-200" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-surface-secondary flex items-center justify-center border border-slate-200">
                            <Package className="w-3 h-3 text-text-tertiary" />
                          </div>
                        )}
                        <span className="text-text-secondary text-sm truncate max-w-[120px]">{order.productName || `商品 #${order.productId}`}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:col-span-1">
                      <span className="sm:hidden text-text-tertiary text-xs">买家</span>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-surface-secondary flex items-center justify-center border border-slate-200">
                          <Package className="w-3 h-3 text-text-tertiary" />
                        </div>
                        <span className="text-text-secondary text-sm">{order.buyerNickname || `#${order.buyerId}`}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:col-span-2">
                      <span className="sm:hidden text-text-tertiary text-xs">成交价</span>
                      <span className="text-brand font-bold text-sm">{formatPrice(order.finalPrice)}</span>
                    </div>
                    <div className="flex items-center justify-between sm:col-span-1">
                      <span className="sm:hidden text-text-tertiary text-xs">状态</span>
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${status.className}`}>
                        {isExpired ? '已截止' : status.label}
                      </span>
                    </div>
                    <div className="flex flex-col justify-center sm:col-span-2">
                      <span className="sm:hidden text-text-tertiary text-xs">支付信息</span>
                      {order.transactionId ? (
                        <div className="space-y-0.5">
                          <span className="text-text-secondary text-xs font-mono">{order.transactionId}</span>
                          {order.paymentMethod && (
                            <span className="text-text-tertiary text-xs block">{order.paymentMethod}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-tertiary text-xs">-</span>
                      )}
                    </div>
                    <div className="flex flex-col justify-center sm:col-span-2">
                      <span className="sm:hidden text-text-tertiary text-xs">时间</span>
                      <div className="space-y-0.5">
                        <span className="text-text-tertiary text-xs">创建: {formatTime(order.createdAt)}</span>
                        {order.paidAt && (
                          <span className="text-text-tertiary text-xs block">支付: {formatTime(order.paidAt)}</span>
                        )}
                        {order.completedAt && (
                          <span className="text-text-tertiary text-xs block">完成: {formatTime(order.completedAt)}</span>
                        )}
                        {order.cancelledAt && (
                          <span className="text-text-tertiary text-xs block">取消: {formatTime(order.cancelledAt)}</span>
                        )}
                        {order.status === 'pending_payment' && !isExpired && (
                          <span className="text-amber-600 text-xs flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            截止: {formatTime(order.expireAt)}
                          </span>
                        )}
                        {isExpired && (
                          <span className="text-red-500 text-xs flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            已截止: {formatTime(order.expireAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-end sm:col-span-1 gap-1">
                      {order.status === 'pending_payment' && !isExpired && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancel(order.id);
                          }}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-secondary hover:bg-slate-100 border border-slate-200 text-text-secondary rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                        >
                          {isLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                          取消
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
                共 <span className="text-text-primary font-medium">{total}</span> 个订单，第{' '}
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
