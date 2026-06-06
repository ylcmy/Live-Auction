/**
 * T036: Redis fallback integration test (FR-025).
 *
 * Verifies that when Redis is unavailable (container stopped),
 * bids are successfully processed via the MySQL fallback path, and
 * after Redis recovery + cache rebuild, the consistency checker confirms
 * DB and Redis are aligned.
 *
 * IMPORTANT: describe.skip is forbidden for this test file.
 * NOTE: This test stops/starts the Redis Docker container. Run with
 * `SKIP_DOCKER_PREPARE=1` to prevent global-setup from restarting it.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { FastifyInstance } from 'fastify';
import { execSync } from 'child_process';

import { setupTestApp, teardownTestApp } from '../setup.js';
import { initWebSocket } from '../../../src/ws/index.js';
import {
  seedUser,
  seedProduct,
  seedRoom,
  seedActiveAuction,
  generateToken,
} from '../../helpers/factory.js';
import { restoreRedisAvailability } from '../../helpers/redis-test-utils.js';
import { assertAuctionConsistency } from '../../helpers/consistency-checker.js';
import { cache, redis as redisClient } from '../../../src/infrastructure/cache/redis.js';
import { db } from '../../../src/infrastructure/db/knex.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REDIS_CONTAINER = 'live-auction-redis-test';

function stopRedis(): void {
  try { execSync(`docker stop ${REDIS_CONTAINER}`, { stdio: 'pipe' }); } catch {}
}

async function startRedis(): Promise<void> {
  try { execSync(`docker start ${REDIS_CONTAINER}`, { stdio: 'pipe' }); } catch {}
  // Wait for Redis to be ready
  await new Promise(r => setTimeout(r, 2000));
}

function waitForEvent<T>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 15_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const deadline = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for "${event}" after ${timeoutMs}ms`));
    }, timeoutMs);

    function onEvent(data: T) {
      clearTimeout(deadline);
      socket.off(event, onEvent);
      resolve(data);
    }

    socket.on(event, onEvent);
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

let bidder1: { id: number; token: string };
let bidder2: { id: number; token: string };

let client1: ClientSocket;
let client2: ClientSocket;

beforeAll(async () => {
  // Ensure Redis is running for setup
  await startRedis();

  app = await setupTestApp();
  initWebSocket(app.server);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  port = typeof addr === 'object' && addr ? addr.port : 0;

  const merchant = await seedUser({ username: 'fallback_merchant', role: 'merchant' });
  const product = await seedProduct(merchant.id, { name: '降级测试商品' });
  productId = product.productId;
  roomId = await seedRoom(merchant.id, { title: '降级测试间' });

  const auction = await seedActiveAuction({
    productId,
    roomId,
    ceilingPrice: null,
    durationSeconds: 600,
  });
  sessionId = auction.sessionId;

  const u1 = await seedUser({ username: 'fallback_bidder1', role: 'user' });
  const u2 = await seedUser({ username: 'fallback_bidder2', role: 'user' });
  bidder1 = { id: u1.id, token: generateToken(u1.id, 'user') };
  bidder2 = { id: u2.id, token: generateToken(u2.id, 'user') };
});

afterAll(async () => {
  // Ensure Redis is running for cleanup
  await startRedis();
  restoreRedisAvailability();

  if (client1?.connected) client1.disconnect();
  if (client2?.connected) client2.disconnect();
  await teardownTestApp(app);
});

afterEach(async () => {
  // Restore Redis after each test
  await startRedis();
  restoreRedisAvailability();

  if (client1?.connected) client1.disconnect();
  if (client2?.connected) client2.disconnect();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('T036: Redis 降级出价集成测试', () => {
  it('Redis 正常时出价走 Redis 路径成功', async () => {
    client1 = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: bidder1.token },
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise<void>((resolve) => {
      if (client1.connected) return resolve();
      client1.once('connect', () => resolve());
    });

    client1.emit('auction:join', { roomId });
    await new Promise((r) => setTimeout(r, 200));

    client1.emit('bid:submit', { sessionId, idempotencyKey: `fallback_redis_${Date.now()}` });

    const accepted = await waitForEvent<{ amount: number; isLeading: boolean }>(
      client1, 'bid:accepted', 10_000,
    );

    expect(accepted.amount).toBeGreaterThan(100);
    expect(accepted.isLeading).toBe(true);

    client1.disconnect();
  });

  it('Redis 宕机时通过 MySQL 降级路径成功出价', async () => {
    // Stop Redis container to simulate real outage
    stopRedis();
    await new Promise((r) => setTimeout(r, 1000));

    client1 = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: bidder1.token },
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise<void>((resolve) => {
      if (client1.connected) return resolve();
      client1.once('connect', () => resolve());
    });

    client1.emit('auction:join', { roomId });
    await new Promise((r) => setTimeout(r, 500));

    client1.emit('bid:submit', { sessionId, idempotencyKey: `fallback_mysql_${Date.now()}` });

    const accepted = await waitForEvent<{ amount: number; isLeading: boolean }>(
      client1, 'bid:accepted', 15_000,
    );

    expect(accepted.amount).toBeGreaterThan(100);

    // Verify bid was persisted in MySQL
    const bidRecords = await db('bid_records')
      .where({ session_id: sessionId })
      .orderBy('created_at', 'desc')
      .limit(5);

    expect(bidRecords.length).toBeGreaterThanOrEqual(1);
    const latestBid = bidRecords[0]!;
    expect(Number(latestBid.bid_amount)).toBe(accepted.amount);
    expect(latestBid.user_id).toBe(bidder1.id);

    client1.disconnect();
  });

  it('降级路径下多用户出价均成功且金额递增', async () => {
    stopRedis();
    await new Promise((r) => setTimeout(r, 1000));

    client1 = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: bidder1.token },
      transports: ['websocket'],
      forceNew: true,
    });
    client2 = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: bidder2.token },
      transports: ['websocket'],
      forceNew: true,
    });

    await Promise.all([
      new Promise<void>(r => client1.connected ? r() : client1.once('connect', r)),
      new Promise<void>(r => client2.connected ? r() : client2.once('connect', r)),
    ]);

    client1.emit('auction:join', { roomId });
    client2.emit('auction:join', { roomId });
    await new Promise((r) => setTimeout(r, 300));

    client1.emit('bid:submit', { sessionId, idempotencyKey: `fallback_multi1_${Date.now()}` });
    const accepted1 = await waitForEvent<{ amount: number }>(client1, 'bid:accepted', 15_000);

    client2.emit('bid:submit', { sessionId, idempotencyKey: `fallback_multi2_${Date.now()}` });
    const accepted2 = await waitForEvent<{ amount: number }>(client2, 'bid:accepted', 15_000);

    expect(accepted2.amount).toBeGreaterThan(accepted1.amount);

    client1.disconnect();
    client2.disconnect();
  });

  it('降级路径下重复幂等键被正确拒绝', async () => {
    stopRedis();
    await new Promise((r) => setTimeout(r, 1000));

    client1 = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: bidder1.token },
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise<void>(r => client1.connected ? r() : client1.once('connect', r));

    client1.emit('auction:join', { roomId });
    await new Promise((r) => setTimeout(r, 200));

    const idemKey = `fallback_idem_${Date.now()}`;

    client1.emit('bid:submit', { sessionId, idempotencyKey: idemKey });
    await waitForEvent(client1, 'bid:accepted', 15_000);

    // Same idempotency key → rejected
    client1.emit('bid:submit', { sessionId, idempotencyKey: idemKey });
    const rejected = await waitForEvent<{ reason: string; code: number }>(
      client1, 'bid:rejected', 15_000,
    );

    expect(rejected.code).toBe(40901);
    expect(rejected.reason).toContain('重复');

    client1.disconnect();
  });

  it('Redis 恢复后 consistency-checker 通过: DB 与缓存对齐', async () => {
    // Phase 1: Place bids while Redis is down
    stopRedis();
    await new Promise((r) => setTimeout(r, 1000));

    client1 = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: bidder1.token },
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise<void>(r => client1.connected ? r() : client1.once('connect', r));

    client1.emit('auction:join', { roomId });
    await new Promise((r) => setTimeout(r, 200));

    client1.emit('bid:submit', { sessionId, idempotencyKey: `fallback_consistency_${Date.now()}` });

    const accepted = await waitForEvent<{ amount: number }>(client1, 'bid:accepted', 15_000);
    expect(accepted.amount).toBeGreaterThan(0);
    client1.disconnect();

    // Phase 2: Restart Redis and wait for it to be fully ready
    await startRedis();

    // Force ioredis to reconnect (may be in disconnected state from stopRedis)
    try { redisClient.disconnect(false); } catch {}
    await new Promise(r => setTimeout(r, 500));
    redisClient.connect();
    await new Promise(r => setTimeout(r, 1000));

    // Verify Redis is responsive
    const pong = await redisClient.ping();
    expect(pong).toBe('PONG');

    // Now restore circuit breaker state
    restoreRedisAvailability();

    // Phase 3: Rebuild auction cache from MySQL
    const { createAuctionService } = await import('../../../src/services/auction.service.js');
    const rebuildService = createAuctionService(null);
    await rebuildService.rebuildAuctionCache();

    // Debug: verify leaderboard was written
    const lbKey = `auction:${sessionId}:leaderboard`;
    const lbCount = await redisClient.zcard(lbKey);
    console.log(`[T036] After rebuild: leaderboard count=${lbCount}, redis_status=${redisClient.status}`);

    // Phase 4: Verify DB ↔ Redis consistency
    await assertAuctionConsistency(sessionId);

    expect(lbCount).toBeGreaterThan(0);
  });
});
