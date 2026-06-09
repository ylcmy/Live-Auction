import Redis, { type ChainableCommander } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { logger } from '../../middleware/logger.js';
import { LOCK_RELEASE_SCRIPT, LOCK_RENEW_SCRIPT } from './lua-scripts.js';

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) return null;
    return Math.min(times * 200, 2000);
  },
});

redis.on('error', (err) => logger.error({ err }, 'Redis error'));
redis.on('connect', () => logger.info('Redis connected'));

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

  /**
   * 返回 ioredis pipeline 对象，用于批量执行命令
   */
  pipeline(): ChainableCommander {
    return redis.pipeline();
  },
};

/**
 * 分布式锁：防误删 + 看门狗自动续期
 *
 * 使用方式：
 * 1. 直接使用: const lock = new DistributedLock(redis); await lock.acquire(key, ttlMs); ... await lock.release();
 * 2. 辅助函数: await withLock(redis, key, ttlMs, async (lock) => { ... });
 */
export class DistributedLock {
  private redis: Redis;
  private key: string = '';
  private value: string = '';
  private ttlMs: number = 0;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private _isLost: boolean = false;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  get isLost(): boolean {
    return this._isLost;
  }

  /**
   * 获取分布式锁
   * @returns true 表示获取成功，false 表示锁已被占用
   */
  async acquire(key: string, ttlMs: number): Promise<boolean> {
    this.key = key;
    this.value = uuidv4();
    this.ttlMs = ttlMs;
    this._isLost = false;

    const result = await this.redis.set(key, this.value, 'PX', ttlMs, 'NX');
    if (result !== 'OK') {
      return false;
    }

    // 启动看门狗：每 TTL/3 毫秒续期一次
    this.startWatchdog();
    return true;
  }

  /**
   * 释放分布式锁（防误删：校验锁值）
   */
  async release(): Promise<void> {
    this.stopWatchdog();
    if (this.key && this.value) {
      try {
        await this.redis.eval(LOCK_RELEASE_SCRIPT, 1, this.key, this.value);
      } catch {
        // 释放失败不影响流程，锁会自动过期
      }
    }
    this.key = '';
    this.value = '';
  }

  /**
   * 续期锁（防误续：校验锁值）
   * @returns true 表示续期成功，false 表示锁已不属于当前持有者
   */
  private async renew(): Promise<boolean> {
    if (!this.key || !this.value) return false;

    try {
      const result = await this.redis.eval(LOCK_RENEW_SCRIPT, 1, this.key, this.value, String(this.ttlMs));
      if (result === 0) {
        // 锁已不属于当前持有者，标记为丢失
        this._isLost = true;
        this.stopWatchdog();
        return false;
      }
      return true;
    } catch {
      // Redis 不可用时标记锁丢失
      this._isLost = true;
      this.stopWatchdog();
      return false;
    }
  }

  private startWatchdog(): void {
    const intervalMs = Math.max(Math.floor(this.ttlMs / 3), 1000); // 至少 1 秒
    this.watchdogTimer = setInterval(async () => {
      await this.renew();
    }, intervalMs);
    // 防止定时器阻止进程退出
    if (this.watchdogTimer.unref) {
      this.watchdogTimer.unref();
    }
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }
}

/**
 * 分布式锁辅助函数：获取锁 → 执行回调 → 释放锁
 * @throws 如果获取锁失败或锁在执行期间丢失
 */
export async function withLock<T>(
  redis: Redis,
  key: string,
  ttlMs: number,
  fn: (lock: DistributedLock) => Promise<T>,
): Promise<T> {
  const lock = new DistributedLock(redis);
  const acquired = await lock.acquire(key, ttlMs);
  if (!acquired) {
    throw new Error(`Failed to acquire lock: ${key}`);
  }

  try {
    // 执行前检查锁状态
    if (lock.isLost) {
      throw new Error(`Lock lost before execution: ${key}`);
    }
    return await fn(lock);
  } finally {
    await lock.release();
  }
}

export { redis };
