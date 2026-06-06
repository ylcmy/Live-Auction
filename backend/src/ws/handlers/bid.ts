/**
 * WebSocket Bid Handler
 *
 * 幂等由 processBid 内部统一处理，handler 仅负责:
 *   1. 获取前领先者 (异步通知)
 *   2. 调用 bidService.processBid
 *   3. 返回 accepted
 *   4. 异步广播 bidEventBus
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

    // ---- 1. 获取前领先者 (异步通知需要) ----
    let previousTopBidderId: number | null = null;
    try {
      const topBidRaw = await cache.get(`auction:${sessionId}:top_bid`);
      if (topBidRaw) {
        const topBid = JSON.parse(topBidRaw);
        if (topBid.userId && topBid.userId !== 0) previousTopBidderId = topBid.userId;
      }
    } catch {}

    // ---- 2. 核心出价处理 (Redis CAS + MySQL 同步持久化) ----
    const result: BidProcessResult = await bidService.processBid(sessionId, userId, idempotencyKey, amount);

    if (!result.success) {
      socket.emit('bid:rejected', { sessionId, idempotencyKey, reason: result.error?.message, code: result.error?.code });
      return;
    }

    // ---- 3. 立即返回 accepted ----
    socket.emit('bid:accepted', {
      sessionId,
      idempotencyKey,
      bidId: 0,
      amount: result.amount,
      rank: result.rank,
      isLeading: result.isLeading,
      gapToLeader: result.gapToLeader,
    });

    // ---- 4. 异步广播 (不阻塞用户) ----
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
