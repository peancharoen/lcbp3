// File: backend/src/modules/ai/tests/ocr-residency.spec.ts
// Change Log:
// - 2026-06-11: Initial unit tests for adaptive OCR residency

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OcrService } from '../services/ocr.service';
import { VramMonitorService } from '../services/vram-monitor.service';
import { AiPolicyService } from '../services/ai-policy.service';
import { OcrCacheService } from '../services/ocr-cache.service';
import { SystemSetting } from '../entities/system-setting.entity';
import { AiAuditLog } from '../entities/ai-audit-log.entity';

describe('OcrService Adaptive Residency (US2)', () => {
  let service: OcrService;
  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown): unknown => {
      const config: Record<string, unknown> = {
        OCR_CHAR_THRESHOLD: 100,
        OCR_API_URL: 'http://localhost:8765',
        OCR_SIDECAR_API_KEY: 'test-key',
        VRAM_HEADROOM_THRESHOLD_MB: 3000,
        OCR_RESIDENCY_WINDOW_SECONDS: 120,
        GPU_MAIN_MODEL_PRESSURE_THRESHOLD_MB: 12000,
      };
      return config[key] ?? defaultValue;
    }),
  };
  const mockSystemSettingRepo = {
    findOne: jest.fn().mockResolvedValue({
      settingValue: '019505a1-7c3e-7000-8000-abc123def002',
    }),
  };
  const mockAiAuditLogRepo = {
    create: jest.fn().mockReturnValue({}),
    save: jest.fn().mockResolvedValue({}),
  };
  const mockOcrCacheService = {};
  const mockVramMonitorService = {
    getVramHeadroom: jest.fn(),
    hasVramCapacity: jest.fn().mockResolvedValue(true),
  };
  const mockAiPolicyService = {};
  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcrService,
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: getRepositoryToken(SystemSetting),
          useValue: mockSystemSettingRepo,
        },
        {
          provide: getRepositoryToken(AiAuditLog),
          useValue: mockAiAuditLogRepo,
        },
        { provide: OcrCacheService, useValue: mockOcrCacheService },
        { provide: VramMonitorService, useValue: mockVramMonitorService },
        { provide: AiPolicyService, useValue: mockAiPolicyService },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
      ],
    }).compile();
    service = module.get<OcrService>(OcrService);
    jest.clearAllMocks();
  });

  it('ควรคืน keepAliveSeconds=0 เมื่อ activeProfile เป็น deep-analysis (FR-B03)', async () => {
    mockVramMonitorService.getVramHeadroom.mockResolvedValueOnce({
      totalMb: 16384,
      usedMb: 4000,
      availableMb: 12384,
      querySuccess: true,
      mainModelVramMb: 4000,
    });
    const decision = await service.calculateOcrResidency('deep-analysis');
    expect(decision.keepAliveSeconds).toBe(0);
    expect(decision.reason).toBe('deep-analysis-active');
  });

  it('ควรคืน keepAliveSeconds=0 เมื่อ VRAM ของโมเดลหลักเกิน pressure threshold (FR-B03)', async () => {
    mockVramMonitorService.getVramHeadroom.mockResolvedValueOnce({
      totalMb: 16384,
      usedMb: 13000,
      availableMb: 3384,
      querySuccess: true,
      mainModelVramMb: 13000,
    });
    const decision = await service.calculateOcrResidency('standard');
    expect(decision.keepAliveSeconds).toBe(0);
    expect(decision.reason).toBe('high-pressure');
  });

  it('ควรคืน keepAliveSeconds=0 เมื่อ VRAM headroom ต่ำกว่า headroom threshold (FR-B03)', async () => {
    mockVramMonitorService.getVramHeadroom.mockResolvedValueOnce({
      totalMb: 16384,
      usedMb: 14000,
      availableMb: 2384,
      querySuccess: true,
      mainModelVramMb: 8000,
    });
    const decision = await service.calculateOcrResidency('standard');
    expect(decision.keepAliveSeconds).toBe(0);
    expect(decision.reason).toBe('high-pressure');
  });

  it('ควรคืน keepAliveSeconds > 0 (residency window) เมื่อ VRAM เพียงพอและไม่มี pressure (FR-B04)', async () => {
    mockVramMonitorService.getVramHeadroom.mockResolvedValueOnce({
      totalMb: 16384,
      usedMb: 4000,
      availableMb: 12384,
      querySuccess: true,
      mainModelVramMb: 4000,
    });
    const decision = await service.calculateOcrResidency('standard');
    expect(decision.keepAliveSeconds).toBe(120);
    expect(decision.reason).toBe('headroom-sufficient');
  });

  it('ควรคืน keepAliveSeconds=0 และ reason=query-failed เมื่อ query VRAM ล้มเหลว (FR-B05)', async () => {
    mockVramMonitorService.getVramHeadroom.mockResolvedValueOnce({
      totalMb: 16384,
      usedMb: 16384,
      availableMb: 0,
      querySuccess: false,
      mainModelVramMb: 0,
    });
    const decision = await service.calculateOcrResidency('standard');
    expect(decision.keepAliveSeconds).toBe(0);
    expect(decision.reason).toBe('query-failed');
  });
});
