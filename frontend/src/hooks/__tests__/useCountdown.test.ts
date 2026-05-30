import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountdown } from '../useCountdown';

// requestAnimationFrame in jsdom delegates to setTimeout(fn, 0) which
// doesn't play well with vi.useFakeTimers(). We polyfill it with a
// plain setTimeout so that advanceTimersByTimeAsync drives the countdown
// deterministically.
beforeEach(() => {
  vi.useFakeTimers();
  let rafId = 1;
  const rafMap = new Map<number, ReturnType<typeof setTimeout>>();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = rafId++;
    const timer = setTimeout(() => cb(performance.now()), 0);
    rafMap.set(id, timer);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    const timer = rafMap.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      rafMap.delete(id);
    }
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useCountdown', () => {
  it('should initialize remainingMs to initialMs', () => {
    const { result } = renderHook(() => useCountdown(30000));
    expect(result.current.remainingMs).toBe(30000);
  });

  it('should default remainingMs to 0 when initialMs is not provided', () => {
    const { result } = renderHook(() => useCountdown());
    expect(result.current.remainingMs).toBe(0);
  });

  it('should initialize isUrgent as false', () => {
    const { result } = renderHook(() => useCountdown(30000));
    expect(result.current.isUrgent).toBe(false);
  });

  it('should set remainingMs from sync and decrement over time', async () => {
    const { result } = renderHook(() => useCountdown(0));

    act(() => {
      result.current.sync({ sessionId: 1, remainingMs: 20000, serverTime: Date.now() });
    });

    // After sync, remainingMs is set via setRemainingMs in the callback
    // but the effect (which reads endTimeRef) hasn't fired its first tick yet.
    // Advance one microtask/tick to let the RAF-based countdown begin.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Now the first RAF callback has run — remainingMs should still be ~20000
    expect(result.current.remainingMs).toBeGreaterThan(19000);

    // Advance 5 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.remainingMs).toBeLessThanOrEqual(15000);
    expect(result.current.remainingMs).toBeGreaterThan(10000);
  });

  it('should stop at zero and not go negative', async () => {
    const { result } = renderHook(() => useCountdown(0));
    act(() => {
      result.current.sync({ sessionId: 1, remainingMs: 2000, serverTime: Date.now() });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.remainingMs).toBe(0);
  });

  it('should set isUrgent to true when remainingMs falls below 10s', async () => {
    const { result } = renderHook(() => useCountdown(0));
    expect(result.current.isUrgent).toBe(false);

    act(() => {
      result.current.sync({ sessionId: 1, remainingMs: 11000, serverTime: Date.now() });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.isUrgent).toBe(true);
  });

  it('should set isUrgent to false when remainingMs reaches zero', async () => {
    const { result } = renderHook(() => useCountdown(0));
    act(() => {
      result.current.sync({ sessionId: 1, remainingMs: 5000, serverTime: Date.now() });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(result.current.isUrgent).toBe(false);
  });

  it('should reset remainingMs when sync is called with new values', async () => {
    const { result } = renderHook(() => useCountdown(0));

    act(() => {
      result.current.sync({ sessionId: 1, remainingMs: 30000, serverTime: Date.now() });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.remainingMs).toBeLessThanOrEqual(26000);
    expect(result.current.remainingMs).toBeGreaterThan(20000);

    // Re-sync with fresh 60s
    act(() => {
      result.current.sync({ sessionId: 1, remainingMs: 60000, serverTime: Date.now() });
    });

    // Allow the new effect tick to start
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.remainingMs).toBeGreaterThan(59000);
  });

  it('should extend countdown with new remainingMs', async () => {
    const { result } = renderHook(() => useCountdown(0));
    act(() => {
      result.current.sync({ sessionId: 1, remainingMs: 5000, serverTime: Date.now() });
    });

    act(() => {
      result.current.extend(15000);
    });

    // Allow the new effect tick to start
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.remainingMs).toBeGreaterThan(14000);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(result.current.remainingMs).toBeLessThanOrEqual(12000);
    expect(result.current.remainingMs).toBeGreaterThan(8000);
  });

  it('should return all expected properties', () => {
    const { result } = renderHook(() => useCountdown(10000));
    expect(result.current).toHaveProperty('remainingMs');
    expect(result.current).toHaveProperty('isUrgent');
    expect(result.current).toHaveProperty('sync');
    expect(result.current).toHaveProperty('extend');
    expect(typeof result.current.sync).toBe('function');
    expect(typeof result.current.extend).toBe('function');
  });
});
