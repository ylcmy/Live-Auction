import { auctionSessionRepo } from '../repositories/auction-session.repo.js';
import { productRepo } from '../repositories/product.repo.js';
import { auctionRuleRepo } from '../repositories/auction-rule.repo.js';
import { liveRoomRepo } from '../repositories/live-room.repo.js';
import { orderRepo } from '../repositories/order.repo.js';
import { cache } from '../infrastructure/cache/redis.js';
import { bidService } from './bid.service.js';
import { logger } from '../middleware/logger.js';

/** Map of sessionId -> setTimeout id for auction settlement timers */
const auctionTimers = new Map<number, NodeJS.Timeout>();

function clearAuctionTimer(sessionId: number) {
  const existing = auctionTimers.get(sessionId);
  if (existing) {
    clearTimeout(existing);
    auctionTimers.delete(sessionId);
  }
}

function scheduleSettlement(sessionId: number, delayMs: number) {
  clearAuctionTimer(sessionId);
  const timer = setTimeout(() => {
    auctionTimers.delete(sessionId);
    auctionService.settleAuction(sessionId).catch((err) => {
      logger.error({ event: 'settle_timer_error', sessionId, err }, 'Auction settlement timer failed');
    });
  }, delayMs);
  auctionTimers.set(sessionId, timer);
  logger.info({ event: 'settlement_scheduled', sessionId, delayMs }, 'Auction settlement timer scheduled');
}

export const auctionService = {
  async startAuction(merchantId: number, productId: number, roomId: number) {
    const product = await productRepo.findById(productId);
    if (!product) throw Object.assign(new Error('商品不存在'), { statusCode: 404 });
    if (product.merchant_id !== merchantId) throw Object.assign(new Error('无权限'), { statusCode: 403 });
    if (product.status !== 'pending' && product.status !== 'draft') throw Object.assign(new Error('该商品当前状态不可发起竞拍'), { statusCode: 409 });

    const room = await liveRoomRepo.findById(roomId);
    if (!room) throw Object.assign(new Error('直播间不存在'), { statusCode: 404 });
    if (room.host_id !== merchantId) throw Object.assign(new Error('无权限'), { statusCode: 403 });

    const activeSession = await auctionSessionRepo.findActiveByRoom(roomId);
    if (activeSession) throw Object.assign(new Error('当前直播间已有进行中的竞拍'), { statusCode: 409 });

    const rule = await auctionRuleRepo.findByProductId(productId);
    if (!rule) throw Object.assign(new Error('请先配置竞拍规则'), { statusCode: 400 });

    const sessionId = await auctionSessionRepo.create({
      product_id: productId,
      rule_id: rule.id,
      room_id: roomId,
      current_price: rule.start_price,
    });

    await productRepo.updateStatus(productId, 'active');
    await liveRoomRepo.updateStatus(roomId, 'live');

    // Cache hot data in Redis
    const endTime = Date.now() + rule.duration_seconds * 1000;
    await cache.set(`auction:${sessionId}:end_time`, String(endTime));
    await cache.set(`auction:${sessionId}:status`, 'active');
    await cache.set(`auction:${sessionId}:extensions`, '0');
    await cache.set(`auction:${sessionId}:product_id`, String(productId));
    await cache.set(`auction:${sessionId}:room_id`, String(roomId));
    await cache.set(
      `auction:${sessionId}:top_bid`,
      JSON.stringify({ userId: 0, amount: rule.start_price, timestamp: Date.now() }),
    );
    // Map room to active session for WS join lookups
    await cache.set(`room:${roomId}:active_session`, String(sessionId));

    // Schedule settlement timer
    scheduleSettlement(sessionId!, rule.duration_seconds * 1000);

    logger.info({ event: 'auction_start', sessionId, productId, roomId, merchantId, duration: rule.duration_seconds }, 'Auction started');

    return {
      sessionId,
      status: 'active',
      startedAt: new Date().toISOString(),
      endTime,
      rule,
      product,
    };
  },

  /**
   * Extend an auction when a bid comes in near the deadline.
   * Returns the new remaining milliseconds, or null if extension is not allowed.
   */
  async extendAuction(sessionId: number): Promise<{ remainingMs: number; extensionCount: number } | null> {
    const extensions = parseInt((await cache.get(`auction:${sessionId}:extensions`)) || '0', 10);
    const session = await auctionSessionRepo.findById(sessionId);
    if (!session) return null;

    const rule = await auctionRuleRepo.findByProductId(session.product_id);
    if (!rule) return null;

    if (extensions >= rule.max_extensions) return null;

    const currentEndTime = parseInt((await cache.get(`auction:${sessionId}:end_time`)) || '0', 10);
    if (currentEndTime <= 0) return null;

    const now = Date.now();
    const remainingMs = currentEndTime - now;
    if (remainingMs >= rule.extend_seconds * 1000) return null;

    const newEndTime = now + rule.extend_seconds * 1000;
    const newExtensions = extensions + 1;
    await cache.set(`auction:${sessionId}:end_time`, String(newEndTime));
    await cache.set(`auction:${sessionId}:extensions`, String(newExtensions));
    await auctionSessionRepo.updateStatus(sessionId, 'active', { extension_count: newExtensions });

    // Reschedule settlement timer
    scheduleSettlement(sessionId, rule.extend_seconds * 1000);

    logger.info({ event: 'auction_extend', sessionId, extensions: newExtensions, newEndTime }, 'Auction extended');

    return { remainingMs: rule.extend_seconds * 1000, extensionCount: newExtensions };
  },

  /**
   * Get current auction timer info for countdown sync.
   */
  async getAuctionTimer(sessionId: number): Promise<{ serverTime: number; endTime: number; remainingMs: number } | null> {
    const endTime = parseInt((await cache.get(`auction:${sessionId}:end_time`)) || '0', 10);
    if (endTime <= 0) return null;
    const serverTime = Date.now();
    const remainingMs = Math.max(0, endTime - serverTime);
    return { serverTime, endTime, remainingMs };
  },

  /**
   * Build full AuctionState for WS events and REST responses.
   */
  async buildAuctionState(sessionId: number, currentUserId?: number): Promise<Record<string, unknown> | null> {
    const session = await auctionSessionRepo.findById(sessionId);
    if (!session) return null;

    const product = await productRepo.findById(session.product_id);
    const rule = await auctionRuleRepo.findByProductId(session.product_id);
    if (!product || !rule) return null;

    const timer = await this.getAuctionTimer(sessionId);
    const leaderboard = await bidService.getLeaderboard(sessionId, currentUserId || 0);
    const extensions = parseInt((await cache.get(`auction:${sessionId}:extensions`)) || '0', 10);

    return {
      sessionId,
      status: session.status,
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        imageUrl: product.image_url,
      },
      rule: {
        startPrice: Number(rule.start_price),
        bidIncrement: Number(rule.bid_increment),
        ceilingPrice: rule.ceiling_price ? Number(rule.ceiling_price) : null,
        durationSeconds: rule.duration_seconds,
        extendSeconds: rule.extend_seconds,
        maxExtensions: rule.max_extensions,
      },
      currentPrice: Number(session.current_price),
      leaderboard,
      myRank: currentUserId ? leaderboard.find((e) => e.userId === currentUserId)?.rank || null : null,
      remainingMs: timer?.remainingMs ?? 0,
      startedAt: session.started_at,
      participantCount: leaderboard.length,
      extensionCount: extensions,
    };
  },

  /**
   * Settle an auction: determine winner, create order, update statuses, broadcast cleanup.
   */
  async settleAuction(sessionId: number): Promise<{
    winner: { userId: number; userNickname: string; finalPrice: number } | null;
    leaderboard: { rank: number; userId: number; userNickname: string; avatarUrl: string | null; amount: number }[];
    orderId: number | null;
  }> {
    logger.info({ event: 'auction_settle_start', sessionId }, 'Settling auction');

    const lockKey = `settle_lock:${sessionId}`;
    const lock = await cache.setnx(lockKey, '1', 30);
    if (!lock) {
      logger.warn({ event: 'auction_settle_blocked', sessionId }, 'Settlement blocked - concurrent settlement in progress');
      return { winner: null, leaderboard: [], orderId: null };
    }

    try {
      const session = await auctionSessionRepo.findById(sessionId);
      if (!session) {
        logger.warn({ event: 'auction_settle_nosession', sessionId }, 'Session not found for settlement');
        return { winner: null, leaderboard: [], orderId: null };
      }

      if (session.status === 'ended' || session.status === 'cancelled' || session.status === 'unsold') {
        logger.warn({ event: 'auction_settle_already', sessionId, status: session.status }, 'Auction already ended');
        return { winner: null, leaderboard: [], orderId: null };
      }

      // Determine winner from Redis leaderboard
      const rawLb = await bidService.getLeaderboardRaw(sessionId);
      const userIds: number[] = [];
      for (let i = 0; i < rawLb.length; i += 2) {
        userIds.push(Number(rawLb[i]));
      }

      let winner: { userId: number; userNickname: string; finalPrice: number } | null = null;
      let orderId: number | null = null;
      let newStatus: string;

      if (rawLb.length >= 2) {
        const winnerId = Number(rawLb[0]);
        const winningAmount = Number(rawLb[1]);
        const nickname = await bidService.getUserNickname(winnerId);

        winner = { userId: winnerId, userNickname: nickname, finalPrice: winningAmount };
        newStatus = 'ended';

        // Create order for winner
        try {
          const createdId = await orderRepo.create({
            session_id: sessionId,
            buyer_id: winnerId,
            product_id: session.product_id,
            final_price: winningAmount,
          });
          orderId = createdId ?? null;
          logger.info({ event: 'order_created', orderId, sessionId, buyerId: winnerId, amount: winningAmount }, 'Order created for winner');
        } catch (err) {
          logger.error({ event: 'order_create_failed', sessionId, err }, 'Failed to create order');
        }
      } else {
        newStatus = 'unsold';
      }

      // Build leaderboard with nicknames
      const leaderboard = await bidService.getLeaderboard(sessionId, 0);

      // Update statuses
      await auctionSessionRepo.updateStatus(sessionId, newStatus, {
        winner_id: winner?.userId,
        ended_at: new Date().toISOString(),
      });
      await productRepo.updateStatus(session.product_id, newStatus === 'ended' ? 'ended' : 'unsold');
      await liveRoomRepo.updateStatus(session.room_id, 'offline');

      // Clear auction timers
      clearAuctionTimer(sessionId);

      // Clean up Redis auction data (keep user caches)
      const keys = [
        `auction:${sessionId}:end_time`,
        `auction:${sessionId}:status`,
        `auction:${sessionId}:extensions`,
        `auction:${sessionId}:product_id`,
        `auction:${sessionId}:room_id`,
        `auction:${sessionId}:top_bid`,
        `room:${session.room_id}:active_session`,
      ];
      await Promise.all(keys.map((k) => cache.del(k)));

      logger.info({ event: 'auction_settle_done', sessionId, status: newStatus, winner: winner?.userId, orderId }, 'Auction settled');

      return { winner, leaderboard, orderId };
    } finally {
      await cache.del(lockKey);
    }
  },

  /**
   * Cancel an auction (merchant only).
   */
  async cancelAuction(sessionId: number, merchantId: number): Promise<void> {
    const session = await auctionSessionRepo.findById(sessionId);
    if (!session) throw Object.assign(new Error('竞拍不存在'), { statusCode: 404 });

    const product = await productRepo.findById(session.product_id);
    if (!product) throw Object.assign(new Error('商品不存在'), { statusCode: 404 });
    if (product.merchant_id !== merchantId) throw Object.assign(new Error('无权限'), { statusCode: 403 });

    if (session.status === 'ended' || session.status === 'cancelled' || session.status === 'unsold') {
      throw Object.assign(new Error('该竞拍已结束'), { statusCode: 409 });
    }

    await auctionSessionRepo.updateStatus(sessionId, 'cancelled', { ended_at: new Date().toISOString() });
    await productRepo.updateStatus(session.product_id, 'cancelled');
    await liveRoomRepo.updateStatus(session.room_id, 'offline');

    clearAuctionTimer(sessionId);

    // Clean up Redis
    const keys = [
      `auction:${sessionId}:end_time`,
      `auction:${sessionId}:status`,
      `auction:${sessionId}:extensions`,
      `auction:${sessionId}:product_id`,
      `auction:${sessionId}:room_id`,
      `auction:${sessionId}:top_bid`,
      `room:${session.room_id}:active_session`,
    ];
    await Promise.all(keys.map((k) => cache.del(k)));

    logger.info({ event: 'auction_cancelled', sessionId, merchantId }, 'Auction cancelled');
  },
};
