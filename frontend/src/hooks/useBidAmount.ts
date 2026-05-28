import { useState, useCallback, useEffect } from 'react';

interface UseBidAmountReturn {
  bidAmount: number;
  setValue: (value: number) => void;
  reset: () => void;
  snapToMin: (newPrice: number) => void;
  isAtMin: boolean;
}

export function useBidAmount(currentPriceRaw: number | string, bidIncrementRaw: number | string): UseBidAmountReturn {
  // Ensure numeric values - backend may return strings
  const currentPrice = Number(currentPriceRaw) || 0;
  const bidIncrement = Number(bidIncrementRaw) || 1;

  const minBid = currentPrice + bidIncrement;
  const [bidAmount, setBidAmount] = useState(minBid);

  useEffect(() => {
    const newMin = currentPrice + bidIncrement;
    setBidAmount((prev) => (prev < newMin ? newMin : prev));
  }, [currentPrice, bidIncrement]);

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

  const isAtMin = bidAmount <= currentPrice + bidIncrement;

  return { bidAmount, setValue, reset, snapToMin, isAtMin };
}
