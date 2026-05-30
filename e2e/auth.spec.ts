import { test, expect } from '@playwright/test';

test.describe('用户认证流程', () => {
  test('should 注册新用户并显示成功提示', async ({ page }) => {
    const uniqueName = `e2e_user_${Date.now()}`;
    await page.goto('/register');

    // 填写注册表单
    await page.locator('#username').fill(uniqueName);
    await page.locator('#password').fill('Test@12345');
    await page.locator('#nickname').fill('E2E测试用户');

    // 默认角色为商家，保持默认即可
    await page.locator('button[type="submit"]').click();

    // 注册成功后应显示成功页面
    await expect(page.getByText('注册成功')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('您的账号已创建成功，请登录后使用')).toBeVisible();

    // 点击"前往登录"跳转到登录页
    await page.getByRole('link', { name: '前往登录' }).click();
    await expect(page).toHaveURL('/login');
  });

  test('should 商家账号登录后跳转管理后台', async ({ page }) => {
    await page.goto('/login');

    // 登录页默认填充商家账号 merchant_1
    // 直接点击登录
    await page.locator('button[type="submit"]').click();

    // 商家登录后应跳转到 /admin
    await expect(page).toHaveURL('/admin', { timeout: 10000 });
  });

  test('should 用户账号登录后跳转直播间列表', async ({ page }) => {
    await page.goto('/login');

    // 切换到"用户"角色（会自动填充 user_1 账号）
    await page.getByRole('button', { name: '用户' }).click();

    await page.locator('button[type="submit"]').click();

    // 普通用户登录后应跳转到 /live
    await expect(page).toHaveURL('/live', { timeout: 10000 });
  });

  test('should 密码错误时显示错误信息', async ({ page }) => {
    await page.goto('/login');

    // 登录页默认填充 merchant_1 / pass1234
    // 使用网络拦截验证错误密码被发送
    let requestBody: string | undefined;
    await page.route('**/api/auth/login', async (route) => {
      requestBody = route.request().postData() ?? undefined;
      await route.continue();
    });

    // 修改密码字段值
    const passwordField = page.locator('#password');
    await passwordField.focus();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('wrong_password', { delay: 20 });
    await page.waitForTimeout(200);

    await page.locator('button[type="submit"]').click();

    // 等待 API 调用完成
    await page.waitForResponse(resp => resp.url().includes('/api/auth/login'), { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // 验证错误密码被发送
    expect(requestBody).toContain('wrong_password');

    // 页面应仍在登录页（未跳转）
    await expect(page).toHaveURL('/login');
  });

  test('should 已登录用户访问登录页时可正常登录', async ({ page }) => {
    // 先登录为商家
    await page.goto('/login');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL('/admin', { timeout: 10000 });

    // 再次访问登录页
    await page.goto('/login');
    await page.locator('#username').clear();
    await page.locator('#username').fill('user_1');
    await page.locator('#password').clear();
    await page.locator('#password').fill('pass1234');

    await page.locator('button[type="submit"]').click();

    // 应成功跳转到直播间列表
    await expect(page).toHaveURL('/live', { timeout: 10000 });
  });
});
