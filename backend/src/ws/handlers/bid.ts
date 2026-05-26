/**
 * T066: WebSocket Bid Handler
 *
 * Handles `bid:submit` events from connected clients.
 * - Validates via bidService.processBid
 * - Sends `bid:accepted` / `bid:rejected` to the bidder
 * - Broadcasts `bid:new` and `rank:update` to the room
 * - Emits `emotion:lead` / `emotion:overtaken` for emotional feedback
 * - Triggers `auction:ended` if ceiling price is hit
 */

import type { Server, Socket } from 'socket.io';
import {
  bidService,
  type BidProcessResult,
} from '../../services/bid.service.js';
import { auctionSessionRepo } from '../../repositories/auction-session.repo.js';
import { broadcastToRoom } from '../rooms.js';

export function registerBidHandlers(io: Server, socket: Socket) {
  const userId = (socket as any).userId as number;

  socket.on('bid:submit', async (data: { sessionId: number; idempotencyKey: string }) => {
    const { sessionId, idempotencyKey } = data;

    const result: BidProcessResult = await bidService.processBid(
      sessionId,
      userId,
      idempotencyKey,
    );

    if (!result.success) {
      socket.emit('bid:rejected', {
        sessionId,
        reason: result.error?.message,
        code: result.error?.code,
      });
      return;
    }

    // ---- Notify the bidder of acceptance ----
    socket.emit('bid:accepted', {
      sessionId,
      bidId: 0, // bidId from async MySQL write not available yet
      amount: result.amount,
      rank: result.rank,
      isLeading: result.isLeading,
      gapToLeader: result.gapToLeader,
    });

    // ---- Get session for room broadcast ----
    const session = await auctionSessionRepo.findById(sessionId);
    if (!session) return;
    const roomId = String(session.room_id);

    // ---- Broadcast new bid to all room members ----
    broadcastToRoom(io, roomId, 'bid:new', {
      sessionId,
      userId,
      userNickname: 'user', // placeholder — resolve from user cache in future
      amount: result.amount,
      timestamp: new Date().toISOString(),
      newTopBid: result.isLeading,
    });

    // ---- Broadcast updated leaderboard ----
    const rawLb = await bidService.getLeaderboard(sessionId);
    const leaderboard = [];
    for (let i = 0; i < rawLb.length; i += 2) {
      leaderboard.push({
        rank: Math.floor(i / 2) + 1,
        userId: Number(rawLb[i]),
        userNickname: 'user', // placeholder — should be resolved from user cache
        avatarUrl: null,
        amount: Number(rawLb[i + 1]),
        timestamp: new Date().toISOString(),
        isCurrentUser: Number(rawLb[i]) === userId,
      });
    }
    broadcastToRoom(io, roomId, 'rank:update', leaderboard);

    // ---- Emotion events ----
    if (result.isLeading) {
      socket.emit('emotion:lead', {
        sessionId,
        userId,
        amount: result.amount,
      });
    } else {
      socket.emit('emotion:overtaken', {
        sessionId,
        userId,
        newAmount: result.amount,
      });
    }

    // ---- Ceiling price triggered — end the auction ----
    if (result.shouldEnd) {
      // Will be connected to auctionService.settleAuction in US5
      broadcastToRoom(io, roomId, 'auction:ended', {
        sessionId,
        status: 'ended',
        winner: {
          userId,
          userNickname: 'user', // placeholder
          finalPrice: result.amount!,
        },
        leaderboard,
        orderId: null,
      });
    }
  });
}
