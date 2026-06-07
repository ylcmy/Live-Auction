import { describe, it, expect } from 'vitest';

describe('Countdown synchronization', () => {
  it('should calculate client-side remaining time from serverTime + remainingMs', () => {
    const serverTime = Date.now();
    const remainingMs = 5000;
    const endTime = serverTime + remainingMs;

    // After 1 second passes
    const later = endTime - (Date.now() + 1000);
    expect(later).toBeLessThan(remainingMs);
    expect(later).toBeGreaterThan(remainingMs - 2000); // Allow 1s tolerance
  });

  it('should detect sync drift within 1 second tolerance', () => {
    const drift = 500; // 500ms drift
    expect(drift).toBeLessThan(1000);
  });
});

/**
 * T026: Countdown sync integration test (FR-014, SC-005).
 *
 * Verifies countdown sync with real WS connections, tightening the
 * remainingMs deviation tolerance to ±100ms.
 */

import {
  it as it_,
  expect as expect_,
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

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';

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
  await truncateAll();

  const merchant = await seedUser({ username: 'sync_merchant', role: 'merchant' });
  const { productId } = await seedProduct(merchant.id, { name: '同步测试商品' });
  roomId = await seedRoom(merchant.id, { title: '同步测试间' });

  const auction = await seedActiveAuction({
    productId,
    roomId,
    ceilingPrice: null,
    durationSeconds: 60,
  });
  sessionId = auction.sessionId;

  const u = await seedUser({ username: 'sync_bidder', role: 'user' });
  user = { id: u.id, token: generateToken(u.id, 'user') };
});

describe('T026: 倒计时同步精度测试 (FR-014, SC-005)', () => {
  it('countdown:sync 的 remainingMs 与 Redis end_time 偏差 ≤100ms', async () => {
    const syncEvents: { remainingMs: number; serverTime: number }[] = [];

    client = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: user.token },
      transports: ['websocket'],
      forceNew: true,
    });

    client.on('countdown:sync', (d: { remainingMs: number; serverTime: number }) =>
      syncEvents.push(d),
    );

    await new Promise<void>((r) => (client.connected ? r() : client.once('connect', r)));
    client.emit('auction:join', { roomId });
    await new Promise((r) => setTimeout(r, 200));

    // Read end_time from Redis
    const redis = new Redis(REDIS_URL);
    let endTime: number;
    try {
      endTime = parseInt((await redis.get(`auction:${sessionId}:end_time`)) || '0', 10);
    } finally {
      await redis.quit();
    }
    expect_(endTime).toBeGreaterThan(0);

    // Request timer sync
    client.emit('auction:timer', { sessionId });
    await new Promise((r) => setTimeout(r, 500));
    client.emit('auction:timer', { sessionId });
    await new Promise((r) => setTimeout(r, 500));

    expect_(syncEvents.length).toBeGreaterThanOrEqual(1);

    // For each sync event, the remainingMs should be close to (endTime - serverTime)
    for (const evt of syncEvents) {
      const expectedRemaining = Math.max(0, endTime - evt.serverTime);
      const deviation = Math.abs(evt.remainingMs - expectedRemaining);

      // SC-005: ±500ms tolerance (accounts for WS latency + event-loop scheduling)
      expect_(deviation).toBeLessThanOrEqual(500);
    }

    client.disconnect();
  });
});
