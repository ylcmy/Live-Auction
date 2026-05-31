import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatPrice } from '../../lib/format';
import { Card, CardContent } from '../../design-system/components/ui/card';
import { Badge } from '../../design-system/components/ui/badge';
import { Button } from '../../design-system/components/ui/button';
import { Radio, Users, Gavel, UserCircle, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getSocket } from '../../services/socket';
import type { LiveRoom } from '../../types/api';
import type { ApiResponse, PaginatedData } from '../../types/api';

function AudioWaveform() {
  return (
    <div className="flex items-end gap-[2px] h-3">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-[2px] bg-red-400 rounded-full"
          animate={{ height: ['3px', '10px', '5px', '10px', '3px'] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

const PAGE_SIZE = 20;

export default function LiveRoomList() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const hasMore = rooms.length < total;

  const fetchRooms = useCallback(async (pageNum: number, append: boolean) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await api.get<ApiResponse<PaginatedData<LiveRoom>>>('/rooms', {
        status: 'live',
        page: pageNum,
        limit: PAGE_SIZE,
      });
      const data = (response as any).data ?? response;
      const items = data?.items || [];
      setTotal(data?.total || 0);
      if (append) {
        setRooms((prev) => [...prev, ...items]);
      } else {
        setRooms(items);
      }
    } catch (err: any) {
      setError(err?.data?.message || err.message || '加载直播间列表失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchRooms(nextPage, true);
  }, [page, loadingMore, hasMore, fetchRooms]);

  useEffect(() => {
    fetchRooms(1, false);
  }, [fetchRooms]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket?.connected) return;

    socket.emit('room-list:subscribe');

    const onAuctionStarted = (data: { roomId: number; currentAuction: any }) => {
      setRooms((prev) =>
        prev.map((room) =>
          room.id === data.roomId
            ? { ...room, currentAuction: data.currentAuction }
            : room,
        ),
      );
    };

    const onAuctionEnded = (data: { roomId: number; sessionId: number; status: string }) => {
      setRooms((prev) =>
        prev.map((room) =>
          room.id === data.roomId
            ? { ...room, currentAuction: null }
            : room,
        ),
      );
    };

    const onBidNew = (data: { roomId: number; sessionId: number; currentPrice: number }) => {
      setRooms((prev) =>
        prev.map((room) => {
          if (room.id !== data.roomId || !room.currentAuction) return room;
          if (room.currentAuction.sessionId !== data.sessionId) return room;
          return {
            ...room,
            currentAuction: { ...room.currentAuction, currentPrice: data.currentPrice },
          };
        }),
      );
    };

    socket.on('room-list:auction-started', onAuctionStarted);
    socket.on('room-list:auction-ended', onAuctionEnded);
    socket.on('room-list:bid-new', onBidNew);

    return () => {
      socket.emit('room-list:unsubscribe');
      socket.off('room-list:auction-started', onAuctionStarted);
      socket.off('room-list:auction-ended', onAuctionEnded);
      socket.off('room-list:bid-new', onBidNew);
    };
  }, []);

  const handleEnterRoom = (roomId: number) => {
    navigate(`/live/${roomId}`);
  };

  const sortedRooms = [...rooms].sort((a, b) => {
    const aActive = a.currentAuction?.status === 'active' ? 1 : 0;
    const bActive = b.currentAuction?.status === 'active' ? 1 : 0;
    return bActive - aActive;
  });

  return (
    <div className="min-h-screen bg-[#161823] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#161823]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Radio className="w-6 h-6 text-brand" />
            正在直播
          </h1>
          <p className="text-text-tertiary text-sm mt-1">选择直播间，参与实时竞拍</p>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 w-full">
        {/* Initial Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface-card border border-white/10 rounded-xl p-4 animate-pulse"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-white/5 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/5 rounded w-3/4" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
                <div className="mt-4 h-8 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-16">
            <div className="bg-brand/10 border border-brand/20 rounded-xl px-6 py-4 inline-block">
              <p className="text-brand text-sm">{error}</p>
              <Button
                variant="link"
                onClick={() => fetchRooms(1, false)}
                className="mt-2 text-text-secondary"
              >
                重试
              </Button>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && rooms.length === 0 && (
          <div className="text-center py-24">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
                <Radio className="w-10 h-10 text-text-tertiary" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">暂无直播间</h2>
              <p className="text-text-tertiary text-sm">当前没有正在直播的直播间，请稍后再来</p>
            </motion.div>
          </div>
        )}

        {/* Room List */}
        {!loading && !error && rooms.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedRooms.map((room, index) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.5), duration: 0.4 }}
              >
                <Card
                  className="bg-surface-card border-white/10 hover:border-brand/30 transition-all duration-300 cursor-pointer group"
                  onClick={() => handleEnterRoom(room.id)}
                >
                  <CardContent className="p-4">
                    {/* Top: LIVE badge + online count */}
                    <div className="flex items-center justify-between mb-3">
                      <Badge className="bg-red-500/20 text-red-400 border-0 text-xs px-2 py-0.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        LIVE
                      </Badge>
                      <div className="flex items-center gap-1 text-text-tertiary text-xs">
                        <Users className="w-3 h-3" />
                        <span>{room.onlineCount || 0} 在线</span>
                      </div>
                    </div>

                    {/* Room title */}
                    <h3 className="text-white font-semibold text-base mb-2 group-hover:text-brand transition-colors line-clamp-1">
                      {room.title}
                    </h3>

                    {/* Host info */}
                    <div className="flex items-center gap-1.5 text-text-tertiary text-sm mb-3">
                      <UserCircle className="w-4 h-4" />
                      <span>主播 ID: {room.hostId}</span>
                    </div>

                    {/* Current auction info - unified height */}
                    <div className="bg-white/5 rounded-lg p-3 mb-3 h-[52px] flex flex-col justify-center">
                      {room.currentAuction?.product ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-text-secondary text-xs">
                            <AudioWaveform />
                            <span>当前竞拍</span>
                          </div>
                          <p className="text-brand text-sm font-bold">
                            <span className="text-text-tertiary text-xs font-normal mr-1">当前价</span>
                            {formatPrice(room.currentAuction.currentPrice)}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-text-tertiary text-xs">
                          <Gavel className="w-3 h-3" />
                          <span>等待主播发起竞拍</span>
                        </div>
                      )}
                    </div>

                    {/* Enter button */}
                    <Button
                      className="w-full bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 hover:border-brand/40 transition-all duration-200"
                      variant="outline"
                    >
                      进入直播间
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Infinite scroll sentinel + loading more indicator */}
        {!loading && !error && rooms.length > 0 && (
          <div ref={sentinelRef} className="flex justify-center py-6">
            {loadingMore && (
              <div className="flex items-center gap-2 text-text-tertiary text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>加载更多...</span>
              </div>
            )}
            {!hasMore && rooms.length > 0 && (
              <span className="text-text-tertiary text-xs">已加载全部直播间</span>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
