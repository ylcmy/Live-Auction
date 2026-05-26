import { motion } from 'framer-motion';
import { formatMs } from '../../lib/format';

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
      <motion.div
        animate={isUrgent ? { scale: [1, 1.05, 1] } : {}}
        transition={isUrgent ? { repeat: Infinity, duration: 0.5 } : {}}
        className={`font-mono text-4xl font-bold tracking-wider ${
          isUrgent ? 'text-brand shadow-glow-brand' : 'text-text-primary'
        }`}
      >
        <span>{minutes}:{seconds}</span>
        <span className="text-xl">.{millis}</span>
      </motion.div>
      {isUrgent && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-brand text-xs mt-1"
        >
          ⚡ 即将结束
        </motion.p>
      )}
    </div>
  );
}
