/**
 * Jest Global Setup
 *
 * ตั้งค่า global สำหรับทุก test file
 * @see specs/05-Engineering-Guidelines/05-04-testing-strategy.md
 */

import 'reflect-metadata';

// Global test timeout (30 วินาที)
jest.setTimeout(30000);

// Mock console methods ใน test environment
// ลด noise ใน test output แต่ยังเก็บ error ไว้
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
};

global.beforeAll(() => {
  // Suppress console.log ใน test (ยกเว้น error)
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
});

global.afterAll(() => {
  // Restore original console methods
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
});

// Clean up mocks หลังจากแต่ละ test
afterEach(() => {
  jest.clearAllMocks();
});

// Global error handler สำหรับ unhandled promises
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});
