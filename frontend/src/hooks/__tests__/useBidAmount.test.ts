import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBidAmount } from '../useBidAmount';

describe('useBidAmount', () => {
  it('should initialize bidAmount to currentPrice + bidIncrement', () => {
    const { result } = renderHook(() => useBidAmount(100, 10));
    expect(result.current.bidAmount).toBe(110);
  });

  it('should coerce string inputs to numbers', () => {
    const { result } = renderHook(() => useBidAmount('200', '20'));
    expect(result.current.bidAmount).toBe(220);
  });

  it('should default to 0 and 1 for invalid inputs', () => {
    const { result } = renderHook(() => useBidAmount(NaN, NaN));
    expect(result.current.bidAmount).toBe(1);
  });

  it('should set bidAmount via setValue and snap to step boundaries', () => {
    const { result } = renderHook(() => useBidAmount(100, 10));
    act(() => { result.current.setValue(150); });
    expect(result.current.bidAmount).toBe(150);
  });

  it('should clamp setValue to minimum (currentPrice + bidIncrement)', () => {
    const { result } = renderHook(() => useBidAmount(100, 10));
    act(() => { result.current.setValue(50); });
    expect(result.current.bidAmount).toBe(110);
  });

  it('should snap to nearest step boundary when setValue is off-step', () => {
    const { result } = renderHook(() => useBidAmount(100, 10));
    act(() => { result.current.setValue(113); });
    expect(result.current.bidAmount).toBe(110);
  });

  it('should round to next step when setValue is between steps', () => {
    const { result } = renderHook(() => useBidAmount(100, 10));
    act(() => { result.current.setValue(117); });
    expect(result.current.bidAmount).toBe(120);
  });

  it('should reset bidAmount to currentPrice + bidIncrement', () => {
    const { result } = renderHook(() => useBidAmount(100, 10));
    act(() => { result.current.setValue(200); });
    expect(result.current.bidAmount).toBe(200);
    act(() => { result.current.reset(); });
    expect(result.current.bidAmount).toBe(110);
  });

  it('should set bidAmount via snapToMin to newPrice + bidIncrement', () => {
    const { result } = renderHook(() => useBidAmount(100, 10));
    act(() => { result.current.setValue(300); });
    act(() => { result.current.snapToMin(500); });
    expect(result.current.bidAmount).toBe(510);
  });

  it('should report isAtMin as true when at minimum', () => {
    const { result } = renderHook(() => useBidAmount(100, 10));
    expect(result.current.isAtMin).toBe(true);
  });

  it('should report isAtMin as false when above minimum', () => {
    const { result } = renderHook(() => useBidAmount(100, 10));
    act(() => { result.current.setValue(200); });
    expect(result.current.isAtMin).toBe(false);
  });

  it('should auto-adjust bidAmount when currentPrice changes and previous amount is below new minimum', () => {
    let price = 100;
    const { result, rerender } = renderHook(() => useBidAmount(price, 10));
    expect(result.current.bidAmount).toBe(110);

    price = 500;
    rerender();
    expect(result.current.bidAmount).toBe(510);
  });

  it('should not lower bidAmount when currentPrice changes but amount is above new minimum', () => {
    let price = 100;
    const { result, rerender } = renderHook(() => useBidAmount(price, 10));
    act(() => { result.current.setValue(300); });

    price = 200;
    rerender();
    expect(result.current.bidAmount).toBe(300);
  });
});
