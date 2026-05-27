import { useState, useEffect, useRef, useCallback } from 'react';
import type { CountdownSync } from '../types/ws';

export function useCountdown(initialMs?: number) {
  const [remainingMs, setRemainingMs] = useState(initialMs || 0);
  const [isUrgent, setIsUrgent] = useState(false);
  const endTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const [syncCounter, setSyncCounter] = useState(0);

  useEffect(() => {
    if (endTimeRef.current === null) return;

    const tick = () => {
      const remaining = Math.max(0, endTimeRef.current! - Date.now());
      setRemainingMs(remaining);
      setIsUrgent(remaining < 10000);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [syncCounter]);

  const sync = useCallback((cs: CountdownSync) => {
    endTimeRef.current = cs.serverTime + cs.remainingMs;
    setSyncCounter((c) => c + 1);
  }, []);

  const extend = useCallback((newRemainingMs: number) => {
    endTimeRef.current = Date.now() + newRemainingMs;
    setSyncCounter((c) => c + 1);
  }, []);

  return { remainingMs, isUrgent, sync, extend };
}
