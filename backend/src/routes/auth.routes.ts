import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { authService } from '../services/auth.service.js';
import { captchaService } from '../services/captcha.service.js';
import { replySuccess } from '../lib/reply.js';
import { ipRateLimiter } from '../middleware/rateLimiter.js';
import { AppError } from '../lib/app-error.js';
import { logger } from '../middleware/logger.js';

export async function authRoutes(app: FastifyInstance) {
  // Rate limiters for unauthenticated endpoints
  const loginRateLimit = ipRateLimiter(10, 60);    // 10 req/min per IP
  const registerRateLimit = ipRateLimiter(5, 3600); // 5 req/hour per IP

  // GET /api/auth/captcha — Generate a new captcha session (returns sessionId)
  app.get('/api/auth/captcha', async (_req, reply) => {
    const sessionId = randomUUID();
    return replySuccess(reply, { sessionId });
  });

  // POST /api/auth/captcha — Store the puzzle x position for a session
  // Frontend calls this after createPuzzle() generates the puzzle and returns x
  app.post('/api/auth/captcha', async (req, reply) => {
    const { sessionId, x } = req.body as { sessionId?: string; x?: number };
    if (!sessionId || typeof x !== 'number') {
      throw new AppError('参数无效', 400);
    }
    await captchaService.storePosition(sessionId, x);
    return replySuccess(reply, { stored: true });
  });

  app.post(
    '/api/auth/register',
    {
      preHandler: [registerRateLimit],
      schema: {
        body: {
          type: 'object',
          required: ['username', 'password', 'nickname', 'captchaToken'],
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 50 },
            password: { type: 'string', minLength: 6 },
            nickname: { type: 'string', minLength: 1 },
            captchaToken: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      const body = req.body as { username: string; password: string; nickname: string; captchaToken: string };

      // Validate captcha token
      // captchaToken format: "sessionId:submittedX" (2 parts)
      const tokenParts = body.captchaToken.split(':');
      if (tokenParts.length !== 2) {
        throw new AppError('验证码无效', 400);
      }
      const [sessionId, xStr] = tokenParts;
      const submittedX = Number(xStr);
      if (!Number.isFinite(submittedX)) {
        throw new AppError('验证码无效', 400);
      }
      const valid = await captchaService.verify(sessionId!, submittedX);
      if (!valid) {
        logger.warn({ event: 'auth.captcha_failed', sessionId });
        throw new AppError('验证码校验失败', 400);
      }

      const data = await authService.register({
        username: body.username,
        password: body.password,
        nickname: body.nickname,
        captchaToken: body.captchaToken,
      });
      return replySuccess(reply, data, 201);
    },
  );

  app.post(
    '/api/auth/login',
    {
      preHandler: [loginRateLimit],
      schema: {
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const { username, password } = req.body as any;
      const data = await authService.login(username, password);
      return replySuccess(reply, data);
    },
  );

  app.post(
    '/api/auth/refresh',
    {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const data = await authService.refresh(
        (req.body as any).refreshToken,
      );
      return replySuccess(reply, data);
    },
  );
}
