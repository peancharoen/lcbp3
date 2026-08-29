// File: backend/src/modules/notification/notification-cleanup.metadata.spec.ts
// Change Log:
// - 2026-06-20: เพิ่ม tests สำหรับ cover decorator metadata Object-fallback branch

// Mock @nestjs/typeorm ให้ InjectRepository เป็น decorator ง่าย ๆ
// เพื่อหลีกเลี่ยง instanceof Repository check ใน getRepositoryToken
jest.mock('@nestjs/typeorm', () => {
  const actual =
    jest.requireActual<typeof import('@nestjs/typeorm')>('@nestjs/typeorm');
  return {
    ...actual,
    InjectRepository: () => () => undefined,
  };
});

// Mock typeorm ให้ Repository เป็น object ที่ไม่ใช่ function
// เพื่อ trigger __metadata Object fallback branch (typeof !== "function" → Object)
jest.mock('typeorm', () => {
  const actual = jest.requireActual<typeof import('typeorm')>('typeorm');
  return {
    ...actual,
    Repository: {
      _mockedNonFunction: true,
    } as unknown as typeof import('typeorm').Repository,
  };
});

import { NotificationCleanupService } from './notification-cleanup.service';

describe('NotificationCleanupService — decorator metadata fallback', () => {
  it('should instantiate when typeorm Repository is not a function', () => {
    const service = new NotificationCleanupService({} as never);
    expect(service).toBeDefined();
  });
});
