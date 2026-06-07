/**
 * Concurrent rank consistency WebSocket integration test.
 *
 * Verifies that after multiple users bid concurrently or sequentially,
 * the rank:update events are consistent across all clients and arrive
 * within 1 second of each other (second-level sync).
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

import { setupTestApp, teardownTestApp } from '../setup.js';
import { initWebSocket } from '../../../src/ws/index.js';
import {
  seedUser,
  seedProduct,
  seedRoom,
  seedActiveAuction,
  generateToken,
  truncateAll,
} from '../../helpers/factory.js';
import { assertAuctionConsistency } from '../../helpers/consistency-checker.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RankEntry {
  rank: number;
  userId: number;
  userNickname: string;
  avatarUrl: string | null;
  amount: number;
  timestamp: string;
}

/**
 * Resolve when `expectedCount` items have been pushed into `collector`,
 * or reject after `timeoutMs` if the count is not reached.
 */
function collectEvents<T>(
  collector: T[],
  expectedCount: number,
  timeoutMs = 10_000,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const deadline = setTimeout(() => {
      if (settled) return;
      settled = true;
      clearInterval(interval);
      reject(
        new Error(
          `Timed out waiting for ${expectedCount} events (got ${collector.length})`,
        ),
      );
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

/**
 * Wait until `collector` has not grown for `stableMs` milliseconds,
 * indicating no more events are arriving.
 */
function waitForStable<T>(
  collector: T[],
  stableMs = 500,
  timeoutMs = 15_000,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    let lastLength = collector.length;
    let stableSince = Date.now();
    let settled = false;

    const deadline = setTimeout(() => {
      if (settled) return;
      settled = true;
      clearInterval(interval);
      reject(
        new Error(
          `Timed out waiting for stable collector (got ${collector.length} events)`,
        ),
      );
    }, timeoutMs);

    const interval = setInterval(() => {
      if (settled) return;
      if (collector.length === lastLength) {
        if (Date.now() - stableSince >= stableMs) {
          settled = true;
          clearTimeout(deadline);
          clearInterval(interval);
          resolve(collector);
        }
      } else {
        lastLength = collector.length;
        stableSince = Date.now();
      }
    }, 50);
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let app: FastifyInstance;
let port: number;

const CLIENT_COUNT = 10;

// Shared across tests — set in beforeAll
let roomId: number;
let sessionId: number;
let users: { id: number; token: string }[];

// Fresh per test — set in beforeEach
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

  const merchant = await seedUser({ role: 'merchant' });
  const { productId } = await seedProduct(merchant.id);
  roomId = await seedRoom(merchant.id);

  const auction = await seedActiveAuction({
    productId,
    roomId,
    ceilingPrice: null,
    durationSeconds: 600,
  });
  sessionId = auction.sessionId;

  users = [];
  for (let i = 0; i < CLIENT_COUNT; i++) {
    const u = await seedUser({ role: 'user' });
    users.push({ id: u.id, token: generateToken(u.id, 'user') });
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('排名一致性与秒级同步集成测试', () => {
  it(
    `${CLIENT_COUNT} 个用户同时出价: 排名正确 + 1s 内同步`,
    async () => {
      const accepted: { clientId: number; userId: number; amount: number }[] = [];
      const rejected: { clientId: number; reason: string }[] = [];
      // Per-client rank:update tracking
      const rankUpdates: Map<number, { ranks: RankEntry[]; timestamp: number }[]> = new Map();

      // --- Create clients and wire up event listeners ---
      for (let i = 0; i < CLIENT_COUNT; i++) {
        const socket = ioClient(`http://127.0.0.1:${port}`, {
          auth: { token: users[i]!.token },
          transports: ['websocket'],
          forceNew: true,
        });
        clients.push(socket);

        const clientId = i;
        rankUpdates.set(clientId, []);

        socket.on('bid:accepted', (data: { amount: number; isLeading: boolean }) => {
          accepted.push({
            clientId,
            userId: users[clientId]!.id,
            amount: data.amount,
          });
        });

        socket.on('bid:rejected', (data: { reason: string }) => {
          rejected.push({ clientId, reason: data.reason });
        });

        socket.on('rank:update', (data: RankEntry[]) => {
          rankUpdates.get(clientId)!.push({ ranks: data, timestamp: Date.now() });
        });
      }

      // --- Wait for all clients to connect ---
      await Promise.all(
        clients.map(
          (s) =>
            new Promise<void>((resolve) => {
              if (s.connected) return resolve();
              s.once('connect', () => resolve());
            }),
        ),
      );

      // --- Join room ---
      for (let i = 0; i < CLIENT_COUNT; i++) {
        clients[i]!.emit('auction:join', { roomId });
      }
      await new Promise((r) => setTimeout(r, 100));

      // --- Fire all bids simultaneously via Promise.all ---
      await Promise.all(
        clients.map((client, i) =>
          new Promise<void>((resolve) => {
            client.emit('bid:submit', {
              sessionId,
              idempotencyKey: `rank_concurrent_${users[i]!.id}_${Date.now()}`,
            });
            resolve();
          }),
        ),
      );

      // --- Wait for bids to settle (some may be rejected due to CAS conflict) ---
      // Allow enough time for all bids to be processed (Redis CAS path, no session lock)
      await waitForStable(accepted, 500, 10_000);

      // Disconnect clients to stop background broadcasts
      for (const c of clients) c.disconnect();

      // --- Assertions ---

      // 1. At least some bids were accepted
      expect(accepted.length).toBeGreaterThan(0);

      // 2. Each accepted bid has a unique amount (sequential processing increments price)
      const amounts = accepted.map((a) => a.amount);
      const uniqueAmounts = new Set(amounts);
      expect(uniqueAmounts.size).toBe(accepted.length);

      // 3. Each accepted user is unique
      const userIds = accepted.map((a) => a.userId);
      expect(new Set(userIds).size).toBe(accepted.length);

      // 4. Rank consistency: all clients that received rank:update should agree
      //    on the final ranking order
      const finalRanks: RankEntry[][] = [];
      for (const [clientId, updates] of rankUpdates) {
        if (updates.length > 0) {
          finalRanks.push(updates[updates.length - 1]!.ranks);
        }
      }

      if (finalRanks.length >= 2) {
        // Compare all final rankings — they should be identical
        const reference = finalRanks[0]!;
        for (let i = 1; i < finalRanks.length; i++) {
          const other = finalRanks[i]!;
          // Same number of ranked users
          expect(other.length).toBe(reference.length);
          // Same users in same rank positions
          for (let j = 0; j < reference.length; j++) {
            expect(other[j]!.userId).toBe(reference[j]!.userId);
            expect(other[j]!.rank).toBe(reference[j]!.rank);
          }
        }
      }

      // 5. The ranking itself is correct: amounts in descending order
      if (finalRanks.length > 0) {
        const ranking = finalRanks[0]!;
        for (let i = 1; i < ranking.length; i++) {
          expect(ranking[i]!.amount).toBeLessThanOrEqual(ranking[i - 1]!.amount);
        }
        // Ranks are 1..N with no duplicates
        const rankNumbers = ranking.map((r) => r.rank);
        expect(rankNumbers).toEqual(
          ranking.map((_, idx) => idx + 1),
        );
      }

      // 6. Second-level sync: all clients received the final rank:update within 1s
      const rankUpdateTimes: number[] = [];
      for (const [, updates] of rankUpdates) {
        if (updates.length > 0) {
          rankUpdateTimes.push(updates[updates.length - 1]!.timestamp);
        }
      }
      if (rankUpdateTimes.length >= 2) {
        const maxTime = Math.max(...rankUpdateTimes);
        const minTime = Math.min(...rankUpdateTimes);
        expect(maxTime - minTime).toBeLessThan(1000);
      }

      // 7. Consistency check
      await assertAuctionConsistency(sessionId);
    },
    30_000,
  );

  it(
    '5 用户依次出价: 排名正确（基线对照）',
    async () => {
      const SEQUENTIAL_COUNT = 5;
      const accepted: { clientId: number; userId: number; amount: number }[] = [];
      const rejected: { clientId: number; reason: string }[] = [];
      const rankUpdates: Map<number, { ranks: RankEntry[]; timestamp: number }[]> = new Map();

      for (let i = 0; i < SEQUENTIAL_COUNT; i++) {
        const socket = ioClient(`http://127.0.0.1:${port}`, {
          auth: { token: users[i]!.token },
          transports: ['websocket'],
          forceNew: true,
        });
        clients.push(socket);

        const clientId = i;
        rankUpdates.set(clientId, []);

        socket.on('bid:accepted', (data: { amount: number; isLeading: boolean }) => {
          accepted.push({
            clientId,
            userId: users[clientId]!.id,
            amount: data.amount,
          });
        });

        socket.on('bid:rejected', (data: { reason: string }) => {
          rejected.push({ clientId, reason: data.reason });
        });

        socket.on('rank:update', (data: RankEntry[]) => {
          rankUpdates.get(clientId)!.push({ ranks: data, timestamp: Date.now() });
        });
      }

      // Wait for all clients to connect
      await Promise.all(
        clients.map(
          (s) =>
            new Promise<void>((resolve) => {
              if (s.connected) return resolve();
              s.once('connect', () => resolve());
            }),
        ),
      );

      // Join room
      for (let i = 0; i < SEQUENTIAL_COUNT; i++) {
        clients[i]!.emit('auction:join', { roomId });
      }
      await new Promise((r) => setTimeout(r, 100));

      // Bid sequentially with 200ms intervals
      for (let i = 0; i < SEQUENTIAL_COUNT; i++) {
        clients[i]!.emit('bid:submit', {
          sessionId,
          idempotencyKey: `rank_seq_${users[i]!.id}_${Date.now()}`,
        });
        await new Promise((r) => setTimeout(r, 200));
      }

      // Wait for all bids to be accepted
      await collectEvents(accepted, SEQUENTIAL_COUNT, 15_000);

      for (const c of clients) c.disconnect();

      // --- Assertions ---

      // All bids accepted
      expect(accepted).toHaveLength(SEQUENTIAL_COUNT);
      expect(rejected).toHaveLength(0);

      // Unique amounts (sequential processing)
      const amounts = accepted.map((a) => a.amount);
      expect(new Set(amounts).size).toBe(SEQUENTIAL_COUNT);

      // Unique users
      const userIds = accepted.map((a) => a.userId);
      expect(new Set(userIds).size).toBe(SEQUENTIAL_COUNT);

      // Rank correctness: amounts in descending order = ranks in ascending order
      const finalRanks: RankEntry[][] = [];
      for (const [, updates] of rankUpdates) {
        if (updates.length > 0) {
          finalRanks.push(updates[updates.length - 1]!.ranks);
        }
      }

      if (finalRanks.length > 0) {
        const ranking = finalRanks[0]!;
        // Amounts should be in descending order
        for (let i = 1; i < ranking.length; i++) {
          expect(ranking[i]!.amount).toBeLessThanOrEqual(ranking[i - 1]!.amount);
        }
        // Ranks are 1..N
        const rankNumbers = ranking.map((r) => r.rank);
        expect(rankNumbers).toEqual(
          ranking.map((_, idx) => idx + 1),
        );
      }

      // Consistency check
      await assertAuctionConsistency(sessionId);
    },
    30_000,
  );

  it(
    '3 用户快速连续出价: 排名正确 + 无重复',
    async () => {
      const RAPID_COUNT = 3;
      const accepted: { clientId: number; userId: number; amount: number; idempotencyKey: string }[] = [];
      const rejected: { clientId: number; reason: string }[] = [];
      const rankUpdates: Map<number, { ranks: RankEntry[]; timestamp: number }[]> = new Map();

      for (let i = 0; i < RAPID_COUNT; i++) {
        const socket = ioClient(`http://127.0.0.1:${port}`, {
          auth: { token: users[i]!.token },
          transports: ['websocket'],
          forceNew: true,
        });
        clients.push(socket);

        const clientId = i;
        rankUpdates.set(clientId, []);

        socket.on('bid:accepted', (data: { amount: number; isLeading: boolean; idempotencyKey: string }) => {
          accepted.push({
            clientId,
            userId: users[clientId]!.id,
            amount: data.amount,
            idempotencyKey: data.idempotencyKey,
          });
        });

        socket.on('bid:rejected', (data: { reason: string }) => {
          rejected.push({ clientId, reason: data.reason });
        });

        socket.on('rank:update', (data: RankEntry[]) => {
          rankUpdates.get(clientId)!.push({ ranks: data, timestamp: Date.now() });
        });
      }

      // Wait for all clients to connect
      await Promise.all(
        clients.map(
          (s) =>
            new Promise<void>((resolve) => {
              if (s.connected) return resolve();
              s.once('connect', () => resolve());
            }),
        ),
      );

      // Join room
      for (let i = 0; i < RAPID_COUNT; i++) {
        clients[i]!.emit('auction:join', { roomId });
      }
      await new Promise((r) => setTimeout(r, 100));

      // Rapid consecutive bids with 100ms intervals
      for (let i = 0; i < RAPID_COUNT; i++) {
        clients[i]!.emit('bid:submit', {
          sessionId,
          idempotencyKey: `rank_rapid_${users[i]!.id}_${Date.now()}`,
        });
        await new Promise((r) => setTimeout(r, 100));
      }

      // Wait for all bids to settle
      await waitForStable(accepted, 500, 15_000);

      for (const c of clients) c.disconnect();

      // --- Assertions ---

      // All bids should be accepted (100ms gap is enough for Redis CAS path)
      expect(accepted.length).toBe(RAPID_COUNT);

      // No duplicate idempotency keys
      const keys = accepted.map((a) => a.idempotencyKey);
      expect(new Set(keys).size).toBe(accepted.length);

      // Unique amounts
      const amounts = accepted.map((a) => a.amount);
      expect(new Set(amounts).size).toBe(RAPID_COUNT);

      // Unique users
      const userIds = accepted.map((a) => a.userId);
      expect(new Set(userIds).size).toBe(RAPID_COUNT);

      // Rank correctness
      const finalRanks: RankEntry[][] = [];
      for (const [, updates] of rankUpdates) {
        if (updates.length > 0) {
          finalRanks.push(updates[updates.length - 1]!.ranks);
        }
      }

      if (finalRanks.length > 0) {
        const ranking = finalRanks[0]!;
        for (let i = 1; i < ranking.length; i++) {
          expect(ranking[i]!.amount).toBeLessThanOrEqual(ranking[i - 1]!.amount);
        }
        const rankNumbers = ranking.map((r) => r.rank);
        expect(rankNumbers).toEqual(
          ranking.map((_, idx) => idx + 1),
        );
      }

      // Consistency check
      await assertAuctionConsistency(sessionId);
    },
    30_000,
  );
});
