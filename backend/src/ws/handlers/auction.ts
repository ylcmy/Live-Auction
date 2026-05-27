/**
 * Auction management WebSocket handlers.
 *
 * Handles:
 * - auction:timer — client requests timer sync
 * - auction:state — client requests full auction state
 */

import type { Server, Socket } from 'socket.io';
import { auctionService } from '../../services/auction.service.js';
import { cache } from '../../infrastructure/cache/redis.js';

export function registerAuctionHandlers(io: Server, socket: Socket) {
  const userId = (socket as any).userId as number;

  // Client requests timer sync
  socket.on('auction:timer', async (data: { sessionId: number }) => {
    const { sessionId } = data;
    const timer = await auctionService.getAuctionTimer(sessionId);
    if (timer) {
      socket.emit('countdown:sync', {
        sessionId,
        remainingMs: timer.remainingMs,
        serverTime: timer.serverTime,
      });
    }
  });

  // Client requests full auction state (e.g., after reconnect)
  socket.on('auction:get_state', async (data: { sessionId: number }) => {
    const { sessionId } = data;
    const state = await auctionService.buildAuctionState(sessionId, userId);
    if (state) {
      socket.emit('auction:state', state);
    }
  });
}
