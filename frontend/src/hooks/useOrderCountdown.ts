import { useState, useEffect } from 'react';

export function useOrderCountdown(targetDate: string | null) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();

    const update = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setRemaining('已超时');
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}分${s}秒`);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return remaining;
}
