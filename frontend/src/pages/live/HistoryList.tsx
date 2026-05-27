import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { formatPrice, formatTime } from '../../lib/format';
import { Card, CardContent } from '../../design-system/components/ui/card';
import { Badge } from '../../design-system/components/ui/badge';
import { Button } from '../../design-system/components/ui/button';
import { Trophy, XCircle, ChevronLeft, ChevronRight, Award, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { ORDER_STATUS_CONFIG } from '../../lib/statusConfig';
import type { Order } from '../../types/api';

export default function HistoryList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<{ data: { items: Order[]; total: number } }>('/orders', { page, limit }) as any;
      const data = response.data;
      setOrders(data?.items || []);
      setTotal(data?.total || 0);
    } catch (err: any) {
      setError(err?.data?.message || err.message || '加载竞拍历史失败');
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Award className="w-5 h-5 text-brand" />
            我的竞拍
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-6 w-full">
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-1/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-16">
            <div className="bg-brand-50 border border-brand/20 rounded-xl px-6 py-4 inline-block">
              <p className="text-brand text-sm">{error}</p>
              <Button variant="link" onClick={fetchHistory} className="mt-2 text-text-secondary">
                重试
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-text-tertiary" />
            </div>
            <p className="text-text-secondary">还没有参与过竞拍</p>
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <>
            <div className="space-y-3">
              {orders.map((order, index) => {
                const statusCfg = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.pending_payment;
                const isWin = order.status === 'pending_payment' || order.status === 'paid';
                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="bg-white border-gray-200 hover:border-brand/30 transition-all duration-300">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isWin ? 'bg-emerald-50' : 'bg-gray-100'
                          }`}>
                            {isWin ? (
                              <Trophy className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <XCircle className="w-5 h-5 text-gray-400" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-text-primary truncate">
                                商品 #{order.productId}
                              </span>
                              <Badge variant={isWin ? 'default' : 'outline'} className={`text-[10px] ${
                                isWin ? 'bg-brand-50 text-brand border-brand/20' : 'text-text-tertiary border-gray-200'
                              }`}>
                                {isWin ? 'WIN' : 'LOST'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={`text-[10px] ${statusCfg.className}`}>
                                <span className="flex items-center gap-1">
                                  {statusCfg.icon}
                                  {statusCfg.label}
                                </span>
                              </Badge>
                              <span className="text-xs text-text-tertiary flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatTime(order.createdAt)}
                              </span>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <p className="text-brand-gradient font-bold text-lg">{formatPrice(order.finalPrice)}</p>
                            <p className="text-[10px] text-text-tertiary">成交价</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="border-gray-200 hover:border-brand/30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Button
                    key={p}
                    variant={p === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(p)}
                    className={p === page ? 'bg-brand hover:bg-brand-hover border-brand' : 'border-gray-200 hover:border-brand/30'}
                  >
                    {p}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="border-gray-200 hover:border-brand/30"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            <p className="text-center text-text-tertiary text-xs mt-4">共 {total} 条记录</p>
          </>
        )}
      </main>
    </div>
  );
}
