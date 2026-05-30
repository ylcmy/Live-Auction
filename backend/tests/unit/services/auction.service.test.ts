import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../../src/lib/app-error.js';

// ---------------------------------------------------------------------------
// Mock all dependencies using vi.hoisted so they are available in vi.mock factories
// ---------------------------------------------------------------------------

const { mockProductRepo, mockAuctionSessionRepo, mockAuctionRuleRepo, mockLiveRoomRepo, mockOrderRepo, mockCache, mockBidService, mockTimerManager, mockIO, mockBroadcastToRoom, mockCleanupAuctionCache, mockLogger } = vi.hoisted(() => ({
  mockProductRepo: {
    findById: vi.fn(),
    updateStatus: vi.fn(),
    create: vi.fn(),
    findAll: vi.fn(),
  },
  mockAuctionSessionRepo: {
    findById: vi.fn(),
    findActiveByRoom: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    updatePrice: vi.fn(),
  },
  mockAuctionRuleRepo: {
    findByProductId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockLiveRoomRepo: {
    findById: vi.fn(),
    updateStatus: vi.fn(),
    findByHost: vi.fn(),
  },
  mockOrderRepo: {
    create: vi.fn(),
    findById: vi.fn(),
    findByBuyer: vi.fn(),
    findByMerchantProductIds: vi.fn(),
    updateStatus: vi.fn(),
    findExpiredPendingOrders: vi.fn(),
  },
  mockCache: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    setnx: vi.fn(),
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
  mockBidService: {
    getLeaderboardRaw: vi.fn(),
    getLeaderboard: vi.fn(),
    getUserNickname: vi.fn(),
    getMyRank: vi.fn(),
    processBid: vi.fn(),
  },
  mockTimerManager: {
    schedule: vi.fn(),
    clear: vi.fn(),
    clearAll: vi.fn(),
  },
  mockIO: {
    to: vi.fn(() => ({ emit: vi.fn() })),
    emit: vi.fn(),
  },
  mockBroadcastToRoom: vi.fn(),
  mockCleanupAuctionCache: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../src/repositories/product.repo.js', () => ({ productRepo: mockProductRepo }));
vi.mock('../../../src/repositories/auction-session.repo.js', () => ({ auctionSessionRepo: mockAuctionSessionRepo }));
vi.mock('../../../src/repositories/auction-rule.repo.js', () => ({ auctionRuleRepo: mockAuctionRuleRepo }));
vi.mock('../../../src/repositories/live-room.repo.js', () => ({ liveRoomRepo: mockLiveRoomRepo }));
vi.mock('../../../src/repositories/order.repo.js', () => ({ orderRepo: mockOrderRepo }));
vi.mock('../../../src/infrastructure/cache/redis.js', () => ({ cache: mockCache, redis: mockCache }));
vi.mock('../../../src/infrastructure/db/knex.js', () => ({
  db: Object.assign(vi.fn(() => ({ where: vi.fn().mockReturnThis(), whereIn: vi.fn().mockReturnThis() })), {
    fn: { now: vi.fn() },
  }),
}));
vi.mock('../../../src/services/bid.service.js', () => ({ bidService: mockBidService }));
vi.mock('../../../src/middleware/logger.js', () => ({ logger: mockLogger }));
vi.mock('../../../src/lib/auction-cache.js', () => ({ cleanupAuctionCache: mockCleanupAuctionCache }));
vi.mock('../../../src/ws/rooms.js', () => ({ broadcastToRoom: mockBroadcastToRoom }));
vi.mock('../../../src/services/auction-timer-manager.js', () => ({
  AuctionTimerManager: vi.fn(() => mockTimerManager),
}));

// ---------------------------------------------------------------------------
// Import the service under test (after mocks are set up)
// ---------------------------------------------------------------------------
import { AuctionService } from '../../../src/services/auction.service.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuctionService', () => {
  let service: AuctionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuctionService(mockIO as any, mockTimerManager as any);

    // Default: cache.setnx returns 1 (lock acquired)
    mockCache.setnx.mockResolvedValue(1);
    // Default: cache.get returns null
    mockCache.get.mockResolvedValue(null);
  });

  // =========================================================================
  // startAuction
  // =========================================================================
  describe('startAuction', () => {
    const merchantId = 1;
    const productId = 10;
    const roomId = 100;

    it('should throw 404 when product does not exist', async () => {
      mockProductRepo.findById.mockResolvedValue(undefined);

      await expect(service.startAuction(merchantId, productId, roomId)).rejects.toThrow(AppError);
      await expect(service.startAuction(merchantId, productId, roomId)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 when merchant is not the product owner', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: 999, status: 'listed' });

      await expect(service.startAuction(merchantId, productId, roomId)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 409 when product status is not listed', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: merchantId, status: 'pending' });

      await expect(service.startAuction(merchantId, productId, roomId)).rejects.toMatchObject({ statusCode: 409 });
    });

    it('should throw 404 when room does not exist', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: merchantId, status: 'listed' });
      mockLiveRoomRepo.findById.mockResolvedValue(undefined);

      await expect(service.startAuction(merchantId, productId, roomId)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 when merchant is not the room host', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: merchantId, status: 'listed' });
      mockLiveRoomRepo.findById.mockResolvedValue({ id: roomId, host_id: 999 });

      await expect(service.startAuction(merchantId, productId, roomId)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 409 when room already has an active auction', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: merchantId, status: 'listed' });
      mockLiveRoomRepo.findById.mockResolvedValue({ id: roomId, host_id: merchantId });
      mockAuctionSessionRepo.findActiveByRoom.mockResolvedValue({ id: 1, status: 'active' });

      await expect(service.startAuction(merchantId, productId, roomId)).rejects.toMatchObject({ statusCode: 409 });
    });

    it('should throw 400 when auction rule is not configured', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: merchantId, status: 'listed' });
      mockLiveRoomRepo.findById.mockResolvedValue({ id: roomId, host_id: merchantId });
      mockAuctionSessionRepo.findActiveByRoom.mockResolvedValue(null);
      mockAuctionRuleRepo.findByProductId.mockResolvedValue(null);

      await expect(service.startAuction(merchantId, productId, roomId)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should successfully start an auction and return correct data', async () => {
      const product = { id: productId, merchant_id: merchantId, name: 'Test', description: 'Desc', image_url: 'url', status: 'listed' };
      const room = { id: roomId, host_id: merchantId };
      const rule = { id: 1, product_id: productId, start_price: 100, bid_increment: 10, ceiling_price: 500, duration_seconds: 60, extend_seconds: 20, max_extensions: 10 };
      const sessionId = 42;

      mockProductRepo.findById.mockResolvedValue(product);
      mockLiveRoomRepo.findById.mockResolvedValue(room);
      mockAuctionSessionRepo.findActiveByRoom.mockResolvedValue(null);
      mockAuctionRuleRepo.findByProductId.mockResolvedValue(rule);
      mockAuctionSessionRepo.create.mockResolvedValue(sessionId);

      const result = await service.startAuction(merchantId, productId, roomId);

      // Assert session created with correct data
      expect(mockAuctionSessionRepo.create).toHaveBeenCalledWith({
        product_id: productId,
        rule_id: rule.id,
        room_id: roomId,
        current_price: rule.start_price,
      });

      // Assert statuses updated
      expect(mockProductRepo.updateStatus).toHaveBeenCalledWith(productId, 'active');
      expect(mockLiveRoomRepo.updateStatus).toHaveBeenCalledWith(roomId, 'live');

      // Assert cache populated
      expect(mockCache.set).toHaveBeenCalledWith(`auction:${sessionId}:status`, 'active');
      expect(mockCache.set).toHaveBeenCalledWith(`auction:${sessionId}:extensions`, '0');

      // Assert timer scheduled
      expect(mockTimerManager.schedule).toHaveBeenCalledWith(sessionId, rule.duration_seconds * 1000, expect.any(Function));

      // Assert broadcast to room
      expect(mockBroadcastToRoom).toHaveBeenCalledWith(
        mockIO,
        String(roomId),
        'auction:started',
        expect.objectContaining({ sessionId, status: 'active' }),
      );

      // Assert return value
      expect(result).toMatchObject({
        sessionId,
        status: 'active',
        rule,
        product,
      });
    });
  });

  // =========================================================================
  // settleAuction
  // =========================================================================
  describe('settleAuction', () => {
    const sessionId = 1;

    it('should return empty result when lock cannot be acquired', async () => {
      mockCache.setnx.mockResolvedValue(0);

      const result = await service.settleAuction(sessionId);

      expect(result).toEqual({ winner: null, leaderboard: [], orderId: null });
    });

    it('should return empty result when session not found', async () => {
      mockAuctionSessionRepo.findById.mockResolvedValue(undefined);

      const result = await service.settleAuction(sessionId);

      expect(result).toEqual({ winner: null, leaderboard: [], orderId: null });
    });

    it('should return empty result when auction already ended', async () => {
      mockAuctionSessionRepo.findById.mockResolvedValue({ id: sessionId, status: 'ended' });

      const result = await service.settleAuction(sessionId);

      expect(result).toEqual({ winner: null, leaderboard: [], orderId: null });
    });

    it('should create order for winner when bids exist', async () => {
      const winnerId = 5;
      const winningAmount = 200;
      const orderId = 99;

      mockAuctionSessionRepo.findById.mockResolvedValue({
        id: sessionId,
        product_id: 10,
        room_id: 100,
        status: 'active',
        current_price: 200,
      });

      // Raw leaderboard: alternating userId, score
      mockBidService.getLeaderboardRaw.mockResolvedValue([String(winnerId), String(winningAmount), '3', '180']);
      mockBidService.getUserNickname.mockResolvedValue('WinnerNick');
      mockBidService.getLeaderboard.mockResolvedValue([
        { rank: 1, userId: winnerId, amount: winningAmount },
        { rank: 2, userId: 3, amount: 180 },
      ]);

      mockOrderRepo.create.mockResolvedValue(orderId);

      const result = await service.settleAuction(sessionId);

      // Assert order created
      expect(mockOrderRepo.create).toHaveBeenCalledWith({
        session_id: sessionId,
        buyer_id: winnerId,
        product_id: 10,
        final_price: winningAmount,
      });

      // Assert session status updated to 'ended'
      expect(mockAuctionSessionRepo.updateStatus).toHaveBeenCalledWith(
        sessionId,
        'ended',
        expect.objectContaining({ winner_id: winnerId }),
      );

      // Assert product status updated
      expect(mockProductRepo.updateStatus).toHaveBeenCalledWith(10, 'ended');

      // Assert broadcast sent
      expect(mockBroadcastToRoom).toHaveBeenCalledWith(
        mockIO,
        '100',
        'auction:ended',
        expect.objectContaining({ status: 'ended', orderId }),
      );

      // Assert timer cleared
      expect(mockTimerManager.clear).toHaveBeenCalledWith(sessionId);

      // Assert cache cleanup
      expect(mockCleanupAuctionCache).toHaveBeenCalledWith(sessionId, 100);

      // Assert return value
      expect(result.winner).toMatchObject({ userId: winnerId, userNickname: 'WinnerNick', finalPrice: winningAmount });
      expect(result.orderId).toBe(orderId);
    });

    it('should mark as unsold when no bids exist', async () => {
      mockAuctionSessionRepo.findById.mockResolvedValue({
        id: sessionId,
        product_id: 10,
        room_id: 100,
        status: 'active',
        current_price: 100,
      });

      // Empty leaderboard (no bids)
      mockBidService.getLeaderboardRaw.mockResolvedValue([]);
      mockBidService.getLeaderboard.mockResolvedValue([]);

      const result = await service.settleAuction(sessionId);

      expect(mockAuctionSessionRepo.updateStatus).toHaveBeenCalledWith(
        sessionId,
        'unsold',
        expect.objectContaining({ winner_id: undefined }),
      );
      expect(mockProductRepo.updateStatus).toHaveBeenCalledWith(10, 'unsold');
      expect(mockOrderRepo.create).not.toHaveBeenCalled();
      expect(result.winner).toBeNull();
      expect(result.orderId).toBeNull();
    });
  });

  // =========================================================================
  // extendAuction
  // =========================================================================
  describe('extendAuction', () => {
    const sessionId = 1;

    it('should return null when session not found', async () => {
      mockCache.get.mockResolvedValue(null);
      mockAuctionSessionRepo.findById.mockResolvedValue(undefined);

      const result = await service.extendAuction(sessionId);
      expect(result).toBeNull();
    });

    it('should return null when rule not found', async () => {
      mockCache.get.mockResolvedValue('0');
      mockAuctionSessionRepo.findById.mockResolvedValue({ id: sessionId, product_id: 10 });
      mockAuctionRuleRepo.findByProductId.mockResolvedValue(null);

      const result = await service.extendAuction(sessionId);
      expect(result).toBeNull();
    });

    it('should return null when max extensions reached', async () => {
      // extensions = 10, max_extensions = 10
      mockCache.get.mockImplementation(async (key: string) => {
        if (key === `auction:${sessionId}:extensions`) return '10';
        return null;
      });
      mockAuctionSessionRepo.findById.mockResolvedValue({ id: sessionId, product_id: 10 });
      mockAuctionRuleRepo.findByProductId.mockResolvedValue({ id: 1, max_extensions: 10, extend_seconds: 20 });

      const result = await service.extendAuction(sessionId);
      expect(result).toBeNull();
    });

    it('should return null when remaining time exceeds extend window', async () => {
      const futureEndTime = Date.now() + 60000; // 60 seconds remaining
      mockCache.get.mockImplementation(async (key: string) => {
        if (key === `auction:${sessionId}:extensions`) return '0';
        if (key === `auction:${sessionId}:end_time`) return String(futureEndTime);
        return null;
      });
      mockAuctionSessionRepo.findById.mockResolvedValue({ id: sessionId, product_id: 10 });
      mockAuctionRuleRepo.findByProductId.mockResolvedValue({ id: 1, max_extensions: 10, extend_seconds: 20 });

      const result = await service.extendAuction(sessionId);
      expect(result).toBeNull();
    });

    it('should extend auction when within extend window', async () => {
      const nearEndTime = Date.now() + 5000; // 5 seconds remaining (within 20s extend window)
      mockCache.get.mockImplementation(async (key: string) => {
        if (key === `auction:${sessionId}:extensions`) return '0';
        if (key === `auction:${sessionId}:end_time`) return String(nearEndTime);
        return null;
      });
      mockAuctionSessionRepo.findById.mockResolvedValue({ id: sessionId, product_id: 10 });
      mockAuctionRuleRepo.findByProductId.mockResolvedValue({ id: 1, max_extensions: 10, extend_seconds: 20 });

      const result = await service.extendAuction(sessionId);

      expect(result).not.toBeNull();
      expect(result!.extensionCount).toBe(1);
      expect(result!.remainingMs).toBe(20 * 1000);

      // Assert cache updated
      expect(mockCache.set).toHaveBeenCalledWith(`auction:${sessionId}:extensions`, '1');

      // Assert DB updated
      expect(mockAuctionSessionRepo.updateStatus).toHaveBeenCalledWith(sessionId, 'active', { extension_count: 1 });

      // Assert timer rescheduled
      expect(mockTimerManager.schedule).toHaveBeenCalledWith(sessionId, 20 * 1000, expect.any(Function));
    });
  });

  // =========================================================================
  // buildAuctionState
  // =========================================================================
  describe('buildAuctionState', () => {
    const sessionId = 1;

    it('should return null when session not found', async () => {
      mockAuctionSessionRepo.findById.mockResolvedValue(undefined);
      const result = await service.buildAuctionState(sessionId);
      expect(result).toBeNull();
    });

    it('should return null when product or rule not found', async () => {
      mockAuctionSessionRepo.findById.mockResolvedValue({ id: sessionId, product_id: 10, status: 'active', current_price: 200 });
      mockProductRepo.findById.mockResolvedValue(null);
      mockAuctionRuleRepo.findByProductId.mockResolvedValue(null);

      const result = await service.buildAuctionState(sessionId);
      expect(result).toBeNull();
    });

    it('should return full state object with correct data', async () => {
      const session = { id: sessionId, product_id: 10, status: 'active', current_price: 200, started_at: new Date() };
      const product = { id: 10, name: 'Test', description: 'Desc', image_url: 'url' };
      const rule = { id: 1, start_price: 100, bid_increment: 10, ceiling_price: 500, duration_seconds: 60, extend_seconds: 20, max_extensions: 10 };
      const leaderboard = [{ rank: 1, userId: 2, amount: 200 }];

      mockAuctionSessionRepo.findById.mockResolvedValue(session);
      mockProductRepo.findById.mockResolvedValue(product);
      mockAuctionRuleRepo.findByProductId.mockResolvedValue(rule);
      mockBidService.getLeaderboard.mockResolvedValue(leaderboard);

      // getAuctionTimer
      mockCache.get.mockImplementation(async (key: string) => {
        if (key === `auction:${sessionId}:end_time`) return String(Date.now() + 30000);
        if (key === `auction:${sessionId}:extensions`) return '2';
        return null;
      });

      const result = await service.buildAuctionState(sessionId, 2);

      expect(result).not.toBeNull();
      expect(result!.sessionId).toBe(sessionId);
      expect(result!.status).toBe('active');
      expect(result!.currentPrice).toBe(200);
      expect(result!.leaderboard).toEqual(leaderboard);
      expect(result!.extensionCount).toBe(2);
      expect((result!.product as any).name).toBe('Test');
      expect((result!.rule as any).startPrice).toBe(100);
    });
  });

  // =========================================================================
  // cancelAuction
  // =========================================================================
  describe('cancelAuction', () => {
    const sessionId = 1;
    const merchantId = 1;

    it('should throw 404 when session not found', async () => {
      mockAuctionSessionRepo.findById.mockResolvedValue(undefined);
      await expect(service.cancelAuction(sessionId, merchantId)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 when merchant is not owner', async () => {
      mockAuctionSessionRepo.findById.mockResolvedValue({ id: sessionId, product_id: 10, room_id: 100, status: 'active' });
      mockProductRepo.findById.mockResolvedValue({ id: 10, merchant_id: 999 });

      await expect(service.cancelAuction(sessionId, merchantId)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 409 when auction already ended', async () => {
      mockAuctionSessionRepo.findById.mockResolvedValue({ id: sessionId, product_id: 10, room_id: 100, status: 'ended' });
      mockProductRepo.findById.mockResolvedValue({ id: 10, merchant_id: merchantId });

      await expect(service.cancelAuction(sessionId, merchantId)).rejects.toMatchObject({ statusCode: 409 });
    });

    it('should successfully cancel an active auction', async () => {
      mockAuctionSessionRepo.findById.mockResolvedValue({ id: sessionId, product_id: 10, room_id: 100, status: 'active' });
      mockProductRepo.findById.mockResolvedValue({ id: 10, merchant_id: merchantId });

      await service.cancelAuction(sessionId, merchantId);

      expect(mockAuctionSessionRepo.updateStatus).toHaveBeenCalledWith(sessionId, 'cancelled', expect.anything());
      expect(mockProductRepo.updateStatus).toHaveBeenCalledWith(10, 'listed');
      expect(mockTimerManager.clear).toHaveBeenCalledWith(sessionId);
      expect(mockCleanupAuctionCache).toHaveBeenCalledWith(sessionId, 100);
    });
  });
});
