import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './middleware/logger.js';
import { db } from './infrastructure/db/knex.js';
import { redis } from './infrastructure/cache/redis.js';
import { initWebSocket } from './ws/index.js';
import { orderService } from './services/order.service.js';

const AUTO_CANCEL_INTERVAL_MS = 60 * 1000;

function startAutoCancelTimer() {
  setInterval(async () => {
    try {
      const count = await orderService.autoCancelExpiredOrders();
      if (count > 0) {
        logger.info({ event: 'auto_cancel_batch', count }, `Auto-cancelled ${count} expired orders`);
      }
    } catch (err) {
      logger.error({ event: 'auto_cancel_error', err }, 'Auto-cancel timer error');
    }
  }, AUTO_CANCEL_INTERVAL_MS);
}

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
    logger.info('Redis connected');
  } catch (err) {
    logger.error({ err }, 'Redis connection failed');
    process.exit(1);
  }

  const app = await buildApp();
  const httpServer = app.server;
  initWebSocket(httpServer);
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info(`Server running on port ${env.PORT}`);

  startAutoCancelTimer();
  logger.info('Order auto-cancel timer started');
}

start().catch((err) => {
  logger.error({ err }, 'Server start failed');
  process.exit(1);
});
