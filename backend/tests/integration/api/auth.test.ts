import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestApp, teardownTestApp } from '../setup';
import { truncateAll, seedUser, authHeader } from '../../helpers/factory';
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
// POST /api/auth/register
// ---------------------------------------------------------------------------

describe('POST /api/auth/register', () => {
  test('成功注册新用户', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'newuser',
        password: 'Pass123456',
        nickname: 'NewUser',
        role: 'user',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.code).toBe(0);
    expect(body.data).toMatchObject({
      username: 'newuser',
      role: 'user',
    });
    expect(body.data.userId).toBeDefined();
  });

  test('重复用户名返回 409', async () => {
    // 先通过注册端点创建用户，确保用户名存在
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'existing',
        password: 'Pass123456',
        nickname: 'Existing',
        role: 'user',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'existing',
        password: 'Pass123456',
        nickname: 'Dup',
        role: 'user',
      },
    });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.code).toBe(40900);
    expect(body.message).toContain('已存在');
  });

  test('缺少必填字段返回 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'incomplete' },
    });

    expect(response.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

describe('POST /api/auth/login', () => {
  test('正确的用户名和密码登录成功', async () => {
    // 通过注册端点创建用户，确保密码经过 bcrypt 哈希
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'logintest',
        password: 'Correct123',
        nickname: 'LoginTest',
        role: 'user',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'logintest', password: 'Correct123' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.code).toBe(0);
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.refreshToken).toBeDefined();
    expect(typeof body.data.accessToken).toBe('string');
  });

  test('密码错误返回 401', async () => {
    // 通过注册端点创建用户，确保密码经过 bcrypt 哈希
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'wrongpwd',
        password: 'Correct123',
        nickname: 'WrongPwd',
        role: 'user',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'wrongpwd', password: 'WrongPwd1' },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.code).toBe(40100);
    expect(body.message).toContain('用户名或密码错误');
  });

  test('不存在的用户名返回 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'nonexistent', password: 'AnyPass123' },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.code).toBe(40100);
    expect(body.message).toContain('用户名或密码错误');
  });
});

// ---------------------------------------------------------------------------
// GET /api/users/me  (对应任务 T062 中的 auth/me 场景)
// ---------------------------------------------------------------------------

describe('GET /api/users/me', () => {
  test('有效令牌返回用户信息', async () => {
    const user = await seedUser({ username: 'meuser', role: 'user', nickname: 'MeNick' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: authHeader(user.id, user.role),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.code).toBe(0);
    expect(body.data.username).toBe('meuser');
    expect(body.data.nickname).toBe('MeNick');
    expect(body.data.passwordHash ?? body.data.password_hash).toBeUndefined();
  });

  test('过期令牌返回 401', async () => {
    const jwt = await import('jsonwebtoken');
    const user = await seedUser({ username: 'expireduser' });
    const expiredToken = jwt.default.sign(
      { userId: user.id, role: 'user' },
      process.env.JWT_SECRET || 'dev-secret-change-in-production',
      { expiresIn: '-1s' },
    );

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { Authorization: `Bearer ${expiredToken}` },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.code).toBe(40100);
    expect(body.message).toContain('令牌无效或已过期');
  });

  test('缺失令牌返回 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.code).toBe(40100);
  });
});
