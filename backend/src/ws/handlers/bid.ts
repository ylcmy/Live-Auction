/**
 * WebSocket Bid Handler (优化版)
 *
 * 同步关键路径: 幂等检查 → CAS → MySQL 持久化 → 返回 accepted
 * 异步非关键路径: 通过 BidEventBus 广播 bid:new / rank:update / countdown:sync 等
 */

import type { Server, Socket } from 'socket.io';
import { bidService, type BidProcessResult } from '../../services/bid.service.js';
import { auctionSessionRepo } from '../../repositories/auction-session.repo.js';
import { cache } from '../../infrastructure/cache/redis.js';
import { bidEventBus } from '../bid-event-bus.js';

export function registerBidHandlers(io: Server, socket: Socket) {
  const userId = (socket as any).userId as number;

  socket.on('bid:submit', async (data: { sessionId: number; amount?: number; idempotencyKey: string }) => {
    const { sessionId, amount, idempotencyKey } = data;

    // ---- 1. 三态幂等检查 ----
    const idemKey = `idempotent:bid:${sessionId}:${idempotencyKey}`;
    const existing = await cache.get(idemKey);
    if (existing && existing !== 'pending') {
      const prev = JSON.parse(existing);
      socket.emit('bid:accepted', { sessionId, idempotencyKey, bidId: 0, ...prev });
      return;
    }
    if (existing === 'pending') {
      const lbEntry = await cache.zscore(`auction:${sessionId}:leaderboard`, String(userId));
      if (lbEntry) {
        const rank = await cache.zrevrank(`auction:${sessionId}:leaderboard`, String(userId));
        const result = { amount: Number(lbEntry), rank: rank !== null ? rank + 1 : 1, isLeading: rank === 0 };
        await cache.set(idemKey, JSON.stringify(result), 3600);
        socket.emit('bid:accepted', { sessionId, idempotencyKey, bidId: 0, ...result });
        return;
      }
      await cache.del(idemKey);
    }

    // ---- 2. 获取前领先者 (异步通知需要) ----
    let previousTopBidderId: number | null = null;
    try {
      const topBidRaw = await cache.get(`auction:${sessionId}:top_bid`);
      if (topBidRaw) {
        const topBid = JSON.parse(topBidRaw);
        if (topBid.userId && topBid.userId !== 0) previousTopBidderId = topBid.userId;
      }
    } catch {}

    // ---- 3. 核心出价处理 (Redis CAS + MySQL 同步持久化) ----
    const result: BidProcessResult = await bidService.processBid(sessionId, userId, idempotencyKey, amount);

    if (!result.success) {
      await cache.del(idemKey);
      socket.emit('bid:rejected', { sessionId, idempotencyKey, reason: result.error?.message, code: result.error?.code });
      return;
    }

    // ---- 4. 存储结果到幂等键 ----
    await cache.set(idemKey, JSON.stringify({ amount: result.amount, rank: result.rank, isLeading: result.isLeading }), 3600);

    // ---- 5. 立即返回 accepted ----
    socket.emit('bid:accepted', {
      sessionId,
      idempotencyKey,
      bidId: 0,
      amount: result.amount,
      rank: result.rank,
      isLeading: result.isLeading,
      gapToLeader: result.gapToLeader,
    });

    // ---- 6. 异步广播 (不阻塞用户) ----
    try {
      const session = await auctionSessionRepo.findById(sessionId);
      if (session) {
        const userNickname = await bidService.getUserNickname(userId);
        bidEventBus.emitBidCommitted({
          sessionId,
          roomId: String(session.room_id),
          userId,
          userNickname,
          amount: result.amount!,
          isLeading: result.isLeading!,
          previousTopBidderId,
          extensionResult: result.extensionResult ?? null,
          shouldEnd: result.shouldEnd!,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // 广播失败不影响已返回的 bid:accepted
    }
  });
}
