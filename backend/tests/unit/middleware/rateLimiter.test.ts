import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

// ---- Mocks (hoisted) ----

const { mockConsume, mockLimiter } = vi.hoisted(() => {
  const mockConsume = vi.fn().mockResolvedValue(undefined);
  const mockLimiter = { consume: mockConsume };
  return { mockConsume, mockLimiter };
});

vi.mock('../../../src/infrastructure/rate-limiter.factory.js', () => ({
  createRateLimiter: vi.fn(() => mockLimiter),
}));

vi.mock('../../../src/middleware/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// Helper: build a minimal FastifyRequest stub with a controllable ip
function makeReq(ip: string | undefined): FastifyRequest {
  return {
    ip,
    socket: { remoteAddress: ip ?? null },
  } as unknown as FastifyRequest;
}

const makeReply = (): FastifyReply => {
  const reply = { code: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
  return reply as unknown as FastifyReply;
};

describe('ipRateLimiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsume.mockResolvedValue(undefined);
  });

  // ---- Whitelist tests (preserved from original) ----

  describe('白名单', () => {
    it('默认配置下 127.0.0.1 命中白名单，跳过限流', async () => {
      const { ipRateLimiter } = await import('../../../src/middleware/rateLimiter.js');
      const mw = ipRateLimiter(10, 60);

      await mw(makeReq('127.0.0.1'), makeReply());

      expect(mockConsume).not.toHaveBeenCalled();
    });

    it('默认配置下 IPv6 loopback ::1 也命中白名单', async () => {
      const { ipRateLimiter } = await import('../../../src/middleware/rateLimiter.js');
      const mw = ipRateLimiter(10, 60);

      await mw(makeReq('::1'), makeReply());

      expect(mockConsume).not.toHaveBeenCalled();
    });

    it('默认配置下 ::ffff:127.0.0.1 (IPv4-mapped) 也命中白名单', async () => {
      const { ipRateLimiter } = await import('../../../src/middleware/rateLimiter.js');
      const mw = ipRateLimiter(10, 60);

      await mw(makeReq('::ffff:127.0.0.1'), makeReply());

      expect(mockConsume).not.toHaveBeenCalled();
    });

    it('可通过 IP_RATE_LIMIT_WHITELIST 环境变量覆盖白名单', async () => {
      const original = process.env.IP_RATE_LIMIT_WHITELIST;
      process.env.IP_RATE_LIMIT_WHITELIST = '10.0.0.1';
      vi.resetModules();
      const { ipRateLimiter } = await import('../../../src/middleware/rateLimiter.js');
      const mw = ipRateLimiter(10, 60);

      // 10.0.0.1 在自定义白名单 → 跳过
      await mw(makeReq('10.0.0.1'), makeReply());
      expect(mockConsume).not.toHaveBeenCalled();

      // 127.0.0.1 不在自定义白名单 → 进入限流
      await mw(makeReq('127.0.0.1'), makeReply());
      expect(mockConsume).toHaveBeenCalledOnce();

      if (original === undefined) delete process.env.IP_RATE_LIMIT_WHITELIST;
      else process.env.IP_RATE_LIMIT_WHITELIST = original;
      vi.resetModules();
    });
  });

  // ---- Rate limiting behavior tests ----

  describe('限流行为', () => {
    it('非白名单 IP 未超限时正常放行', async () => {
      const { ipRateLimiter } = await import('../../../src/middleware/rateLimiter.js');
      const mw = ipRateLimiter(10, 60);
      const reply = makeReply();

      await mw(makeReq('203.0.113.5'), reply);

      expect(mockConsume).toHaveBeenCalledOnce();
      expect(reply.code).not.toHaveBeenCalled();
    });

    it('超限时返回 429 和正确响应体', async () => {
      // RateLimiterRes is a plain object with consumedPoints and remainingPoints
      const rateLimiterRes = { consumedPoints: 11, remainingPoints: 0, msBeforeNext: 5000 };
      mockConsume.mockRejectedValue(rateLimiterRes);

      const { ipRateLimiter } = await import('../../../src/middleware/rateLimiter.js');
      const mw = ipRateLimiter(10, 60);
      const reply = makeReply();

      await mw(makeReq('203.0.113.5'), reply);

      expect(reply.code).toHaveBeenCalledWith(429);
      expect(reply.send).toHaveBeenCalledWith({
        code: 42900,
        message: '请求过于频繁，请稍后再试',
      });
    });

    it('consume() 抛出 Error 时 fail-open 放行', async () => {
      mockConsume.mockRejectedValue(new Error('Redis connection lost'));

      const { ipRateLimiter } = await import('../../../src/middleware/rateLimiter.js');
      const mw = ipRateLimiter(10, 60);
      const reply = makeReply();

      await mw(makeReq('203.0.113.5'), reply);

      // Should fail open — no 429 response
      expect(reply.code).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });
  });
});
