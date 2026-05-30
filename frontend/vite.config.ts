import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const backendTarget = process.env.VITE_TEST_MODE ? 'http://localhost:3002' : 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: process.env.VITE_TEST_MODE ? 5174 : 5173,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/socket.io': {
        target: backendTarget,
        ws: true,
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: 'coverage',
      include: ['src/hooks/**', 'src/store/**', 'src/lib/**', 'src/services/**',
        'src/components/auction/BidHint.tsx',
        'src/components/auction/BidSheet.tsx',
        'src/components/auction/BidStepper.tsx',
        'src/components/auction/CartButton.tsx',
        'src/components/auction/CartPanel.tsx',
        'src/components/auction/EmotionToast.tsx',
        'src/components/auction/ProductCard.tsx',
        'src/components/auction/ProductDetailSheet.tsx',
        'src/components/product/ProductForm.tsx',
        'src/components/product/RuleConfig.tsx',
      ],
      exclude: ['src/design-system/**', 'src/**/*.test.*', 'src/**/*.d.ts', 'src/tests/**'],
      thresholds: {
        branches: 80,
        functions: 75,
        lines: 80,
        statements: 80,
      },
    },
  },
})
