import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { userRepo } from '../repositories/user.repo.js';
import { replySuccess, replyError } from '../lib/reply.js';
import { ErrorCodes } from '../lib/error-codes.js';

export async function userRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  app.get('/api/users/me', async (req, reply) => {
    const user = await userRepo.findById(req.auth.userId);
    if (!user) {
      return replyError(reply, ErrorCodes.AUCTION_NOT_FOUND, '用户不存在', 404);
    }
    return replySuccess(reply, user);
  });

  app.put('/api/users/profile', async (req, reply) => {
    const { nickname } = req.body as { nickname: string };
    if (!nickname || typeof nickname !== 'string' || nickname.trim().length < 2 || nickname.trim().length > 20) {
      return replyError(reply, ErrorCodes.INVALID_PARAMS, '昵称长度需在2-20个字符之间');
    }
    const user = await userRepo.updateProfile(req.auth.userId, { nickname: nickname.trim() });
    return replySuccess(reply, user);
  });
}
