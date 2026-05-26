import { FastifyInstance } from 'fastify';
import { logger } from './logger.js';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    logger.error({ err: error, url: request.url }, 'unhandled error');
    const statusCode = error.statusCode || 500;
    reply.code(statusCode).send({
      code: statusCode >= 500 ? 50000 : statusCode * 100,
      message: statusCode >= 500 ? '服务器内部错误' : error.message,
      data: null,
      timestamp: Date.now(),
    });
  });
}
