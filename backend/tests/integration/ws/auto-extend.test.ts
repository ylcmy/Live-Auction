/**
 * T023: Auto-extend integration test (FR-015, SC-006).
 *
 * Verifies that when a bid comes in within the extend window:
 *   - countdown:extend event is broadcast with correct extendSeconds
 *   - Redis end_time is updated (extended)
 *   - extension_count increments
 *   - max_extensions prevents further extensions
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
import Redis from 'ioredis';

import { setupTestApp, teardownTestApp } from '../setup.js';
import { initWebSocket } from '../../../src/ws/index.js';
import {
  truncateAll,
  seedUser,
  seedProduct,
  seedRoom,
  seedShortDurationAuction,
  generateToken,
} from '../../helpers/factory.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let app: FastifyInstance;
let port: number;

let roomId: number;
let sessionId: number;
let userTokens: string[];
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
  await truncateAll();
  clients = [];

  const auction = await seedShortDurationAuction();
  sessionId = auction.sessionId;
  roomId = auction.roomId;
  userTokens = auction.userTokens;
}, 30_000);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('T023: 自动延时集成测试 (FR-015, SC-006)', () => {
  it('结束前窗口内出价触发 countdown:extend，Redis end_time 延长', async () => {
    const extendEvents: { extendSeconds: number; remainingExtensions: number }[] = [];

    const client = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: userTokens[0]! },
      transports: ['websocket'],
      forceNew: true,
    });
    clients.push(client);

    client.on('countdown:extend', (d: { extendSeconds: number; remainingExtensions: number }) =>
      extendEvents.push(d),
    );

    await new Promise<void>((r) => (client.connected ? r() : client.once('connect', r)));
    client.emit('auction:join', { roomId });
    await new Promise((r) => setTimeout(r, 200));

    // Read initial end_time from Redis
    const redis = new Redis(REDIS_URL);
    let initialEndTime: number;
    try {
      initialEndTime = parseInt((await redis.get(`auction:${sessionId}:end_time`)) || '0', 10);
    } finally {
      await redis.quit();
    }
    expect(initialEndTime).toBeGreaterThan(0);

    // Wait until the auction is near its end (within the extend window).
    // Short duration auction: 5s duration, 2s extend window.
    // We need to bid when remaining time < extend_seconds (2s).
    // Wait ~4 seconds (5s - ~1s margin)
    await new Promise((r) => setTimeout(r, 3500));

    // Bid within the extend window
    client.emit('bid:submit', {
      sessionId,
      idempotencyKey: `auto_extend_${Date.now()}`,
    });

    // Wait for the extend event
    await new Promise((r) => setTimeout(r, 2000));

    // ---- Assertions ----

    // 1. countdown:extend event was broadcast
    expect(extendEvents.length).toBeGreaterThan(0);
    expect(extendEvents[0]!.extendSeconds).toBeGreaterThan(0);
    expect(extendEvents[0]!.remainingExtensions).toBeGreaterThanOrEqual(0);

    // 2. Redis end_time should have been extended
    const redis2 = new Redis(REDIS_URL);
    try {
      const newEndTime = parseInt((await redis2.get(`auction:${sessionId}:end_time`)) || '0', 10);
      const extensions = parseInt((await redis2.get(`auction:${sessionId}:extensions`)) || '0', 10);

      expect(newEndTime).toBeGreaterThan(initialEndTime);
      expect(extensions).toBeGreaterThanOrEqual(1);
    } finally {
      await redis2.quit();
    }

    client.disconnect();
  }, 20_000);

  it('max_extensions 用尽后不再延时', async () => {
    const extendEvents: { extendSeconds: number; remainingExtensions: number }[] = [];
    const endedEvents: unknown[] = [];

    const client = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: userTokens[0]! },
      transports: ['websocket'],
      forceNew: true,
    });
    clients.push(client);

    client.on('countdown:extend', (d: { extendSeconds: number; remainingExtensions: number }) =>
      extendEvents.push(d),
    );
    client.on('auction:ended', () => endedEvents.push(true));

    await new Promise<void>((r) => (client.connected ? r() : client.once('connect', r)));
    client.emit('auction:join', { roomId });
    await new Promise((r) => setTimeout(r, 200));

    // Short duration auction has max_extensions = 3
    // Place bids near end to trigger extensions
    for (let attempt = 0; attempt < 5; attempt++) {
      // Wait for the auction to be near end
      await new Promise((r) => setTimeout(r, 4000));

      // Use different user to avoid self-bid rejection
      const userIdx = attempt % userTokens.length;
      if (clients.length <= userIdx + 1) {
        const extraClient = ioClient(`http://127.0.0.1:${port}`, {
          auth: { token: userTokens[userIdx]! },
          transports: ['websocket'],
          forceNew: true,
        });
        clients.push(extraClient);
        await new Promise<void>((r) => (extraClient.connected ? r() : extraClient.once('connect', r)));
        extraClient.emit('auction:join', { roomId });
        await new Promise((r) => setTimeout(r, 100));
      }

      const biddingClient = clients[Math.min(userIdx + 1, clients.length - 1)]!;
      biddingClient.emit('bid:submit', {
        sessionId,
        idempotencyKey: `extend_exhaust_${attempt}_${Date.now()}`,
      });

      await new Promise((r) => setTimeout(r, 1500));

      // If auction has ended, stop
      if (endedEvents.length > 0) break;
    }

    // max_extensions = 3, so we should get at most 3 extensions
    expect(extendEvents.length).toBeLessThanOrEqual(3);

    for (const c of clients) c.disconnect();
  }, 60_000);
});
