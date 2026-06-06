/**
 * T047: Critical-module coverage config (US9).
 *
 * Runs only the auction-critical source files with a 90% threshold
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
    environment: 'node',
    include: ['tests/unit/domain/**/*.test.ts', 'tests/unit/services/**/*.test.ts', 'tests/unit/ws/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      thresholds: { branches: 90, functions: 90, lines: 90, statements: 90 },
      reporter: ['text', 'html', 'json'],
      reportsDirectory: 'coverage-critical',
      include: [
        'src/domain/auction.ts',
        'src/domain/bid.ts',
        'src/services/bid.service.ts',
        'src/services/auction.service.ts',
        'src/ws/handlers/bid.ts',
        'src/ws/handlers/auction.ts',
      ],
    },
  },
});
