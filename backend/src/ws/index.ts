import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { joinRoom, leaveRoom, getOnlineCount, broadcastToRoom } from './rooms.js';
import { registerBidHandlers } from './handlers/bid.js';
import { registerAuctionHandlers } from './handlers/auction.js';
import { auctionService } from '../services/auction.service.js';
import { cache } from '../infrastructure/cache/redis.js';
import type { AuthPayload } from '../middleware/auth.js';

let io: Server;

export function initWebSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*', credentials: true },
    pingInterval: 25000,
    pingTimeout: 5000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('未认证'));
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

    socket.on('auction:join', async ({ roomId }: { roomId: number }) => {
      const rid = String(roomId);
      joinRoom(socket, rid);
      await cache.sadd(`room:${rid}:online`, String(userId));

      const onlineCount = getOnlineCount(io, rid);
      const participantCount = (await cache.scard(`room:${rid}:participants`)) || 0;

      broadcastToRoom(io, rid, 'room:count', {
        roomId,
        onlineCount,
        participantCount,
      });

      const activeSessionId = await cache.get(`room:${rid}:active_session`);
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
      await cache.srem(`room:${rid}:online`, String(userId));
      const onlineCount = getOnlineCount(io, rid);
      broadcastToRoom(io, rid, 'room:count', {
        roomId,
        onlineCount,
        participantCount: (await cache.scard(`room:${rid}:participants`)) || 0,
      });
    });

    socket.on('disconnect', async () => {
      const rooms = [...socket.rooms];
      for (const roomId of rooms) {
        if (roomId === socket.id) continue;
        await cache.srem(`room:${roomId}:online`, String(userId));
        const onlineCount = getOnlineCount(io, roomId);
        broadcastToRoom(io, roomId, 'room:count', {
          roomId: Number(roomId),
          onlineCount,
          participantCount: (await cache.scard(`room:${roomId}:participants`)) || 0,
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
