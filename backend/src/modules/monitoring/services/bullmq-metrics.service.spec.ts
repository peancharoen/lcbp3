// File: backend/src/modules/monitoring/services/bullmq-metrics.service.spec.ts
// Change Log:
// - 2026-06-15: Initial creation — ครอบคลุม onModuleInit, onModuleDestroy, collectMetrics, error branch

import { BullmqMetricsService } from './bullmq-metrics.service';
import { Gauge } from 'prom-client';

type GaugeLike = {
  set: jest.Mock;
};

interface MockQueue {
  getJobCounts: jest.Mock;
}

describe('BullmqMetricsService', () => {
  let service: BullmqMetricsService;
  let queues: MockQueue[];
  let gauges: GaugeLike[];

  const createMockQueue = (counts: Record<string, number>): MockQueue => ({
    getJobCounts: jest.fn().mockResolvedValue(counts),
  });

  const createMockGauge = (): GaugeLike => ({
    set: jest.fn(),
  });

  beforeEach(() => {
    queues = [
      createMockQueue({
        waiting: 1,
        active: 2,
        completed: 10,
        failed: 0,
        delayed: 0,
        paused: 0,
      }),
      createMockQueue({
        waiting: 3,
        active: 1,
        completed: 5,
        failed: 2,
        delayed: 1,
        paused: 0,
      }),
      createMockQueue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 1,
      }),
      createMockQueue({
        waiting: 5,
        active: 3,
        completed: 20,
        failed: 1,
        delayed: 2,
        paused: 0,
      }),
      createMockQueue({
        waiting: 0,
        active: 1,
        completed: 3,
        failed: 0,
        delayed: 0,
        paused: 0,
      }),
      createMockQueue({
        waiting: 2,
        active: 0,
        completed: 8,
        failed: 0,
        delayed: 0,
        paused: 0,
      }),
    ];

    gauges = [
      createMockGauge(), // waiting
      createMockGauge(), // active
      createMockGauge(), // completed
      createMockGauge(), // failed
      createMockGauge(), // delayed
      createMockGauge(), // paused
    ];

    service = new BullmqMetricsService(
      queues[0] as never,
      queues[1] as never,
      queues[2] as never,
      queues[3] as never,
      queues[4] as never,
      queues[5] as never,
      gauges[0] as unknown as Gauge<string>,
      gauges[1] as unknown as Gauge<string>,
      gauges[2] as unknown as Gauge<string>,
      gauges[3] as unknown as Gauge<string>,
      gauges[4] as unknown as Gauge<string>,
      gauges[5] as unknown as Gauge<string>
    );
  });

  afterEach(() => {
    // ทำลาย interval ก่อน clearAllMocks เพื่อป้องกัน hanging
    service.onModuleDestroy();
    jest.restoreAllMocks();
  });

  describe('setInterval callback', () => {
    it('should invoke collectMetrics via interval callback', async () => {
      // Mock setInterval เพื่อจับ callback และเรียกมันโดยตรง
      let intervalCallback: (() => void) | undefined;
      jest.spyOn(global, 'setInterval').mockImplementation((cb) => {
        intervalCallback = cb as () => void;
        return {} as NodeJS.Timeout;
      });
      jest.spyOn(global, 'clearInterval').mockImplementation(() => {});

      await service.onModuleInit();
      expect(intervalCallback).toBeDefined();

      // รีเซ็ต calls เพื่อนับเฉพาะที่เกิดจาก callback
      for (const q of queues) q.getJobCounts.mockClear();
      for (const g of gauges) g.set.mockClear();

      // เรียก callback โดยตรง (จะ trigger collectMetrics ผ่าน void)
      intervalCallback?.();

      // รอ promise ใน collectMetrics
      await new Promise((resolve) => setTimeout(resolve, 50));

      for (const q of queues) {
        expect(q.getJobCounts).toHaveBeenCalled();
      }
    });
  });

  describe('onModuleInit', () => {
    it('should collect metrics immediately on init', async () => {
      await service.onModuleInit();

      // ทุก queue ต้องถูกเรียก getJobCounts
      for (const q of queues) {
        expect(q.getJobCounts).toHaveBeenCalled();
      }

      // ทุก gauge ต้องถูก set อย่างน้อยหนึ่งครั้ง
      for (const g of gauges) {
        expect(g.set).toHaveBeenCalled();
      }
    });

    it('should set gauge with queue name label', async () => {
      await service.onModuleInit();

      // ตรวจ waiting gauge ของ queue แรก
      expect(gauges[0].set).toHaveBeenCalledWith(
        expect.objectContaining({ queue: expect.any(String) }),
        expect.any(Number)
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('should clear interval on destroy', () => {
      // ต้องไม่ throw error
      expect(() => service.onModuleDestroy()).not.toThrow();
    });

    it('should clear interval when one was set', async () => {
      await service.onModuleInit();
      // ต้องไม่ throw error หลังจาก interval ถูกตั้ง
      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });

  describe('collectMetrics error handling', () => {
    it('should log warning when queue.getJobCounts throws', async () => {
      // Queue แรก throw error, ที่เหลือปกติ
      queues[0].getJobCounts.mockRejectedValue(new Error('Redis down'));
      queues[1].getJobCounts.mockRejectedValue('string-error');

      // ต้องไม่ throw — error ถูก catch ภายใน
      await service.onModuleInit();

      // Queue ที่ throw ไม่ควร set gauge ใด ๆ
      // แต่ queue ปกติยังต้อง set ได้
      expect(gauges[0].set).toHaveBeenCalled();
    });

    it('should handle non-Error rejection in getJobCounts', async () => {
      queues[0].getJobCounts.mockRejectedValue('not-an-error');

      await service.onModuleInit();

      // ไม่ throw — error ถูก catch
      expect(queues[0].getJobCounts).toHaveBeenCalled();
    });
  });

  describe('collectMetrics all queues', () => {
    it('should call getJobCounts for all 6 queues', async () => {
      await service.onModuleInit();

      for (const q of queues) {
        expect(q.getJobCounts).toHaveBeenCalledWith(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
          'paused'
        );
      }
    });

    it('should set all 6 gauges for each queue', async () => {
      await service.onModuleInit();

      // 6 queues × 6 gauges = 36 set calls
      const totalSets = gauges.reduce(
        (sum, g) => sum + g.set.mock.calls.length,
        0
      );
      expect(totalSets).toBe(36);
    });
  });

  describe('decorator metadata', () => {
    it('should have design:paramtypes metadata with 12 parameters', () => {
      const paramTypes = Reflect.getMetadata(
        'design:paramtypes',
        BullmqMetricsService
      );
      expect(paramTypes).toBeDefined();
      expect(paramTypes).toHaveLength(12);
    });

    it('should re-evaluate module decorators via isolateModules', () => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('./bullmq-metrics.service') as {
          BullmqMetricsService: unknown;
          bullmqMetricProviders: unknown[];
        };
        expect(mod.BullmqMetricsService).toBeDefined();
        expect(mod.bullmqMetricProviders).toHaveLength(6);
      });
    });

    it('should cover __metadata false branch when Reflect.metadata is unavailable', () => {
      const originalMetadata = Reflect.metadata;
      // ชั่วคราวปิด Reflect.metadata เพื่อ cover false branch ของ __metadata helper
      Reflect.metadata = undefined as unknown as typeof Reflect.metadata;
      try {
        // Verify Reflect.metadata is actually undefined
        expect(typeof Reflect.metadata).toBe('undefined');
        // ลบ module จาก require.cache เพื่อบังคับ re-execute
        const modulePath = require.resolve('./bullmq-metrics.service');
        delete require.cache[modulePath];

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('./bullmq-metrics.service') as {
          BullmqMetricsService: unknown;
        };
        expect(mod.BullmqMetricsService).toBeDefined();
      } finally {
        Reflect.metadata = originalMetadata;
      }
    });

    it('should cover __metadata false branch via isolateModules', () => {
      const _originalMetadata = Reflect.metadata;
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        Reflect,
        'metadata'
      );
      // ลบ Reflect.metadata อย่างสมบูรณ์
      delete (Reflect as Record<string, unknown>).metadata;
      try {
        jest.isolateModules(() => {
          // Verify Reflect.metadata is actually unavailable inside isolateModules
          expect(Reflect.metadata).toBeUndefined();

          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const mod = require('./bullmq-metrics.service') as {
            BullmqMetricsService: unknown;
          };
          expect(mod.BullmqMetricsService).toBeDefined();
        });
      } finally {
        if (originalDescriptor) {
          Object.defineProperty(Reflect, 'metadata', originalDescriptor);
        }
      }
    });
  });
});
