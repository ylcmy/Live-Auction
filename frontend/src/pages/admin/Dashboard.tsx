import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  PlayCircle,
  ShoppingCart,
  DollarSign,
  Video,
  Eye,
  ArrowRight,
} from 'lucide-react';
import api from '../../services/api';
import { PRODUCT_STATUS_STYLES, ORDER_STATUS_STYLES } from '../../lib/statusConfig';
import { formatPrice } from '../../lib/format';
import type { Product, Order } from '../../types/api';

interface MyRoom {
  id: number;
  hostId: number;
  title: string;
  status: 'offline' | 'live';
  streamUrl: string | null;
  createdAt: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState({ totalProducts: 0, activeProducts: 0, totalOrders: 0, revenue: 0 });
  const [myRoom, setMyRoom] = useState<MyRoom | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const fetchRoom = useCallback(async () => {
    try {
      const res = await api.get<{ data: MyRoom }>('/rooms/my-room');
      const data = (res as any).data ?? res;
      setMyRoom(data as MyRoom);
    } catch {
      setMyRoom(null);
    }
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const [productsRes, ordersRes] = await Promise.all([
          api.get<{ data: { items: Product[]; total: number } }>('/products', { page: 1, limit: 100 }),
          api.get<{ data: { items: Order[]; total: number } }>('/orders', { page: 1, limit: 100 }),
        ]);
        const productData = productsRes?.data ?? { items: [], total: 0 };
        const orderData = ordersRes?.data ?? { items: [], total: 0 };
        setProducts(productData.items);
        setOrders(orderData.items);
        setStats({
          totalProducts: productData.total,
          activeProducts: productData.items.filter((p) => p.status === 'active').length,
          totalOrders: orderData.total,
          revenue: orderData.items.filter((o) => o.status === 'paid' || o.status === 'completed').reduce((sum, o) => sum + Number(o.finalPrice), 0),
        });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    fetchRoom();
  }, [fetchRoom]);

  const activeProducts = products.filter((p) => p.status === 'active');

  const handleStatusToggle = async () => {
    if (!myRoom) return;
    const newStatus = myRoom.status === 'live' ? 'offline' : 'live';
    if (newStatus === 'offline' && activeProducts.length > 0) {
      setShowCloseConfirm(true);
      return;
    }
    await doToggle(newStatus);
  };

  const doToggle = async (newStatus: string) => {
    if (!myRoom) return;
    setStatusLoading(true);
    try {
      await api.put(`/rooms/${myRoom.id}/status`, { status: newStatus });
      setMyRoom({ ...myRoom, status: newStatus as 'offline' | 'live' });
    } catch {
      // ignore
    } finally {
      setStatusLoading(false);
      setShowCloseConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">数据看板</h1>
        <p className="text-text-tertiary text-sm mt-1">实时监控您的直播间与商品数据</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-card border border-slate-200 rounded-xl p-5 hover:border-brand/30 transition-all group shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-brand/10 rounded-lg">
              <Package className="w-5 h-5 text-brand" />
            </div>
            <span className="text-xs text-text-tertiary">全部商品</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{stats.totalProducts}</p>
          <p className="text-text-tertiary text-xs mt-1">累计上架商品总数</p>
        </div>

        <div className="bg-surface-card border border-slate-200 rounded-xl p-5 hover:border-success/30 transition-all group shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <PlayCircle className="w-5 h-5 text-success" />
            </div>
            <span className="text-xs text-text-tertiary">进行中</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{stats.activeProducts}</p>
          <p className="text-text-tertiary text-xs mt-1">当前正在竞拍中</p>
        </div>

        <div className="bg-surface-card border border-slate-200 rounded-xl p-5 hover:border-accent/30 transition-all group shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-accent" />
            </div>
            <span className="text-xs text-text-tertiary">今日订单</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{stats.totalOrders}</p>
          <p className="text-text-tertiary text-xs mt-1">今日成交订单数</p>
        </div>

        <div className="bg-surface-card border border-slate-200 rounded-xl p-5 hover:border-warning/30 transition-all group shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-warning" />
            </div>
            <span className="text-xs text-text-tertiary">成交额</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">¥{stats.revenue.toLocaleString()}</p>
          <p className="text-text-tertiary text-xs mt-1">累计成交总金额</p>
        </div>
      </div>

      {/* Live Room Card */}
      <div className="bg-surface-card border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/10 rounded-lg">
              <Video className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">我的直播间</h2>
              <p className="text-text-tertiary text-xs">管理直播间开播状态</p>
            </div>
          </div>
          {myRoom && (
            <button
              onClick={() => navigate(`/live/${myRoom.id}`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-surface-secondary hover:bg-slate-100 border border-slate-200 rounded-lg text-text-secondary text-sm font-medium transition-all"
            >
              <Eye className="w-4 h-4" />
              预览
            </button>
          )}
        </div>

        {myRoom ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200">
            <div>
              <p className="text-text-primary font-semibold text-lg">{myRoom.title}</p>
              <p className="text-text-tertiary text-sm mt-0.5">直播间 ID: {myRoom.id}</p>
            </div>
            <div className="flex items-center gap-4">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                  myRoom.status === 'live'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${myRoom.status === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {myRoom.status === 'live' ? '在线' : '离线'}
              </span>
              <button
                onClick={handleStatusToggle}
                disabled={statusLoading}
                className={`relative w-14 h-8 rounded-full transition-colors ${
                  myRoom.status === 'live' ? 'bg-emerald-500' : 'bg-slate-300'
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                    myRoom.status === 'live' ? 'translate-x-6' : ''
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${myRoom.status === 'live' ? 'text-emerald-600' : 'text-slate-500'}`}>
                {myRoom.status === 'live' ? '直播中' : '未开播'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-text-tertiary">
            <Video className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">暂无直播间</p>
          </div>
        )}
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Products Overview */}
        <div className="lg:col-span-3 bg-surface-card border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand/10 rounded-lg">
                <Package className="w-4 h-4 text-brand" />
              </div>
              <h2 className="text-base font-bold text-text-primary">商品概览</h2>
            </div>
            <button
              onClick={() => navigate('/admin/products')}
              className="inline-flex items-center gap-1 text-brand text-sm font-medium hover:underline"
            >
              查看全部
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {products.slice(0, 5).map((product) => {
              const status = PRODUCT_STATUS_STYLES[product.status] ?? PRODUCT_STATUS_STYLES.pending;
              return (
                <div
                  key={product.id}
                  onClick={() => navigate(`/admin/products/${product.id}`)}
                  className="flex items-center gap-4 p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-surface-secondary flex items-center justify-center flex-shrink-0 border border-slate-200">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Package className="w-4 h-4 text-text-tertiary opacity-40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-sm font-medium truncate">{product.name}</p>
                    <p className="text-text-tertiary text-xs mt-0.5">{product.category ?? '-'}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                    <span className={`w-1 h-1 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </div>
              );
            })}
            {products.length === 0 && (
              <div className="py-10 text-center text-text-tertiary text-sm">暂无商品</div>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-surface-card border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <ShoppingCart className="w-4 h-4 text-accent" />
              </div>
              <h2 className="text-base font-bold text-text-primary">最近订单</h2>
            </div>
            <button
              onClick={() => navigate('/admin/orders')}
              className="inline-flex items-center gap-1 text-brand text-sm font-medium hover:underline"
            >
              查看全部
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {orders.slice(0, 5).map((order) => {
              const status = ORDER_STATUS_STYLES[order.status] ?? ORDER_STATUS_STYLES.pending_payment;
              return (
                <div key={order.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-text-primary text-sm font-medium">订单 #{order.id}</p>
                    <p className="text-text-tertiary text-xs mt-0.5">商品 #{order.productId}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-brand font-semibold text-sm">{formatPrice(order.finalPrice)}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              );
            })}
            {orders.length === 0 && (
              <div className="py-10 text-center text-text-tertiary text-sm">暂无订单</div>
            )}
          </div>
        </div>
      </div>

      {/* Close Room Confirm Modal */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowCloseConfirm(false)} />
          <div className="relative bg-surface-card border border-slate-200 rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-50 rounded-full">
                <PlayCircle className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-text-primary">确认关闭直播间？</h3>
            </div>
            <p className="text-text-secondary text-sm mb-2">
              当前有 <span className="text-brand font-bold">{activeProducts.length}</span> 个商品正在竞拍中，关闭直播间将同时结束这些竞拍。
            </p>
            <p className="text-text-tertiary text-xs mb-6">此操作不可撤销，请谨慎操作。</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="px-4 py-2 bg-surface-secondary hover:bg-slate-100 border border-slate-200 rounded-lg text-text-secondary text-sm font-medium transition-all"
              >
                取消
              </button>
              <button
                onClick={() => doToggle('offline')}
                disabled={statusLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              >
                {statusLoading ? '关闭中...' : '确认关闭'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
