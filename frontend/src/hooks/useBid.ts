import { useCallback, useRef, useState, useEffect } from 'react';
import { getSocket } from '../services/socket';
import { generateIdempotencyKey } from '../lib/idempotency';

export function useBid(sessionId: number | null) {
  const debounceRef = useRef(false);
  const [bidError, setBidError] = useState<string | null>(null);

  const clearBidError = useCallback(() => setBidError(null), []);

  // Listen for bid:rejected
  useEffect(() => {
    if (!sessionId) return;

    const socket = getSocket();
    if (!socket) return;

    const handler = (data: { sessionId: number; reason: string }) => {
      if (data.sessionId === sessionId) {
        setBidError(data.reason || '出价失败');
      }
    };

    socket.on('bid:rejected', handler);
    return () => {
      socket.off('bid:rejected', handler);
    };
  }, [sessionId]);

  const submitBid = useCallback((amount?: number) => {
    if (!sessionId || debounceRef.current) return;
    debounceRef.current = true;

    // Clear error on new bid
    setBidError(null);

    const socket = getSocket();
    if (!socket) return;
    const key = generateIdempotencyKey();

    socket.emit('bid:submit', { sessionId, amount, idempotencyKey: key });

    setTimeout(() => { debounceRef.current = false; }, 300);
  }, [sessionId]);

  return { submitBid, bidError, clearBidError };
}
