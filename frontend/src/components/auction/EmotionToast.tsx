import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuctionStore } from '../../store/auctionStore';
import { formatPrice } from '../../lib/format';
import { Crown, Zap, Timer, Trophy, XCircle } from 'lucide-react';
import type { EmotionEvent } from '../../types/ws';

const TOAST_DURATION = 3000;

interface TypeStyle {
  icon: React.ReactNode;
  containerClass: string;
  textClass: string;
  borderClass: string;
  progressClass: string;
}

const typeStyles: Record<EmotionEvent['type'], TypeStyle> = {
  lead: {
    icon: <Crown className="w-6 h-6" />,
    containerClass: 'bg-white/95 backdrop-blur-md border-brand/40 shadow-lg',
    textClass: 'text-brand',
    borderClass: 'border-brand/30',
    progressClass: 'bg-brand/40',
  },
  overtaken: {
    icon: <Zap className="w-6 h-6" />,
    containerClass: 'bg-white/95 backdrop-blur-md border-amber-500/40 shadow-lg',
    textClass: 'text-amber-500',
    borderClass: 'border-amber-500/30',
    progressClass: 'bg-amber-500/40',
  },
  extended: {
    icon: <Timer className="w-6 h-6" />,
    containerClass: 'bg-white/95 backdrop-blur-md border-blue-500/40 shadow-lg',
    textClass: 'text-blue-500',
    borderClass: 'border-blue-500/30',
    progressClass: 'bg-blue-500/40',
  },
  ended: {
    icon: <Trophy className="w-6 h-6" />,
    containerClass: 'bg-white/95 backdrop-blur-md border-emerald-500/40 shadow-lg',
    textClass: 'text-emerald-500',
    borderClass: 'border-emerald-500/30',
    progressClass: 'bg-emerald-500/40',
  },
  cancelled: {
    icon: <XCircle className="w-6 h-6" />,
    containerClass: 'bg-white/95 backdrop-blur-md border-red-500/40 shadow-lg',
    textClass: 'text-red-500',
    borderClass: 'border-red-500/30',
    progressClass: 'bg-red-500/40',
  },
};

const titleText: Record<EmotionEvent['type'], string> = {
  lead: '领先！',
  overtaken: '被超越！',
  extended: '',
  ended: '竞拍结束',
  cancelled: '竞拍已取消',
};

function EmotionToastItem({ event }: { event: EmotionEvent }) {
  const [fading, setFading] = useState(false);
  const removeEmotion = useAuctionStore((s) => s.removeEmotion);

  useEffect(() => {
    const id = event.id;
    if (!id) return;
    const fadeTimer = setTimeout(() => setFading(true), TOAST_DURATION - 500);
    const removeTimer = setTimeout(() => removeEmotion(id), TOAST_DURATION);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [event.id, removeEmotion]);

  const style = typeStyles[event.type];

  return (
    <motion.div
      key={event.id}
      initial={{ opacity: 0, scale: 0.8, y: -20 }}
      animate={{ opacity: fading ? 0 : 1, scale: fading ? 0.95 : 1, y: fading ? -10 : 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`relative flex items-center gap-3 px-6 py-4 rounded-2xl border overflow-hidden ${style.containerClass}`}
    >
      <motion.div
        animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
        transition={{ repeat: 2, duration: 0.5 }}
        className={style.textClass}
      >
        {style.icon}
      </motion.div>
      <div>
        {event.type === 'extended' ? (
          <>
            <div className={`font-bold text-lg ${style.textClass}`}>
              延时 +{event.extendSeconds ?? 20}s
            </div>
            <div className="text-text-tertiary text-xs">竞拍时间已延长</div>
          </>
        ) : (
          <>
            <div className={`font-bold text-lg ${style.textClass}`}>
              {titleText[event.type]}
            </div>
            {(event.type === 'lead' || event.type === 'overtaken') &&
              event.amount != null && (
                <div className="text-text-secondary text-xs">
                  {formatPrice(event.amount)}
                </div>
              )}
          </>
        )}
      </div>
      {/* Progress bar — shrinks from left to right over TOAST_DURATION */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/5">
        <motion.div
          className={`h-full ${style.progressClass}`}
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: TOAST_DURATION / 1000, ease: 'linear' }}
        />
      </div>
    </motion.div>
  );
}

export default function EmotionToast() {
  const emotionEvents = useAuctionStore((s) => s.emotionEvents);

  if (emotionEvents.length === 0) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center gap-2">
      <AnimatePresence>
        {emotionEvents.map((event) => (
          <EmotionToastItem key={event.id} event={event} />
        ))}
      </AnimatePresence>
    </div>
  );
}
