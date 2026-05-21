// File: src/modules/monitoring/services/metrics.service.spec.ts
// Change Log:
// - 2026-05-21: เพิ่ม unit tests สำหรับ MetricsService

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
});
