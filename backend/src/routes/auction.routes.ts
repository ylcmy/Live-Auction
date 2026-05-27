import { FastifyInstance } from 'fastify';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { auctionService } from '../services/auction.service.js';
import { auctionSessionRepo } from '../repositories/auction-session.repo.js';
import { broadcastAuctionState } from '../ws/index.js';

export async function auctionRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  app.post(
    '/api/auctions',
    {
      onRequest: requireRole('merchant'),
      schema: {
        body: {
          type: 'object',
          required: ['productId', 'roomId'],
          properties: { productId: { type: 'integer' }, roomId: { type: 'integer' } },
        },
      },
    },
    async (req, reply) => {
      const { productId, roomId } = req.body as any;
      const data = await auctionService.startAuction(req.auth.userId, productId, roomId);
      // Broadcast auction state to all connected clients in the room
      if (data.sessionId != null) {
        broadcastAuctionState(roomId, data.sessionId).catch(() => {});
      }
      return reply.code(201).send({ code: 0, message: 'ok', data, timestamp: Date.now() });
    },
  );

  app.get('/api/auctions', async (req, reply) => {
    const query = req.query as any;
    const data = await auctionSessionRepo.findAll({
      room_id: query.roomId ? Number(query.roomId) : undefined,
      status: query.status,
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 20,
    });
    return reply.send({ code: 0, message: 'ok', data, timestamp: Date.now() });
  });

  app.get('/api/auctions/:id', async (req, reply) => {
    const session = await auctionSessionRepo.findById(Number((req.params as any).id));
    if (!session) return reply.code(404).send({ code: 40400, message: '竞拍不存在', data: null, timestamp: Date.now() });
    return reply.send({ code: 0, message: 'ok', data: session, timestamp: Date.now() });
  });

  app.post(
    '/api/auctions/:id/cancel',
    { onRequest: requireRole('merchant') },
    async (req, reply) => {
      await auctionService.cancelAuction(Number((req.params as any).id), req.auth.userId);
      return reply.send({
        code: 0,
        message: 'ok',
        data: { sessionId: Number((req.params as any).id), status: 'cancelled' },
        timestamp: Date.now(),
      });
    },
  );
}
