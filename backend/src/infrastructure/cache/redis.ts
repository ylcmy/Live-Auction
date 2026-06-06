import Redis from 'ioredis';
import { env } from '../../config/env.js';
import { CircuitBreaker } from './circuit-breaker.js';

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) return null;
    return Math.min(times * 200, 2000);
  },
});

redis.on('error', (err) => console.error('Redis error:', err));
redis.on('connect', () => console.log('Redis connected'));

// Circuit breaker instance for Redis
export const redisCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  openDurationMs: 5000,
});

/**
 * Check if Redis is currently available based on circuit breaker state.
 * Use this to decide which code path (Redis vs MySQL fallback) to take.
 */
export function isRedisAvailable(): boolean {
  return redisCircuitBreaker.isAvailable();
}

/**
 * Get the current Redis mode for health checks and logging.
 */
export function getRedisMode(): 'primary' | 'fallback' {
  return redisCircuitBreaker.isAvailable() ? 'primary' : 'fallback';
}

export const cache = {
  get: (key: string) =>
    redisCircuitBreaker.execute(
      () => redis.get(key),
      () => Promise.resolve(null),
    ),

  set: (key: string, value: string, ttl?: number) =>
    redisCircuitBreaker.execute(
      () => ttl ? redis.set(key, value, 'EX', ttl) : redis.set(key, value),
      () => Promise.resolve('OK' as const),
    ),

  del: (key: string) =>
    redisCircuitBreaker.execute(
      () => redis.del(key),
      () => Promise.resolve(0),
    ),

  setnx: (key: string, value: string, ttl?: number) =>
    redisCircuitBreaker.execute(
      () => ttl ? redis.set(key, value, 'EX', ttl, 'NX') : redis.set(key, value, 'NX'),
      () => Promise.resolve(null as string | null),  // Fallback: act as if lock not acquired
    ),

  zadd: (key: string, score: number, member: string) =>
    redisCircuitBreaker.execute(
      () => redis.zadd(key, score, member),
      () => Promise.resolve(0),
    ),

  zrevrange: (key: string, start: number, stop: number) =>
    redisCircuitBreaker.execute(
      () => redis.zrevrange(key, start, stop, 'WITHSCORES'),
      () => Promise.resolve([] as string[]),
    ),

  zrank: (key: string, member: string) =>
    redisCircuitBreaker.execute(
      () => redis.zrank(key, member),
      () => Promise.resolve(null as number | null),
    ),

  zrevrank: (key: string, member: string) =>
    redisCircuitBreaker.execute(
      () => redis.zrevrank(key, member),
      () => Promise.resolve(null as number | null),
    ),

  zscore: (key: string, member: string) =>
    redisCircuitBreaker.execute(
      () => redis.zscore(key, member),
      () => Promise.resolve(null as string | null),
    ),

  zcard: (key: string) =>
    redisCircuitBreaker.execute(
      () => redis.zcard(key),
      () => Promise.resolve(0),
    ),

  zremrangebyscore: (key: string, min: number | string, max: number | string) =>
    redisCircuitBreaker.execute(
      () => redis.zremrangebyscore(key, min, max),
      () => Promise.resolve(0),
    ),

  sadd: (key: string, ...members: string[]) =>
    redisCircuitBreaker.execute(
      () => redis.sadd(key, ...members),
      () => Promise.resolve(0),
    ),

  srem: (key: string, ...members: string[]) =>
    redisCircuitBreaker.execute(
      () => redis.srem(key, ...members),
      () => Promise.resolve(0),
    ),

  scard: (key: string) =>
    redisCircuitBreaker.execute(
      () => redis.scard(key),
      () => Promise.resolve(0),
    ),

  expire: (key: string, seconds: number) =>
    redisCircuitBreaker.execute(
      () => redis.expire(key, seconds),
      () => Promise.resolve(0),
    ),

  eval: (script: string, keys: string[], args: (string | number)[]): Promise<any> =>
    redisCircuitBreaker.execute(
      () => redis.eval(script, keys.length, ...keys, ...args),
      () => Promise.resolve(null),
    ),
};

export { redis };
