import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { removeClient, joinRoom, leaveRoom, getOnlineCount, broadcastToRoom } from './rooms.js';
import { registerBidHandlers } from './handlers/bid.js';
import { cache } from '../infrastructure/cache/redis.js';
import type { AuthPayload } from '../middleware/auth.js';

export function initWebSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*', credentials: true },
    pingInterval: 25000,
    pingTimeout: 5000,
  });

  // Auth middleware
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
    console.log(`WS connected: ${socket.id}, userId: ${(socket as any).userId}`);

    // Handle join
    socket.on('auction:join', async ({ roomId }: { roomId: number }) => {
      const rid = String(roomId);
      joinRoom(socket, rid);
      await cache.sadd(`room:${rid}:online`, String((socket as any).userId));
      const count = getOnlineCount(rid);
      broadcastToRoom(io, rid, 'room:count', {
        roomId,
        onlineCount: count,
        participantCount: (await cache.scard(`room:${rid}:participants`)) || 0,
      });

      // Send current auction state if active
      const auctionStatus = await cache.get(`auction:${roomId}:status`);
      if (auctionStatus === 'active') {
        // Will be populated more in US3/US4
        socket.emit('auction:state', { status: 'active' });
      }
    });

    // Handle leave
    socket.on('auction:leave', async ({ roomId }: { roomId: number }) => {
      const rid = String(roomId);
      leaveRoom(socket, rid);
      await cache.srem(`room:${rid}:online`, String((socket as any).userId));
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      const roomId = removeClient(socket.id);
      if (roomId) {
        await cache.srem(`room:${roomId}:online`, String((socket as any).userId));
        const count = getOnlineCount(roomId);
        broadcastToRoom(io, roomId, 'room:count', { roomId: Number(roomId), onlineCount: count });
      }
    });

    // Register bid handlers (US3)
    registerBidHandlers(io, socket);
  });

  return io;
}

export { getOnlineCount, broadcastToRoom };
