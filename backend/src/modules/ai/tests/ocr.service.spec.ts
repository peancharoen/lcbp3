// File: backend/src/modules/ai/tests/ocr.service.spec.ts
// Change Log:
// - 2026-06-13: Initial unit tests for OCR parameter wiring (T066)
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OcrService } from '../services/ocr.service';
import { VramMonitorService } from '../services/vram-monitor.service';
import { AiPolicyService } from '../services/ai-policy.service';
import { OcrCacheService } from '../services/ocr-cache.service';
import { SystemSetting } from '../entities/system-setting.entity';
import { AiAuditLog } from '../entities/ai-audit-log.entity';
import axios from 'axios';
import * as fs from 'fs';
jest.mock('axios');
jest.mock('fs');
describe('OcrService Parameter Wiring (T066)', () => {
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
    getVramHeadroom: jest.fn().mockResolvedValue({
      totalMb: 16384,
      usedMb: 4000,
      availableMb: 12384,
      querySuccess: true,
      mainModelVramMb: 4000,
    }),
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
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('PDF content'));
    (axios.post as jest.Mock).mockResolvedValue({
      data: { text: 'OCR Result Text' },
    });
  });
  it('ควรส่ง parameter temperature, topP, repeatPenalty ไปยัง sidecar ผ่าน FormData เมื่อเรียก detectAndExtract', async () => {
    await service.detectAndExtract({
      pdfPath: '/path/to/test.pdf',
      documentPublicId: 'doc-123',
      typhoonOptions: {
        temperature: 0.15,
        topP: 0.65,
        repeatPenalty: 1.15,
      },
    });
    expect(axios.post).toHaveBeenCalled();
    const mockPost = axios.post as jest.Mock<
      Promise<unknown>,
      [string, FormData, unknown]
    >;
    const postCallArgs = mockPost.mock.calls[0];
    const url = postCallArgs[0];
    const formData = postCallArgs[1];
    expect(url).toBe('http://localhost:8765/ocr-upload');
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('engine')).toBe('typhoon-np-dms-ocr');
    expect(formData.get('temperature')).toBe('0.15');
    expect(formData.get('topP')).toBe('0.65');
    expect(formData.get('repeatPenalty')).toBe('1.15');
  });
});
