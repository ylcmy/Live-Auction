/**
 * T065: Core Bid Processing Service
 *
 * THE CORE BIDDING ENGINE:
 * 1. Idempotency check (Redis SETNX)
 * 2. Session-level distributed lock (Redis SETNX, TTL 3s)
 * 3. Fetch context (session, rules, last bidder, rate limit)
 * 4. Domain validation (pure)
 * 5. Read current price from Redis first, fallback to MySQL
 * 6. Calculate bid amount + ceiling price truncation
 * 7. Atomic Redis write via Lua (ZADD leaderboard + SADD participants + SET top_bid)
 * 8. Persist to MySQL (with rollback on failure)
 * 9. Return result with rank
 *
 * Lock is ALWAYS released in a finally block using Lua unlock script
 * to verify ownership before deleting.
 */

import { cache, redis } from '../infrastructure/cache/redis.js';
import { BID_COMMIT_SCRIPT, BID_ROLLBACK_SCRIPT, UNLOCK_SCRIPT } from '../infrastructure/cache/lua-scripts.js';
import { bidRepo } from '../repositories/bid.repo.js';
import { auctionSessionRepo } from '../repositories/auction-session.repo.js';
import { auctionRuleRepo } from '../repositories/auction-rule.repo.js';
import { productRepo } from '../repositories/product.repo.js';
import { userRepo } from '../repositories/user.repo.js';
import { validateBid } from '../domain/bid.js';
import { logger } from '../middleware/logger.js';

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

/**
 * Resolve user profiles with Redis cache read-through.
 * Returns a Map of userId -> { nickname, avatarUrl }.
 */
async function resolveUserProfiles(
  userIds: number[],
): Promise<Map<number, { nickname: string; avatarUrl: string | null }>> {
  const result = new Map<number, { nickname: string; avatarUrl: string | null }>();
  if (userIds.length === 0) return result;
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

  return result;
}

export const bidService = {
  /**
   * Process a bid from a user in an auction session.
   *
   * This is the critical path for the entire system. Every operation
   * is designed for atomicity and resilience:
   * - Redis SETNX for idempotency (first line of defense)
   * - Redis SETNX distributed lock per (sessionId, userId)
   * - Domain validation before any writes
   * - Lock released in finally block
   * - MySQL write happens asynchronously after lock release
   */
  async processBid(
    sessionId: number,
    userId: number,
    idempotencyKey: string,
  ): Promise<BidProcessResult> {
    // ---- 1. Idempotency check (first line of defense) ----
    const idemKey = `idempotent:bid:${sessionId}:${idempotencyKey}`;
    const isNew = await cache.setnx(idemKey, '1', 3600);
    if (!isNew) {
      logger.warn({ event: 'bid_rejected', sessionId, userId, idempotencyKey, reason: 'duplicate_idempotency_key' }, 'Bid rejected - duplicate idempotency key');
      return {
        success: false,
        error: { code: 40901, message: '重复的出价请求' },
      };
    }

    // ---- 2. Session-level distributed lock ----
    logger.info({ event: 'bid_attempt', sessionId, userId, idempotencyKey }, 'Bid processing started');

    const lockKey = `bid_lock:${sessionId}`;
    const lockValue = `${userId}:${Date.now()}`;
    const lock = await cache.setnx(lockKey, lockValue, 3);
    if (!lock) {
      logger.warn({ event: 'bid_rejected', sessionId, userId, idempotencyKey, reason: 'concurrent_lock' }, 'Bid rejected - session lock held');
      return {
        success: false,
        error: { code: 40901, message: '出价处理中，请稍后再试' },
      };
    }

    try {
      // ---- 3. Fetch context ----
      const session = await auctionSessionRepo.findById(sessionId);
      if (!session) {
        logger.warn({ event: 'bid_rejected', sessionId, userId, idempotencyKey, reason: 'session_not_found' }, 'Bid rejected - session not found');
        return {
          success: false,
          error: { code: 40400, message: '竞拍不存在' },
        };
      }

      const product = await productRepo.findById(session.product_id);
      if (!product) {
        logger.warn({ event: 'bid_rejected', sessionId, userId, idempotencyKey, reason: 'product_not_found' }, 'Bid rejected - product not found');
        return {
          success: false,
          error: { code: 40400, message: '商品不存在' },
        };
      }

      const rule = await auctionRuleRepo.findByProductId(session.product_id);
      if (!rule) {
        logger.warn({ event: 'bid_rejected', sessionId, userId, idempotencyKey, reason: 'rule_not_found' }, 'Bid rejected - auction rule missing');
        return {
          success: false,
          error: { code: 50000, message: '竞拍规则缺失' },
        };
      }

      // Rate limit check using Redis sorted set sliding window
      const rateKey = `ratelimit:${sessionId}:${userId}`;
      const now = Date.now();
      // Remove entries older than 1 second (sliding window)
      await redis.zremrangebyscore(rateKey, 0, now - 1000);
      const rateCount = await redis.zcard(rateKey);
      const rateLimitExceeded = rateCount >= 5;

      // ---- 4. Domain validation ----
      const error = validateBid(userId, {
        auctionStatus: session.status,
        sellerId: product.merchant_id,
        currentPrice: Number(session.current_price),
        bidIncrement: Number(rule.bid_increment),
        ceilingPrice: rule.ceiling_price
          ? Number(rule.ceiling_price)
          : null,
        idempotencyKeyExists: false,
        rateLimitExceeded,
      });

      if (error) {
        logger.warn({ event: 'bid_rejected', sessionId, userId, idempotencyKey, reason: error.message }, 'Bid rejected - validation failed');
        return { success: false, error };
      }

      // ---- 5. Add rate limiter entry ----
      await redis.zadd(rateKey, now, String(now));
      await redis.expire(rateKey, 2);

      // ---- 6. Read current price from Redis first, fallback to MySQL ----
      let currentPrice: number;
      const topBidRaw = await cache.get(`auction:${sessionId}:top_bid`);
      if (topBidRaw) {
        const topBid = JSON.parse(topBidRaw);
        currentPrice = topBid.amount;
      } else {
        currentPrice = Number(session.current_price);
      }

      // ---- 7. Calculate bid amount ----
      let bidAmount = currentPrice + Number(rule.bid_increment);

      // ---- 8. Ceiling price truncation ----
      const ceilingPrice = rule.ceiling_price
        ? Number(rule.ceiling_price)
        : null;
      const shouldEnd =
        ceilingPrice !== null && bidAmount >= ceilingPrice;
      if (ceilingPrice !== null && bidAmount > ceilingPrice) {
        bidAmount = ceilingPrice;
      }

      // ---- 9. Save previous top_bid for rollback ----
      const previousTopBid = topBidRaw || '';

      // ---- 10. Atomic Redis write via Lua ----
      const lbKey = `auction:${sessionId}:leaderboard`;
      const participantsKey = `room:${session.room_id}:participants`;
      const topBidKey = `auction:${sessionId}:top_bid`;
      const topBidData = JSON.stringify({
        userId,
        amount: bidAmount,
        timestamp: new Date().toISOString(),
      });

      await cache.eval(BID_COMMIT_SCRIPT, [lbKey, participantsKey, topBidKey], [String(userId), bidAmount, topBidData]);

      // ---- 11. Persist to MySQL ----
      try {
        await bidRepo.create({
          session_id: sessionId,
          user_id: userId,
          bid_amount: bidAmount,
          idempotency_key: idempotencyKey,
        });
        await auctionSessionRepo.updatePrice(
          sessionId,
          bidAmount,
          shouldEnd ? userId : undefined,
        );
      } catch (err) {
        logger.error({ err, sessionId, userId, bidAmount }, 'Bid persistence failed - rolling back Redis');
        // Rollback Redis
        await cache.eval(BID_ROLLBACK_SCRIPT, [lbKey, participantsKey, topBidKey], [String(userId), previousTopBid]);
        return { success: false, error: { code: 50000, message: '出价处理失败，请重试' } };
      }

      // ---- 12. Extension check (under lock, before release) ----
      let extensionResult: { remainingMs: number; extensionCount: number } | null = null;
      if (!shouldEnd) {
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
              logger.info({ event: 'bid_extension', sessionId, extensions: newExtensions }, 'Auction extended during bid processing');
            }
          }
        }
      }

      // ---- 13. Get rank ----
      const rank = await cache.zrevrank(lbKey, String(userId));
      const myRank = rank !== null ? rank + 1 : null;

      // ---- 14. Determine leader status ----
      const topBidders = await cache.zrevrange(lbKey, 0, 0);
      let isLeading = false;
      let gapToLeader = -1;
      if (topBidders.length >= 2) {
        isLeading = topBidders[0] === String(userId);
        if (!isLeading) {
          const leaderAmount = Number(topBidders[1]);
          gapToLeader = leaderAmount - bidAmount;
        }
      } else {
        // Only one bidder in the list — this user is the leader
        isLeading = true;
      }

      logger.info({ event: 'bid_success', sessionId, userId, amount: bidAmount, rank: myRank, isLeading, shouldEnd }, 'Bid processed successfully');

      return {
        success: true,
        amount: bidAmount,
        rank: myRank || 1,
        isLeading,
        gapToLeader,
        shouldEnd,
        extensionResult,
      };
    } finally {
      // ---- Release lock with ownership verification ----
      await cache.eval(UNLOCK_SCRIPT, [lockKey], [lockValue]);
    }
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
   */
  async getLeaderboard(
    sessionId: number,
    currentUserId: number,
    limit = 20,
  ): Promise<LeaderboardEntry[]> {
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
   */
  async getMyRank(
    sessionId: number,
    userId: number,
  ): Promise<{ rank: number | null; amount: number | null }> {
    const lbKey = `auction:${sessionId}:leaderboard`;
    const rank = await cache.zrevrank(lbKey, String(userId));
    const score = rank !== null ? await cache.zscore(lbKey, String(userId)) : null;
    return { rank: rank !== null ? rank + 1 : null, amount: score !== null ? Number(score) : null };
  },
};
