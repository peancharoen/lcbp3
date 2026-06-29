// File: frontend/__tests__/helpers/api-mock.ts
// Change Log
// - 2026-06-13: Add shared API client mock shape assertions for frontend tests.

import { expect, type Mock } from 'vitest';

type ApiClientMock = {
  get: Mock;
  post: Mock;
  put: Mock;
  patch: Mock;
  delete: Mock;
};

/**
 * ตรวจสอบว่า apiClient mock จาก vitest.setup.ts มี method ครบตาม pattern กลาง
 */
export function expectApiClientMockShape(apiClient: ApiClientMock): void {
  expect(apiClient.get).toBeTypeOf('function');
  expect(apiClient.post).toBeTypeOf('function');
  expect(apiClient.put).toBeTypeOf('function');
  expect(apiClient.patch).toBeTypeOf('function');
  expect(apiClient.delete).toBeTypeOf('function');
}
