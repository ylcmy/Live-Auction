import { useParams } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuctionStore } from '../../store/auctionStore';
import { useAuthStore } from '../../store/authStore';
import { useCart } from '../../hooks/useCart';
import { useAudio } from '../../hooks/useAudio';
import { useCountdown } from '../../hooks/useCountdown';

import SimulatedStream from '../../components/auction/SimulatedStream';
import CartButton from '../../components/auction/CartButton';
import CartPanel from '../../components/auction/CartPanel';
import BidSheet from '../../components/auction/BidSheet';
import EmotionToast from '../../components/auction/EmotionToast';
import AuctionResult from './AuctionResult';
import LeaderboardSheet from '../../components/auction/LeaderboardSheet';
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { formatMsCompact } from '../../lib/format';
import { Badge } from '../../design-system/components/ui/badge';
import { Users, Radio, Wifi, WifiOff, X, ShoppingBag, Clock, Trophy } from 'lucide-react';
import ChatInput from '../../components/auction/ChatInput';
import type { AuctionState, CountdownSync, ChatMessage, AuctionEndResult } from '../../types/ws';
import type { RoomAuctionItem } from '../../types/api';

interface LiveRoomData {
  id: number;
  hostId: number;
  title: string;
  status: string;
  currentAuction: AuctionState | null;
  auctions?: RoomAuctionItem[];
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
    setCountdown,
    triggerExtend,
    setEmotion,
    setRoomAuctions,
    updateAuctionPrice,
    updateAuctionStatus,
    setMyBid,
    currentAuction,
    onlineCount,
    roomAuctions,
    addChatMessage,
    chatMessages,
    leaderboard,
    myBids,
    updateCountdownTick,
  } = useAuctionStore();
  const [wasReconnected, setWasReconnected] = useState(false);
  const [roomStatus, setRoomStatus] = useState<string>('live');
  const [roomTitle, setRoomTitle] = useState<string>('');
  const wasDisconnectedRef = useRef(false);
  const lastSyncRef = useRef<CountdownSync | null>(null);

  const { isOpen: isCartOpen, openCart, closeCart, productCount } = useCart(roomAuctions);
  const { playDing, playTick, playAlert } = useAudio();
  const tickPlayedRef = useRef(false);

  const countdownSync = useAuctionStore((s) => s.countdown);
  const countdownRemainingMs = useAuctionStore((s) => s.countdownRemainingMs);
  const countdownIsUrgent = useAuctionStore((s) => s.countdownIsUrgent);
  const extendMs = useAuctionStore((s) => s.extendMs);

  // Countdown tick audio — play once when remaining <= 10s, reset on extend
  useEffect(() => {
    if (countdownRemainingMs > 0 && countdownRemainingMs <= 10000 && !tickPlayedRef.current) {
      tickPlayedRef.current = true;
      playTick();
    }
    if (countdownRemainingMs > 10000) {
      tickPlayedRef.current = false;
    }
  }, [countdownRemainingMs, playTick]);

  const { sync, extend } = useCountdown({
    onTick: updateCountdownTick,
  });

  useEffect(() => {
    if (countdownSync && countdownSync.remainingMs > 0) {
      sync(countdownSync);
    }
  }, [countdownSync, sync]);

  useEffect(() => {
    if (extendMs && extendMs > 0) {
      extend(extendMs);
      useAuctionStore.setState({ extendMs: null });
    }
  }, [extendMs, extend]);

  const [bidSheetOpen, setBidSheetOpen] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [auctionResult, setAuctionResult] = useState<AuctionEndResult | null>(null);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!id) return;
    api.get<{ data: LiveRoomData }>(`/rooms/${id}`)
      .then((res) => {
        const data = (res as any).data ?? res;
        setRoomStatus(data.status || 'offline');
        setRoomTitle(data.title || '');
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
      subscribe<any>('emotion:overtaken', (data: any) => {
        setEmotion({ ...data, type: 'overtaken' });
        playAlert();
      }),
      subscribe<any>('auction:started', (data: any) => {
        setBubbleDismissed(false);
        setRoomAuctions((prev: RoomAuctionItem[]) => {
          const existingAuction = prev.find((a) => a.sessionId === data.sessionId);
          if (existingAuction) {
            // Update existing auction status
            return prev.map((a) =>
              a.sessionId === data.sessionId ? { ...a, status: 'active' as const } : a
            );
          }
          // Add new auction
          return [
            ...prev,
            {
              sessionId: data.sessionId,
              status: 'active',
              currentPrice: data.currentPrice,
              startedAt: data.startedAt,
              endedAt: null,
              extensionCount: 0,
              product: data.product,
              rule: data.rule,
            },
          ];
        });
        // Also set as current auction
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
      subscribe<any>('auction:ended', (data: AuctionEndResult) => {
        setEmotion({ ...data, type: 'ended' });
        updateAuctionStatus(data.sessionId, data.status);
        setAuctionResult(data);
      }),
      subscribe<any>('auction:cancelled', (data: any) => setEmotion({ ...data, type: 'cancelled' })),
      subscribe<any>('bid:new', (data: { sessionId: number; amount: number; newTopBid: boolean }) => {
        updateAuctionPrice(data.sessionId, data.amount);
      }),
      subscribe<any>('bid:accepted', (data: { sessionId: number; amount: number }) => {
        setMyBid(data.sessionId, data.amount);
        playDing();
      }),
      subscribe<any>('chat:broadcast', (data: ChatMessage) => {
        addChatMessage(data);
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [isConnected, subscribe, setAuction, setLeaderboard, setOnlineCount, setParticipantCount, setCountdown, triggerExtend, setEmotion, updateAuctionPrice, updateAuctionStatus, setMyBid, addChatMessage, id, playDing, playAlert]);

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

  const handleSelectAuction = (_item: RoomAuctionItem) => {
    // 仅打开商品详情，不修改当前竞拍状态
    // 商品详情由 CartPanel 内部管理
  };

  const handleSendMessage = useCallback((content: string) => {
    addChatMessage({
      userId: 0,
      userNickname: '我',
      avatarUrl: null,
      content,
      timestamp: new Date().toISOString(),
    });
  }, [addChatMessage]);

  const isOffline = roomStatus === 'offline';

  return (
    <div className="h-screen w-screen bg-[#161823] overflow-hidden relative">
      {/* Video / Simulated stream area — full screen */}
      <div className="w-full h-full bg-[#161823] relative overflow-hidden">
        <div className="h-full w-full relative">
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
          ) : (
            <SimulatedStream
              roomId={id}
              productName={currentAuction?.product?.name ?? roomTitle}
              productImage={currentAuction?.product?.imageUrl ?? null}
              currentPrice={currentAuction?.currentPrice ?? 0}
              participantCount={currentAuction?.participantCount ?? 0}
            />
          )}

          {/* Chat messages overlay */}
          {!isOffline && (
            <div className="absolute bottom-20 left-3 right-16 z-10 max-h-[20%] overflow-hidden pointer-events-none">
              <div className="flex flex-col justify-end space-y-1">
                {chatMessages.slice(-5).map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-black/40 backdrop-blur-sm rounded-lg px-2.5 py-1 inline-flex items-center gap-1.5"
                  >
                    <span className="text-brand text-xs font-medium">{msg.userNickname}</span>
                    <span className="text-white text-xs">{msg.content}</span>
                  </motion.div>
                ))}
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

      {/* Fixed bottom bar — transparent dark style */}
      <div className="flex fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3 pb-4 items-end gap-3">
        {isOffline ? (
          <div className="text-white/70 text-sm w-full text-center flex items-center justify-center gap-1.5">
            <WifiOff className="w-4 h-4" />
            主播未开播
          </div>
        ) : (
          <>
            <div className="flex-1 max-w-md">
              <ChatInput onSend={handleSendMessage} />
            </div>

            {/* Leaderboard toggle button */}
            {currentAuction?.status === 'active' && (
              <button
                onClick={() => setLeaderboardOpen(true)}
                className="relative flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-white/80 hover:text-white hover:bg-black/60 transition-all"
                title="出价排行榜"
              >
                <Trophy className="w-5 h-5" />
                {leaderboard.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                    {leaderboard.length > 9 ? '9+' : leaderboard.length}
                  </span>
                )}
              </button>
            )}

            {/* Cart button with auction bubble wrapper */}
            {roomAuctions.length > 0 && (
            <div className="relative flex-shrink-0">
              {/* Active auction bubble */}
              {currentAuction?.status === 'active' && currentAuction.product && !bubbleDismissed && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="absolute bottom-full right-0 mb-2 z-30"
                >
                  <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md rounded-2xl px-3 py-2.5 border border-white/10 shadow-xl whitespace-nowrap">
                    {/* Product image */}
                    <div className="relative flex-shrink-0">
                      {currentAuction.product.imageUrl ? (
                        <img
                          src={currentAuction.product.imageUrl}
                          alt={currentAuction.product.name}
                          className="w-12 h-12 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                          <ShoppingBag className="w-5 h-5 text-white/50" />
                        </div>
                      )}
                      {/* 讲解中 badge */}
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        讲解中
                      </div>
                    </div>

                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white text-sm font-medium truncate">{currentAuction.product.name}</span>
                        <span className="bg-red-500/80 text-white text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                          拍卖中
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-white font-bold text-base">¥{currentAuction.currentPrice.toLocaleString()}</span>
                        {leaderboard.length > 0 && (
                          <span className="text-white/60 text-xs">
                            {leaderboard[0].userNickname} 领先
                          </span>
                        )}
                      </div>
                      {countdownRemainingMs > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-red-400" />
                          <span className={`text-xs font-mono font-medium ${countdownIsUrgent ? 'text-red-400 animate-pulse' : 'text-white/80'}`}>
                            {formatMsCompact(countdownRemainingMs)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Go bid button */}
                    <button
                      onClick={() => setBidSheetOpen(true)}
                      className="flex-shrink-0 bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm font-semibold px-4 py-2 rounded-full hover:from-red-600 hover:to-pink-600 transition-all shadow-lg"
                    >
                      去出价
                    </button>

                    {/* Close button */}
                    <button
                      onClick={() => setBubbleDismissed(true)}
                      className="flex-shrink-0 text-white/40 hover:text-white/70 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Triangle pointer */}
                  <div className="absolute -bottom-1.5 right-5 w-3 h-3 bg-black/60 border-r border-b border-white/10 rotate-45" />
                </motion.div>
              )}

              <CartButton productCount={productCount} onClick={openCart} />
            </div>
            )}
          </>
        )}
      </div>

      {/* Cart panel */}
      <CartPanel
        open={isCartOpen}
        onClose={closeCart}
        auctions={roomAuctions}
        currentSessionId={currentAuction?.sessionId}
        onSelectProduct={handleSelectAuction}
      />

      {/* Bid sheet */}
      <BidSheet
        open={bidSheetOpen}
        onClose={() => setBidSheetOpen(false)}
        item={currentAuction ? {
          sessionId: currentAuction.sessionId,
          status: currentAuction.status,
          product: currentAuction.product,
          rule: currentAuction.rule,
          currentPrice: currentAuction.currentPrice,
          startedAt: currentAuction.startedAt,
          extensionCount: currentAuction.extensionCount,
        } as RoomAuctionItem : null}
        myLastBid={currentAuction ? myBids[currentAuction.sessionId] ?? null : null}
      />

      {/* Auction result overlay */}
      <AnimatePresence>
        {auctionResult && (
          <motion.div
            key="auction-result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm"
            >
              <AuctionResult
                result={auctionResult}
                userParticipated={auctionResult.sessionId != null && myBids[auctionResult.sessionId] != null}
                userOvertaken={auctionResult.winner != null && user != null && auctionResult.winner.userId !== user.id && myBids[auctionResult.sessionId] != null}
                onDismiss={() => setAuctionResult(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leaderboard sheet */}
      <LeaderboardSheet
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
      />

      {/* Emotion toasts — lead / overtaken / extended / ended */}
      <EmotionToast />
    </div>
  );
}
