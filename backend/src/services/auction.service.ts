import { auctionSessionRepo } from '../repositories/auction-session.repo.js';
import { productRepo } from '../repositories/product.repo.js';
import { auctionRuleRepo } from '../repositories/auction-rule.repo.js';
import { liveRoomRepo } from '../repositories/live-room.repo.js';
import { orderRepo } from '../repositories/order.repo.js';
import { cache, isRedisAvailable } from '../infrastructure/cache/redis.js';
import { db } from '../infrastructure/db/knex.js';
import { bidService } from './bid.service.js';
import { logger } from '../middleware/logger.js';
import { AppError } from '../lib/app-error.js';
import { cleanupAuctionCache } from '../lib/auction-cache.js';
import { broadcastToRoom } from '../ws/rooms.js';
import { broadcastRoomListUpdate } from '../ws/index.js';
import { canTransition } from '../domain/auction.js';
import type { AuctionStatus } from '../domain/auction.js';
import { AuctionTimerManager } from './auction-timer-manager.js';
import type { Server } from 'socket.io';
import type { Knex } from 'knex';

interface AuctionSessionRow {
  id: number;
  product_id: number;
  room_id: number;
  status: string;
  current_price: number | string;
  started_at: Date | string;
  ended_at: Date | string | null;
  winner_id: number | null;
  extension_count: number;
  version: number;
  order_created?: boolean | number;
}

interface SettleResult {
  winner: { userId: number; userNickname: string; finalPrice: number } | null;
  leaderboard: { rank: number; userId: number; userNickname: string; avatarUrl: string | null; amount: number }[];
  orderId: number | null;
}

export class AuctionService {
  constructor(
    private io: Server | null,
    private timerManager: AuctionTimerManager,
  ) {}

  async startAuction(merchantId: number, productId: number, roomId: number) {
    const product = await productRepo.findById(productId);
    if (!product) throw new AppError('商品不存在', 404);
    if (product.merchant_id !== merchantId) throw new AppError('无权限', 403);
    if (product.status !== 'listed') throw new AppError('该商品当前状态不可发起竞拍', 409);

    const room = await liveRoomRepo.findById(roomId);
    if (!room) throw new AppError('直播间不存在', 404);
    if (room.host_id !== merchantId) throw new AppError('无权限', 403);

    const rule = await auctionRuleRepo.findByProductId(productId);
    if (!rule) throw new AppError('请先配置竞拍规则', 400);

    // Use transaction + row-level lock to prevent concurrent auction starts in the same room
    const sessionId = await db.transaction(async (trx) => {
      // SELECT FOR UPDATE: acquire row-level lock on any existing active session for this room
      // If no row exists, no lock is acquired, but the unique index on active_room_id
      // will still prevent concurrent inserts after we release the transaction
      const activeSession = await auctionSessionRepo.findActiveByRoomForUpdate(roomId, trx);
      if (activeSession) throw new AppError('当前直播间已有进行中的竞拍', 409);

      const [id] = await trx('auction_sessions').insert({
        product_id: productId,
        rule_id: rule.id,
        room_id: roomId,
        status: 'active',
        active_room_id: roomId,
        current_price: rule.start_price,
        started_at: trx.fn.now(),
      });

      await trx('products').where({ id: productId }).update({ status: 'active', updated_at: trx.fn.now() });
      await trx('live_rooms').where({ id: roomId }).update({ status: 'live', updated_at: trx.fn.now() });

      return id as number;
    });

    // Cache hot data in Redis with TTL
    const endTime = Date.now() + rule.duration_seconds * 1000;
    const ttlSeconds = rule.duration_seconds + (rule.extend_seconds * rule.max_extensions) + 3600;
    await cache.set(`auction:${sessionId}:end_time`, String(endTime), ttlSeconds);
    await cache.set(`auction:${sessionId}:status`, 'active', ttlSeconds);
    await cache.set(`auction:${sessionId}:extensions`, '0', ttlSeconds);
    await cache.set(`auction:${sessionId}:product_id`, String(productId), ttlSeconds);
    await cache.set(`auction:${sessionId}:room_id`, String(roomId), ttlSeconds);
    await cache.set(
      `auction:${sessionId}:top_bid`,
      JSON.stringify({ userId: 0, amount: rule.start_price, timestamp: new Date().toISOString() }),
      ttlSeconds,
    );
    await cache.set(
      `auction:${sessionId}:rule`,
      JSON.stringify({
        bid_increment: Number(rule.bid_increment),
        ceiling_price: rule.ceiling_price ? Number(rule.ceiling_price) : null,
        max_extensions: rule.max_extensions,
        extend_seconds: rule.extend_seconds,
      }),
      ttlSeconds,
    );
    await cache.set(`auction:${sessionId}:merchant_id`, String(merchantId), ttlSeconds);
    // Map room to active session for WS join lookups
    await cache.set(`room:${roomId}:active_session`, String(sessionId), ttlSeconds);

    // Schedule settlement timer
    this.timerManager.schedule(sessionId, rule.duration_seconds * 1000, () =>
      this.settleAuction(sessionId),
    );

    // Broadcast auction started to all clients in the room
    if (this.io) {
      broadcastToRoom(this.io, String(roomId), 'auction:started', {
        sessionId,
        status: 'active',
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
        currentPrice: Number(rule.start_price),
        startedAt: new Date().toISOString(),
        extensionCount: 0,
      });
    }

    broadcastRoomListUpdate('room-list:auction-started', {
      roomId,
      currentAuction: {
        sessionId,
        status: 'active',
        product: {
          id: product.id,
          name: product.name,
          description: product.description,
          imageUrl: product.image_url,
        },
        currentPrice: Number(rule.start_price),
        startedAt: new Date().toISOString(),
      },
    });

    logger.info({ event: 'auction_start', sessionId, productId, roomId, merchantId, duration: rule.duration_seconds }, 'Auction started');

    return {
      sessionId,
      status: 'active',
      startedAt: new Date().toISOString(),
      endTime,
      rule,
      product,
    };
  }

  /**
   * Reschedule the settlement timer after an extension applied during bid processing.
   * The Redis/MySQL state is already updated by processBid; this only reschedules the timer.
   */
  rescheduleSettlement(sessionId: number, delayMs: number): void {
    this.timerManager.schedule(sessionId, delayMs, () =>
      this.settleAuction(sessionId),
    );
  }

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
    const extendTtl = rule.extend_seconds + 3600;
    await cache.set(`auction:${sessionId}:end_time`, String(newEndTime), extendTtl);
    await cache.set(`auction:${sessionId}:extensions`, String(newExtensions), extendTtl);
    await auctionSessionRepo.updateStatus(sessionId, 'active', { extension_count: newExtensions });

    // Reschedule settlement timer
    this.timerManager.schedule(sessionId, rule.extend_seconds * 1000, () =>
      this.settleAuction(sessionId),
    );

    logger.info({ event: 'auction_extend', sessionId, extensions: newExtensions, newEndTime }, 'Auction extended');

    return { remainingMs: rule.extend_seconds * 1000, extensionCount: newExtensions };
  }

  /**
   * Get current auction timer info for countdown sync.
   * Falls back to MySQL calculation when Redis is unavailable.
   */
  async getAuctionTimer(sessionId: number): Promise<{ serverTime: number; endTime: number; remainingMs: number } | null> {
    if (isRedisAvailable()) {
      const endTime = parseInt((await cache.get(`auction:${sessionId}:end_time`)) || '0', 10);
      if (endTime > 0) {
        const serverTime = Date.now();
        const remainingMs = Math.max(0, endTime - serverTime);
        return { serverTime, endTime, remainingMs };
      }
    }

    // Fallback: calculate end_time from MySQL
    const session = await auctionSessionRepo.findById(sessionId);
    if (!session || !session.started_at) return null;

    const rule = await auctionRuleRepo.findByProductId(session.product_id);
    if (!rule) return null;

    const startedAt = new Date(session.started_at).getTime();
    const extensionCount = session.extension_count || 0;
    const endTime = startedAt + rule.duration_seconds * 1000 + extensionCount * rule.extend_seconds * 1000;
    const serverTime = Date.now();
    const remainingMs = Math.max(0, endTime - serverTime);
    return { serverTime, endTime, remainingMs };
  }

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

    const topBidRaw = await cache.get(`auction:${sessionId}:top_bid`);
    const topBid = topBidRaw ? (JSON.parse(topBidRaw) as { userId: number; amount: number }) : null;
    const currentPrice = topBid ? Number(topBid.amount) : Number(session.current_price);

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
      currentPrice,
      leaderboard,
      myRank: currentUserId ? leaderboard.find((e) => e.userId === currentUserId)?.rank || null : null,
      myBidAmount: currentUserId ? (await bidService.getMyRank(sessionId, currentUserId)).amount : null,
      remainingMs: timer?.remainingMs ?? 0,
      startedAt: session.started_at,
      participantCount: leaderboard.length,
      extensionCount: extensions,
    };
  }

  /**
   * Settle an auction: determine winner, create order, update statuses, broadcast cleanup.
   * When Redis is unavailable, uses MySQL SELECT FOR UPDATE row lock instead of Redis lock.
   */
  async settleAuction(sessionId: number): Promise<SettleResult> {
    logger.info({ event: 'auction_settle_start', sessionId }, 'Settling auction');

    if (isRedisAvailable()) {
      return this._settleAuctionRedis(sessionId);
    }
    return this._settleAuctionMySQL(sessionId);
  }

  /**
   * Redis path: use Redis SETNX lock for settlement mutual exclusion.
   */
  private async _settleAuctionRedis(sessionId: number): Promise<SettleResult> {
    const lockKey = `settle_lock:${sessionId}`;
    const lock = await cache.setnx(lockKey, '1', 30);
    if (!lock) {
      logger.warn({ event: 'auction_settle_blocked', sessionId }, 'Settlement blocked - concurrent settlement in progress');
      return { winner: null, leaderboard: [], orderId: null };
    }

    try {
      return await this._doSettle(sessionId);
    } finally {
      await cache.del(lockKey);
    }
  }

  /**
   * MySQL fallback path: use SELECT FOR UPDATE row lock for settlement mutual exclusion.
   */
  private async _settleAuctionMySQL(sessionId: number): Promise<SettleResult> {
    try {
      const result = await db.transaction(async (trx) => {
        // Acquire row-level lock on the session
        const session = await auctionSessionRepo.findByIdForUpdate(sessionId, trx);
        if (!session) {
          logger.warn({ event: 'auction_settle_nosession', sessionId }, 'Session not found for settlement');
          return { winner: null, leaderboard: [], orderId: null, roomId: 0, newStatus: '' } as SettleResult & { roomId: number; newStatus: string };
        }

        if (session.status === 'ended' || session.status === 'cancelled' || session.status === 'unsold') {
          logger.warn({ event: 'auction_settle_already', sessionId, status: session.status }, 'Auction already ended');
          return { winner: null, leaderboard: [], orderId: null, roomId: 0, newStatus: '' } as SettleResult & { roomId: number; newStatus: string };
        }

        return await this._doSettleCore(sessionId, session, trx);
      });

      // Post-transaction: broadcast and cache cleanup (must be outside transaction)
      if (result.winner || result.newStatus) {
        this._postSettle(sessionId, result.roomId, result.newStatus, result.winner, result.leaderboard, result.orderId);
      }

      return { winner: result.winner, leaderboard: result.leaderboard, orderId: result.orderId };
    } catch (err) {
      logger.error({ event: 'auction_settle_mysql_error', sessionId, err }, 'Settlement failed (MySQL path)');
      return { winner: null, leaderboard: [], orderId: null };
    }
  }

  /**
   * Redis path: execute settlement within a MySQL transaction for atomicity.
   * Broadcast and cache cleanup happen after the transaction commits.
   */
  private async _doSettle(sessionId: number): Promise<SettleResult> {
    try {
      const result = await db.transaction(async (trx) => {
        const session = await auctionSessionRepo.findByIdForUpdate(sessionId, trx);
        if (!session) {
          logger.warn({ event: 'auction_settle_nosession', sessionId }, 'Session not found for settlement');
          return { winner: null, leaderboard: [], orderId: null, roomId: 0, newStatus: '' } as SettleResult & { roomId: number; newStatus: string };
        }

        if (session.status === 'ended' || session.status === 'cancelled' || session.status === 'unsold') {
          logger.warn({ event: 'auction_settle_already', sessionId, status: session.status }, 'Auction already ended');
          return { winner: null, leaderboard: [], orderId: null, roomId: 0, newStatus: '' } as SettleResult & { roomId: number; newStatus: string };
        }

        return await this._doSettleCore(sessionId, session, trx);
      });

      // Post-transaction: broadcast and cache cleanup (must be outside transaction)
      if (result.winner || result.newStatus) {
        this._postSettle(sessionId, result.roomId, result.newStatus, result.winner, result.leaderboard, result.orderId);
      }

      return { winner: result.winner, leaderboard: result.leaderboard, orderId: result.orderId };
    } catch (err) {
      logger.error({ event: 'auction_settle_error', sessionId, err }, 'Settlement failed');
      return { winner: null, leaderboard: [], orderId: null };
    }
  }

  /**
   * Core settlement logic: determine winner, create order, update statuses.
   * Always called within a transaction (trx is required).
   * Returns extended result with roomId/newStatus for post-transaction broadcast.
   */
  private async _doSettleCore(
    sessionId: number,
    session: AuctionSessionRow,
    trx?: Knex.Transaction,
  ): Promise<SettleResult & { roomId: number; newStatus: string }> {
    // Determine winner - use Redis leaderboard if available, otherwise MySQL
    let winner: { userId: number; userNickname: string; finalPrice: number } | null = null;
    let orderId: number | null = null;
    let newStatus: string;

    if (isRedisAvailable()) {
      const rawLb = await bidService.getLeaderboardRaw(sessionId);
      if (rawLb.length >= 2) {
        const winnerId = Number(rawLb[0]);
        const winningAmount = Number(rawLb[1]);
        const nickname = await bidService.getUserNickname(winnerId);
        winner = { userId: winnerId, userNickname: nickname, finalPrice: winningAmount };
        newStatus = 'ended';
      } else {
        newStatus = 'unsold';
      }
    } else {
      // MySQL fallback: query leaderboard from bid_records
      const mysqlLeaderboard = await bidService.getLeaderboard(sessionId, 0);
      if (mysqlLeaderboard.length > 0) {
        const topBidder = mysqlLeaderboard[0]!;
        winner = { userId: topBidder.userId, userNickname: topBidder.userNickname, finalPrice: topBidder.amount };
        newStatus = 'ended';
      } else {
        newStatus = 'unsold';
      }
    }

    if (winner) {
      // Idempotent protection: check order_created flag
      if (session.order_created === true || session.order_created === 1) {
        // Order already created in a previous attempt — recover orderId
        const existingOrder = trx
          ? await trx('orders').where({ session_id: sessionId }).first()
          : await orderRepo.findBySessionId(sessionId);
        if (existingOrder) {
          orderId = existingOrder.id;
          logger.info({ event: 'order_idempotent_skip', sessionId, orderId }, 'Order already exists, skipping creation');
        } else {
          logger.warn({ event: 'order_created_flag_mismatch', sessionId }, 'order_created is true but no order found, creating new order');
          const expireAt = new Date(Date.now() + 15 * 60 * 1000);
          if (trx) {
            const [createdId] = await trx('orders').insert({
              session_id: sessionId,
              buyer_id: winner.userId,
              product_id: session.product_id,
              final_price: winner.finalPrice,
              status: 'pending_payment',
              expire_at: expireAt,
            });
            orderId = createdId ?? null;
          } else {
            const createdId = await orderRepo.create({
              session_id: sessionId,
              buyer_id: winner.userId,
              product_id: session.product_id,
              final_price: winner.finalPrice,
            });
            orderId = createdId ?? null;
          }
        }
      } else {
        // Create order for winner
        try {
          const expireAt = new Date(Date.now() + 15 * 60 * 1000);
          if (trx) {
            const [createdId] = await trx('orders').insert({
              session_id: sessionId,
              buyer_id: winner.userId,
              product_id: session.product_id,
              final_price: winner.finalPrice,
              status: 'pending_payment',
              expire_at: expireAt,
            });
            orderId = createdId ?? null;
          } else {
            const createdId = await orderRepo.create({
              session_id: sessionId,
              buyer_id: winner.userId,
              product_id: session.product_id,
              final_price: winner.finalPrice,
            });
            orderId = createdId ?? null;
          }
          logger.info({ event: 'order_created', orderId, sessionId, buyerId: winner.userId, amount: winner.finalPrice }, 'Order created for winner');
        } catch (err) {
          logger.error({ event: 'order_create_failed', sessionId, err }, 'Failed to create order');
        }
      }
    }

    // Build leaderboard with nicknames
    const leaderboard = await bidService.getLeaderboard(sessionId, 0);

    // Enforce state machine transition
    if (!canTransition(session.status as AuctionStatus, newStatus as AuctionStatus)) {
      logger.warn({ event: 'invalid_transition', sessionId, from: session.status, to: newStatus }, 'Invalid state transition blocked');
      return { winner: null, leaderboard: [], orderId: null, roomId: session.room_id, newStatus: '' };
    }

    // Update statuses within transaction
    if (trx) {
      await trx('auction_sessions').where({ id: sessionId }).update({
        status: newStatus,
        winner_id: winner?.userId,
        ended_at: trx.fn.now(),
        order_created: winner ? true : undefined,
        active_room_id: null,
        updated_at: trx.fn.now(),
      });
      await trx('products').where({ id: session.product_id }).update({
        status: newStatus === 'ended' ? 'ended' : 'unsold',
        updated_at: trx.fn.now(),
      });
    } else {
      await auctionSessionRepo.updateStatus(sessionId, newStatus, {
        winner_id: winner?.userId,
        ended_at: db.fn.now(),
        ...(winner ? { order_created: true } : {}),
      });
      await productRepo.updateStatus(session.product_id, newStatus === 'ended' ? 'ended' : 'unsold');
    }

    logger.info({ event: 'auction_settle_done', sessionId, status: newStatus, winner: winner?.userId, orderId }, 'Auction settled');

    return { winner, leaderboard, orderId, roomId: session.room_id, newStatus };
  }

  /**
   * Post-transaction actions: broadcast and cache cleanup.
   * Must be called AFTER the transaction commits to avoid clients reading uncommitted data.
   */
  private _postSettle(
    sessionId: number,
    roomId: number,
    newStatus: string,
    winner: { userId: number; userNickname: string; finalPrice: number } | null,
    leaderboard: { rank: number; userId: number; userNickname: string; avatarUrl: string | null; amount: number }[],
    orderId: number | null,
  ): void {
    // Broadcast auction ended to room
    if (this.io) {
      broadcastToRoom(this.io, String(roomId), 'auction:ended', {
        sessionId,
        status: newStatus,
        winner,
        leaderboard,
        orderId,
        orderCreated: true,
      });
      logger.info({ event: 'auction_ended_broadcast', sessionId, roomId, status: newStatus }, 'Broadcast auction:ended to room');
    }

    broadcastRoomListUpdate('room-list:auction-ended', {
      roomId,
      sessionId,
      status: newStatus,
    });

    // Clear auction timers
    this.timerManager.clear(sessionId);

    cleanupAuctionCache(sessionId, roomId).catch((err) => {
      logger.error({ event: 'auction_cache_cleanup_error', sessionId, err }, 'Failed to cleanup auction cache');
    });
  }

  /**
   * Cancel an auction (merchant only).
   * When Redis is unavailable, uses MySQL SELECT FOR UPDATE row lock instead of Redis lock.
   */
  async cancelAuction(sessionId: number, merchantId: number): Promise<void> {
    if (isRedisAvailable()) {
      return this._cancelAuctionRedis(sessionId, merchantId);
    }
    return this._cancelAuctionMySQL(sessionId, merchantId);
  }

  /**
   * Redis path: use Redis SETNX lock for cancellation mutual exclusion.
   */
  private async _cancelAuctionRedis(sessionId: number, merchantId: number): Promise<void> {
    const lockKey = `cancel_lock:${sessionId}`;
    const lock = await cache.setnx(lockKey, '1', 10);
    if (!lock) throw new AppError('操作进行中，请稍后再试', 409);

    try {
      await this._doCancel(sessionId, merchantId);
    } finally {
      await cache.del(lockKey);
    }
  }

  /**
   * MySQL fallback path: use SELECT FOR UPDATE row lock for cancellation mutual exclusion.
   */
  private async _cancelAuctionMySQL(sessionId: number, merchantId: number): Promise<void> {
    await db.transaction(async (trx) => {
      // Acquire row-level lock on the session
      const session = await auctionSessionRepo.findByIdForUpdate(sessionId, trx);
      if (!session) throw new AppError('竞拍不存在', 404);

      const product = await productRepo.findById(session.product_id);
      if (!product) throw new AppError('商品不存在', 404);
      if (product.merchant_id !== merchantId) throw new AppError('无权限', 403);

      if (session.status === 'ended' || session.status === 'cancelled' || session.status === 'unsold') {
        throw new AppError('该竞拍已结束', 409);
      }

      if (!canTransition(session.status as AuctionStatus, 'cancelled')) {
        throw new AppError(`竞拍状态不可从 ${session.status} 变为 cancelled`, 409);
      }

      await trx('auction_sessions').where({ id: sessionId }).update({
        status: 'cancelled',
        ended_at: trx.fn.now(),
        active_room_id: null,
        updated_at: trx.fn.now(),
      });
      await trx('products').where({ id: session.product_id }).update({
        status: 'listed',
        updated_at: trx.fn.now(),
      });

      this.timerManager.clear(sessionId);

      // Broadcast auction cancelled to room
      if (this.io) {
        broadcastToRoom(this.io, String(session.room_id), 'auction:cancelled', {
          sessionId,
          reason: '商家取消了竞拍',
        });
      }

      await cleanupAuctionCache(sessionId, session.room_id);

      logger.info({ event: 'auction_cancelled', sessionId, merchantId }, 'Auction cancelled');
    });
  }

  /**
   * Core cancellation logic for Redis path.
   */
  private async _doCancel(sessionId: number, merchantId: number): Promise<void> {
    const session = await auctionSessionRepo.findById(sessionId);
    if (!session) throw new AppError('竞拍不存在', 404);

    const product = await productRepo.findById(session.product_id);
    if (!product) throw new AppError('商品不存在', 404);
    if (product.merchant_id !== merchantId) throw new AppError('无权限', 403);

    if (session.status === 'ended' || session.status === 'cancelled' || session.status === 'unsold') {
      throw new AppError('该竞拍已结束', 409);
    }

    if (!canTransition(session.status as AuctionStatus, 'cancelled')) {
      throw new AppError(`竞拍状态不可从 ${session.status} 变为 cancelled`, 409);
    }

    await auctionSessionRepo.updateStatus(sessionId, 'cancelled', { ended_at: db.fn.now() });
    await productRepo.updateStatus(session.product_id, 'listed');

    this.timerManager.clear(sessionId);

    // Broadcast auction cancelled to room
    if (this.io) {
      broadcastToRoom(this.io, String(session.room_id), 'auction:cancelled', {
        sessionId,
        reason: '商家取消了竞拍',
      });
    }

    await cleanupAuctionCache(sessionId, session.room_id);

    logger.info({ event: 'auction_cancelled', sessionId, merchantId }, 'Auction cancelled');
  }

  /**
   * Rebuild Redis cache for all active auction sessions from MySQL data.
   * Called when Redis recovers (circuit breaker transitions from open/half-open to closed).
   * Uses SETNX to avoid overwriting keys that may have been written by live traffic.
   */
  async rebuildAuctionCache(): Promise<void> {
    logger.info({ event: 'cache_rebuild_start' }, 'Rebuilding auction cache from MySQL');

    const sessions = await db('auction_sessions')
      .where({ status: 'active' })
      .select('id', 'product_id', 'rule_id', 'room_id', 'started_at', 'extension_count');

    if (sessions.length === 0) {
      logger.info({ event: 'cache_rebuild_no_active' }, 'No active auctions to rebuild cache for');
      return;
    }

    for (const session of sessions) {
      try {
        const sessionId = session.id;
        const rule = await db('auction_rules').where({ id: session.rule_id }).first();
        if (!rule || !session.started_at) {
          logger.warn({ event: 'cache_rebuild_skip', sessionId }, 'Missing rule or started_at, skipping session');
          continue;
        }

        // Calculate TTL: duration + max extensions + 1 hour buffer
        const ttlSeconds = rule.duration_seconds + (rule.extend_seconds * rule.max_extensions) + 3600;

        // Rebuild end_time: started_at + duration + extensions
        const startedAt = new Date(session.started_at).getTime();
        const endTime = startedAt + rule.duration_seconds * 1000 + (session.extension_count * rule.extend_seconds * 1000);
        await cache.setnx(`auction:${sessionId}:end_time`, String(endTime), ttlSeconds);

        // Rebuild extensions
        await cache.setnx(`auction:${sessionId}:extensions`, String(session.extension_count), ttlSeconds);

        // Rebuild product_id, room_id, status, active_session
        await cache.setnx(`auction:${sessionId}:product_id`, String(session.product_id), ttlSeconds);
        await cache.setnx(`auction:${sessionId}:room_id`, String(session.room_id), ttlSeconds);
        await cache.setnx(`auction:${sessionId}:status`, 'active', ttlSeconds);
        await cache.setnx(`room:${session.room_id}:active_session`, String(sessionId), ttlSeconds);

        // Rebuild top_bid from highest bid in bid_records
        const topBid = await db('bid_records')
          .where({ session_id: sessionId })
          .orderBy('bid_amount', 'desc')
          .orderBy('created_at', 'asc')
          .first('user_id', 'bid_amount', 'created_at');
        if (topBid) {
          const topBidData = JSON.stringify({
            userId: topBid.user_id,
            amount: Number(topBid.bid_amount),
            timestamp: new Date(topBid.created_at).toISOString(),
          });
          await cache.setnx(`auction:${sessionId}:top_bid`, topBidData, ttlSeconds);
        } else {
          // No bids yet — use start price
          const topBidData = JSON.stringify({
            userId: 0,
            amount: Number(rule.start_price),
            timestamp: new Date().toISOString(),
          });
          await cache.setnx(`auction:${sessionId}:top_bid`, topBidData, ttlSeconds);
        }

        // Rebuild leaderboard from bid_records (ZADD with NX flag per member)
        const bids = await db('bid_records')
          .where({ session_id: sessionId })
          .select('user_id', 'bid_amount');
        // Group by user_id, keep highest bid per user (matching Redis ZADD semantics)
        const userBestBids = new Map<number, number>();
        for (const bid of bids) {
          const existing = userBestBids.get(bid.user_id);
          if (existing === undefined || Number(bid.bid_amount) > existing) {
            userBestBids.set(bid.user_id, Number(bid.bid_amount));
          }
        }
        const lbKey = `auction:${sessionId}:leaderboard`;
        for (const [userId, amount] of userBestBids) {
          await cache.zadd(lbKey, amount, String(userId));
        }
        // Set TTL on leaderboard key
        await cache.expire(lbKey, ttlSeconds);

        // Rebuild participants from DISTINCT user_ids in bid_records
        const participantIds = [...userBestBids.keys()];
        const participantsKey = `room:${session.room_id}:participants`;
        if (participantIds.length > 0) {
          await cache.sadd(participantsKey, ...participantIds.map(String));
          await cache.expire(participantsKey, ttlSeconds);
        }

        logger.info({ event: 'cache_rebuild_session', sessionId, bidCount: bids.length, participantCount: participantIds.length }, 'Cache rebuilt for session');
      } catch (err) {
        logger.error({ event: 'cache_rebuild_error', sessionId: session.id, err }, 'Failed to rebuild cache for session');
      }
    }

    logger.info({ event: 'cache_rebuild_done', sessionCount: sessions.length }, 'Auction cache rebuild completed');
  }

  /**
   * Restore timers for all active auctions after process restart.
   * Reads end_time from Redis; falls back to started_at + duration from rules.
   */
  async restoreTimers(): Promise<void> {
    const sessions = await auctionSessionRepo.findAllActive();
    if (sessions.length === 0) {
      logger.info({ event: 'timer_restore_no_active' }, 'No active auctions to restore');
      return;
    }

    const resolved: Array<{ id: number; endTimeMs: number }> = [];

    for (const session of sessions) {
      // Try Redis first
      const redisEndTime = await cache.get(`auction:${session.id}:end_time`);
      if (redisEndTime) {
        const endTimeMs = parseInt(redisEndTime, 10);
        if (!isNaN(endTimeMs) && endTimeMs > 0) {
          resolved.push({ id: session.id, endTimeMs });
          continue;
        }
      }

      // Fallback: calculate from started_at + duration_seconds
      const rule = await db('auction_rules').where({ id: session.rule_id }).first();
      if (!rule || !session.started_at) {
        logger.warn({ event: 'timer_restore_skip', sessionId: session.id }, 'Cannot determine end_time, skipping session');
        continue;
      }

      const startedAt = new Date(session.started_at).getTime();
      const extensionCount = session.extension_count || 0;
      const endTimeMs = startedAt + rule.duration_seconds * 1000 + extensionCount * rule.extend_seconds * 1000;
      resolved.push({ id: session.id, endTimeMs });

      // Re-populate Redis end_time for future lookups
      await cache.set(`auction:${session.id}:end_time`, String(endTimeMs));
    }

    await this.timerManager.restoreTimers(resolved, (sessionId: number) =>
      this.settleAuction(sessionId),
    );
  }
}

let defaultServiceInstance: AuctionService | null = null;

export function createAuctionService(io: Server | null = null): AuctionService {
  const timerManager = new AuctionTimerManager();
  return new AuctionService(io, timerManager);
}

export function initializeDefaultAuctionService(io: Server): void {
  defaultServiceInstance = createAuctionService(io);
}

export function getAuctionService(): AuctionService {
  if (!defaultServiceInstance) {
    throw new Error('AuctionService not initialized. Call initializeDefaultAuctionService first.');
  }
  return defaultServiceInstance;
}

// Backward-compatible export: Proxy to default instance for existing code
export const auctionService = new Proxy({} as AuctionService, {
  get(_target, prop) {
    const service = getAuctionService();
    return service[prop as keyof AuctionService];
  },
});
