import type { FastifyInstance } from 'fastify';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { merchantApplicationService } from '../services/merchant-application.service.js';
import { merchantApplicationRepo } from '../repositories/merchant-application.repo.js';
import { replySuccess } from '../lib/reply.js';
import { AppError } from '../lib/app-error.js';

export async function merchantApplicationRoutes(app: FastifyInstance) {
  // POST / — Submit merchant application
  app.post(
    '/api/merchant-applications',
    { preHandler: [authMiddleware] },
    async (req, reply) => {
      const { shop_name, reason } = req.body as { shop_name: string; reason?: string };
      const data = await merchantApplicationService.submit(req.auth.userId, { shop_name, reason });
      return replySuccess(reply, data, 201);
    },
  );

  // GET / — List applications (admin only)
  app.get(
    '/api/merchant-applications',
    { preHandler: [authMiddleware, requireRole('admin')] },
    async (req, reply) => {
      const { status, page, limit } = req.query as {
        status?: 'pending' | 'approved' | 'rejected';
        page?: string;
        limit?: string;
      };
      const data = await merchantApplicationService.listByStatus(
        status || 'pending',
        page ? parseInt(page, 10) : 1,
        limit ? parseInt(limit, 10) : 20,
      );
      return replySuccess(reply, data);
    },
  );

  // GET /:id — Application detail (admin only)
  app.get(
    '/api/merchant-applications/:id',
    { preHandler: [authMiddleware, requireRole('admin')] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const application = await merchantApplicationRepo.findById(parseInt(id, 10));
      if (!application) throw new AppError('申请不存在', 404);
      return replySuccess(reply, application);
    },
  );

  // GET /my — View own application
  app.get(
    '/api/merchant-applications/my',
    { preHandler: [authMiddleware] },
    async (req, reply) => {
      const data = await merchantApplicationService.getMyApplication(req.auth.userId);
      return replySuccess(reply, data);
    },
  );

  // PUT /:id/approve — Approve application (admin only)
  app.put(
    '/api/merchant-applications/:id/approve',
    { preHandler: [authMiddleware, requireRole('admin')] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const data = await merchantApplicationService.approve(parseInt(id, 10), req.auth.userId);
      return replySuccess(reply, data);
    },
  );

  // PUT /:id/reject — Reject application (admin only)
  app.put(
    '/api/merchant-applications/:id/reject',
    { preHandler: [authMiddleware, requireRole('admin')] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { reason } = (req.body || {}) as { reason?: string };
      const data = await merchantApplicationService.reject(parseInt(id, 10), req.auth.userId, reason);
      return replySuccess(reply, data);
    },
  );
}
