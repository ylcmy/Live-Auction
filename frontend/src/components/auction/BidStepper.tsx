import { motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { formatPrice } from '../../lib/format';

interface BidStepperProps {
  value: number;
  min: number;
  step: number;
  onChange: (value: number) => void;
}

export default function BidStepper({ value, min, step, onChange }: BidStepperProps) {
  const isAtMin = value <= min;

  const handleDecrement = () => {
    if (!isAtMin) {
      onChange(Math.max(value - step, min));
    }
  };

  const handleIncrement = () => {
    onChange(value + step);
  };

  return (
    <div className="flex items-center justify-center gap-6 py-4">
      {/* Decrement button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handleDecrement}
        disabled={isAtMin}
        className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed bg-surface-secondary text-text-primary hover:bg-brand-50 active:bg-brand-100 border border-surface-border hover:border-brand/30"
      >
        <Minus className="w-5 h-5" strokeWidth={2.5} />
      </motion.button>

      {/* Amount display */}
      <div className="flex-1 text-center min-w-[140px]">
        <motion.div
          key={value}
          initial={{ scale: 1.1, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="text-brand-gradient text-4xl font-bold tracking-tight"
        >
          {formatPrice(value)}
        </motion.div>
        <div className="text-text-tertiary text-xs mt-1">
          每次加价 {formatPrice(step)}
        </div>
      </div>

      {/* Increment button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handleIncrement}
        className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 bg-brand text-white hover:bg-brand-hover active:bg-brand shadow-glow-brand border-0"
      >
        <Plus className="w-5 h-5" strokeWidth={2.5} />
      </motion.button>
    </div>
  );
}
