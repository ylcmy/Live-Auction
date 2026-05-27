import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlayCircle,
  CheckCircle2,
  ChevronDown,
  Video,
  Package,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import api from '../../services/api';
import { toast } from '../../design-system/hooks/use-toast';
import type { LiveRoom, Product } from '../../types/api';

interface AuctionSession {
  id: number;
  productId: number;
  roomId: number;
  status: string;
  currentPrice: number;
  createdAt: string;
  endedAt?: string;
}

const ROOM_STATUS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  live: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', label: '直播中' },
  offline: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400', label: '离线' },
};

export default function AuctionManage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [currentAuction, setCurrentAuction] = useState<AuctionSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    async function init() {
      try {
        const [roomsRes, productsRes] = await Promise.all([
          api.get<{ data: { items: LiveRoom[] } }>('/rooms'),
          api.get<{ data: { items: Product[] } }>('/products', { status: 'pending' }),
        ]);
        setRooms((roomsRes as any)?.data?.items ?? []);
        setProducts((productsRes as any)?.data?.items ?? []);
      } catch {
        // ignore
      } finally {
        setPageLoading(false);
      }
    }
    init();
  }, []);

  const startAuction = async () => {
    if (!selectedRoom || !selectedProduct) return;
    setLoading(true);
    try {
      const response = await api.post<{ data: AuctionSession }>('/auctions', {
        productId: selectedProduct,
        roomId: selectedRoom,
      });
      setCurrentAuction((response as any).data);
      setSuccessMsg('竞拍已成功发起！');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      toast({ title: '发起竞拍失败', description: err?.data?.message || '请稍后重试', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const selectedRoomData = rooms.find((r) => r.id === selectedRoom);
  const selectedProductData = products.find((p) => p.id === selectedProduct);

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">发起竞拍</h1>
        <p className="text-text-tertiary text-sm mt-1">选择直播间与商品，快速发起一场竞拍</p>
      </div>

      {/* Success Message */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-success/10 border border-success/20 rounded-xl text-success text-sm font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          {successMsg}
        </div>
      )}

      {/* Selection Cards */}
      <div className="space-y-4">
        {/* Room Selection */}
        <div className="bg-surface-card border border-slate-200 rounded-xl p-5 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
            <Video className="w-4 h-4 text-brand" />
            选择直播间
          </label>
          <div className="relative">
            <button
              onClick={() => setShowRoomDropdown(!showRoomDropdown)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all text-left ${
                selectedRoom
                  ? 'border-brand/30 bg-brand/5'
                  : 'border-slate-200 bg-surface-secondary hover:border-slate-300'
              }`}
            >
              {selectedRoomData ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                    <Video className="w-4 h-4 text-brand" />
                  </div>
                  <div>
                    <p className="text-text-primary text-sm font-medium">{selectedRoomData.title}</p>
                    <p className="text-text-tertiary text-xs">ID: {selectedRoomData.id}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      ROOM_STATUS[selectedRoomData.status]?.bg ?? ROOM_STATUS.offline.bg
                    } ${ROOM_STATUS[selectedRoomData.status]?.text ?? ROOM_STATUS.offline.text}`}
                  >
                    <span
                      className={`w-1 h-1 rounded-full ${
                        ROOM_STATUS[selectedRoomData.status]?.dot ?? ROOM_STATUS.offline.dot
                      }`}
                    />
                    {ROOM_STATUS[selectedRoomData.status]?.label ?? '离线'}
                  </span>
                </div>
              ) : (
                <span className="text-text-tertiary text-sm">请选择直播间</span>
              )}
              <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${showRoomDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showRoomDropdown && (
              <div className="absolute z-10 w-full mt-2 bg-surface-card border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                {rooms.length === 0 ? (
                  <div className="px-4 py-6 text-center text-text-tertiary text-sm">
                    <Video className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    暂无直播间
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {rooms.map((room) => {
                      const status = ROOM_STATUS[room.status] ?? ROOM_STATUS.offline;
                      return (
                        <button
                          key={room.id}
                          onClick={() => {
                            setSelectedRoom(room.id);
                            setShowRoomDropdown(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary transition-colors text-left ${
                            selectedRoom === room.id ? 'bg-brand/5' : ''
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                            <Video className="w-4 h-4 text-brand" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-text-primary text-sm font-medium truncate">{room.title}</p>
                            <p className="text-text-tertiary text-xs">ID: {room.id}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                            <span className={`w-1 h-1 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Product Selection */}
        <div className="bg-surface-card border border-slate-200 rounded-xl p-5 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
            <Package className="w-4 h-4 text-brand" />
            选择竞拍商品
          </label>
          <div className="relative">
            <button
              onClick={() => setShowProductDropdown(!showProductDropdown)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all text-left ${
                selectedProduct
                  ? 'border-brand/30 bg-brand/5'
                  : 'border-slate-200 bg-surface-secondary hover:border-slate-300'
              }`}
            >
              {selectedProductData ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-secondary flex items-center justify-center border border-slate-200">
                    {selectedProductData.imageUrl ? (
                      <img
                        src={selectedProductData.imageUrl}
                        alt=""
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <Package className="w-4 h-4 text-text-tertiary opacity-40" />
                    )}
                  </div>
                  <div>
                    <p className="text-text-primary text-sm font-medium">{selectedProductData.name}</p>
                    <p className="text-text-tertiary text-xs">
                      {selectedProductData.category ?? '未分类'}
                    </p>
                  </div>
                </div>
              ) : (
                <span className="text-text-tertiary text-sm">请选择待竞拍商品</span>
              )}
              <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${showProductDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showProductDropdown && (
              <div className="absolute z-10 w-full mt-2 bg-surface-card border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                {products.length === 0 ? (
                  <div className="px-4 py-6 text-center text-text-tertiary text-sm">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    暂无待上架商品
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {products.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => {
                          setSelectedProduct(product.id);
                          setShowProductDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary transition-colors text-left ${
                          selectedProduct === product.id ? 'bg-brand/5' : ''
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-surface-secondary flex items-center justify-center border border-slate-200">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Package className="w-4 h-4 text-text-tertiary opacity-40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-text-primary text-sm font-medium truncate">{product.name}</p>
                          <p className="text-text-tertiary text-xs">{product.category ?? '未分类'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-text-tertiary text-xs mt-2">仅显示状态为"待上架"的商品</p>
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={startAuction}
        disabled={!selectedRoom || !selectedProduct || loading}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-brand hover:bg-brand-hover disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-base transition-all shadow-glow-brand hover:shadow-lg active:scale-[0.98]"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            发起中...
          </>
        ) : (
          <>
            <PlayCircle className="w-5 h-5" />
            开始竞拍
          </>
        )}
      </button>

      {/* Current Auction Card */}
      {currentAuction && (
        <div className="bg-surface-card border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">进行中的竞拍</h2>
              <p className="text-text-tertiary text-xs">竞拍已创建成功</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-secondary/50 rounded-lg p-3 border border-slate-200">
              <p className="text-text-tertiary text-xs mb-1">竞拍 ID</p>
              <p className="text-text-primary font-mono text-sm font-medium">
                #{currentAuction.id}
              </p>
            </div>
            <div className="bg-surface-secondary/50 rounded-lg p-3 border border-slate-200">
              <p className="text-text-tertiary text-xs mb-1">状态</p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                进行中
              </span>
            </div>
            <div className="bg-surface-secondary/50 rounded-lg p-3 border border-slate-200">
              <p className="text-text-tertiary text-xs mb-1">直播间</p>
              <p className="text-text-primary text-sm font-medium">
                {rooms.find((r) => r.id === currentAuction.roomId)?.title ?? `ID: ${currentAuction.roomId}`}
              </p>
            </div>
            <div className="bg-surface-secondary/50 rounded-lg p-3 border border-slate-200">
              <p className="text-text-tertiary text-xs mb-1">商品</p>
              <p className="text-text-primary text-sm font-medium">
                {products.find((p) => p.id === currentAuction.productId)?.name ?? `ID: ${currentAuction.productId}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/live/${currentAuction.roomId}`)}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-secondary hover:bg-slate-100 border border-slate-200 rounded-lg text-text-secondary hover:text-text-primary text-sm font-medium transition-all"
          >
            进入直播间
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
