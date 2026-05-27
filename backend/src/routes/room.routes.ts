import { FastifyInstance } from 'fastify';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { liveRoomRepo } from '../repositories/live-room.repo.js';
import { cache } from '../infrastructure/cache/redis.js';
import { db } from '../infrastructure/db/knex.js';
import { logger } from '../middleware/logger.js';
import { broadcastRoomStatus } from '../ws/index.js';

export async function roomRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  app.post('/api/rooms', { onRequest: requireRole('merchant') }, async (req, reply) => {
    const existing = await liveRoomRepo.findByHost(req.auth.userId);
    if (existing) {
      return reply.code(409).send({ code: 40901, message: '您已拥有直播间，不可重复创建', data: { roomId: existing.id }, timestamp: Date.now() });
    }
    const body = req.body as any;
    const roomId = await liveRoomRepo.create({ host_id: req.auth.userId, title: body.title, stream_url: body.streamUrl });
    logger.info({ event: 'room_created', roomId, merchantId: req.auth.userId }, 'Room created');
    return reply.code(201).send({ code: 0, message: 'ok', data: { roomId }, timestamp: Date.now() });
  });

  app.get('/api/rooms/my-room', { onRequest: requireRole('merchant') }, async (req, reply) => {
    const room = await liveRoomRepo.findByHost(req.auth.userId);
    if (!room) {
      return reply.code(404).send({ code: 40400, message: '您还没有直播间', data: null, timestamp: Date.now() });
    }
    return reply.send({ code: 0, message: 'ok', data: room, timestamp: Date.now() });
  });

  app.get('/api/rooms', async (req, reply) => {
    const query = req.query as any;
    const filters: any = {};
    if (req.auth.role === 'merchant') filters.host_id = req.auth.userId;
    if (query.status) filters.status = query.status;
    const data = await liveRoomRepo.findAll({ ...filters, page: parseInt(query.page) || 1, limit: parseInt(query.limit) || 20 });
    return reply.send({ code: 0, message: 'ok', data, timestamp: Date.now() });
  });

  app.put('/api/rooms/:id/status', { onRequest: requireRole('merchant') }, async (req, reply) => {
    const roomId = Number((req.params as any).id);
    const { status } = req.body as { status: 'offline' | 'live' };

    if (!['offline', 'live'].includes(status)) {
      return reply.code(400).send({ code: 40001, message: '无效的状态值，仅支持 offline 或 live', data: null, timestamp: Date.now() });
    }

    const room = await liveRoomRepo.findById(roomId);
    if (!room) {
      return reply.code(404).send({ code: 40400, message: '直播间不存在', data: null, timestamp: Date.now() });
    }
    if (room.host_id !== req.auth.userId) {
      return reply.code(403).send({ code: 40301, message: '无权限操作此直播间', data: null, timestamp: Date.now() });
    }

    if (room.status === status) {
      return reply.send({ code: 0, message: 'ok', data: { roomId, status }, timestamp: Date.now() });
    }

    if (status === 'offline') {
      const activeSession = await db('auction_sessions')
        .where({ room_id: roomId })
        .whereIn('status', ['pending', 'active'])
        .first();
      if (activeSession) {
        return reply.code(409).send({ code: 40902, message: '当前有进行中的竞拍，请先结束竞拍再下播', data: null, timestamp: Date.now() });
      }
    }

    await liveRoomRepo.updateStatus(roomId, status);
    await cache.set(`room:${roomId}:status`, status, 300);
    broadcastRoomStatus(roomId, status);

    logger.info({ event: 'room_status_changed', roomId, fromStatus: room.status, toStatus: status, merchantId: req.auth.userId }, 'Room status changed');

    return reply.send({ code: 0, message: 'ok', data: { roomId, status }, timestamp: Date.now() });
  });

  app.get('/api/rooms/:id', async (req, reply) => {
    const roomId = Number((req.params as any).id);
    const room = await liveRoomRepo.findById(roomId);
    if (!room) return reply.code(404).send({ code: 40400, message: '直播间不存在', data: null, timestamp: Date.now() });

    const sessions = await db('auction_sessions as s')
      .leftJoin('products as p', 's.product_id', 'p.id')
      .leftJoin('auction_rules as r', 's.rule_id', 'r.id')
      .where('s.room_id', roomId)
      .orderBy('s.created_at', 'desc')
      .select(
        's.id as sessionId',
        's.status',
        's.current_price as currentPrice',
        's.started_at as startedAt',
        's.ended_at as endedAt',
        's.extension_count as extensionCount',
        'p.id as productId',
        'p.name as productName',
        'p.description as productDescription',
        'p.image_url as productImageUrl',
        'r.start_price as startPrice',
        'r.bid_increment as bidIncrement',
        'r.ceiling_price as ceilingPrice',
        'r.duration_seconds as durationSeconds',
        'r.extend_seconds as extendSeconds',
        'r.max_extensions as maxExtensions',
      );

    const auctionList = sessions.map((row: any) => ({
      sessionId: row.sessionId,
      status: row.status,
      currentPrice: row.currentPrice,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      extensionCount: row.extensionCount,
      product: row.productId ? {
        id: row.productId,
        name: row.productName,
        description: row.productDescription,
        imageUrl: row.productImageUrl,
      } : null,
      rule: {
        startPrice: row.startPrice,
        bidIncrement: row.bidIncrement,
        ceilingPrice: row.ceilingPrice,
        durationSeconds: row.durationSeconds,
        extendSeconds: row.extendSeconds,
        maxExtensions: row.maxExtensions,
      },
    }));

    const activeAuction = sessions.find((s: any) => ['pending', 'active'].includes(s.status));
    let currentAuction = null;
    if (activeAuction) {
      currentAuction = {
        sessionId: activeAuction.sessionId,
        status: activeAuction.status,
        product: activeAuction.productId ? {
          id: activeAuction.productId,
          name: activeAuction.productName,
          description: activeAuction.productDescription,
          imageUrl: activeAuction.productImageUrl,
        } : null,
        rule: {
          startPrice: activeAuction.startPrice,
          bidIncrement: activeAuction.bidIncrement,
          ceilingPrice: activeAuction.ceilingPrice,
          durationSeconds: activeAuction.durationSeconds,
          extendSeconds: activeAuction.extendSeconds,
          maxExtensions: activeAuction.maxExtensions,
        },
        currentPrice: activeAuction.currentPrice,
        leaderboard: [],
        startedAt: activeAuction.startedAt,
        participantCount: 0,
        extensionCount: activeAuction.extensionCount,
      };
    }

    return reply.send({ code: 0, message: 'ok', data: { ...room, currentAuction, auctions: auctionList }, timestamp: Date.now() });
  });
}
