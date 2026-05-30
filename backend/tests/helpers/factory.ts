/**
 * Integration test seed helpers.
 *
 * Inserts real rows into MySQL via knex and seeds Redis cache
 * for auction-related tests. Every function returns the primary key(s)
 * needed by callers to build subsequent fixtures or assertions.
 *
 * Call `truncateAll()` in beforeEach / afterEach to get a clean slate
 * across the tables the tests touch.
 */

import jwt from 'jsonwebtoken';
import { db } from '../../src/infrastructure/db/knex.js';
import { cache } from '../../src/infrastructure/cache/redis.js';

// Must match the values in src/config/env.ts (loaded from .env / .env.test)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Truncate every table used by integration tests, respecting FK constraints.
 */
export async function truncateAll(): Promise<void> {
  await db.raw('SET FOREIGN_KEY_CHECKS = 0');
  await db('bid_records').truncate();
  await db('orders').truncate();
  await db('auction_sessions').truncate();
  await db('auction_rules').truncate();
  await db('products').truncate();
  await db('live_rooms').truncate();
  await db('users').truncate();
  await db.raw('SET FOREIGN_KEY_CHECKS = 1');
}

// ---------------------------------------------------------------------------
// Seed: Users
// ---------------------------------------------------------------------------

/**
 * Insert a user row and return { id, username, nickname, role }.
 */
export async function seedUser(
  overrides: Partial<{ username: string; role: 'merchant' | 'user'; nickname: string }> = {},
) {
  const ts = Date.now();
  const defaults = {
    username: `ws_user_${ts}_${Math.random().toString(36).slice(2, 6)}`,
    password_hash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ12',
    role: 'user' as const,
    nickname: `WS测试用户_${ts}`,
    avatar_url: '',
  };
  const row = { ...defaults, ...overrides };
  const [id] = await db('users').insert(row);
  return { id: id as number, username: row.username, nickname: row.nickname, role: row.role };
}

// ---------------------------------------------------------------------------
// Seed: Products
// ---------------------------------------------------------------------------

/**
 * Insert a product row and return { productId }.
 */
export async function seedProduct(
  merchantId: number,
  overrides: Partial<{ name: string; status: string }> = {},
) {
  const ts = Date.now();
  const defaults = {
    merchant_id: merchantId,
    name: `WS商品_${ts}`,
    description: '竞拍集成测试商品',
    image_url: 'https://example.com/img.jpg',
    category: '测试',
    status: 'listed',
  };
  const row = { ...defaults, ...overrides };
  const [productId] = await db('products').insert(row);
  return { productId: productId as number };
}

// ---------------------------------------------------------------------------
// Seed: Live Rooms
// ---------------------------------------------------------------------------

/**
 * Insert a live_room row and return the room id.
 */
export async function seedRoom(
  hostId: number,
  overrides: Partial<{ title: string; status: string }> = {},
) {
  const ts = Date.now();
  const defaults = {
    host_id: hostId,
    title: `WS测试直播间_${ts}`,
    status: 'live',
    stream_url: 'https://example.com/stream',
  };
  const row = { ...defaults, ...overrides };
  const [roomId] = await db('live_rooms').insert(row);
  return roomId as number;
}

// ---------------------------------------------------------------------------
// Seed: Auction Sessions  (DB row only)
// ---------------------------------------------------------------------------

/**
 * Insert an auction_session + matching auction_rule row.
 * Returns { sessionId, ruleId, productId, roomId }.
 */
export async function seedAuctionSession(opts: {
  productId: number;
  ruleId?: number;
  roomId: number;
  status?: string;
  currentPrice?: number;
  ceilingPrice?: number | null;
}) {
  // Create a rule if not provided
  let ruleId = opts.ruleId;
  if (!ruleId) {
    const [rid] = await db('auction_rules').insert({
      product_id: opts.productId,
      start_price: 100,
      bid_increment: 10,
      ceiling_price: opts.ceilingPrice ?? null,
      duration_seconds: 300,
      extend_seconds: 30,
      max_extensions: 5,
    });
    ruleId = rid as number;
  }

  const [sessionId] = await db('auction_sessions').insert({
    product_id: opts.productId,
    rule_id: ruleId,
    room_id: opts.roomId,
    status: opts.status ?? 'active',
    current_price: opts.currentPrice ?? 100,
    started_at: new Date(),
    extension_count: 0,
  });

  return { sessionId: sessionId as number, ruleId, productId: opts.productId, roomId: opts.roomId };
}

// ---------------------------------------------------------------------------
// Seed: Active Auction  (DB row + Redis cache)
// ---------------------------------------------------------------------------

/**
 * Create an auction_session (DB) and pre-populate the Redis cache keys
 * that `bidService.processBid()` and the WS auction handlers depend on:
 *   - auction:<sid>:end_time   (far future so the auction stays active)
 *   - auction:<sid>:status     = 'active'
 *   - auction:<sid>:extensions = '0'
 *   - auction:<sid>:product_id / room_id
 *   - auction:<sid>:top_bid    (JSON)
 *   - room:<rid>:active_session
 *
 * Returns { sessionId, ruleId, productId, roomId }.
 */
export async function seedActiveAuction(opts: {
  productId: number;
  roomId: number;
  ceilingPrice?: number | null;
  durationSeconds?: number;
}) {
  const { sessionId, ruleId, productId, roomId } = await seedAuctionSession({
    productId: opts.productId,
    roomId: opts.roomId,
    status: 'active',
    currentPrice: 100,
    ceilingPrice: opts.ceilingPrice ?? null,
  });

  const durationSeconds = opts.durationSeconds ?? 300;
  const endTime = Date.now() + durationSeconds * 1000;

  try {
    await Promise.all([
      cache.set(`auction:${sessionId}:end_time`, String(endTime)),
      cache.set(`auction:${sessionId}:status`, 'active'),
      cache.set(`auction:${sessionId}:extensions`, '0'),
      cache.set(`auction:${sessionId}:product_id`, String(productId)),
      cache.set(`auction:${sessionId}:room_id`, String(roomId)),
      cache.set(
        `auction:${sessionId}:top_bid`,
        JSON.stringify({ userId: 0, amount: 100, timestamp: Date.now() }),
      ),
      cache.set(`room:${roomId}:active_session`, String(sessionId)),
    ]);
  } catch {
    // If Redis is not available the test will fail at runtime; the seed
    // should still succeed at the DB layer so other assertions can run.
  }

  return { sessionId, ruleId, productId, roomId };
}

// ---------------------------------------------------------------------------
// Auth helpers (JWT tokens for WS handshake)
// ---------------------------------------------------------------------------

/**
 * Generate a signed JWT matching the shape the WS auth middleware expects.
 */
export function generateToken(userId: number, role: 'merchant' | 'user' = 'user'): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Build an Authorization header object for Fastify inject() calls.
 */
export function authHeader(userId: number, role: 'merchant' | 'user' = 'user') {
  return { Authorization: `Bearer ${generateToken(userId, role)}` };
}
