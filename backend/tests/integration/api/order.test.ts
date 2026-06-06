import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestApp, teardownTestApp } from '../setup';
import { truncateAll, seedUser, seedProduct, seedRoom, seedAuctionSession, seedOrder, authHeader } from '../../helpers/factory';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await setupTestApp();
});

afterAll(async () => {
  await teardownTestApp(app);
});

beforeEach(async () => {
  await truncateAll();
});

// ---------------------------------------------------------------------------
// 辅助：完整创建一个订单（需要 用户 + 商户 + 商品 + 竞拍会话 + 订单）
// ---------------------------------------------------------------------------

interface OrderSeedContext {
  merchantId: number;
  buyerId: number;
  productId: number;
  roomId: number;
  sessionId: number;
  orderId: number;
}

async function seedOrderContext(orderStatus = 'pending_payment'): Promise<OrderSeedContext> {
  const merchant = await seedUser({ username: `o_m_${Date.now()}`, role: 'merchant' });
  const buyer = await seedUser({ username: `o_b_${Date.now()}`, role: 'user' });
  const { productId, ruleId } = await seedProduct(merchant.id, { status: 'listed' });
  const roomId = await seedRoom(merchant.id);
  const { sessionId } = await seedAuctionSession({ productId, ruleId, roomId, status: 'ended' });
  const orderId = await seedOrder({ sessionId, buyerId: buyer.id, productId, finalPrice: 200, status: orderStatus });

  return { merchantId: merchant.id, buyerId: buyer.id, productId, roomId, sessionId, orderId };
}

// ---------------------------------------------------------------------------
// GET /api/orders
// ---------------------------------------------------------------------------

describe('GET /api/orders', () => {
  test('买家查看订单列表', async () => {
    const ctx = await seedOrderContext();
    const buyerHeaders = authHeader(ctx.buyerId, 'user');

    const response = await app.inject({
      method: 'GET',
      url: '/api/orders',
      headers: buyerHeaders,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.code).toBe(0);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.total).toBe(1);
  });

  test('商户查看订单列表（通过关联商品）', async () => {
    const ctx = await seedOrderContext();
    const merchantHeaders = authHeader(ctx.merchantId, 'merchant');

    const response = await app.inject({
      method: 'GET',
      url: '/api/orders',
      headers: merchantHeaders,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.code).toBe(0);
    expect(body.data.items).toHaveLength(1);
  });

  test('分页参数生效', async () => {
    const merchant = await seedUser({ username: `o_page_m_${Date.now()}`, role: 'merchant' });
    const buyer = await seedUser({ username: `o_page_b_${Date.now()}`, role: 'user' });
    const { productId, ruleId } = await seedProduct(merchant.id, { status: 'listed' });
    const roomId = await seedRoom(merchant.id);

    for (let i = 0; i < 3; i++) {
      const { sessionId: sid } = await seedAuctionSession({ productId, ruleId, roomId, status: 'ended' });
      await seedOrder({ sessionId: sid, buyerId: buyer.id, productId, finalPrice: 100 + i * 10 });
    }

    const buyerHeaders = authHeader(buyer.id, 'user');
    const response = await app.inject({
      method: 'GET',
      url: '/api/orders?page=1&limit=2',
      headers: buyerHeaders,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.items).toHaveLength(2);
    expect(body.data.total).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// GET /api/orders/:id
// ---------------------------------------------------------------------------

describe('GET /api/orders/:id', () => {
  test('返回订单详情', async () => {
    const ctx = await seedOrderContext();
    const buyerHeaders = authHeader(ctx.buyerId, 'user');

    const response = await app.inject({
      method: 'GET',
      url: `/api/orders/${ctx.orderId}`,
      headers: buyerHeaders,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.code).toBe(0);
    expect(body.data.status).toBe('pending_payment');
  });

  test('订单不存在返回 404', async () => {
    const buyer = await seedUser({ username: `o_404_${Date.now()}`, role: 'user' });
    const buyerHeaders = authHeader(buyer.id, 'user');

    const response = await app.inject({
      method: 'GET',
      url: '/api/orders/999999',
      headers: buyerHeaders,
    });

    expect(response.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/orders/:id/pay  (模拟支付)
// ---------------------------------------------------------------------------

describe('POST /api/orders/:id/pay', () => {
  test('支付待付款订单成功', async () => {
    const ctx = await seedOrderContext('pending_payment');
    const buyerHeaders = authHeader(ctx.buyerId, 'user');

    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ctx.orderId}/pay`,
      headers: buyerHeaders,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.code).toBe(0);
    expect(body.data.status).toBe('completed');
    expect(body.data.transactionId).toBeDefined();
    expect(body.data.paymentMethod).toBe('mock');
  });

  test('已支付订单重复支付返回 409', async () => {
    const ctx = await seedOrderContext('pending_payment');
    const buyerHeaders = authHeader(ctx.buyerId, 'user');

    // First pay
    await app.inject({
      method: 'POST',
      url: `/api/orders/${ctx.orderId}/pay`,
      headers: buyerHeaders,
    });

    // Second pay
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ctx.orderId}/pay`,
      headers: buyerHeaders,
    });

    expect(response.statusCode).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// 支付后状态变更验证
// ---------------------------------------------------------------------------

describe('支付后状态变更', () => {
  test('支付后查询订单状态为 completed', async () => {
    const ctx = await seedOrderContext('pending_payment');
    const buyerHeaders = authHeader(ctx.buyerId, 'user');

    // Pay the order
    const payResponse = await app.inject({
      method: 'POST',
      url: `/api/orders/${ctx.orderId}/pay`,
      headers: buyerHeaders,
    });
    expect(payResponse.statusCode).toBe(200);

    // Query order detail to confirm status
    const detailResponse = await app.inject({
      method: 'GET',
      url: `/api/orders/${ctx.orderId}`,
      headers: buyerHeaders,
    });

    expect(detailResponse.statusCode).toBe(200);
    const detail = detailResponse.json();
    expect(detail.data.status).toBe('completed');
  });
});
