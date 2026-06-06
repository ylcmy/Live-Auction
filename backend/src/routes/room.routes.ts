import { FastifyInstance } from 'fastify';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { liveRoomRepo } from '../repositories/live-room.repo.js';
import { auctionSessionRepo } from '../repositories/auction-session.repo.js';
import { cache } from '../infrastructure/cache/redis.js';
import { db } from '../infrastructure/db/knex.js';
import { logger } from '../middleware/logger.js';
import { broadcastRoomStatus } from '../ws/index.js';
import { replySuccess, replyError } from '../lib/reply.js';

async function buildCurrentAuction(roomId: number) {
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

  const activeAuction = existingSessions.find((s: any) => s.status === 'active');
  if (!activeAuction) return null;

  const productData = await db('products as p')
    .leftJoin('auction_rules as r', 'p.id', 'r.product_id')
    .where('p.id', activeAuction.productId)
    .first(
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

  if (!productData) return null;

  const topBidRaw = await cache.get(`auction:${activeAuction.sessionId}:top_bid`);
  const topBid = topBidRaw ? (JSON.parse(topBidRaw) as { userId: number; amount: number }) : null;
  const currentPrice = topBid ? Number(topBid.amount) : activeAuction.currentPrice;

  return {
    sessionId: activeAuction.sessionId,
    status: activeAuction.status,
    product: {
      id: productData.productId,
      name: productData.productName,
      description: productData.productDescription,
      imageUrl: productData.productImageUrl,
    },
    rule: {
      startPrice: productData.startPrice ?? 0,
      bidIncrement: productData.bidIncrement ?? 10,
      ceilingPrice: productData.ceilingPrice ?? null,
      durationSeconds: productData.durationSeconds ?? 300,
      extendSeconds: productData.extendSeconds ?? 30,
      maxExtensions: productData.maxExtensions ?? 3,
    },
    currentPrice,
    leaderboard: [],
    startedAt: activeAuction.startedAt,
    participantCount: 0,
    extensionCount: activeAuction.extensionCount,
  };
}

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

    if (data.items.length === 0) {
      return replySuccess(reply, data);
    }

    const roomIds = data.items.map((r: any) => r.id);

    const activeSessions = await db('auction_sessions as s')
      .join('products as p', 's.product_id', 'p.id')
      .leftJoin('auction_rules as r', 'p.id', 'r.product_id')
      .whereIn('s.room_id', roomIds)
      .where('s.status', 'active')
      .select(
        's.room_id as roomId', 's.id as sessionId', 's.status', 's.current_price as currentPrice',
        's.started_at as startedAt', 's.extension_count as extensionCount',
        'p.id as productId', 'p.name as productName', 'p.description as productDescription', 'p.image_url as productImageUrl',
        'r.start_price as startPrice', 'r.bid_increment as bidIncrement',
        'r.ceiling_price as ceilingPrice', 'r.duration_seconds as durationSeconds',
        'r.extend_seconds as extendSeconds', 'r.max_extensions as maxExtensions',
      );

    const auctionMap = new Map<number, any>();
    for (const row of activeSessions) {
      if (!auctionMap.has(row.roomId)) {
        const topBidRaw = await cache.get(`auction:${row.sessionId}:top_bid`);
        const topBid = topBidRaw ? (JSON.parse(topBidRaw) as { userId: number; amount: number }) : null;
        auctionMap.set(row.roomId, {
          sessionId: row.sessionId,
          status: row.status,
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
          currentPrice: topBid ? topBid.amount : row.currentPrice,
          leaderboard: [],
          startedAt: row.startedAt,
          participantCount: 0,
          extensionCount: row.extensionCount,
        });
      }
    }

    const itemsWithAuction = data.items.map((room: any) => ({
      ...room,
      currentAuction: auctionMap.get(room.id) || null,
    }));

    return replySuccess(reply, { ...data, items: itemsWithAuction });
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
      const activeSession = await auctionSessionRepo.findActiveByRoom(roomId);
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
    if (!Number.isFinite(roomId)) return replyError(reply, 40000, '无效的直播间 ID', 400);
    const room = await liveRoomRepo.findById(roomId);
    if (!room) return replyError(reply, 40400, '直播间不存在', 404);

    const allProducts = await db('products as p')
      .leftJoin('auction_rules as r', 'p.id', 'r.product_id')
      .where('p.merchant_id', room.host_id)
      .whereNotIn('p.status', ['pending', 'deleted'])
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
    existingSessions.forEach((s: any) => {
      const existing = sessionMap.get(s.productId);
      // Prefer active sessions over ended/cancelled/unsold ones
      if (!existing || (s.status === 'active' && existing.status !== 'active')) {
        sessionMap.set(s.productId, s);
      }
    });

    const auctionListPromises = allProducts.map(async (row: any) => {
      const sess = sessionMap.get(row.productId);
      let currentPrice = sess?.currentPrice ?? (row.startPrice ?? 0);
      if (sess?.sessionId && sess?.status === 'active') {
        const topBidRaw = await cache.get(`auction:${sess.sessionId}:top_bid`);
        const topBid = topBidRaw ? (JSON.parse(topBidRaw) as { userId: number; amount: number }) : null;
        if (topBid) currentPrice = Number(topBid.amount);
      }
      return {
        sessionId: sess?.sessionId ?? row.productId,
        status: sess?.status ?? row.productStatus,
        currentPrice,
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
    const auctionList = await Promise.all(auctionListPromises);

    const currentAuction = await buildCurrentAuction(roomId);

    return replySuccess(reply, { ...room, currentAuction, auctions: auctionList });
  });
}
