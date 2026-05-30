import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestApp, teardownTestApp } from '../setup';
import { truncateAll, seedUser, seedProduct, seedRoom, seedAuctionSession, authHeader } from '../../helpers/factory';
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
// GET /api/rooms
// ---------------------------------------------------------------------------

describe('GET /api/rooms', () => {
  test('普通用户查看直播间列表', async () => {
    const merchant = await seedUser({ username: 'r_merchant', role: 'merchant' });
    const buyer = await seedUser({ username: 'r_buyer', role: 'user' });
    const buyerHeaders = authHeader(buyer.id, 'user');

    await seedRoom(merchant.id, { title: 'Room Alpha', status: 'offline' });
    await seedRoom(merchant.id, { title: 'Room Beta', status: 'live' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/rooms',
      headers: buyerHeaders,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.code).toBe(0);
    expect(body.data.items).toHaveLength(2);
    expect(body.data.total).toBe(2);
  });

  test('商户只看到自己的直播间', async () => {
    const merchantA = await seedUser({ username: 'r_ma', role: 'merchant' });
    const merchantB = await seedUser({ username: 'r_mb', role: 'merchant' });
    const headersA = authHeader(merchantA.id, 'merchant');

    await seedRoom(merchantA.id, { title: 'My Room' });
    await seedRoom(merchantB.id, { title: 'Other Room' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/rooms',
      headers: headersA,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].title).toBe('My Room');
  });

  test('分页参数生效', async () => {
    const merchant = await seedUser({ username: 'r_page', role: 'merchant' });
    const buyer = await seedUser({ username: 'r_page_buyer', role: 'user' });
    const buyerHeaders = authHeader(buyer.id, 'user');

    for (let i = 0; i < 3; i++) {
      await seedRoom(merchant.id, { title: `Room ${i}` });
    }

    const response = await app.inject({
      method: 'GET',
      url: '/api/rooms?page=1&limit=2',
      headers: buyerHeaders,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.items).toHaveLength(2);
    expect(body.data.total).toBe(3);
    expect(body.data.page).toBe(1);
    expect(body.data.limit).toBe(2);
  });

  test('直播间列表项包含 currentAuction 字段', async () => {
    const merchant = await seedUser({ username: 'r_auction', role: 'merchant' });
    const buyer = await seedUser({ username: 'r_auction_buyer', role: 'user' });
    const buyerHeaders = authHeader(buyer.id, 'user');

    const { productId, ruleId } = await seedProduct(merchant.id, { status: 'listed' });
    const roomId = await seedRoom(merchant.id, { title: 'Active Room', status: 'live' });
    await seedAuctionSession({ productId, ruleId, roomId, status: 'active' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/rooms',
      headers: buyerHeaders,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].currentAuction).toBeDefined();
    expect(body.data.items[0].currentAuction.status).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// GET /api/rooms/:id
// ---------------------------------------------------------------------------

describe('GET /api/rooms/:id', () => {
  test('返回直播间详情含 auctions 列表', async () => {
    const merchant = await seedUser({ username: 'r_detail', role: 'merchant' });
    const buyer = await seedUser({ username: 'r_detail_buyer', role: 'user' });
    const buyerHeaders = authHeader(buyer.id, 'user');

    const roomId = await seedRoom(merchant.id, { title: 'Detail Room' });

    // Seed products (listed status will appear in auction list)
    const { productId: pid1, ruleId: rid1 } = await seedProduct(merchant.id, { name: 'Product A', status: 'listed' });
    const { productId: pid2, ruleId: rid2 } = await seedProduct(merchant.id, { name: 'Product B', status: 'listed' });
    await seedAuctionSession({ productId: pid1, ruleId: rid1, roomId, status: 'active', currentPrice: 300 });

    const response = await app.inject({
      method: 'GET',
      url: `/api/rooms/${roomId}`,
      headers: buyerHeaders,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.code).toBe(0);
    expect(body.data.title).toBe('Detail Room');
    expect(body.data.auctions).toBeDefined();
    expect(Array.isArray(body.data.auctions)).toBe(true);
    // Both products should appear in auctions list
    expect(body.data.auctions.length).toBeGreaterThanOrEqual(2);
  });

  test('详情中的 currentAuction 为进行中的竞拍', async () => {
    const merchant = await seedUser({ username: 'r_current', role: 'merchant' });
    const buyer = await seedUser({ username: 'r_current_buyer', role: 'user' });
    const buyerHeaders = authHeader(buyer.id, 'user');

    const roomId = await seedRoom(merchant.id, { title: 'Current Room', status: 'live' });
    const { productId, ruleId } = await seedProduct(merchant.id, { status: 'listed' });
    await seedAuctionSession({ productId, ruleId, roomId, status: 'active', currentPrice: 500 });

    const response = await app.inject({
      method: 'GET',
      url: `/api/rooms/${roomId}`,
      headers: buyerHeaders,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.currentAuction).not.toBeNull();
    expect(body.data.currentAuction.status).toBe('active');
    expect(Number(body.data.currentAuction.currentPrice)).toBe(500);
  });

  test('无进行中竞拍时 currentAuction 为 null', async () => {
    const merchant = await seedUser({ username: 'r_noactive', role: 'merchant' });
    const buyer = await seedUser({ username: 'r_noactive_buyer', role: 'user' });
    const buyerHeaders = authHeader(buyer.id, 'user');

    const roomId = await seedRoom(merchant.id, { title: 'Empty Room' });

    const response = await app.inject({
      method: 'GET',
      url: `/api/rooms/${roomId}`,
      headers: buyerHeaders,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.currentAuction).toBeNull();
  });

  test('直播间不存在返回 404', async () => {
    const buyer = await seedUser({ username: 'r_404', role: 'user' });
    const buyerHeaders = authHeader(buyer.id, 'user');

    const response = await app.inject({
      method: 'GET',
      url: '/api/rooms/999999',
      headers: buyerHeaders,
    });

    expect(response.statusCode).toBe(404);
  });
});
