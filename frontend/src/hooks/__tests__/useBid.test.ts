import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBid } from '../useBid';

const { mockEmit, mockGetSocket, mockGenerateIdempotencyKey, mockSocketOn, mockSocketOff } = vi.hoisted(() => ({
  mockEmit: vi.fn(),
  mockSocketOn: vi.fn(),
  mockSocketOff: vi.fn(),
  mockGetSocket: vi.fn(() => ({ emit: mockEmit, on: vi.fn(), off: vi.fn() })),
  mockGenerateIdempotencyKey: vi.fn(() => 'test-key-123'),
}));

vi.mock('@/services/socket', () => ({
  getSocket: mockGetSocket,
}));

vi.mock('@/lib/idempotency', () => ({
  generateIdempotencyKey: mockGenerateIdempotencyKey,
}));

describe('useBid', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockGetSocket.mockReturnValue({ emit: mockEmit, on: vi.fn(), off: vi.fn() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return a submitBid function', () => {
    const { result } = renderHook(() => useBid(1));
    expect(typeof result.current.submitBid).toBe('function');
  });

  it('should not call emit when sessionId is null', () => {
    const { result } = renderHook(() => useBid(null));
    act(() => { result.current.submitBid(100); });
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('should not call emit when socket is null', () => {
    mockGetSocket.mockReturnValue(null);
    const { result } = renderHook(() => useBid(1));
    act(() => { result.current.submitBid(100); });
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('should emit bid:submit with sessionId, amount, and idempotencyKey', () => {
    const { result } = renderHook(() => useBid(42));
    act(() => { result.current.submitBid(200); });
    expect(mockGenerateIdempotencyKey).toHaveBeenCalled();
    expect(mockEmit).toHaveBeenCalledWith('bid:submit', {
      sessionId: 42,
      amount: 200,
      idempotencyKey: 'test-key-123',
    });
  });

  it('should emit bid:submit without amount when not provided', () => {
    const { result } = renderHook(() => useBid(1));
    act(() => { result.current.submitBid(); });
    expect(mockEmit).toHaveBeenCalledWith('bid:submit', {
      sessionId: 1,
      amount: undefined,
      idempotencyKey: 'test-key-123',
    });
  });

  it('should debounce rapid calls within 300ms window', () => {
    const { result } = renderHook(() => useBid(1));
    act(() => { result.current.submitBid(100); });
    act(() => { result.current.submitBid(110); });
    act(() => { result.current.submitBid(120); });
    expect(mockEmit).toHaveBeenCalledTimes(1);
  });

  it('should allow new bid after 300ms debounce expires', () => {
    const { result } = renderHook(() => useBid(1));
    act(() => { result.current.submitBid(100); });
    act(() => { vi.advanceTimersByTime(300); });
    act(() => { result.current.submitBid(110); });
    expect(mockEmit).toHaveBeenCalledTimes(2);
  });

  it('should generate a new idempotency key for each accepted bid', () => {
    mockGenerateIdempotencyKey
      .mockReturnValueOnce('key-1')
      .mockReturnValueOnce('key-2');
    const { result } = renderHook(() => useBid(1));

    act(() => { result.current.submitBid(100); });
    expect(mockEmit).toHaveBeenCalledWith('bid:submit', expect.objectContaining({ idempotencyKey: 'key-1' }));

    act(() => { vi.advanceTimersByTime(300); });
    act(() => { result.current.submitBid(110); });
    expect(mockEmit).toHaveBeenCalledWith('bid:submit', expect.objectContaining({ idempotencyKey: 'key-2' }));
  });

  describe('重连与实时出价状态合并 (FR-021)', () => {
    it('重连后应能继续正常出价', () => {
      const { result } = renderHook(() => useBid(50));

      // 第一次出价
      act(() => { result.current.submitBid(100); });
      expect(mockEmit).toHaveBeenCalledWith('bid:submit', {
        sessionId: 50,
        amount: 100,
        idempotencyKey: 'test-key-123',
      });

      // 等 debounce 结束
      act(() => { vi.advanceTimersByTime(300); });

      // 模拟重连：socket 实例更新
      const newMockEmit = vi.fn();
      mockGetSocket.mockReturnValue({ emit: newMockEmit, on: vi.fn(), off: vi.fn() });

      // 重连后出价应使用新 socket
      act(() => { result.current.submitBid(110); });
      expect(newMockEmit).toHaveBeenCalledWith('bid:submit', {
        sessionId: 50,
        amount: 110,
        idempotencyKey: 'test-key-123',
      });
    });

    it('重连后 sessionId 变化应使用新 sessionId 出价', () => {
      const { result, rerender } = renderHook(
        ({ sid }) => useBid(sid),
        { initialProps: { sid: 30 } },
      );

      act(() => { result.current.submitBid(200); });
      expect(mockEmit).toHaveBeenCalledWith('bid:submit', expect.objectContaining({
        sessionId: 30,
        amount: 200,
      }));

      // 等 debounce
      act(() => { vi.advanceTimersByTime(300); });

      // sessionId 变更
      rerender({ sid: 40 });
      act(() => { result.current.submitBid(250); });
      expect(mockEmit).toHaveBeenCalledWith('bid:submit', expect.objectContaining({
        sessionId: 40,
        amount: 250,
      }));
    });

    it('快速连续出价应被 debounce 合并为一次', () => {
      const { result } = renderHook(() => useBid(60));

      act(() => { result.current.submitBid(100); });
      act(() => { result.current.submitBid(110); });
      act(() => { result.current.submitBid(120); });

      // 只有第一次应该实际 emit
      expect(mockEmit).toHaveBeenCalledTimes(1);
      expect(mockEmit).toHaveBeenCalledWith('bid:submit', expect.objectContaining({
        amount: 100,
      }));
    });

    it('bidError 应通过 bid:rejected 事件设置', () => {
      let bidRejectedHandler: ((data: { sessionId: number; reason: string }) => void) | undefined;
      const mockSocket = {
        emit: mockEmit,
        on: vi.fn((event: string, handler: unknown) => {
          if (event === 'bid:rejected') bidRejectedHandler = handler as typeof bidRejectedHandler;
        }),
        off: vi.fn(),
      };
      mockGetSocket.mockReturnValue(mockSocket);

      const { result } = renderHook(() => useBid(70));

      // 模拟 bid:rejected 事件
      act(() => {
        bidRejectedHandler!({ sessionId: 70, reason: '出价过低' });
      });

      expect(result.current.bidError).toBe('出价过低');
    });

    it('clearBidError 应清除错误状态', () => {
      let bidRejectedHandler: ((data: { sessionId: number; reason: string }) => void) | undefined;
      const mockSocket = {
        emit: mockEmit,
        on: vi.fn((event: string, handler: unknown) => {
          if (event === 'bid:rejected') bidRejectedHandler = handler as typeof bidRejectedHandler;
        }),
        off: vi.fn(),
      };
      mockGetSocket.mockReturnValue(mockSocket);

      const { result } = renderHook(() => useBid(71));

      act(() => {
        bidRejectedHandler!({ sessionId: 71, reason: '出价过低' });
      });
      expect(result.current.bidError).toBe('出价过低');

      act(() => { result.current.clearBidError(); });
      expect(result.current.bidError).toBeNull();
    });

    it('新出价应自动清除之前的 bidError', () => {
      let bidRejectedHandler: ((data: { sessionId: number; reason: string }) => void) | undefined;
      const mockSocket = {
        emit: mockEmit,
        on: vi.fn((event: string, handler: unknown) => {
          if (event === 'bid:rejected') bidRejectedHandler = handler as typeof bidRejectedHandler;
        }),
        off: vi.fn(),
      };
      mockGetSocket.mockReturnValue(mockSocket);

      const { result } = renderHook(() => useBid(72));

      act(() => {
        bidRejectedHandler!({ sessionId: 72, reason: '出价过低' });
      });
      expect(result.current.bidError).toBe('出价过低');

      // 新出价应清除错误
      act(() => { result.current.submitBid(300); });
      expect(result.current.bidError).toBeNull();
    });

    it('不同 sessionId 的 bid:rejected 不应影响当前 hook', () => {
      let bidRejectedHandler: ((data: { sessionId: number; reason: string }) => void) | undefined;
      const mockSocket = {
        emit: mockEmit,
        on: vi.fn((event: string, handler: unknown) => {
          if (event === 'bid:rejected') bidRejectedHandler = handler as typeof bidRejectedHandler;
        }),
        off: vi.fn(),
      };
      mockGetSocket.mockReturnValue(mockSocket);

      const { result } = renderHook(() => useBid(80));

      // 不同 sessionId 的 rejection
      act(() => {
        bidRejectedHandler!({ sessionId: 999, reason: '其他会话的错误' });
      });

      expect(result.current.bidError).toBeNull();
    });
  });
});
