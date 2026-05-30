import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock all dependencies using vi.hoisted
// ---------------------------------------------------------------------------

const { mockCache, mockRedis, mockBidRepo, mockAuctionSessionRepo, mockAuctionRuleRepo, mockUserRepo, mockLogger } = vi.hoisted(() => {
  const setnxStore = new Map<string, boolean>();

  return {
    setnxStore,
    mockCache: {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      setnx: vi.fn(async (key: string, _value: string, _ttl?: number) => {
        return setnxStore.get(key) === false ? 0 : 1;
      }),
      zadd: vi.fn(),
      zrevrange: vi.fn(),
      zrevrank: vi.fn(),
      zscore: vi.fn(),
      zcard: vi.fn(),
      sadd: vi.fn(),
      srem: vi.fn(),
      scard: vi.fn(),
      expire: vi.fn(),
    },
    mockRedis: {
      zremrangebyscore: vi.fn(),
      zcard: vi.fn(),
      zadd: vi.fn(),
      expire: vi.fn(),
    },
    mockBidRepo: {
      create: vi.fn(),
      findBySession: vi.fn(),
    },
    mockAuctionSessionRepo: {
      findById: vi.fn(),
      updatePrice: vi.fn(),
      create: vi.fn(),
      findActiveByRoom: vi.fn(),
      updateStatus: vi.fn(),
    },
    mockAuctionRuleRepo: {
      findByProductId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    mockUserRepo: {
      findByIds: vi.fn(),
      findByUsername: vi.fn(),
      create: vi.fn(),
      findById: vi.fn(),
    },
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
});

vi.mock('../../../src/infrastructure/cache/redis.js', () => ({
  cache: mockCache,
  redis: mockRedis,
}));
vi.mock('../../../src/repositories/bid.repo.js', () => ({ bidRepo: mockBidRepo }));
vi.mock('../../../src/repositories/auction-session.repo.js', () => ({ auctionSessionRepo: mockAuctionSessionRepo }));
vi.mock('../../../src/repositories/auction-rule.repo.js', () => ({ auctionRuleRepo: mockAuctionRuleRepo }));
vi.mock('../../../src/repositories/user.repo.js', () => ({ userRepo: mockUserRepo }));
vi.mock('../../../src/middleware/logger.js', () => ({ logger: mockLogger }));

// ---------------------------------------------------------------------------
// Import the service under test
// ---------------------------------------------------------------------------
import { bidService } from '../../../src/services/bid.service.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BidService.processBid', () => {
  const sessionId = 1;
  const userId = 10;
  const idempotencyKey = 'idem_key_123';

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: all setnx succeed (by clearing the blocklist)
    // mockCache.setnx default is already "always returns 1" from the mock factory

    mockCache.set.mockResolvedValue('OK');
    mockCache.zadd.mockResolvedValue(1);
    mockCache.sadd.mockResolvedValue(1);
    mockCache.zrevrank.mockResolvedValue(0);
    mockCache.zrevrange.mockResolvedValue([String(userId), '110']);
    mockCache.del.mockResolvedValue(1);

    // Default: no rate limit entries
    mockRedis.zremrangebyscore.mockResolvedValue(0);
    mockRedis.zcard.mockResolvedValue(0);
    mockRedis.zadd.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);

    // Default: session exists, active
    mockAuctionSessionRepo.findById.mockResolvedValue({
      id: sessionId,
      product_id: 10,
      room_id: 100,
      status: 'active',
      current_price: 100,
    });

    // Default: rule exists
    mockAuctionRuleRepo.findByProductId.mockResolvedValue({
      id: 1,
      product_id: 10,
      start_price: 100,
      bid_increment: 10,
      ceiling_price: 500,
    });

    // Default: no previous bids
    mockBidRepo.findBySession.mockResolvedValue([]);
  });

  // =========================================================================
  // Step 1: Idempotency check
  // =========================================================================
  describe('idempotency check', () => {
    it('should reject when idempotency key already exists', async () => {
      // The mock setnx returns 1 by default (from factory).
      // We need to override just the first call to return 0.
      // Since the factory uses a store, we can't easily do per-call overrides with the current setup.
      // Instead, we mock the implementation for this test.
      mockCache.setnx.mockResolvedValueOnce(0);

      const result = await bidService.processBid(sessionId, userId, idempotencyKey);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(40901);
      expect(result.error?.message).toContain('重复');
    });
  });

  // =========================================================================
  // Step 2: Distributed lock
  // =========================================================================
  describe('distributed lock', () => {
    it('should reject when distributed lock cannot be acquired', async () => {
      // First setnx (idempotency) succeeds, second (lock) fails
      mockCache.setnx
        .mockResolvedValueOnce(1) // idempotency
        .mockResolvedValueOnce(0); // lock

      const result = await bidService.processBid(sessionId, userId, idempotencyKey);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(40901);
      expect(result.error?.message).toContain('处理中');
    });
  });

  // =========================================================================
  // Step 3-4: Context fetch and domain validation
  // =========================================================================
  describe('context validation', () => {
    it('should reject when session not found', async () => {
      mockAuctionSessionRepo.findById.mockResolvedValue(undefined);

      const result = await bidService.processBid(sessionId, userId, idempotencyKey);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(40400);
    });

    it('should reject when auction rule not found', async () => {
      mockAuctionRuleRepo.findByProductId.mockResolvedValue(null);

      const result = await bidService.processBid(sessionId, userId, idempotencyKey);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(50000);
    });

    it('should reject when auction is not active', async () => {
      mockAuctionSessionRepo.findById.mockResolvedValue({
        id: sessionId,
        product_id: 10,
        room_id: 100,
        status: 'ended',
        current_price: 100,
      });

      const result = await bidService.processBid(sessionId, userId, idempotencyKey);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(40900);
    });

    it('should reject when user is the last bidder (consecutive self-bid)', async () => {
      mockBidRepo.findBySession.mockResolvedValue([{ user_id: userId, bid_amount: 110 }]);

      const result = await bidService.processBid(sessionId, userId, idempotencyKey);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(40901);
      expect(result.error?.message).toContain('等待他人');
    });
  });

  // =========================================================================
  // Step 5-6: Successful bid
  // =========================================================================
  describe('successful bid', () => {
    it('should process a valid bid successfully', async () => {
      const result = await bidService.processBid(sessionId, userId, idempotencyKey);

      expect(result.success).toBe(true);
      expect(result.amount).toBe(110); // 100 (current) + 10 (increment)
      expect(result.shouldEnd).toBe(false);

      // Assert leaderboard updated
      expect(mockCache.zadd).toHaveBeenCalledWith(
        `auction:${sessionId}:leaderboard`,
        110,
        String(userId),
      );

      // Assert participant tracked
      expect(mockCache.sadd).toHaveBeenCalledWith(
        `room:100:participants`,
        String(userId),
      );

      // Assert top bid updated
      expect(mockCache.set).toHaveBeenCalledWith(
        `auction:${sessionId}:top_bid`,
        expect.stringContaining(String(userId)),
      );

      // Assert lock released
      expect(mockCache.del).toHaveBeenCalledWith(`bid_lock:${sessionId}:${userId}`);
    });

    it('should return isLeading=true when user is the only bidder', async () => {
      mockCache.zrevrange.mockResolvedValue([String(userId), '110']);

      const result = await bidService.processBid(sessionId, userId, idempotencyKey);

      expect(result.success).toBe(true);
      expect(result.isLeading).toBe(true);
    });

    it('should return isLeading=false and gapToLeader when another user leads', async () => {
      // User 10 bids 110, user 20 leads with 200
      mockCache.zrevrange.mockResolvedValue(['20', '200', String(userId), '110']);
      mockCache.zrevrank.mockResolvedValue(1); // rank 2 (0-indexed)

      const result = await bidService.processBid(sessionId, userId, idempotencyKey);

      expect(result.success).toBe(true);
      expect(result.isLeading).toBe(false);
      expect(result.gapToLeader).toBe(200 - 110);
    });
  });

  // =========================================================================
  // Step 6: Ceiling price
  // =========================================================================
  describe('ceiling price', () => {
    it('should trigger shouldEnd when bid reaches ceiling price', async () => {
      // Set current price so that current + increment >= ceiling
      mockAuctionSessionRepo.findById.mockResolvedValue({
        id: sessionId,
        product_id: 10,
        room_id: 100,
        status: 'active',
        current_price: 490, // 490 + 10 = 500 >= ceiling 500
      });
      mockAuctionRuleRepo.findByProductId.mockResolvedValue({
        id: 1,
        product_id: 10,
        start_price: 100,
        bid_increment: 10,
        ceiling_price: 500,
      });

      const result = await bidService.processBid(sessionId, userId, idempotencyKey);

      expect(result.success).toBe(true);
      expect(result.amount).toBe(500);
      expect(result.shouldEnd).toBe(true);
    });

    it('should not trigger shouldEnd when ceiling price is null', async () => {
      mockAuctionRuleRepo.findByProductId.mockResolvedValue({
        id: 1,
        product_id: 10,
        start_price: 100,
        bid_increment: 10,
        ceiling_price: null,
      });

      const result = await bidService.processBid(sessionId, userId, idempotencyKey);

      expect(result.success).toBe(true);
      expect(result.shouldEnd).toBe(false);
    });
  });

  // =========================================================================
  // Lock release
  // =========================================================================
  describe('lock release', () => {
    it('should always release the lock even on error', async () => {
      mockAuctionSessionRepo.findById.mockRejectedValue(new Error('DB error'));

      try {
        await bidService.processBid(sessionId, userId, idempotencyKey);
      } catch {
        // Expected to throw
      }

      expect(mockCache.del).toHaveBeenCalledWith(`bid_lock:${sessionId}:${userId}`);
    });
  });
});
