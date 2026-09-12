// File: frontend/e2e/fixtures/auth.ts
// Change Log:
// - 2026-09-12: Initial auth fixtures for Feature 253 E2E tests
// - 2026-09-12: ใช้ token cache + รันบน production (https://lcbp3.np-dms.work) ตาม test plan L11
// - 2026-09-12: เปลี่ยนเป็น UI login + storageState เพราะ production ใช้ NextAuth ครอง API

import { type Page, type APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test credentials จาก test plan L11-16
 * ทดสอบบน production: https://lcbp3.np-dms.work
 */
export const TEST_CREDENTIALS = {
  superadmin: { username: 'superadmin', password: 'Center2025' },
  admin: { username: 'admin', password: 'Center2025' },
  editor01: { username: 'editor01', password: 'Center2025' },
  viewer01: { username: 'viewer01', password: 'Center2025' },
} as const;

export type TestRole = keyof typeof TEST_CREDENTIALS;

/**
 * Cache directory สำหรับ storageState (login session แต่ละ role)
 */
const CACHE_DIR = path.join(process.cwd(), '.e2e-cache');

/**
 * ดึง storageState path สำหรับ role
 */
function getStorageStatePath(role: TestRole): string {
  return path.join(CACHE_DIR, `${role}-storage-state.json`);
}

/**
 * ตรวจว่า storageState มีอยู่และยังไม่หมดอายุ (ภายใน 1 ชม.)
 */
function isStorageStateValid(role: TestRole): boolean {
  const statePath = getStorageStatePath(role);
  try {
    if (!fs.existsSync(statePath)) return false;
    const stats = fs.statSync(statePath);
    // ถ้า file อายุเกิน 1 ชม. → invalid
    const ageMs = Date.now() - stats.mtimeMs;
    return ageMs < 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Login ผ่าน UI แล้วบันทึก storageState (cookies + localStorage)
 * ใช้สำหรับ setup authenticated state ครั้งเดียวต่อ role
 */
export async function loginViaUIAndSaveState(
  page: Page,
  role: TestRole,
  baseURL: string,
): Promise<void> {
  const creds = TEST_CREDENTIALS[role];

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
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  await page.context().storageState({ path: statePath });
}

/**
 * โหลด storageState สำหรับ role (ถ้ามี cache ใช้ cache, ถ้าไม่มี login ใหม่)
 * ใช้กับ browser.newContext({ storageState }) หรือ test.use({ storageState })
 */
export function getStorageState(role: TestRole): string | undefined {
  if (isStorageStateValid(role)) {
    return getStorageStatePath(role);
  }
  return undefined;
}

/**
 * Login ผ่าน API — สำหรับ local Docker เท่านั้น (production ใช้ NextAuth ครอง)
 * ใช้ cache เพื่อป้องกัน 429 Too Many Requests
 */
export async function loginViaAPI(
  request: APIRequestContext,
  baseURL: string,
  role: TestRole,
): Promise<{ accessToken: string; user: Record<string, unknown> }> {
  const creds = TEST_CREDENTIALS[role];
  // สำหรับ local Docker — backend ที่ port 3000
  const apiBase = baseURL.replace(':3001', ':3000').replace(/\/$/, '') + '/api';

  const response = await request.post(`${apiBase}/auth/login`, {
    data: {
      username: creds.username,
      password: creds.password,
    },
    headers: { 'Content-Type': 'application/json' },
    maxRedirects: 0,
  });

  if (!response.ok()) {
    throw new Error(`Login failed for ${role}: ${response.status()} ${response.statusText()}`);
  }

  const body = await response.json();
  const accessToken = body.data?.access_token;
  const user = body.data?.user;

  if (!accessToken) {
    throw new Error(`No access_token in login response for ${role}`);
  }

  return { accessToken, user: user as Record<string, unknown> };
}

/**
 * Inject auth state ลงในหน้าเว็บ (localStorage)
 * ใช้หลัง page.goto() เพื่อให้หน้าเว็บ authenticated ทันที
 */
export async function injectAuthState(
  page: Page,
  accessToken: string,
  user: Record<string, unknown>,
): Promise<void> {
  const authStorage = {
    state: {
      user: {
        publicId: user.publicId,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permissions: user.permissions ?? [],
      },
      token: accessToken,
      isAuthenticated: true,
    },
    version: 0,
  };

  await page.evaluate(
    ({ authStorage }) => {
      localStorage.setItem('auth-storage', JSON.stringify(authStorage));
    },
    { authStorage },
  );
}

/**
 * Helper — login ผ่าน UI แล้วไปยังหน้าที่ต้องการ
 * ใช้สำหรับ production ที่มี NextAuth ครอง API
 */
export async function loginAndGoto(page: Page, role: TestRole, path: string): Promise<void> {
  const baseURL = (page.context() as unknown as { _options?: { baseURL?: string } })._options?.baseURL ?? 'https://lcbp3.np-dms.work';

  // ถ้ามี storageState cache → ใช้
  const statePath = getStorageStatePath(role);
  if (isStorageStateValid(role)) {
    // โหลด storageState เข้า context
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    await page.context().addCookies(state.cookies ?? []);
    // ไปหน้าที่ต้องการโดยตรง
    await page.goto(`${baseURL}${path}`);
    await page.waitForLoadState('networkidle');
    return;
  }

  // ไม่มี cache → login ผ่าน UI
  await loginViaUIAndSaveState(page, role, baseURL);
  // หลัง login จะอยู่ที่ dashboard ให้ไปหน้าที่ต้องการ
  await page.goto(`${baseURL}${path}`);
  await page.waitForLoadState('networkidle');
}

/**
 * ล้าง cache (เรียกใน global teardown ถ้าต้องการ)
 */
export function clearTokenCache(): void {
  try {
    if (fs.existsSync(CACHE_DIR)) {
      fs.rmSync(CACHE_DIR, { recursive: true });
    }
  } catch {
    // ignore
  }
}

export { expect } from '@playwright/test';
