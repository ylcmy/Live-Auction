import { useEffect, useRef, useCallback } from 'react';

/**
 * Named timer management hook.
 * Provides setTimer/clearTimer/clearAllTimers with automatic cleanup on unmount.
 */
export function useTimers() {
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const setTimer = useCallback((key: string, callback: () => void, delay: number) => {
    const existing = timersRef.current.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      callback();
      timersRef.current.delete(key);
    }, delay);
    timersRef.current.set(key, timer);
  }, []);

  const clearTimer = useCallback((key: string) => {
    const timer = timersRef.current.get(key);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(key);
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  return { setTimer, clearTimer, clearAllTimers };
}
