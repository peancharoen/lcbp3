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
    include: ['hooks/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}', 'components/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/.ignored_node_modules/**', '**/.next/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['hooks/**/*.ts', 'lib/**/*.ts', 'components/**/*.tsx'],
      exclude: ['**/*.d.ts', '**/__tests__/**', '**/types/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
