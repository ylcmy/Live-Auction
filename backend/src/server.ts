import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './middleware/logger.js';
import { db } from './infrastructure/db/knex.js';
import { redis } from './infrastructure/cache/redis.js';
import { initWebSocket } from './ws/index.js';

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
}

start().catch((err) => {
  logger.error({ err }, 'Server start failed');
  process.exit(1);
});
