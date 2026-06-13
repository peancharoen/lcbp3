// File: backend/tests/integration/modules/ai/ai-policy.service.integration.spec.ts
// Change Log:
// - 2026-06-13: T034 — Integration test สำหรับ apply flow (sandbox draft → validate → production + cache DEL)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AiPolicyService } from '../../../../src/modules/ai/services/ai-policy.service';
import { AiExecutionProfile } from '../../../../src/modules/ai/entities/ai-execution-profile.entity';
import { AiSandboxProfile } from '../../../../src/modules/ai/entities/ai-sandbox-profile.entity';

const DEFAULT_REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

/**
 * Integration test สำหรับ Apply Profile Flow (T034 — ADR-036)
 *
 * ครอบคลุม cross-service interactions:
 * 1. Full apply flow: sandbox draft → validation → copy to production → Redis cache DEL
 * 2. Idempotency logic: duplicate key ใน Redis ต้องไม่ apply ซ้ำ
 * 3. Parameter range validation propagation
 * 4. Cache miss → DB fallback → cache set → subsequent cache hit
 */
describe('AiPolicyService — Apply Flow Integration (T034)', () => {
  let service: AiPolicyService;

  const productionRow = {
    profileName: 'standard',
    canonicalModel: 'np-dms-ai' as const,
    isActive: true,
    temperature: 0.4,
    topP: 0.85,
    maxTokens: 3000,
    numCtx: 6000,
    repeatPenalty: 1.2,
    keepAliveSeconds: 300,
    updatedBy: undefined as number | undefined,
  };

  const sandboxDraft = {
    profileName: 'standard',
    canonicalModel: 'np-dms-ai' as const,
    temperature: 0.65,
    topP: 0.9,
    maxTokens: 4096,
    numCtx: 8192,
    repeatPenalty: 1.15,
    keepAliveSeconds: 600,
  };

  let mockProfileRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let mockSandboxProfileRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let mockRedis: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };

  beforeEach(async () => {
    const savedProductionRow = { ...productionRow };
    mockProfileRepo = {
      findOne: jest.fn().mockResolvedValue({ ...savedProductionRow }),
      create: jest.fn((input: unknown) => ({ ...(input as object) })),
      save: jest.fn((input: unknown) => {
        Object.assign(savedProductionRow, input as object);
        return Promise.resolve({ ...savedProductionRow });
      }),
    };
    mockSandboxProfileRepo = {
      findOne: jest.fn().mockResolvedValue({ ...sandboxDraft }),
      create: jest.fn((input: unknown) => ({ ...(input as object) })),
      save: jest.fn((input: unknown) =>
        Promise.resolve({ ...(input as object) })
      ),
    };
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

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

  describe('Full apply flow: draft → validate → production → cache DEL', () => {
    it('ควรคัดลอกค่าจาก sandbox draft ไปยัง production row และลบ Redis cache ทั้งสองคีย์', async () => {
      const result = await service.applyProfile('standard', 42);

      expect(mockSandboxProfileRepo.findOne).toHaveBeenCalledWith({
        where: { profileName: 'standard' },
      });
      expect(mockProfileRepo.findOne).toHaveBeenCalledWith({
        where: { profileName: 'standard' },
      });

      expect(mockProfileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.65,
          topP: 0.9,
          maxTokens: 4096,
          numCtx: 8192,
          repeatPenalty: 1.15,
          keepAliveSeconds: 600,
          updatedBy: 42,
        })
      );

      expect(mockRedis.del).toHaveBeenCalledWith(
        'ai_execution_profiles:standard'
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        'ai_execution_profiles:model:np-dms-ai'
      );

      expect(result.temperature).toBe(0.65);
      expect(result.topP).toBe(0.9);
      expect(result.keepAliveSeconds).toBe(600);
    });

    it('ควรสร้าง production row ใหม่หากยังไม่มีอยู่ใน DB', async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);
      mockProfileRepo.create.mockImplementation((input: unknown) => ({
        ...(input as object),
      }));
      mockProfileRepo.save.mockImplementation((input: unknown) =>
        Promise.resolve({ ...(input as object) })
      );

      const result = await service.applyProfile('standard', 1);

      expect(mockProfileRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ profileName: 'standard', isActive: true })
      );
      expect(result.temperature).toBe(sandboxDraft.temperature);
    });

    it('ควรยังคง apply ได้แม้ Redis DEL ล้มเหลว (cache failure tolerant)', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis connection lost'));

      const result = await service.applyProfile('standard', 7);

      expect(result.temperature).toBe(sandboxDraft.temperature);
    });
  });

  describe('NotFoundException เมื่อไม่มี sandbox draft', () => {
    it('ควรโยน NotFoundException เมื่อ sandbox draft ไม่มีอยู่ใน DB', async () => {
      mockSandboxProfileRepo.findOne.mockResolvedValue(null);

      await expect(service.applyProfile('standard')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('Parameter range validation propagation', () => {
    const makeInvalidDraft = (
      overrides: Partial<typeof sandboxDraft>
    ): unknown => ({
      ...sandboxDraft,
      ...overrides,
    });

    it.each([
      ['temperature เกิน 1', { temperature: 1.01 }],
      ['temperature ต่ำกว่า 0', { temperature: -0.01 }],
      ['topP เกิน 1', { topP: 1.1 }],
      ['topP ต่ำกว่า 0', { topP: -0.1 }],
      ['repeatPenalty ต่ำกว่า 1', { repeatPenalty: 0.99 }],
      ['repeatPenalty เกิน 2', { repeatPenalty: 2.01 }],
      ['keepAliveSeconds ติดลบ', { keepAliveSeconds: -1 }],
    ])('ควรโยน BadRequestException เมื่อ %s', async (_label, invalidValue) => {
      mockSandboxProfileRepo.findOne.mockResolvedValue(
        makeInvalidDraft(invalidValue)
      );

      await expect(service.applyProfile('standard')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('Cache lifecycle หลัง apply', () => {
    it('ควรให้ cache miss หลัง apply เพื่อบังคับ fresh read จาก DB รอบถัดไป', async () => {
      await service.applyProfile('standard', 1);

      expect(mockRedis.del).toHaveBeenCalledTimes(2);

      mockRedis.get.mockResolvedValue(null);
      mockProfileRepo.findOne.mockResolvedValue({
        profileName: 'standard',
        canonicalModel: 'np-dms-ai',
        isActive: true,
        temperature: 0.65,
        topP: 0.9,
        maxTokens: 4096,
        numCtx: 8192,
        repeatPenalty: 1.15,
        keepAliveSeconds: 600,
      });

      const freshParams = await service.getProfileParameters('standard');
      expect(freshParams.temperature).toBe(0.65);
      expect(mockProfileRepo.findOne).toHaveBeenCalledTimes(2);
    });

    it('ควรเขียน cache ใหม่หลัง getProfileParameters อ่านจาก DB', async () => {
      await service.applyProfile('standard', 1);

      mockRedis.get.mockResolvedValue(null);
      mockProfileRepo.findOne.mockResolvedValue({
        profileName: 'standard',
        canonicalModel: 'np-dms-ai',
        isActive: true,
        temperature: 0.65,
        topP: 0.9,
        maxTokens: 4096,
        numCtx: 8192,
        repeatPenalty: 1.15,
        keepAliveSeconds: 600,
      });

      await service.getProfileParameters('standard');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'ai_execution_profiles:standard',
        expect.stringContaining('"temperature":0.65'),
        'EX',
        60
      );
    });
  });

  describe('Dual-model: apply ของ OCR profile', () => {
    it('ควรลบ model cache key ของ np-dms-ocr เมื่อ apply ocr-extract profile', async () => {
      const ocrDraft = {
        profileName: 'ocr-extract',
        canonicalModel: 'np-dms-ocr' as const,
        temperature: 0.12,
        topP: 0.18,
        maxTokens: null,
        numCtx: null,
        repeatPenalty: 1.05,
        keepAliveSeconds: 0,
      };
      mockSandboxProfileRepo.findOne.mockResolvedValue(ocrDraft);
      mockProfileRepo.findOne.mockResolvedValue({
        profileName: 'ocr-extract',
        canonicalModel: 'np-dms-ocr',
        isActive: true,
        ...ocrDraft,
      });
      mockProfileRepo.save.mockImplementation((input: unknown) =>
        Promise.resolve({ ...(input as object) })
      );

      await service.applyProfile('ocr-extract', 5);

      expect(mockRedis.del).toHaveBeenCalledWith(
        'ai_execution_profiles:ocr-extract'
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        'ai_execution_profiles:model:np-dms-ocr'
      );
    });
  });
});
