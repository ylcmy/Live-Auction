import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { formatPrice } from '../../lib/format';
import { useAuthStore } from '../../store/authStore';
import { Card, CardContent } from '../../design-system/components/ui/card';
import { Button } from '../../design-system/components/ui/button';
import { Badge } from '../../design-system/components/ui/badge';
import { Avatar, AvatarFallback } from '../../design-system/components/ui/avatar';
import { Crown, Trophy, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
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
  const [isCancelling, setIsCancelling] = useState(false);

  const isWinner = result.winner && user && result.winner.userId === user.id;

  const handleCancel = async () => {
    if (!result.orderId) return;
    if (!window.confirm('确定要放弃支付吗？订单将被取消')) return;
    setIsCancelling(true);
    try {
      await api.put(`/orders/${result.orderId}/status`, { status: 'cancelled' });
      onDismiss?.();
    } catch {
      // ignore
    } finally {
      setIsCancelling(false);
    }
  };

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
      <Card className="bg-white border-gray-200">
        <CardContent className="p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-brand" />
            </div>
          </motion.div>
          <h2 className="text-xl font-bold text-text-primary mb-2">竞拍结束</h2>
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
        <Card className="bg-white border-gray-200">
          <CardContent className="p-6 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
              <div className="w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <h2 className="text-xl font-bold text-text-primary mb-2">支付成功</h2>
              <p className="text-brand-gradient text-2xl font-bold mb-2">{formatPrice(result.winner.finalPrice)}</p>
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

    // Order creation failed - show pending message instead of payment button
    if (result.orderCreated === false) {
      return (
        <Card className="bg-white border-brand/20">
          <CardContent className="p-6 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <div className="w-20 h-20 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
                <Crown className="w-10 h-10 text-brand" />
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <h2 className="text-xl font-bold text-text-primary mb-1">恭喜中标！</h2>
              <p className="text-text-secondary text-sm mb-4">您已成功拍得此商品</p>

              <div className="bg-gray-50 rounded-2xl p-6 mb-6 inline-block border border-gray-200">
                <p className="text-text-tertiary text-xs mb-1">成交价</p>
                <p className="text-brand-gradient text-4xl font-bold">{formatPrice(result.winner.finalPrice)}</p>
              </div>

              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <p className="text-amber-700 text-sm font-medium">订单生成中，请稍后查看</p>
                <p className="text-amber-600 text-xs mt-1">系统正在为您生成订单，请稍后在订单列表中查看</p>
              </div>
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
      <Card className="bg-white border-brand/20">
        <CardContent className="p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <div className="w-20 h-20 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
              <Crown className="w-10 h-10 text-brand" />
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h2 className="text-xl font-bold text-text-primary mb-1">恭喜中标！</h2>
            <p className="text-text-secondary text-sm mb-4">您已成功拍得此商品</p>

            <div className="bg-gray-50 rounded-2xl p-6 mb-6 inline-block border border-gray-200">
              <p className="text-text-tertiary text-xs mb-1">成交价</p>
              <p className="text-brand-gradient text-4xl font-bold">{formatPrice(result.winner.finalPrice)}</p>
            </div>

            <div className="space-y-3">
              {payError && <p className="text-red-500 text-xs">{payError}</p>}
              <Button
                onClick={handlePay}
                disabled={isPaying}
                size="lg"
                className="w-full max-w-xs bg-gradient-to-r from-brand via-brand-hover to-brand text-white font-bold shadow-glow-brand hover:shadow-glow-brand-lg"
              >
                {isPaying ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⟳</span>
                    支付中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    去支付
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
              <div className="flex items-center justify-center gap-3">
                <Button
                  onClick={handleCancel}
                  disabled={isCancelling}
                  variant="outline"
                  size="sm"
                  className="border-gray-200 text-text-tertiary hover:text-red-500 hover:border-red-200"
                >
                  {isCancelling ? '取消中...' : '放弃支付'}
                </Button>
                {onDismiss && (
                  <Button onClick={onDismiss} variant="outline" size="sm" className="border-gray-200 text-text-tertiary hover:text-text-secondary">
                    关闭
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  // Participant but not winner
  return (
    <AnimatePresence>
      <Card className="bg-white border-gray-200">
        <CardContent className="p-6 text-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 150, damping: 15 }}>
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              {userOvertaken ? <Sparkles className="w-8 h-8 text-amber-500" /> : <Trophy className="w-8 h-8 text-brand" />}
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-xl font-bold text-text-primary mb-2">竞拍结束</h2>

            {userOvertaken && (
              <Badge variant="outline" className="mb-3 border-brand/30 text-brand">出价被超越</Badge>
            )}

            {result.winner ? (
              <div className="bg-gray-50 rounded-2xl p-4 mt-3 mb-4 border border-gray-200">
                <p className="text-text-tertiary text-xs mb-2">中标者</p>
                <div className="flex items-center justify-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-brand-50 text-brand text-sm">
                      {result.winner.userNickname.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-text-primary font-semibold">{result.winner.userNickname}</span>
                </div>
                <p className="text-brand-gradient text-xl font-bold mt-2">{formatPrice(result.winner.finalPrice)}</p>
              </div>
            ) : (
              <p className="text-text-secondary text-sm">无人出价，竞拍流拍</p>
            )}

            {result.leaderboard && result.leaderboard.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="text-text-tertiary text-xs mb-3">出价排行</p>
                <div className="space-y-2">
                  {result.leaderboard.slice(0, 3).map((entry: LeaderboardEntry) => (
                    <div key={entry.userId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          entry.rank === 1 ? 'bg-amber-50 text-amber-500' :
                          entry.rank === 2 ? 'bg-gray-100 text-gray-400' :
                          'bg-amber-50/50 text-amber-600'
                        }`}>
                          {entry.rank}
                        </span>
                        <span className={entry.userId === user?.id ? 'text-brand font-medium' : 'text-text-secondary'}>
                          {entry.userNickname}
                          {entry.userId === user?.id && ' (你)'}
                        </span>
                      </div>
                      <span className="text-text-primary font-medium">{formatPrice(entry.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {onDismiss && (
              <Button onClick={onDismiss} variant="outline" className="mt-6 border-gray-200 text-text-secondary hover:text-text-primary hover:border-gray-300">
                关闭
              </Button>
            )}
          </motion.div>
        </CardContent>
      </Card>
    </AnimatePresence>
  );
}
