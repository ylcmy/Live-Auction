import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { orderService } from '../services/order.service.js';
import { replySuccess } from '../lib/reply.js';

export async function orderRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  app.get('/api/orders', async (req, reply) => {
    const query = req.query as any;
    const data = await orderService.getOrders(req.auth.userId, req.auth.role, parseInt(query.page) || 1, parseInt(query.limit) || 20);
    return replySuccess(reply, data);
  });

  app.get('/api/orders/:id', async (req, reply) => {
    const data = await orderService.getOrderDetail(Number((req.params as any).id));
    return replySuccess(reply, data);
  });

  app.post('/api/orders/:id/pay', async (req, reply) => {
    const data = await orderService.mockPay(Number((req.params as any).id));
    return replySuccess(reply, data);
  });

  app.put('/api/orders/:id/status', async (req, reply) => {
    const { status } = req.body as { status: string };
    const data = await orderService.updateStatus(Number((req.params as any).id), status);
    return replySuccess(reply, data);
  });
}
