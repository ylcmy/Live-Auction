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
  // String ops
  get: (key: string) => redis.get(key),
  set: (key: string, value: string, ttl?: number) => ttl ? redis.set(key, value, 'EX', ttl) : redis.set(key, value),
  del: (key: string) => redis.del(key),
  setnx: (key: string, value: string, ttl?: number) => ttl ? redis.set(key, value, 'EX', ttl, 'NX') : redis.set(key, value, 'NX'),

  // Sorted set ops
  zadd: (key: string, score: number, member: string) => redis.zadd(key, score, member),
  zrange: (key: string, start: number, stop: number) => redis.zrange(key, start, stop, 'WITHSCORES'),
  zrevrange: (key: string, start: number, stop: number) => redis.zrevrange(key, start, stop, 'WITHSCORES'),
  zrank: (key: string, member: string) => redis.zrank(key, member),
  zrevrank: (key: string, member: string) => redis.zrevrank(key, member),
  zcard: (key: string) => redis.zcard(key),

  // Set ops
  sadd: (key: string, ...members: string[]) => redis.sadd(key, ...members),
  srem: (key: string, ...members: string[]) => redis.srem(key, ...members),
  scard: (key: string) => redis.scard(key),
  sismember: (key: string, member: string) => redis.sismember(key, member),

  // Pub/Sub
  publish: (channel: string, message: string) => redis.publish(channel, message),
  subscribe: (channel: string, onMessage: (channel: string, message: string) => void) => {
    const sub = redis.duplicate();
    sub.subscribe(channel);
    sub.on('message', onMessage);
    return sub;
  },

  // Utility
  exists: (key: string) => redis.exists(key),
  expire: (key: string, seconds: number) => redis.expire(key, seconds),
  incrby: (key: string, increment: number) => redis.incrby(key, increment),
};

export { redis };
