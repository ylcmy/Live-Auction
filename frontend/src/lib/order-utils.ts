import { useState, useEffect } from 'react';

export const ORDER_STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending_payment: { label: '待付款', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  paid: { label: '已付款', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  completed: { label: '已完成', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  cancelled: { label: '已取消', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  expired: { label: '已超时', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

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
