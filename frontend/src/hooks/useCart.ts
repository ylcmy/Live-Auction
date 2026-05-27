import { useState, useCallback, useRef } from 'react';
import type { RoomAuctionItem } from '../types/api';

interface UseCartReturn {
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  productCount: number;
}

export function useCart(roomAuctions: RoomAuctionItem[]): UseCartReturn {
  const [isOpen, setIsOpen] = useState(false);
  const lastActionRef = useRef<'open' | 'close' | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const openCart = useCallback(() => {
    if (lastActionRef.current === 'open') return;
    clearTimeout(timerRef.current);
    lastActionRef.current = 'open';
    setIsOpen(true);
    timerRef.current = setTimeout(() => { lastActionRef.current = null; }, 300);
  }, []);

  const closeCart = useCallback(() => {
    if (lastActionRef.current === 'close') return;
    clearTimeout(timerRef.current);
    lastActionRef.current = 'close';
    setIsOpen(false);
    timerRef.current = setTimeout(() => { lastActionRef.current = null; }, 300);
  }, []);

  return {
    isOpen,
    openCart,
    closeCart,
    productCount: roomAuctions.length,
  };
}
