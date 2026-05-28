import { useState } from 'react';
import { motion } from 'framer-motion';
import { useBid } from '../../hooks/useBid';
import { useAuctionStore } from '../../store/auctionStore';
import { formatPrice } from '../../lib/format';
import { Gavel, Zap } from 'lucide-react';

interface Props { sessionId: number | null; }

export default function BidButton({ sessionId }: Props) {
  const { submitBid } = useBid(sessionId);
  const currentAuction = useAuctionStore((s) => s.currentAuction);
  const [isPressed, setIsPressed] = useState(false);

  if (!currentAuction || !currentAuction.rule) return null;

  const currentPrice = Number(currentAuction.currentPrice) || 0;
  const bidIncrement = Number(currentAuction.rule.bidIncrement) || 1;
  const nextBid = currentPrice + bidIncrement;
  const ceilingPrice = currentAuction.rule.ceilingPrice ?? null;
  const overCeiling = ceilingPrice !== null && nextBid > ceilingPrice;
  const disabled = overCeiling || currentAuction.status !== 'active';

  const handleClick = () => {
    if (disabled) return;
    setIsPressed(true);
    submitBid();
    setTimeout(() => setIsPressed(false), 300);
  };

  return (
    <motion.div
      whileTap={{ scale: 0.96 }}
      animate={isPressed ? { scale: [1, 0.95, 1.05, 1] } : {}}
      transition={{ duration: 0.3 }}
    >
      <button
        onClick={handleClick}
        disabled={disabled}
        className="relative w-full h-auto py-4 rounded-2xl bg-gradient-to-r from-brand via-brand-hover to-brand text-white font-bold text-lg shadow-glow-brand hover:shadow-glow-brand-lg disabled:opacity-40 disabled:cursor-not-allowed border-0 overflow-hidden group"
      >
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

        <div className="relative flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span className="text-xs opacity-90 font-medium tracking-wide">
              加价幅度 {formatPrice(currentAuction.rule.bidIncrement)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Gavel className="w-5 h-5" />
            <span className="text-xl font-bold">出价 {formatPrice(nextBid)}</span>
          </div>
        </div>
      </button>
    </motion.div>
  );
}
