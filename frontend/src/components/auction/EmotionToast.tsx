import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuctionStore } from '../../store/auctionStore';
import { formatPrice } from '../../lib/format';
import { Crown, Zap, Timer, Trophy, XCircle } from 'lucide-react';
import type { EmotionEvent } from '../../types/ws';

interface TypeStyle {
  icon: React.ReactNode;
  containerClass: string;
  textClass: string;
  borderClass: string;
}

const typeStyles: Record<EmotionEvent['type'], TypeStyle> = {
  lead: {
    icon: <Crown className="w-6 h-6" />,
    containerClass: 'bg-white/95 backdrop-blur-md border-brand/40 shadow-lg',
    textClass: 'text-brand',
    borderClass: 'border-brand/30',
  },
  overtaken: {
    icon: <Zap className="w-6 h-6" />,
    containerClass: 'bg-white/95 backdrop-blur-md border-amber-500/40 shadow-lg',
    textClass: 'text-amber-500',
    borderClass: 'border-amber-500/30',
  },
  extended: {
    icon: <Timer className="w-6 h-6" />,
    containerClass: 'bg-white/95 backdrop-blur-md border-blue-500/40 shadow-lg',
    textClass: 'text-blue-500',
    borderClass: 'border-blue-500/30',
  },
  ended: {
    icon: <Trophy className="w-6 h-6" />,
    containerClass: 'bg-white/95 backdrop-blur-md border-emerald-500/40 shadow-lg',
    textClass: 'text-emerald-500',
    borderClass: 'border-emerald-500/30',
  },
  cancelled: {
    icon: <XCircle className="w-6 h-6" />,
    containerClass: 'bg-white/95 backdrop-blur-md border-red-500/40 shadow-lg',
    textClass: 'text-red-500',
    borderClass: 'border-red-500/30',
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
          className={`flex items-center gap-3 px-6 py-4 rounded-2xl border ${style.containerClass}`}
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
            transition={{ repeat: 2, duration: 0.5 }}
            className={style.textClass}
          >
            {style.icon}
          </motion.div>
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
