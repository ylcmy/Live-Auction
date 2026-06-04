import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  ShoppingCart,
  Clock,
  CreditCard,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api';
import { useConfirm } from '../../components/admin/ConfirmDialog';
import { toast } from '../../design-system/hooks/use-toast';
import { formatPrice, formatTime } from '../../lib/format';
import { ORDER_STATUS_STYLES } from '../../lib/statusConfig';
import type { Order, OrderStatus } from '../../types/api';

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = (await api.get<{ data: Order }>(`/orders/${id}`)) as any;
      setOrder(response.data as Order);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleCancel = async () => {
    if (!order) return;
    const ok = await confirm({
      title: '取消订单',
      description: `确定要取消订单 #${order.id} 吗？`,
      variant: 'warning',
      confirmText: '确认取消',
    });
    if (!ok) return;
    setActionLoading(true);
    try {
      await api.put(`/orders/${order.id}/status`, { status: 'cancelled' });
      toast({ title: '订单已取消', variant: 'success' });
      fetchOrder();
    } catch (err: any) {
      toast({ title: '取消失败', description: err?.message || '请稍后重试', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
        <ShoppingCart className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-lg font-medium">订单不存在</p>
        <button
          onClick={() => navigate('/admin/orders')}
          className="mt-4 text-brand text-sm font-medium hover:underline"
        >
          返回订单列表
        </button>
      </div>
    );
  }

  const isExpired = order.status === 'pending_payment' && new Date(order.expireAt) < new Date();
  const displayStatus: OrderStatus = isExpired ? 'cancelled' : order.status;
  const status = ORDER_STATUS_STYLES[displayStatus] ?? ORDER_STATUS_STYLES.pending_payment;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/admin/orders')}
        className="inline-flex items-center gap-2 text-text-tertiary hover:text-text-primary transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        返回订单列表
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${status.bg} ${status.text}`}>
            {isExpired ? '已截止' : status.label}
          </span>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">订单 #{order.id}</h1>
        </div>
        {order.status === 'pending_payment' && !isExpired && (
          <button
            onClick={handleCancel}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-card border border-slate-200 text-text-secondary hover:bg-surface-secondary rounded-lg transition-all text-sm font-medium disabled:opacity-50"
          >
            {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            取消订单
          </button>
        )}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left - Basic Info */}
        <div className="bg-surface-card border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
            <Package className="w-4 h-4 text-brand" />
            基本信息
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg border border-slate-100">
              <span className="text-text-tertiary text-xs">订单编号</span>
              <span className="text-text-primary text-sm font-mono font-medium">#{order.id}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg border border-slate-100">
              <span className="text-text-tertiary text-xs">商品</span>
              <div className="flex items-center gap-2">
                {order.productImageUrl && (
                  <img src={order.productImageUrl} alt={order.productName || ''} className="w-8 h-8 rounded object-cover border border-slate-200" />
                )}
                <span className="text-text-primary text-sm font-medium">{order.productName || `商品 #${order.productId}`}</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg border border-slate-100">
              <span className="text-text-tertiary text-xs">买家</span>
              <span className="text-text-primary text-sm font-medium">{order.buyerNickname || `#${order.buyerId}`}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg border border-slate-100">
              <span className="text-text-tertiary text-xs">成交价</span>
              <span className="text-brand font-bold text-lg">{formatPrice(order.finalPrice)}</span>
            </div>
          </div>
        </div>

        {/* Right - Status & Time */}
        <div className="bg-surface-card border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand" />
            状态与时间
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg border border-slate-100">
              <span className="text-text-tertiary text-xs">当前状态</span>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                {isExpired ? '已截止' : status.label}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg border border-slate-100">
              <span className="text-text-tertiary text-xs">创建时间</span>
              <span className="text-text-primary text-sm">{formatTime(order.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg border border-slate-100">
              <span className="text-text-tertiary text-xs">支付截止</span>
              <span className={`text-sm ${isExpired ? 'text-red-500' : 'text-text-primary'}`}>
                {formatTime(order.expireAt)}
              </span>
            </div>
            {order.paidAt && (
              <div className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg border border-slate-100">
                <span className="text-text-tertiary text-xs">支付时间</span>
                <span className="text-text-primary text-sm">{formatTime(order.paidAt)}</span>
              </div>
            )}
            {order.completedAt && (
              <div className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg border border-slate-100">
                <span className="text-text-tertiary text-xs">完成时间</span>
                <span className="text-text-primary text-sm">{formatTime(order.completedAt)}</span>
              </div>
            )}
            {order.cancelledAt && (
              <div className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg border border-slate-100">
                <span className="text-text-tertiary text-xs">{isExpired ? '超时时间' : '取消时间'}</span>
                <span className="text-text-primary text-sm">{formatTime(order.cancelledAt)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Info */}
      {(order.transactionId || order.paymentMethod) && (
        <div className="bg-surface-card border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-brand" />
            支付信息
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {order.transactionId && (
              <div className="p-3 bg-surface-secondary rounded-lg border border-slate-100">
                <span className="text-text-tertiary text-xs">交易流水号</span>
                <p className="text-text-primary text-sm font-mono font-medium mt-1">{order.transactionId}</p>
              </div>
            )}
            {order.paymentMethod && (
              <div className="p-3 bg-surface-secondary rounded-lg border border-slate-100">
                <span className="text-text-tertiary text-xs">支付方式</span>
                <p className="text-text-primary text-sm font-medium mt-1">{order.paymentMethod}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-surface-card border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-brand" />
          订单状态流转
        </h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-surface-secondary rounded-lg border border-slate-100">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <div className="flex-1">
              <p className="text-text-primary text-sm font-medium">订单创建</p>
              <p className="text-text-tertiary text-xs">{formatTime(order.createdAt)}</p>
            </div>
          </div>
          {order.paidAt && (
            <div className="flex items-center gap-3 p-3 bg-surface-secondary rounded-lg border border-slate-100">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div className="flex-1">
                <p className="text-text-primary text-sm font-medium">支付成功</p>
                <p className="text-text-tertiary text-xs">{formatTime(order.paidAt)}</p>
              </div>
            </div>
          )}
          {order.completedAt && (
            <div className="flex items-center gap-3 p-3 bg-surface-secondary rounded-lg border border-slate-100">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div className="flex-1">
                <p className="text-text-primary text-sm font-medium">订单完成</p>
                <p className="text-text-tertiary text-xs">{formatTime(order.completedAt)}</p>
              </div>
            </div>
          )}
          {order.cancelledAt && (
            <div className="flex items-center gap-3 p-3 bg-surface-secondary rounded-lg border border-slate-100">
              <XCircle className="w-5 h-5 text-red-500" />
              <div className="flex-1">
                <p className="text-text-primary text-sm font-medium">{isExpired ? '超时取消' : '手动取消'}</p>
                <p className="text-text-tertiary text-xs">{formatTime(order.cancelledAt)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
