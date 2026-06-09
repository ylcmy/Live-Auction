import { useState, useEffect } from 'react';

const SUCCESS_MSG_AUTO_DISMISS_MS = 3000;
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  PlayCircle,
  CheckCircle2,
  ChevronDown,
  Video,
  Package,
  ArrowRight,
  Loader2,
  Clock,
  Users,
  TrendingUp,
  Trophy,
  Timer,
  Gavel,
} from 'lucide-react';
import api from '../../services/api';
import { toast } from '../../design-system/hooks/use-toast';
import { ROOM_STATUS_STYLES } from '../../lib/statusConfig';
import type { LiveRoom, Product } from '../../types/api';
import type { AuctionState, CountdownSync, AuctionStartedEvent, AuctionEndResult, LeaderboardEntry, CountdownExtendEvent } from '../../types/ws';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useCountdown } from '../../hooks/useCountdown';
import { useAuctionStore } from '../../store/auctionStore';
import { formatMsCompact, formatPrice } from '../../lib/format';
import { Badge } from '../../design-system/components/ui/badge';

interface AuctionSession {
  id: number;
  productId: number;
  roomId: number;
  status: string;
  currentPrice: number;
  createdAt: string;
  endedAt?: string;
}

export default function AuctionManage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  // WebSocket connection (auto-joins selectedRoom)
  const { isConnected, subscribe } = useWebSocket(selectedRoom);

  // Real-time auction data from Zustand store
  const storeAuction = useAuctionStore((s) => s.currentAuction);
  const countdownSync = useAuctionStore((s) => s.countdown);
  const extendMs = useAuctionStore((s) => s.extendMs);
  const countdownRemainingMs = useAuctionStore((s) => s.countdownRemainingMs);
  const countdownIsUrgent = useAuctionStore((s) => s.countdownIsUrgent);
  const leaderboard = useAuctionStore((s) => s.leaderboard);
  const participantCount = useAuctionStore((s) => s.participantCount);
  const onlineCount = useAuctionStore((s) => s.onlineCount);
  const {
    setAuction,
    setLeaderboard,
    setCountdown,
    triggerExtend,
    setParticipantCount,
    setOnlineCount,
    updateAuctionPrice,
    updateAuctionStatus,
    updateCountdownTick,
  } = useAuctionStore();

  // Countdown engine
  const { sync, extend } = useCountdown({
    onTick: updateCountdownTick,
  });

  useEffect(() => {
    if (countdownSync && countdownSync.remainingMs > 0) {
      sync(countdownSync);
    }
  }, [countdownSync, sync]);

  useEffect(() => {
    if (extendMs && extendMs.extendMs > 0) {
      extend(extendMs);
      useAuctionStore.setState({ extendMs: null });
    }
  }, [extendMs, extend]);

  // Subscribe to real-time auction events
  useEffect(() => {
    if (!isConnected || !selectedRoom) return;
    const unsubs = [
      subscribe('auction:state', (data: AuctionState) => {
        if (data.status === 'active') {
          setAuction(data);
          if (data.remainingMs != null) {
            setCountdown({
              sessionId: data.sessionId,
              remainingMs: data.remainingMs,
              serverTime: Date.now(),
            });
          }
        }
      }),
      subscribe('bid:new', (data) => {
        updateAuctionPrice(data.sessionId, data.amount);
      }),
      subscribe('rank:update', (data: LeaderboardEntry[]) => setLeaderboard(data)),
      subscribe('countdown:sync', (data: CountdownSync) => setCountdown(data)),
      subscribe('countdown:extend', (data: CountdownExtendEvent) => {
        triggerExtend({ sessionId: data.sessionId, extendMs: data.extendSeconds * 1000, serverTime: data.serverTime ?? Date.now() });
      }),
      subscribe('room:count', (data) => {
        setOnlineCount(data.onlineCount);
        setParticipantCount(data.participantCount);
      }),
      subscribe('auction:started', (data: AuctionStartedEvent) => {
        setCurrentAuction({
          id: data.sessionId,
          productId: data.product?.id ?? 0,
          roomId: selectedRoom!,
          status: 'active',
          currentPrice: data.currentPrice,
          createdAt: data.startedAt,
        });
        setAuction({
          sessionId: data.sessionId,
          status: 'active',
          product: data.product,
          rule: data.rule,
          currentPrice: data.currentPrice,
          leaderboard: [],
          myRank: null,
          myBidAmount: null,
          remainingMs: data.rule.durationSeconds * 1000,
          startedAt: data.startedAt,
          participantCount: 0,
          extensionCount: 0,
        });
        if (data.rule.durationSeconds != null) {
          setCountdown({
            sessionId: data.sessionId,
            remainingMs: data.rule.durationSeconds * 1000,
            serverTime: Date.now(),
          });
        }
      }),
      subscribe('auction:ended', (data: AuctionEndResult) => {
        updateAuctionStatus(data.sessionId, data.status);
        setCurrentAuction((prev) => prev ? { ...prev, status: data.status } : null);
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [isConnected, selectedRoom, subscribe, setAuction, setLeaderboard, setCountdown, triggerExtend, setParticipantCount, setOnlineCount, updateAuctionPrice, updateAuctionStatus]);

  useEffect(() => {
    async function init() {
      try {
        const [roomsRes, productsRes] = await Promise.all([
          api.get<{ data: { items: LiveRoom[] } }>('/rooms'),
          api.get<{ data: { items: Product[] } }>('/products', { status: 'listed' }),
        ]);
        const roomItems = (roomsRes as any)?.data?.items ?? [];
        const productItems = (productsRes as any)?.data?.items ?? [];
        setRooms(roomItems);
        setProducts(productItems);
        const productIdFromUrl = searchParams.get('productId');
        if (productIdFromUrl) {
          const pid = Number(productIdFromUrl);
          if (productItems.some((p: Product) => p.id === pid)) {
            setSelectedProduct(pid);
          }
        }
        if (roomItems.length === 1) {
          setSelectedRoom(roomItems[0].id);
        }
      } catch {
        toast({ title: '加载失败', description: '无法获取直播间或商品列表', variant: 'destructive' });
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
      setTimeout(() => setSuccessMsg(''), SUCCESS_MSG_AUTO_DISMISS_MS);
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
                      ROOM_STATUS_STYLES[selectedRoomData.status]?.bg ?? ROOM_STATUS_STYLES.offline.bg
                    } ${ROOM_STATUS_STYLES[selectedRoomData.status]?.text ?? ROOM_STATUS_STYLES.offline.text}`}
                  >
                    <span
                      className={`w-1 h-1 rounded-full ${
                        ROOM_STATUS_STYLES[selectedRoomData.status]?.dot ?? ROOM_STATUS_STYLES.offline.dot
                      }`}
                    />
                    {ROOM_STATUS_STYLES[selectedRoomData.status]?.label ?? '离线'}
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
                      const status = ROOM_STATUS_STYLES[room.status] ?? ROOM_STATUS_STYLES.offline;
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
                    暂无上架待竞拍的商品
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
          <p className="text-text-tertiary text-xs mt-2">仅显示状态为"上架待竞拍"的商品</p>
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

      {/* 实时竞拍数据面板 */}
      {currentAuction && (
        <div className="bg-surface-card border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Gavel className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-text-primary">实时竞拍监控</h2>
                <p className="text-text-tertiary text-xs">
                  {storeAuction?.product?.name ?? products.find((p) => p.id === currentAuction.productId)?.name ?? `商品 #${currentAuction.productId}`}
                </p>
              </div>
            </div>
            <Badge variant="outline" className={`${isConnected ? 'border-emerald-500/30 text-emerald-600 bg-emerald-50' : 'border-red-500/30 text-red-500 bg-red-50'} text-xs`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'} mr-1.5`} />
              {isConnected ? '已连接' : '连接中...'}
            </Badge>
          </div>

          {/* Countdown + Price */}
          <div className="text-center py-3 bg-gradient-to-b from-surface-secondary to-transparent rounded-xl border border-surface-border">
            <div className="text-text-tertiary text-xs mb-1">当前最高价</div>
            <div className="text-brand text-3xl font-bold tracking-tight">
              {formatPrice(storeAuction?.currentPrice ?? currentAuction.currentPrice)}
            </div>
            {countdownRemainingMs > 0 ? (
              <div className="mt-2 flex items-center justify-center gap-2">
                <Timer className={`w-4 h-4 ${countdownIsUrgent ? 'text-red-500' : 'text-amber-500'}`} />
                <span className={`font-mono text-lg font-bold ${countdownIsUrgent ? 'text-red-500 animate-pulse' : 'text-amber-600'}`}>
                  {formatMsCompact(countdownRemainingMs)}
                </span>
              </div>
            ) : storeAuction?.status === 'active' ? (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-text-tertiary text-xs">
                <Clock className="w-3.5 h-3.5" />
                等待倒计时同步...
              </div>
            ) : (
              <div className="mt-2">
                <Badge variant="outline" className="border-slate-300 text-text-tertiary text-xs">竞拍已结束</Badge>
              </div>
            )}
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-secondary/50 rounded-lg p-3 border border-slate-200 text-center">
              <Users className="w-4 h-4 text-text-secondary mx-auto mb-1" />
              <p className="text-text-tertiary text-[10px]">在线</p>
              <p className="text-text-primary font-semibold text-base">{onlineCount}</p>
            </div>
            <div className="bg-surface-secondary/50 rounded-lg p-3 border border-slate-200 text-center">
              <TrendingUp className="w-4 h-4 text-brand mx-auto mb-1" />
              <p className="text-text-tertiary text-[10px]">参与竞拍</p>
              <p className="text-text-primary font-semibold text-base">{participantCount}</p>
            </div>
            <div className="bg-surface-secondary/50 rounded-lg p-3 border border-slate-200 text-center">
              <Trophy className="w-4 h-4 text-amber-500 mx-auto mb-1" />
              <p className="text-text-tertiary text-[10px]">出价人数</p>
              <p className="text-text-primary font-semibold text-base">{leaderboard.length}</p>
            </div>
          </div>

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-text-secondary text-xs font-medium">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                出价排行
                <span className="text-text-tertiary font-normal ml-auto">{leaderboard.length} 人</span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {leaderboard.slice(0, 10).map((entry, idx) => (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                      idx === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-surface-secondary border border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-5 text-center text-xs font-bold ${idx === 0 ? 'text-amber-500' : 'text-text-tertiary'}`}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${entry.rank}`}
                      </span>
                      <span className="text-text-primary text-sm truncate max-w-[120px]">{entry.userNickname}</span>
                    </div>
                    <span className={`font-semibold text-sm ${idx === 0 ? 'text-amber-600' : 'text-text-primary'}`}>
                      {formatPrice(entry.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <button
            onClick={() => navigate(`/live/${currentAuction.roomId}`)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-secondary hover:bg-slate-100 border border-slate-200 rounded-lg text-text-secondary hover:text-text-primary text-sm font-medium transition-all"
          >
            进入直播间
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
