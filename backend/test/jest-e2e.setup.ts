/**
 * Jest E2E Test Setup
 *
 * Global configuration สำหรับ E2E tests
 * @see specs/05-Engineering-Guidelines/05-04-testing-strategy.md
 */

import 'reflect-metadata';

// E2E tests ใช้เวลานานกว่า unit tests
jest.setTimeout(60000);

// Global beforeAll - สามารถใช้ setup database connection ที่นี่
beforeAll(async () => {
  // E2E specific setup
});

// Global afterAll - cleanup
afterAll(async () => {
  // E2E specific cleanup
});

// Clean up หลังแต่ละ test
afterEach(() => {
  jest.clearAllMocks();
});
