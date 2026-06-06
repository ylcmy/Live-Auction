import { useState, useEffect, useRef, useCallback } from 'react';
import type { CountdownSync } from '../types/ws';

export interface UseCountdownOptions {
  onTick?: (remainingMs: number, isUrgent: boolean) => void;
}

export function useCountdown(options?: UseCountdownOptions) {
  const [remainingMs, setRemainingMs] = useState(0);
  const [isUrgent, setIsUrgent] = useState(false);
  const endTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const [syncCounter, setSyncCounter] = useState(0);

  useEffect(() => {
    if (endTimeRef.current === null) return;

    const tick = () => {
      const remaining = Math.max(0, endTimeRef.current! - Date.now());
      setRemainingMs(remaining);
      const urgent = remaining < 10000 && remaining > 0;
      setIsUrgent(urgent);
      options?.onTick?.(remaining, urgent);
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
