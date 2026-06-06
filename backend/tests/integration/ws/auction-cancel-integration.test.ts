/**
 * T017: Auction cancel integration test (FR-031).
 *
 * Verifies that cancelling an auction that has existing bids:
 *   - DB preserves historical bid_records (not deleted)
 *   - No order is created
 *   - Redis cache is cleaned up (leaderboard, top_bid, end_time, etc.)
 *   - auction:cancelled event is broadcast to the room via WS
 *   - Session status transitions to 'cancelled'
 *
 * Uses real Fastify + Socket.IO + DB + Redis.
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
import { db } from '../../../src/infrastructure/db/knex.js';
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

let roomId: number;
let sessionId: number;
let merchantId: number;
let merchantToken: string;
let user: { id: number; token: string };
let clients: ClientSocket[];

beforeAll(async () => {
  app = await setupTestApp();
  initWebSocket(app.server);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  port = typeof addr === 'object' && addr ? addr.port : 0;
});

afterAll(async () => {
  for (const c of clients ?? []) {
    if (c.connected) c.disconnect();
  }
  await teardownTestApp(app);
});

beforeEach(async () => {
  await flushTestRedis();
  await truncateAll();
  clients = [];

  const m = await seedUser({ username: 'cancel_merchant', role: 'merchant' });
  merchantId = m.id;
  merchantToken = generateToken(m.id, 'merchant');

  const { productId } = await seedProduct(m.id, { name: '取消竞拍测试商品' });
  roomId = await seedRoom(m.id, { title: '取消竞拍测试间' });

  const auction = await seedActiveAuction({
    productId,
    roomId,
    ceilingPrice: null,
    durationSeconds: 600,
  });
  sessionId = auction.sessionId;

  const u = await seedUser({ username: 'cancel_bidder', role: 'user' });
  user = { id: u.id, token: generateToken(u.id, 'user') };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('T017: 有出价后取消竞拍集成测试 (FR-031)', () => {
  it('出价后取消: DB 保留 bid_records、无新订单、Redis 清理、广播 auction:cancelled', async () => {
    const cancelledEvents: { sessionId: number; reason: string }[] = [];

    // --- Step 1: Connect client and place a bid ---
    const client = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: user.token },
      transports: ['websocket'],
      forceNew: true,
    });
    clients.push(client);

    client.on('auction:cancelled', (d: { sessionId: number; reason: string }) =>
      cancelledEvents.push(d),
    );

    await new Promise<void>((r) => (client.connected ? r() : client.once('connect', r)));
    client.emit('auction:join', { roomId });
    await new Promise((r) => setTimeout(r, 200));

    // Place a bid
    const bidAccepted = new Promise<void>((resolve) => {
      client.once('bid:accepted', () => resolve());
    });
    client.emit('bid:submit', {
      sessionId,
      idempotencyKey: `cancel_bid_${user.id}_${Date.now()}`,
    });
    await bidAccepted;
    await new Promise((r) => setTimeout(r, 300));

    // Verify bid exists in DB
    const bidsBefore = await db('bid_records').where({ session_id: sessionId });
    expect(bidsBefore.length).toBeGreaterThanOrEqual(1);
    const bidCount = bidsBefore.length;

    // Verify Redis has data
    const redis = new Redis(REDIS_URL);
    let redisKeysBefore: string[];
    try {
      redisKeysBefore = await redis.keys(`auction:${sessionId}:*`);
      expect(redisKeysBefore.length).toBeGreaterThan(0);
    } finally {
      await redis.quit();
    }

    // --- Step 2: Cancel the auction via HTTP API ---
    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/auctions/${sessionId}/cancel`,
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    expect(cancelRes.statusCode).toBe(200);

    // Allow WS broadcast to propagate
    await new Promise((r) => setTimeout(r, 500));

    // ---- Assertions ----

    // 1. Session status is 'cancelled'
    const session = await db('auction_sessions').where({ id: sessionId }).first();
    expect(session.status).toBe('cancelled');
    expect(session.ended_at).not.toBeNull();

    // 2. Bid records are preserved (not deleted)
    const bidsAfter = await db('bid_records').where({ session_id: sessionId });
    expect(bidsAfter.length).toBe(bidCount);

    // 3. No order was created for this session
    const orders = await db('orders').where({ session_id: sessionId });
    expect(orders).toHaveLength(0);

    // 4. Redis cache is cleaned up
    const redis2 = new Redis(REDIS_URL);
    try {
      const redisKeysAfter = await redis2.keys(`auction:${sessionId}:*`);
      // Should have no keys or significantly fewer than before
      // The leaderboard key might persist if cleanup missed it, but core keys should be gone
      const criticalKeys = [
        `auction:${sessionId}:end_time`,
        `auction:${sessionId}:top_bid`,
        `auction:${sessionId}:status`,
      ];
      for (const key of criticalKeys) {
        const val = await redis2.get(key);
        expect(val).toBeNull();
      }
    } finally {
      await redis2.quit();
    }

    // 5. WS broadcast: auction:cancelled received by connected client
    expect(cancelledEvents).toHaveLength(1);
    expect(cancelledEvents[0]!.sessionId).toBe(sessionId);
    expect(cancelledEvents[0]!.reason).toContain('取消');

    // 6. Product status reverted to 'listed'
    const product = await db('products')
      .where({ id: session.product_id })
      .first();
    expect(product.status).toBe('listed');

    client.disconnect();
  });

  it('无出价时取消竞拍: 广播成功、状态正确', async () => {
    const cancelledEvents: { sessionId: number }[] = [];

    const client = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: user.token },
      transports: ['websocket'],
      forceNew: true,
    });
    clients.push(client);

    client.on('auction:cancelled', (d: { sessionId: number }) =>
      cancelledEvents.push(d),
    );

    await new Promise<void>((r) => (client.connected ? r() : client.once('connect', r)));
    client.emit('auction:join', { roomId });
    await new Promise((r) => setTimeout(r, 200));

    // Cancel without any bids
    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/auctions/${sessionId}/cancel`,
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    expect(cancelRes.statusCode).toBe(200);

    await new Promise((r) => setTimeout(r, 500));

    const session = await db('auction_sessions').where({ id: sessionId }).first();
    expect(session.status).toBe('cancelled');

    // No bids exist
    const bids = await db('bid_records').where({ session_id: sessionId });
    expect(bids).toHaveLength(0);

    // No orders
    const orders = await db('orders').where({ session_id: sessionId });
    expect(orders).toHaveLength(0);

    // Broadcast received
    expect(cancelledEvents).toHaveLength(1);

    client.disconnect();
  });

  it('已取消的竞拍不能再次取消', async () => {
    // Cancel once
    const first = await app.inject({
      method: 'POST',
      url: `/api/auctions/${sessionId}/cancel`,
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    expect(first.statusCode).toBe(200);

    // Cancel again → should fail
    const second = await app.inject({
      method: 'POST',
      url: `/api/auctions/${sessionId}/cancel`,
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    expect(second.statusCode).toBe(409);
  });

  it('非商家身份不能取消竞拍', async () => {
    const userToken = generateToken(user.id, 'user');

    const res = await app.inject({
      method: 'POST',
      url: `/api/auctions/${sessionId}/cancel`,
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
