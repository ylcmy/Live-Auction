import { FastifyInstance } from 'fastify';
import { logger } from './logger.js';
import { AppError } from '../lib/app-error.js';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    logger.error({ err: error, url: request.url }, 'unhandled error');
    const statusCode = error.statusCode || 500;
    const code = error instanceof AppError ? error.code : (statusCode >= 500 ? 50000 : statusCode * 100);
    reply.code(statusCode).send({
      code,
      message: statusCode >= 500 ? '服务器内部错误' : error.message,
      data: null,
      timestamp: Date.now(),
    });
  });
}
