import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBid } from '../useBid';

const { mockEmit, mockGetSocket, mockGenerateIdempotencyKey } = vi.hoisted(() => ({
  mockEmit: vi.fn(),
  mockGetSocket: vi.fn(() => ({ emit: mockEmit })),
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
    mockGetSocket.mockReturnValue({ emit: mockEmit });
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
});
