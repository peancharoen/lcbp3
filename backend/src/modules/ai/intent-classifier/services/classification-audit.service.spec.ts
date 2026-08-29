// File: backend/src/modules/ai/intent-classifier/services/classification-audit.service.spec.ts
// Change Log:
// - 2026-08-26: สร้าง unit test สำหรับ ClassificationAuditService ครอบคลุม log และ mapStatus (FR-010, ADR-024)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClassificationAuditService } from './classification-audit.service';
import { AiAuditLog, AiAuditStatus } from '../../entities/ai-audit-log.entity';
import type {
  ClassificationInput,
  ClassificationResult,
} from '../interfaces/classification-result.interface';

describe('ClassificationAuditService', () => {
  let service: ClassificationAuditService;
  const mockAuditRepo = {
    create: jest.fn((data: unknown) => data),
    save: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassificationAuditService,
        {
          provide: getRepositoryToken(AiAuditLog),
          useValue: mockAuditRepo,
        },
      ],
    }).compile();
    service = module.get<ClassificationAuditService>(
      ClassificationAuditService
    );
  });

  it('ควรสร้าง instance ได้', () => {
    expect(service).toBeDefined();
  });

  describe('log()', () => {
    const baseInput: ClassificationInput = {
      query: 'show me RFA documents',
      projectPublicId: 'proj-uuid-123',
      userPublicId: 'user-uuid-456',
      currentDocumentId: 'doc-uuid-789',
    };

    it('ควรบันทึก audit log สำเร็จเมื่อ method=pattern', async () => {
      const result: ClassificationResult = {
        intentCode: 'GET_RFA',
        confidence: 1.0,
        method: 'pattern',
        latencyMs: 5,
      };
      await service.log({ input: baseInput, result });
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          aiModel: 'intent-classifier',
          modelName: 'pattern-match',
          status: AiAuditStatus.SUCCESS,
          confidenceScore: 1.0,
        })
      );
      expect(mockAuditRepo.save).toHaveBeenCalled();
    });

    it('ควรตั้ง modelName เป็น gemma4:e4b เมื่อ method=llm_fallback', async () => {
      const result: ClassificationResult = {
        intentCode: 'RAG_QUERY',
        confidence: 0.85,
        method: 'llm_fallback',
        latencyMs: 120,
      };
      await service.log({ input: baseInput, result });
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: 'gemma4:e4b',
          status: AiAuditStatus.SUCCESS,
        })
      );
    });

    it('ควรตั้ง status เป็น FAILED เมื่อ method=llm_error', async () => {
      const result: ClassificationResult = {
        intentCode: 'FALLBACK',
        confidence: 0,
        method: 'llm_error',
        latencyMs: 5000,
      };
      await service.log({ input: baseInput, result });
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AiAuditStatus.FAILED,
        })
      );
    });

    it('ควรตั้ง status เป็น FAILED เมื่อ method=semaphore_overflow', async () => {
      const result: ClassificationResult = {
        intentCode: 'FALLBACK',
        confidence: 0,
        method: 'semaphore_overflow',
        latencyMs: 10,
      };
      await service.log({ input: baseInput, result });
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AiAuditStatus.FAILED,
        })
      );
    });

    it('ควรคำนวณ inputHash และ outputHash ด้วย SHA-256', async () => {
      const result: ClassificationResult = {
        intentCode: 'GET_RFA',
        confidence: 1.0,
        method: 'pattern',
        latencyMs: 5,
      };
      await service.log({ input: baseInput, result });
      const createCall = mockAuditRepo.create.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(createCall['inputHash']).toBeTruthy();
      expect(typeof createCall['inputHash']).toBe('string');
      expect(createCall['outputHash']).toBeTruthy();
      expect(typeof createCall['outputHash']).toBe('string');
    });

    it('ควรไม่ throw เมื่อ save ล้มเหลว (fire-and-forget)', async () => {
      mockAuditRepo.save.mockRejectedValueOnce(new Error('DB down'));
      const result: ClassificationResult = {
        intentCode: 'GET_RFA',
        confidence: 1.0,
        method: 'pattern',
        latencyMs: 5,
      };
      await expect(
        service.log({ input: baseInput, result })
      ).resolves.toBeUndefined();
    });

    it('ควรไม่ throw เมื่อ error ไม่ใช่ Error instance', async () => {
      mockAuditRepo.save.mockRejectedValueOnce('string error');
      const result: ClassificationResult = {
        intentCode: 'GET_RFA',
        confidence: 1.0,
        method: 'pattern',
        latencyMs: 5,
      };
      await expect(
        service.log({ input: baseInput, result })
      ).resolves.toBeUndefined();
    });

    it('ควรจัดการ input ที่มี field เป็น undefined', async () => {
      const partialInput: ClassificationInput = {
        query: 'test query',
      };
      const result: ClassificationResult = {
        intentCode: 'FALLBACK',
        confidence: 0,
        method: 'pattern',
        latencyMs: 1,
      };
      await service.log({ input: partialInput, result });
      expect(mockAuditRepo.save).toHaveBeenCalled();
    });
  });
});
