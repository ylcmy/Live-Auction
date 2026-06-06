import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  globalSetup: './global-setup.ts',
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ...(process.env.CI ? [['junit', { outputFile: 'test-results/junit.xml' }] as const] : []),
  ],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 15000,
  },
  projects: [
    { name: 'smoke', testMatch: /smoke\/.*\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    { name: 'full', testMatch: /^(?!.*smoke\/).*\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'cd ../backend && pnpm dev:test',
      url: 'http://localhost:3002/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'cd ../frontend && pnpm dev:test',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
