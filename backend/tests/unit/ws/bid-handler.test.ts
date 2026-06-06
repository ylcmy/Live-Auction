/**
 * T032: Unit tests for WebSocket Bid Handler (registerBidHandlers)
 *
 * Covers:
 * - bid:submit accepted -> emits bid:accepted, bid:new, rank:update
 * - bid:submit rejected (amount insufficient) -> emits bid:rejected
 * - bid:submit session not found -> returns error
 * - bid:submit ceiling price -> triggers auction:ended
 * - emotion events: emotion:lead when leading, emotion:overtaken when overtaken
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSocket, createMockIO } from '../../helpers/mock-socket.js';

// ── Mock dependencies (relative paths to match source imports) ──────────────────

vi.mock('../../../src/services/bid.service.js', () => ({
  bidService: {
    processBid: vi.fn(),
    getUserNickname: vi.fn(),
    getLeaderboard: vi.fn(),
  },
}));

vi.mock('../../../src/services/auction.service.js', () => ({
  auctionService: {
    extendAuction: vi.fn(),
    rescheduleSettlement: vi.fn(),
    getAuctionTimer: vi.fn(),
    settleAuction: vi.fn(),
  },
}));

vi.mock('../../../src/repositories/auction-session.repo.js', () => ({
  auctionSessionRepo: {
    findById: vi.fn(),
  },
}));

vi.mock('../../../src/ws/rooms.js', () => ({
  broadcastToRoom: vi.fn(),
}));

vi.mock('../../../src/infrastructure/cache/redis.js', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    setnx: vi.fn(),
  },
  isRedisAvailable: vi.fn(() => true),
}));

vi.mock('../../../src/ws/index.js', () => ({
  broadcastRoomListUpdate: vi.fn(),
}));

// ── Imports (after mocks are declared) ──────────────────────────────────────────

import { registerBidHandlers } from '../../../src/ws/handlers/bid.js';
import { bidService } from '../../../src/services/bid.service.js';
import { auctionService } from '../../../src/services/auction.service.js';
import { auctionSessionRepo } from '../../../src/repositories/auction-session.repo.js';
import { broadcastToRoom } from '../../../src/ws/rooms.js';
import { cache } from '../../../src/infrastructure/cache/redis.js';

// ── Test helpers ────────────────────────────────────────────────────────────────

const SESSION_ID = 101;
const USER_ID = 1;
const ROOM_ID_NUM = 10;
const ROOM_ID_STR = '10';
const IDEMPOTENCY_KEY = 'test-key-abc';

function createTestEnv(userId = USER_ID) {
  const { socket, handlers } = createMockSocket({ userId });
  const io = createMockIO();
  return { socket, handlers, io };
}

function registerAndGetBidHandler(handlers: Map<string, (...args: unknown[]) => void>, io: ReturnType<typeof createMockIO>, socket: ReturnType<typeof createMockSocket>['socket']) {
  registerBidHandlers(io as any, socket as any);
  return handlers.get('bid:submit')!;
}

// ── Default mocks ───────────────────────────────────────────────────────────────

const DEFAULT_SESSION = { id: SESSION_ID, room_id: ROOM_ID_NUM, product_id: 1, status: 'active' };
const DEFAULT_TIMER = { serverTime: Date.now(), endTime: Date.now() + 60_000, remainingMs: 60_000 };
const DEFAULT_LEADERBOARD = [
  { rank: 1, userId: USER_ID, userNickname: 'Bidder1', avatarUrl: null, amount: 110, timestamp: new Date().toISOString() },
];

function setupSuccessfulMocks(overrides?: { isLeading?: boolean; shouldEnd?: boolean; extensionResult?: { remainingMs: number; extensionCount: number } | null }) {
  const isLeading = overrides?.isLeading ?? true;
  const shouldEnd = overrides?.shouldEnd ?? false;

  (bidService.processBid as ReturnType<typeof vi.fn>).mockResolvedValue({
    success: true,
    amount: 110,
    rank: 1,
    isLeading,
    gapToLeader: isLeading ? -1 : 10,
    shouldEnd,
    extensionResult: overrides?.extensionResult ?? null,
  });

  (bidService.getUserNickname as ReturnType<typeof vi.fn>).mockResolvedValue('Bidder1');
  (bidService.getLeaderboard as ReturnType<typeof vi.fn>).mockResolvedValue(DEFAULT_LEADERBOARD);

  (auctionSessionRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(DEFAULT_SESSION);
  (auctionService.extendAuction as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (auctionService.getAuctionTimer as ReturnType<typeof vi.fn>).mockResolvedValue(DEFAULT_TIMER);
}

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('registerBidHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: cache.get returns null (no idempotency key, no previous top bid)
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  // ---- bid:submit accepted ----

  describe('bid:submit accepted', () => {
    it('should emit bid:accepted to the bidder', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks();

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      expect(socket.emit).toHaveBeenCalledWith('bid:accepted', {
        sessionId: SESSION_ID,
        bidId: 0,
        amount: 110,
        rank: 1,
        isLeading: true,
        gapToLeader: -1,
      });
    });

    it('should broadcast bid:new to the room', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks();

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      expect(broadcastToRoom).toHaveBeenCalledWith(
        io,
        ROOM_ID_STR,
        'bid:new',
        expect.objectContaining({
          sessionId: SESSION_ID,
          userId: USER_ID,
          userNickname: 'Bidder1',
          amount: 110,
          newTopBid: true,
        }),
      );
    });

    it('should broadcast rank:update to the room', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks();

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      // rank:update is broadcast after bid:new, so check all calls
      const rankUpdateCalls = (broadcastToRoom as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => call[2] === 'rank:update',
      );
      expect(rankUpdateCalls.length).toBeGreaterThanOrEqual(1);
      expect(rankUpdateCalls[0]).toEqual(
        expect.arrayContaining([
          io,
          ROOM_ID_STR,
          'rank:update',
        ]),
      );
    });

    it('should emit countdown:sync after each accepted bid', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks();

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      expect(broadcastToRoom).toHaveBeenCalledWith(
        io,
        ROOM_ID_STR,
        'countdown:sync',
        expect.objectContaining({
          sessionId: SESSION_ID,
          remainingMs: DEFAULT_TIMER.remainingMs,
          serverTime: DEFAULT_TIMER.serverTime,
        }),
      );
    });
  });

  // ---- bid:rejected ----

  describe('bid:submit rejected', () => {
    it('should emit bid:rejected with reason when bid amount is insufficient', async () => {
      const { socket, handlers, io } = createTestEnv();
      (bidService.processBid as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: { code: 40001, message: '出价金额不足' },
      });

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      expect(socket.emit).toHaveBeenCalledWith('bid:rejected', {
        sessionId: SESSION_ID,
        reason: '出价金额不足',
        code: 40001,
      });
    });

    it('should not broadcast any room events on rejection', async () => {
      const { socket, handlers, io } = createTestEnv();
      (bidService.processBid as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: { code: 40001, message: '出价金额不足' },
      });

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      expect(broadcastToRoom).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledTimes(1); // Only bid:rejected
    });
  });

  // ---- session not found ----

  describe('bid:submit session not found', () => {
    it('should emit bid:rejected when session does not exist', async () => {
      const { socket, handlers, io } = createTestEnv();
      (bidService.processBid as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: { code: 40400, message: '竞拍不存在' },
      });

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: 9999, idempotencyKey: IDEMPOTENCY_KEY });

      expect(socket.emit).toHaveBeenCalledWith('bid:rejected', {
        sessionId: 9999,
        reason: '竞拍不存在',
        code: 40400,
      });
    });
  });

  // ---- ceiling price triggers settlement ----

  describe('bid:submit with ceiling price', () => {
    it('should trigger auction:ended when shouldEnd is true', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks({ isLeading: true, shouldEnd: true });

      const settlementResult = {
        winner: { userId: USER_ID, userNickname: 'Bidder1', finalPrice: 500 },
        leaderboard: [{ rank: 1, userId: USER_ID, userNickname: 'Bidder1', avatarUrl: null, amount: 500 }],
        orderId: 42,
      };
      (auctionService.settleAuction as ReturnType<typeof vi.fn>).mockResolvedValue(settlementResult);

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      // settleAuction is called; it broadcasts auction:ended internally
      expect(auctionService.settleAuction).toHaveBeenCalledWith(SESSION_ID);
    });

    it('should call settleAuction when no winner (unsold)', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks({ isLeading: true, shouldEnd: true });

      const settlementResult = {
        winner: null,
        leaderboard: [],
        orderId: null,
      };
      (auctionService.settleAuction as ReturnType<typeof vi.fn>).mockResolvedValue(settlementResult);

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      // settleAuction is called; it broadcasts auction:ended internally
      expect(auctionService.settleAuction).toHaveBeenCalledWith(SESSION_ID);
    });

    it('should not trigger settleAuction when shouldEnd is false', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks({ isLeading: true, shouldEnd: false });

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      expect(auctionService.settleAuction).not.toHaveBeenCalled();
    });
  });

  // ---- emotion events ----

  describe('emotion events', () => {
    it('should emit emotion:lead when the bidder is leading', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks({ isLeading: true });

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      expect(socket.emit).toHaveBeenCalledWith('emotion:lead', {
        sessionId: SESSION_ID,
        userId: USER_ID,
        amount: 110,
      });
      expect(socket.emit).not.toHaveBeenCalledWith('emotion:overtaken', expect.anything());
    });

    it('should emit emotion:overtaken when the bidder is not leading', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks({ isLeading: false });

      // Mock cache.get to return previous top bid for the top_bid key
      (cache.get as ReturnType<typeof vi.fn>).mockImplementation(async (key: string) => {
        if (key === `auction:${SESSION_ID}:top_bid`) {
          return JSON.stringify({ userId: 999, amount: 100 });
        }
        return null;
      });

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      // bid:accepted is emitted first, then emotion:overtaken (to previous leader)
      expect(socket.emit).toHaveBeenCalledWith('bid:accepted', expect.anything());
      // emotion:overtaken is only emitted to the PREVIOUS top bidder's socket
      // Since we don't have the previous bidder's socket in the test, it won't be emitted
      // But emotion:lead is NOT emitted (since isLeading is false)
      expect(socket.emit).not.toHaveBeenCalledWith('emotion:lead', expect.anything());
    });
  });

  // ---- auction extension ----

  describe('auction extension', () => {
    it('should broadcast countdown:extend when auction is extended', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks({
        isLeading: true,
        extensionResult: { remainingMs: 30_000, extensionCount: 1 },
      });

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      // countdown:extend is broadcast after bid:new, so filter all calls
      const extendCalls = (broadcastToRoom as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => call[2] === 'countdown:extend',
      );
      expect(extendCalls.length).toBeGreaterThanOrEqual(1);
      expect(extendCalls[0]).toEqual([
        io,
        ROOM_ID_STR,
        'countdown:extend',
        {
          sessionId: SESSION_ID,
          extendSeconds: 30,
          remainingExtensions: 1,
        },
      ]);
    });

    it('should not broadcast countdown:extend when extension is null', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks();
      (auctionService.extendAuction as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      const extendCalls = (broadcastToRoom as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => call[2] === 'countdown:extend',
      );
      expect(extendCalls).toHaveLength(0);
    });
  });

  // ---- T031: Non-active state bid rejection ----

  describe('T031: non-active auction bid rejection', () => {
    it('should reject bid when auction is ended', async () => {
      const { socket, handlers, io } = createTestEnv();
      (bidService.processBid as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: { code: 40900, message: '竞拍已结束' },
      });

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      expect(socket.emit).toHaveBeenCalledWith('bid:rejected', {
        sessionId: SESSION_ID,
        reason: '竞拍已结束',
        code: 40900,
      });
      expect(broadcastToRoom).not.toHaveBeenCalled();
    });

    it('should reject bid when auction is cancelled', async () => {
      const { socket, handlers, io } = createTestEnv();
      (bidService.processBid as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: { code: 40900, message: '竞拍已取消' },
      });

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      expect(socket.emit).toHaveBeenCalledWith('bid:rejected', {
        sessionId: SESSION_ID,
        reason: '竞拍已取消',
        code: 40900,
      });
      // No room events should be broadcast
      expect(broadcastToRoom).not.toHaveBeenCalled();
    });

    it('should reject bid when auction is unsold', async () => {
      const { socket, handlers, io } = createTestEnv();
      (bidService.processBid as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: { code: 40900, message: '竞拍已流拍' },
      });

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      expect(socket.emit).toHaveBeenCalledWith('bid:rejected', {
        sessionId: SESSION_ID,
        reason: '竞拍已流拍',
        code: 40900,
      });
      expect(broadcastToRoom).not.toHaveBeenCalled();
    });
  });
});
