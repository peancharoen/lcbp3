// File: frontend/e2e/global-setup.ts
// Change Log:
// - 2026-09-12: Global setup สำหรับ E2E tests — login ทุก role ผ่าน UI แล้ว save storageState

import { chromium, type FullConfig } from '@playwright/test';
import { TEST_CREDENTIALS, type TestRole } from './fixtures/auth';
import * as fs from 'fs';
import * as path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.e2e-cache');

function getStorageStatePath(role: TestRole): string {
  return path.join(CACHE_DIR, `${role}-storage-state.json`);
}

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

/**
 * Global setup — login ทุก role ผ่าน UI แล้ว save storageState
 * รันครั้งเดียวก่อนเริ่ม test suite
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'https://lcbp3.np-dms.work';

  // สร้าง cache dir
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  // ตรวจว่ามี storageState ทั้ง 4 role แล้ว — ถ้ามี ข้าม
  const roles: TestRole[] = ['superadmin', 'admin', 'editor01', 'viewer01'];
  const allValid = roles.every((role) => {
    const statePath = getStorageStatePath(role);
    if (!fs.existsSync(statePath)) return false;
    const stats = fs.statSync(statePath);
    return Date.now() - stats.mtimeMs < 60 * 60 * 1000; // ภายใน 1 ชม.
  });

  if (allValid) {
    log('[global-setup] ใช้ storageState cache ที่มีอยู่');
    return;
  }

  log('[global-setup] Login ทุก role ผ่าน UI...');

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  for (const role of roles) {
    const creds = TEST_CREDENTIALS[role];
    log(`[global-setup] Login ${role}...`);

    try {
      // ไปหน้า login
      await page.goto(`${baseURL}/login`);
      await page.waitForLoadState('networkidle');

      // กรอก username
      await page.getByRole('textbox', { name: 'ชื่อผู้ใช้งาน' }).fill(creds.username);
      // กรอก password
      await page.getByRole('textbox', { name: 'รหัสผ่าน' }).fill(creds.password);
      // กดปุ่ม login
      await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();

      // รอ redirect ไปหน้า dashboard
      await page.waitForURL(/\/(dashboard|correspondences|admin)/, { timeout: 15000 });
      await page.waitForLoadState('networkidle');

      // บันทึก storageState
      const statePath = getStorageStatePath(role);
      await context.storageState({ path: statePath });
      log(`[global-setup] ${role} login สำเร็จ → ${statePath}`);

      // logout เพื่อ login role ถัดไป — ลบ cookies + localStorage
      await context.clearCookies();
      await page.evaluate(() => localStorage.clear());
    } catch (error) {
      process.stderr.write(`[global-setup] Login ${role} ล้มเหลว: ${String(error)}\n`);
      throw error;
    }
  }

  await browser.close();
  log('[global-setup] เสร็จสิ้น');
}
