import { useParams } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuctionStore } from '../../store/auctionStore';
import { useCart } from '../../hooks/useCart';
import AuctionPanel from './AuctionPanel';
import BidButton from '../../components/auction/BidButton';
import SimulatedStream from '../../components/auction/SimulatedStream';
import ProductList from '../../components/auction/ProductList';
import CartButton from '../../components/auction/CartButton';
import CartPanel from '../../components/auction/CartPanel';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { formatPrice } from '../../lib/format';
import { Badge } from '../../design-system/components/ui/badge';
import { Users, Radio, Wifi, WifiOff, Gavel, ShoppingBag, Crown } from 'lucide-react';
import type { AuctionState, CountdownSync } from '../../types/ws';
import type { RoomAuctionItem } from '../../types/api';

interface LiveRoomData {
  id: number;
  hostId: number;
  title: string;
  status: string;
  currentAuction: AuctionState | null;
  auctions?: RoomAuctionItem[];
}

type SideTab = 'auction' | 'products';

export default function LiveRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const id = Number(roomId);
  const { isConnected, isReconnecting, subscribe } = useWebSocket(id);
  const {
    setAuction,
    setLeaderboard,
    setOnlineCount,
    setParticipantCount,
    setCountdown,
    triggerExtend,
    setEmotion,
    setRoomAuctions,
    updateAuctionPrice,
    setMyBid,
    currentAuction,
    onlineCount,
    roomAuctions,
  } = useAuctionStore();
  const [sideTab, setSideTab] = useState<SideTab>('auction');
  const [wasReconnected, setWasReconnected] = useState(false);
  const [roomStatus, setRoomStatus] = useState<string>('live');
  const wasDisconnectedRef = useRef(false);
  const lastSyncRef = useRef<CountdownSync | null>(null);

  const { isOpen: isCartOpen, openCart, closeCart, productCount } = useCart(roomAuctions);

  useEffect(() => {
    if (!id) return;
    api.get<{ data: LiveRoomData }>(`/rooms/${id}`)
      .then((res) => {
        const data = (res as any).data ?? res;
        setRoomStatus(data.status || 'offline');
        if (data.auctions) {
          setRoomAuctions(data.auctions);
        }
        if (data.currentAuction) {
          setAuction(data.currentAuction);
          if (data.currentAuction.participantCount) {
            setParticipantCount(data.currentAuction.participantCount);
          }
        }
      })
      .catch(() => {});
  }, [id, setAuction, setParticipantCount, setRoomAuctions]);

  useEffect(() => {
    if (!isConnected) return;
    const unsubs = [
      subscribe<any>('auction:state', (data: AuctionState) => {
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
      subscribe<any>('rank:update', (data: any) => setLeaderboard(data)),
      subscribe<any>('room:count', (data: any) => {
        setOnlineCount(data.onlineCount);
        setParticipantCount(data.participantCount);
      }),
      subscribe<any>('room:status', (data: { roomId: number; status: string }) => {
        if (data.roomId === id) {
          setRoomStatus(data.status);
        }
      }),
      subscribe<any>('countdown:sync', (data: CountdownSync) => {
        lastSyncRef.current = data;
        setCountdown(data);
      }),
      subscribe<any>('countdown:extend', (data: any) => {
        setEmotion({ ...data, type: 'extended' });
        triggerExtend(data.extendSeconds * 1000);
      }),
      subscribe<any>('emotion:lead', (data: any) => setEmotion({ ...data, type: 'lead' })),
      subscribe<any>('emotion:overtaken', (data: any) => setEmotion({ ...data, type: 'overtaken' })),
      subscribe<any>('auction:ended', (data: any) => setEmotion({ ...data, type: 'ended' })),
      subscribe<any>('auction:cancelled', (data: any) => setEmotion({ ...data, type: 'cancelled' })),
      subscribe<any>('bid:new', (data: { sessionId: number; amount: number; newTopBid: boolean }) => {
        if (data.newTopBid) {
          updateAuctionPrice(data.sessionId, data.amount);
        }
      }),
      subscribe<any>('bid:accepted', (data: { sessionId: number; amount: number }) => {
        setMyBid(data.sessionId, data.amount);
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [isConnected, subscribe, setAuction, setLeaderboard, setOnlineCount, setParticipantCount, setCountdown, triggerExtend, setEmotion, updateAuctionPrice, setMyBid, id]);

  useEffect(() => {
    if (isConnected && wasDisconnectedRef.current && !isReconnecting) {
      if (lastSyncRef.current) {
        setCountdown(lastSyncRef.current);
      }
    }
  }, [isConnected, isReconnecting, setCountdown]);

  useEffect(() => {
    if (isReconnecting) wasDisconnectedRef.current = true;
    if (wasDisconnectedRef.current && isConnected && !isReconnecting) {
      setWasReconnected(true);
      wasDisconnectedRef.current = false;
    }
  }, [isConnected, isReconnecting]);

  useEffect(() => {
    if (wasReconnected) {
      const timer = setTimeout(() => setWasReconnected(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [wasReconnected]);

  const pendingCount = roomAuctions.filter((a) => a.status === 'listed').length;
  const endedCount = roomAuctions.filter((a) => ['ended', 'unsold', 'cancelled'].includes(a.status)).length;

  const handleSelectAuction = (item: RoomAuctionItem) => {
    if (!item.product) return;
    const auctionState: AuctionState = {
      sessionId: item.sessionId,
      status: item.status as AuctionState['status'],
      product: item.product,
      rule: item.rule,
      currentPrice: item.currentPrice,
      leaderboard: [],
      myRank: null,
      remainingMs: item.rule.durationSeconds * 1000,
      startedAt: item.startedAt ?? new Date().toISOString(),
      participantCount: 0,
      extensionCount: item.extensionCount,
    };
    setAuction(auctionState);
    setSideTab('auction');
  };

  const isOffline = roomStatus === 'offline';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center md:flex-row md:items-stretch md:h-screen md:overflow-hidden">
      {/* Video / Simulated stream area */}
      <div className="w-full md:flex-[1.5] md:h-full bg-black relative overflow-hidden flex-shrink-0">
        <div className="max-md:aspect-[9/16] max-md:max-w-md max-md:mx-auto h-full w-full relative">
          {isOffline ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
              <div className="text-center px-6">
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                >
                  <div className="w-20 h-20 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-6">
                    <Radio className="w-10 h-10 text-brand/50" />
                  </div>
                </motion.div>
                <h2 className="text-xl font-semibold text-white mb-2">当前主播未开播</h2>
                <p className="text-gray-400 text-sm">主播上线后即可观看直播和参与竞拍</p>
              </div>
            </div>
          ) : currentAuction?.product ? (
            <SimulatedStream
              roomId={id}
              productName={currentAuction.product.name}
              productImage={currentAuction.product.imageUrl}
              currentPrice={currentAuction.currentPrice}
              participantCount={currentAuction.participantCount ?? 0}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-800 to-gray-900">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
                  <Radio className="w-8 h-8 text-brand/50" />
                </div>
                <p className="text-gray-400">直播暂未开始</p>
              </div>
            </div>
          )}

          {/* Live badge */}
          <div className="absolute top-3 left-3 z-10">
            <motion.div
              animate={isOffline ? {} : { opacity: [1, 0.6, 1] }}
              transition={isOffline ? {} : { repeat: Infinity, duration: 1.5 }}
            >
              <Badge className={`${isOffline ? 'bg-gray-600' : 'bg-red-500 hover:bg-red-500'} text-white border-0 text-xs px-2.5 py-1 flex items-center gap-1.5`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOffline ? 'bg-gray-400' : 'bg-white animate-pulse'}`} />
                {isOffline ? 'OFFLINE' : 'LIVE'}
              </Badge>
            </motion.div>
          </div>

          {/* Online count badge */}
          <div className="absolute top-3 right-3 z-10">
            <Badge variant="secondary" className="bg-black/60 text-white border-0 text-xs flex items-center gap-1.5">
              <Users className="w-3 h-3" />
              {onlineCount}
            </Badge>
          </div>
        </div>
      </div>

      {/* Reconnection banners */}
      <div className="w-full max-md:max-w-md absolute top-0 left-0 right-0 z-30 md:hidden">
        <AnimatePresence>
          {isReconnecting && (
            <motion.div
              key="reconnecting"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-warning/90 text-black text-center py-2 text-sm font-medium flex items-center justify-center gap-2 overflow-hidden"
            >
              <WifiOff className="w-4 h-4" />
              网络断开，正在重连...
            </motion.div>
          )}
          {isConnected && !isReconnecting && wasReconnected && (
            <motion.div
              key="reconnected"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-success/80 text-white text-center py-1 text-xs overflow-hidden flex items-center justify-center gap-1.5"
            >
              <Wifi className="w-3 h-3" />
              已重新连接
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Side panel — auction + product list */}
      <div className="w-full md:w-[380px] md:flex-shrink-0 md:h-full md:border-l md:border-gray-200 bg-white max-md:flex-1 max-md:max-w-md max-md:pb-24 flex flex-col">
        {/* Tab bar */}
        <div className="flex border-b border-gray-200 shrink-0">
          <button
            className={`flex-1 py-3 text-sm font-medium transition-colors relative flex items-center justify-center gap-1.5 ${
              sideTab === 'auction'
                ? 'text-brand'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
            onClick={() => setSideTab('auction')}
          >
            <Gavel className="w-4 h-4" />
            竞拍
            {currentAuction?.status === 'active' && (
              <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            )}
            {sideTab === 'auction' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand"
              />
            )}
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium transition-colors relative flex items-center justify-center gap-1.5 ${
              sideTab === 'products'
                ? 'text-brand'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
            onClick={() => setSideTab('products')}
          >
            <ShoppingBag className="w-4 h-4" />
            商品
            {pendingCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-blue-50 text-blue-500 text-[10px] px-1">
                {pendingCount}
              </span>
            )}
            {endedCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-emerald-50 text-emerald-500 text-[10px] px-1">
                {endedCount}
              </span>
            )}
            {sideTab === 'products' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand"
              />
            )}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {isOffline ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <WifiOff className="w-8 h-8 text-text-tertiary" />
              </div>
              <p className="text-text-secondary text-sm">主播未开播，竞拍功能暂不可用</p>
              <p className="text-text-tertiary text-xs mt-2">请等待主播上线</p>
            </div>
          ) : sideTab === 'auction' ? (
            <AuctionPanel />
          ) : (
            <ProductList auctions={roomAuctions} currentSessionId={currentAuction?.sessionId} onSelectAuction={handleSelectAuction} />
          )}
        </div>
      </div>

      {/* Fixed bottom bar on mobile */}
      <div className="hidden max-md:flex fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-md border-t border-gray-200 p-4 items-center justify-between">
        {isOffline ? (
          <div className="text-text-tertiary text-sm w-full text-center flex items-center justify-center gap-1.5">
            <WifiOff className="w-4 h-4" />
            主播未开播
          </div>
        ) : currentAuction ? (
          <>
            <div>
              <div className="text-text-tertiary text-xs flex items-center gap-1">
                <Crown className="w-3 h-3" />
                当前出价
              </div>
              <div className="text-brand-gradient font-bold text-lg">{formatPrice(currentAuction.currentPrice)}</div>
            </div>
            <div className="w-48">
              <BidButton sessionId={currentAuction.sessionId} />
            </div>
          </>
        ) : (
          <div className="text-text-tertiary text-sm w-full text-center">等待主播发起竞拍</div>
        )}
      </div>

      {/* Cart floating button + panel */}
      <CartButton productCount={productCount} onClick={openCart} />
      <CartPanel
        open={isCartOpen}
        onClose={closeCart}
        auctions={roomAuctions}
        currentSessionId={currentAuction?.sessionId}
        roomId={id}
        onSelectProduct={handleSelectAuction}
      />
    </div>
  );
}
