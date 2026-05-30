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

  const merchant = await seedUser({ username: 'iso_merchant', role: 'merchant' });

  const { productId: prodA } = await seedProduct(merchant.id, { name: '商品A' });
  const { productId: prodB } = await seedProduct(merchant.id, { name: '商品B' });

  roomAId = await seedRoom(merchant.id, { title: '隔离测试间A' });
  roomBId = await seedRoom(merchant.id, { title: '隔离测试间B' });

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
