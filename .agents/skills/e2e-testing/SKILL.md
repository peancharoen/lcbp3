---
name: e2e-testing
description: Playwright E2E testing patterns, Page Object Model, configuration, CI/CD integration, artifact management, and flaky test strategies for LCBP3-DMS.
version: 1.9.0
scope: testing
depends-on: []
handoffs-to: [speckit-tester]
user-invocable: true
---

# E2E Testing Skill

Playwright E2E testing patterns adapted for LCBP3-DMS (NestJS + Next.js + MariaDB stack).

## LCBP3 Context

See [`_LCBP3-CONTEXT.md`](../_LCBP3-CONTEXT.md) for project-specific testing requirements:
- Backend: Jest (Unit + Integration + E2E)
- Frontend: Vitest (Unit) + Playwright (E2E)
- E2E test location: `frontend/e2e/workflow-adr021.spec.ts`
- Coverage goals: Backend 70%+, Business Logic 80%+

## When to Use

Invoke this skill when:
- Creating new E2E tests for frontend features
- Debugging flaky Playwright tests
- Setting up CI/CD integration for E2E tests
- Optimizing test performance and reliability
- Implementing Page Object Model (POM) patterns

## Test File Organization

```
frontend/
├── e2e/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   └── logout.spec.ts
│   ├── correspondence/
│   │   ├── create.spec.ts
│   │   └── workflow.spec.ts
│   ├── transmittals/
│   │   ├── create.spec.ts
│   │   └── submit.spec.ts
│   ├── circulation/
│   │   ├── routing.spec.ts
│   │   └── approval.spec.ts
│   └── workflow-adr021.spec.ts  # Existing ADR-021 integration test
├── playwright.config.ts
└── tests/
    └── fixtures/
        ├── auth.ts
        └── data.ts
```

## Page Object Model (POM)

```typescript
// frontend/e2e/pages/CorrespondencePage.ts
import { Page, Locator } from '@playwright/test'

export class CorrespondencePage {
  readonly page: Page
  readonly createButton: Locator
  readonly subjectInput: Locator
  readonly recipientSelect: Locator
  readonly submitButton: Locator
  readonly successMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.createButton = page.getByTestId('create-correspondence')
    this.subjectInput = page.getByTestId('subject-input')
    this.recipientSelect = page.getByTestId('recipient-select')
    this.submitButton = page.getByTestId('submit-button')
    this.successMessage = page.getByTestId('success-message')
  }

  async goto() {
    await this.page.goto('/admin/doc-control/correspondences')
    await this.page.waitForLoadState('networkidle')
  }

  async createCorrespondence(data: {
    subject: string
    recipientId: string
  }) {
    await this.createButton.click()
    await this.subjectInput.fill(data.subject)
    await this.recipientSelect.selectOption(data.recipientId)
    await this.submitButton.click()
  }

  async verifySuccess() {
    await expect(this.successMessage).toBeVisible()
  }
}
```

## Test Structure

```typescript
// frontend/e2e/correspondence/create.spec.ts
import { test, expect } from '@playwright/test'
import { CorrespondencePage } from '../pages/CorrespondencePage'

test.describe('Correspondence Creation', () => {
  let correspondencePage: CorrespondencePage

  test.beforeEach(async ({ page }) => {
    correspondencePage = new CorrespondencePage(page)
    await correspondencePage.goto()
  })

  test('should create correspondence successfully', async ({ page }) => {
    await correspondencePage.createCorrespondence({
      subject: 'Test Correspondence',
      recipientId: 'test-recipient-id'
    })

    await correspondencePage.verifySuccess()
    await page.screenshot({ path: 'artifacts/correspondence-created.png' })
  })

  test('should validate required fields', async ({ page }) => {
    await correspondencePage.createButton.click()
    await correspondencePage.submitButton.click()

    await expect(page.getByTestId('subject-error')).toBeVisible()
    await expect(page.getByTestId('recipient-error')).toBeVisible()
  })
})
```

## Playwright Configuration

```typescript
// frontend/playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'playwright-results.xml' }],
    ['json', { outputFile: 'playwright-results.json' }]
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
```

## Flaky Test Patterns

### Quarantine

```typescript
test('flaky: complex workflow', async ({ page }) => {
  test.fixme(true, 'Flaky - Issue #123')
  // test code...
})

test('conditional skip', async ({ page }) => {
  test.skip(process.env.CI, 'Flaky in CI - Issue #123')
  // test code...
})
```

### Identify Flakiness

```bash
cd frontend
npx playwright test e2e/correspondence/create.spec.ts --repeat-each=10
npx playwright test e2e/correspondence/create.spec.ts --retries=3
```

### Common Causes & Fixes

**Race conditions:**
```typescript
// Bad: assumes element is ready
await page.click('[data-testid="submit-button"]')

// Good: auto-wait locator
await page.locator('[data-testid="submit-button"]').click()
```

**Network timing:**
```typescript
// Bad: arbitrary timeout
await page.waitForTimeout(5000)

// Good: wait for specific condition
await page.waitForResponse(resp => 
  resp.url().includes('/api/correspondences') && resp.status() === 201
)
```

**Animation timing:**
```typescript
// Bad: click during animation
await page.click('[data-testid="menu-item"]')

// Good: wait for stability
await page.locator('[data-testid="menu-item"]').waitFor({ state: 'visible' })
await page.waitForLoadState('networkidle')
await page.locator('[data-testid="menu-item"]').click()
```

## Artifact Management

### Screenshots

```typescript
await page.screenshot({ path: 'artifacts/after-login.png' })
await page.screenshot({ path: 'artifacts/full-page.png', fullPage: true })
await page.locator('[data-testid="workflow-banner"]').screenshot({ 
  path: 'artifacts/workflow-banner.png' 
})
```

### Traces

```typescript
// In playwright.config.ts
use: {
  trace: 'on-first-retry'
}

// View trace
npx playwright show-trace trace.zip
```

### Video

```typescript
// In playwright.config.ts
use: {
  video: 'retain-on-failure',
  videosPath: 'artifacts/videos/'
}
```

## CI/CD Integration

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: pnpm install
      - run: cd frontend && npx playwright install --with-deps
      - run: cd frontend && npx playwright test
        env:
          BASE_URL: ${{ vars.STAGING_URL }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: frontend/playwright-report/
          retention-days: 30
```

## Test Report Template

```markdown
# E2E Test Report

**Date:** YYYY-MM-DD HH:MM
**Duration:** Xm Ys
**Status:** PASSING / FAILING

## Summary
- Total: X | Passed: Y (Z%) | Failed: A | Flaky: B | Skipped: C

## Failed Tests

### correspondence-create
**File:** `frontend/e2e/correspondence/create.spec.ts:45`
**Error:** Expected element to be visible
**Screenshot:** artifacts/failed.png
**Recommended Fix:** Add waitForLoadState after form submission

## Artifacts
- HTML Report: frontend/playwright-report/index.html
- Screenshots: frontend/artifacts/*.png
- Videos: frontend/artifacts/videos/*.webm
- Traces: frontend/artifacts/*.zip
```

## Critical Flow Testing

```typescript
// frontend/e2e/workflow/adr021.spec.ts
test('workflow: correspondence → rfa → approval', async ({ page }) => {
  // Create correspondence
  await createCorrespondence(page)
  await expect(page.getByTestId('correspondence-created')).toBeVisible()

  // Submit for RFA
  await page.getByTestId('submit-rfa').click()
  await expect(page.getByTestId('rfa-submitted')).toBeVisible()

  // Approve RFA
  await page.goto('/admin/doc-control/rfa/123')
  await page.getByTestId('approve-button').click()
  await expect(page.getByTestId('approval-success')).toBeVisible()

  // Verify workflow state
  await expect(page.getByTestId('workflow-state')).toContainText('APPROVED')
})
```

## LCBP3-Specific Considerations

- **UUID Handling:** Use `publicId` (string UUID) in E2E tests, never `parseInt()` (ADR-019)
- **Authentication:** Mock auth tokens for E2E tests to avoid real auth flows
- **Workflow States:** Test ADR-021 workflow transitions (DRAFT → PENDING → APPROVED)
- **i18n:** Test with Thai language to verify i18n key resolution
- **RBAC:** Test different user roles (admin, user, reviewer) for permission checks

## References

- LCBP3 Testing Strategy: `specs/05-Engineering-Guidelines/05-04-testing-strategy.md`
- ADR-021 Workflow Context: `specs/06-Decision-Records/ADR-021-workflow-context.md`
- Existing E2E test: `frontend/e2e/workflow-adr021.spec.ts`
