import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    globals: true,
    environment: 'node',
    env: { NODE_ENV: 'test' },
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      thresholds: { branches: 80, functions: 80, lines: 80, statements: 80 },
      reporter: ['text', 'html', 'json'],
      reportsDirectory: 'coverage',
      include: [
        'src/domain/**',
        'src/services/**',
        'src/middleware/**',
        'src/lib/**',
        'src/ws/handlers/**',
      ],
      exclude: [
        'src/infrastructure/**',
        'src/config/**',
        'src/routes/**',
        'src/ws/index.ts',
        'src/ws/rooms.ts',
        'src/middleware/logger.ts',
        'src/lib/auction-cache.ts',
        'src/services/auction-timer-manager.ts',
        'src/server.ts',
        'src/**/*.test.ts',
      ],
    },
  },
});
