import { useState, useCallback, useEffect } from 'react';

interface UseBidAmountReturn {
  bidAmount: number;
  increment: () => void;
  decrement: () => void;
  setValue: (value: number) => void;
  reset: () => void;
  snapToMin: (newPrice: number) => void;
  isAtMin: boolean;
}

export function useBidAmount(currentPrice: number, bidIncrement: number): UseBidAmountReturn {
  const minBid = currentPrice + bidIncrement;

  const [bidAmount, setBidAmount] = useState(minBid);

  // When currentPrice changes (outbid scenario), snap bidAmount up if needed
  useEffect(() => {
    const newMin = currentPrice + bidIncrement;
    setBidAmount((prev) => (prev < newMin ? newMin : prev));
  }, [currentPrice, bidIncrement]);

  const increment = useCallback(() => {
    setBidAmount((prev) => prev + bidIncrement);
  }, [bidIncrement]);

  const decrement = useCallback(() => {
    setBidAmount((prev) => Math.max(prev - bidIncrement, currentPrice + bidIncrement));
  }, [bidIncrement, currentPrice]);

  const reset = useCallback(() => {
    setBidAmount(currentPrice + bidIncrement);
  }, [currentPrice, bidIncrement]);

  const setValue = useCallback(
    (value: number) => {
      const min = currentPrice + bidIncrement;
      const clamped = Math.max(value, min);
      const stepped = Math.round((clamped - currentPrice) / bidIncrement) * bidIncrement + currentPrice;
      setBidAmount(Math.max(stepped, min));
    },
    [currentPrice, bidIncrement],
  );

  const snapToMin = useCallback(
    (newPrice: number) => {
      setBidAmount(newPrice + bidIncrement);
    },
    [bidIncrement],
  );

  const isAtMin = bidAmount === currentPrice + bidIncrement;

  return { bidAmount, increment, decrement, setValue, reset, snapToMin, isAtMin };
}
