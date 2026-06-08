import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './middleware/logger.js';
import { db } from './infrastructure/db/knex.js';
import { redis, redisCircuitBreaker } from './infrastructure/cache/redis.js';
import { initWebSocket } from './ws/index.js';
import { orderService } from './services/order.service.js';
import { getAuctionService } from './services/auction.service.js';
import { startOrderTimeoutWorker, closeOrderTimeoutWorker } from './infrastructure/queue/order-timeout.js';

async function start() {
  // Check DB connection
  try {
    await db.raw('SELECT 1');
    logger.info('MySQL connected');
  } catch (err) {
    logger.error({ err }, 'MySQL connection failed');
    process.exit(1);
  }

  // Check Redis connection
  try {
    await redis.ping();
    redisCircuitBreaker.reset();
    logger.info('Redis connected');
  } catch (err) {
    logger.warn({ err }, 'Redis connection failed - starting in degraded mode');
    redisCircuitBreaker.trip();
  }

  const app = await buildApp();
  const httpServer = app.server;
  initWebSocket(httpServer);
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info(`Server running on port ${env.PORT}`);

  // Restore auction settlement timers after process restart
  const auctionService = getAuctionService();
  await auctionService.restoreTimers();

  // Register circuit breaker callback: rebuild cache when Redis recovers
  redisCircuitBreaker.setOnStateChange((from, to) => {
    if ((from === 'open' || from === 'half-open') && to === 'closed') {
      logger.info({ event: 'redis_recovered', from, to }, 'Redis recovered - triggering cache rebuild');
      auctionService.rebuildAuctionCache().catch((err) => {
        logger.error({ event: 'cache_rebuild_failed', err }, 'Failed to rebuild auction cache after Redis recovery');
      });
    }
  });

  // Run a one-time fallback scan for any expired orders before starting the worker
  await orderService.autoCancelExpiredOrders();
  // Start BullMQ worker for order timeout processing
  startOrderTimeoutWorker();
  logger.info('Order timeout worker started');
}

start().catch((err) => {
  logger.error({ err }, 'Server start failed');
  process.exit(1);
});
