import { useParams } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuctionStore } from '../../store/auctionStore';
import AuctionPanel from './AuctionPanel';
import BidButton from '../../components/auction/BidButton';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { formatPrice } from '../../lib/format';
import { Badge } from '../../design-system/components/ui/badge';

interface LiveRoomData {
  id: number;
  hostId: number;
  title: string;
  streamUrl: string | null;
  status: string;
}

export default function LiveRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const id = Number(roomId);
  const { isConnected, isReconnecting, subscribe } = useWebSocket(id);
  const {
    setAuction,
    setLeaderboard,
    setOnlineCount,
    setParticipantCount,
    setEmotion,
    currentAuction,
    onlineCount,
  } = useAuctionStore();
  const [videoError, setVideoError] = useState(false);
  const [room, setRoom] = useState<LiveRoomData | null>(null);
  const [wasReconnected, setWasReconnected] = useState(false);
  const wasDisconnectedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    api.get<{ data: LiveRoomData }>(`/rooms/${id}`)
      .then((res) => {
        const data = (res as any).data ?? res;
        setRoom(data as LiveRoomData);
      })
      .catch(() => {});
  }, [id]);

  const streamUrl = room?.streamUrl;

  useEffect(() => {
    if (!isConnected) return;
    const unsubs = [
      subscribe<any>('auction:state', (data: any) => {
        if (data.status === 'active') setAuction(data);
      }),
      subscribe<any>('rank:update', (data: any) => setLeaderboard(data)),
      subscribe<any>('room:count', (data: any) => {
        setOnlineCount(data.onlineCount);
        setParticipantCount(data.participantCount);
      }),
      subscribe<any>('emotion:lead', (data: any) => setEmotion({ ...data, type: 'lead' })),
      subscribe<any>('emotion:overtaken', (data: any) => setEmotion({ ...data, type: 'overtaken' })),
      subscribe<any>('countdown:extend', (data: any) => setEmotion({ ...data, type: 'extended' })),
      subscribe<any>('auction:ended', (data: any) => setEmotion({ ...data, type: 'ended' })),
      subscribe<any>('auction:cancelled', (data: any) => setEmotion({ ...data, type: 'cancelled' })),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [isConnected, subscribe, setAuction, setLeaderboard, setOnlineCount, setParticipantCount, setEmotion]);

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

  const showVideo = streamUrl && !videoError;
  const showProductImage = !showVideo && currentAuction?.product?.imageUrl;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center md:flex-row md:items-stretch md:h-screen md:overflow-hidden">
      {/* Video / Image area */}
      <div className="w-full md:flex-[1.5] md:h-full bg-surface-secondary relative overflow-hidden flex-shrink-0">
        <div className="max-md:aspect-[9/16] max-md:max-w-md max-md:mx-auto h-full w-full relative">
          {showVideo ? (
            <video
              className="w-full h-full object-cover"
              src={streamUrl}
              autoPlay muted loop playsInline
              onError={() => setVideoError(true)}
            />
          ) : showProductImage ? (
            <div className="w-full h-full relative">
              <img src={currentAuction!.product.imageUrl!} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            </div>
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
              animate={{ opacity: [1, 0.6, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <Badge className="bg-brand hover:bg-brand text-white border-0 text-xs px-2 py-0.5">LIVE</Badge>
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

      {/* Auction panel — side on PC, bottom on mobile */}
      <div className="w-full md:w-[380px] md:flex-shrink-0 md:h-full md:overflow-y-auto md:border-l md:border-white/10 bg-surface-card max-md:flex-1 max-md:max-w-md max-md:pb-24">
        <AuctionPanel />
      </div>

      {/* Fixed bottom bar on mobile */}
      <div className="hidden max-md:flex fixed bottom-0 left-0 right-0 z-20 bg-surface-card/95 backdrop-blur-sm border-t border-white/10 p-4 items-center justify-between">
        {currentAuction ? (
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
