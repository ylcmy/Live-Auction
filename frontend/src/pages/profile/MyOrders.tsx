import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { formatPrice } from '../../lib/format';
import { Badge } from '../../design-system/components/ui/badge';
import { Button } from '../../design-system/components/ui/button';
import { ArrowLeft, Package, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '../../design-system/hooks/use-toast';
import type { ApiResponse, Order, OrderStatus } from '../../types/api';

const STATUS_MAP: Record<OrderStatus, { label: string; className: string }> = {
  pending_payment: { label: '待付款', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  paid: { label: '已付款', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  cancelled: { label: '已取消', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

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

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<ApiResponse<{ items: Order[]; total: number; page: number; limit: number }>>('/orders');
      if (response.data) {
        setOrders(response.data.items);
      }
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
            {orders.map((order) => {
              const statusConfig = STATUS_MAP[order.status] ?? STATUS_MAP.pending_payment;
              return (
                <motion.div
                  key={order.id}
                  variants={fadeUp}
                  className="bg-white/5 border border-white/10 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium text-sm">订单 #{order.id}</span>
                    <Badge className={statusConfig.className}>
                      {statusConfig.label}
                    </Badge>
                  </div>

                  <p className="text-brand font-bold text-lg mt-2">
                    {formatPrice(order.finalPrice)}
                  </p>

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-text-tertiary text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(order.createdAt).toLocaleString('zh-CN')}
                    </span>
                    {order.status === 'pending_payment' && (
                      <Button
                        size="sm"
                        onClick={() => handlePay(order.id)}
                        disabled={payingId === order.id}
                        className="bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 h-7 px-3 text-xs cursor-pointer"
                      >
                        {payingId === order.id ? '支付中...' : '去支付'}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
