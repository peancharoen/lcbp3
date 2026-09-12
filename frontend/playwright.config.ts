// File: frontend/playwright.config.ts
// Change Log:
// - 2026-09-12: Initial Playwright config for Feature 253 E2E tests (unified-doc-crud-test-plan Phase 1)
// - 2026-09-12: เพิ่ม global setup สำหรับ login ทุก role ผ่าน UI + storageState

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config สำหรับ LCBP3-DMS E2E tests
 * - รันบน production (https://lcbp3.np-dms.work) ตาม test plan L11
 * - ใช้ global setup login ทุก role ผ่าน UI แล้ว save storageState
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // ASUSTOR runner resource constraints — ทดสอบทีละ suite
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // single worker — ป้องกัน resource starvation บน ASUSTOR runner
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://lcbp3.np-dms.work',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Global setup — login ทุก role ผ่าน UI แล้ว save storageState
  globalSetup: './e2e/global-setup.ts',
});
