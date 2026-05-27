import { cache } from '../infrastructure/cache/redis.js';

export async function cleanupAuctionCache(sessionId: number, roomId: number) {
  const keys = [
    `auction:${sessionId}:end_time`,
    `auction:${sessionId}:status`,
    `auction:${sessionId}:extensions`,
    `auction:${sessionId}:product_id`,
    `auction:${sessionId}:room_id`,
    `auction:${sessionId}:top_bid`,
    `room:${roomId}:active_session`,
  ];
  await Promise.all(keys.map((k) => cache.del(k)));
}
