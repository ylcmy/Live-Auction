import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mocks (vi.hoisted so vi.mock factories can reference them) ----

const { mockCache, mockRedis } = vi.hoisted(() => {
  const mockCache = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK' as const),
    del: vi.fn().mockResolvedValue(0),
    setnx: vi.fn().mockResolvedValue(null as string | null),
    eval: vi.fn().mockResolvedValue(1),
    zadd: vi.fn().mockResolvedValue(0),
    zrevrange: vi.fn().mockResolvedValue([] as string[]),
    zrevrank: vi.fn().mockResolvedValue(null as number | null),
    zscore: vi.fn().mockResolvedValue(null as string | null),
    expire: vi.fn().mockResolvedValue(0),
    sadd: vi.fn().mockResolvedValue(0),
    zremrangebyscore: vi.fn().mockResolvedValue(0),
    zcard: vi.fn().mockResolvedValue(0),
    pipeline: vi.fn(() => {
      const chain: any = {
        get: vi.fn(() => chain),
        set: vi.fn(() => chain),
        zrevrank: vi.fn(() => chain),
        zadd: vi.fn(() => chain),
        zcard: vi.fn(() => chain),
        expire: vi.fn(() => chain),
        exec: vi.fn(async () => [[null, '0'], [null, '0'], [null, 0]]),
      };
      return chain;
    }),
  };

  const mockRedis = {
    zremrangebyscore: vi.fn().mockResolvedValue(0),
    zcard: vi.fn().mockResolvedValue(0),
    zadd: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  };

  return { mockCache, mockRedis };
});

vi.mock('../../../src/infrastructure/cache/redis.js', () => ({
  cache: mockCache,
  redis: mockRedis,
  isRedisAvailable: () => true,
}));

vi.mock('../../../src/repositories/bid.repo.js', () => ({
  bidRepo: {
    create: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('../../../src/repositories/auction-session.repo.js', () => ({
  auctionSessionRepo: {
    findById: vi.fn(),
    updatePrice: vi.fn().mockResolvedValue(1),
    updateStatus: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('../../../src/repositories/auction-rule.repo.js', () => ({
  auctionRuleRepo: {
    findByProductId: vi.fn(),
  },
}));

vi.mock('../../../src/repositories/product.repo.js', () => ({
  productRepo: {
    findById: vi.fn(),
  },
}));

vi.mock('../../../src/repositories/user.repo.js', () => ({
  userRepo: {
    findByIds: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../src/infrastructure/db/knex.js', () => {
  const mockTrx = {
    where: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    increment: vi.fn().mockResolvedValue(1),
  };
  const mockTrxFn = vi.fn().mockReturnValue(mockTrx);
  return {
    db: Object.assign(
      mockTrxFn,
      {
        fn: { now: vi.fn() },
        transaction: vi.fn().mockImplementation(async (fn) => {
          return fn(mockTrxFn);
        }),
      },
    ),
  };
});

// ---- Import after mocks ----

import { bidService } from '../../../src/services/bid.service.js';
import { auctionSessionRepo } from '../../../src/repositories/auction-session.repo.js';
import { productRepo } from '../../../src/repositories/product.repo.js';
import { auctionRuleRepo } from '../../../src/repositories/auction-rule.repo.js';
import { bidRepo } from '../../../src/repositories/bid.repo.js';
import { BID_CAS_SCRIPT, BID_ROLLBACK_SCRIPT } from '../../../src/infrastructure/cache/lua-scripts.js';

// ---- Helpers ----

function resetMocks() {
  vi.clearAllMocks();

  // Default: setnx returns 'OK' (idempotency key acquired)
  mockCache.setnx.mockResolvedValue('OK');
  // Default: redis rate limit allows
  mockCache.zcard.mockResolvedValue(0);
  mockCache.zremrangebyscore.mockResolvedValue(0);
  // Default: CAS script succeeds
  mockCache.eval.mockResolvedValue(1);
  // Default: no cached context (fallback to MySQL)
  mockCache.get.mockResolvedValue(null);
  // Default: rank 1
  mockCache.zrevrank.mockResolvedValue(0);

  // Default repo mocks
  (auctionSessionRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 100,
    product_id: 10,
    room_id: 1,
    status: 'active',
    current_price: 100,
  });
  (productRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 10,
    merchant_id: 99,
    name: 'Test Product',
  });
  (auctionRuleRepo.findByProductId as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 1,
    bid_increment: 10,
    ceiling_price: null,
    max_extensions: 3,
    extend_seconds: 30,
  });
  (bidRepo.create as ReturnType<typeof vi.fn>).mockResolvedValue(1);
  (auctionSessionRepo.updatePrice as ReturnType<typeof vi.fn>).mockResolvedValue(1);
}

// ---- Tests ----

describe('_processBidRedis (CAS-based)', () => {
  beforeEach(resetMocks);

  it('CAS success: returns success + amount + rank', async () => {
    // Current price 100, increment 10 -> bid should be 110
    mockCache.eval.mockResolvedValue(1); // CAS success
    mockCache.zrevrank.mockResolvedValue(0); // rank 1

    const result = await bidService._processBidRedis(100, 2, 'key-001');

    expect(result.success).toBe(true);
    expect(result.amount).toBe(110);
    expect(result.rank).toBe(1);
    expect(result.isLeading).toBe(true);

    // Verify BID_CAS_SCRIPT was called
    expect(mockCache.eval).toHaveBeenCalledWith(
      BID_CAS_SCRIPT,
      expect.arrayContaining([
        'auction:100:top_bid',
        'auction:100:leaderboard',
      ]),
      expect.arrayContaining([String(2), 110]),
    );

    // Verify MySQL persistence (transactional: bidRepo.create + trx update)
    expect(bidRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: 100,
        user_id: 2,
        bid_amount: 110,
        idempotency_key: 'key-001',
      }),
      expect.anything(), // trx parameter
    );
  });

  it('CAS returns 0: returns failure code 40902', async () => {
    mockCache.eval.mockResolvedValue(0); // CAS failure

    const result = await bidService._processBidRedis(100, 2, 'key-002');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(40902);
    expect(result.error?.message).toContain('过期');

    // Verify MySQL was NOT touched
    expect(bidRepo.create).not.toHaveBeenCalled();
  });

  it('MySQL persistence fails: rolls back Redis and returns 50000', async () => {
    mockCache.eval.mockResolvedValue(1); // CAS success
    // Simulate MySQL failure
    (bidRepo.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('DB connection lost'),
    );

    const result = await bidService._processBidRedis(100, 2, 'key-003');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(50000);

    // Verify rollback script was called
    expect(mockCache.eval).toHaveBeenCalledWith(
      BID_ROLLBACK_SCRIPT,
      expect.arrayContaining([
        'auction:100:leaderboard',
        expect.any(String),
        'auction:100:top_bid',
      ]),
      expect.arrayContaining([String(2)]),
    );
  });

  it('Idempotency key already has result: replays previous success', async () => {
    const previousResult = { amount: 110, rank: 1, isLeading: true };
    mockCache.get.mockImplementation(async (key: string) => {
      if (key === 'idempotent:bid:100:key-004') {
        return JSON.stringify(previousResult);
      }
      return null;
    });

    const result = await bidService._processBidRedis(100, 2, 'key-004');

    expect(result.success).toBe(true);
    expect(result.amount).toBe(110);
    expect(result.rank).toBe(1);
    expect(result.isLeading).toBe(true);

    // Verify no CAS or MySQL operations happened
    expect(mockCache.eval).not.toHaveBeenCalled();
    expect(bidRepo.create).not.toHaveBeenCalled();
  });

  it('Rate limit exceeded: returns 42900', async () => {
    // Rate limit is now checked via cache.eval with BID_RATE_LIMIT_SCRIPT
    // Mock eval to return count >= BID_RATE_LIMIT_MAX (5) for rate limit check
    mockCache.eval.mockImplementation(async (script: string) => {
      if (script.includes('ZREMRANGEBYSCORE') && script.includes('ZCARD')) return 5; // rate limit exceeded
      return 1; // CAS success
    });

    const result = await bidService._processBidRedis(100, 2, 'key-005');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(42900);
    expect(result.error?.message).toContain('频繁');

    // Verify no CAS or MySQL operations happened (rate limit blocked before CAS)
    expect(bidRepo.create).not.toHaveBeenCalled();
  });
});
