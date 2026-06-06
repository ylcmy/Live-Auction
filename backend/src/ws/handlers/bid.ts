/**
 * T066: WebSocket Bid Handler
 *
 * Handles `bid:submit` events from connected clients.
 * - Validates via bidService.processBid
 * - Sends `bid:accepted` / `bid:rejected` to the bidder
 * - Broadcasts `bid:new` and `rank:update` to the room
 * - Emits `emotion:lead` / `emotion:overtaken` for emotional feedback
 * - Triggers `auction:ended` if ceiling price is hit
 * - Checks for auction extension (last-second bid)
 * - Sends `countdown:sync` after each bid
 */

import type { Server, Socket } from 'socket.io';
import {
  bidService,
  type BidProcessResult,
} from '../../services/bid.service.js';
import { auctionService } from '../../services/auction.service.js';
import { auctionSessionRepo } from '../../repositories/auction-session.repo.js';
import { cache } from '../../infrastructure/cache/redis.js';
import { broadcastToRoom } from '../rooms.js';
import { broadcastRoomListUpdate } from '../index.js';

export function registerBidHandlers(io: Server, socket: Socket) {
  const userId = (socket as any).userId as number;

  socket.on('bid:submit', async (data: { sessionId: number; idempotencyKey: string }) => {
    const { sessionId, idempotencyKey } = data;

    // Get previous top bidder BEFORE processing the bid
    let previousTopBidderId: number | null = null;
    try {
      const topBidRaw = await cache.get(`auction:${sessionId}:top_bid`);
      if (topBidRaw) {
        const topBid = JSON.parse(topBidRaw);
        if (topBid.userId && topBid.userId !== 0) {
          previousTopBidderId = topBid.userId;
        }
      }
    } catch {}

    const result: BidProcessResult = await bidService.processBid(
      sessionId,
      userId,
      idempotencyKey,
    );

    if (!result.success) {
      socket.emit('bid:rejected', {
        sessionId,
        idempotencyKey,
        reason: result.error?.message,
        code: result.error?.code,
      });
      return;
    }

    // Get session for room identification
    const session = await auctionSessionRepo.findById(sessionId);
    if (!session) return;
    const roomId = String(session.room_id);

    // Resolve user nickname
    const userNickname = await bidService.getUserNickname(userId);

    // ---- Notify the bidder of acceptance ----
    socket.emit('bid:accepted', {
      sessionId,
      idempotencyKey,
      bidId: 0,
      amount: result.amount,
      rank: result.rank,
      isLeading: result.isLeading,
      gapToLeader: result.gapToLeader,
    });

    // ---- Broadcast new bid to all room members ----
    broadcastToRoom(io, roomId, 'bid:new', {
      sessionId,
      userId,
      userNickname,
      amount: result.amount,
      timestamp: new Date().toISOString(),
      newTopBid: result.isLeading,
    });

    broadcastRoomListUpdate('room-list:bid-new', {
      roomId: Number(roomId),
      sessionId,
      currentPrice: result.amount,
    });

    // ---- Broadcast updated leaderboard with real nicknames ----
    const leaderboard = await bidService.getLeaderboard(sessionId, userId);
    broadcastToRoom(io, roomId, 'rank:update', leaderboard);

    // ---- Emotion events ----
    if (result.isLeading) {
      // New bidder is now the leader
      socket.emit('emotion:lead', {
        sessionId,
        userId,
        amount: result.amount,
      });
      // Notify the previous leader they've been outbid
      if (previousTopBidderId !== null && previousTopBidderId !== userId) {
        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        if (roomSockets) {
          for (const socketId of roomSockets) {
            const s = io.sockets.sockets.get(socketId);
            if (s && (s as any).userId === previousTopBidderId) {
              s.emit('emotion:overtaken', {
                sessionId,
                userId: previousTopBidderId,
                newAmount: result.amount,
              });
              break;
            }
          }
        }
      }
    }
    // If not leading, no emotion event needed (bidder was never leading)

    // ---- Check for auction extension ----
    if (result.extensionResult) {
      auctionService.rescheduleSettlement(sessionId, result.extensionResult.remainingMs);
      broadcastToRoom(io, roomId, 'countdown:extend', {
        sessionId,
        extendSeconds: Math.round(result.extensionResult.remainingMs / 1000),
        remainingExtensions: result.extensionResult.extensionCount,
      });
    }

    // ---- Send countdown sync to all ----
    const timer = await auctionService.getAuctionTimer(sessionId);
    if (timer) {
      broadcastToRoom(io, roomId, 'countdown:sync', {
        sessionId,
        remainingMs: timer.remainingMs,
        serverTime: timer.serverTime,
      });
    }

    // ---- Ceiling price triggered — settle the auction ----
    if (result.shouldEnd) {
      await auctionService.settleAuction(sessionId);
      // Note: settleAuction already broadcasts auction:ended to the room
    }
  });
}
