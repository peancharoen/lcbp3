// File: backend/src/modules/ai/tests/ai-execution-profiles.service.spec.ts
// Change Log:
// - 2026-06-14: สร้าง unit tests สำหรับ AiPolicyService ที่ครอบคลุม execution profile management (T041)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiPolicyService } from '../services/ai-policy.service';
import { AiExecutionProfile } from '../entities/ai-execution-profile.entity';
import { AiSandboxProfile } from '../entities/ai-sandbox-profile.entity';
import { BadRequestException } from '@nestjs/common';

/** Mock Redis สำหรับ inject */
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

/** Mock repository สำหรับ AiExecutionProfile */
const mockProfileRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

/** Mock repository สำหรับ AiSandboxProfile */
const mockSandboxRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

/** สร้าง AiExecutionProfile stub */
const makeProfile = (
  overrides: Partial<AiExecutionProfile> = {}
): AiExecutionProfile =>
  ({
    id: 1,
    profileName: 'standard',
    canonicalModel: 'np-dms-ai',
    temperature: 0.5,
    topP: 0.8,
    maxTokens: 4096,
    numCtx: 8192,
    repeatPenalty: 1.15,
    keepAliveSeconds: 600,
    isActive: true,
    updatedBy: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as AiExecutionProfile;

/** สร้าง AiSandboxProfile stub */
const makeSandbox = (
  overrides: Partial<AiSandboxProfile> = {}
): AiSandboxProfile =>
  ({
    id: 1,
    profileName: 'standard',
    canonicalModel: 'np-dms-ai',
    temperature: 0.6,
    topP: 0.9,
    maxTokens: 4096,
    numCtx: 8192,
    repeatPenalty: 1.15,
    keepAliveSeconds: 600,
    updatedBy: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as AiSandboxProfile;

describe('AiPolicyService — Execution Profile Management (T041)', () => {
  let service: AiPolicyService;

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
          useValue: mockSandboxRepo,
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
      ],
    }).compile();
    service = module.get<AiPolicyService>(AiPolicyService);
  });

  // ─── getCanonicalModelName ───────────────────────────────────────────────────
  describe('getCanonicalModelName()', () => {
    it('ควรคืน np-dms-ocr เมื่อ modelName มีคำว่า ocr', () => {
      expect(service.getCanonicalModelName('np-dms-ocr:latest')).toBe(
        'np-dms-ocr'
      );
    });
    it('ควรคืน np-dms-ocr เมื่อ modelName มีคำว่า typhoon-np-dms-ocr', () => {
      expect(service.getCanonicalModelName('typhoon-np-dms-ocr:latest')).toBe(
        'np-dms-ocr'
      );
    });
    it('ควรคืน np-dms-ai สำหรับ model ทั่วไปที่ไม่มีคำว่า ocr', () => {
      expect(service.getCanonicalModelName('np-dms-ai:latest')).toBe(
        'np-dms-ai'
      );
    });
    it('ควรคืน np-dms-ai สำหรับ typhoon2.5 model (main model)', () => {
      expect(service.getCanonicalModelName('typhoon2.5-np-dms:latest')).toBe(
        'np-dms-ai'
      );
    });
  });

  // ─── getProfileForJobType ────────────────────────────────────────────────────
  describe('getProfileForJobType()', () => {
    it('ควรคืน quality สำหรับ auto-fill-document', () => {
      expect(service.getProfileForJobType('auto-fill-document')).toBe(
        'quality'
      );
    });
    it('ควรคืน quality สำหรับ migrate-document', () => {
      expect(service.getProfileForJobType('migrate-document')).toBe('quality');
    });
    it('ควรคืน standard สำหรับ rag-query', () => {
      expect(service.getProfileForJobType('rag-query')).toBe('standard');
    });
    it('ควรคืน interactive สำหรับ intent-classify', () => {
      expect(service.getProfileForJobType('intent-classify')).toBe(
        'interactive'
      );
    });
    it('ควรคืน interactive สำหรับ tool-suggest', () => {
      expect(service.getProfileForJobType('tool-suggest')).toBe('interactive');
    });
    it('ควรคืน deep-analysis สำหรับ sandbox-analysis', () => {
      expect(service.getProfileForJobType('sandbox-analysis')).toBe(
        'deep-analysis'
      );
    });
    it('ควรคืน standard เป็น default สำหรับ ocr-extract', () => {
      expect(service.getProfileForJobType('ocr-extract')).toBe('standard');
    });
  });

  // ─── getProfileParameters ────────────────────────────────────────────────────
  describe('getProfileParameters()', () => {
    it('ควรคืนจาก Redis cache เมื่อมี cache hit', async () => {
      const cachedPolicy = {
        canonicalModel: 'np-dms-ai',
        temperature: 0.5,
        topP: 0.8,
        maxTokens: 4096,
        numCtx: 8192,
        repeatPenalty: 1.15,
        keepAliveSeconds: 600,
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedPolicy));
      const result = await service.getProfileParameters('standard');
      expect(result.temperature).toBe(0.5);
      expect(mockProfileRepo.findOne).not.toHaveBeenCalled();
    });

    it('ควร fallback ไปยัง DB เมื่อ Redis cache miss', async () => {
      mockRedis.get.mockResolvedValueOnce(null); // cache miss
      mockProfileRepo.findOne.mockResolvedValueOnce(
        makeProfile({ temperature: 0.3 })
      );
      mockRedis.set.mockResolvedValueOnce('OK');
      const result = await service.getProfileParameters('standard');
      expect(result.temperature).toBe(0.3);
      expect(mockProfileRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('ควร fallback ไปยัง hardcoded defaults เมื่อ DB ก็ไม่มีข้อมูล', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockProfileRepo.findOne.mockResolvedValueOnce(null); // ไม่มีใน DB
      const result = await service.getProfileParameters('quality');
      expect(result.temperature).toBe(0.1); // default quality profile
    });

    it('ควร fallback ไปยัง DB เมื่อ Redis throw error', async () => {
      mockRedis.get.mockRejectedValueOnce(new Error('Redis CONN error'));
      mockProfileRepo.findOne.mockResolvedValueOnce(makeProfile());
      mockRedis.set.mockResolvedValueOnce('OK');
      const result = await service.getProfileParameters('standard');
      expect(result).toBeDefined();
    });

    it('ควร fallback ไปยัง defaults เมื่อ DB ก็ throw error', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockProfileRepo.findOne.mockRejectedValueOnce(new Error('DB timeout'));
      const result = await service.getProfileParameters('interactive');
      expect(result.temperature).toBe(0.7); // default interactive profile
    });

    it('ควรไม่ throw เมื่อ cache write ล้มเหลว (graceful)', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockProfileRepo.findOne.mockResolvedValueOnce(makeProfile());
      mockRedis.set.mockRejectedValueOnce(new Error('Redis write failed'));
      const result = await service.getProfileParameters('standard');
      expect(result).toBeDefined();
    });
  });

  // ─── getModelDefaults ────────────────────────────────────────────────────────
  describe('getModelDefaults()', () => {
    it('ควรคืนจาก Redis cache เมื่อมี cache hit', async () => {
      const cachedOcrPolicy = {
        canonicalModel: 'np-dms-ocr',
        temperature: 0.1,
        topP: 0.1,
        maxTokens: null,
        numCtx: null,
        repeatPenalty: 1.1,
        keepAliveSeconds: 0,
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedOcrPolicy));
      const result = await service.getModelDefaults('np-dms-ocr');
      expect(result.canonicalModel).toBe('np-dms-ocr');
      expect(result.temperature).toBe(0.1);
    });

    it('ควร fallback ไปยัง DB เมื่อ Redis cache miss', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockProfileRepo.findOne.mockResolvedValueOnce(
        makeProfile({ canonicalModel: 'np-dms-ocr', temperature: 0.05 })
      );
      mockRedis.set.mockResolvedValueOnce('OK');
      const result = await service.getModelDefaults('np-dms-ocr');
      expect(result.temperature).toBe(0.05);
    });

    it('ควรคืน defaultOcrPolicy เมื่อไม่มีใน DB (np-dms-ocr)', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockProfileRepo.findOne.mockResolvedValueOnce(null);
      const result = await service.getModelDefaults('np-dms-ocr');
      expect(result.canonicalModel).toBe('np-dms-ocr');
      expect(result.keepAliveSeconds).toBe(0);
    });

    it('ควรคืน standard defaults เมื่อไม่มีใน DB (np-dms-ai)', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockProfileRepo.findOne.mockResolvedValueOnce(null);
      const result = await service.getModelDefaults('np-dms-ai');
      expect(result.canonicalModel).toBe('np-dms-ai');
    });
  });

  // ─── saveSandboxDraft ────────────────────────────────────────────────────────
  describe('saveSandboxDraft()', () => {
    it('ควรอัปเดต draft ที่มีอยู่แล้ว', async () => {
      const existingDraft = makeSandbox({ temperature: 0.5 });
      mockSandboxRepo.findOne.mockResolvedValueOnce(existingDraft);
      mockSandboxRepo.save.mockResolvedValueOnce({
        ...existingDraft,
        temperature: 0.8,
      });
      const result = await service.saveSandboxDraft('standard', {
        temperature: 0.8,
      });
      expect(result.temperature).toBe(0.8);
    });

    it('ควรสร้าง draft ใหม่จาก production เมื่อยังไม่มี draft', async () => {
      mockSandboxRepo.findOne.mockResolvedValueOnce(null); // ไม่มี draft
      // getProductionPolicy → getProfileParameters → Redis miss → DB
      mockRedis.get.mockResolvedValueOnce(null);
      mockProfileRepo.findOne.mockResolvedValueOnce(makeProfile());
      mockRedis.set.mockResolvedValueOnce('OK');
      const newDraft = makeSandbox({ topP: 0.9 });
      mockSandboxRepo.create.mockReturnValueOnce(newDraft);
      mockSandboxRepo.save.mockResolvedValueOnce({ ...newDraft, topP: 0.9 });
      const result = await service.saveSandboxDraft(
        'standard',
        { topP: 0.9 },
        1
      );
      expect(result.topP).toBe(0.9);
    });
  });

  // ─── resetSandboxToProduction ────────────────────────────────────────────────
  describe('resetSandboxToProduction()', () => {
    it('ควร reset draft ที่มีอยู่ให้ตรงกับ production', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockProfileRepo.findOne.mockResolvedValueOnce(
        makeProfile({ temperature: 0.5 })
      );
      mockRedis.set.mockResolvedValueOnce('OK');
      const existingDraft = makeSandbox({ temperature: 0.9 });
      mockSandboxRepo.findOne.mockResolvedValueOnce(existingDraft);
      mockSandboxRepo.save.mockResolvedValueOnce({
        ...existingDraft,
        temperature: 0.5,
      });
      const result = await service.resetSandboxToProduction('standard', 1);
      expect(result.temperature).toBe(0.5);
    });

    it('ควรสร้าง draft ใหม่เมื่อยังไม่มี draft แล้ว reset ไปยัง production', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockProfileRepo.findOne.mockResolvedValueOnce(
        makeProfile({ temperature: 0.5 })
      );
      mockRedis.set.mockResolvedValueOnce('OK');
      mockSandboxRepo.findOne.mockResolvedValueOnce(null); // ไม่มี draft
      const newDraft = makeSandbox();
      mockSandboxRepo.create.mockReturnValueOnce(newDraft);
      mockSandboxRepo.save.mockResolvedValueOnce({
        ...newDraft,
        temperature: 0.5,
      });
      const result = await service.resetSandboxToProduction('standard');
      expect(result).toBeDefined();
    });
  });

  // ─── createJobPayload ────────────────────────────────────────────────────────
  describe('createJobPayload()', () => {
    it('ควรสร้าง payload ที่ถูกต้องสำหรับ rag-query job', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockProfileRepo.findOne.mockResolvedValue(makeProfile());
      mockRedis.set.mockResolvedValue('OK');
      const payload = await service.createJobPayload(
        'rag-query',
        'doc-id-123',
        'att-id-456'
      );
      expect(payload.jobType).toBe('rag-query');
      expect(payload.documentPublicId).toBe('doc-id-123');
      expect(payload.canonicalModel).toBe('np-dms-ai');
      expect(payload.snapshotParams.temperature).toBeDefined();
      expect(payload.ocrSnapshotParams).toBeUndefined(); // rag-query ไม่มี OCR snapshot
    });

    it('ควรสร้าง payload ที่มี ocrSnapshotParams สำหรับ migrate-document job', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockProfileRepo.findOne.mockResolvedValue(makeProfile());
      mockRedis.set.mockResolvedValue('OK');
      const payload = await service.createJobPayload(
        'migrate-document',
        'doc-id-789'
      );
      expect(payload.canonicalModel).toBe('np-dms-ai'); // main model for migrate
      expect(payload.ocrSnapshotParams).toBeDefined();
      expect(payload.ocrSnapshotParams?.temperature).toBeDefined();
    });

    it('ควรสร้าง payload ที่ใช้ np-dms-ocr สำหรับ ocr-extract job', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockProfileRepo.findOne.mockResolvedValue(
        makeProfile({ canonicalModel: 'np-dms-ocr', temperature: 0.1 })
      );
      mockRedis.set.mockResolvedValue('OK');
      const payload = await service.createJobPayload(
        'ocr-extract',
        'doc-id-ocr'
      );
      expect(payload.canonicalModel).toBe('np-dms-ocr');
      expect(payload.ocrSnapshotParams).toBeDefined();
    });
  });

  // ─── applyProfile validation ─────────────────────────────────────────────────
  describe('applyProfile() — parameter validation', () => {
    it('ควรโยน BadRequestException เมื่อ temperature > 1', async () => {
      const draft = makeSandbox({ temperature: 1.5, profileName: 'standard' });
      mockSandboxRepo.findOne.mockResolvedValueOnce(draft);
      await expect(service.applyProfile('standard', 1)).rejects.toBeInstanceOf(
        BadRequestException
      );
    });

    it('ควรโยน BadRequestException เมื่อ topP < 0', async () => {
      const draft = makeSandbox({
        temperature: 0.5,
        topP: -0.1,
        profileName: 'standard',
      });
      mockSandboxRepo.findOne.mockResolvedValueOnce(draft);
      await expect(service.applyProfile('standard', 1)).rejects.toBeInstanceOf(
        BadRequestException
      );
    });

    it('ควรโยน BadRequestException เมื่อ repeatPenalty < 1', async () => {
      const draft = makeSandbox({
        temperature: 0.5,
        topP: 0.8,
        repeatPenalty: 0.9,
        profileName: 'standard',
      });
      mockSandboxRepo.findOne.mockResolvedValueOnce(draft);
      await expect(service.applyProfile('standard')).rejects.toBeInstanceOf(
        BadRequestException
      );
    });

    it('ควรโยน BadRequestException เมื่อ keepAliveSeconds < 0', async () => {
      const draft = makeSandbox({
        temperature: 0.5,
        topP: 0.8,
        repeatPenalty: 1.1,
        keepAliveSeconds: -1,
        profileName: 'standard',
      });
      mockSandboxRepo.findOne.mockResolvedValueOnce(draft);
      await expect(service.applyProfile('standard')).rejects.toBeInstanceOf(
        BadRequestException
      );
    });
  });
});
