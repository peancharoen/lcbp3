/**
 * Jest Global Setup
 *
 * ตั้งค่า global สำหรับทุก test file
 * @see specs/05-Engineering-Guidelines/05-04-testing-strategy.md
 */

import 'reflect-metadata';

// Global test timeout (60 วินาที) — รองรับ CI runner ที่มี resource contention (D274, D302)
// ExcelJS I/O tests ช้าบน ASUSTOR runner — local รันเร็ว (~10ms) แต่ CI อาจช้ากว่า 30s
jest.setTimeout(60000);

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
