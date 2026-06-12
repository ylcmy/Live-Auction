import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mocks (hoisted so vi.mock factories can reference them) ----

const { mockRedis } = vi.hoisted(() => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  };
  return { mockRedis };
});

vi.mock('../../../src/infrastructure/cache/redis.js', () => ({
  redis: mockRedis,
  isRedisAvailable: () => true,
}));

vi.mock('../../../src/middleware/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { captchaService } from '../../../src/services/captcha.service.js';

describe('captchaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('storePosition', () => {
    it('将位置 JSON 序列化后写入 Redis 并设置 5 分钟 TTL', async () => {
      mockRedis.set.mockResolvedValueOnce('OK');

      await captchaService.storePosition('sess-1', 123);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'captcha:sess-1',
        expect.stringContaining('"x":123'),
        'EX',
        300,
      );
    });
  });

  describe('verify', () => {
    it('session 不存在时返回 false', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const ok = await captchaService.verify('missing', 50);

      expect(ok).toBe(false);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('位置在容差内时返回 true 并删除 session（一次性）', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ x: 100, createdAt: 1 }));
      mockRedis.del.mockResolvedValueOnce(1);

      const ok = await captchaService.verify('sess-2', 102); // ±5 之内

      expect(ok).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('captcha:sess-2');
    });

    it('位置正好在容差边界 (±5) 时仍通过', async () => {
      // 两次 verify 都用同一份 session 数据
      mockRedis.get.mockResolvedValue(JSON.stringify({ x: 100, createdAt: 1 }));
      mockRedis.del.mockResolvedValue(1);

      expect(await captchaService.verify('sess-3', 95)).toBe(true);
      expect(await captchaService.verify('sess-3', 105)).toBe(true);
    });

    it('位置超出容差时返回 false', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ x: 100, createdAt: 1 }));

      const ok = await captchaService.verify('sess-4', 110); // 差 10px

      expect(ok).toBe(false);
      // 即使失败也会 DEL 掉 session，防止暴力重放
      expect(mockRedis.del).toHaveBeenCalledWith('captcha:sess-4');
    });

    it('JSON 解析失败时返回 false', async () => {
      mockRedis.get.mockResolvedValueOnce('not-json');

      const ok = await captchaService.verify('sess-5', 50);

      expect(ok).toBe(false);
    });

    it('stored x 非数字时返回 false', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ x: 'oops', createdAt: 1 }));

      const ok = await captchaService.verify('sess-6', 50);

      expect(ok).toBe(false);
    });
  });
});
