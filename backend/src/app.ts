import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { registerErrorHandler } from './middleware/errorHandler.js';
import { logRequest } from './middleware/logger.js';
import { authRoutes } from './routes/auth.routes.js';
import { productRoutes } from './routes/product.routes.js';
import { roomRoutes } from './routes/room.routes.js';
import { auctionRoutes } from './routes/auction.routes.js';
import { orderRoutes } from './routes/order.routes.js';
import { toCamelCase } from './lib/case-transform.js';

export async function buildApp() {
  const app = Fastify({
    logger: false, // We use pino directly
    ajv: { customOptions: { coerceTypes: 'array' } },
  });

  await app.register(cors, { origin: true, credentials: true });

  // Transform snake_case DB fields to camelCase for frontend
  app.addHook('preSerialization', async (_req, _reply, payload) => {
    if (payload && typeof payload === 'object' && 'data' in payload) {
      (payload as Record<string, unknown>).data = toCamelCase((payload as Record<string, unknown>).data);
    }
    return payload;
  });

  // Request logging
  app.addHook('onResponse', logRequest);

  // Error handler
  registerErrorHandler(app);

  // Routes
  await app.register(authRoutes);
  await app.register(productRoutes);
  await app.register(roomRoutes);
  await app.register(auctionRoutes);
  await app.register(orderRoutes);

  // Health check
  app.get('/api/health', async () => ({
    code: 0,
    message: 'ok',
    data: { status: 'healthy' },
    timestamp: Date.now(),
  }));

  return app;
}
