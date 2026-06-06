/**
 * T048: Critical-module coverage config (US9).
 *
 * Runs only the frontend critical hooks and store with a 90% threshold
 * across branches, functions, lines, and statements.
 *
 * Usage: pnpm test:critical
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/hooks/__tests__/**/*.test.ts', 'src/store/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      thresholds: { branches: 90, functions: 90, lines: 90, statements: 90 },
      reporter: ['text', 'html', 'json'],
      reportsDirectory: 'coverage-critical',
      include: [
        'src/hooks/useBid.ts',
        'src/hooks/useCountdown.ts',
        'src/hooks/useWebSocket.ts',
        'src/store/auctionStore.ts',
      ],
      exclude: ['src/**/*.test.*', 'src/**/*.d.ts'],
    },
  },
});
