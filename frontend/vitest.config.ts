/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['hooks/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}', 'components/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/.ignored_node_modules/**', '**/.next/**', '**/dist/**'],
    testTimeout: 30000,
    // ASUSTOR runner resource constraints — ใช้ singleFork เพื่อกัน worker starvation
    // (D274: forks worker timeout บน ASUSTOR runner — resource starvation ไม่ใช่ code bug)
    // poolOptions ไม่มีใน InlineConfig type ของ vitest 4.1.9 แต่ runtime รองรับ
    pool: 'forks',
    // @ts-expect-error — poolOptions รองรับใน runtime แต่ไม่มีใน type definition
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['hooks/**/*.ts', 'lib/**/*.ts', 'components/**/*.tsx'],
      exclude: ['**/*.d.ts', '**/__tests__/**', '**/types/**', '**/*.test.{ts,tsx}'],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
