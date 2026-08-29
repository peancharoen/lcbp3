// File: backend/src/modules/document-numbering/services/metrics.service.spec.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for MetricsService
// - 2026-06-13: Skipped metrics tests due to @InjectMetric decorator complexity
//   These tests require full Prometheus module setup which is out of scope for unit tests
// - 2026-08-28: Rewrote with full unit tests using direct instantiation

import { Counter, Gauge, Histogram } from 'prom-client';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  const mockCounter: Pick<Counter<string>, 'inc' | 'reset'> = {
    inc: jest.fn(),
    reset: jest.fn(),
  };

  const mockGauge: Pick<Gauge<string>, 'inc' | 'dec' | 'set'> = {
    inc: jest.fn(),
    dec: jest.fn(),
    set: jest.fn(),
  };

  const mockHistogram: Pick<Histogram<string>, 'observe' | 'reset'> = {
    observe: jest.fn(),
    reset: jest.fn(),
  };

  const mockLockFailuresCounter: Pick<Counter<string>, 'inc' | 'reset'> = {
    inc: jest.fn(),
    reset: jest.fn(),
  };

  beforeEach(() => {
    service = new MetricsService(
      mockCounter as unknown as Counter<string>,
      mockGauge as unknown as Gauge<string>,
      mockHistogram as unknown as Histogram<string>,
      mockLockFailuresCounter as unknown as Counter<string>
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should expose numbersGenerated counter', () => {
    expect(service.numbersGenerated).toBeDefined();
    expect(service.numbersGenerated).toBe(mockCounter);
  });

  it('should expose sequenceUtilization gauge', () => {
    expect(service.sequenceUtilization).toBeDefined();
    expect(service.sequenceUtilization).toBe(mockGauge);
  });

  it('should expose lockWaitTime histogram', () => {
    expect(service.lockWaitTime).toBeDefined();
    expect(service.lockWaitTime).toBe(mockHistogram);
  });

  it('should expose lockFailures counter', () => {
    expect(service.lockFailures).toBeDefined();
    expect(service.lockFailures).toBe(mockLockFailuresCounter);
  });

  it('should allow incrementing numbersGenerated', () => {
    service.numbersGenerated.inc({ project_id: '1', type_id: '2' });
    expect(mockCounter.inc).toHaveBeenCalledWith({
      project_id: '1',
      type_id: '2',
    });
  });

  it('should allow observing lockWaitTime', () => {
    service.lockWaitTime.observe({ project_id: '1' }, 0.5);
    expect(mockHistogram.observe).toHaveBeenCalledWith(
      { project_id: '1' },
      0.5
    );
  });

  it('should allow incrementing lockFailures', () => {
    service.lockFailures.inc({ project_id: '1' });
    expect(mockLockFailuresCounter.inc).toHaveBeenCalledWith({
      project_id: '1',
    });
  });

  it('should allow setting sequenceUtilization', () => {
    service.sequenceUtilization.set({ project_id: '1' }, 75);
    expect(mockGauge.set).toHaveBeenCalledWith({ project_id: '1' }, 75);
  });

  // Cover decorator metadata branches ที่ prom-client types เป็น undefined
  // ใช้ jest.isolateModules เพื่อโหลด module ใน isolated context
  describe('decorator metadata branch coverage', () => {
    it('should cover branches when prom-client types are undefined', () => {
      jest.isolateModules(() => {
        // Mock prom-client ให้ types เป็น undefined เพื่อ cover __metadata branches
        jest.doMock('prom-client', () => {
          const actual: Record<string, unknown> =
            jest.requireActual('prom-client');
          return {
            ...actual,
            Counter: undefined,
            Gauge: undefined,
            Histogram: undefined,
          };
        });
        // Mock @willsoto/nestjs-prometheus ให้ InjectMetric ไม่ใช้ prom-client types
        jest.doMock('@willsoto/nestjs-prometheus', () => {
          const actual: Record<string, unknown> = jest.requireActual(
            '@willsoto/nestjs-prometheus'
          );
          return {
            ...actual,
            InjectMetric: () => () => {},
          };
        });

        const { MetricsService: IsolatedMetricsService } =
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('./metrics.service') as {
            MetricsService: new (
              counter: unknown,
              gauge: unknown,
              histogram: unknown,
              lockFailuresCounter: unknown
            ) => unknown;
          };
        const isolatedService = new IsolatedMetricsService(
          mockCounter,
          mockGauge,
          mockHistogram,
          mockLockFailuresCounter
        );
        expect(isolatedService).toBeDefined();
      });
    });
  });
});
