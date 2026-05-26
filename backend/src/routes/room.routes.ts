import { FastifyInstance } from 'fastify';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { liveRoomRepo } from '../repositories/live-room.repo.js';

export async function roomRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  app.post('/api/rooms', { onRequest: requireRole('merchant') }, async (req, reply) => {
    const body = req.body as any;
    const roomId = await liveRoomRepo.create({ host_id: req.auth.userId, title: body.title, stream_url: body.streamUrl });
    return reply.code(201).send({ code: 0, message: 'ok', data: { roomId }, timestamp: Date.now() });
  });

  app.get('/api/rooms', async (req, reply) => {
    const query = req.query as any;
    const filters: any = {};
    if (req.auth.role === 'merchant') filters.host_id = req.auth.userId;
    if (query.status) filters.status = query.status;
    const data = await liveRoomRepo.findAll({ ...filters, page: parseInt(query.page) || 1, limit: parseInt(query.limit) || 20 });
    return reply.send({ code: 0, message: 'ok', data, timestamp: Date.now() });
  });

  app.get('/api/rooms/:id', async (req, reply) => {
    const room = await liveRoomRepo.findById(Number((req.params as any).id));
    if (!room) return reply.code(404).send({ code: 40400, message: '直播间不存在', data: null, timestamp: Date.now() });
    return reply.send({ code: 0, message: 'ok', data: room, timestamp: Date.now() });
  });
}
