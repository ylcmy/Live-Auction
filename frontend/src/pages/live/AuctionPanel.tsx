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

export default function AuctionPanel() {
  const {
    currentAuction,
    onlineCount,
    participantCount,
    countdown: countdownSync,
    extendMs,
  } = useAuctionStore();
  const { remainingMs, isUrgent, sync, extend } = useCountdown();

  // Sync countdown when server sends countdown:sync
  useEffect(() => {
    if (countdownSync && countdownSync.remainingMs > 0) {
      sync(countdownSync);
    }
  }, [countdownSync, sync]);

  // Extend countdown when server sends countdown:extend
  useEffect(() => {
    if (extendMs && extendMs > 0) {
      extend(extendMs);
    }
  }, [extendMs, extend]);

  if (!currentAuction) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center">
        <div className="text-4xl mb-3">📦</div>
        <p className="text-text-secondary text-lg">等待主播发起竞拍</p>
        <p className="text-text-tertiary text-sm mt-2">🔥 {onlineCount} 人在线</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Participant count badge */}
        <div className="text-center text-sm">
          <Badge variant="outline" className="border-brand/30 text-brand">
            🔥 {participantCount} 人正在竞拍
          </Badge>
        </div>

        {/* Product info card */}
        <Card className="bg-surface-elevated border-white/10">
          <CardContent className="p-4">
            <div className="flex gap-3">
              {currentAuction.product.imageUrl ? (
                <img
                  src={currentAuction.product.imageUrl}
                  alt={currentAuction.product.name}
                  className="w-16 h-16 rounded-lg object-cover bg-surface-secondary"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-surface-secondary flex items-center justify-center text-2xl">
                  📦
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold truncate">{currentAuction.product.name}</h3>
                {currentAuction.product.description && (
                  <p className="text-text-tertiary text-xs mt-1 line-clamp-2">{currentAuction.product.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {currentAuction.rule && (
                    <>
                      <Badge variant="secondary" className="text-[10px] bg-surface-secondary text-text-tertiary border-0">
                        起拍 ¥{formatPrice(currentAuction.rule.startPrice)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] bg-surface-secondary text-text-tertiary border-0">
                        加价 ¥{formatPrice(currentAuction.rule.bidIncrement)}
                      </Badge>
                      {currentAuction.rule.ceilingPrice && currentAuction.rule.ceilingPrice > 0 && (
                        <Badge variant="secondary" className="text-[10px] bg-surface-secondary text-text-tertiary border-0">
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
        <div className="text-center py-2">
          <div className="text-text-tertiary text-xs mb-1">
            {currentAuction.status === 'pending' ? '起拍价' : '当前出价'}
          </div>
          <div className="text-brand text-4xl font-bold tracking-tight">
            {formatPrice(currentAuction.currentPrice)}
          </div>
          <div className="mt-2">
            {currentAuction.status === 'pending' ? (
              <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-sm">
                等待开始
              </Badge>
            ) : (
              <Countdown isUrgent={isUrgent} remainingMs={remainingMs} />
            )}
          </div>
        </div>

        <Separator className="bg-white/5" />

        {/* Stats */}
        <div className="flex justify-around text-center text-xs">
          <div>
            <div className="text-text-secondary mb-0.5">🔥 在线</div>
            <div className="text-white font-semibold text-base">{onlineCount}</div>
          </div>
          <div>
            <div className="text-text-secondary mb-0.5">💰 参与</div>
            <div className="text-white font-semibold text-base">{participantCount}</div>
          </div>
          <div>
            <div className="text-text-secondary mb-0.5">⚡ 延时</div>
            <div className="text-accent font-semibold text-xs">
              {currentAuction.rule ? `+${currentAuction.rule.extendSeconds}s ×${currentAuction.rule.maxExtensions}次` : '-'}
            </div>
          </div>
        </div>

        <Separator className="bg-white/5" />

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
