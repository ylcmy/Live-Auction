import { motion, AnimatePresence } from 'framer-motion';
import { Crown, TrendingUp, AlertTriangle } from 'lucide-react';
import { formatPrice } from '../../lib/format';

interface BidHintProps {
  bidAmount: number;
  currentPrice: number;
  isLeading: boolean;
}

export default function BidHint({ bidAmount, currentPrice, isLeading }: BidHintProps) {
  const diff = bidAmount - currentPrice;

  return (
    <div className="h-8 flex items-center justify-center">
      <AnimatePresence mode="wait">
        {isLeading ? (
          <motion.div
            key="leading"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5 text-brand"
          >
            <Crown className="w-4 h-4" />
            <span className="text-sm font-medium">当前您已是最高价</span>
          </motion.div>
        ) : diff > 0 ? (
          <motion.div
            key="above"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5 text-amber-500"
          >
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">
              高于当前价 {formatPrice(diff)} 元
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="at-price"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5 text-text-tertiary text-sm"
          >
            <AlertTriangle className="w-4 h-4" />
            出价不低于当前价
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
