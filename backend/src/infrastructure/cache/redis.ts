import Redis from 'ioredis';
import { env } from '../../config/env.js';

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) return null;
    return Math.min(times * 200, 2000);
  },
});

redis.on('error', (err) => console.error('Redis error:', err));
redis.on('connect', () => console.log('Redis connected'));

export const cache = {
  get: (key: string) => redis.get(key),
  set: (key: string, value: string, ttl?: number) => ttl ? redis.set(key, value, 'EX', ttl) : redis.set(key, value),
  del: (key: string) => redis.del(key),
  setnx: (key: string, value: string, ttl?: number) => ttl ? redis.set(key, value, 'EX', ttl, 'NX') : redis.set(key, value, 'NX'),

  zadd: (key: string, score: number, member: string) => redis.zadd(key, score, member),
  zrevrange: (key: string, start: number, stop: number) => redis.zrevrange(key, start, stop, 'WITHSCORES'),
  zrank: (key: string, member: string) => redis.zrank(key, member),
  zrevrank: (key: string, member: string) => redis.zrevrank(key, member),
  zscore: (key: string, member: string) => redis.zscore(key, member),
  zcard: (key: string) => redis.zcard(key),

  sadd: (key: string, ...members: string[]) => redis.sadd(key, ...members),
  srem: (key: string, ...members: string[]) => redis.srem(key, ...members),
  scard: (key: string) => redis.scard(key),

  expire: (key: string, seconds: number) => redis.expire(key, seconds),
};

export { redis };
