import { motion, AnimatePresence } from 'framer-motion';
import { useAuctionStore } from '../../store/auctionStore';
import { formatPrice } from '../../lib/format';
import { ScrollArea } from '../../design-system/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '../../design-system/components/ui/avatar';
import { Badge } from '../../design-system/components/ui/badge';

export default function Leaderboard() {
  const { leaderboard, myRank } = useAuctionStore();

  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-text-tertiary text-sm">暂无出价，快来抢第一！</p>
      </div>
    );
  }

  const rankMedals = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1 py-1 text-xs text-text-tertiary">
        <span>排名</span><span>出价者</span><span>金额</span>
      </div>
      <ScrollArea className="max-h-60">
        <div className="space-y-1 pr-1">
          <AnimatePresence>
            {leaderboard.slice(0, 10).map((entry) => (
              <motion.div
                key={entry.userId}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                  entry.isCurrentUser
                    ? 'bg-brand/10 border border-brand/30'
                    : 'bg-surface-elevated border border-white/5'
                }`}
              >
                <span className="w-8 text-center font-semibold">
                  {entry.rank <= 3 ? rankMedals[entry.rank - 1] : `#${entry.rank}`}
                </span>
                <div className="flex-1 flex items-center gap-2 min-w-0 ml-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px] bg-surface-secondary text-text-secondary">
                      {entry.userNickname.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className={`truncate text-sm ${entry.isCurrentUser ? 'text-brand font-medium' : 'text-text-secondary'}`}>
                    {entry.userNickname}
                  </span>
                  {entry.isCurrentUser && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 border-brand/30 text-brand">你</Badge>
                  )}
                </div>
                <span className={`font-semibold text-sm ${entry.isCurrentUser ? 'text-brand' : 'text-white'}`}>
                  {formatPrice(entry.amount)}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>
      {myRank && myRank > 10 && (
        <div className="px-3 py-2 rounded-lg bg-brand/10 border border-brand/30 text-sm mt-2 text-center">
          <span className="text-brand">你的排名: #{myRank}</span>
        </div>
      )}
    </div>
  );
}
