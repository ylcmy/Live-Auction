import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { sortedSets, mockCache, mockRedis } = vi.hoisted(() => {
  const sortedSets = new Map<string, Map<string, number>>();

  const mockCache = {
    zadd: vi.fn(async (key: string, score: number, member: string) => {
      if (!sortedSets.has(key)) sortedSets.set(key, new Map());
      sortedSets.get(key)!.set(member, score);
      return 1;
    }),
    zcard: vi.fn(async (key: string) => sortedSets.get(key)?.size ?? 0),
    expire: vi.fn(async (_key: string, _seconds: number) => 1),
  };

  const mockRedis = {
    zremrangebyscore: vi.fn(async (key: string, min: number, max: number) => {
      const set = sortedSets.get(key);
      if (!set) return 0;
      let removed = 0;
      for (const [member, score] of set) {
        if (score >= min && score <= max) {
          set.delete(member);
          removed++;
        }
      }
      return removed;
    }),
  };

  return { sortedSets, mockCache, mockRedis };
});

vi.mock('../../../src/infrastructure/cache/redis.js', () => ({
  cache: mockCache,
  redis: mockRedis,
}));

import { rateLimiter } from '../../../src/middleware/rateLimiter.js';

function createMockRequest(userId: number) {
  return { auth: { userId, role: 'user' } } as any;
}

function createMockReply() {
  return {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as any;
}

describe('rateLimiter', () => {
  let dateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sortedSets.clear();
    vi.clearAllMocks();
    dateSpy = vi.spyOn(Date, 'now');
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  it('should allow request when under the limit', async () => {
    // Arrange
    dateSpy.mockReturnValue(1000);
    const handler = rateLimiter(5, 1);
    const req = createMockRequest(1);
    const reply = createMockReply();

    // Act
    await handler(req, reply);

    // Assert
    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('should return 429 when request count exceeds the limit', async () => {
    // Arrange: use unique timestamps so each entry has a distinct member
    dateSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1001)
      .mockReturnValueOnce(1002);
    const handler = rateLimiter(2, 1);

    // Act: first 2 requests pass
    await handler(createMockRequest(1), createMockReply());
    await handler(createMockRequest(1), createMockReply());

    // 3rd request exceeds limit
    const reply = createMockReply();
    await handler(createMockRequest(1), reply);

    // Assert
    expect(reply.code).toHaveBeenCalledWith(429);
    const body = reply.send.mock.calls[0][0];
    expect(body.code).toBe(42900);
    expect(body.message).toBe('请求过于频繁，请稍后再试');
  });

  it('should reset count when the window has expired', async () => {
    // Arrange: 2 entries at t=1000/1001, then request at t=2002 (window=1s)
    dateSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1001)
      .mockReturnValueOnce(2002);
    const handler = rateLimiter(2, 1);

    // Act: fill up the limit
    await handler(createMockRequest(1), createMockReply());
    await handler(createMockRequest(1), createMockReply());

    // New window: zremrangebyscore(key, 0, 2002-1000=1002) removes entries
    // with score <= 1002, clearing both old entries
    const reply = createMockReply();
    await handler(createMockRequest(1), reply);

    // Assert: request allowed after window reset
    expect(reply.code).not.toHaveBeenCalled();
    expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
      'ratelimit:1',
      0,
      1002,
    );
  });

  it('should allow the Nth request at the boundary', async () => {
    // Arrange: unique timestamps for each of 5 requests
    for (let i = 0; i < 5; i++) {
      dateSpy.mockReturnValueOnce(1000 + i);
    }
    const handler = rateLimiter(5, 1);

    // Act: exactly maxRequests (5) requests should all pass
    for (let i = 0; i < 5; i++) {
      const reply = createMockReply();
      await handler(createMockRequest(1), reply);
      expect(reply.code).not.toHaveBeenCalled();
    }
  });

  it('should reject the (N+1)th request at the boundary', async () => {
    // Arrange: unique timestamps for 6 requests
    for (let i = 0; i < 6; i++) {
      dateSpy.mockReturnValueOnce(1000 + i);
    }
    const handler = rateLimiter(5, 1);

    // Act: 5 requests pass, 6th should be rejected
    for (let i = 0; i < 5; i++) {
      await handler(createMockRequest(1), createMockReply());
    }

    const reply = createMockReply();
    await handler(createMockRequest(1), reply);

    // Assert
    expect(reply.code).toHaveBeenCalledWith(429);
  });

  it('should skip rate limiting when userId is missing', async () => {
    // Arrange
    dateSpy.mockReturnValue(1000);
    const handler = rateLimiter(5, 1);
    const req = { auth: undefined } as any;
    const reply = createMockReply();

    // Act
    await handler(req, reply);

    // Assert
    expect(reply.code).not.toHaveBeenCalled();
    expect(mockCache.zadd).not.toHaveBeenCalled();
  });

  it('should use correct cache key per user', async () => {
    // Arrange
    dateSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1001);
    const handler = rateLimiter(5, 1);

    // Act
    await handler(createMockRequest(42), createMockReply());
    await handler(createMockRequest(99), createMockReply());

    // Assert
    expect(mockCache.zadd).toHaveBeenCalledWith('ratelimit:42', 1000, '1000');
    expect(mockCache.zadd).toHaveBeenCalledWith('ratelimit:99', 1001, '1001');
  });

  // =========================================================================
  // T056: Sliding window boundary tests (FR-006 中间件层)
  // =========================================================================
  it('T056: should allow request exactly at the window boundary (just outside expired entries)', async () => {
    // Arrange: 3 requests at t=1000/1001/1002 with limit=3, window=1s
    // Then at t=2001 (window expired), a new request should pass
    for (let i = 0; i < 3; i++) {
      dateSpy.mockReturnValueOnce(1000 + i);
    }
    const handler = rateLimiter(3, 1);

    for (let i = 0; i < 3; i++) {
      await handler(createMockRequest(1), createMockReply());
    }

    // New request at t=2001 → window [2001-1000, 2001] = [1001, 2001]
    // zremrangebyscore removes entries with score <= 1001
    // Old entries: {1000, 1001, 1002} → 1000 and 1001 removed → 1 remaining
    // New entry added → 2 total → under limit of 3
    dateSpy.mockReturnValueOnce(2001);
    const reply = createMockReply();
    await handler(createMockRequest(1), reply);

    // Assert: request allowed
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('T056: should reject when sliding window has exactly maxRequests within window', async () => {
    // Arrange: 3 requests clustered at t=1000/1001/1002 with limit=3, window=2s
    for (let i = 0; i < 3; i++) {
      dateSpy.mockReturnValueOnce(1000 + i);
    }
    const handler = rateLimiter(3, 2); // 2-second window

    for (let i = 0; i < 3; i++) {
      await handler(createMockRequest(1), createMockReply());
    }

    // t=1500 is still within the 2s window starting at 1000
    // All 3 old entries still valid + new request = 4 → over limit
    dateSpy.mockReturnValueOnce(1500);
    const reply = createMockReply();
    await handler(createMockRequest(1), reply);

    // Assert: rejected
    expect(reply.code).toHaveBeenCalledWith(429);
  });

  it('T056: should allow request when old entries slide out of window', async () => {
    // Arrange: 3 requests at t=1000/1001/1002 with limit=3, window=1s
    for (let i = 0; i < 3; i++) {
      dateSpy.mockReturnValueOnce(1000 + i);
    }
    const handler = rateLimiter(3, 1); // 1-second window

    for (let i = 0; i < 3; i++) {
      await handler(createMockRequest(1), createMockReply());
    }

    // t=3000 → all entries outside window → all removed → fresh start
    dateSpy.mockReturnValueOnce(3000);
    const reply = createMockReply();
    await handler(createMockRequest(1), reply);

    // Assert: allowed (all old entries expired)
    expect(reply.code).not.toHaveBeenCalled();
    expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
      'ratelimit:1',
      0,
      2000, // 3000 - 1000 (window seconds * 1000)
    );
  });

  it('T056: should track different users independently in sliding window', async () => {
    // Arrange: user 1 fills up the limit
    for (let i = 0; i < 3; i++) {
      dateSpy.mockReturnValueOnce(1000 + i);
    }
    const handler = rateLimiter(3, 1);

    for (let i = 0; i < 3; i++) {
      await handler(createMockRequest(1), createMockReply());
    }

    // User 2 at same time → should be allowed (separate window)
    dateSpy.mockReturnValueOnce(1003);
    const reply2 = createMockReply();
    await handler(createMockRequest(2), reply2);

    // Assert: user 2's request allowed
    expect(reply2.code).not.toHaveBeenCalled();

    // User 1 should still be blocked
    dateSpy.mockReturnValueOnce(1004);
    const reply1 = createMockReply();
    await handler(createMockRequest(1), reply1);
    expect(reply1.code).toHaveBeenCalledWith(429);
  });
});
