import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

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

interface RecoveryFixtures {
  merchantToken: string;
  userToken: string;
  roomId: number;
  sessionId: number;
}

/** 创建用于网络恢复测试的测试数据 */
async function createRecoveryFixtures(request: APIRequestContext): Promise<RecoveryFixtures> {
  const ts = Date.now();

  // 注册商家
  await request.post(`${API_BASE}/api/auth/register`, {
    data: {
      username: `net_merchant_${ts}`,
      password: 'pass1234',
      nickname: '网络测试商家',
      role: 'merchant',
    },
  });

  // 登录商家获取 accessToken
  const merchantLoginRes = await request.post(`${API_BASE}/api/auth/login`, {
    data: { username: `net_merchant_${ts}`, password: 'pass1234' },
  });
  const merchantLoginJson = await merchantLoginRes.json();
  const merchantToken: string = merchantLoginJson.data.accessToken;

  // 注册用户
  await request.post(`${API_BASE}/api/auth/register`, {
    data: {
      username: `net_user_${ts}`,
      password: 'pass1234',
      nickname: '网络测试用户',
      role: 'user',
    },
  });

  // 登录用户获取 accessToken
  const userLoginRes = await request.post(`${API_BASE}/api/auth/login`, {
    data: { username: `net_user_${ts}`, password: 'pass1234' },
  });
  const userLoginJson = await userLoginRes.json();
  const userToken: string = userLoginJson.data.accessToken;

  // 创建并上架商品
  const { json: productJson } = await apiRequest(request, 'post', `${API_BASE}/api/products`, {
    headers: { Authorization: `Bearer ${merchantToken}` },
    data: {
      name: `网络测试商品_${ts}`,
      category: '测试',
      rule: {
        startPrice: 300,
        bidIncrement: 30,
        durationSeconds: 600,
        extendSeconds: 30,
        maxExtensions: 5,
      },
    },
  });
  const productId: number = productJson.data.productId;

  await apiRequest(request, 'put', `${API_BASE}/api/products/${productId}/status`, {
    headers: { Authorization: `Bearer ${merchantToken}` },
    data: { status: 'listed' },
  });

  // 创建并开启直播间
  const { json: roomJson } = await apiRequest(request, 'post', `${API_BASE}/api/rooms`, {
    headers: { Authorization: `Bearer ${merchantToken}` },
    data: { title: `网络测试间_${ts}` },
  });
  const roomId: number = roomJson.data.roomId;

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
    throw new Error(`Failed to create auction for network recovery: ${JSON.stringify(auctionJson)}`);
  }

  return { merchantToken, userToken, roomId, sessionId };
}

/** 通过 API 设置 Token 并导航至直播间 */
async function enterRoom(page: Page, token: string, roomId: number) {
  await page.goto('/login');
  await page.evaluate((t: string) => {
    localStorage.setItem('accessToken', t);
  }, token);
  await page.goto(`/live/${roomId}`);
}

test.describe('网络异常恢复', () => {
  let fixtures: RecoveryFixtures;

  test.beforeAll(async ({ request }) => {
    fixtures = await createRecoveryFixtures(request);
  });

  test('should 直播间正常建立 WebSocket 连接', async ({ page }) => {
    // 设置较小的视口以确保移动端重连横幅可显示（md:hidden）
    await page.setViewportSize({ width: 375, height: 812 });

    await enterRoom(page, fixtures.userToken, fixtures.roomId);

    // 等待 LIVE 标识出现，说明页面已正常加载
    await expect(page.getByText('LIVE')).toBeVisible({ timeout: 15000 });

    // 通过 page.evaluate 检查 WebSocket 是否已连接
    const isConnected = await page.evaluate(() => {
      // Socket.IO 客户端通常挂在全局或 window 上
      // 通过检查 io 命名空间的连接状态来判断
      // 如果 socket 实例不可直接访问，我们检查页面中是否有断连提示
      const reconnectBanner = document.querySelector('[class*="warning"]');
      const offlineText = document.querySelector('[class*="bg-warning"]');
      return !reconnectBanner && !offlineText;
    });

    // 不应出现断连提示
    expect(isConnected).toBe(true);
  });

  test('should 网络中断后显示重连提示', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await enterRoom(page, fixtures.userToken, fixtures.roomId);

    // 等待正常连接
    await expect(page.getByText('LIVE')).toBeVisible({ timeout: 15000 });

    // 模拟网络中断：使用 setOffline 真正断开网络（包括 WebSocket）
    await page.context().setOffline(true);

    // 等待断连状态出现（useWebSocket 的 isReconnecting 为 true）
    // 重连横幅文本: "网络断开，正在重连..."
    await expect(page.getByText('网络断开，正在重连')).toBeVisible({ timeout: 15000 });

    // 恢复网络以便后续测试
    await page.context().setOffline(false);
  });

  test('should 网络恢复后自动重连并恢复竞拍状态', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await enterRoom(page, fixtures.userToken, fixtures.roomId);

    // 等待正常连接和竞拍数据加载
    await expect(page.getByText('LIVE')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('拍卖中')).toBeVisible({ timeout: 15000 });

    // 记录断连前的商品名称
    const productNameLocator = page.getByText(`网络测试商品_`);
    await expect(productNameLocator).toBeVisible();

    // 模拟网络中断
    await page.context().setOffline(true);

    // 等待断连提示
    await expect(page.getByText('网络断开，正在重连')).toBeVisible({ timeout: 15000 });

    // 恢复网络
    await page.context().setOffline(false);

    // 等待重连成功
    // 首先等待断连横幅消失
    await expect(page.getByText('网络断开，正在重连')).toBeHidden({ timeout: 20000 });

    // Socket.IO 重连后应自动重新加入房间，竞拍状态应恢复
    // 等待拍卖中标识重新出现
    await expect(page.getByText('拍卖中')).toBeVisible({ timeout: 20000 });
  });

  test('should 页面刷新后 WebSocket 连接可重新建立', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await enterRoom(page, fixtures.userToken, fixtures.roomId);

    // 等待初始连接和竞拍加载
    await expect(page.getByText('LIVE')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('拍卖中')).toBeVisible({ timeout: 15000 });

    // 刷新页面
    await page.reload();

    // 等待重新加载后 LIVE 标识出现
    await expect(page.getByText('LIVE')).toBeVisible({ timeout: 15000 });

    // WebSocket 应重新连接，竞拍状态应恢复
    await expect(page.getByText('拍卖中')).toBeVisible({ timeout: 15000 });

    // 验证商品信息仍然正确显示
    await expect(page.getByText(`网络测试商品_`)).toBeVisible();
  });

  test('should 断连期间不出价，恢复后可正常出价', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await enterRoom(page, fixtures.userToken, fixtures.roomId);

    // 等待连接和竞拍加载
    await expect(page.getByText('LIVE')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('拍卖中')).toBeVisible({ timeout: 15000 });

    // 模拟网络中断
    await page.context().setOffline(true);

    // 等待断连
    await expect(page.getByText('网络断开，正在重连')).toBeVisible({ timeout: 5000 });

    // 恢复网络
    await page.context().setOffline(false);

    // 等待重连完成
    await expect(page.getByText('网络断开，正在重连')).toBeHidden({ timeout: 20000 });
    await expect(page.getByText('拍卖中')).toBeVisible({ timeout: 20000 });

    // 重连后尝试出价
    await page.getByRole('button', { name: '去出价' }).click();
    await expect(page.getByRole('heading', { name: '确认出价' })).toBeVisible({ timeout: 5000 });

    // 提交出价
    const bidButton = page.getByRole('button', { name: /确认出价/ });
    await bidButton.click();

    // 验证出价成功（WebSocket 应正常工作）
    await expect(
      page.getByText('出价成功').or(page.getByText('领先'))
    ).toBeVisible({ timeout: 10000 });
  });
});
