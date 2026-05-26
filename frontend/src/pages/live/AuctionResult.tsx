import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/api';
import { formatPrice } from '../../lib/format';
import { useAuthStore } from '../../store/authStore';
import { Card, CardContent } from '../../design-system/components/ui/card';
import { Button } from '../../design-system/components/ui/button';
import { Badge } from '../../design-system/components/ui/badge';
import { Avatar, AvatarFallback } from '../../design-system/components/ui/avatar';
import type { AuctionEndResult, LeaderboardEntry } from '../../types/ws';

interface AuctionResultProps {
  result: AuctionEndResult;
  userParticipated: boolean;
  userOvertaken?: boolean;
  onDismiss?: () => void;
}

export default function AuctionResult({ result, userParticipated, userOvertaken = false, onDismiss }: AuctionResultProps) {
  const { user } = useAuthStore();
  const [isPaying, setIsPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const isWinner = result.winner && user && result.winner.userId === user.id;

  const handlePay = async () => {
    if (!result.orderId) return;
    setIsPaying(true);
    setPayError(null);
    try {
      const response: any = await api.post(`/orders/${result.orderId}/pay`);
      if (response.code === 0) {
        setPaid(true);
      } else {
        setPayError(response.message || '支付失败');
      }
    } catch (err: any) {
      setPayError(err?.data?.message || err.message || '支付失败');
    } finally {
      setIsPaying(false);
    }
  };

  // Non-participant view
  if (!userParticipated && !isWinner) {
    return (
      <Card className="bg-surface-card border-white/10">
        <CardContent className="p-6 text-center">
          <div className="text-5xl mb-4">🔔</div>
          <h2 className="text-xl font-bold text-white mb-2">竞拍结束</h2>
          {result.winner ? (
            <p className="text-text-secondary text-sm">
              由 <span className="text-brand font-semibold">{result.winner.userNickname}</span>{' '}
              以 {formatPrice(result.winner.finalPrice)} 成交
            </p>
          ) : (
            <p className="text-text-secondary text-sm">无人出价，竞拍流拍</p>
          )}
          {onDismiss && (
            <Button onClick={onDismiss} className="mt-6 bg-brand hover:bg-brand-hover text-white">
              返回直播间
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Winner view
  if (isWinner && result.winner) {
    if (paid) {
      return (
        <Card className="bg-surface-card border-white/10">
          <CardContent className="p-6 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
              <div className="text-6xl mb-4">🎉</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <h2 className="text-xl font-bold text-white mb-2">支付成功</h2>
              <p className="text-brand text-2xl font-bold mb-2">{formatPrice(result.winner.finalPrice)}</p>
              <p className="text-text-tertiary text-sm">恭喜您成功拍得此商品</p>
            </motion.div>
            {onDismiss && (
              <Button onClick={onDismiss} className="mt-6 bg-brand hover:bg-brand-hover text-white">
                返回直播间
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="bg-surface-card border-brand/20">
        <CardContent className="p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <div className="text-6xl mb-4">🏆</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h2 className="text-xl font-bold text-white mb-1">恭喜中标！</h2>
            <p className="text-text-secondary text-sm mb-4">您已成功拍得此商品</p>

            <div className="bg-surface-elevated rounded-xl p-6 mb-6 inline-block">
              <p className="text-text-tertiary text-xs mb-1">成交价</p>
              <p className="text-brand text-4xl font-bold">{formatPrice(result.winner.finalPrice)}</p>
            </div>

            <div className="space-y-3">
              {payError && <p className="text-brand text-xs">{payError}</p>}
              <Button
                onClick={handlePay}
                disabled={isPaying}
                size="lg"
                className="w-full max-w-xs bg-brand hover:bg-brand-hover text-white shadow-[0_4px_16px_rgba(254,44,85,0.25)]"
              >
                {isPaying ? '支付中...' : '去支付'}
              </Button>
            </div>
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  // Participant but not winner
  return (
    <AnimatePresence>
      <Card className="bg-surface-card border-white/10">
        <CardContent className="p-6 text-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 150, damping: 15 }}>
            <div className="text-5xl mb-4">{userOvertaken ? '⚡' : '🔔'}</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-xl font-bold text-white mb-2">竞拍结束</h2>

            {userOvertaken && (
              <Badge variant="outline" className="mb-3 border-brand/30 text-brand">出价被超越</Badge>
            )}

            {result.winner ? (
              <div className="bg-surface-elevated rounded-xl p-4 mt-3 mb-4">
                <p className="text-text-tertiary text-xs mb-2">中标者</p>
                <div className="flex items-center justify-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-brand/20 text-brand text-sm">
                      {result.winner.userNickname.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-white font-semibold">{result.winner.userNickname}</span>
                </div>
                <p className="text-brand text-xl font-bold mt-2">{formatPrice(result.winner.finalPrice)}</p>
              </div>
            ) : (
              <p className="text-text-secondary text-sm">无人出价，竞拍流拍</p>
            )}

            {result.leaderboard && result.leaderboard.length > 0 && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-text-tertiary text-xs mb-3">出价排行</p>
                <div className="space-y-2">
                  {result.leaderboard.slice(0, 3).map((entry: LeaderboardEntry) => (
                    <div key={entry.userId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                          entry.rank === 2 ? 'bg-gray-400/20 text-gray-400' :
                          'bg-amber-700/20 text-amber-600'
                        }`}>
                          {entry.rank}
                        </span>
                        <span className={entry.isCurrentUser ? 'text-brand font-medium' : 'text-text-secondary'}>
                          {entry.userNickname}
                          {entry.isCurrentUser && ' (你)'}
                        </span>
                      </div>
                      <span className="text-white font-medium">{formatPrice(entry.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {onDismiss && (
              <Button onClick={onDismiss} variant="outline" className="mt-6 border-white/10 text-text-secondary hover:text-white hover:border-white/20">
                关闭
              </Button>
            )}
          </motion.div>
        </CardContent>
      </Card>
    </AnimatePresence>
  );
}
