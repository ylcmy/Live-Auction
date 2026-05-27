import { motion } from 'framer-motion';
import { formatMs } from '../../lib/format';
import { Timer } from 'lucide-react';

interface Props {
  isUrgent: boolean;
  remainingMs: number;
}

export default function Countdown({ isUrgent, remainingMs }: Props) {
  const display = remainingMs > 0 ? formatMs(remainingMs) : '竞拍结束';
  const [minutes, rest] = display.split(':');
  const [seconds, millis] = (rest || '00.000').split('.');

  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2 mb-2">
        <Timer className={`w-4 h-4 ${isUrgent ? 'text-red-500' : 'text-brand'}`} />
        <span className="text-text-tertiary text-xs">
          {isUrgent ? '即将结束' : '距竞拍结束仅剩'}
        </span>
      </div>
      <motion.div
        animate={isUrgent ? { scale: [1, 1.05, 1] } : {}}
        transition={isUrgent ? { repeat: Infinity, duration: 0.5 } : {}}
        className={`font-mono text-4xl font-bold tracking-wider ${
          isUrgent ? 'text-red-500' : 'text-brand-gradient'
        }`}
      >
        <span className="inline-flex items-center gap-1">
          <span className={`inline-flex items-center justify-center w-10 h-12 rounded-lg ${
            isUrgent ? 'bg-red-50' : 'bg-brand-50'
          }`}>
            {minutes}
          </span>
          <span className="text-text-tertiary">:</span>
          <span className={`inline-flex items-center justify-center w-10 h-12 rounded-lg ${
            isUrgent ? 'bg-red-50' : 'bg-brand-50'
          }`}>
            {seconds}
          </span>
          <span className="text-text-tertiary">.</span>
          <span className={`inline-flex items-center justify-center w-12 h-12 rounded-lg text-2xl ${
            isUrgent ? 'bg-red-50' : 'bg-brand-50'
          }`}>
            {millis}
          </span>
        </span>
      </motion.div>
      {isUrgent && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-red-500 text-xs mt-2 flex items-center justify-center gap-1"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          最后机会，立即出价
        </motion.p>
      )}
    </div>
  );
}
