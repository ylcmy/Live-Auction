import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { orderService } from '../services/order.service.js';
import { replySuccess, replyError } from '../lib/reply.js';
import { ErrorCodes } from '../lib/error-codes.js';

export async function orderRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  app.get('/api/orders', async (req, reply) => {
    const query = req.query as any;
    const data = await orderService.getOrders(
      req.auth.userId,
      req.auth.role,
      Math.max(1, parseInt(query.page) || 1),
      parseInt(query.limit) || 20,
      query.status,
    );
    return replySuccess(reply, data);
  });

  app.get('/api/orders/:id', async (req, reply) => {
    const id = Number((req.params as any).id);
    if (!Number.isFinite(id)) return replyError(reply, ErrorCodes.INVALID_PARAMS, '无效的订单 ID', 400);
    const data = await orderService.getOrderDetail(id, req.auth.userId, req.auth.role);
    return replySuccess(reply, data);
  });

  app.post('/api/orders/:id/pay', async (req, reply) => {
    const id = Number((req.params as any).id);
    if (!Number.isFinite(id)) return replyError(reply, ErrorCodes.INVALID_PARAMS, '无效的订单 ID', 400);
    const data = await orderService.mockPay(id, req.auth.userId, req.auth.role);
    return replySuccess(reply, data);
  });

  app.put('/api/orders/:id/status', async (req, reply) => {
    const { status } = req.body as { status: string };
    const id = Number((req.params as any).id);
    if (!Number.isFinite(id)) return replyError(reply, ErrorCodes.INVALID_PARAMS, '无效的订单 ID', 400);
    const data = await orderService.updateStatus(id, status, req.auth.userId, req.auth.role);
    return replySuccess(reply, data);
  });
}
