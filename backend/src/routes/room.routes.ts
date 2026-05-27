import { FastifyInstance } from 'fastify';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { liveRoomRepo } from '../repositories/live-room.repo.js';
import { cache } from '../infrastructure/cache/redis.js';
import { db } from '../infrastructure/db/knex.js';
import { logger } from '../middleware/logger.js';
import { broadcastRoomStatus } from '../ws/index.js';
import { replySuccess, replyError } from '../lib/reply.js';

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
    return replySuccess(reply, { roomId }, 201);
  });

  app.get('/api/rooms/my-room', { onRequest: requireRole('merchant') }, async (req, reply) => {
    const room = await liveRoomRepo.findByHost(req.auth.userId);
    if (!room) {
      return replyError(reply, 40400, '您还没有直播间', 404);
    }
    return replySuccess(reply, room);
  });

  app.get('/api/rooms', async (req, reply) => {
    const query = req.query as any;
    const filters: any = {};
    if (req.auth.role === 'merchant') filters.host_id = req.auth.userId;
    if (query.status) filters.status = query.status;
    const data = await liveRoomRepo.findAll({ ...filters, page: parseInt(query.page) || 1, limit: parseInt(query.limit) || 20 });
    return replySuccess(reply, data);
  });

  app.put('/api/rooms/:id/status', { onRequest: requireRole('merchant') }, async (req, reply) => {
    const roomId = Number((req.params as any).id);
    const { status } = req.body as { status: 'offline' | 'live' };

    if (!['offline', 'live'].includes(status)) {
      return replyError(reply, 40001, '无效的状态值，仅支持 offline 或 live', 400);
    }

    const room = await liveRoomRepo.findById(roomId);
    if (!room) {
      return replyError(reply, 40400, '直播间不存在', 404);
    }
    if (room.host_id !== req.auth.userId) {
      return replyError(reply, 40301, '无权限操作此直播间', 403);
    }

    if (room.status === status) {
      return replySuccess(reply, { roomId, status });
    }

    if (status === 'offline') {
      const activeSession = await db('auction_sessions')
        .where({ room_id: roomId })
        .whereIn('status', ['pending', 'active'])
        .first();
      if (activeSession) {
        return replyError(reply, 40902, '当前有进行中的竞拍，请先结束竞拍再下播', 409);
      }
    }

    await liveRoomRepo.updateStatus(roomId, status);
    await cache.set(`room:${roomId}:status`, status, 300);
    broadcastRoomStatus(roomId, status);

    logger.info({ event: 'room_status_changed', roomId, fromStatus: room.status, toStatus: status, merchantId: req.auth.userId }, 'Room status changed');

    return replySuccess(reply, { roomId, status });
  });

  app.get('/api/rooms/:id', async (req, reply) => {
    const roomId = Number((req.params as any).id);
    const room = await liveRoomRepo.findById(roomId);
    if (!room) return replyError(reply, 40400, '直播间不存在', 404);

    const allProducts = await db('products as p')
      .leftJoin('auction_rules as r', 'p.id', 'r.product_id')
      .where('p.merchant_id', room.host_id)
      .whereIn('p.status', ['pending', 'listed', 'active', 'ended'])
      .orderBy('p.created_at', 'desc')
      .select(
        'p.id as productId',
        'p.name as productName',
        'p.description as productDescription',
        'p.image_url as productImageUrl',
        'p.status as productStatus',
        'r.id as ruleId',
        'r.start_price as startPrice',
        'r.bid_increment as bidIncrement',
        'r.ceiling_price as ceilingPrice',
        'r.duration_seconds as durationSeconds',
        'r.extend_seconds as extendSeconds',
        'r.max_extensions as maxExtensions',
      );

    const existingSessions = await db('auction_sessions as s')
      .where('s.room_id', roomId)
      .select(
        's.id as sessionId',
        's.product_id as productId',
        's.status',
        's.current_price as currentPrice',
        's.started_at as startedAt',
        's.ended_at as endedAt',
        's.extension_count as extensionCount',
      );

    const sessionMap = new Map();
    existingSessions.forEach((s: any) => sessionMap.set(s.productId, s));

    const auctionList = allProducts.map((row: any) => {
      const sess = sessionMap.get(row.productId);
      return {
        sessionId: sess?.sessionId ?? null,
        status: sess?.status ?? 'pending',
        currentPrice: sess?.currentPrice ?? (row.startPrice ?? 0),
        startedAt: sess?.startedAt ?? null,
        endedAt: sess?.endedAt ?? null,
        extensionCount: sess?.extensionCount ?? 0,
        product: {
          id: row.productId,
          name: row.productName,
          description: row.productDescription,
          imageUrl: row.productImageUrl,
        },
        rule: {
          startPrice: row.startPrice ?? 0,
          bidIncrement: row.bidIncrement ?? 10,
          ceilingPrice: row.ceilingPrice ?? null,
          durationSeconds: row.durationSeconds ?? 300,
          extendSeconds: row.extendSeconds ?? 30,
          maxExtensions: row.maxExtensions ?? 3,
        },
      };
    });

    const activeAuction = existingSessions.find((s: any) => ['pending', 'active'].includes(s.status));
    let currentAuction = null;
    if (activeAuction) {
      const productData = allProducts.find((p: any) => p.productId === activeAuction.product_id);
      const ruleData = productData;
      if (productData) {
        currentAuction = {
          sessionId: activeAuction.sessionId,
          status: activeAuction.status,
          product: {
            id: productData.productId,
            name: productData.productName,
            description: productData.productDescription,
            imageUrl: productData.productImageUrl,
          },
          rule: {
            startPrice: ruleData?.startPrice ?? 0,
            bidIncrement: ruleData?.bidIncrement ?? 10,
            ceilingPrice: ruleData?.ceilingPrice ?? null,
            durationSeconds: ruleData?.durationSeconds ?? 300,
            extendSeconds: ruleData?.extendSeconds ?? 30,
            maxExtensions: ruleData?.maxExtensions ?? 3,
          },
          currentPrice: activeAuction.currentPrice,
          leaderboard: [],
          startedAt: activeAuction.startedAt,
          participantCount: 0,
          extensionCount: activeAuction.extensionCount,
        };
      }
    }

    return replySuccess(reply, { ...room, currentAuction, auctions: auctionList });
  });
}
