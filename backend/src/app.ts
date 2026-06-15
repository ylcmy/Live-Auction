import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env, CORS_WHITELIST } from './config/env.js';
import { registerErrorHandler } from './middleware/errorHandler.js';
import { authRoutes } from './routes/auth.routes.js';
import { productRoutes } from './routes/product.routes.js';
import { roomRoutes } from './routes/room.routes.js';
import { auctionRoutes } from './routes/auction.routes.js';
import { orderRoutes } from './routes/order.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { merchantApplicationRoutes } from './routes/merchant-application.routes.js';
import { aiRoutes } from './routes/ai.routes.js';
import { toCamelCase } from './lib/case-transform.js';
import { redis, getRedisMode } from './infrastructure/cache/redis.js';
import { db } from './infrastructure/db/knex.js';
import { initializeDefaultAuctionService } from './services/auction.service.js';

export async function buildApp() {
  // Ensure AuctionService singleton is initialized (no WS server in API-only mode)
  initializeDefaultAuctionService(null as any);

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    ajv: { customOptions: { coerceTypes: 'array' } },
    trustProxy: env.TRUST_PROXY,
  });

  await app.register(cors, {
    // Wildcard is only allowed when the request is unauthenticated.
    // For credentialed requests the CORS spec mandates an explicit origin.
    origin: CORS_WHITELIST,
    credentials: CORS_WHITELIST !== true,
  });

  app.addHook('preSerialization', async (_req, _reply, payload) => {
    if (payload && typeof payload === 'object' && 'data' in payload) {
      (payload as Record<string, unknown>).data = toCamelCase((payload as Record<string, unknown>).data);
    }
    return payload;
  });

  registerErrorHandler(app);

  await app.register(authRoutes);
  await app.register(productRoutes);
  await app.register(roomRoutes);
  await app.register(auctionRoutes);
  await app.register(orderRoutes);
  await app.register(userRoutes);
  await app.register(merchantApplicationRoutes);
  await app.register(aiRoutes);

  app.get('/api/health', async (_request, reply) => {
    const checks: Record<string, unknown> = {};
    let isHealthy = true;

    try {
      await redis.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'degraded';
      // Redis degraded is not unhealthy - service still available via MySQL fallback
    }
    checks.redisMode = getRedisMode();

    try {
      await db.raw('SELECT 1');
      checks.mysql = 'ok';
    } catch {
      checks.mysql = 'error';
      isHealthy = false;
    }

    checks.status = isHealthy ? 'healthy' : 'unhealthy';

    reply.code(isHealthy ? 200 : 503);
    return {
      code: isHealthy ? 0 : 1,
      message: isHealthy ? 'ok' : 'unhealthy',
      data: checks,
      timestamp: Date.now(),
    };
  });

  return app;
}
