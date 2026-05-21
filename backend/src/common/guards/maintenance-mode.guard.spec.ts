// File: src/common/guards/maintenance-mode.guard.spec.ts
// Change Log:
// - 2026-05-21: เพิ่ม unit tests สำหรับ MaintenanceModeGuard (T1.1)

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { MaintenanceModeGuard } from './maintenance-mode.guard';
import { BYPASS_MAINTENANCE_KEY } from '../decorators/bypass-maintenance.decorator';

// Helper สร้าง mock ExecutionContext
const makeContext = (url = '/api/test'): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ url }),
    }),
  }) as unknown as ExecutionContext;

describe('MaintenanceModeGuard', () => {
  let guard: MaintenanceModeGuard;
  const mockReflector = { getAllAndOverride: jest.fn() };
  const mockCacheManager = { get: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceModeGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();
    guard = module.get<MaintenanceModeGuard>(MaintenanceModeGuard);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('Bypass decorator', () => {
    it('ควร allow request เมื่อ route มี @BypassMaintenance() decorator', async () => {
      mockReflector.getAllAndOverride.mockReturnValueOnce(true);
      const ctx = makeContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(mockCacheManager.get).not.toHaveBeenCalled();
    });
  });

  describe('Maintenance mode OFF', () => {
    it('ควร allow request เมื่อ Redis คืน null (ไม่ได้เปิด maintenance)', async () => {
      mockReflector.getAllAndOverride.mockReturnValueOnce(false);
      mockCacheManager.get.mockResolvedValueOnce(null);
      const ctx = makeContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('ควร allow request เมื่อ Redis คืน false', async () => {
      mockReflector.getAllAndOverride.mockReturnValueOnce(false);
      mockCacheManager.get.mockResolvedValueOnce(false);
      const ctx = makeContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('ควร allow request เมื่อ Redis คืน undefined', async () => {
      mockReflector.getAllAndOverride.mockReturnValueOnce(false);
      mockCacheManager.get.mockResolvedValueOnce(undefined);
      const ctx = makeContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  describe('Maintenance mode ON', () => {
    it('ควร throw ServiceUnavailableException เมื่อ Redis คืน true (boolean)', async () => {
      mockReflector.getAllAndOverride.mockReturnValueOnce(false);
      mockCacheManager.get.mockResolvedValueOnce(true);
      const ctx = makeContext('/api/correspondences');
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        ServiceUnavailableException
      );
    });

    it('ควร throw ServiceUnavailableException เมื่อ Redis คืน "true" (string)', async () => {
      mockReflector.getAllAndOverride.mockReturnValueOnce(false);
      mockCacheManager.get.mockResolvedValueOnce('true');
      const ctx = makeContext();
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        ServiceUnavailableException
      );
    });
  });

  describe('Fail Open — Redis Error', () => {
    it('ควร allow request (Fail Open) เมื่อ Redis ล่ม', async () => {
      mockReflector.getAllAndOverride.mockReturnValueOnce(false);
      mockCacheManager.get.mockRejectedValueOnce(
        new Error('Redis connection lost')
      );
      const ctx = makeContext();
      // ไม่ throw, ให้ผ่านไป (Fail Open policy)
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('ควร re-throw ServiceUnavailableException (ไม่ swallow มัน)', async () => {
      mockReflector.getAllAndOverride.mockReturnValueOnce(false);
      // จำลองกรณีที่ ServiceUnavailableException ถูก throw ใน catch block
      mockCacheManager.get.mockRejectedValueOnce(
        new ServiceUnavailableException('Already thrown')
      );
      const ctx = makeContext();
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        ServiceUnavailableException
      );
    });
  });

  describe('Reflector key check', () => {
    it('ควรเช็ค BYPASS_MAINTENANCE_KEY ด้วย getAllAndOverride', async () => {
      mockReflector.getAllAndOverride.mockReturnValueOnce(false);
      mockCacheManager.get.mockResolvedValueOnce(null);
      const ctx = makeContext();
      await guard.canActivate(ctx);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        BYPASS_MAINTENANCE_KEY,
        expect.any(Array)
      );
    });
  });
});
