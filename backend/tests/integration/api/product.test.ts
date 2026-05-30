import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestApp, teardownTestApp } from '../setup';
import { truncateAll, seedUser, seedProduct, authHeader } from '../../helpers/factory';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let merchantToken: Record<string, string>;

beforeAll(async () => {
  app = await setupTestApp();
});

afterAll(async () => {
  await teardownTestApp(app);
});

beforeEach(async () => {
  await truncateAll();
  const merchant = await seedUser({ username: 'merchant1', role: 'merchant' });
  merchantToken = authHeader(merchant.id, 'merchant');
});

// ---------------------------------------------------------------------------
// POST /api/products
// ---------------------------------------------------------------------------

describe('POST /api/products', () => {
  test('商户创建商品成功', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: merchantToken,
      payload: {
        name: 'Test Product',
        description: 'A test product',
        rule: {
          startPrice: 100,
          bidIncrement: 10,
          durationSeconds: 300,
          extendSeconds: 30,
          maxExtensions: 5,
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.code).toBe(0);
    expect(body.data.productId).toBeDefined();
    expect(body.data.ruleId).toBeDefined();
    expect(body.data.status).toBe('pending');
  });

  test('非商户角色返回 403', async () => {
    const normalUser = await seedUser({ username: 'user1', role: 'user' });
    const userHeaders = authHeader(normalUser.id, 'user');

    const response = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: userHeaders,
      payload: {
        name: 'Blocked',
        rule: {
          startPrice: 100,
          bidIncrement: 10,
          durationSeconds: 300,
          extendSeconds: 30,
        },
      },
    });

    expect(response.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/products
// ---------------------------------------------------------------------------

describe('GET /api/products', () => {
  test('返回商户的商品列表', async () => {
    const merchant = await seedUser({ username: 'm_list', role: 'merchant' });
    const headers = authHeader(merchant.id, 'merchant');
    await seedProduct(merchant.id, { name: 'Prod A' });
    await seedProduct(merchant.id, { name: 'Prod B' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.code).toBe(0);
    expect(body.data.items).toHaveLength(2);
    expect(body.data.total).toBe(2);
  });

  test('分页参数生效', async () => {
    const merchant = await seedUser({ username: 'm_page', role: 'merchant' });
    const headers = authHeader(merchant.id, 'merchant');
    for (let i = 0; i < 5; i++) {
      await seedProduct(merchant.id, { name: `PageProd_${i}` });
    }

    const response = await app.inject({
      method: 'GET',
      url: '/api/products?page=1&limit=2',
      headers,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.items).toHaveLength(2);
    expect(body.data.total).toBe(5);
    expect(body.data.page).toBe(1);
    expect(body.data.limit).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/products/:id
// ---------------------------------------------------------------------------

describe('GET /api/products/:id', () => {
  test('返回商品详情含竞拍规则', async () => {
    const merchant = await seedUser({ username: 'm_detail', role: 'merchant' });
    const headers = authHeader(merchant.id, 'merchant');
    const { productId } = await seedProduct(merchant.id, { name: 'DetailProd' });

    const response = await app.inject({
      method: 'GET',
      url: `/api/products/${productId}`,
      headers,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.code).toBe(0);
    expect(body.data.name).toBe('DetailProd');
    expect(body.data.rule).toBeDefined();
    expect(body.data.rule.startPrice).toBe(100);
  });

  test('商品不存在返回 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/products/999999',
      headers: merchantToken,
    });

    expect(response.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/products/:id/rules  (对应任务中的 PUT /api/products/:id)
// ---------------------------------------------------------------------------

describe('PUT /api/products/:id/rules', () => {
  test('商户更新自家商品规则成功', async () => {
    const merchant = await seedUser({ username: 'm_rules', role: 'merchant' });
    const headers = authHeader(merchant.id, 'merchant');
    const { productId } = await seedProduct(merchant.id, { name: 'UpdateMe' });

    const response = await app.inject({
      method: 'PUT',
      url: `/api/products/${productId}/rules`,
      headers,
      payload: { bidIncrement: 20, durationSeconds: 600 },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.code).toBe(0);
  });

  test('非 owner 商户更新规则返回 403', async () => {
    const owner = await seedUser({ username: 'm_owner', role: 'merchant' });
    const other = await seedUser({ username: 'm_other', role: 'merchant' });
    const otherHeaders = authHeader(other.id, 'merchant');
    const { productId } = await seedProduct(owner.id, { name: 'NotYours' });

    const response = await app.inject({
      method: 'PUT',
      url: `/api/products/${productId}/rules`,
      headers: otherHeaders,
      payload: { bidIncrement: 20 },
    });

    expect(response.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/products/:id/status  (对应任务中的 DELETE /api/products/:id)
// ---------------------------------------------------------------------------

describe('PUT /api/products/:id/status', () => {
  test('商户将商品状态从 pending 改为 listed', async () => {
    const merchant = await seedUser({ username: 'm_status', role: 'merchant' });
    const headers = authHeader(merchant.id, 'merchant');
    const { productId } = await seedProduct(merchant.id, { name: 'StatusMe', status: 'pending' });

    const response = await app.inject({
      method: 'PUT',
      url: `/api/products/${productId}/status`,
      headers,
      payload: { status: 'listed' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.code).toBe(0);
    expect(body.data.status).toBe('listed');
  });

  test('商户删除自家商品（pending -> deleted）', async () => {
    const merchant = await seedUser({ username: 'm_del', role: 'merchant' });
    const headers = authHeader(merchant.id, 'merchant');
    const { productId } = await seedProduct(merchant.id, { name: 'DeleteMe', status: 'pending' });

    const response = await app.inject({
      method: 'PUT',
      url: `/api/products/${productId}/status`,
      headers,
      payload: { status: 'deleted' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.status).toBe('deleted');
  });

  test('非 owner 商户拒绝更新状态', async () => {
    const owner = await seedUser({ username: 'm_own2', role: 'merchant' });
    const other = await seedUser({ username: 'm_oth2', role: 'merchant' });
    const otherHeaders = authHeader(other.id, 'merchant');
    const { productId } = await seedProduct(owner.id, { name: 'CantTouch', status: 'pending' });

    const response = await app.inject({
      method: 'PUT',
      url: `/api/products/${productId}/status`,
      headers: otherHeaders,
      payload: { status: 'listed' },
    });

    expect(response.statusCode).toBe(403);
  });

  test('非法状态转换返回 409', async () => {
    const merchant = await seedUser({ username: 'm_bad', role: 'merchant' });
    const headers = authHeader(merchant.id, 'merchant');
    const { productId } = await seedProduct(merchant.id, { name: 'BadTrans', status: 'pending' });

    const response = await app.inject({
      method: 'PUT',
      url: `/api/products/${productId}/status`,
      headers,
      payload: { status: 'ended' },
    });

    expect(response.statusCode).toBe(409);
  });
});
