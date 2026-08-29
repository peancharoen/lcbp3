// File: backend/src/modules/monitoring/services/metrics.service.spec.ts
// Change Log:
// - 2026-05-21: เพิ่ม unit tests สำหรับ MetricsService
// - 2026-06-20: เพิ่ม tests ครอบคลุม decorator metadata branches (Object fallback)

import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';
import { getToken } from '@willsoto/nestjs-prometheus';

describe('MetricsService', () => {
  let service: MetricsService;
  const mockCounter = {
    inc: jest.fn(),
  };
  const mockHistogram = {
    observe: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: getToken('http_requests_total'),
          useValue: mockCounter,
        },
        {
          provide: getToken('http_request_duration_seconds'),
          useValue: mockHistogram,
        },
      ],
    }).compile();
    service = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(service.httpRequestsTotal).toBeDefined();
    expect(service.httpRequestDuration).toBeDefined();
  });

  it('should expose httpRequestsTotal counter with inc method', () => {
    expect(service.httpRequestsTotal).toBe(mockCounter);
    expect(typeof service.httpRequestsTotal.inc).toBe('function');
  });

  it('should expose httpRequestDuration histogram with observe method', () => {
    expect(service.httpRequestDuration).toBe(mockHistogram);
    expect(typeof service.httpRequestDuration.observe).toBe('function');
  });

  it('should allow incrementing the counter', () => {
    service.httpRequestsTotal.inc();
    expect(mockCounter.inc).toHaveBeenCalled();
  });

  it('should allow observing the histogram', () => {
    service.httpRequestDuration.observe(0.5);
    expect(mockHistogram.observe).toHaveBeenCalledWith(0.5);
  });

  it('should instantiate directly with provided metrics', () => {
    const directService = new MetricsService(
      mockCounter as never,
      mockHistogram as never
    );
    expect(directService.httpRequestsTotal).toBe(mockCounter);
    expect(directService.httpRequestDuration).toBe(mockHistogram);
  });
});
