/**
 * Rate limiter factory using rate-limiter-flexible.
 *
 * Centralises limiter creation so consumers don't care whether Redis is
 * available.  When Redis is down the factory returns a RateLimiterMemory
 * instance (fail-open at the middleware layer, bounded fallback at the
 * service layer).
 */

import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { redis, isRedisAvailable } from './cache/redis.js';
import { logger } from '../middleware/logger.js';

export interface RateLimiterOpts {
  /** Unique prefix for the Redis/memory key namespace */
  keyPrefix: string;
  /** Maximum number of requests within the window */
  points: number;
  /** Window length in seconds */
  duration: number;
  /** Seconds to block after exceeding the limit (0 = no block) */
  blockDuration?: number;
}

/**
 * Create a rate limiter backed by Redis when available, falling back to
 * in-memory storage otherwise.
 */
export function createRateLimiter(
  opts: RateLimiterOpts,
): RateLimiterRedis | RateLimiterMemory {
  const { keyPrefix, points, duration, blockDuration = 0 } = opts;

  if (!isRedisAvailable()) {
    logger.warn(
      { keyPrefix },
      'Redis unavailable for rate limiter, using memory fallback',
    );
    return new RateLimiterMemory({ keyPrefix, points, duration, blockDuration });
  }

  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    points,
    duration,
    blockDuration,
  });
}
