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
  it('should initialize remainingMs to 0', () => {
    const { result } = renderHook(() => useCountdown());
    expect(result.current.remainingMs).toBe(0);
  });

  it('should set remainingMs via sync', async () => {
    const { result } = renderHook(() => useCountdown());
    act(() => {
      result.current.sync({ sessionId: 1, remainingMs: 30000, serverTime: Date.now() });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.remainingMs).toBeGreaterThan(29000);
  });

  it('should initialize isUrgent as false', () => {
    const { result } = renderHook(() => useCountdown());
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
    const { result } = renderHook(() => useCountdown());
    expect(result.current).toHaveProperty('remainingMs');
    expect(result.current).toHaveProperty('isUrgent');
    expect(result.current).toHaveProperty('sync');
    expect(result.current).toHaveProperty('extend');
    expect(typeof result.current.sync).toBe('function');
    expect(typeof result.current.extend).toBe('function');
  });

  describe('毫秒精度', () => {
    it('应精确跟踪到毫秒级别', async () => {
      const { result } = renderHook(() => useCountdown(0));
      const startMs = 15000;
      act(() => {
        result.current.sync({ sessionId: 1, remainingMs: startMs, serverTime: Date.now() });
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // 首次 tick 后 remainingMs 应接近初始值
      expect(result.current.remainingMs).toBeGreaterThan(14900);
      expect(result.current.remainingMs).toBeLessThanOrEqual(startMs);

      // 前进 1234ms，验证精度
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1234);
      });

      const remaining = result.current.remainingMs;
      // 容差 +/-50ms (fake timers 非精确实时时钟)
      expect(remaining).toBeGreaterThan(startMs - 1234 - 50);
      expect(remaining).toBeLessThan(startMs - 1234 + 50);
    });

    it('sync 后 remainingMs 应包含毫秒精度（非整秒截断）', async () => {
      const { result } = renderHook(() => useCountdown(0));
      const preciseMs = 7654;
      act(() => {
        result.current.sync({ sessionId: 1, remainingMs: preciseMs, serverTime: Date.now() });
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // 不应该是整秒的倍数（如 7000），说明保留了毫秒
      const remaining = result.current.remainingMs;
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(preciseMs);
    });

    it('应在 0ms 时精确停止，不出现负值', async () => {
      const { result } = renderHook(() => useCountdown(0));
      act(() => {
        result.current.sync({ sessionId: 1, remainingMs: 100, serverTime: Date.now() });
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      expect(result.current.remainingMs).toBe(0);
      expect(result.current.remainingMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('跳秒边界', () => {
    it('在 10001ms 到 9999ms 跨越 10s 边界时 isUrgent 应切换为 true', async () => {
      const { result } = renderHook(() => useCountdown(0));

      // 10001ms: 刚好不在 urgent 范围
      act(() => {
        result.current.sync({ sessionId: 1, remainingMs: 10001, serverTime: Date.now() });
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // 前进使 remaining 降到 10s 以下
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      expect(result.current.remainingMs).toBeLessThan(10000);
      expect(result.current.isUrgent).toBe(true);
    });

    it('isUrgent 在剩余 10001ms 时应为 false', async () => {
      const { result } = renderHook(() => useCountdown(0));
      act(() => {
        result.current.sync({ sessionId: 1, remainingMs: 12000, serverTime: Date.now() });
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // 还有 ~12s，不应 urgent
      expect(result.current.isUrgent).toBe(false);
    });

    it('isUrgent 在跨越 0 边界时应切换回 false', async () => {
      const { result } = renderHook(() => useCountdown(0));
      act(() => {
        result.current.sync({ sessionId: 1, remainingMs: 5000, serverTime: Date.now() });
      });

      // 先确认 urgent
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.isUrgent).toBe(true);

      // 前进到归零
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });

      expect(result.current.remainingMs).toBe(0);
      expect(result.current.isUrgent).toBe(false);
    });

    it('sync 重置后 isUrgent 应正确反映新的时间', async () => {
      const { result } = renderHook(() => useCountdown(0));

      // 先设一个紧急时间
      act(() => {
        result.current.sync({ sessionId: 1, remainingMs: 5000, serverTime: Date.now() });
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.isUrgent).toBe(true);

      // sync 重置为充裕时间
      act(() => {
        result.current.sync({ sessionId: 1, remainingMs: 60000, serverTime: Date.now() });
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.isUrgent).toBe(false);
      expect(result.current.remainingMs).toBeGreaterThan(59000);
    });
  });
});
