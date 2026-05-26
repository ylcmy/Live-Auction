import { auctionSessionRepo } from '../repositories/auction-session.repo.js';
import { productRepo } from '../repositories/product.repo.js';
import { auctionRuleRepo } from '../repositories/auction-rule.repo.js';
import { liveRoomRepo } from '../repositories/live-room.repo.js';
import { cache } from '../infrastructure/cache/redis.js';
import { logger } from '../middleware/logger.js';

export const auctionService = {
  async startAuction(merchantId: number, productId: number, roomId: number) {
    // Validate product exists and belongs to merchant
    const product = await productRepo.findById(productId);
    if (!product) throw Object.assign(new Error('商品不存在'), { statusCode: 404 });
    if (product.merchant_id !== merchantId) throw Object.assign(new Error('无权限'), { statusCode: 403 });
    if (product.status !== 'pending' && product.status !== 'draft') throw Object.assign(new Error('该商品当前状态不可发起竞拍'), { statusCode: 409 });

    // Validate room exists and belongs to merchant
    const room = await liveRoomRepo.findById(roomId);
    if (!room) throw Object.assign(new Error('直播间不存在'), { statusCode: 404 });
    if (room.host_id !== merchantId) throw Object.assign(new Error('无权限'), { statusCode: 403 });

    // Check no active auction in room
    const activeSession = await auctionSessionRepo.findActiveByRoom(roomId);
    if (activeSession) throw Object.assign(new Error('当前直播间已有进行中的竞拍'), { statusCode: 409 });

    // Get rule
    const rule = await auctionRuleRepo.findByProductId(productId);
    if (!rule) throw Object.assign(new Error('请先配置竞拍规则'), { statusCode: 400 });

    // Create session
    const sessionId = await auctionSessionRepo.create({
      product_id: productId,
      rule_id: rule.id,
      room_id: roomId,
      current_price: rule.start_price,
    });

    // Update product and room status
    await productRepo.updateStatus(productId, 'active');
    await liveRoomRepo.updateStatus(roomId, 'live');

    // Cache hot data in Redis
    const endTime = Date.now() + rule.duration_seconds * 1000;
    await cache.set(`auction:${sessionId}:countdown`, String(endTime));
    await cache.set(`auction:${sessionId}:status`, 'active');
    await cache.set(`auction:${sessionId}:extensions`, '0');
    await cache.set(
      `auction:${sessionId}:top_bid`,
      JSON.stringify({ userId: 0, amount: rule.start_price, timestamp: Date.now() }),
    );

    logger.info({ event: 'auction_start', sessionId, productId, roomId, merchantId, duration: rule.duration_seconds }, 'Auction started');

    return { sessionId, status: 'active', startedAt: new Date().toISOString() };
  },

  async settleAuction(sessionId: number) {
    // T077: Full settlement logic with MySQL transaction + optimistic lock
    logger.info({ event: 'auction_settle', sessionId }, 'Auction settlement triggered');
    throw new Error('settleAuction not yet implemented');
  },

  async cancelAuction(sessionId: number, merchantId: number) {
    logger.info({ event: 'auction_cancel', sessionId, merchantId }, 'Auction cancellation requested');
    throw new Error('cancelAuction not yet implemented');
  },
};
