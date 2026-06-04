import { FastifyReply } from 'fastify';

export function replySuccess(reply: FastifyReply, data: unknown, statusCode = 200) {
  return reply.code(statusCode).send({ code: 0, message: 'ok', data, timestamp: Date.now() });
}

export function replyError(reply: FastifyReply, code: number, message: string, statusCode = 400) {
  return reply.code(statusCode).send({ code, message, data: null, timestamp: Date.now() });
}
