// File: backend/src/modules/ai/tests/ai-policy.service.spec.ts
// Change Log:
// - 2026-06-11: สร้าง unit tests สำหรับ AiPolicyService (US5)
// - 2026-06-11: แก้ไข DEFAULT_REDIS_TOKEN import เป็นค่าคงที่ string
// - 2026-06-13: เพิ่ม regression tests สำหรับ ADR-036 canonical model และ OCR snapshot
// - 2026-06-13: T019 เพิ่ม tests สำหรับ saveSandboxDraft
// - 2026-06-13: T020 เพิ่ม tests สำหรับ resetSandboxToProduction
// - 2026-06-13: T031-T033 เพิ่ม tests สำหรับ applyProfile และ parameter range validation (US2 Phase 4)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiPolicyService } from '../services/ai-policy.service';
import { AiExecutionProfile } from '../entities/ai-execution-profile.entity';
import { AiSandboxProfile } from '../entities/ai-sandbox-profile.entity';

const DEFAULT_REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('AiPolicyService', () => {
  let service: AiPolicyService;
  const mockProfileRepo = {
    findOne: jest.fn(),
    create: jest.fn((input: unknown) => input),
    save: jest.fn((input: unknown) => Promise.resolve(input)),
  };
  const mockSandboxProfileRepo = {
    findOne: jest.fn(),
    create: jest.fn((input: unknown) => input),
    save: jest.fn((input: unknown) => Promise.resolve(input)),
  };
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
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
        {
          provide: getRepositoryToken(AiSandboxProfile),
          useValue: mockSandboxProfileRepo,
        },
        { provide: DEFAULT_REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();
    service = module.get<AiPolicyService>(AiPolicyService);
  });

  describe('getCanonicalModelName', () => {
    it('ควรคืนค่า np-dms-ocr สำหรับชื่อโมเดลที่มีคำว่า ocr', () => {
      expect(service.getCanonicalModelName('np-dms-ocr:latest')).toBe(
        'np-dms-ocr'
      );
      expect(service.getCanonicalModelName('my-ocr-model')).toBe('np-dms-ocr');
    });

    it('ควรคืนค่า np-dms-ai สำหรับโมเดลอื่นๆ', () => {
      expect(service.getCanonicalModelName('np-dms-ai:latest')).toBe(
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
        canonicalModel: 'np-dms-ai',
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

    it('ควรอ่าน canonicalModel จาก DB row แทน hardcode เป็น np-dms-ai', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockProfileRepo.findOne.mockResolvedValue({
        profileName: 'quality',
        canonicalModel: 'np-dms-ocr',
        isActive: true,
        temperature: 0.2,
        topP: 0.3,
        maxTokens: null,
        numCtx: null,
        repeatPenalty: 1.1,
        keepAliveSeconds: 0,
      });
      const result = await service.getProfileParameters('quality');
      expect(result.canonicalModel).toBe('np-dms-ocr');
      expect(result.maxTokens).toBeNull();
      expect(result.numCtx).toBeNull();
    });

    it('ควร fallback ไปยัง Default parameters เมื่อดึงจาก DB หรือ Redis ล้มเหลว', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis down'));
      mockProfileRepo.findOne.mockRejectedValue(new Error('DB down'));
      const result = await service.getProfileParameters('deep-analysis');
      expect(result.canonicalModel).toBe('np-dms-ai');
      expect(result.keepAliveSeconds).toBe(0);
    });
  });

  describe('getModelDefaults', () => {
    it('ควรดึงพารามิเตอร์ของ model จาก Redis cache เมื่อมี cache hit', async () => {
      const mockPolicy = {
        canonicalModel: 'np-dms-ocr' as const,
        temperature: 0.1,
        topP: 0.15,
        maxTokens: null,
        numCtx: null,
        repeatPenalty: 1.1,
        keepAliveSeconds: 0,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockPolicy));
      const result = await service.getModelDefaults('np-dms-ocr');
      expect(result).toEqual(mockPolicy);
      expect(mockRedis.get).toHaveBeenCalledWith(
        'ai_execution_profiles:model:np-dms-ocr'
      );
      expect(mockProfileRepo.findOne).not.toHaveBeenCalled();
    });

    it('ควรดึงพารามิเตอร์ของ model จาก DB เมื่อ cache miss และบันทึกลง cache', async () => {
      mockRedis.get.mockResolvedValue(null);
      const mockDbProfile = {
        profileName: 'ocr-extract',
        canonicalModel: 'np-dms-ocr',
        isActive: true,
        temperature: 0.12,
        topP: 0.18,
        maxTokens: null,
        numCtx: null,
        repeatPenalty: 1.05,
        keepAliveSeconds: 0,
      };
      mockProfileRepo.findOne.mockResolvedValue(mockDbProfile);
      const result = await service.getModelDefaults('np-dms-ocr');
      expect(result.temperature).toBe(0.12);
      expect(result.canonicalModel).toBe('np-dms-ocr');
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('ควรรวมข้อมูล canonicalModel จากคอลัมน์ canonical_model ใน DB ได้ถูกต้อง', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockProfileRepo.findOne.mockResolvedValue({
        profileName: 'standard',
        canonicalModel: 'np-dms-ai',
        isActive: true,
        temperature: 0.5,
        topP: 0.8,
        maxTokens: 4096,
        numCtx: 8192,
        repeatPenalty: 1.15,
        keepAliveSeconds: 600,
      });
      const result = await service.getModelDefaults('np-dms-ai');
      expect(result.canonicalModel).toBe('np-dms-ai');
    });

    it('ควร fallback ไปยัง default OCR policy เมื่อเกิดข้อผิดพลาดสำหรับ np-dms-ocr', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      mockProfileRepo.findOne.mockRejectedValue(new Error('DB error'));
      const result = await service.getModelDefaults('np-dms-ocr');
      expect(result.canonicalModel).toBe('np-dms-ocr');
      expect(result.temperature).toBe(0.1);
      expect(result.repeatPenalty).toBe(1.1);
    });

    it('ควร fallback ไปยัง default profiles standard เมื่อเกิดข้อผิดพลาดสำหรับ np-dms-ai', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      mockProfileRepo.findOne.mockRejectedValue(new Error('DB error'));
      const result = await service.getModelDefaults('np-dms-ai');
      expect(result.canonicalModel).toBe('np-dms-ai');
      expect(result.temperature).toBe(0.5);
      expect(result.keepAliveSeconds).toBe(600);
    });
  });

  describe('getSandboxParameters', () => {
    it('ควร seed sandbox draft จาก production row เมื่อยังไม่มี draft', async () => {
      mockSandboxProfileRepo.findOne.mockResolvedValue(null);
      mockRedis.get.mockResolvedValue(null);
      mockProfileRepo.findOne.mockResolvedValue({
        profileName: 'standard',
        canonicalModel: 'np-dms-ai',
        isActive: true,
        temperature: 0.4,
        topP: 0.85,
        maxTokens: 3000,
        numCtx: 6000,
        repeatPenalty: 1.2,
        keepAliveSeconds: 400,
      });
      const result = await service.getSandboxParameters('standard');
      expect(mockSandboxProfileRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          profileName: 'standard',
          canonicalModel: 'np-dms-ai',
          temperature: 0.4,
        })
      );
      expect(mockSandboxProfileRepo.save).toHaveBeenCalled();
      expect(result.temperature).toBe(0.4);
      expect(result.maxTokens).toBe(3000);
    });
  });

  describe('saveSandboxDraft', () => {
    it('ควร upsert sandbox profile ด้วยค่าใหม่ที่ระบุ', async () => {
      const existingProfile = {
        profileName: 'standard',
        canonicalModel: 'np-dms-ai',
        temperature: 0.4,
        topP: 0.85,
        maxTokens: 3000,
        numCtx: 6000,
        repeatPenalty: 1.2,
        keepAliveSeconds: 400,
      };
      mockSandboxProfileRepo.findOne.mockResolvedValue(existingProfile);
      mockSandboxProfileRepo.save.mockImplementation((input: unknown) =>
        Promise.resolve(input)
      );
      const result = await service.saveSandboxDraft('standard', {
        temperature: 0.6,
        topP: 0.9,
      });
      expect(mockSandboxProfileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.6,
          topP: 0.9,
          profileName: 'standard',
        })
      );
      expect(result.temperature).toBe(0.6);
    });

    it('ควร create ใหม่เมื่อยังไม่มี sandbox profile', async () => {
      mockSandboxProfileRepo.findOne.mockResolvedValue(null);
      mockRedis.get.mockResolvedValue(null);
      mockProfileRepo.findOne.mockResolvedValue({
        profileName: 'standard',
        canonicalModel: 'np-dms-ai',
        isActive: true,
        temperature: 0.5,
        topP: 0.8,
        maxTokens: 4096,
        numCtx: 8192,
        repeatPenalty: 1.15,
        keepAliveSeconds: 600,
      });
      mockSandboxProfileRepo.save.mockImplementation((input: unknown) =>
        Promise.resolve(input)
      );
      await service.saveSandboxDraft('standard', { temperature: 0.3 });
      expect(mockSandboxProfileRepo.create).toHaveBeenCalled();
      expect(mockSandboxProfileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.3 })
      );
    });
  });

  describe('resetSandboxToProduction', () => {
    it('ควร overwrite sandbox draft ด้วยค่า production ปัจจุบัน', async () => {
      mockRedis.get.mockResolvedValue(null);
      const productionProfile = {
        profileName: 'standard',
        canonicalModel: 'np-dms-ai',
        isActive: true,
        temperature: 0.5,
        topP: 0.8,
        maxTokens: 4096,
        numCtx: 8192,
        repeatPenalty: 1.15,
        keepAliveSeconds: 600,
      };
      mockProfileRepo.findOne.mockResolvedValue(productionProfile);
      mockSandboxProfileRepo.findOne.mockResolvedValue({
        id: 1,
        profileName: 'standard',
        canonicalModel: 'np-dms-ai',
        temperature: 0.9,
        topP: 0.1,
        maxTokens: 100,
        numCtx: 100,
        repeatPenalty: 2.0,
        keepAliveSeconds: 0,
      });
      mockSandboxProfileRepo.save.mockImplementation((input: unknown) =>
        Promise.resolve(input)
      );
      const result = await service.resetSandboxToProduction('standard');
      expect(mockSandboxProfileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5,
          topP: 0.8,
        })
      );
      expect(result.temperature).toBe(0.5);
    });

    it('ควร return production policy หาก sandbox draft ยังไม่มี', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockProfileRepo.findOne.mockResolvedValue(null);
      mockSandboxProfileRepo.findOne.mockResolvedValue(null);
      mockSandboxProfileRepo.save.mockImplementation((input: unknown) =>
        Promise.resolve(input)
      );
      const result = await service.resetSandboxToProduction('standard');
      // ควร fallback เป็น default policy
      expect(result).toBeDefined();
    });
  });

  describe('applyProfile', () => {
    it('ควร copy sandbox draft ไปยัง production profile และลบ cache ใน Redis', async () => {
      const mockDraft = {
        profileName: 'standard',
        canonicalModel: 'np-dms-ai',
        temperature: 0.6,
        topP: 0.85,
        maxTokens: 3000,
        numCtx: 6000,
        repeatPenalty: 1.2,
        keepAliveSeconds: 400,
      };
      mockSandboxProfileRepo.findOne.mockResolvedValue(mockDraft);
      mockProfileRepo.findOne.mockResolvedValue({
        profileName: 'standard',
        canonicalModel: 'np-dms-ai',
        temperature: 0.4,
        topP: 0.8,
        maxTokens: 2000,
        numCtx: 4000,
        repeatPenalty: 1.1,
        keepAliveSeconds: 300,
      });

      const saveSpy = jest.fn((input: unknown) => Promise.resolve(input));
      mockProfileRepo.save = saveSpy;

      const result = await service.applyProfile('standard', 99);

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          profileName: 'standard',
          temperature: 0.6,
          topP: 0.85,
          updatedBy: 99,
        })
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        'ai_execution_profiles:standard'
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        'ai_execution_profiles:model:np-dms-ai'
      );
      expect(result.temperature).toBe(0.6);
    });

    it('ควรโยน Error หากไม่มี sandbox draft', async () => {
      mockSandboxProfileRepo.findOne.mockResolvedValue(null);
      await expect(service.applyProfile('standard')).rejects.toThrow();
    });

    it('ควรโยน Error หาก temperature ไม่อยู่ในช่วง 0-1', async () => {
      const mockDraft = {
        profileName: 'standard',
        canonicalModel: 'np-dms-ai',
        temperature: 1.5,
        topP: 0.85,
        repeatPenalty: 1.2,
        keepAliveSeconds: 400,
      };
      mockSandboxProfileRepo.findOne.mockResolvedValue(mockDraft);
      await expect(service.applyProfile('standard')).rejects.toThrow();
    });

    it('ควรโยน Error หาก topP ไม่อยู่ในช่วง 0-1', async () => {
      const mockDraft = {
        profileName: 'standard',
        canonicalModel: 'np-dms-ai',
        temperature: 0.5,
        topP: -0.1,
        repeatPenalty: 1.2,
        keepAliveSeconds: 400,
      };
      mockSandboxProfileRepo.findOne.mockResolvedValue(mockDraft);
      await expect(service.applyProfile('standard')).rejects.toThrow();
    });

    it('ควรโยน Error หาก repeatPenalty ไม่อยู่ในช่วง 1-2', async () => {
      const mockDraft = {
        profileName: 'standard',
        canonicalModel: 'np-dms-ai',
        temperature: 0.5,
        topP: 0.8,
        repeatPenalty: 0.9,
        keepAliveSeconds: 400,
      };
      mockSandboxProfileRepo.findOne.mockResolvedValue(mockDraft);
      await expect(service.applyProfile('standard')).rejects.toThrow();
    });

    it('ควรโยน Error หาก keepAliveSeconds น้อยกว่า 0', async () => {
      const mockDraft = {
        profileName: 'standard',
        canonicalModel: 'np-dms-ai',
        temperature: 0.5,
        topP: 0.8,
        repeatPenalty: 1.1,
        keepAliveSeconds: -10,
      };
      mockSandboxProfileRepo.findOne.mockResolvedValue(mockDraft);
      await expect(service.applyProfile('standard')).rejects.toThrow();
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

    it('ควรสร้าง OCR snapshot แยกสำหรับงาน OCR โดยไม่ freeze keep_alive', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockProfileRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          profileName: 'ocr-extract',
          canonicalModel: 'np-dms-ocr',
          isActive: true,
          temperature: 0.1,
          topP: 0.2,
          maxTokens: null,
          numCtx: null,
          repeatPenalty: 1.05,
          keepAliveSeconds: 0,
        });
      const payload = await service.createJobPayload('migrate-document');
      expect(payload.canonicalModel).toBe('np-dms-ai');
      expect(payload.ocrSnapshotParams).toEqual({
        temperature: 0.1,
        topP: 0.2,
        repeatPenalty: 1.05,
      });
      expect(payload.ocrSnapshotParams).not.toHaveProperty('keepAliveSeconds');
    });
  });
});
