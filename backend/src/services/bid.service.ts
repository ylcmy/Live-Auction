/**
 * T065: Core Bid Processing Service
 *
 * THE CORE BIDDING ENGINE (Dual-path: Redis primary + MySQL fallback):
 *
 * Redis path:
 * 1. Three-state idempotency check (GET → replay / pending recovery / SETNX)
 * 2. Fetch context from Redis cache (rule, merchantId, roomId), fallback to MySQL
 * 3. Rate limit via Redis sorted set sliding window
 * 4. Calculate bid amount + ceiling price truncation
 * 5. Atomic CAS write via Lua (compare-and-set top_bid + ZADD leaderboard + SADD participants)
 * 6. Persist to MySQL (with Redis rollback on failure)
 * 7. Extension check + rank query
 *
 * MySQL fallback path:
 * 1. In-memory rate limiting
 * 2. Fetch context (session, rules) via MySQL
 * 3. Domain validation (pure)
 * 4. MySQL transaction: SELECT FOR UPDATE + INSERT bid_record + UPDATE session
 * 5. Idempotency via MySQL unique constraint (ER_DUP_ENTRY)
 * 6. Extension check within transaction
 * 7. Rank from MySQL leaderboard query
 */

import { cache, redis, isRedisAvailable } from '../infrastructure/cache/redis.js';
import { BID_CAS_SCRIPT, BID_ROLLBACK_SCRIPT } from '../infrastructure/cache/lua-scripts.js';
import { bidRepo } from '../repositories/bid.repo.js';
import { auctionSessionRepo } from '../repositories/auction-session.repo.js';
import { auctionRuleRepo } from '../repositories/auction-rule.repo.js';
import { productRepo } from '../repositories/product.repo.js';
import { userRepo } from '../repositories/user.repo.js';
import { validateBid } from '../domain/bid.js';
import { logger } from '../middleware/logger.js';
import { db } from '../infrastructure/db/knex.js';

export interface BidProcessResult {
  success: boolean;
  bidId?: number;
  amount?: number;
  rank?: number;
  isLeading?: boolean;
  gapToLeader?: number;
  error?: { code: number; message: string };
  shouldEnd?: boolean; // Triggers ceiling price -> auction end
  extensionResult?: { remainingMs: number; extensionCount: number } | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  userNickname: string;
  avatarUrl: string | null;
  amount: number;
  timestamp: string;
}

// ---- Task 6: In-Memory Rate Limiter ----

class InMemoryRateLimiter {
  private store = new Map<string, number[]>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodic cleanup every 60 seconds to prevent memory leaks
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Check if a request is allowed within the sliding window.
   * @returns true if the request is allowed, false if rate limit exceeded
   */
  check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;
    let timestamps = this.store.get(key) || [];

    // Remove expired entries
    timestamps = timestamps.filter(ts => ts > windowStart);

    if (timestamps.length >= limit) {
      this.store.set(key, timestamps);
      return false;
    }

    timestamps.push(now);
    this.store.set(key, timestamps);
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.store) {
      const filtered = timestamps.filter(ts => ts > now - 60_000);
      if (filtered.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, filtered);
      }
    }
  }
}

const rateLimiter = new InMemoryRateLimiter();

interface AuctionContextFromCache {
  currentPrice: number;
  rule: {
    bid_increment: number;
    ceiling_price: number | null;
    max_extensions: number;
    extend_seconds: number;
  };
  merchantId: number;
  roomId: string;
}

async function getAuctionContextFromCache(sessionId: number): Promise<AuctionContextFromCache | null> {
  const [status, topBidRaw, ruleRaw, merchantIdRaw, roomId] = await Promise.all([
    cache.get(`auction:${sessionId}:status`),
    cache.get(`auction:${sessionId}:top_bid`),
    cache.get(`auction:${sessionId}:rule`),
    cache.get(`auction:${sessionId}:merchant_id`),
    cache.get(`auction:${sessionId}:room_id`),
  ]);

  if (status !== 'active') return null;
  if (!ruleRaw || !merchantIdRaw || !roomId) return null;

  const rule = JSON.parse(ruleRaw);
  const topBid = topBidRaw ? JSON.parse(topBidRaw) : null;

  return {
    currentPrice: topBid ? Number(topBid.amount) : 0,
    rule,
    merchantId: Number(merchantIdRaw),
    roomId,
  };
}

/**
 * Resolve user profiles with Redis cache read-through.
 * Falls back to direct MySQL query when Redis is unavailable.
 */
async function resolveUserProfiles(
  userIds: number[],
): Promise<Map<number, { nickname: string; avatarUrl: string | null }>> {
  const result = new Map<number, { nickname: string; avatarUrl: string | null }>();
  if (userIds.length === 0) return result;

  if (isRedisAvailable()) {
    const uncached: number[] = [];
    for (const uid of [...new Set(userIds)]) {
      const cached = await cache.get(`user:profile:${uid}`);
      if (cached) {
        result.set(uid, JSON.parse(cached));
      } else {
        uncached.push(uid);
      }
    }
    if (uncached.length > 0) {
      const users = await userRepo.findByIds(uncached);
      for (const u of users) {
        const profile = { nickname: u.nickname, avatarUrl: u.avatar_url };
        result.set(u.id, profile);
        await cache.set(`user:profile:${u.id}`, JSON.stringify(profile), 300);
      }
    }
  } else {
    // Redis unavailable: query MySQL directly
    const users = await userRepo.findByIds([...new Set(userIds)]);
    for (const u of users) {
      result.set(u.id, { nickname: u.nickname, avatarUrl: u.avatar_url });
    }
  }

  return result;
}

export const bidService = {
  /**
   * Process a bid from a user in an auction session.
   * Dispatches to Redis or MySQL path based on Redis availability.
   */
  async processBid(
    sessionId: number,
    userId: number,
    idempotencyKey: string,
    clientAmount?: number,
  ): Promise<BidProcessResult> {
    if (isRedisAvailable()) {
      return this._processBidRedis(sessionId, userId, idempotencyKey, clientAmount);
    }
    return this._processBidMySQL(sessionId, userId, idempotencyKey, clientAmount);
  },

  /**
   * Redis primary path: uses CAS script for atomic price check + write,
   * three-state idempotency keys, and no global session lock.
   */
  async _processBidRedis(
    sessionId: number,
    userId: number,
    idempotencyKey: string,
    clientAmount?: number,
  ): Promise<BidProcessResult> {
    // ---- 1. Three-state idempotency check ----
    const idemKey = `idempotent:bid:${sessionId}:${idempotencyKey}`;
    const existing = await cache.get(idemKey);
    if (existing && existing !== 'pending') {
      const prev = JSON.parse(existing);
      logger.warn({ event: 'bid_replayed', sessionId, userId, idempotencyKey }, 'Bid replayed from idempotency key');
      return { success: true, ...prev };
    }
    if (existing === 'pending') {
      const lbEntry = await cache.zscore(`auction:${sessionId}:leaderboard`, String(userId));
      if (lbEntry) {
        const rank = await cache.zrevrank(`auction:${sessionId}:leaderboard`, String(userId));
        const result = { amount: Number(lbEntry), rank: rank !== null ? rank + 1 : 1, isLeading: rank === 0 };
        await cache.set(idemKey, JSON.stringify(result), 3600);
        logger.info({ event: 'bid_recovered', sessionId, userId }, 'Bid recovered from pending state');
        return { success: true, ...result };
      }
      await cache.del(idemKey);
    }

    const acquired = await cache.setnx(idemKey, 'pending', 300);
    if (!acquired) {
      return { success: false, error: { code: 40901, message: '出价处理中，请稍候' } };
    }

    logger.info({ event: 'bid_attempt', sessionId, userId, idempotencyKey }, 'Bid processing started');

    // ---- 2. Get context ----
    const cachedCtx = await getAuctionContextFromCache(sessionId);
    let ctx: { currentPrice: number; rule: { bid_increment: number; ceiling_price: number | null; max_extensions: number; extend_seconds: number }; merchantId: number; roomId: string };

    if (cachedCtx) {
      ctx = cachedCtx;
    } else {
      const session = await auctionSessionRepo.findById(sessionId);
      if (!session || session.status !== 'active') {
        return { success: false, error: { code: 40900, message: '竞拍已结束或未开始' } };
      }
      const product = await productRepo.findById(session.product_id);
      if (!product) return { success: false, error: { code: 40400, message: '商品不存在' } };
      const rule = await auctionRuleRepo.findByProductId(session.product_id);
      if (!rule) return { success: false, error: { code: 50000, message: '竞拍规则缺失' } };
      if (userId === product.merchant_id) return { success: false, error: { code: 40300, message: '不能竞拍自己的商品' } };

      const topBidRaw = await cache.get(`auction:${sessionId}:top_bid`);
      const topBid = topBidRaw ? JSON.parse(topBidRaw) : null;
      ctx = {
        currentPrice: topBid ? Number(topBid.amount) : Number(session.current_price),
        rule: { bid_increment: Number(rule.bid_increment), ceiling_price: rule.ceiling_price ? Number(rule.ceiling_price) : null, max_extensions: rule.max_extensions, extend_seconds: rule.extend_seconds },
        merchantId: product.merchant_id,
        roomId: String(session.room_id),
      };
    }

    if (userId === ctx.merchantId) {
      return { success: false, error: { code: 40300, message: '不能竞拍自己的商品' } };
    }

    const { currentPrice, rule } = ctx;

    // ---- 3. Rate limiting ----
    const rateKey = `ratelimit:${sessionId}:${userId}`;
    const now = Date.now();
    await redis.zremrangebyscore(rateKey, 0, now - 1000);
    const rateCount = await redis.zcard(rateKey);
    if (rateCount >= 5) {
      return { success: false, error: { code: 42900, message: '出价过于频繁，请稍后再试' } };
    }

    // ---- 4. Calculate amount ----
    const increment = rule.bid_increment;
    const minBid = currentPrice + increment;
    const ceilingPrice = rule.ceiling_price;

    if (ceilingPrice !== null) {
      const nextBid = clientAmount != null && clientAmount >= minBid ? clientAmount : minBid;
      if (nextBid > ceilingPrice && currentPrice >= ceilingPrice) {
        return { success: false, error: { code: 40901, message: '已达到封顶价' } };
      }
    }

    let bidAmount = clientAmount != null && clientAmount >= minBid ? Number(clientAmount) : minBid;
    bidAmount = Math.round((bidAmount - currentPrice) / increment) * increment + currentPrice;
    bidAmount = Math.max(bidAmount, minBid);

    // ---- 5. CAS ----
    const topBidKey = `auction:${sessionId}:top_bid`;
    const lbKey = `auction:${sessionId}:leaderboard`;
    const participantsKey = `room:${ctx.roomId}:participants`;
    const topBidData = JSON.stringify({ userId, amount: bidAmount, timestamp: new Date().toISOString() });

    const casResult = await cache.eval(BID_CAS_SCRIPT, [topBidKey, lbKey, participantsKey], [String(userId), bidAmount, topBidData, ceilingPrice ?? 0]);
    if (casResult === 0) {
      return { success: false, error: { code: 40902, message: '出价已过期，当前价格已更新，请重新出价' } };
    }

    // ---- 6. Rate limiter update ----
    await redis.zadd(rateKey, now, String(now));
    await redis.expire(rateKey, 2);

    // ---- 7. MySQL persistence ----
    try {
      await bidRepo.create({ session_id: sessionId, user_id: userId, bid_amount: bidAmount, idempotency_key: idempotencyKey });
      await auctionSessionRepo.updatePrice(sessionId, bidAmount);
    } catch (err) {
      logger.error({ err, sessionId, userId, bidAmount }, 'MySQL persistence failed, rolling back Redis');
      const topBidRaw = await cache.get(topBidKey);
      await cache.eval(BID_ROLLBACK_SCRIPT, [lbKey, participantsKey, topBidKey], [String(userId), topBidRaw || '']);
      return { success: false, error: { code: 50000, message: '出价处理失败，请重试' } };
    }

    // ---- 8. Extension check ----
    let extensionResult: { remainingMs: number; extensionCount: number } | null = null;
    if (ceilingPrice === null || bidAmount < ceilingPrice) {
      const extensions = parseInt((await cache.get(`auction:${sessionId}:extensions`)) || '0', 10);
      if (extensions < rule.max_extensions) {
        const currentEndTime = parseInt((await cache.get(`auction:${sessionId}:end_time`)) || '0', 10);
        if (currentEndTime > 0) {
          const remainingMs = currentEndTime - Date.now();
          if (remainingMs < rule.extend_seconds * 1000) {
            const newEndTime = Date.now() + rule.extend_seconds * 1000;
            const newExtensions = extensions + 1;
            await cache.set(`auction:${sessionId}:end_time`, String(newEndTime));
            await cache.set(`auction:${sessionId}:extensions`, String(newExtensions));
            await auctionSessionRepo.updateStatus(sessionId, 'active', { extension_count: newExtensions });
            extensionResult = { remainingMs: rule.extend_seconds * 1000, extensionCount: newExtensions };
          }
        }
      }
    }

    // ---- 9. Rank ----
    const rank = await cache.zrevrank(lbKey, String(userId));
    const myRank = rank !== null ? rank + 1 : 1;
    const shouldEnd = ceilingPrice !== null && bidAmount >= ceilingPrice;

    logger.info({ event: 'bid_success', sessionId, userId, amount: bidAmount, rank: myRank, shouldEnd }, 'Bid processed successfully');

    return { success: true, amount: bidAmount, rank: myRank, isLeading: true, gapToLeader: 0, shouldEnd, extensionResult };
  },

  /**
   * MySQL fallback path: uses MySQL transaction for atomicity,
   * in-memory rate limiting, and MySQL unique constraint for idempotency.
   */
  async _processBidMySQL(
    sessionId: number,
    userId: number,
    idempotencyKey: string,
    clientAmount?: number,
  ): Promise<BidProcessResult> {
    logger.info({ event: 'bid_attempt_mysql', sessionId, userId, idempotencyKey }, 'Bid processing started (MySQL path)');

    // ---- 1. In-memory rate limiting ----
    const rateKey = `ratelimit:${sessionId}:${userId}`;
    if (!rateLimiter.check(rateKey, 5, 1000)) {
      logger.warn({ event: 'bid_rejected', sessionId, userId, idempotencyKey, reason: 'rate_limit' }, 'Bid rejected - rate limit exceeded (MySQL path)');
      return {
        success: false,
        error: { code: 42900, message: '出价过于频繁，请稍后再试' },
      };
    }

    // ---- 2. Fetch context (outside transaction) ----
    const productCheck = await auctionSessionRepo.findById(sessionId);
    if (!productCheck) {
      return {
        success: false,
        error: { code: 40400, message: '竞拍不存在' },
      };
    }

    const product = await productRepo.findById(productCheck.product_id);
    if (!product) {
      return {
        success: false,
        error: { code: 40400, message: '商品不存在' },
      };
    }

    const rule = await auctionRuleRepo.findByProductId(productCheck.product_id);
    if (!rule) {
      return {
        success: false,
        error: { code: 50000, message: '竞拍规则缺失' },
      };
    }

    // ---- 3. Domain validation (before entering transaction) ----
    const validationError = validateBid(userId, {
      auctionStatus: productCheck.status,
      sellerId: product.merchant_id,
      currentPrice: Number(productCheck.current_price),
      bidIncrement: Number(rule.bid_increment),
      ceilingPrice: rule.ceiling_price ? Number(rule.ceiling_price) : null,
      idempotencyKeyExists: false,
      rateLimitExceeded: false,
    });

    if (validationError) {
      logger.warn({ event: 'bid_rejected', sessionId, userId, idempotencyKey, reason: validationError.message }, 'Bid rejected - validation failed (MySQL path)');
      return { success: false, error: validationError };
    }

    // ---- 4. Calculate bid amount ----
    const minBid = Number(productCheck.current_price) + Number(rule.bid_increment);
    let bidAmount = clientAmount != null && clientAmount >= minBid ? Number(clientAmount) : minBid;
    // Snap to increment grid
    const increment = Number(rule.bid_increment);
    bidAmount = Math.round((bidAmount - Number(productCheck.current_price)) / increment) * increment + Number(productCheck.current_price);
    bidAmount = Math.max(bidAmount, minBid);
    // Check ceiling price
    if (rule.ceiling_price != null && bidAmount > Number(rule.ceiling_price)) {
      bidAmount = Number(rule.ceiling_price);
    }

    const ceilingPrice = rule.ceiling_price ? Number(rule.ceiling_price) : null;
    const shouldEnd = ceilingPrice !== null && bidAmount >= ceilingPrice;
    if (ceilingPrice !== null && bidAmount > ceilingPrice) {
      bidAmount = ceilingPrice;
    }

    // ---- 5. Execute in MySQL transaction ----
    let bidId: number | undefined;
    let extensionResult: { remainingMs: number; extensionCount: number } | null = null;

    try {
      await db.transaction(async (trx) => {
        // Acquire row lock
        const session = await auctionSessionRepo.findByIdForUpdate(sessionId, trx);
        if (!session) {
          throw Object.assign(new Error('SESSION_NOT_FOUND'), { _code: 40400 });
        }

        if (session.status !== 'active') {
          throw Object.assign(new Error('AUCTION_NOT_ACTIVE'), { _code: 40900 });
        }

        // Re-validate with locked data
        const lockedCurrentPrice = Number(session.current_price);
        const lockedIncrement = Number(rule.bid_increment);
        const lockedMinBid = lockedCurrentPrice + lockedIncrement;
        let lockedBidAmount = clientAmount != null && clientAmount >= lockedMinBid ? Number(clientAmount) : lockedMinBid;
        // Snap to increment grid
        lockedBidAmount = Math.round((lockedBidAmount - lockedCurrentPrice) / lockedIncrement) * lockedIncrement + lockedCurrentPrice;
        lockedBidAmount = Math.max(lockedBidAmount, lockedMinBid);
        const lockedCeilingPrice = rule.ceiling_price ? Number(rule.ceiling_price) : null;
        if (lockedCeilingPrice != null && lockedBidAmount > lockedCeilingPrice) {
          lockedBidAmount = lockedCeilingPrice;
        }
        const lockedShouldEnd = lockedCeilingPrice !== null && lockedBidAmount >= lockedCeilingPrice;
        const finalBidAmount = lockedBidAmount;

        // INSERT bid_record (idempotency via unique constraint)
        bidId = await bidRepo.create({
          session_id: sessionId,
          user_id: userId,
          bid_amount: finalBidAmount,
          idempotency_key: idempotencyKey,
        }, trx);

        // UPDATE auction_sessions.current_price
        const updateData: any = { current_price: finalBidAmount, updated_at: db.fn.now() };
        if (lockedShouldEnd) {
          updateData.winner_id = userId;
        }
        await trx('auction_sessions').where({ id: sessionId }).update(updateData).increment('version', 1);

        // Extension check within transaction
        if (!lockedShouldEnd) {
          const extensionCount = session.extension_count || 0;
          if (extensionCount < rule.max_extensions) {
            const currentEndTime = session.ended_at ? new Date(session.ended_at).getTime() : 0;
            if (currentEndTime > 0) {
              const remainingMs = currentEndTime - Date.now();
              if (remainingMs < rule.extend_seconds * 1000) {
                const newEndTime = new Date(Date.now() + rule.extend_seconds * 1000);
                const newExtensions = extensionCount + 1;
                await trx('auction_sessions').where({ id: sessionId }).update({
                  ended_at: newEndTime,
                  extension_count: newExtensions,
                  updated_at: trx.fn.now(),
                });
                extensionResult = { remainingMs: rule.extend_seconds * 1000, extensionCount: newExtensions };
                logger.info({ event: 'bid_extension_mysql', sessionId, extensions: newExtensions }, 'Auction extended during bid processing (MySQL path)');
              }
            }
          }
        }

        // Update bidAmount to the final calculated value for return
        bidAmount = finalBidAmount;
      });
    } catch (err: any) {
      // Handle ER_DUP_ENTRY for idempotency
      if (err.code === 'ER_DUP_ENTRY') {
        logger.warn({ event: 'bid_rejected', sessionId, userId, idempotencyKey, reason: 'duplicate_idempotency_key' }, 'Bid rejected - duplicate idempotency key (MySQL path)');
        return {
          success: false,
          error: { code: 40901, message: '重复的出价请求' },
        };
      }

      if (err._code === 40400) {
        return { success: false, error: { code: 40400, message: '竞拍不存在' } };
      }
      if (err._code === 40900) {
        return { success: false, error: { code: 40900, message: '竞拍已结束或未开始' } };
      }

      logger.error({ err, sessionId, userId, bidAmount }, 'Bid persistence failed (MySQL path)');
      return { success: false, error: { code: 50000, message: '出价处理失败，请重试' } };
    }

    // ---- 6. Get rank from MySQL (outside transaction - read operation) ----
    const leaderboard = await bidRepo.findLeaderboard(sessionId, 20);
    const myEntry = leaderboard.find(e => e.userId === userId);
    const myRank = myEntry?.rank || leaderboard.length + 1;

    // Determine leader status
    const leader = leaderboard[0];
    const isLeading = leader?.userId === userId;
    const gapToLeader = isLeading ? 0 : (leader ? leader.amount - bidAmount : -1);

    const finalShouldEnd = ceilingPrice !== null && bidAmount >= ceilingPrice;

    logger.info({ event: 'bid_success_mysql', sessionId, userId, amount: bidAmount, rank: myRank, isLeading, shouldEnd: finalShouldEnd }, 'Bid processed successfully (MySQL path)');

    return {
      success: true,
      bidId,
      amount: bidAmount,
      rank: myRank,
      isLeading,
      gapToLeader,
      shouldEnd: finalShouldEnd,
      extensionResult,
    };
  },

  /**
   * Get the raw leaderboard from Redis (alternating userId, score).
   */
  async getLeaderboardRaw(sessionId: number, limit = 20): Promise<string[]> {
    const lbKey = `auction:${sessionId}:leaderboard`;
    return cache.zrevrange(lbKey, 0, limit - 1);
  },

  /**
   * Get full leaderboard with resolved user nicknames and avatars.
   * Falls back to MySQL query when Redis is unavailable.
   */
  async getLeaderboard(
    sessionId: number,
    currentUserId: number,
    limit = 20,
  ): Promise<LeaderboardEntry[]> {
    if (isRedisAvailable()) {
      const lbKey = `auction:${sessionId}:leaderboard`;
      const raw = await cache.zrevrange(lbKey, 0, limit - 1);

      const userIds: number[] = [];
      const entries: LeaderboardEntry[] = [];
      for (let i = 0; i < raw.length; i += 2) {
        const uid = Number(raw[i]);
        userIds.push(uid);
        entries.push({
          rank: Math.floor(i / 2) + 1,
          userId: uid,
          userNickname: '',
          avatarUrl: null,
          amount: Number(raw[i + 1]),
          timestamp: new Date().toISOString(),
        });
      }

      const profiles = await resolveUserProfiles(userIds);
      for (const entry of entries) {
        const profile = profiles.get(entry.userId);
        entry.userNickname = profile?.nickname || `用户${entry.userId}`;
        entry.avatarUrl = profile?.avatarUrl || null;
      }

      return entries;
    }

    // MySQL fallback
    const rows = await bidRepo.findLeaderboard(sessionId, limit);
    return rows.map(row => ({
      rank: row.rank,
      userId: row.userId,
      userNickname: row.userNickname,
      avatarUrl: row.avatarUrl,
      amount: row.amount,
      timestamp: row.timestamp,
    }));
  },

  /**
   * Get a single user's nickname (with cache read-through).
   */
  async getUserNickname(userId: number): Promise<string> {
    const profiles = await resolveUserProfiles([userId]);
    return profiles.get(userId)?.nickname || `用户${userId}`;
  },

  /**
   * Get the rank and bid amount for a specific user in a session.
   * Falls back to MySQL when Redis is unavailable.
   */
  async getMyRank(
    sessionId: number,
    userId: number,
  ): Promise<{ rank: number | null; amount: number | null }> {
    if (isRedisAvailable()) {
      const lbKey = `auction:${sessionId}:leaderboard`;
      const rank = await cache.zrevrank(lbKey, String(userId));
      const score = rank !== null ? await cache.zscore(lbKey, String(userId)) : null;
      return { rank: rank !== null ? rank + 1 : null, amount: score !== null ? Number(score) : null };
    }

    // MySQL fallback
    const leaderboard = await bidRepo.findLeaderboard(sessionId, 100);
    const myEntry = leaderboard.find(e => e.userId === userId);
    return {
      rank: myEntry?.rank || null,
      amount: myEntry?.amount || null,
    };
  },
};
