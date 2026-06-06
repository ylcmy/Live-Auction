import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const API_BASE = 'http://localhost:3002';

interface MerchantFixtures {
  merchantToken: string;
  userToken: string;
  roomId: number;
  productId: number;
  sessionId: number;
}

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
      // Retry on server errors (5xx) or conflict (409) that might be transient
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

/** 注册一个新的商家账号，创建直播间、商品并发起竞拍 */
async function createMerchantFixtures(request: APIRequestContext): Promise<MerchantFixtures> {
  const ts = Date.now();

  // 注册商家
  await request.post(`${API_BASE}/api/auth/register`, {
    data: {
      username: `mc_merchant_${ts}`,
      password: 'pass1234',
      nickname: '主播测试',
      role: 'merchant',
    },
  });

  // 登录商家获取 accessToken
  const merchantLoginRes = await request.post(`${API_BASE}/api/auth/login`, {
    data: { username: `mc_merchant_${ts}`, password: 'pass1234' },
  });
  const merchantLoginJson = await merchantLoginRes.json();
  const merchantToken: string = merchantLoginJson.data.accessToken;

  // 注册普通用户
  await request.post(`${API_BASE}/api/auth/register`, {
    data: {
      username: `mc_user_${ts}`,
      password: 'pass1234',
      nickname: '竞拍观众',
      role: 'user',
    },
  });

  // 登录用户获取 accessToken
  const userLoginRes = await request.post(`${API_BASE}/api/auth/login`, {
    data: { username: `mc_user_${ts}`, password: 'pass1234' },
  });
  const userLoginJson = await userLoginRes.json();
  const userToken: string = userLoginJson.data.accessToken;

  // 创建商品（供后续竞拍使用）
  const { json: productJson } = await apiRequest(request, 'post', `${API_BASE}/api/products`, {
    headers: { Authorization: `Bearer ${merchantToken}` },
    data: {
      name: `主播商品_${ts}`,
      category: '数码产品',
      description: 'E2E 主播流程测试商品',
      rule: {
        startPrice: 500,
        bidIncrement: 50,
        durationSeconds: 300,
        extendSeconds: 30,
        maxExtensions: 5,
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
    data: { title: `主播测试间_${ts}` },
  });
  const roomId: number = roomJson?.data?.roomId;
  if (!roomId) {
    throw new Error(`Failed to create room: ${JSON.stringify(roomJson)}`);
  }

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

  return { merchantToken, userToken, roomId, productId, sessionId };
}

/** 通过 API 注入 Token 并跳转到管理后台 */
async function loginAsMerchant(page: Page, token: string) {
  await page.goto('/login');
  await page.evaluate((t: string) => {
    localStorage.setItem('accessToken', t);
  }, token);
}

test.describe('主播端操作流程', () => {
  let fixtures: MerchantFixtures;

  test.beforeAll(async ({ request }) => {
    fixtures = await createMerchantFixtures(request);
  });

  test('should 主播进入管理后台并看到数据看板', async ({ page }) => {
    await loginAsMerchant(page, fixtures.merchantToken);
    await page.goto('/admin');

    // 应看到数据看板标题（侧边栏按钮和标题都有此文本，用 heading 定位）
    await expect(page.getByRole('heading', { name: '数据看板' })).toBeVisible({ timeout: 10000 });

    // 应看到直播间状态卡片
    await expect(page.getByText('我的直播间')).toBeVisible();

    // 应看到商品概览和最近订单区域
    await expect(page.getByText('商品概览')).toBeVisible();
    await expect(page.getByText('最近订单')).toBeVisible();

    // 应能看到直播间状态为"在线"（因为我们在 fixtures 中已开启）
    await expect(page.getByText('在线')).toBeVisible();
  });

  test('should 主播通过表单创建新商品', async ({ page }) => {
    await loginAsMerchant(page, fixtures.merchantToken);

    // 导航到创建商品页
    await page.goto('/admin/products/create');

    // 确认页面已加载
    await expect(page.getByRole('heading', { name: '添加商品' })).toBeVisible({ timeout: 10000 });

    // 填写基本信息
    const productName = `E2E新商品_${Date.now()}`;
    const nameInput = page.locator('input[placeholder="请输入商品名称"]');
    await nameInput.click();
    await nameInput.fill(productName);

    const categoryInput = page.locator('input[placeholder*="艺术品"]');
    await categoryInput.click();
    await categoryInput.fill('电子产品');

    const descInput = page.locator('textarea[placeholder="请输入商品描述"]');
    await descInput.click();
    await descInput.fill('通过 E2E 自动化测试创建的商品');

    // 填写竞拍规则 — 使用 input[type="number"] 按顺序定位
    // 顺序: startPrice(0), bidIncrement(1), ceilingPrice(2,disabled), durationSeconds(3), extendSeconds(4), maxExtensions(5)
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill('1000');  // 起拍价
    await numberInputs.nth(1).fill('100');   // 加价幅度

    // 点击保存
    await page.getByRole('button', { name: '保存商品' }).click();

    // 应跳转到商品列表页（或显示错误提示）
    await expect(page).toHaveURL('/admin/products', { timeout: 15000 });

    // 商品列表中应能看到新创建的商品
    await expect(page.getByText(productName)).toBeVisible({ timeout: 10000 });
  });

  test('should 主播发起竞拍后用户在直播间看到商品', async ({ page }) => {
    // 主播已在 fixtures 中发起了竞拍
    // 用普通用户身份进入直播间验证

    await loginAsMerchant(page, fixtures.userToken);
    await page.goto(`/live/${fixtures.roomId}`);

    // 等待 LIVE 标识
    await expect(page.getByText('LIVE')).toBeVisible({ timeout: 15000 });

    // 应看到竞拍气泡
    await expect(page.getByText('拍卖中')).toBeVisible({ timeout: 15000 });

    // 应看到正确的商品名称
    await expect(page.getByText(`主播商品_`)).toBeVisible();

    // 应能看到出价按钮
    await expect(page.getByRole('button', { name: '去出价' })).toBeVisible();
  });

  test('should 主播可管理直播间开关状态', async ({ page }) => {
    // 先创建一个新的商家（有自己的直播间）
    const uniqueTs = Date.now();
    await page.request.post(`${API_BASE}/api/auth/register`, {
      data: {
        username: `toggle_merchant_${uniqueTs}`,
        password: 'pass1234',
        nickname: '开关测试商家',
        role: 'merchant',
      },
    });

    // 登录获取 accessToken
    const newLoginRes = await page.request.post(`${API_BASE}/api/auth/login`, {
      data: { username: `toggle_merchant_${uniqueTs}`, password: 'pass1234' },
    });
    const newLoginJson = await newLoginRes.json();
    const newToken: string = newLoginJson.data.accessToken;

    // 创建直播间
    await page.request.post(`${API_BASE}/api/rooms`, {
      headers: { Authorization: `Bearer ${newToken}` },
      data: { title: `开关测试间_${uniqueTs}` },
    });

    await loginAsMerchant(page, newToken);
    await page.goto('/admin');

    // 等待数据看板加载
    await expect(page.getByText('我的直播间')).toBeVisible({ timeout: 10000 });

    // 确认初始状态为"离线"
    await expect(page.getByText('离线')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('未开播')).toBeVisible();

    // 点击开关按钮（Toggle）开启直播间
    // Dashboard 组件中的 Toggle 是一个 w-14 h-8 rounded-full 的 button
    const toggleButton = page.locator('button[class*="rounded-full"][class*="w-14"]').first();
    await toggleButton.click();

    // 应变为"在线"/"直播中"状态
    await expect(page.getByText('直播中')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('在线')).toBeVisible();

    // 再次点击关闭直播间
    await toggleButton.click();

    // 应变回"离线"/"未开播"
    await expect(page.getByText('未开播')).toBeVisible({ timeout: 10000 });
  });

  test('should 主播可在商品列表查看已创建的商品', async ({ page }) => {
    await loginAsMerchant(page, fixtures.merchantToken);
    await page.goto('/admin/products');

    // 应看到商品管理标题或至少有商品条目
    await expect(
      page.getByRole('heading', { name: '商品管理' })
        .or(page.getByText('暂无商品'))
    ).toBeVisible({
      timeout: 10000,
    });

    // 由于 fixtures 中已创建商品，应能看到商品条目
    await expect(page.getByText(`主播商品_`)).toBeVisible({ timeout: 10000 });
  });
});
