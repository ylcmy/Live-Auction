import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestApp, teardownTestApp } from '../setup';
import { truncateAll, seedUser, seedProduct, seedRoom, seedAuctionSession, seedActiveAuction, authHeader } from '../../helpers/factory';
import { initializeDefaultAuctionService } from '../../../src/services/auction.service';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await setupTestApp();
  // Initialize the auction service singleton so auction routes
  // (which rely on the exported proxy) can call startAuction / cancelAuction.
  initializeDefaultAuctionService(null as any);
});

afterAll(async () => {
  await teardownTestApp(app);
});

beforeEach(async () => {
  await truncateAll();
});

// ---------------------------------------------------------------------------
// POST /api/auctions  (发起竞拍)
// ---------------------------------------------------------------------------

describe('POST /api/auctions', () => {
  test('商户成功发起竞拍', async () => {
    const merchant = await seedUser({ username: 'a_merchant', role: 'merchant' });
    const headers = authHeader(merchant.id, 'merchant');
    const { productId } = await seedProduct(merchant.id, { name: 'AuctionProd', status: 'listed' });
    const roomId = await seedRoom(merchant.id, { title: 'RoomA' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auctions',
      headers,
      payload: { productId, roomId },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.code).toBe(0);
    expect(body.data.sessionId).toBeDefined();
    expect(body.data.status).toBe('active');
  });

  test('商品非 listed 状态时拒绝发起（409）', async () => {
    const merchant = await seedUser({ username: 'a_pending', role: 'merchant' });
    const headers = authHeader(merchant.id, 'merchant');
    // product status = 'pending' (default), not 'listed'
    const { productId } = await seedProduct(merchant.id, { name: 'PendingProd', status: 'pending' });
    const roomId = await seedRoom(merchant.id, { title: 'RoomB' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auctions',
      headers,
      payload: { productId, roomId },
    });

    expect(response.statusCode).toBe(409);
  });

  test('同一直播间重复发起竞拍拒绝（409）', async () => {
    const merchant = await seedUser({ username: 'a_dup', role: 'merchant' });
    const headers = authHeader(merchant.id, 'merchant');
    const { productId: pid1 } = await seedProduct(merchant.id, { name: 'Prod1', status: 'listed' });
    const { productId: pid2 } = await seedProduct(merchant.id, { name: 'Prod2', status: 'listed' });
    const roomId = await seedRoom(merchant.id, { title: 'RoomDup' });

    // First auction starts successfully
    const first = await app.inject({
      method: 'POST',
      url: '/api/auctions',
      headers,
      payload: { productId: pid1, roomId },
    });
    expect(first.statusCode).toBe(201);

    // Second auction in same room should be rejected
    const second = await app.inject({
      method: 'POST',
      url: '/api/auctions',
      headers,
      payload: { productId: pid2, roomId },
    });

    expect(second.statusCode).toBe(409);
  });

  test('非商户角色返回 403', async () => {
    const normalUser = await seedUser({ username: 'a_user', role: 'user' });
    const userHeaders = authHeader(normalUser.id, 'user');
    const merchant = await seedUser({ username: 'a_m2', role: 'merchant' });
    const { productId } = await seedProduct(merchant.id, { status: 'listed' });
    const roomId = await seedRoom(merchant.id);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auctions',
      headers: userHeaders,
      payload: { productId, roomId },
    });

    expect(response.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auctions/:id/cancel  (取消竞拍)
// ---------------------------------------------------------------------------

describe('POST /api/auctions/:id/cancel', () => {
  test('商户取消进行中的竞拍成功', async () => {
    const merchant = await seedUser({ username: 'c_merchant', role: 'merchant' });
    const headers = authHeader(merchant.id, 'merchant');
    const { productId } = await seedProduct(merchant.id, { name: 'CancelProd', status: 'listed' });
    const roomId = await seedRoom(merchant.id, { title: 'RoomCancel' });
    const { sessionId } = await seedActiveAuction({ productId, roomId });

    const response = await app.inject({
      method: 'POST',
      url: `/api/auctions/${sessionId}/cancel`,
      headers,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.code).toBe(0);
    expect(body.data.status).toBe('cancelled');
  });

  test('非 owner 商户取消竞拍返回 403', async () => {
    const owner = await seedUser({ username: 'c_owner', role: 'merchant' });
    const other = await seedUser({ username: 'c_other', role: 'merchant' });
    const otherHeaders = authHeader(other.id, 'merchant');
    const { productId } = await seedProduct(owner.id, { status: 'listed' });
    const roomId = await seedRoom(owner.id);
    const { sessionId } = await seedActiveAuction({ productId, roomId });

    const response = await app.inject({
      method: 'POST',
      url: `/api/auctions/${sessionId}/cancel`,
      headers: otherHeaders,
    });

    expect(response.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 状态流转验证
// ---------------------------------------------------------------------------

describe('状态流转验证', () => {
  test('已结束的竞拍无法再次取消（409）', async () => {
    const merchant = await seedUser({ username: 's_merchant', role: 'merchant' });
    const headers = authHeader(merchant.id, 'merchant');
    const { productId, ruleId } = await seedProduct(merchant.id, { status: 'listed' });
    const roomId = await seedRoom(merchant.id);
    const { sessionId } = await seedAuctionSession({ productId, ruleId, roomId, status: 'ended' });

    const response = await app.inject({
      method: 'POST',
      url: `/api/auctions/${sessionId}/cancel`,
      headers,
    });

    expect(response.statusCode).toBe(409);
  });

  test('已取消的竞拍无法再次取消（409）', async () => {
    const merchant = await seedUser({ username: 's_cancelled', role: 'merchant' });
    const headers = authHeader(merchant.id, 'merchant');
    const { productId, ruleId } = await seedProduct(merchant.id, { status: 'listed' });
    const roomId = await seedRoom(merchant.id);
    const { sessionId } = await seedAuctionSession({ productId, ruleId, roomId, status: 'cancelled' });

    const response = await app.inject({
      method: 'POST',
      url: `/api/auctions/${sessionId}/cancel`,
      headers,
    });

    expect(response.statusCode).toBe(409);
  });

  test('取消竞拍后商品状态恢复为 listed', async () => {
    const merchant = await seedUser({ username: 's_restore', role: 'merchant' });
    const headers = authHeader(merchant.id, 'merchant');
    const { productId } = await seedProduct(merchant.id, { name: 'RestoreProd', status: 'listed' });
    const roomId = await seedRoom(merchant.id);
    const { sessionId } = await seedActiveAuction({ productId, roomId });

    // Cancel the auction
    await app.inject({
      method: 'POST',
      url: `/api/auctions/${sessionId}/cancel`,
      headers,
    });

    // Verify product status is restored to listed
    const productCheck = await app.inject({
      method: 'GET',
      url: `/api/products/${productId}`,
      headers,
    });

    expect(productCheck.statusCode).toBe(200);
    expect(productCheck.json().data.status).toBe('listed');
  });

  test('GET /api/auctions/:id 返回竞拍详情', async () => {
    const merchant = await seedUser({ username: 's_detail', role: 'merchant' });
    const headers = authHeader(merchant.id, 'merchant');
    const { productId, ruleId } = await seedProduct(merchant.id, { status: 'listed' });
    const roomId = await seedRoom(merchant.id);
    const { sessionId } = await seedAuctionSession({ productId, ruleId, roomId, status: 'active', currentPrice: 250 });

    const response = await app.inject({
      method: 'GET',
      url: `/api/auctions/${sessionId}`,
      headers,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.code).toBe(0);
    expect(body.data.status).toBe('active');
    expect(Number(body.data.currentPrice)).toBe(250);
  });

  test('GET /api/auctions/:id 不存在返回 404', async () => {
    const merchant = await seedUser({ username: 's_404', role: 'merchant' });
    const headers = authHeader(merchant.id, 'merchant');

    const response = await app.inject({
      method: 'GET',
      url: '/api/auctions/999999',
      headers,
    });

    expect(response.statusCode).toBe(404);
  });
});
