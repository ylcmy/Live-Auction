/**
 * Integration tests — env prep: specs/005-comprehensive-auction-testing/quickstart.md
 * Run `pnpm test:env:prepare` before `pnpm test:integration` when not using globalSetup.
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    testTimeout: 30000,
    hookTimeout: 120000,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
