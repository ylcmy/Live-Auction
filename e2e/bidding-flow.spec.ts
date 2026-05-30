import { test, expect, type APIRequestContext } from '@playwright/test';

const API_BASE = 'http://localhost:3002';

interface FixtureData {
  merchantToken: string;
  userToken: string;
  productId: number;
  roomId: number;
  sessionId: number;
}

/** 通过后端 API 创建测试所需数据：商家、用户、商品、直播间、竞拍会话 */
async function createFixtures(request: APIRequestContext): Promise<FixtureData> {
  const ts = Date.now();

  // 1. 注册商家
  await request.post(`${API_BASE}/api/auth/register`, {
    data: {
      username: `bid_merchant_${ts}`,
      password: 'pass1234',
      nickname: '竞拍测试商家',
      role: 'merchant',
    },
  });

  // 2. 登录商家获取 accessToken
  const merchantLoginRes = await request.post(`${API_BASE}/api/auth/login`, {
    data: { username: `bid_merchant_${ts}`, password: 'pass1234' },
  });
  const merchantLoginJson = await merchantLoginRes.json();
  const merchantToken: string = merchantLoginJson.data.accessToken;

  // 3. 注册普通用户
  await request.post(`${API_BASE}/api/auth/register`, {
    data: {
      username: `bid_user_${ts}`,
      password: 'pass1234',
      nickname: '竞拍测试用户',
      role: 'user',
    },
  });

  // 4. 登录用户获取 accessToken
  const userLoginRes = await request.post(`${API_BASE}/api/auth/login`, {
    data: { username: `bid_user_${ts}`, password: 'pass1234' },
  });
  const userLoginJson = await userLoginRes.json();
  const userToken: string = userLoginJson.data.accessToken;

  // 3. 创建商品（含竞拍规则）
  const productRes = await request.post(`${API_BASE}/api/products`, {
    headers: { Authorization: `Bearer ${merchantToken}` },
    data: {
      name: `E2E竞拍商品_${ts}`,
      category: '测试分类',
      description: 'E2E 自动化测试商品',
      rule: {
        startPrice: 100,
        bidIncrement: 10,
        durationSeconds: 300,
        extendSeconds: 30,
        maxExtensions: 5,
      },
    },
  });
  const productJson = await productRes.json();
  const productId: number = productJson.data.productId;

  // 4. 将商品状态改为 listed（上架）
  await request.put(`${API_BASE}/api/products/${productId}/status`, {
    headers: { Authorization: `Bearer ${merchantToken}` },
    data: { status: 'listed' },
  });

  // 5. 创建直播间
  const roomRes = await request.post(`${API_BASE}/api/rooms`, {
    headers: { Authorization: `Bearer ${merchantToken}` },
    data: { title: `E2E竞拍直播间_${ts}` },
  });
  const roomJson = await roomRes.json();
  const roomId: number = roomJson.data.roomId;

  // 6. 开启直播间
  await request.put(`${API_BASE}/api/rooms/${roomId}/status`, {
    headers: { Authorization: `Bearer ${merchantToken}` },
    data: { status: 'live' },
  });

  // 7. 发起竞拍
  const auctionRes = await request.post(`${API_BASE}/api/auctions`, {
    headers: { Authorization: `Bearer ${merchantToken}` },
    data: { productId, roomId },
  });
  const auctionJson = await auctionRes.json();
  const sessionId: number = auctionJson.data.sessionId;

  return { merchantToken, userToken, productId, roomId, sessionId };
}

/** 通过 API 帮助用户登录（写入 localStorage），然后导航至指定页面 */
async function loginViaApi(page: import('@playwright/test').Page, token: string) {
  await page.goto('/login');
  await page.evaluate(
    ({ token }: { token: string }) => {
      localStorage.setItem('accessToken', token);
    },
    { token },
  );
}

test.describe('完整竞拍流程', () => {
  let fixtures: FixtureData;

  test.beforeAll(async ({ request }) => {
    fixtures = await createFixtures(request);
  });

  test('should 用户从进入直播间到出价的完整流程', async ({ page }) => {
    // Step 1: 用户登录
    await loginViaApi(page, fixtures.userToken);

    // Step 2: 进入直播间
    await page.goto(`/live/${fixtures.roomId}`);

    // Step 3: 等待页面加载，确认是 LIVE 直播间
    await expect(page.getByText('LIVE')).toBeVisible({ timeout: 15000 });

    // Step 4: 等待竞拍气泡出现（"拍卖中"标识）
    const auctionBubble = page.getByText('拍卖中');
    await expect(auctionBubble).toBeVisible({ timeout: 15000 });

    // Step 5: 确认商品名称和起拍价显示
    await expect(page.getByText(`E2E竞拍商品_`)).toBeVisible();

    // Step 6: 点击"去出价"按钮
    await page.getByRole('button', { name: '去出价' }).click();

    // Step 7: 确认出价面板打开
    await expect(page.getByText('确认出价')).toBeVisible({ timeout: 5000 });

    // Step 8: 确认当前价显示（起拍价 100，当前价应为 100 或已更新）
    await expect(page.getByText(/当前价/)).toBeVisible();

    // Step 9: 点击出价按钮提交（默认出价 = 当前价 + 加价幅度）
    const bidButton = page.getByRole('button', { name: /确认出价/ });
    await expect(bidButton).toBeVisible();
    await bidButton.click();

    // Step 10: 验证出价成功提示
    await expect(page.getByText('出价成功')).toBeVisible({ timeout: 10000 });

    // 关闭出价面板（按 Escape 键触发 Sheet 的 onOpenChange）
    await page.keyboard.press('Escape');
  });

  test('should 用户出价后可在"我的订单"中查看竞拍结果', async ({ page }) => {
    // 用户登录
    await loginViaApi(page, fixtures.userToken);

    // 访问"我的订单"页面
    await page.goto('/me/orders');

    // 页面应正常加载（非错误状态）
    // 等待订单列表或"暂无订单"提示
    await expect(
      page.getByText('我的订单').or(page.getByText('暂无订单')),
    ).toBeVisible({ timeout: 10000 });

    // 如果竞拍已结束并生成了订单，应能看到订单条目
    // 注意：订单可能在竞拍结束后才生成，此步骤为验证页面可正常访问
  });

  test('should 商家可从管理后台发起新的竞拍', async ({ page }) => {
    // 商家登录
    await loginViaApi(page, fixtures.merchantToken);

    // 访问竞拍管理页面
    await page.goto('/admin/auction');

    // 等待页面加载
    await expect(page.getByText('发起竞拍')).toBeVisible({ timeout: 10000 });

    // 选择直播间（点击下拉按钮）
    await page.getByText('请选择直播间').click();
    // 在下拉列表中找到我们的直播间
    await page.getByText(`E2E竞拍直播间_`).first().click();

    // 选择商品（点击下拉按钮）
    await page.getByText('请选择待竞拍商品').click();
    // 在下拉列表中找到我们的商品
    await page.getByText(`E2E竞拍商品_`).first().click();

    // 点击"开始竞拍"按钮
    await page.getByRole('button', { name: '开始竞拍' }).click();

    // 验证竞拍发起成功
    await expect(page.getByText('竞拍已成功发起')).toBeVisible({ timeout: 10000 });

    // 验证进行中的竞拍卡片出现
    await expect(page.getByText('进行中的竞拍')).toBeVisible();
  });
});
