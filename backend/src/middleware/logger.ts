import pino from 'pino';
import { FastifyRequest, FastifyReply } from 'fastify';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
});

export function logRequest(request: FastifyRequest, reply: FastifyReply) {
  const start = Date.now();
  reply.then(() => {
    logger.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      ms: Date.now() - start,
    }, 'request completed');
  });
}
