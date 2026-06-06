/**
 * Rate limiter middleware using Redis sorted sets (sliding window).
 *
 * Limits the number of requests per user within a configurable time window.
 * Uses a sorted set where scores are timestamps, allowing efficient
 * window-based counting and cleanup.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { cache, redis, isRedisAvailable } from '../infrastructure/cache/redis.js';

/**
 * Create a rate limiter middleware.
 *
 * @param maxRequests - Maximum requests allowed within the window
 * @param windowSeconds - Time window in seconds
 */
export function rateLimiter(maxRequests: number, windowSeconds: number) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).auth?.userId;
    if (!userId) return; // Skip if no user (auth middleware handles this)

    // Redis 不可用时限流器降级跳过（fail open）
    if (!isRedisAvailable()) return;

    const key = `ratelimit:${userId}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    // Remove entries outside the sliding window
    await redis.zremrangebyscore(key, 0, now - windowMs);

    // Count current entries in window
    const count = await cache.zcard(key);

    if (count >= maxRequests) {
      reply.code(429).send({
        code: 42900,
        message: '请求过于频繁，请稍后再试',
      });
      return;
    }

    // Add current request timestamp
    await cache.zadd(key, now, String(now));
    await cache.expire(key, windowSeconds);
  };
}
