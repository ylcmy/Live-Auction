import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { formatPrice } from '../../lib/format';
import { Badge } from '../../design-system/components/ui/badge';
import { Button } from '../../design-system/components/ui/button';
import {
  ArrowLeft,
  Package,
  Clock,
  Timer,
  CreditCard,
  CheckCircle2,
  XCircle,
  Hash,
  User,
  ShoppingBag,
} from 'lucide-react';
import { useToast } from '../../design-system/hooks/use-toast';
import type { ApiResponse, Order } from '../../types/api';

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending_payment: { label: '待付款', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  paid: { label: '已付款', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  completed: { label: '已完成', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  cancelled: { label: '已取消', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  expired: { label: '已超时', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

function useCountdown(targetDate: string | null) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();

    const update = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setRemaining('已超时');
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}分${s}秒`);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return remaining;
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await api.get<ApiResponse<Order>>(`/orders/${id}`);
      if (response.data) {
        setOrder(response.data);
      }
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handlePay = async () => {
    if (!order) return;
    setPaying(true);
    try {
      await api.post(`/orders/${order.id}/pay`);
      toast({ title: '支付成功' });
      fetchOrder();
    } catch (err: any) {
      toast({ title: '支付失败', description: err?.message || '请稍后重试', variant: 'destructive' });
    } finally {
      setPaying(false);
    }
  };

  const isExpired = order?.status === 'pending_payment' && order?.expireAt ? new Date(order.expireAt) < new Date() : false;
  const displayStatus = isExpired ? 'expired' : (order?.status ?? 'pending_payment');
  const statusConfig = STATUS_MAP[displayStatus] ?? STATUS_MAP.pending_payment;
  const countdown = useCountdown(order?.status === 'pending_payment' && !isExpired ? order.expireAt : null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-text-tertiary">
        <Package className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-base font-medium">订单不存在</p>
        <button
          onClick={() => navigate('/me/orders')}
          className="mt-4 text-brand text-sm font-medium"
        >
          返回订单列表
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 flex items-center h-12 px-4 border-b border-white/10 bg-[#161823]/80 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-white cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="flex-1 text-center text-white text-base font-medium pr-6">订单详情</h1>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Status Card */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-white font-medium text-sm">订单 #{order.id}</span>
            <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
          </div>
          <p className="text-brand font-bold text-2xl mt-3">{formatPrice(order.finalPrice)}</p>
          {order.status === 'pending_payment' && !isExpired && (
            <div className="flex items-center gap-1 text-amber-400 text-xs mt-2">
              <Timer className="w-3 h-3" />
              <span>支付截止: {countdown}</span>
            </div>
          )}
          {isExpired && (
            <div className="flex items-center gap-1 text-red-400 text-xs mt-2">
              <XCircle className="w-3 h-3" />
              <span>订单已超时截止</span>
            </div>
          )}
        </div>

        {/* Info List */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Hash className="w-4 h-4 text-text-tertiary" />
            <span className="text-text-tertiary text-sm">订单编号</span>
            <span className="text-white text-sm font-mono ml-auto">#{order.id}</span>
          </div>
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-4 h-4 text-text-tertiary" />
            <span className="text-text-tertiary text-sm">商品</span>
            <span className="text-white text-sm ml-auto">商品 #{order.productId}</span>
          </div>
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-text-tertiary" />
            <span className="text-text-tertiary text-sm">买家</span>
            <span className="text-white text-sm ml-auto">#{order.buyerId}</span>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-text-tertiary" />
            <span className="text-text-tertiary text-sm">创建时间</span>
            <span className="text-white text-sm ml-auto">{new Date(order.createdAt).toLocaleString('zh-CN')}</span>
          </div>
          {order.expireAt && (
            <div className="flex items-center gap-3">
              <Timer className="w-4 h-4 text-text-tertiary" />
              <span className="text-text-tertiary text-sm">支付截止</span>
              <span className="text-white text-sm ml-auto">{new Date(order.expireAt).toLocaleString('zh-CN')}</span>
            </div>
          )}
        </div>

        {/* Payment Info */}
        {(order.transactionId || order.paidAt || order.paymentMethod) && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-medium text-sm">支付信息</h3>
            {order.transactionId && (
              <div className="flex items-center gap-3">
                <CreditCard className="w-4 h-4 text-text-tertiary" />
                <span className="text-text-tertiary text-sm">流水号</span>
                <span className="text-white text-sm font-mono ml-auto">{order.transactionId}</span>
              </div>
            )}
            {order.paymentMethod && (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-text-tertiary" />
                <span className="text-text-tertiary text-sm">支付方式</span>
                <span className="text-white text-sm ml-auto">{order.paymentMethod}</span>
              </div>
            )}
            {order.paidAt && (
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-text-tertiary" />
                <span className="text-text-tertiary text-sm">支付时间</span>
                <span className="text-white text-sm ml-auto">{new Date(order.paidAt).toLocaleString('zh-CN')}</span>
              </div>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <h3 className="text-white font-medium text-sm">订单状态</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-white">订单创建</span>
              <span className="text-text-tertiary text-xs ml-auto">{new Date(order.createdAt).toLocaleString('zh-CN')}</span>
            </div>
            {order.paidAt && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-white">支付成功</span>
                <span className="text-text-tertiary text-xs ml-auto">{new Date(order.paidAt).toLocaleString('zh-CN')}</span>
              </div>
            )}
            {order.completedAt && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-white">订单完成</span>
                <span className="text-text-tertiary text-xs ml-auto">{new Date(order.completedAt).toLocaleString('zh-CN')}</span>
              </div>
            )}
            {order.cancelledAt && (
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-white">
                  {isExpired ? '超时取消' : '手动取消'}
                </span>
                <span className="text-text-tertiary text-xs ml-auto">{new Date(order.cancelledAt).toLocaleString('zh-CN')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action */}
        {order.status === 'pending_payment' && !isExpired && (
          <Button
            onClick={handlePay}
            disabled={paying}
            className="w-full bg-brand hover:bg-brand/90 text-white h-11 text-sm font-medium cursor-pointer"
          >
            {paying ? '支付中...' : '立即支付'}
          </Button>
        )}
      </div>
    </div>
  );
}
