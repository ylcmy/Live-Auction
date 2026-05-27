import { useEffect } from 'react';
import { useAuctionStore } from '../../store/auctionStore';
import { useCountdown } from '../../hooks/useCountdown';
import { formatPrice } from '../../lib/format';
import BidButton from '../../components/auction/BidButton';
import Leaderboard from '../../components/auction/Leaderboard';
import Countdown from '../../components/auction/Countdown';
import EmotionToast from '../../components/auction/EmotionToast';
import { Card, CardContent } from '../../design-system/components/ui/card';
import { Badge } from '../../design-system/components/ui/badge';
import { Separator } from '../../design-system/components/ui/separator';
import { ScrollArea } from '../../design-system/components/ui/scroll-area';
import { Users, Flame, Clock, Gavel, Crown, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AuctionPanel() {
  const {
    currentAuction,
    onlineCount,
    participantCount,
    countdown: countdownSync,
    extendMs,
  } = useAuctionStore();
  const { remainingMs, isUrgent, sync, extend } = useCountdown();

  useEffect(() => {
    if (countdownSync && countdownSync.remainingMs > 0) {
      sync(countdownSync);
    }
  }, [countdownSync, sync]);

  useEffect(() => {
    if (extendMs && extendMs > 0) {
      extend(extendMs);
    }
  }, [extendMs, extend]);

  if (!currentAuction) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center">
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        >
          <div className="w-16 h-16 rounded-2xl bg-surface-secondary flex items-center justify-center mb-4">
            <Gavel className="w-8 h-8 text-brand/50" />
          </div>
        </motion.div>
        <p className="text-text-secondary text-lg font-medium">等待主播发起竞拍</p>
        <p className="text-text-tertiary text-sm mt-2 flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          {onlineCount} 人在线
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Participant count badge */}
        <div className="text-center">
          <Badge variant="outline" className="border-brand/30 text-brand bg-brand-50 px-3 py-1">
            <Flame className="w-3.5 h-3.5 mr-1.5" />
            {participantCount} 人正在竞拍
          </Badge>
        </div>

        {/* Product info card */}
        <Card className="bg-surface-secondary border-surface-border overflow-hidden">
          <CardContent className="p-0">
            <div className="flex gap-3 p-4">
              {currentAuction.product.imageUrl ? (
                <div className="relative flex-shrink-0">
                  <img
                    src={currentAuction.product.imageUrl}
                    alt={currentAuction.product.name}
                    className="w-16 h-16 rounded-xl object-cover bg-surface-secondary"
                  />
                  <div className="absolute -top-1 -right-1">
                    <Badge className="bg-brand text-white border-0 text-[10px] animate-pulse">
                      LIVE
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-surface-secondary flex items-center justify-center text-2xl">
                  📦
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-text-primary font-semibold truncate">{currentAuction.product.name}</h3>
                {currentAuction.product.description && (
                  <p className="text-text-tertiary text-xs mt-1 line-clamp-2">{currentAuction.product.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {currentAuction.rule && (
                    <>
                      <Badge variant="secondary" className="text-[10px] bg-white text-text-tertiary border-0">
                        起拍 ¥{formatPrice(currentAuction.rule.startPrice)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] bg-white text-text-tertiary border-0">
                        加价 ¥{formatPrice(currentAuction.rule.bidIncrement)}
                      </Badge>
                      {currentAuction.rule.ceilingPrice && currentAuction.rule.ceilingPrice > 0 && (
                        <Badge variant="secondary" className="text-[10px] bg-white text-text-tertiary border-0">
                          封顶 ¥{formatPrice(currentAuction.rule.ceilingPrice)}
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current price + Countdown */}
        <div className="text-center py-4 bg-gradient-to-b from-surface-secondary to-transparent rounded-2xl border border-surface-border">
          <div className="text-text-tertiary text-xs mb-2 flex items-center justify-center gap-1.5">
            <Crown className="w-3.5 h-3.5" />
            {currentAuction.status === 'pending' ? '起拍价' : '当前最高价'}
          </div>
          <motion.div
            className="text-brand-gradient text-5xl font-bold tracking-tight"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          >
            {formatPrice(currentAuction.currentPrice)}
          </motion.div>
          <div className="mt-4">
            {currentAuction.status === 'pending' ? (
              <Badge variant="outline" className="border-blue-500/30 text-blue-500 text-sm px-4 py-1">
                <Clock className="w-3.5 h-3.5 mr-1.5" />
                等待开始
              </Badge>
            ) : (
              <Countdown isUrgent={isUrgent} remainingMs={remainingMs} />
            )}
          </div>
        </div>

        <Separator className="bg-gray-100" />

        {/* Stats */}
        <div className="flex justify-around text-center">
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-xl bg-surface-secondary flex items-center justify-center">
              <Users className="w-5 h-5 text-text-secondary" />
            </div>
            <div className="text-text-tertiary text-[10px]">在线</div>
            <div className="text-text-primary font-semibold text-base">{onlineCount}</div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-xl bg-surface-secondary flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-brand" />
            </div>
            <div className="text-text-tertiary text-[10px]">参与</div>
            <div className="text-text-primary font-semibold text-base">{participantCount}</div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-xl bg-surface-secondary flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-text-tertiary text-[10px]">延时</div>
            <div className="text-amber-500 font-semibold text-xs">
              {currentAuction.rule ? `+${currentAuction.rule.extendSeconds}s ×${currentAuction.rule.maxExtensions}次` : '-'}
            </div>
          </div>
        </div>

        <Separator className="bg-gray-100" />

        {/* Bid Button (hidden on mobile, shown in bottom bar) */}
        <div className="max-md:hidden">
          <BidButton sessionId={currentAuction.sessionId} />
        </div>

        {/* Leaderboard */}
        <Leaderboard />
      </div>

      <EmotionToast />
    </ScrollArea>
  );
}
