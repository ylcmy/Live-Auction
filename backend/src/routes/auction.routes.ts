import { FastifyInstance } from 'fastify';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { auctionService } from '../services/auction.service.js';
import { auctionSessionRepo } from '../repositories/auction-session.repo.js';
import { broadcastAuctionState } from '../ws/index.js';
import { replySuccess, replyError } from '../lib/reply.js';

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
      if (data.sessionId != null) {
        broadcastAuctionState(roomId, data.sessionId).catch((err) => {
          console.error('Failed to broadcast auction state:', err);
        });
      }
      return replySuccess(reply, data, 201);
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
    return replySuccess(reply, data);
  });

  app.get('/api/auctions/:id', async (req, reply) => {
    const id = Number((req.params as any).id);
    if (!Number.isFinite(id)) return replyError(reply, 40000, '无效的竞拍 ID', 400);
    const session = await auctionSessionRepo.findById(id);
    if (!session) return replyError(reply, 40400, '竞拍不存在', 404);
    return replySuccess(reply, session);
  });

  app.post(
    '/api/auctions/:id/cancel',
    { onRequest: requireRole('merchant') },
    async (req, reply) => {
      await auctionService.cancelAuction(Number((req.params as any).id), req.auth.userId);
      return replySuccess(reply, { sessionId: Number((req.params as any).id), status: 'cancelled' });
    },
  );
}
