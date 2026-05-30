import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCart } from '../useCart';
import { mockRoomAuctions, mockRoomAuctionItem } from '@/tests/fixtures/auction';

describe('useCart', () => {
  it('should initialize with isOpen as false', () => {
    const { result } = renderHook(() => useCart(mockRoomAuctions));
    expect(result.current.isOpen).toBe(false);
  });

  it('should open cart when openCart is called', () => {
    const { result } = renderHook(() => useCart(mockRoomAuctions));
    act(() => { result.current.openCart(); });
    expect(result.current.isOpen).toBe(true);
  });

  it('should close cart when closeCart is called', () => {
    const { result } = renderHook(() => useCart(mockRoomAuctions));
    act(() => { result.current.openCart(); });
    expect(result.current.isOpen).toBe(true);
    act(() => { result.current.closeCart(); });
    expect(result.current.isOpen).toBe(false);
  });

  it('should toggle cart open/close correctly', () => {
    const { result } = renderHook(() => useCart(mockRoomAuctions));

    act(() => { result.current.openCart(); });
    expect(result.current.isOpen).toBe(true);

    act(() => { result.current.closeCart(); });
    expect(result.current.isOpen).toBe(false);

    act(() => { result.current.openCart(); });
    expect(result.current.isOpen).toBe(true);
  });

  it('should return correct productCount from roomAuctions', () => {
    const { result } = renderHook(() => useCart(mockRoomAuctions));
    expect(result.current.productCount).toBe(mockRoomAuctions.length);
  });

  it('should return productCount of 0 for empty array', () => {
    const { result } = renderHook(() => useCart([]));
    expect(result.current.productCount).toBe(0);
  });

  it('should return productCount of 1 for single item array', () => {
    const { result } = renderHook(() => useCart([mockRoomAuctionItem]));
    expect(result.current.productCount).toBe(1);
  });

  it('should update productCount when roomAuctions reference changes', () => {
    let auctions = mockRoomAuctions;
    const { result, rerender } = renderHook(() => useCart(auctions));
    expect(result.current.productCount).toBe(3);

    auctions = [mockRoomAuctionItem];
    rerender();
    expect(result.current.productCount).toBe(1);
  });

  it('should not affect isOpen when roomAuctions changes', () => {
    let auctions = mockRoomAuctions;
    const { result, rerender } = renderHook(() => useCart(auctions));
    act(() => { result.current.openCart(); });
    expect(result.current.isOpen).toBe(true);

    auctions = [];
    rerender();
    expect(result.current.isOpen).toBe(true);
  });
});
