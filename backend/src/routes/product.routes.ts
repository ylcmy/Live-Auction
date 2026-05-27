import { FastifyInstance } from 'fastify';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { productService } from '../services/product.service.js';
import { replySuccess } from '../lib/reply.js';

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
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 20,
    });
    return replySuccess(reply, data);
  });

  app.get('/api/products/:id', async (req, reply) => {
    const data = await productService.getProductById(
      Number((req.params as any).id),
    );
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
      const data = await productService.updateRules(
        req.auth.userId,
        Number((req.params as any).id),
        body,
      );
      return replySuccess(reply, data);
    },
  );
}
