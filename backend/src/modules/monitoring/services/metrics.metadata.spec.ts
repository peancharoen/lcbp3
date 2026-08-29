// File: backend/src/modules/monitoring/services/metrics.metadata.spec.ts
// Change Log:
// - 2026-06-20: เพิ่ม tests สำหรับ cover decorator metadata Object-fallback branch

// Mock prom-client ให้ Counter และ Histogram เป็น undefined
// เพื่อ trigger __metadata Object fallback branch ใน compiled TS
jest.mock('prom-client', () => ({
  Counter: undefined,
  Histogram: undefined,
  default: {},
}));

import { MetricsService } from './metrics.service';

describe('MetricsService — decorator metadata fallback', () => {
  it('should instantiate when prom-client Counter/Histogram are undefined', () => {
    // การ import MetricsService เองก็ trigger __metadata แล้ว
    // ซึ่งจะ cover Object fallback branch
    const service = new MetricsService(
      { inc: jest.fn() } as never,
      { observe: jest.fn() } as never
    );
    expect(service).toBeDefined();
    expect(service.httpRequestsTotal).toBeDefined();
    expect(service.httpRequestDuration).toBeDefined();
  });
});
