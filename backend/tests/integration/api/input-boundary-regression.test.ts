/**
 * T065: Input boundary regression tests (FR-028).
 *
 * Covers empty values, SQL/NoSQL injection tokens, missing auth,
 * and cross-role access against real Fastify routes.
 *
 * Uses real DB via integration setup — no mocks.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import type { FastifyInstance } from 'fastify';

import { setupTestApp, teardownTestApp } from '../setup.js';
import {
  truncateAll,
  seedUser,
  seedProduct,
  seedRoom,
  seedActiveAuction,
  generateToken,
  authHeader,
} from '../../helpers/factory.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let app: FastifyInstance;
let merchantUser: { id: number; token: string };
let normalUser: { id: number; token: string };

beforeAll(async () => {
  app = await setupTestApp();
  await app.ready();
});

afterAll(async () => {
  await teardownTestApp(app);
});

beforeEach(async () => {
  await truncateAll();

  const m = await seedUser({ username: 'boundary_merchant', role: 'merchant' });
  merchantUser = { id: m.id, token: generateToken(m.id, 'merchant') };

  const u = await seedUser({ username: 'boundary_user', role: 'user' });
  normalUser = { id: u.id, token: generateToken(u.id, 'user') };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('T065: 空值与缺失字段回归测试 (FR-028)', () => {
  it('POST /api/auth/register 缺少 body 应返回 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/auth/register username 为空字符串', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: '', password: '123456', nickname: 'test', role: 'user' },
    });
    // Fastify schema validation rejects minLength: 3
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/auth/register password 长度不足', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'shortpwd', password: '123', nickname: 'test', role: 'user' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/auth/register role 非法值', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'badrole', password: '123456', nickname: 'test', role: 'admin' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/auth/login 空 body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('T065: SQL 注入防护回归测试 (FR-028)', () => {
  it('POST /api/auth/login SQL 注入 username 不应导致 500', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: "' OR 1=1 --", password: 'anything' },
    });
    // Must not return 500 (server error); should be 401 or similar business error
    expect(res.statusCode).toBeLessThan(500);
  });

  it('POST /api/auth/register SQL 注入 nickname 不应导致 500', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: `inject_${Date.now()}`,
        password: '123456',
        nickname: "'; DROP TABLE users; --",
        role: 'user',
      },
    });
    expect(res.statusCode).toBeLessThan(500);
  });

  it('GET /api/auctions/:id 注入路径参数应安全处理', async () => {
    const res = await app.inject({
      method: 'GET',
      url: "/api/auctions/1' OR '1'='1",
      headers: authHeader(normalUser.id, 'user'),
    });
    // Should not crash with 500
    expect(res.statusCode).toBeLessThan(500);
  });

  it('GET /api/rooms/:id 注入路径参数应安全处理', async () => {
    const res = await app.inject({
      method: 'GET',
      url: "/api/rooms/1' UNION SELECT * FROM users--",
      headers: authHeader(normalUser.id, 'user'),
    });
    expect(res.statusCode).toBeLessThan(500);
  });
});

describe('T065: Token 与认证边界回归测试 (FR-028)', () => {
  it('无 Authorization header 应返回 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auctions',
    });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe(40100);
  });

  it('Bearer 前缀缺失应返回 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auctions',
      headers: { Authorization: merchantUser.token },
    });
    expect(res.statusCode).toBe(401);
  });

  it('伪造 JWT token 应返回 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auctions',
      headers: { Authorization: 'Bearer fake.jwt.token' },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe(40100);
  });

  it('过期 JWT token 应返回 401', async () => {
    const jwt = await import('jsonwebtoken');
    const expiredToken = jwt.default.sign(
      { userId: merchantUser.id, role: 'merchant' },
      process.env.JWT_SECRET || 'dev-secret-change-in-production',
      { expiresIn: '-1h' },
    );
    const res = await app.inject({
      method: 'GET',
      url: '/api/auctions',
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('空 Bearer token 应返回 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auctions',
      headers: { Authorization: 'Bearer ' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('T065: 跨角色访问控制回归测试 (FR-028)', () => {
  let roomId: number;
  let productId: number;

  beforeEach(async () => {
    const { productId: pid } = await seedProduct(merchantUser.id, { name: '边界测试商品' });
    productId = pid;
    roomId = await seedRoom(merchantUser.id, { title: '边界测试间' });
  });

  it('普通用户访问 POST /api/products (merchant-only) 应返回 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: authHeader(normalUser.id, 'user'),
      payload: { name: 'test', rule: { startPrice: 1, bidIncrement: 1, durationSeconds: 60, extendSeconds: 10 } },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe(40300);
  });

  it('普通用户访问 POST /api/rooms (merchant-only) 应返回 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: authHeader(normalUser.id, 'user'),
      payload: { title: 'test room' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('普通用户访问 POST /api/auctions (merchant-only) 应返回 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auctions',
      headers: authHeader(normalUser.id, 'user'),
      payload: { productId, roomId },
    });
    expect(res.statusCode).toBe(403);
  });

  it('商家访问自己的商品列表应成功', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers: authHeader(merchantUser.id, 'merchant'),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.code).toBe(0);
  });

  it('普通用户无法取消他人的竞拍', async () => {
    const { sessionId } = await seedActiveAuction({ productId, roomId });
    const res = await app.inject({
      method: 'POST',
      url: `/api/auctions/${sessionId}/cancel`,
      headers: authHeader(normalUser.id, 'user'),
    });
    // user cannot access merchant-only route
    expect(res.statusCode).toBe(403);
  });

  it('不同商家无法取消他人的竞拍', async () => {
    const otherMerchant = await seedUser({ username: 'other_merchant', role: 'merchant' });
    const { sessionId } = await seedActiveAuction({ productId, roomId });
    const res = await app.inject({
      method: 'POST',
      url: `/api/auctions/${sessionId}/cancel`,
      headers: authHeader(otherMerchant.id, 'merchant'),
    });
    // Should fail with 403 or business error (not the host)
    expect([403, 409]).toContain(res.statusCode);
  });
});
