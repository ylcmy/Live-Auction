import { EventEmitter } from 'events';
import type { Server } from 'socket.io';
import { broadcastToRoom } from './rooms.js';
import { broadcastRoomListUpdate } from './index.js';
import { bidService } from '../services/bid.service.js';
import { auctionService } from '../services/auction.service.js';

export interface BidCommittedEvent {
  sessionId: number;
  roomId: string;
  userId: number;
  userNickname: string;
  amount: number;
  isLeading: boolean;
  previousTopBidderId: number | null;
  extensionResult: { remainingMs: number; extensionCount: number } | null;
  shouldEnd: boolean;
  timestamp: string;
}

const LEADERBOARD_DEBOUNCE_MS = 50;

export class BidEventBus extends EventEmitter {
  private io: Server | null = null;
  private leaderboardTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private handlersRegistered = false;

  setIO(io: Server): void {
    this.io = io;
  }

  emitBidCommitted(event: BidCommittedEvent): void {
    this.emit('bid:committed', event);
  }

  registerHandlers(): void {
    if (this.handlersRegistered) return;
    this.handlersRegistered = true;

    // 1. Immediate bid broadcast
    this.on('bid:committed', (event: BidCommittedEvent) => {
      if (!this.io) return;

      broadcastToRoom(this.io, event.roomId, 'bid:new', {
        sessionId: event.sessionId,
        userId: event.userId,
        userNickname: event.userNickname,
        amount: event.amount,
        timestamp: event.timestamp,
        newTopBid: event.isLeading,
      });

      broadcastRoomListUpdate('room-list:bid-new', {
        roomId: Number(event.roomId),
        sessionId: event.sessionId,
        currentPrice: event.amount,
      });
    });

    // 2. Leaderboard debounce
    this.on('bid:committed', (event: BidCommittedEvent) => {
      if (!this.io) return;

      const existing = this.leaderboardTimers.get(event.sessionId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        this.leaderboardTimers.delete(event.sessionId);
        try {
          const leaderboard = await bidService.getLeaderboard(event.sessionId, 0);
          broadcastToRoom(this.io!, event.roomId, 'rank:update', leaderboard);
        } catch {
          // 排行榜广播失败，静默处理，下次出价会重新广播
        }
      }, LEADERBOARD_DEBOUNCE_MS);

      this.leaderboardTimers.set(event.sessionId, timer);
    });

    // 3. Emotion overtaken event
    this.on('bid:committed', (event: BidCommittedEvent) => {
      if (!this.io) return;

      if (event.isLeading && event.previousTopBidderId !== null && event.previousTopBidderId !== event.userId) {
        const roomSockets = this.io.sockets.adapter.rooms.get(event.roomId);
        if (roomSockets) {
          for (const socketId of roomSockets) {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket && (socket as any).userId === event.previousTopBidderId) {
              socket.emit('emotion:overtaken', {
                sessionId: event.sessionId,
                userId: event.previousTopBidderId,
                newAmount: event.amount,
              });
            }
          }
        }
      }
    });

    // 3b. Emotion lead event — notify the bidder they are now leading
    this.on('bid:committed', (event: BidCommittedEvent) => {
      if (!this.io) return;

      if (event.isLeading && (!event.previousTopBidderId || event.previousTopBidderId !== event.userId)) {
        const roomSockets = this.io.sockets.adapter.rooms.get(event.roomId);
        if (roomSockets) {
          for (const socketId of roomSockets) {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket && (socket as any).userId === event.userId) {
              socket.emit('emotion:lead', {
                sessionId: event.sessionId,
                userId: event.userId,
                amount: event.amount,
              });
            }
          }
        }
      }
    });

    // 4. Extension + countdown sync
    this.on('bid:committed', (event: BidCommittedEvent) => {
      if (!this.io) return;

      if (event.extensionResult) {
        auctionService.rescheduleSettlement(event.sessionId, event.extensionResult.remainingMs);
        broadcastToRoom(this.io, event.roomId, 'countdown:extend', {
          sessionId: event.sessionId,
          extendSeconds: Math.round(event.extensionResult.remainingMs / 1000),
          remainingExtensions: event.extensionResult.extensionCount,
        });
      }

      // Always sync countdown after each bid
      (async () => {
        try {
          const timer = await auctionService.getAuctionTimer(event.sessionId);
          if (timer) {
            broadcastToRoom(this.io!, event.roomId, 'countdown:sync', {
              sessionId: event.sessionId,
              remainingMs: timer.remainingMs,
              serverTime: timer.serverTime,
            });
          }
        } catch {
          // 静默处理
        }
      })();
    });

    // 5. Ceiling price settlement
    this.on('bid:committed', (event: BidCommittedEvent) => {
      if (event.shouldEnd) {
        auctionService.settleAuction(event.sessionId);
      }
    });
  }

  dispose(): void {
    for (const timer of this.leaderboardTimers.values()) {
      clearTimeout(timer);
    }
    this.leaderboardTimers.clear();
    this.handlersRegistered = false;
    this.removeAllListeners();
  }
}

export const bidEventBus = new BidEventBus();
