import { motion, AnimatePresence } from 'framer-motion';
import { useAuctionStore } from '../../store/auctionStore';
import { formatPrice } from '../../lib/format';
import { ScrollArea } from '../../design-system/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '../../design-system/components/ui/avatar';
import { Badge } from '../../design-system/components/ui/badge';
import { Crown, Medal, Award } from 'lucide-react';

export default function Leaderboard() {
  const { leaderboard, myRank } = useAuctionStore();

  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-6">
        <div className="w-12 h-12 rounded-full bg-surface-secondary flex items-center justify-center mx-auto mb-3">
          <Award className="w-6 h-6 text-text-tertiary" />
        </div>
        <p className="text-text-tertiary text-sm">暂无出价，快来抢第一！</p>
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-4 h-4 text-amber-500" />;
      case 2:
        return <Medal className="w-4 h-4 text-gray-400" />;
      case 3:
        return <Medal className="w-4 h-4 text-amber-600" />;
      default:
        return <span className="text-xs font-bold text-text-tertiary">#{rank}</span>;
    }
  };

  const getRankStyle = (rank: number, isCurrentUser: boolean) => {
    if (isCurrentUser) {
      return 'bg-brand-50 border-brand/30';
    }
    switch (rank) {
      case 1:
        return 'bg-amber-50 border-amber-200';
      case 2:
        return 'bg-gray-50 border-gray-200';
      case 3:
        return 'bg-amber-50/50 border-amber-200/50';
      default:
        return 'bg-surface-secondary border-surface-border';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 py-2">
        <span className="text-text-secondary text-xs font-medium flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5" />
          出价排行
        </span>
        <span className="text-text-tertiary text-[10px]">
          {leaderboard.length} 人参与
        </span>
      </div>
      <ScrollArea className="max-h-60">
        <div className="space-y-1.5 pr-1">
          <AnimatePresence>
            {leaderboard.slice(0, 10).map((entry) => (
              <motion.div
                key={entry.userId}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm border ${getRankStyle(entry.rank, entry.isCurrentUser)}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 flex items-center justify-center">
                    {getRankIcon(entry.rank)}
                  </div>
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className={`text-[10px] ${
                      entry.isCurrentUser
                        ? 'bg-brand/20 text-brand'
                        : 'bg-surface-secondary text-text-secondary'
                    }`}>
                      {entry.userNickname.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-1.5">
                    <span className={`truncate text-sm ${entry.isCurrentUser ? 'text-brand font-medium' : 'text-text-secondary'}`}>
                      {entry.userNickname}
                    </span>
                    {entry.isCurrentUser && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 border-brand/30 text-brand">
                        你
                      </Badge>
                    )}
                  </div>
                </div>
                <span className={`font-semibold text-sm ${entry.isCurrentUser ? 'text-brand' : 'text-text-primary'}`}>
                  {formatPrice(entry.amount)}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>
      {myRank && myRank > 10 && (
        <div className="px-3 py-2.5 rounded-xl bg-brand-50 border border-brand/30 text-sm text-center">
          <span className="text-brand font-medium">你的排名: #{myRank}</span>
        </div>
      )}
    </div>
  );
}
