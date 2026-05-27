import { useParams } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuctionStore } from '../../store/auctionStore';
import AuctionPanel from './AuctionPanel';
import BidButton from '../../components/auction/BidButton';
import SimulatedStream from '../../components/auction/SimulatedStream';
import ProductList from '../../components/auction/ProductList';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { formatPrice } from '../../lib/format';
import { Badge } from '../../design-system/components/ui/badge';
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
    currentAuction,
    onlineCount,
  } = useAuctionStore();
  const [, setRoom] = useState<LiveRoomData | null>(null);
  const [auctions, setAuctions] = useState<RoomAuctionItem[]>([]);
  const [sideTab, setSideTab] = useState<SideTab>('auction');
  const [wasReconnected, setWasReconnected] = useState(false);
  const [roomStatus, setRoomStatus] = useState<string>('live');
  const wasDisconnectedRef = useRef(false);
  const lastSyncRef = useRef<CountdownSync | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get<{ data: LiveRoomData }>(`/rooms/${id}`)
      .then((res) => {
        const data = (res as any).data ?? res;
        setRoom(data as LiveRoomData);
        setRoomStatus(data.status || 'offline');
        if (data.auctions) {
          setAuctions(data.auctions);
        }
        if (data.currentAuction) {
          setAuction(data.currentAuction);
          if (data.currentAuction.participantCount) {
            setParticipantCount(data.currentAuction.participantCount);
          }
        }
      })
      .catch(() => {});
  }, [id, setAuction, setParticipantCount]);

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
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [isConnected, subscribe, setAuction, setLeaderboard, setOnlineCount, setParticipantCount, setCountdown, triggerExtend, setEmotion, id]);

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

  const pendingCount = auctions.filter((a) => a.status === 'pending').length;
  const endedCount = auctions.filter((a) => ['ended', 'unsold', 'cancelled'].includes(a.status)).length;

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
    <div className="min-h-screen bg-black flex flex-col items-center md:flex-row md:items-stretch md:h-screen md:overflow-hidden">
      {/* Video / Simulated stream area */}
      <div className="w-full md:flex-[1.5] md:h-full bg-surface-secondary relative overflow-hidden flex-shrink-0">
        <div className="max-md:aspect-[9/16] max-md:max-w-md max-md:mx-auto h-full w-full relative">
          {isOffline ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
              <div className="text-center px-6">
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                >
                  <div className="text-7xl mb-6">📺</div>
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
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-surface-card to-surface-secondary">
              <div className="text-center">
                <div className="text-6xl mb-4">📺</div>
                <p className="text-text-secondary">直播暂未开始</p>
              </div>
            </div>
          )}

          <div className="absolute top-3 left-3 z-10">
            <motion.div
              animate={isOffline ? {} : { opacity: [1, 0.6, 1] }}
              transition={isOffline ? {} : { repeat: Infinity, duration: 1.5 }}
            >
              <Badge className={`${isOffline ? 'bg-gray-600' : 'bg-brand hover:bg-brand'} text-white border-0 text-xs px-2 py-0.5`}>
                {isOffline ? 'OFFLINE' : 'LIVE'}
              </Badge>
            </motion.div>
          </div>

          <div className="absolute top-3 right-3 z-10">
            <Badge variant="secondary" className="bg-black/60 text-white border-0 text-xs">
              👁 {onlineCount}
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
              <span className="animate-spin">⟳</span> 网络断开，正在重连...
            </motion.div>
          )}
          {isConnected && !isReconnecting && wasReconnected && (
            <motion.div
              key="reconnected"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-success/80 text-white text-center py-1 text-xs overflow-hidden"
            >
              已重新连接
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Side panel — auction + product list */}
      <div className="w-full md:w-[380px] md:flex-shrink-0 md:h-full md:border-l md:border-white/10 bg-surface-card max-md:flex-1 max-md:max-w-md max-md:pb-24 flex flex-col">
        {/* Tab bar */}
        <div className="flex border-b border-white/10 shrink-0">
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition-colors relative ${
              sideTab === 'auction'
                ? 'text-brand'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
            onClick={() => setSideTab('auction')}
          >
            竞拍
            {currentAuction?.status === 'active' && (
              <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            )}
          </button>
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition-colors relative ${
              sideTab === 'products'
                ? 'text-brand'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
            onClick={() => setSideTab('products')}
          >
            商品
            {pendingCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-blue-500/20 text-blue-400 text-[10px] px-1">
                {pendingCount}
              </span>
            )}
            {endedCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-green-500/20 text-green-400 text-[10px] px-1">
                {endedCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {isOffline ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="text-4xl mb-4">🔒</div>
              <p className="text-text-secondary text-sm">主播未开播，竞拍功能暂不可用</p>
              <p className="text-text-tertiary text-xs mt-2">请等待主播上线</p>
            </div>
          ) : sideTab === 'auction' ? (
            <AuctionPanel />
          ) : (
            <ProductList auctions={auctions} currentSessionId={currentAuction?.sessionId} onSelectAuction={handleSelectAuction} />
          )}
        </div>
      </div>

      {/* Fixed bottom bar on mobile */}
      <div className="hidden max-md:flex fixed bottom-0 left-0 right-0 z-20 bg-surface-card/95 backdrop-blur-sm border-t border-white/10 p-4 items-center justify-between">
        {isOffline ? (
          <div className="text-text-tertiary text-sm w-full text-center">主播未开播</div>
        ) : currentAuction ? (
          <>
            <div>
              <div className="text-text-tertiary text-xs">当前出价</div>
              <div className="text-brand font-bold text-lg">{formatPrice(currentAuction.currentPrice)}</div>
            </div>
            <div className="w-48">
              <BidButton sessionId={currentAuction.sessionId} />
            </div>
          </>
        ) : (
          <div className="text-text-tertiary text-sm w-full text-center">等待主播发起竞拍</div>
        )}
      </div>
    </div>
  );
}
