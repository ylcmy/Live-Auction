import { FastifyRequest, FastifyReply } from 'fastify';
import { cache, redis } from '../infrastructure/cache/redis.js';

export function rateLimiter(maxRequests = 5, windowSeconds = 1) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.auth?.userId;
    if (!userId) return;
    const key = `ratelimit:${userId}`;
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    // Add current timestamp and remove old entries
    await cache.zadd(key, now, `${now}`);
    await redis.zremrangebyscore(key, 0, windowStart);
    const count = await cache.zcard(key);
    await cache.expire(key, windowSeconds + 1);

    if (count > maxRequests) {
      return reply.code(429).send({ code: 42900, message: '请求过于频繁，请稍后再试', data: null, timestamp: Date.now() });
    }
  };
}
