/**
 * T033: Unit tests for WebSocket Auction Handler (registerAuctionHandlers)
 *
 * Covers:
 * - auction:timer -> returns countdown sync info via countdown:sync
 * - auction:get_state -> returns full auction state via auction:state
 * - invalid session ID handling (null timer, null state)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSocket, createMockIO } from '../../helpers/mock-socket.js';

// ── Mock dependencies ──────────────────────────────────────────────────────────
// Note: Use relative paths to match how the source file imports these modules.
// The auction service source uses a Proxy, but vi.mock replaces the whole module,
// so the handler receives the plain mock object directly.

vi.mock('../../../src/services/auction.service.js', () => ({
  auctionService: {
    getAuctionTimer: vi.fn(),
    buildAuctionState: vi.fn(),
  },
}));

vi.mock('../../../src/infrastructure/cache/redis.js', () => ({
  cache: {},
}));

// ── Imports (after mocks are declared) ──────────────────────────────────────────

import { registerAuctionHandlers } from '../../../src/ws/handlers/auction.js';
import { auctionService } from '../../../src/services/auction.service.js';

// ── Test helpers ────────────────────────────────────────────────────────────────

const SESSION_ID = 101;
const USER_ID = 1;

function createTestEnv(userId = USER_ID) {
  const { socket, handlers } = createMockSocket({ userId });
  const io = createMockIO();
  return { socket, handlers, io };
}

function registerAndGetAuctionHandlers(
  handlers: Map<string, (...args: unknown[]) => void>,
  io: ReturnType<typeof createMockIO>,
  socket: ReturnType<typeof createMockSocket>['socket'],
) {
  registerAuctionHandlers(io as any, socket as any);
  return {
    timerHandler: handlers.get('auction:timer')!,
    getStateHandler: handlers.get('auction:get_state')!,
  };
}

// ── Default mocks ───────────────────────────────────────────────────────────────

const DEFAULT_TIMER = {
  serverTime: 1_700_000_000_000,
  endTime: 1_700_000_060_000,
  remainingMs: 60_000,
};

const DEFAULT_AUCTION_STATE = {
  sessionId: SESSION_ID,
  status: 'active',
  product: {
    id: 1,
    name: 'Test Product',
    description: 'A test product',
    imageUrl: 'https://example.com/img.jpg',
  },
  rule: {
    startPrice: 100,
    bidIncrement: 10,
    ceilingPrice: 500,
    durationSeconds: 300,
    extendSeconds: 30,
    maxExtensions: 3,
  },
  currentPrice: 120,
  leaderboard: [
    { rank: 1, userId: USER_ID, userNickname: 'Bidder1', avatarUrl: null, amount: 120, timestamp: new Date().toISOString() },
  ],
  myRank: 1,
  remainingMs: 60_000,
  startedAt: new Date().toISOString(),
  participantCount: 1,
  extensionCount: 0,
};

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('registerAuctionHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- auction:timer ----

  describe('auction:timer', () => {
    it('should emit countdown:sync with timer info when session has active timer', async () => {
      const { socket, handlers, io } = createTestEnv();
      (auctionService.getAuctionTimer as ReturnType<typeof vi.fn>).mockResolvedValue(DEFAULT_TIMER);

      const { timerHandler } = registerAndGetAuctionHandlers(handlers, io, socket);
      await timerHandler({ sessionId: SESSION_ID });

      expect(auctionService.getAuctionTimer).toHaveBeenCalledWith(SESSION_ID);
      expect(socket.emit).toHaveBeenCalledWith('countdown:sync', {
        sessionId: SESSION_ID,
        remainingMs: DEFAULT_TIMER.remainingMs,
        serverTime: DEFAULT_TIMER.serverTime,
      });
    });

    it('should not emit any event when session timer is null (invalid session)', async () => {
      const { socket, handlers, io } = createTestEnv();
      (auctionService.getAuctionTimer as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { timerHandler } = registerAndGetAuctionHandlers(handlers, io, socket);
      await timerHandler({ sessionId: 9999 });

      expect(socket.emit).not.toHaveBeenCalled();
    });
  });

  // ---- auction:get_state ----

  describe('auction:get_state', () => {
    it('should emit auction:state with full state when session exists', async () => {
      const { socket, handlers, io } = createTestEnv();
      (auctionService.buildAuctionState as ReturnType<typeof vi.fn>).mockResolvedValue(DEFAULT_AUCTION_STATE);

      const { getStateHandler } = registerAndGetAuctionHandlers(handlers, io, socket);
      await getStateHandler({ sessionId: SESSION_ID });

      expect(auctionService.buildAuctionState).toHaveBeenCalledWith(SESSION_ID, USER_ID);
      expect(socket.emit).toHaveBeenCalledWith('auction:state', DEFAULT_AUCTION_STATE);
    });

    it('should not emit any event when state is null (invalid session ID)', async () => {
      const { socket, handlers, io } = createTestEnv();
      (auctionService.buildAuctionState as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { getStateHandler } = registerAndGetAuctionHandlers(handlers, io, socket);
      await getStateHandler({ sessionId: 9999 });

      expect(socket.emit).not.toHaveBeenCalled();
    });

    it('should pass correct userId to buildAuctionState', async () => {
      const customUserId = 42;
      const { socket, handlers, io } = createTestEnv(customUserId);
      (auctionService.buildAuctionState as ReturnType<typeof vi.fn>).mockResolvedValue(DEFAULT_AUCTION_STATE);

      const { getStateHandler } = registerAndGetAuctionHandlers(handlers, io, socket);
      await getStateHandler({ sessionId: SESSION_ID });

      expect(auctionService.buildAuctionState).toHaveBeenCalledWith(SESSION_ID, customUserId);
    });
  });
});
