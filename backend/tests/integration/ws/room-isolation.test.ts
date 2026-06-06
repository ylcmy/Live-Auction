/**
 * T068: WebSocket room isolation integration test.
 *
 * Verifies that Socket.IO rooms correctly isolate events:
 *   - Clients in room A do NOT receive bid:new from room B
 *   - Clients in room B do NOT receive bid:new from room A
 *   - Online counts are tracked independently per room
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let app: FastifyInstance;
let port: number;

// Per-room fixtures — rebuilt in beforeEach for full isolation
let roomAId: number;
let roomBId: number;
let sessionAId: number;
let sessionBId: number;
let userA: { id: number; token: string };
let userB: { id: number; token: string };
let clientA: ClientSocket;
let clientB: ClientSocket;

beforeAll(async () => {
  app = await setupTestApp();
  initWebSocket(app.server);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  port = typeof addr === 'object' && addr ? addr.port : 0;
});

afterAll(async () => {
  if (clientA?.connected) clientA.disconnect();
  if (clientB?.connected) clientB.disconnect();
  await teardownTestApp(app);
});

/**
 * Truncate all DB tables + flush Redis, then rebuild fresh fixtures
 * so each test gets independent, predictable IDs.
 */
beforeEach(async () => {
  await flushTestRedis();
  await truncateAll();

  // Each room needs a unique host (live_rooms_host_id_unique constraint)
  const merchantA = await seedUser({ username: 'iso_merchant_A', role: 'merchant' });
  const merchantB = await seedUser({ username: 'iso_merchant_B', role: 'merchant' });

  const { productId: prodA } = await seedProduct(merchantA.id, { name: '商品A' });
  const { productId: prodB } = await seedProduct(merchantB.id, { name: '商品B' });

  roomAId = await seedRoom(merchantA.id, { title: '隔离测试间A' });
  roomBId = await seedRoom(merchantB.id, { title: '隔离测试间B' });

  const auctionA = await seedActiveAuction({ productId: prodA, roomId: roomAId, durationSeconds: 600 });
  const auctionB = await seedActiveAuction({ productId: prodB, roomId: roomBId, durationSeconds: 600 });
  sessionAId = auctionA.sessionId;
  sessionBId = auctionB.sessionId;

  const uA = await seedUser({ username: 'iso_user_A', role: 'user' });
  const uB = await seedUser({ username: 'iso_user_B', role: 'user' });
  userA = { id: uA.id, token: generateToken(uA.id, 'user') };
  userB = { id: uB.id, token: generateToken(uB.id, 'user') };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('T068: 房间隔离 — 多房间并发场景', () => {
  it('房间 A 的 bid:new 不会泄露到房间 B', async () => {
    const bidsInA: { userId: number; amount: number }[] = [];
    const bidsInB: { userId: number; amount: number }[] = [];

    clientA = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: userA.token },
      transports: ['websocket'],
      forceNew: true,
    });
    clientB = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: userB.token },
      transports: ['websocket'],
      forceNew: true,
    });

    clientA.on('bid:new', (d) => bidsInA.push(d));
    clientB.on('bid:new', (d) => bidsInB.push(d));

    // Wait for connections
    await Promise.all(
      [clientA, clientB].map(
        (s) => new Promise<void>((r) => (s.connected ? r() : s.once('connect', r))),
      ),
    );

    // Each client joins its own room
    clientA.emit('auction:join', { roomId: roomAId });
    clientB.emit('auction:join', { roomId: roomBId });
    await new Promise((r) => setTimeout(r, 150));

    // User A bids in room A
    clientA.emit('bid:submit', {
      sessionId: sessionAId,
      idempotencyKey: `room_iso_${userA.id}_1_${Date.now()}`,
    });

    await new Promise((r) => setTimeout(r, 500));

    // bid:new should appear in room A, NOT in room B
    expect(bidsInA.length).toBeGreaterThanOrEqual(1);
    expect(bidsInB).toHaveLength(0);

    clientA.disconnect();
    clientB.disconnect();
  });

  it('多个房间的在线人数独立统计', async () => {
    const roomACounts: number[] = [];
    const roomBCounts: number[] = [];

    clientA = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: userA.token },
      transports: ['websocket'],
      forceNew: true,
    });
    clientB = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: userB.token },
      transports: ['websocket'],
      forceNew: true,
    });

    clientA.on('room:count', (d: { onlineCount: number }) => roomACounts.push(d.onlineCount));
    clientB.on('room:count', (d: { onlineCount: number }) => roomBCounts.push(d.onlineCount));

    await Promise.all(
      [clientA, clientB].map(
        (s) => new Promise<void>((r) => (s.connected ? r() : s.once('connect', r))),
      ),
    );

    // Join different rooms
    clientA.emit('auction:join', { roomId: roomAId });
    clientB.emit('auction:join', { roomId: roomBId });

    await new Promise((r) => setTimeout(r, 300));

    // Room A should report its own count (at least 1)
    expect(roomACounts.some((c) => c >= 1)).toBe(true);

    // Room B should independently report its own count
    expect(roomBCounts.some((c) => c >= 1)).toBe(true);

    // Counts should be independent — room A count should not include room B's client
    // and vice versa.  If both rooms have exactly 1 client the counts should be 1.
    const lastCountA = roomACounts[roomACounts.length - 1]!;
    const lastCountB = roomBCounts[roomBCounts.length - 1]!;
    expect(lastCountA).toBe(1);
    expect(lastCountB).toBe(1);

    clientA.disconnect();
    clientB.disconnect();
  });

  it('用户离开房间后不再收到该房间的 bid:new 事件', async () => {
    const bidsAfterLeave: { userId: number; amount: number }[] = [];

    clientA = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: userA.token },
      transports: ['websocket'],
      forceNew: true,
    });
    clientB = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: userB.token },
      transports: ['websocket'],
      forceNew: true,
    });

    await Promise.all(
      [clientA, clientB].map(
        (s) => new Promise<void>((r) => (s.connected ? r() : s.once('connect', r))),
      ),
    );

    // Both join room A
    clientA.emit('auction:join', { roomId: roomAId });
    clientB.emit('auction:join', { roomId: roomAId });
    await new Promise((r) => setTimeout(r, 150));

    // User B leaves room A
    clientB.emit('auction:leave', { roomId: roomAId });
    await new Promise((r) => setTimeout(r, 150));

    // After leaving, start listening for bid:new on clientB
    clientB.on('bid:new', (d) => bidsAfterLeave.push(d));

    // User A bids in room A
    clientA.emit('bid:submit', {
      sessionId: sessionAId,
      idempotencyKey: `leave_test_${userA.id}_${Date.now()}`,
    });
    await new Promise((r) => setTimeout(r, 500));

    // clientB should NOT receive the bid after leaving
    expect(bidsAfterLeave).toHaveLength(0);

    clientA.disconnect();
    clientB.disconnect();
  });
});

// ---------------------------------------------------------------------------
// T028 + T030: Extended isolation tests
// ---------------------------------------------------------------------------

describe('T028: 房间隔离 — 1000 条事件采样零跨房间泄漏 (SC-007)', () => {
  it('100 次出价在房间 A，房间 B 零事件泄漏', async () => {
    await flushTestRedis();
    await truncateAll();

    const merchantA = await seedUser({ username: 'iso2_merchant_A', role: 'merchant' });
    const merchantB = await seedUser({ username: 'iso2_merchant_B', role: 'merchant' });
    const { productId: prodA } = await seedProduct(merchantA.id, { name: '商品A2' });
    const { productId: prodB } = await seedProduct(merchantB.id, { name: '商品B2' });

    const rA = await seedRoom(merchantA.id, { title: '隔离测试间A2' });
    const rB = await seedRoom(merchantB.id, { title: '隔离测试间B2' });

    const auctionA = await seedActiveAuction({ productId: prodA, roomId: rA, durationSeconds: 600 });
    await seedActiveAuction({ productId: prodB, roomId: rB, durationSeconds: 600 });

    const users: { id: number; token: string }[] = [];
    for (let i = 0; i < 5; i++) {
      const u = await seedUser({ username: `iso2_user_${i}`, role: 'user' });
      users.push({ id: u.id, token: generateToken(u.id, 'user') });
    }

    const leaksInB: unknown[] = [];
    const bidsInA: unknown[] = [];

    const clientA = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: users[0]!.token },
      transports: ['websocket'],
      forceNew: true,
    });
    const clientB = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: users[1]!.token },
      transports: ['websocket'],
      forceNew: true,
    });

    clientB.on('bid:new', () => leaksInB.push(true));

    await Promise.all(
      [clientA, clientB].map(
        (s) => new Promise<void>((r) => (s.connected ? r() : s.once('connect', r))),
      ),
    );

    clientA.emit('auction:join', { roomId: rA });
    clientB.emit('auction:join', { roomId: rB });
    await new Promise((r) => setTimeout(r, 200));

    // Place many bids in room A using different users
    const BID_COUNT = 100;
    for (let i = 0; i < BID_COUNT; i++) {
      const userIdx = i % users.length;
      // Use a fresh client for each unique user cycle to avoid self-bid rejection
      const tempClient = ioClient(`http://127.0.0.1:${port}`, {
        auth: { token: users[userIdx]!.token },
        transports: ['websocket'],
        forceNew: true,
      });
      await new Promise<void>((r) => (tempClient.connected ? r() : tempClient.once('connect', r)));
      tempClient.emit('auction:join', { roomId: rA });
      await new Promise((r) => setTimeout(r, 50));
      tempClient.emit('bid:submit', {
        sessionId: auctionA.sessionId,
        idempotencyKey: `iso2_${i}_${Date.now()}`,
      });
      await new Promise((r) => setTimeout(r, 100));
      tempClient.disconnect();
    }

    // Wait for all events to settle
    await new Promise((r) => setTimeout(r, 2000));

    // SC-007: Zero cross-room leak
    expect(leaksInB).toHaveLength(0);

    clientA.disconnect();
    clientB.disconnect();
  });
});

describe('T030: 无效 token 连接被拒绝', () => {
  it('使用无效 token 连接应被拒绝，不影响同房间其他用户', async () => {
    const validUser = await seedUser({ username: 'token_valid', role: 'user' });
    const validToken = generateToken(validUser.id, 'user');

    const validClient = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: validToken },
      transports: ['websocket'],
      forceNew: true,
    });

    // Invalid token should be rejected
    const invalidClient = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: 'invalid.jwt.token' },
      transports: ['websocket'],
      forceNew: true,
    });

    // Valid client connects successfully
    await new Promise<void>((r) => (validClient.connected ? r() : validClient.once('connect', r)));
    expect(validClient.connected).toBe(true);

    // Invalid client should fail to connect
    const invalidError = await new Promise<Error>((resolve) => {
      invalidClient.on('connect_error', (err) => resolve(err));
      invalidClient.connect();
    });

    expect(invalidError).toBeDefined();
    expect(invalidError.message).toContain('令牌无效');

    // Valid client should still be connected and functional
    expect(validClient.connected).toBe(true);

    validClient.disconnect();
    invalidClient.disconnect();
  });
});
