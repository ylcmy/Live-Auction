import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { joinRoom, leaveRoom, getOnlineCount, broadcastToRoom } from './rooms.js';
import { registerBidHandlers } from './handlers/bid.js';
import { registerAuctionHandlers } from './handlers/auction.js';
import { auctionService, initializeDefaultAuctionService } from '../services/auction.service.js';
import { auctionSessionRepo } from '../repositories/auction-session.repo.js';
import { bidRepo } from '../repositories/bid.repo.js';
import { cache, isRedisAvailable } from '../infrastructure/cache/redis.js';
import type { AuthPayload } from '../middleware/auth.js';

async function getRoomUserCounts(
  io: Server,
  roomId: string,
  userId: number,
  direction: 'join' | 'leave',
): Promise<{ onlineCount: number; participantCount: number }> {
  let onlineCount: number;
  let participantCount: number;

  if (isRedisAvailable()) {
    if (direction === 'join') {
      await cache.sadd(`room:${roomId}:online`, String(userId));
    } else {
      await cache.srem(`room:${roomId}:online`, String(userId));
    }
    onlineCount = getOnlineCount(io, roomId);
    participantCount = (await cache.scard(`room:${roomId}:participants`)) || 0;
  } else {
    onlineCount = io.sockets.adapter.rooms.get(roomId)?.size || 0;
    const activeSession = await auctionSessionRepo.findActiveByRoom(Number(roomId));
    if (activeSession) {
      const lb = await bidRepo.findLeaderboard(activeSession.id, 1000);
      participantCount = lb.length;
    } else {
      participantCount = 0;
    }
  }

  return { onlineCount, participantCount };
}

let io: Server;

export function initWebSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*', credentials: true },
    pingInterval: 25000,
    pingTimeout: 5000,
  });

  // Inject io instance into auction service for settlement broadcasts
  initializeDefaultAuctionService(io);

  io.use((socket, next) => {
    // Support both handshake.auth.token (Socket.IO client) and query token (raw WebSocket / k6)
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error('未认证'));
    }
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
      (socket as any).userId = payload.userId;
      (socket as any).role = payload.role;
      next();
    } catch {
      next(new Error('令牌无效'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = (socket as any).userId as number;

    socket.on('room-list:subscribe', () => {
      socket.join('room-list');
    });

    socket.on('room-list:unsubscribe', () => {
      socket.leave('room-list');
    });

    socket.on('auction:join', async ({ roomId }: { roomId: number }) => {
      const rid = String(roomId);
      joinRoom(socket, rid);

      const { onlineCount, participantCount } = await getRoomUserCounts(io, rid, userId, 'join');
      broadcastToRoom(io, rid, 'room:count', { roomId, onlineCount, participantCount });

      let activeSessionId = await cache.get(`room:${rid}:active_session`);

      // Fallback to MySQL if Redis key is missing (e.g., after Redis restart or key eviction)
      if (!activeSessionId) {
        const activeSession = await auctionSessionRepo.findActiveByRoom(roomId);
        if (activeSession) {
          activeSessionId = String(activeSession.id);
          // Restore Redis cache for future lookups
          await cache.set(`room:${rid}:active_session`, activeSessionId);
        }
      }

      if (activeSessionId) {
        const state = await auctionService.buildAuctionState(Number(activeSessionId), userId);
        if (state) {
          socket.emit('auction:state', state);
        }
      }
    });

    socket.on('auction:leave', async ({ roomId }: { roomId: number }) => {
      const rid = String(roomId);
      leaveRoom(socket, rid);

      const { onlineCount, participantCount } = await getRoomUserCounts(io, rid, userId, 'leave');
      broadcastToRoom(io, rid, 'room:count', { roomId, onlineCount, participantCount });
    });

    socket.on('disconnect', async () => {
      const rooms = [...socket.rooms];
      for (const roomId of rooms) {
        if (roomId === socket.id) continue;

        const { onlineCount, participantCount } = await getRoomUserCounts(io, roomId, userId, 'leave');
        broadcastToRoom(io, roomId, 'room:count', {
          roomId: Number(roomId),
          onlineCount,
          participantCount,
        });
      }
    });

    registerBidHandlers(io, socket);
    registerAuctionHandlers(io, socket);
  });

  return io;
}

export function broadcastRoomStatus(roomId: number, status: string) {
  if (!io) return;
  broadcastToRoom(io, String(roomId), 'room:status', { roomId, status });
}

export function broadcastRoomListUpdate(event: string, data: any) {
  if (!io) return;
  io.to('room-list').emit(event, data);
}

export async function broadcastAuctionState(roomId: number, sessionId: number) {
  if (!io) return;
  const roomClients = io.sockets.adapter.rooms.get(String(roomId));
  if (!roomClients) return;
  const socketIds = [...roomClients];
  for (const socketId of socketIds) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      const userId = (socket as any).userId as number;
      if (userId == null) continue;
      const state = await auctionService.buildAuctionState(sessionId, userId);
      if (state) {
        socket.emit('auction:state', state);
      }
    }
  }
}

export { getOnlineCount, broadcastToRoom };
