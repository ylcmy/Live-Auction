import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuctionStore } from '../../store/auctionStore';
import { formatPrice } from '../../lib/format';
import type { EmotionEvent } from '../../types/ws';

interface TypeStyle {
  icon: string;
  iconAnim: Record<string, number | number[]>;
  iconAnimOpts: { repeat: number; duration: number };
  containerClass: string;
  textClass: string;
}

const typeStyles: Record<EmotionEvent['type'], TypeStyle> = {
  lead: {
    icon: '🎉',
    iconAnim: { scale: [1, 1.2, 1] },
    iconAnimOpts: { repeat: 2, duration: 0.5 },
    containerClass: 'bg-surface-elevated/95 backdrop-blur-sm border-brand/30 shadow-[0_0_20px_rgba(254,44,85,0.15)]',
    textClass: 'text-brand',
  },
  overtaken: {
    icon: '⚡',
    iconAnim: { rotate: [0, -15, 15, -15, 0] },
    iconAnimOpts: { repeat: 2, duration: 0.5 },
    containerClass: 'bg-surface-elevated/95 backdrop-blur-sm border-accent/30 shadow-[0_0_20px_rgba(37,244,238,0.15)]',
    textClass: 'text-accent',
  },
  extended: {
    icon: '⏱',
    iconAnim: { rotate: [0, -10, 10, -10, 0] },
    iconAnimOpts: { repeat: 2, duration: 0.5 },
    containerClass: 'bg-surface-elevated/95 backdrop-blur-sm border-accent/30',
    textClass: 'text-accent',
  },
  ended: {
    icon: '🏆',
    iconAnim: { scale: [1, 1.2, 1] },
    iconAnimOpts: { repeat: 2, duration: 0.5 },
    containerClass: 'bg-surface-elevated/95 backdrop-blur-sm border-success/30 shadow-[0_0_20px_rgba(0,209,102,0.15)]',
    textClass: 'text-success',
  },
  cancelled: {
    icon: '❌',
    iconAnim: { rotate: [0, -15, 15, -15, 0] },
    iconAnimOpts: { repeat: 2, duration: 0.5 },
    containerClass: 'bg-surface-elevated/95 backdrop-blur-sm border-brand/30',
    textClass: 'text-brand',
  },
};

const titleText: Record<EmotionEvent['type'], string> = {
  lead: '领先！',
  overtaken: '被超越！',
  extended: '',
  ended: '竞拍结束',
  cancelled: '竞拍已取消',
};

export default function EmotionToast() {
  const emotionEvent = useAuctionStore((s) => s.emotionEvent);
  const clearEmotion = () => useAuctionStore.setState({ emotionEvent: null });

  useEffect(() => {
    if (emotionEvent) {
      const timer = setTimeout(clearEmotion, 3000);
      return () => clearTimeout(timer);
    }
  }, [emotionEvent]);

  if (!emotionEvent) return null;

  const style = typeStyles[emotionEvent.type];

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <AnimatePresence>
        <motion.div
          key={emotionEvent.type}
          initial={{ opacity: 0, scale: 0.5, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${style.containerClass}`}
        >
          <motion.span
            animate={style.iconAnim}
            transition={style.iconAnimOpts}
            className="text-2xl"
          >
            {style.icon}
          </motion.span>
          <div>
            {emotionEvent.type === 'extended' ? (
              <>
                <div className={`font-bold text-lg ${style.textClass}`}>
                  延时 +{emotionEvent.extendSeconds ?? 20}s
                </div>
                <div className="text-text-tertiary text-xs">竞拍时间已延长</div>
              </>
            ) : (
              <>
                <div className={`font-bold text-lg ${style.textClass}`}>
                  {titleText[emotionEvent.type]}
                </div>
                {(emotionEvent.type === 'lead' || emotionEvent.type === 'overtaken') &&
                  emotionEvent.amount != null && (
                    <div className="text-text-secondary text-xs">
                      {formatPrice(emotionEvent.amount)}
                    </div>
                  )}
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
