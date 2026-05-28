import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { formatPrice } from '../../lib/format';
import { Card, CardContent } from '../../design-system/components/ui/card';
import { Badge } from '../../design-system/components/ui/badge';
import { Button } from '../../design-system/components/ui/button';
import { Radio, Users, Gavel, UserCircle, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { LiveRoom } from '../../types/api';
import type { ApiResponse, PaginatedData } from '../../types/api';

export default function LiveRoomList() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<PaginatedData<LiveRoom>>>('/rooms', {
        status: 'live',
        page: 1,
        limit: 20,
      });
      const data = (response as any).data ?? response;
      setRooms(data?.items || []);
    } catch (err: any) {
      setError(err?.data?.message || err.message || '加载直播间列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleEnterRoom = (roomId: number) => {
    navigate(`/live/${roomId}`);
  };

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
        {/* Loading */}
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
                onClick={fetchRooms}
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
            {rooms.map((room, index) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, duration: 0.4 }}
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

                    {/* Current auction info */}
                    {room.currentAuction?.product ? (
                      <div className="bg-white/5 rounded-lg p-3 mb-3">
                        <div className="flex items-center gap-1.5 text-text-secondary text-xs mb-1">
                          <Gavel className="w-3 h-3" />
                          <span>当前竞拍</span>
                        </div>
                        <p className="text-white text-sm font-medium line-clamp-1">
                          {room.currentAuction.product.name}
                        </p>
                        <p className="text-brand text-sm font-bold mt-1">
                          {formatPrice(room.currentAuction.currentPrice)}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-white/5 rounded-lg p-3 mb-3">
                        <div className="flex items-center gap-1.5 text-text-tertiary text-xs">
                          <Gavel className="w-3 h-3" />
                          <span>等待主播发起竞拍</span>
                        </div>
                      </div>
                    )}

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
      </main>
    </div>
  );
}
