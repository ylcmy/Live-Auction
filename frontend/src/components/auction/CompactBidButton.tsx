import { useState } from 'react';
import { motion } from 'framer-motion';
import { useBid } from '../../hooks/useBid';
import { useAuctionStore } from '../../store/auctionStore';
import { formatPrice } from '../../lib/format';
import { Zap } from 'lucide-react';

interface Props {
  sessionId: number | null;
}

export default function CompactBidButton({ sessionId }: Props) {
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
    <motion.button
      onClick={handleClick}
      disabled={disabled}
      whileTap={{ scale: 0.94 }}
      animate={isPressed ? { scale: [1, 0.95, 1.02, 1] } : {}}
      transition={{ duration: 0.3 }}
      className="relative flex items-center justify-center gap-1.5 h-11 px-5 rounded-xl bg-gradient-to-r from-brand via-brand-hover to-brand text-white font-bold text-sm shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-brand/35 disabled:opacity-40 disabled:cursor-not-allowed border-0 overflow-hidden group whitespace-nowrap"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      <Zap className="w-3.5 h-3.5 relative" />
      <span className="relative">出价 {formatPrice(nextBid)}</span>
    </motion.button>
  );
}
