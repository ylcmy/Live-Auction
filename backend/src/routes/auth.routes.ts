import { FastifyInstance } from 'fastify';
import { authService } from '../services/auth.service.js';

export async function authRoutes(app: FastifyInstance) {
  app.post(
    '/api/auth/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['username', 'password', 'nickname', 'role'],
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 50 },
            password: { type: 'string', minLength: 6 },
            nickname: { type: 'string', minLength: 1 },
            role: { type: 'string', enum: ['merchant', 'user'] },
          },
        },
      },
    },
    async (req, reply) => {
      const data = await authService.register(req.body as any);
      return reply
        .code(201)
        .send({ code: 0, message: 'ok', data, timestamp: Date.now() });
    },
  );

  app.post(
    '/api/auth/login',
    {
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
      return reply.send({
        code: 0,
        message: 'ok',
        data,
        timestamp: Date.now(),
      });
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
      return reply.send({
        code: 0,
        message: 'ok',
        data,
        timestamp: Date.now(),
      });
    },
  );
}
