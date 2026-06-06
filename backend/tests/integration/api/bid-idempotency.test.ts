/**
 * T019: Bid idempotency integration test (SC-002).
 *
 * Validates that submitting the same idempotency key 100 times
 * produces exactly 1 effective bid record in DB and 1 Redis leaderboard entry.
 *
 * Uses real Fastify + Socket.IO + DB + Redis (no mocks).
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

function waitForEvents<T>(
  collector: T[],
  expectedCount: number,
  timeoutMs = 15_000,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const deadline = setTimeout(() => {
      if (settled) return;
      settled = true;
      clearInterval(interval);
      reject(new Error(`Timed out: expected ${expectedCount}, got ${collector.length}`));
    }, timeoutMs);
    const check = () => {
      if (settled) return;
      if (collector.length >= expectedCount) {
        settled = true;
        clearTimeout(deadline);
        clearInterval(interval);
        resolve(collector);
      }
    };
    const interval = setInterval(check, 20);
    check();
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let app: FastifyInstance;
let port: number;
let roomId: number;
let sessionId: number;
let user: { id: number; token: string };
let client: ClientSocket;

beforeAll(async () => {
  app = await setupTestApp();
  initWebSocket(app.server);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  port = typeof addr === 'object' && addr ? addr.port : 0;
});

afterAll(async () => {
  if (client?.connected) client.disconnect();
  await teardownTestApp(app);
});

beforeEach(async () => {
  await flushTestRedis();
  await truncateAll();

  const merchant = await seedUser({ username: 'idem_merchant', role: 'merchant' });
  const { productId } = await seedProduct(merchant.id, { name: '幂等测试商品' });
  roomId = await seedRoom(merchant.id, { title: '幂等测试间' });

  const auction = await seedActiveAuction({
    productId,
    roomId,
    ceilingPrice: null,
    durationSeconds: 600,
  });
  sessionId = auction.sessionId;

  const u = await seedUser({ username: 'idem_bidder', role: 'user' });
  user = { id: u.id, token: generateToken(u.id, 'user') };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('T019: 幂等键重复提交集成测试 (SC-002)', () => {
  it('同一幂等键提交 100 次: DB 仅 1 条 bid_record, Redis leaderboard 仅 1 条', async () => {
    // Use a single live collector so waitForEvents can observe growing length
    const results: { type: 'accepted' | 'rejected'; reason?: string }[] = [];

    client = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: user.token },
      transports: ['websocket'],
      forceNew: true,
    });

    client.on('bid:accepted', () => results.push({ type: 'accepted' }));
    client.on('bid:rejected', (d: { reason: string }) => results.push({ type: 'rejected', reason: d.reason }));

    await new Promise<void>((r) => (client.connected ? r() : client.once('connect', r)));
    client.emit('auction:join', { roomId });
    await new Promise((r) => setTimeout(r, 200));

    // Use the SAME idempotency key for all 100 submissions
    const idempotencyKey = `idem_duplicate_${Date.now()}`;
    const SUBMIT_COUNT = 100;
    const BATCH_SIZE = 10;

    // Submit in smaller batches to avoid overwhelming the server
    for (let batch = 0; batch < SUBMIT_COUNT; batch += BATCH_SIZE) {
      const end = Math.min(batch + BATCH_SIZE, SUBMIT_COUNT);
      for (let i = batch; i < end; i++) {
        client.emit('bid:submit', { sessionId, idempotencyKey });
      }
      // Small delay between batches to let the server process
      await new Promise((r) => setTimeout(r, 50));
    }

    // Wait for all responses (1 accepted + 99 rejected)
    await waitForEvents(results, SUBMIT_COUNT, 30_000);

    // Allow DB writes to settle
    await new Promise((r) => setTimeout(r, 500));

    // ---- Assertions ----
    const accepted = results.filter((r) => r.type === 'accepted');
    const rejected = results.filter((r) => r.type === 'rejected');

    // Exactly 1 accepted, 99 rejected
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(SUBMIT_COUNT - 1);
    // All rejections should mention duplicate
    for (const r of rejected) {
      expect(r.reason).toContain('重复');
    }

    // DB: exactly 1 bid record
    const dbBids = await db('bid_records').where({ session_id: sessionId });
    expect(dbBids).toHaveLength(1);
    expect(dbBids[0]!.user_id).toBe(user.id);

    // Redis leaderboard: exactly 1 member
    const redis = new Redis(REDIS_URL);
    try {
      const zcard = await redis.zcard(`auction:${sessionId}:leaderboard`);
      expect(zcard).toBe(1);

      const members = await redis.zrevrange(`auction:${sessionId}:leaderboard`, 0, -1, 'WITHSCORES');
      expect(members).toHaveLength(2); // 1 member + 1 score
      expect(Number(members[0])).toBe(user.id);
    } finally {
      await redis.quit();
    }

    client.disconnect();
  });
});

describe('Bid idempotency', () => {
  it('should reject same idempotency key twice', async () => {
    // This test validates the idempotency pattern in validateBid
    const ctx = {
      auctionStatus: 'active',
      currentPrice: 0,
      bidIncrement: 10,
      ceilingPrice: null,
      idempotencyKeyExists: true,
      rateLimitExceeded: false,
    };
    const result = (await import('../../../src/domain/bid.js')).validateBid(
      1,
      ctx,
    );
    expect(result).not.toBeNull();
    if (result) expect(result.code).toBe(40901);
  });

  it('should accept first occurrence of idempotency key', async () => {
    const ctx = {
      auctionStatus: 'active',
      currentPrice: 0,
      bidIncrement: 10,
      ceilingPrice: null,
      idempotencyKeyExists: false,
      rateLimitExceeded: false,
    };
    const result = (await import('../../../src/domain/bid.js')).validateBid(
      1,
      ctx,
    );
    expect(result).toBeNull();
  });
});
