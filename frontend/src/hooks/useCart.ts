import { useState, useCallback } from 'react';
import type { RoomAuctionItem } from '../types/api';

interface UseCartReturn {
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  productCount: number;
}

export function useCart(roomAuctions: RoomAuctionItem[]): UseCartReturn {
  const [isOpen, setIsOpen] = useState(false);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  return { isOpen, openCart, closeCart, productCount: roomAuctions.length };
}
