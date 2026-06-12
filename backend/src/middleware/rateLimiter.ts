/**
 * Rate limiter middleware for Fastify.
 *
 * Uses rate-limiter-flexible via the shared factory. Only IP-based
 * limiting is exposed (userId-based limiter was unused dead code).
 *
 * Fail-open: when Redis is unavailable the middleware skips limiting.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { createRateLimiter } from '../infrastructure/rate-limiter.factory.js';
import { logger } from './logger.js';
import { env } from '../config/env.js';

/**
 * IP addresses exempt from IP-based rate limiting.
 * Sourced from IP_RATE_LIMIT_WHITELIST env var (comma-separated).
 * Defaults to loopback addresses for local development.
 */
const IP_WHITELIST: ReadonlySet<string> = new Set(
  env.IP_RATE_LIMIT_WHITELIST.split(',').map((s) => s.trim()).filter(Boolean),
);

/** Cache of limiter instances keyed by "points:duration" */
const limiterCache = new Map<string, RateLimiterRedis | RateLimiterMemory>();

function getOrCreateLimiter(maxRequests: number, windowSeconds: number) {
  const cacheKey = `${maxRequests}:${windowSeconds}`;
  let limiter = limiterCache.get(cacheKey);
  if (!limiter) {
    limiter = createRateLimiter({
      keyPrefix: `rl:ip`,
      points: maxRequests,
      duration: windowSeconds,
    });
    limiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

/**
 * Create a rate limiter middleware keyed by client IP.
 * Intended for unauthenticated endpoints (login, register) where no userId exists.
 *
 * @param maxRequests - Maximum requests allowed within the window
 * @param windowSeconds - Time window in seconds
 */
export function ipRateLimiter(maxRequests: number, windowSeconds: number) {
  const limiter = getOrCreateLimiter(maxRequests, windowSeconds);

  return async (req: FastifyRequest, reply: FastifyReply) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // 白名单 IP 直接放行，跳过限流（本地开发或可信内网场景）
    if (IP_WHITELIST.has(ip)) return;

    try {
      await limiter.consume(ip);
    } catch (err) {
      // rate-limiter-flexible throws RateLimiterRes when limit exceeded,
      // and throws Error on Redis connection failure.
      if (err instanceof Error) {
        // Redis 运行时故障，fail-open 放行
        logger.warn({ err, event: 'rate_limiter.fallback' }, 'Rate limiter error, failing open');
        return;
      }

      // RateLimiterRes → 真正被限流
      logger.warn({ event: 'auth.rate_limited', ip, maxRequests, windowSeconds });
      reply.code(429).send({
        code: 42900,
        message: '请求过于频繁，请稍后再试',
      });
      return reply;
    }
  };
}
