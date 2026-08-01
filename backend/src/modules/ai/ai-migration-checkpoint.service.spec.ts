// File: src/modules/ai/ai-migration-checkpoint.service.spec.ts
// Change Log
// - 2026-05-24: เพิ่ม regression tests สำหรับ migration error enum normalization และ job_id logging.
// - 2026-08-01: เพิ่ม unit tests สำหรับ upsertQueueRecord (Tier 2 #8) — ครอบ insert, update, UUID resolution, status mapping.

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AiMigrationCheckpointService } from './ai-migration-checkpoint.service';
import { MigrationProgress } from './entities/migration-progress.entity';
import { MigrationReviewRecord } from './entities/migration-review.entity';

describe('AiMigrationCheckpointService', () => {
  const mockProgressRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockReviewRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockDataSource = {
    query: jest.fn(),
    manager: {
      query: jest.fn(),
    },
  };

  let service: AiMigrationCheckpointService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDataSource.query.mockResolvedValue([{ insertId: 99 }]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiMigrationCheckpointService,
        {
          provide: getRepositoryToken(MigrationProgress),
          useValue: mockProgressRepo,
        },
        {
          provide: getRepositoryToken(MigrationReviewRecord),
          useValue: mockReviewRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get(AiMigrationCheckpointService);
  });

  it('ควร map AI_JOB_FAILED เป็น API_ERROR และบันทึก job_id', async () => {
    await expect(
      service.logError({
        batchId: 'C22024-MIGRATION',
        documentNumber: 'LCB-RFA-001',
        errorType: 'AI_JOB_FAILED',
        errorMessage: 'AI job failed',
        jobId: 'job-123',
      })
    ).resolves.toEqual({ id: 99 });

    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('job_id'),
      [
        'C22024-MIGRATION',
        'LCB-RFA-001',
        'API_ERROR',
        'AI job failed',
        'job-123',
      ]
    );
  });

  it('ควร fallback เป็น UNKNOWN เมื่อ workflow ส่ง error_type ที่ enum ไม่รองรับ', async () => {
    await service.logError({
      batchId: 'C22024-MIGRATION',
      documentNumber: 'WORKFLOW',
      errorType: 'UNSUPPORTED_ERROR',
      errorMessage: 'unexpected',
    });

    expect(mockDataSource.query).toHaveBeenCalledWith(expect.any(String), [
      'C22024-MIGRATION',
      'WORKFLOW',
      'UNKNOWN',
      'unexpected',
      null,
    ]);
  });

  describe('upsertQueueRecord', () => {
    const baseDto = {
      batchId: 'C22024-MIGRATION',
      documentNumber: 'LCB-RFA-001',
      subject: 'Test Subject',
      originalSubject: 'Original Subject',
      confidence: 0.85,
      status: 'PENDING' as const,
      reviewReason: 'Low confidence',
    };

    it('ควรสร้าง record ใหม่เมื่อยังไม่มี idempotencyKey (insert path)', async () => {
      mockReviewRepo.findOne.mockResolvedValue(null);
      mockReviewRepo.create.mockImplementation(
        (input: { idempotencyKey: string }) => ({
          idempotencyKey: input.idempotencyKey,
          publicId: '019505a1-7c3e-7000-8000-abc123def456',
        })
      );
      mockReviewRepo.save.mockResolvedValue({
        publicId: '019505a1-7c3e-7000-8000-abc123def456',
      });

      const result = await service.upsertQueueRecord(baseDto);

      expect(result).toEqual({
        publicId: '019505a1-7c3e-7000-8000-abc123def456',
      });
      expect(mockReviewRepo.findOne).toHaveBeenCalledWith({
        where: { idempotencyKey: 'C22024-MIGRATION:LCB-RFA-001' },
      });
      expect(mockReviewRepo.create).toHaveBeenCalledWith({
        idempotencyKey: 'C22024-MIGRATION:LCB-RFA-001',
      });
      expect(mockReviewRepo.save).toHaveBeenCalledTimes(1);
    });

    it('ควรอัปเดต record ที่มีอยู่แล้วเมื่อ idempotencyKey ตรง (update path)', async () => {
      const existingRecord = {
        idempotencyKey: 'C22024-MIGRATION:LCB-RFA-001',
        publicId: '019505a1-7c3e-7000-8000-existing001',
        batchId: 'OLD-BATCH',
      };
      mockReviewRepo.findOne.mockResolvedValue(existingRecord);
      mockReviewRepo.save.mockResolvedValue({
        ...existingRecord,
        batchId: 'C22024-MIGRATION',
        publicId: '019505a1-7c3e-7000-8000-existing001',
      });

      const result = await service.upsertQueueRecord(baseDto);

      expect(result).toEqual({
        publicId: '019505a1-7c3e-7000-8000-existing001',
      });
      expect(mockReviewRepo.create).not.toHaveBeenCalled();
      expect(mockReviewRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: 'C22024-MIGRATION:LCB-RFA-001',
          batchId: 'C22024-MIGRATION',
        })
      );
    });

    it('ควรใช้ idempotencyKey ที่ส่งมาใน dto ถ้ามี (override default)', async () => {
      mockReviewRepo.findOne.mockResolvedValue(null);
      mockReviewRepo.create.mockImplementation(
        (input: { idempotencyKey: string }) => ({
          idempotencyKey: input.idempotencyKey,
          publicId: '019505a1-7c3e-7000-8000-abc123def456',
        })
      );
      mockReviewRepo.save.mockResolvedValue({
        publicId: '019505a1-7c3e-7000-8000-abc123def456',
      });

      await service.upsertQueueRecord({
        ...baseDto,
        idempotencyKey: 'custom-key-123',
      });

      expect(mockReviewRepo.findOne).toHaveBeenCalledWith({
        where: { idempotencyKey: 'custom-key-123' },
      });
      expect(mockReviewRepo.create).toHaveBeenCalledWith({
        idempotencyKey: 'custom-key-123',
      });
    });

    it('ควร resolve tempAttachmentId แบบ UUID เป็น internal INT id ผ่าน DB query', async () => {
      mockReviewRepo.findOne.mockResolvedValue(null);
      mockReviewRepo.create.mockImplementation(
        (input: { idempotencyKey: string }) => ({
          idempotencyKey: input.idempotencyKey,
          publicId: '019505a1-7c3e-7000-8000-abc123def456',
        })
      );
      const savedRecord = {
        idempotencyKey: 'C22024-MIGRATION:LCB-RFA-001',
        tempAttachmentId: 42,
        publicId: '019505a1-7c3e-7000-8000-abc123def456',
      };
      mockReviewRepo.save.mockResolvedValue(savedRecord);
      mockDataSource.manager.query.mockResolvedValue([{ id: 42 }]);

      const result = await service.upsertQueueRecord({
        ...baseDto,
        tempAttachmentId: '019505a1-7c3e-7000-8000-attachment01',
      });

      expect(mockDataSource.manager.query).toHaveBeenCalledWith(
        'SELECT id FROM attachments WHERE uuid = ? LIMIT 1',
        ['019505a1-7c3e-7000-8000-attachment01']
      );
      expect(mockReviewRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ tempAttachmentId: 42 })
      );
      expect(result).toEqual({
        publicId: '019505a1-7c3e-7000-8000-abc123def456',
      });
    });

    it('ควรใช้ tempAttachmentId ตรงๆ เมื่อเป็น number (ไม่ query DB)', async () => {
      mockReviewRepo.findOne.mockResolvedValue(null);
      mockReviewRepo.create.mockImplementation(
        (input: { idempotencyKey: string }) => ({
          idempotencyKey: input.idempotencyKey,
          publicId: '019505a1-7c3e-7000-8000-abc123def456',
        })
      );
      mockReviewRepo.save.mockResolvedValue({
        publicId: '019505a1-7c3e-7000-8000-abc123def456',
        tempAttachmentId: 99,
      });

      await service.upsertQueueRecord({
        ...baseDto,
        tempAttachmentId: 99,
      });

      expect(mockDataSource.manager.query).not.toHaveBeenCalled();
      const savedCalls = mockReviewRepo.save.mock.calls as Array<
        [Record<string, unknown>]
      >;
      const savedArg = savedCalls[0][0];
      expect(savedArg.tempAttachmentId).toBe(99);
    });

    it('ควรไม่ตั้ง tempAttachmentId เมื่อ UUID ไม่พบใน DB', async () => {
      mockReviewRepo.findOne.mockResolvedValue(null);
      mockReviewRepo.create.mockImplementation(
        (input: { idempotencyKey: string }) => ({
          idempotencyKey: input.idempotencyKey,
          publicId: '019505a1-7c3e-7000-8000-abc123def456',
        })
      );
      mockReviewRepo.save.mockResolvedValue({
        publicId: '019505a1-7c3e-7000-8000-abc123def456',
      });
      mockDataSource.manager.query.mockResolvedValue([]);

      await service.upsertQueueRecord({
        ...baseDto,
        tempAttachmentId: '019505a1-7c3e-7000-8000-notfound01',
      });

      const savedCalls = mockReviewRepo.save.mock.calls as Array<
        [Record<string, unknown>]
      >;
      const savedArg = savedCalls[0][0];
      expect(savedArg.tempAttachmentId).toBeUndefined();
    });

    it('ควร map status PENDING_REVIEW เป็น MigrationReviewRecordStatus.PENDING_REVIEW', async () => {
      mockReviewRepo.findOne.mockResolvedValue(null);
      mockReviewRepo.create.mockImplementation(
        (input: { idempotencyKey: string }) => ({
          idempotencyKey: input.idempotencyKey,
          publicId: '019505a1-7c3e-7000-8000-abc123def456',
        })
      );
      mockReviewRepo.save.mockResolvedValue({
        publicId: '019505a1-7c3e-7000-8000-abc123def456',
      });

      await service.upsertQueueRecord({
        ...baseDto,
        status: 'PENDING_REVIEW',
      });

      const savedCalls = mockReviewRepo.save.mock.calls as Array<
        [Record<string, unknown>]
      >;
      const savedArg = savedCalls[0][0];
      expect(savedArg.status).toBe('PENDING_REVIEW');
    });

    it('ควร merge aiResult เข้า extractedMetadata โดยรักษา documentNumber/subject/originalSubject', async () => {
      mockReviewRepo.findOne.mockResolvedValue(null);
      mockReviewRepo.create.mockImplementation(
        (input: { idempotencyKey: string }) => ({
          idempotencyKey: input.idempotencyKey,
          publicId: '019505a1-7c3e-7000-8000-abc123def456',
        })
      );
      mockReviewRepo.save.mockResolvedValue({
        publicId: '019505a1-7c3e-7000-8000-abc123def456',
      });

      await service.upsertQueueRecord({
        ...baseDto,
        aiResult: { documentDate: '2026-06-01', sender: 'ABC Corp' },
      });

      const savedCalls = mockReviewRepo.save.mock.calls as Array<
        [Record<string, unknown>]
      >;
      const savedArg = savedCalls[0][0];
      expect(savedArg.extractedMetadata).toEqual({
        documentNumber: 'LCB-RFA-001',
        subject: 'Test Subject',
        originalSubject: 'Original Subject',
        documentDate: '2026-06-01',
        sender: 'ABC Corp',
      });
    });
  });
});
