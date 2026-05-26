import { useCallback, useRef } from 'react';
import { getSocket } from '../services/socket';
import { generateIdempotencyKey } from '../lib/idempotency';

export function useBid(sessionId: number | null) {
  const debounceRef = useRef(false);

  const submitBid = useCallback(() => {
    if (!sessionId || debounceRef.current) return;
    debounceRef.current = true;

    const socket = getSocket();
    if (!socket) return;
    const key = generateIdempotencyKey();

    socket.emit('bid:submit', { sessionId, idempotencyKey: key });

    // Reset debounce after 300ms
    setTimeout(() => { debounceRef.current = false; }, 300);
  }, [sessionId]);

  return { submitBid };
}
