import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/ws/rooms.js', () => ({
  broadcastToRoom: vi.fn(),
}));

vi.mock('../../../src/ws/index.js', () => ({
  broadcastRoomListUpdate: vi.fn(),
}));

vi.mock('../../../src/services/bid.service.js', () => ({
  bidService: {
    getLeaderboard: vi.fn().mockResolvedValue([]),
    getUserNickname: vi.fn().mockResolvedValue('test-user'),
  },
}));

vi.mock('../../../src/services/auction.service.js', () => ({
  auctionService: {
    rescheduleSettlement: vi.fn(),
    getAuctionTimer: vi.fn().mockResolvedValue({
      serverTime: 1000,
      endTime: 60000,
      remainingMs: 59000,
    }),
    settleAuction: vi.fn().mockResolvedValue({ winner: null, leaderboard: [], orderId: null }),
  },
}));

import { BidEventBus, type BidCommittedEvent } from '../../../src/ws/bid-event-bus.js';
import { broadcastToRoom } from '../../../src/ws/rooms.js';
import { broadcastRoomListUpdate } from '../../../src/ws/index.js';
import { bidService } from '../../../src/services/bid.service.js';
import { auctionService } from '../../../src/services/auction.service.js';

function createMockIO() {
  return {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
    sockets: {
      adapter: { rooms: { get: vi.fn() } },
      sockets: new Map(),
    },
  } as any;
}

function createBidEvent(overrides: Partial<BidCommittedEvent> = {}): BidCommittedEvent {
  return {
    sessionId: 1,
    roomId: '10',
    userId: 100,
    userNickname: 'Alice',
    amount: 500,
    isLeading: true,
    previousTopBidderId: null,
    extensionResult: null,
    shouldEnd: false,
    timestamp: '2026-06-06T12:00:00.000Z',
    ...overrides,
  };
}

describe('BidEventBus', () => {
  let bus: BidEventBus;
  let mockIO: ReturnType<typeof createMockIO>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    bus = new BidEventBus();
    mockIO = createMockIO();
    bus.setIO(mockIO);
    bus.registerHandlers();
  });

  afterEach(() => {
    bus.dispose();
    vi.useRealTimers();
  });

  it('should immediately broadcast bid:new to room', async () => {
    const event = createBidEvent();
    bus.emitBidCommitted(event);

    expect(broadcastToRoom).toHaveBeenCalledWith(
      mockIO,
      '10',
      'bid:new',
      expect.objectContaining({
        sessionId: 1,
        userId: 100,
        userNickname: 'Alice',
        amount: 500,
      }),
    );
  });

  it('should immediately broadcast room-list:bid-new', async () => {
    const event = createBidEvent();
    bus.emitBidCommitted(event);

    expect(broadcastRoomListUpdate).toHaveBeenCalledWith(
      'room-list:bid-new',
      expect.objectContaining({
        roomId: 10,
        sessionId: 1,
        currentPrice: 500,
      }),
    );
  });

  it('should debounce rank:update - send 3 events, 1 getLeaderboard call after 50ms', async () => {
    const event = createBidEvent();
    bus.emitBidCommitted(event);
    bus.emitBidCommitted(event);
    bus.emitBidCommitted(event);

    expect(bidService.getLeaderboard).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(55);

    expect(bidService.getLeaderboard).toHaveBeenCalledTimes(1);
    expect(bidService.getLeaderboard).toHaveBeenCalledWith(1, 0);
    expect(broadcastToRoom).toHaveBeenCalledWith(
      mockIO,
      '10',
      'rank:update',
      expect.any(Array),
    );
  });

  it('should call settleAuction when shouldEnd=true', async () => {
    const event = createBidEvent({ shouldEnd: true });
    bus.emitBidCommitted(event);

    expect(auctionService.settleAuction).toHaveBeenCalledWith(1);
  });

  it('should broadcast countdown:sync after every bid', async () => {
    const event = createBidEvent();
    bus.emitBidCommitted(event);
    await vi.advanceTimersByTimeAsync(0);

    expect(auctionService.getAuctionTimer).toHaveBeenCalledWith(1);
    expect(broadcastToRoom).toHaveBeenCalledWith(
      mockIO,
      '10',
      'countdown:sync',
      expect.objectContaining({
        sessionId: 1,
        remainingMs: 59000,
        serverTime: 1000,
      }),
    );
  });

  it('should broadcast countdown:extend and reschedule settlement when extensionResult present', async () => {
    const event = createBidEvent({
      extensionResult: { remainingMs: 15000, extensionCount: 2 },
    });
    bus.emitBidCommitted(event);
    await vi.advanceTimersByTimeAsync(0);

    expect(auctionService.rescheduleSettlement).toHaveBeenCalledWith(1, 15000);
    expect(broadcastToRoom).toHaveBeenCalledWith(
      mockIO,
      '10',
      'countdown:extend',
      expect.objectContaining({
        sessionId: 1,
        extendSeconds: 15,
        remainingExtensions: 2,
      }),
    );
    // countdown:sync should also be called
    const syncCall = (broadcastToRoom as any).mock.calls.find(
      (c: any[]) => c[2] === 'countdown:sync',
    );
    expect(syncCall).toBeDefined();
  });

  it('should send emotion:overtaken to previous top bidder', async () => {
    const prevSocket = { userId: 50, emit: vi.fn() };
    mockIO.sockets.sockets.set('socket-50', prevSocket);
    mockIO.sockets.adapter.rooms.get.mockReturnValue(new Set(['socket-50']));

    const event = createBidEvent({ isLeading: true, previousTopBidderId: 50 });
    bus.emitBidCommitted(event);

    expect(prevSocket.emit).toHaveBeenCalledWith(
      'emotion:overtaken',
      expect.objectContaining({ sessionId: 1, userId: 50 }),
    );
  });
});
