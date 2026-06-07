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
import { flushAll } from './redis-test-utils.js';
import { getAuctionService } from '../../src/services/auction.service.js';

// Must match the values in src/config/env.ts (loaded from .env / .env.test)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Truncate every table used by integration tests, respecting FK constraints.
 */
export async function truncateAll(): Promise<void> {
  // Use a transaction to guarantee all operations run on the same DB connection,
  // so SET FOREIGN_KEY_CHECKS = 0 stays in effect for subsequent DELETEs.
  // We use del() instead of truncate() because TRUNCATE causes implicit commit
  // in MySQL which would break the transaction.
  await db.transaction(async (trx) => {
    await trx.raw('SET FOREIGN_KEY_CHECKS = 0');
    await trx('bid_records').del();
    await trx('orders').del();
    await trx('auction_sessions').del();
    await trx('auction_rules').del();
    await trx('products').del();
    await trx('live_rooms').del();
    await trx('users').del();
    await trx.raw('SET FOREIGN_KEY_CHECKS = 1');
  });
  try {
    await flushAll();
  } catch {
    // Redis optional during API-only tests
  }
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

  // Auto-create a default auction rule so startAuction can find it
  const [ruleId] = await db('auction_rules').insert({
    product_id: productId,
    start_price: 100,
    bid_increment: 10,
    ceiling_price: null,
    duration_seconds: 300,
    extend_seconds: 30,
    max_extensions: 5,
    created_at: new Date(),
    updated_at: new Date(),
  });

  return { productId: productId as number, ruleId: ruleId as number };
}

// ---------------------------------------------------------------------------
// Seed: Live Rooms
// ---------------------------------------------------------------------------

/**
 * Insert a live_room row and return the room id.
 * Automatically creates a new host if the given hostId already has a room
 * (due to live_rooms_host_id_unique constraint).
 */
export async function seedRoom(
  hostId: number,
  overrides: Partial<{ title: string; status: string }> = {},
) {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);

  // Check if this host already has a room; if so, auto-create a new host
  let effectiveHostId = hostId;
  try {
    const existing = await db('live_rooms').where({ host_id: hostId }).first();
    if (existing) {
      const newHost = await seedUser({ username: `auto_host_${ts}_${rand}`, role: 'merchant' });
      effectiveHostId = newHost.id;
    }
  } catch {
    // If query fails, proceed with original hostId
  }

  const defaults = {
    host_id: effectiveHostId,
    title: `WS测试直播间_${ts}_${rand}`,
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
  // Create a rule if not provided — reuse existing rule for this product if one exists
  let ruleId = opts.ruleId;
  if (!ruleId) {
    const existing = await db('auction_rules').where({ product_id: opts.productId }).first();
    if (existing) {
      ruleId = existing.id;
    } else {
      const [rid] = await db('auction_rules').insert({
        product_id: opts.productId,
        start_price: 100,
        bid_increment: 10,
        ceiling_price: opts.ceilingPrice ?? null,
        duration_seconds: 300,
        extend_seconds: 30,
        max_extensions: 5,
        created_at: new Date(),
        updated_at: new Date(),
      });
      ruleId = rid as number;
    }
  }

  const status = opts.status ?? 'active';
  const roomId = opts.roomId;
  const [sessionId] = await db('auction_sessions').insert({
    product_id: opts.productId,
    rule_id: ruleId,
    room_id: roomId,
    active_room_id: status === 'active' || status === 'pending' ? roomId : null,
    status,
    current_price: opts.currentPrice ?? 100,
    started_at: new Date(),
    extension_count: 0,
    version: 0,
  });

  return { sessionId: sessionId as number, ruleId, productId: opts.productId, roomId };
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
  ruleId?: number;
  ceilingPrice?: number | null;
  durationSeconds?: number;
  extendSeconds?: number;
  maxExtensions?: number;
}) {
  const { sessionId, ruleId, productId, roomId } = await seedAuctionSession({
    productId: opts.productId,
    roomId: opts.roomId,
    ruleId: opts.ruleId,
    status: 'active',
    currentPrice: 100,
    ceilingPrice: opts.ceilingPrice ?? null,
  });

  const durationSeconds = opts.durationSeconds ?? 300;
  const endTime = Date.now() + durationSeconds * 1000;

  // Update the rule in DB so duration/extend/max/ceiling match the test intent
  if (ruleId && (opts.durationSeconds !== undefined || opts.extendSeconds !== undefined || opts.maxExtensions !== undefined || opts.ceilingPrice !== undefined)) {
    const updates: Record<string, unknown> = {};
    if (opts.durationSeconds !== undefined) updates.duration_seconds = opts.durationSeconds;
    if (opts.extendSeconds !== undefined) updates.extend_seconds = opts.extendSeconds;
    if (opts.maxExtensions !== undefined) updates.max_extensions = opts.maxExtensions;
    if (opts.ceilingPrice !== undefined) updates.ceiling_price = opts.ceilingPrice;
    if (Object.keys(updates).length > 0) {
      await db('auction_rules').where({ id: ruleId }).update(updates);
    }
  }

  // Fetch the rule and product for Redis cache (bid service needs rule + merchant_id)
  const rule = await db('auction_rules').where({ id: ruleId }).first();
  const product = await db('products').where({ id: productId }).first();

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
      // Cache keys required by bidService.getAuctionContextFromCache
      cache.set(
        `auction:${sessionId}:rule`,
        JSON.stringify({
          bid_increment: Number(rule.bid_increment),
          ceiling_price: rule.ceiling_price ? Number(rule.ceiling_price) : null,
          max_extensions: rule.max_extensions,
          extend_seconds: rule.extend_seconds,
        }),
      ),
      cache.set(`auction:${sessionId}:merchant_id`, String(product.merchant_id)),
    ]);
  } catch {
    // If Redis is not available the test will fail at runtime; the seed
    // should still succeed at the DB layer so other assertions can run.
  }

  // Schedule the settlement timer so the auction ends naturally
  try {
    const service = getAuctionService();
    service.rescheduleSettlement(sessionId, durationSeconds * 1000);
  } catch {
    // AuctionService not initialized (e.g., API-only tests without WebSocket)
  }

  return { sessionId, ruleId, productId, roomId };
}

// ---------------------------------------------------------------------------
// Seed: Orders
// ---------------------------------------------------------------------------

export async function seedOrder(data: {
  sessionId: number;
  buyerId: number;
  productId: number;
  finalPrice: number;
  status?: string;
}): Promise<number> {
  const [id] = await db('orders').insert({
    session_id: data.sessionId,
    buyer_id: data.buyerId,
    product_id: data.productId,
    final_price: data.finalPrice,
    status: data.status ?? 'pending_payment',
    expire_at: new Date(Date.now() + 15 * 60 * 1000),
  });
  return id as number;
}

// ---------------------------------------------------------------------------
// Specialized auction seeds (005)
// ---------------------------------------------------------------------------

export async function seedNearCeilingAuction(opts?: {
  ceilingPrice?: number;
  currentPrice?: number;
  roomId?: number;
}) {
  const merchant = await seedUser({ role: 'merchant' });
  const { productId, ruleId } = await seedProduct(merchant.id);
  const roomId = opts?.roomId ?? (await seedRoom(merchant.id));
  const ceiling = opts?.ceilingPrice ?? 200;
  const current = opts?.currentPrice ?? ceiling - 10;

  // Update the existing rule's ceiling_price
  await db('auction_rules').where({ id: ruleId }).update({ ceiling_price: ceiling });

  const { sessionId } = await seedActiveAuction({
    productId,
    roomId,
    ruleId,
    ceilingPrice: ceiling,
    durationSeconds: 300,
  });
  await db('auction_sessions').where({ id: sessionId }).update({
    current_price: current,
  });
  await cache.set(
    `auction:${sessionId}:top_bid`,
    JSON.stringify({ userId: 0, amount: current, timestamp: Date.now() }),
  );
  return { sessionId, ruleId, productId, roomId, merchantId: merchant.id, ceilingPrice: ceiling };
}

export async function seedShortDurationAuction() {
  const merchant = await seedUser({ role: 'merchant' });
  const { productId, ruleId } = await seedProduct(merchant.id);
  const roomId = await seedRoom(merchant.id);

  // Update the existing rule for short duration
  await db('auction_rules').where({ id: ruleId }).update({
    duration_seconds: 5,
    extend_seconds: 2,
    max_extensions: 3,
  });

  const { sessionId } = await seedActiveAuction({
    productId,
    roomId,
    ruleId,
    durationSeconds: 5,
  });
  const users = await Promise.all([seedUser(), seedUser()]);
  return {
    sessionId,
    ruleId,
    productId,
    roomId,
    merchantToken: generateToken(merchant.id, 'merchant'),
    userTokens: users.map((u) => generateToken(u.id, 'user')),
  };
}

export async function seedAuctionWithBids(bidCount: number) {
  const merchant = await seedUser({ role: 'merchant' });
  const { productId } = await seedProduct(merchant.id);
  const roomId = await seedRoom(merchant.id);
  const { sessionId } = await seedActiveAuction({ productId, roomId });
  const bidders = await Promise.all(
    Array.from({ length: bidCount }, () => seedUser()),
  );
  const bidIds: number[] = [];
  let amount = 100;
  for (const bidder of bidders) {
    amount += 10;
    const key = `bid-${sessionId}-${bidder.id}-${amount}`;
    const [bidId] = await db('bid_records').insert({
      session_id: sessionId,
      user_id: bidder.id,
      bid_amount: amount,
      idempotency_key: key,
    });
    bidIds.push(bidId as number);
    await cache.zadd(`auction:${sessionId}:leaderboard`, amount, String(bidder.id));
    await cache.set(
      `auction:${sessionId}:top_bid`,
      JSON.stringify({ userId: bidder.id, amount, timestamp: Date.now() }),
    );
  }
  await db('auction_sessions').where({ id: sessionId }).update({ current_price: amount });
  return { sessionId, bidIds, roomId, topAmount: amount };
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
