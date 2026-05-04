## การใช้งาน Playwright ใน LCBP3-DMS

จากการตรวจสอบ spec มี test strategy ที่รองรับ Playwright:

### 1. **Test Strategy** (จาก [05-04-testing-strategy.md](cci:7://file:///e:/np-dms/lcbp3/specs/05-Engineering-Guidelines/05-04-testing-strategy.md:0:0-0:0))

**Stack**:
- **Backend**: Jest (Unit + Integration + E2E)
- **Frontend**: Vitest (Unit) + **Playwright** (E2E)

### 2. **Setup Playwright**

```bash
# ติดตั้ง Playwright browsers
npx playwright install chromium

# หรือติดตั้งทั้งหมด
npx playwright install
```

### 3. **MCP Server สำหรับ Windsurf**

เพิ่มใน [.windsurfrc](cci:7://file:///e:/np-dms/lcbp3/.windsurfrc:0:0-0:0):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

**Restart Windsurf** แล้วจะเห็น Playwright MCP panel

### 4. **การใช้งานผ่าน Windsurf Cascade**

เมื่อ MCP พร้อมแล้ว สามารถใช้คำสั่ง:

- **Open browser**: `Navigate to http://localhost:3000`
- **Take screenshot**: `Take a screenshot of the current page`
- **Click element**: `Click the "Submit" button`
- **Fill form**: `Type "test@example.com" into the email field`
- **Verify**: `Check if "Success" message is visible`

### 5. **E2E Test Script Example**

สร้างไฟล์ `e2e/workflow-adr021.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('ADR-021 workflow transition with attachment', async ({ page }) => {
  // 1. Login
  await page.goto('http://localhost:3000/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // 2. Navigate to RFA detail
  await page.goto('http://localhost:3000/rfas/test-uuid');

  // 3. Verify IntegratedBanner
  await expect(page.locator('[data-testid="integrated-banner"]')).toBeVisible();
  await expect(page.locator('[data-testid="priority-badge"]')).toHaveText('HIGH');

  // 4. Upload attachment
  await page.setInputFiles('[data-testid="file-dropzone"]', 'test.pdf');

  // 5. Submit approval
  await page.click('[data-testid="approve-button"]');

  // 6. Verify success
  await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();
});
```

### 6. **Run E2E Tests**

```bash
cd frontend

# Run all E2E tests
npx playwright test

# Run specific test
npx playwright test e2e/workflow-adr021.spec.ts

# Run with UI mode (debug)
npx playwright test --ui

# Run headed (see browser)
npx playwright test --headed
```

### 7. **Generate Test Report**

```bash
npx playwright show-report
```

### 8. **ถ้าใช้ MCP ผ่าน Windsurf**

Cascade จะมี tool ให้ใช้:
- `browser_navigate` - เปิด URL
- `browser_click` - คลิก element
- `browser_type` - พิมพ์ข้อความ
- `browser_take_screenshot` - ถ่าย screenshot
- `browser_evaluate` - รัน JavaScript

ต้องการให้ช่วย setup หรือสร้าง E2E test สำหรับ feature ใด feature หนึ่งไหมครับ?
