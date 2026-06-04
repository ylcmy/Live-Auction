import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatPrice } from '../../lib/format';
import { ORDER_STATUS_MAP, useOrderCountdown } from '../../lib/order-utils';
import { Badge } from '../../design-system/components/ui/badge';
import { Button } from '../../design-system/components/ui/button';
import { ArrowLeft, Package, Clock, Timer, CreditCard, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '../../design-system/hooks/use-toast';
import type { ApiResponse, Order, OrderStatus } from '../../types/api';

const FILTER_OPTIONS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending_payment', label: '待付款' },
  { value: 'paid', label: '已付款' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export default function MyOrders() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await api.get<ApiResponse<{ items: Order[]; total: number; page: number; limit: number }>>('/orders', params);
      if (response.data) {
        setOrders(response.data.items);
      }
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handlePay = async (orderId: number) => {
    setPayingId(orderId);
    try {
      await api.post(`/orders/${orderId}/pay`);
      toast({ title: '支付成功' });
      fetchOrders();
    } catch (err: any) {
      toast({ title: '支付失败', description: err?.message || '请稍后重试', variant: 'destructive' });
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 flex items-center h-12 px-4 border-b border-white/10 bg-[#161823]/80 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          className="p-1 -ml-1 text-white cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="flex-1 text-center text-white text-base font-medium pr-6">我的订单</h1>
      </header>

      <div className="px-4 py-4">
        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-1 scrollbar-hide">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                statusFilter === opt.value
                  ? 'bg-brand text-white'
                  : 'bg-white/5 text-text-tertiary border border-white/10 hover:bg-white/10'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 rounded-xl p-4 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-white/10 rounded w-24" />
                  <div className="h-5 bg-white/10 rounded-full w-16" />
                </div>
                <div className="h-6 bg-white/10 rounded w-20 mt-3" />
                <div className="h-3 bg-white/10 rounded w-32 mt-3" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-text-tertiary">
            <Package className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-base font-medium">暂无订单</p>
          </div>
        ) : (
          <motion.div
            initial="initial"
            animate="animate"
            variants={{ animate: { transition: { staggerChildren: 0.06 } } }}
            className="space-y-3"
          >
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onPay={handlePay}
                payingId={payingId}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  onPay,
  payingId,
}: {
  order: Order;
  onPay: (id: number) => void;
  payingId: number | null;
}) {
  const navigate = useNavigate();
  const isExpired = order.status === 'pending_payment' && new Date(order.expireAt) < new Date();
  const displayStatus = isExpired ? 'expired' : order.status;
  const statusConfig = ORDER_STATUS_MAP[displayStatus as OrderStatus] ?? ORDER_STATUS_MAP.pending_payment;
  const countdown = useOrderCountdown(order.status === 'pending_payment' && !isExpired ? order.expireAt : null);

  return (
    <motion.div
      variants={fadeUp}
      onClick={() => navigate(`/me/orders/${order.id}`)}
      className="bg-white/5 border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-white/[0.07] transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-white font-medium text-sm">订单 #{order.id}</span>
        <Badge className={statusConfig.className}>
          {isExpired ? '已超时' : statusConfig.label}
        </Badge>
      </div>

      <div className="flex items-center gap-3 mt-2">
        {order.productImageUrl ? (
          <img src={order.productImageUrl} alt={order.productName || ''} className="w-12 h-12 rounded-lg object-cover border border-white/10" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
            <Package className="w-5 h-5 text-text-tertiary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm truncate">{order.productName || `商品 #${order.productId}`}</p>
          <p className="text-brand font-bold text-lg">{formatPrice(order.finalPrice)}</p>
        </div>
      </div>

      {/* Extra info */}
      <div className="mt-2 space-y-1">
        {order.status === 'pending_payment' && !isExpired && (
          <div className="flex items-center gap-1 text-amber-400 text-xs">
            <Timer className="w-3 h-3" />
            <span>支付截止: {countdown}</span>
          </div>
        )}
        {isExpired && (
          <div className="flex items-center gap-1 text-red-400 text-xs">
            <Timer className="w-3 h-3" />
            <span>已超时截止</span>
          </div>
        )}
        {order.transactionId && (
          <div className="flex items-center gap-1 text-text-tertiary text-xs">
            <CreditCard className="w-3 h-3" />
            <span>流水号: {order.transactionId}</span>
          </div>
        )}
        {order.paidAt && (
          <div className="flex items-center gap-1 text-text-tertiary text-xs">
            <CheckCircle2 className="w-3 h-3" />
            <span>支付时间: {new Date(order.paidAt).toLocaleString('zh-CN')}</span>
          </div>
        )}
        {order.completedAt && (
          <div className="flex items-center gap-1 text-text-tertiary text-xs">
            <CheckCircle2 className="w-3 h-3" />
            <span>完成时间: {new Date(order.completedAt).toLocaleString('zh-CN')}</span>
          </div>
        )}
        {order.cancelledAt && !isExpired && (
          <div className="flex items-center gap-1 text-text-tertiary text-xs">
            <Clock className="w-3 h-3" />
            <span>取消时间: {new Date(order.cancelledAt).toLocaleString('zh-CN')}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-text-tertiary text-xs flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(order.createdAt).toLocaleString('zh-CN')}
        </span>
        {order.status === 'pending_payment' && !isExpired && (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onPay(order.id);
            }}
            disabled={payingId === order.id}
            className="bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 h-7 px-3 text-xs cursor-pointer"
          >
            {payingId === order.id ? '支付中...' : '去支付'}
          </Button>
        )}
      </div>
    </motion.div>
  );
}
