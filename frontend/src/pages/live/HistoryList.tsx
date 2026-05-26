import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { formatPrice, formatTime } from '../../lib/format';
import { Card, CardContent } from '../../design-system/components/ui/card';
import { Badge } from '../../design-system/components/ui/badge';
import { Button } from '../../design-system/components/ui/button';
import type { OrderStatus } from '../../types/api';

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  pending_payment: { variant: 'default', label: '待支付' },
  paid: { variant: 'secondary', label: '已支付' },
  cancelled: { variant: 'outline', label: '已取消' },
};

interface OrderItem {
  id: number;
  session_id: number;
  buyer_id: number;
  product_id: number;
  final_price: number;
  status: OrderStatus;
  created_at: string;
}

export default function HistoryList() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<{ data: { items: OrderItem[]; total: number } }>('/orders', { page, limit }) as any;
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
    <div className="min-h-screen bg-black flex flex-col">
      <header className="border-b border-white/10 bg-surface-secondary">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <h1 className="text-lg font-semibold text-white">我的竞拍</h1>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-6 w-full">
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-surface-card rounded-lg border border-white/10 p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-surface-secondary rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-surface-secondary rounded w-1/3" />
                    <div className="h-3 bg-surface-secondary rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-16">
            <div className="bg-brand/10 border border-brand/30 rounded-lg px-6 py-4 inline-block">
              <p className="text-brand text-sm">{error}</p>
              <Button variant="link" onClick={fetchHistory} className="mt-2 text-text-secondary">
                重试
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-text-secondary">还没有参与过竞拍</p>
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <>
            <div className="space-y-3">
              {orders.map((order) => {
                const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending_payment;
                const isWin = order.status === 'pending_payment' || order.status === 'paid';
                return (
                  <Card key={order.id} className="bg-surface-card border-white/10 hover:border-white/20 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isWin ? 'bg-green-500/20' : 'bg-gray-500/20'
                        }`}>
                          {isWin ? (
                            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">
                              商品 #{order.product_id}
                            </span>
                            <Badge variant={isWin ? 'default' : 'outline'} className={`text-[10px] ${
                              isWin ? 'bg-brand/20 text-brand border-brand/30' : 'text-text-tertiary border-white/10'
                            }`}>
                              {isWin ? 'WIN' : 'LOST'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={statusCfg.variant} className="text-[10px]">
                              {statusCfg.label}
                            </Badge>
                            <span className="text-xs text-text-tertiary">{formatTime(order.created_at)}</span>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className="text-brand font-bold text-lg">{formatPrice(order.final_price)}</p>
                          <p className="text-[10px] text-text-tertiary">成交价</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  上一页
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Button
                    key={p}
                    variant={p === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(p)}
                    className={p === page ? 'bg-brand hover:bg-brand-hover border-brand' : 'border-white/10'}
                  >
                    {p}
                  </Button>
                ))}
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  下一页
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
