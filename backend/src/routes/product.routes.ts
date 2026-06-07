import { FastifyInstance } from 'fastify';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { productService } from '../services/product.service.js';
import { replySuccess, replyError } from '../lib/reply.js';
import { ErrorCodes } from '../lib/error-codes.js';

export async function productRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', requireRole('merchant'));

  app.post(
    '/api/products',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name', 'rule'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            imageUrl: { type: 'string' },
            category: { type: 'string' },
            rule: {
              type: 'object',
              required: ['startPrice', 'bidIncrement', 'durationSeconds', 'extendSeconds'],
              properties: {
                startPrice: { type: 'number', minimum: 0.01 },
                bidIncrement: { type: 'number', minimum: 0.01 },
                ceilingPrice: { type: 'number' },
                durationSeconds: { type: 'integer', minimum: 1 },
                extendSeconds: { type: 'integer', minimum: 1 },
                maxExtensions: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 100,
                },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const body = req.body as any;
      const data = await productService.createProduct(req.auth.userId, body);
      return replySuccess(reply, data, 201);
    },
  );

  app.get('/api/products', async (req, reply) => {
    const query = req.query as any;
    const data = await productService.getProducts(req.auth.userId, {
      status: query.status,
      page: Math.max(1, parseInt(query.page) || 1),
      limit: parseInt(query.limit) || 20,
    });
    return replySuccess(reply, data);
  });

  app.get('/api/products/:id', async (req, reply) => {
    const id = Number((req.params as any).id);
    if (!Number.isFinite(id)) return replyError(reply, ErrorCodes.INVALID_PRODUCT_ID, '无效的商品 ID', 400);
    const data = await productService.getProductById(id);
    return replySuccess(reply, data);
  });

  app.put(
    '/api/products/:id/rules',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            bidIncrement: { type: 'number', minimum: 0.01 },
            ceilingPrice: { type: 'number' },
            durationSeconds: { type: 'integer', minimum: 1 },
            extendSeconds: { type: 'integer', minimum: 1 },
            maxExtensions: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
            },
          },
        },
      },
    },
    async (req, reply) => {
      const body = req.body as any;
      const id = Number((req.params as any).id);
      if (!Number.isFinite(id)) return replyError(reply, ErrorCodes.INVALID_PRODUCT_ID, '无效的商品 ID', 400);
      const data = await productService.updateRules(req.auth.userId, id, body);
      return replySuccess(reply, data);
    },
  );

  app.put(
    '/api/products/:id/status',
    {
      schema: {
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['pending', 'listed', 'active', 'ended', 'unsold', 'deleted'] },
          },
        },
      },
    },
    async (req, reply) => {
      const body = req.body as any;
      const id = Number((req.params as any).id);
      if (!Number.isFinite(id)) return replyError(reply, ErrorCodes.INVALID_PRODUCT_ID, '无效的商品 ID', 400);
      const data = await productService.updateStatus(req.auth.userId, id, body.status);
      return replySuccess(reply, data);
    },
  );
}
