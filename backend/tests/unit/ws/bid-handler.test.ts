/**
 * T032: Unit tests for WebSocket Bid Handler (registerBidHandlers)
 *
 * Covers:
 * - bid:submit accepted -> emits bid:accepted, calls bidEventBus.emitBidCommitted
 * - bid:submit rejected -> emits bid:rejected
 * - bid:submit session not found -> returns error
 * - bid:submit ceiling price -> triggers shouldEnd in event
 * - emotion/extension/ceiling handled by bidEventBus (tested separately in bid-event-bus.test.ts)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSocket, createMockIO } from '../../helpers/mock-socket.js';

// ── Mock dependencies ──────────────────────────────────────────────────────────

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

vi.mock('../../../src/infrastructure/cache/redis.js', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    setnx: vi.fn(),
  },
  isRedisAvailable: vi.fn(() => true),
}));

vi.mock('../../../src/ws/bid-event-bus.js', () => ({
  bidEventBus: {
    emitBidCommitted: vi.fn(),
    setIO: vi.fn(),
    registerHandlers: vi.fn(),
    dispose: vi.fn(),
  },
}));

vi.mock('../../../src/ws/index.js', () => ({
  broadcastRoomListUpdate: vi.fn(),
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────────

import { registerBidHandlers } from '../../../src/ws/handlers/bid.js';
import { bidService } from '../../../src/services/bid.service.js';
import { auctionSessionRepo } from '../../../src/repositories/auction-session.repo.js';
import { cache } from '../../../src/infrastructure/cache/redis.js';
import { bidEventBus } from '../../../src/ws/bid-event-bus.js';

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

function setupSuccessfulMocks(overrides?: { isLeading?: boolean; shouldEnd?: boolean; extensionResult?: { remainingMs: number; extensionCount: number } | null }) {
  const isLeading = overrides?.isLeading ?? true;
  const shouldEnd = overrides?.shouldEnd ?? false;

  (bidService.processBid as ReturnType<typeof vi.fn>).mockResolvedValue({
    success: true,
    amount: 110,
    rank: 1,
    isLeading,
    gapToLeader: isLeading ? 0 : 10,
    shouldEnd,
    extensionResult: overrides?.extensionResult ?? null,
  });

  (bidService.getUserNickname as ReturnType<typeof vi.fn>).mockResolvedValue('Bidder1');
  (auctionSessionRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(DEFAULT_SESSION);
}

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('registerBidHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  // ---- bid:submit accepted ----

  describe('bid:submit accepted', () => {
    it('should emit bid:accepted to the bidder with idempotencyKey', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks();

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      expect(socket.emit).toHaveBeenCalledWith('bid:accepted', {
        sessionId: SESSION_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
        bidId: 0,
        amount: 110,
        rank: 1,
        isLeading: true,
        gapToLeader: 0,
      });
    });

    it('should call bidEventBus.emitBidCommitted for async broadcast', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks();

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      expect(bidEventBus.emitBidCommitted).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: SESSION_ID,
          roomId: ROOM_ID_STR,
          userId: USER_ID,
          userNickname: 'Bidder1',
          amount: 110,
          isLeading: true,
          shouldEnd: false,
        }),
      );
    });

    it('should include previousTopBidderId from cache', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks();

      // Mock cache to return a previous top bid
      (cache.get as ReturnType<typeof vi.fn>).mockImplementation(async (key: string) => {
        if (key === `auction:${SESSION_ID}:top_bid`) {
          return JSON.stringify({ userId: 99, amount: 100, timestamp: new Date().toISOString() });
        }
        return null;
      });

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      expect(bidEventBus.emitBidCommitted).toHaveBeenCalledWith(
        expect.objectContaining({
          previousTopBidderId: 99,
        }),
      );
    });
  });

  // ---- bid:rejected ----

  describe('bid:submit rejected', () => {
    it('should emit bid:rejected with idempotencyKey when bid fails', async () => {
      const { socket, handlers, io } = createTestEnv();
      (bidService.processBid as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: { code: 40001, message: '出价金额不足' },
      });

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      expect(socket.emit).toHaveBeenCalledWith('bid:rejected', {
        sessionId: SESSION_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
        reason: '出价金额不足',
        code: 40001,
      });
    });

    it('should not call bidEventBus.emitBidCommitted on rejection', async () => {
      const { socket, handlers, io } = createTestEnv();
      (bidService.processBid as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: { code: 40001, message: '出价金额不足' },
      });

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      expect(bidEventBus.emitBidCommitted).not.toHaveBeenCalled();
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
        idempotencyKey: IDEMPOTENCY_KEY,
        reason: '竞拍不存在',
        code: 40400,
      });
    });
  });

  // ---- ceiling price ----

  describe('bid:submit with ceiling price', () => {
    it('should pass shouldEnd=true to bidEventBus when ceiling reached', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks({ isLeading: true, shouldEnd: true });

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      // Handler passes shouldEnd to event bus; settlement is handled by the bus
      expect(bidEventBus.emitBidCommitted).toHaveBeenCalledWith(
        expect.objectContaining({
          shouldEnd: true,
        }),
      );
    });

    it('should pass shouldEnd=false when ceiling not reached', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks({ isLeading: true, shouldEnd: false });

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      expect(bidEventBus.emitBidCommitted).toHaveBeenCalledWith(
        expect.objectContaining({
          shouldEnd: false,
        }),
      );
    });
  });

  // ---- emotion events ----

  describe('emotion events', () => {
    it('should not emit emotion:lead directly (handled by event bus)', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks({ isLeading: true });

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      // Handler does NOT emit emotion:lead directly; that's done by the event bus
      expect(socket.emit).not.toHaveBeenCalledWith('emotion:lead', expect.anything());
      // But it passes isLeading to the event bus
      expect(bidEventBus.emitBidCommitted).toHaveBeenCalledWith(
        expect.objectContaining({ isLeading: true }),
      );
    });
  });

  // ---- auction extension ----

  describe('auction extension', () => {
    it('should pass extensionResult to bidEventBus', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks({
        isLeading: true,
        extensionResult: { remainingMs: 30_000, extensionCount: 1 },
      });

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      // Handler passes extensionResult to event bus; countdown:extend is handled by the bus
      expect(bidEventBus.emitBidCommitted).toHaveBeenCalledWith(
        expect.objectContaining({
          extensionResult: { remainingMs: 30_000, extensionCount: 1 },
        }),
      );
    });

    it('should pass null extensionResult when no extension', async () => {
      const { socket, handlers, io } = createTestEnv();
      setupSuccessfulMocks({ isLeading: true, extensionResult: null });

      const bidHandler = registerAndGetBidHandler(handlers, io, socket);
      await bidHandler({ sessionId: SESSION_ID, idempotencyKey: IDEMPOTENCY_KEY });

      expect(bidEventBus.emitBidCommitted).toHaveBeenCalledWith(
        expect.objectContaining({
          extensionResult: null,
        }),
      );
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
        idempotencyKey: IDEMPOTENCY_KEY,
        reason: '竞拍已结束',
        code: 40900,
      });
      expect(bidEventBus.emitBidCommitted).not.toHaveBeenCalled();
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
        idempotencyKey: IDEMPOTENCY_KEY,
        reason: '竞拍已取消',
        code: 40900,
      });
      expect(bidEventBus.emitBidCommitted).not.toHaveBeenCalled();
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
        idempotencyKey: IDEMPOTENCY_KEY,
        reason: '竞拍已流拍',
        code: 40900,
      });
      expect(bidEventBus.emitBidCommitted).not.toHaveBeenCalled();
    });
  });
});
