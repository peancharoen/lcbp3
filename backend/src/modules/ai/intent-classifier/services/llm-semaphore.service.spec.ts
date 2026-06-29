// File: src/modules/ai/intent-classifier/services/llm-semaphore.service.spec.ts
// Change Log
// - 2026-05-19: สร้าง Unit Tests สำหรับ LlmSemaphoreService (ADR-024).

import { LlmSemaphoreService } from './llm-semaphore.service';
import { ConfigService } from '@nestjs/config';

describe('LlmSemaphoreService', () => {
  let service: LlmSemaphoreService;

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue(2), // max concurrent = 2
    } as unknown as ConfigService;

    service = new LlmSemaphoreService(configService);
  });

  describe('tryAcquire', () => {
    it('ควร acquire สำเร็จเมื่อยังมี slot ว่าง', () => {
      const release = service.tryAcquire();
      expect(release).not.toBeNull();
      expect(service.activeCount).toBe(1);
    });

    it('ควร return null เมื่อเต็ม', () => {
      service.tryAcquire();
      service.tryAcquire();
      const release = service.tryAcquire();
      expect(release).toBeNull();
      expect(service.activeCount).toBe(2);
    });

    it('ควร release slot ได้', () => {
      const release = service.tryAcquire()!;
      expect(service.activeCount).toBe(1);
      release();
      expect(service.activeCount).toBe(0);
    });

    it('ควร release ได้แค่ครั้งเดียว (idempotent)', () => {
      const release = service.tryAcquire()!;
      release();
      release();
      expect(service.activeCount).toBe(0);
    });
  });

  describe('acquire (async)', () => {
    it('ควร acquire ทันทีเมื่อมี slot ว่าง', async () => {
      const release = await service.acquire();
      expect(service.activeCount).toBe(1);
      release();
    });

    it('ควร queue และรอเมื่อเต็ม', async () => {
      const r1 = await service.acquire();
      const r2 = await service.acquire();
      expect(service.activeCount).toBe(2);

      // r3 จะ queue
      let r3Resolved = false;
      const r3Promise = service.acquire().then((r) => {
        r3Resolved = true;
        return r;
      });

      // ยังไม่ resolve
      await Promise.resolve();
      expect(r3Resolved).toBe(false);
      expect(service.pendingCount).toBe(1);

      // release 1 slot → r3 ควร resolve
      r1();
      const r3 = await r3Promise;
      expect(r3Resolved).toBe(true);
      expect(service.activeCount).toBe(2);

      r2();
      r3();
    });
  });

  describe('isFull', () => {
    it('ควร return false เมื่อยังมี slot', () => {
      expect(service.isFull).toBe(false);
    });

    it('ควร return true เมื่อเต็ม', () => {
      service.tryAcquire();
      service.tryAcquire();
      expect(service.isFull).toBe(true);
    });
  });
});
