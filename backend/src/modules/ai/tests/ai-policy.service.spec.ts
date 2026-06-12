// File: backend/src/modules/ai/tests/ai-policy.service.spec.ts
// Change Log:
// - 2026-06-11: สร้าง unit tests สำหรับ AiPolicyService (US5)
// - 2026-06-11: แก้ไข DEFAULT_REDIS_TOKEN import เป็นค่าคงที่ string

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiPolicyService } from '../services/ai-policy.service';
import { AiExecutionProfile } from '../entities/ai-execution-profile.entity';

const DEFAULT_REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('AiPolicyService', () => {
  let service: AiPolicyService;
  const mockProfileRepo = {
    findOne: jest.fn(),
  };
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiPolicyService,
        {
          provide: getRepositoryToken(AiExecutionProfile),
          useValue: mockProfileRepo,
        },
        { provide: DEFAULT_REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();
    service = module.get<AiPolicyService>(AiPolicyService);
  });

  describe('getCanonicalModelName', () => {
    it('ควรคืนค่า np-dms-ocr สำหรับชื่อโมเดลที่มีคำว่า ocr', () => {
      expect(service.getCanonicalModelName('typhoon-np-dms-ocr:latest')).toBe(
        'np-dms-ocr'
      );
      expect(service.getCanonicalModelName('my-ocr-model')).toBe('np-dms-ocr');
    });

    it('ควรคืนค่า np-dms-ai สำหรับโมเดลอื่นๆ', () => {
      expect(service.getCanonicalModelName('typhoon2.5-np-dms:latest')).toBe(
        'np-dms-ai'
      );
      expect(service.getCanonicalModelName('gemma')).toBe('np-dms-ai');
    });
  });

  describe('getProfileForJobType', () => {
    it('ควร map job type ต่างๆ เป็น profile ที่ถูกต้อง', () => {
      expect(service.getProfileForJobType('auto-fill-document')).toBe(
        'quality'
      );
      expect(service.getProfileForJobType('migrate-document')).toBe('quality');
      expect(service.getProfileForJobType('rag-query')).toBe('standard');
      expect(service.getProfileForJobType('intent-classify')).toBe(
        'interactive'
      );
      expect(service.getProfileForJobType('tool-suggest')).toBe('interactive');
      expect(service.getProfileForJobType('sandbox-analysis')).toBe(
        'deep-analysis'
      );
      expect(service.getProfileForJobType('ocr-extract')).toBe('standard');
    });
  });

  describe('getProfileParameters', () => {
    it('ควรดึงพารามิเตอร์จาก Redis cache เมื่อมี cache hit', async () => {
      const mockPolicy = {
        canonicalModel: 'np-dms-ai' as const,
        temperature: 0.2,
        topP: 0.9,
        maxTokens: 1000,
        numCtx: 4000,
        repeatPenalty: 1.1,
        keepAliveSeconds: 120,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockPolicy));
      const result = await service.getProfileParameters('standard');
      expect(result).toEqual(mockPolicy);
      expect(mockRedis.get).toHaveBeenCalledWith(
        'ai_execution_profiles:standard'
      );
      expect(mockProfileRepo.findOne).not.toHaveBeenCalled();
    });

    it('ควรดึงพารามิเตอร์จาก DB เมื่อ cache miss และบันทึกลง cache', async () => {
      mockRedis.get.mockResolvedValue(null);
      const mockDbProfile = {
        profileName: 'standard',
        isActive: true,
        temperature: 0.4,
        topP: 0.85,
        maxTokens: 3000,
        numCtx: 6000,
        repeatPenalty: 1.2,
        keepAliveSeconds: 400,
      };
      mockProfileRepo.findOne.mockResolvedValue(mockDbProfile);
      const result = await service.getProfileParameters('standard');
      expect(result.temperature).toBe(0.4);
      expect(result.maxTokens).toBe(3000);
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('ควร fallback ไปยัง Default parameters เมื่อดึงจาก DB หรือ Redis ล้มเหลว', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis down'));
      mockProfileRepo.findOne.mockRejectedValue(new Error('DB down'));
      const result = await service.getProfileParameters('deep-analysis');
      expect(result.canonicalModel).toBe('np-dms-ai');
      expect(result.keepAliveSeconds).toBe(0);
    });
  });

  describe('createJobPayload', () => {
    it('ควรสร้าง payload ของ BullMQ job ที่มี snapshot parameters ครบถ้วน', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockProfileRepo.findOne.mockResolvedValue(null); // ใช้ default
      const payload = await service.createJobPayload(
        'rag-query',
        'doc-1',
        'attach-1'
      );
      expect(payload.jobType).toBe('rag-query');
      expect(payload.documentPublicId).toBe('doc-1');
      expect(payload.attachmentPublicId).toBe('attach-1');
      expect(payload.effectiveProfile).toBe('standard');
      expect(payload.canonicalModel).toBe('np-dms-ai');
      expect(payload.snapshotParams).toBeDefined();
      expect(payload.snapshotParams.temperature).toBe(0.5);
    });
  });
});
