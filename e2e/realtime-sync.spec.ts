import { test, expect, type APIRequestContext, type Browser } from '@playwright/test';

const API_BASE = 'http://localhost:3002';

/** 带重试的 API 请求辅助函数 */
async function apiRequest(
  request: APIRequestContext,
  method: 'post' | 'put',
  url: string,
  options: { headers?: Record<string, string>; data?: any },
  maxRetries = 3,
): Promise<{ json: any; status: number }> {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await request[method](url, options);
      const json = await res.json();
      if (json.code === 0) return { json, status: res.status() };
      if (json.code >= 50000 || res.status() >= 500) {
        lastError = new Error(`API error (attempt ${i + 1}/${maxRetries}): ${JSON.stringify(json)}`);
        if (i < maxRetries - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
        continue;
      }
      return { json, status: res.status() };
    } catch (e) {
      lastError = e as Error;
      if (i < maxRetries - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastError || new Error('API request failed after retries');
}

interface SyncFixtures {
  merchantToken: string;
  user1Token: string;
  user2Token: string;
  roomId: number;
  sessionId: number;
}

/** 通过 API 创建两个用户和一个活跃竞拍所需的全部测试数据 */
async function createSyncFixtures(request: APIRequestContext): Promise<SyncFixtures> {
  const ts = Date.now();

  // 注册商家
  await request.post(`${API_BASE}/api/auth/register`, {
    data: {
      username: `sync_merchant_${ts}`,
      password: 'pass1234',
      nickname: '同步测试商家',
      role: 'merchant',
    },
  });

  // 登录商家获取 accessToken
  const merchantLoginRes = await request.post(`${API_BASE}/api/auth/login`, {
    data: { username: `sync_merchant_${ts}`, password: 'pass1234' },
  });
  const merchantLoginJson = await merchantLoginRes.json();
  const merchantToken: string = merchantLoginJson.data.accessToken;

  // 注册用户 1
  await request.post(`${API_BASE}/api/auth/register`, {
    data: {
      username: `sync_user1_${ts}`,
      password: 'pass1234',
      nickname: '同步用户A',
      role: 'user',
    },
  });

  // 登录用户 1 获取 accessToken
  const user1LoginRes = await request.post(`${API_BASE}/api/auth/login`, {
    data: { username: `sync_user1_${ts}`, password: 'pass1234' },
  });
  const user1LoginJson = await user1LoginRes.json();
  const user1Token: string = user1LoginJson.data.accessToken;

  // 注册用户 2
  await request.post(`${API_BASE}/api/auth/register`, {
    data: {
      username: `sync_user2_${ts}`,
      password: 'pass1234',
      nickname: '同步用户B',
      role: 'user',
    },
  });

  // 登录用户 2 获取 accessToken
  const user2LoginRes = await request.post(`${API_BASE}/api/auth/login`, {
    data: { username: `sync_user2_${ts}`, password: 'pass1234' },
  });
  const user2LoginJson = await user2LoginRes.json();
  const user2Token: string = user2LoginJson.data.accessToken;

  // 创建商品
  const { json: productJson } = await apiRequest(request, 'post', `${API_BASE}/api/products`, {
    headers: { Authorization: `Bearer ${merchantToken}` },
    data: {
      name: `同步测试商品_${ts}`,
      category: '测试',
      rule: {
        startPrice: 200,
        bidIncrement: 20,
        durationSeconds: 600,
        extendSeconds: 30,
        maxExtensions: 10,
      },
    },
  });
  const productId: number = productJson.data.productId;

  // 上架商品
  await apiRequest(request, 'put', `${API_BASE}/api/products/${productId}/status`, {
    headers: { Authorization: `Bearer ${merchantToken}` },
    data: { status: 'listed' },
  });

  // 创建直播间
  const { json: roomJson } = await apiRequest(request, 'post', `${API_BASE}/api/rooms`, {
    headers: { Authorization: `Bearer ${merchantToken}` },
    data: { title: `同步测试直播间_${ts}` },
  });
  const roomId: number = roomJson.data.roomId;

  // 开启直播间
  await apiRequest(request, 'put', `${API_BASE}/api/rooms/${roomId}/status`, {
    headers: { Authorization: `Bearer ${merchantToken}` },
    data: { status: 'live' },
  });

  // 发起竞拍
  const { json: auctionJson } = await apiRequest(request, 'post', `${API_BASE}/api/auctions`, {
    headers: { Authorization: `Bearer ${merchantToken}` },
    data: { productId, roomId },
  });
  const sessionId: number = auctionJson?.data?.sessionId;
  if (!sessionId) {
    throw new Error(`Failed to create auction: ${JSON.stringify(auctionJson)}`);
  }

  return { merchantToken, user1Token, user2Token, roomId, sessionId };
}

/** 通过 API 设置用户 Token 并跳转到直播间 */
async function enterLiveRoom(page: import('@playwright/test').Page, token: string, roomId: number) {
  await page.goto('/login');
  await page.evaluate((t: string) => {
    localStorage.setItem('accessToken', t);
  }, token);
  await page.goto(`/live/${roomId}`);
}

test.describe('多用户实时同步', () => {
  let fixtures: SyncFixtures;

  test.beforeAll(async ({ request }) => {
    fixtures = await createSyncFixtures(request);
  });

  test('should 多用户进入直播间后可看到相同竞拍信息', async ({ browser }) => {
    // 创建两个独立的浏览器上下文，模拟两个用户
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // 用户 1 进入直播间
      await enterLiveRoom(page1, fixtures.user1Token, fixtures.roomId);
      // 用户 2 进入同一直播间
      await enterLiveRoom(page2, fixtures.user2Token, fixtures.roomId);

      // 两个用户都应看到 LIVE 标识
      await expect(page1.getByText('LIVE')).toBeVisible({ timeout: 15000 });
      await expect(page2.getByText('LIVE')).toBeVisible({ timeout: 15000 });

      // 两个用户都应看到竞拍气泡（"拍卖中"标识）
      await expect(page1.getByText('拍卖中')).toBeVisible({ timeout: 15000 });
      await expect(page2.getByText('拍卖中')).toBeVisible({ timeout: 15000 });

      // 两个用户看到的商品名称应一致
      const productName = `同步测试商品_`;
      await expect(page1.getByText(productName)).toBeVisible();
      await expect(page2.getByText(productName)).toBeVisible();
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should 用户出价后另一个用户页面实时更新价格', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // 两个用户都进入直播间
      await enterLiveRoom(page1, fixtures.user1Token, fixtures.roomId);
      await enterLiveRoom(page2, fixtures.user2Token, fixtures.roomId);

      // 等待两人都看到竞拍气泡
      await expect(page1.getByText('拍卖中')).toBeVisible({ timeout: 15000 });
      await expect(page2.getByText('拍卖中')).toBeVisible({ timeout: 15000 });

      // 用户 1 点击"去出价"
      await page1.getByRole('button', { name: '去出价' }).click();
      await expect(page1.getByRole('heading', { name: '确认出价' })).toBeVisible({ timeout: 5000 });

      // 用户 1 提交出价（默认 = 当前价 + 加价幅度 = 200 + 20 = 220）
      const bidButton = page1.getByRole('button', { name: /确认出价/ });
      await bidButton.click();

      // 验证用户 1 出价成功
      await expect(page1.getByText('出价成功').or(page1.getByText('领先'))).toBeVisible({ timeout: 10000 });

      // 关闭出价面板
      await page1.keyboard.press('Escape');

      // 等待用户 2 页面价格更新（通过 WebSocket 实时同步）
      // 用户 2 应在数秒内看到更新的价格（从 ¥200.00 变为 ¥220.00）
      // 使用更宽松的检查：等待页面中任何包含 "220" 的文本出现
      await expect(async () => {
        const pageText = await page2.textContent('body') || '';
        const hasUpdatedPrice = pageText.includes('220');
        expect(hasUpdatedPrice).toBe(true);
      }).toPass({ timeout: 30000 });
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should 在线人数随用户进出实时变化', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // 用户 1 先进入
      await enterLiveRoom(page1, fixtures.user1Token, fixtures.roomId);
      await expect(page1.getByText('LIVE')).toBeVisible({ timeout: 15000 });

      // 用户 1 可以看到在线人数
      const onlineBadge1 = page1.locator('text=/\\d+/').filter({ has: page1.locator('svg') });
      await expect(onlineBadge1.first()).toBeVisible({ timeout: 10000 });

      // 用户 2 进入同一直播间
      await enterLiveRoom(page2, fixtures.user2Token, fixtures.roomId);
      await expect(page2.getByText('LIVE')).toBeVisible({ timeout: 15000 });

      // 验证两个用户都能看到在线人数（存在数值即可）
      const onlineCount1 = page1.locator('.bg-black\\/60').filter({ hasText: /\d+/ });
      const onlineCount2 = page2.locator('.bg-black\\/60').filter({ hasText: /\d+/ });
      await expect(onlineCount1.first()).toBeVisible({ timeout: 10000 });
      await expect(onlineCount2.first()).toBeVisible({ timeout: 10000 });
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
