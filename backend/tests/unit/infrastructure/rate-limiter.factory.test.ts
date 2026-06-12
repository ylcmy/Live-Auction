import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mocks (hoisted so vi.mock factories can reference them) ----

const { mockRedis } = vi.hoisted(() => {
  const mockRedis = {} as any;
  return { mockRedis };
});

vi.mock('../../../src/infrastructure/cache/redis.js', () => ({
  redis: mockRedis,
  isRedisAvailable: vi.fn(() => true),
}));

vi.mock('../../../src/middleware/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// Must import after mocks are registered
import { createRateLimiter } from '../../../src/infrastructure/rate-limiter.factory.js';
import { isRedisAvailable } from '../../../src/infrastructure/cache/redis.js';
import { logger } from '../../../src/middleware/logger.js';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isRedisAvailable as any).mockReturnValue(true);
  });

  it('Redis 可用时返回 RateLimiterRedis 实例', () => {
    const limiter = createRateLimiter({
      keyPrefix: 'rl:test',
      points: 10,
      duration: 60,
    });

    expect(limiter).toBeInstanceOf(RateLimiterRedis);
  });

  it('Redis 不可用时返回 RateLimiterMemory 实例并记录 warn 日志', () => {
    (isRedisAvailable as any).mockReturnValue(false);

    const limiter = createRateLimiter({
      keyPrefix: 'rl:mem',
      points: 5,
      duration: 1,
    });

    expect(limiter).toBeInstanceOf(RateLimiterMemory);

    expect(logger.warn).toHaveBeenCalledWith(
      { keyPrefix: 'rl:mem' },
      'Redis unavailable for rate limiter, using memory fallback',
    );
  });

  it('创建参数正确传递到 limiter 实例', () => {
    const limiter = createRateLimiter({
      keyPrefix: 'rl:bid',
      points: 5,
      duration: 1,
      blockDuration: 3,
    });

    expect((limiter as any)._keyPrefix).toBe('rl:bid');
    expect((limiter as any)._points).toBe(5);
    expect((limiter as any)._duration).toBe(1);
    expect((limiter as any)._blockDuration).toBe(3);
  });

  it('blockDuration 默认为 0', () => {
    const limiter = createRateLimiter({
      keyPrefix: 'rl:login',
      points: 10,
      duration: 60,
    });

    expect((limiter as any)._blockDuration).toBe(0);
  });
});
