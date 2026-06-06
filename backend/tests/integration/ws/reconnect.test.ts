/**
 * T069: WebSocket reconnection integration test.
 *
 * Verifies that a client which disconnects and reconnects:
 *   - Re-joins the room successfully
 *   - Receives the current auction:state (including leaderboard changes
 *     that happened while disconnected)
 *   - Recovery completes within the 3-second requirement
 *
 * Uses real socket.io-client connections against a live Fastify + Socket.IO server.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { FastifyInstance } from 'fastify';
import Redis from 'ioredis';

import { setupTestApp, teardownTestApp } from '../setup.js';
import { initWebSocket } from '../../../src/ws/index.js';
import {
  truncateAll,
  seedUser,
  seedProduct,
  seedRoom,
  seedActiveAuction,
  generateToken,
} from '../../helpers/factory.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';

function flushTestRedis(): Promise<string> {
  const r = new Redis(REDIS_URL);
  return r.flushdb().finally(() => r.quit());
}

/**
 * Poll `predicate()` every `intervalMs` until it returns true,
 * or reject after `timeoutMs`.
 */
function waitFor(
  predicate: () => boolean,
  timeoutMs = 5_000,
  intervalMs = 30,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timeout'));
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let app: FastifyInstance;
let port: number;

let roomId: number;
let sessionId: number;
let productId: number;
let userReconnector: { id: number; token: string };
let userBidder: { id: number; token: string };
let clientReconnect: ClientSocket;
let clientBidder: ClientSocket;

beforeAll(async () => {
  app = await setupTestApp();
  initWebSocket(app.server);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  port = typeof addr === 'object' && addr ? addr.port : 0;
});

afterAll(async () => {
  if (clientReconnect?.connected) clientReconnect.disconnect();
  if (clientBidder?.connected) clientBidder.disconnect();
  await teardownTestApp(app);
});

/**
 * Truncate all DB tables + flush Redis, then rebuild fixtures
 * so each test gets a fully independent, fresh auction.
 */
beforeEach(async () => {
  await flushTestRedis();
  await truncateAll();

  const merchant = await seedUser({ username: 'recon_merchant', role: 'merchant' });
  const prod = await seedProduct(merchant.id, { name: '重连测试商品' });
  productId = prod.productId;
  roomId = await seedRoom(merchant.id, { title: '重连测试间' });

  const auction = await seedActiveAuction({ productId, roomId, durationSeconds: 600 });
  sessionId = auction.sessionId;

  const uR = await seedUser({ username: 'recon_user', role: 'user' });
  const uB = await seedUser({ username: 'recon_bidder', role: 'user' });
  userReconnector = { id: uR.id, token: generateToken(uR.id, 'user') };
  userBidder = { id: uB.id, token: generateToken(uB.id, 'user') };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('T069: 断线重连 — 状态同步验证', () => {
  it('断线后重连应恢复 auction:state 并包含断线期间的新出价', async () => {
    let stateAfterReconnect: Record<string, unknown> | null = null;
    let reconnectTimestamp = 0;

    // ---- Phase 1: Both clients connect and join ----
    clientReconnect = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: userReconnector.token },
      transports: ['websocket'],
      forceNew: true,
      autoConnect: false,        // manual control over connect/disconnect
      reconnection: false,       // we will reconnect manually
    });
    clientBidder = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: userBidder.token },
      transports: ['websocket'],
      forceNew: true,
    });

    // Collect bid:accepted for the active bidder
    let bidderAccepted = false;
    clientBidder.on('bid:accepted', () => {
      bidderAccepted = true;
    });

    // Initial auction:state on first join
    let initialStateReceived = false;
    clientReconnect.on('auction:state', () => {
      if (!initialStateReceived) {
        initialStateReceived = true;
      }
    });

    // Connect reconnector client
    clientReconnect.connect();
    await new Promise<void>((r) => clientReconnect.once('connect', r));

    // Wait for bidder to connect too
    await new Promise<void>((r) => {
      if (clientBidder.connected) return r();
      clientBidder.once('connect', r);
    });

    // Both join room
    clientReconnect.emit('auction:join', { roomId });
    clientBidder.emit('auction:join', { roomId });
    await new Promise((r) => setTimeout(r, 200));

    // Wait for initial state
    await waitFor(() => initialStateReceived, 3_000);

    // ---- Phase 2: Disconnect reconnector ----
    clientReconnect.disconnect();
    await new Promise((r) => setTimeout(r, 200));

    // ---- Phase 3: Bidder bids while reconnector is disconnected ----
    clientBidder.emit('bid:submit', {
      sessionId,
      idempotencyKey: `reconnect_bid_${userBidder.id}_${Date.now()}`,
    });

    // Wait for bid to be processed
    await waitFor(() => bidderAccepted, 5_000);
    expect(bidderAccepted).toBe(true);

    // ---- Phase 4: Reconnector reconnects and requests state ----
    // Register listener BEFORE reconnecting so we don't miss the event
    const statePromise = new Promise<Record<string, unknown>>((resolve) => {
      clientReconnect.once('auction:state', (state: Record<string, unknown>) => {
        stateAfterReconnect = state;
        resolve(state);
      });
    });

    reconnectTimestamp = Date.now();
    clientReconnect.connect();
    await new Promise<void>((r) => clientReconnect.once('connect', r));

    // Re-join room after reconnect — triggers server to emit auction:state
    clientReconnect.emit('auction:join', { roomId });

    // Wait for the state event with a generous timeout
    const recoveredState = await Promise.race([
      statePromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('auction:state not received after reconnect')), 8_000),
      ),
    ]);

    const recoveryDuration = Date.now() - reconnectTimestamp;

    clientReconnect.disconnect();
    clientBidder.disconnect();

    // ---- Assertions ----

    // 1. auction:state was received after reconnect
    expect(stateAfterReconnect).not.toBeNull();
    expect(recoveredState.sessionId).toBe(sessionId);

    // 2. State reflects the bid made while disconnected
    //    The current_price in the state should be > the start_price (100)
    expect(Number(recoveredState.currentPrice)).toBeGreaterThan(100);

    // 3. Leaderboard includes the bidder
    const lb = recoveredState.leaderboard as { userId: number }[];
    expect(Array.isArray(lb)).toBe(true);
    const bidderInLeaderboard = lb.some((e) => e.userId === userBidder.id);
    expect(bidderInLeaderboard).toBe(true);

    // 4. Recovery completes within 3 seconds (from reconnect to state received)
    expect(recoveryDuration).toBeLessThan(3_000);
  });

  it('重连后 auction:get_state 能独立请求最新状态', async () => {
    clientReconnect = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: userReconnector.token },
      transports: ['websocket'],
      forceNew: true,
    });
    clientBidder = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: userBidder.token },
      transports: ['websocket'],
      forceNew: true,
    });

    await Promise.all(
      [clientReconnect, clientBidder].map(
        (s) => new Promise<void>((r) => (s.connected ? r() : s.once('connect', r))),
      ),
    );

    clientReconnect.emit('auction:join', { roomId });
    clientBidder.emit('auction:join', { roomId });
    await new Promise((r) => setTimeout(r, 150));

    // Bidder bids
    let bidderDone = false;
    clientBidder.on('bid:accepted', () => {
      bidderDone = true;
    });
    clientBidder.emit('bid:submit', {
      sessionId,
      idempotencyKey: `get_state_test_${userBidder.id}_${Date.now()}`,
    });
    await waitFor(() => bidderDone, 5_000);

    // Reconnector requests state explicitly via auction:get_state
    const stateFromGet = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('auction:get_state timed out')), 5_000);
      clientReconnect.once('auction:state', (state: Record<string, unknown>) => {
        clearTimeout(timer);
        resolve(state);
      });
      clientReconnect.emit('auction:get_state', { sessionId });
    });

    clientReconnect.disconnect();
    clientBidder.disconnect();

    // State should reflect the new bid
    expect(Number(stateFromGet.currentPrice)).toBeGreaterThan(100);
    const lb = stateFromGet.leaderboard as { userId: number }[];
    expect(lb.some((e) => e.userId === userBidder.id)).toBe(true);
  });
});

/**
 * T029: Reconnect with price/countdown/personal-rank sync (FR-013, SC-008).
 *
 * Verifies that after reconnect, the auction:state includes:
 *   - Updated current price (reflecting bids made while disconnected)
 *   - Remaining countdown time (remainingMs)
 *   - Personal rank for the reconnected user
 *   All within 3 seconds.
 */
describe('T029: 重连后 3s 内完整状态同步 (FR-013, SC-008)', () => {
  it('重连后应同步: 最新价格 + 倒计时 + 个人排名', async () => {
    // ---- Setup: both clients connect, reconnector bids first ----
    clientReconnect = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: userReconnector.token },
      transports: ['websocket'],
      forceNew: true,
      autoConnect: false,
      reconnection: false,
    });
    clientBidder = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: userBidder.token },
      transports: ['websocket'],
      forceNew: true,
    });

    let reconnectorBidAccepted = false;
    clientReconnect.on('bid:accepted', () => { reconnectorBidAccepted = true; });

    clientReconnect.connect();
    await new Promise<void>((r) => clientReconnect.once('connect', r));
    await new Promise<void>((r) => {
      if (clientBidder.connected) return r();
      clientBidder.once('connect', r);
    });

    clientReconnect.emit('auction:join', { roomId });
    clientBidder.emit('auction:join', { roomId });
    await new Promise((r) => setTimeout(r, 200));

    // Reconnector bids first
    clientReconnect.emit('bid:submit', {
      sessionId,
      idempotencyKey: `t029_reconn_${Date.now()}`,
    });
    await new Promise((r) => setTimeout(r, 1000));

    // ---- Disconnect reconnector ----
    clientReconnect.disconnect();
    await new Promise((r) => setTimeout(r, 200));

    // ---- Bidder outbids while reconnector is disconnected ----
    let bidderAccepted = false;
    clientBidder.on('bid:accepted', () => { bidderAccepted = true; });

    clientBidder.emit('bid:submit', {
      sessionId,
      idempotencyKey: `t029_bidder_${Date.now()}`,
    });
    await new Promise((r) => setTimeout(r, 1000));

    // ---- Reconnect and capture state ----
    const statePromise = new Promise<Record<string, unknown>>((resolve) => {
      clientReconnect.once('auction:state', (state: Record<string, unknown>) => resolve(state));
    });

    const reconnectStart = Date.now();
    clientReconnect.connect();
    await new Promise<void>((r) => clientReconnect.once('connect', r));
    clientReconnect.emit('auction:join', { roomId });

    const state = await Promise.race([
      statePromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('auction:state not received')), 8_000),
      ),
    ]);

    const recoveryMs = Date.now() - reconnectStart;

    // ---- Assertions ----

    // 1. SC-008: Recovery within 3 seconds
    expect(recoveryMs).toBeLessThan(3_000);

    // 2. Price updated (bidder outbid the reconnector)
    expect(Number(state.currentPrice)).toBeGreaterThan(110);

    // 3. Remaining countdown present and > 0 (auction still active)
    expect(typeof state.remainingMs).toBe('number');
    expect(state.remainingMs as number).toBeGreaterThan(0);

    // 4. Personal rank present for reconnected user
    const lb = state.leaderboard as { userId: number; rank: number }[];
    expect(Array.isArray(lb)).toBe(true);
    const reconnEntry = lb.find((e) => e.userId === userReconnector.id);
    expect(reconnEntry).toBeDefined();
    expect(reconnEntry!.rank).toBeGreaterThanOrEqual(1);

    clientReconnect.disconnect();
    clientBidder.disconnect();
  });
});
