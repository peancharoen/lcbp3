// File: backend/src/modules/ai/services/rag-admin.service.spec.ts
// Change Log:
// - 2026-09-10: T020 — สร้าง unit tests สำหรับ RagAdminService (Feature 255)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RagAdminService } from './rag-admin.service';
import { RagAttachmentIngestionService } from './rag-attachment-ingestion.service';
import { AiQueueService } from '../ai-queue.service';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { RagAdminPageSize } from '../dto/rag-admin.dto';
import {
  NotFoundException,
  ConflictException,
  ValidationException,
} from '../../../common/exceptions';

type MockQueryBuilder = {
  leftJoin: jest.Mock;
  select: jest.Mock;
  addSelect: jest.Mock;
  andWhere: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
  groupBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  from: jest.Mock;
  getCount: jest.Mock;
  getRawMany: jest.Mock;
};

type MockRepository = {
  createQueryBuilder: jest.Mock<MockQueryBuilder>;
  findOne: jest.Mock;
  find: jest.Mock;
  getCount: jest.Mock;
  getRawMany: jest.Mock;
  update: jest.Mock;
};

function createMockRepository(): MockRepository {
  const qb: MockQueryBuilder = {
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
    getRawMany: jest.fn(),
    from: jest.fn().mockReturnThis(),
  };
  return {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    findOne: jest.fn(),
    find: jest.fn(),
    getCount: jest.fn(),
    getRawMany: jest.fn(),
    update: jest.fn(),
  };
}

describe('RagAdminService', () => {
  let service: RagAdminService;
  let mockAttachmentRepo: MockRepository;
  let mockGenerationRepo: MockRepository;
  let mockChunkRepo: MockRepository;
  let mockIngestionService: Record<string, jest.Mock>;
  let mockAiQueueService: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockAttachmentRepo = createMockRepository();
    mockGenerationRepo = createMockRepository();
    mockChunkRepo = createMockRepository();
    mockIngestionService = { ingest: jest.fn() };
    mockAiQueueService = { enqueueRagAttachmentIngestion: jest.fn() };
    mockDataSource = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagAdminService,
        {
          provide: getRepositoryToken(Attachment),
          useValue: mockAttachmentRepo,
        },
        {
          provide: getRepositoryToken(RagAttachmentGeneration),
          useValue: mockGenerationRepo,
        },
        {
          provide: getRepositoryToken(RagAttachmentChunk),
          useValue: mockChunkRepo,
        },
        {
          provide: RagAttachmentIngestionService,
          useValue: mockIngestionService,
        },
        { provide: AiQueueService, useValue: mockAiQueueService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<RagAdminService>(RagAdminService);
  });

  describe('listAttachments (T020)', () => {
    it('should use default page 1 and pageSize 20', async () => {
      const qb = mockAttachmentRepo.createQueryBuilder();
      qb.getCount.mockResolvedValue(0);
      qb.getRawMany.mockResolvedValue([]);

      const result = await service.listAttachments({});

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(RagAdminPageSize.TWENTY);
      expect(result.total).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('should accept custom page and pageSize', async () => {
      const qb = mockAttachmentRepo.createQueryBuilder();
      qb.getCount.mockResolvedValue(100);
      qb.getRawMany.mockResolvedValue([]);

      const result = await service.listAttachments({
        page: 3,
        pageSize: RagAdminPageSize.FIFTY,
      });

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(RagAdminPageSize.FIFTY);
    });
  });

  describe('listGenerations (T020)', () => {
    it('should throw NotFoundException if attachment does not exist', async () => {
      mockAttachmentRepo.findOne.mockResolvedValue(null);

      await expect(service.listGenerations('nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should return empty generations array for attachment with no generations', async () => {
      mockAttachmentRepo.findOne.mockResolvedValue({ publicId: 'test-uuid' });
      mockGenerationRepo.find.mockResolvedValue([]);

      const result = await service.listGenerations('test-uuid');

      expect(result.attachmentPublicId).toBe('test-uuid');
      expect(result.generations).toEqual([]);
    });

    it('should NOT expose internal generationUuid in response (FR-014)', async () => {
      mockAttachmentRepo.findOne.mockResolvedValue({ publicId: 'test-uuid' });
      mockGenerationRepo.find.mockResolvedValue([
        {
          generationUuid: 'internal-uuid-123',
          status: 'BUILDING',
          createdAt: new Date(),
          activatedAt: null,
          retiredAt: null,
          failedAt: null,
          errorCode: null,
          errorMessage: null,
        },
      ]);
      mockChunkRepo
        .createQueryBuilder()
        .getRawMany.mockResolvedValue([
          { generationUuid: 'internal-uuid-123', chunkCount: 5 },
        ]);

      const result = await service.listGenerations('test-uuid');

      expect(result.generations).toHaveLength(1);
      const gen = result.generations[0];
      expect(gen).not.toHaveProperty('generationUuid');
      expect(gen.chunkCount).toBe(5);
    });
  });

  describe('reingest (T020)', () => {
    it('should throw NotFoundException if attachment does not exist', async () => {
      mockAttachmentRepo.findOne.mockResolvedValue(null);

      await expect(service.reingest('nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ValidationException if attachment has no checksum (I2)', async () => {
      mockAttachmentRepo.findOne.mockResolvedValue({
        publicId: 'test-uuid',
        checksum: null,
      });

      await expect(service.reingest('test-uuid')).rejects.toThrow(
        ValidationException
      );
    });

    it('should throw ConflictException if BUILDING generation exists (Q13)', async () => {
      mockAttachmentRepo.findOne.mockResolvedValue({
        publicId: 'test-uuid',
        checksum: 'abc123',
      });
      mockGenerationRepo.findOne.mockResolvedValue({
        status: 'BUILDING',
        generationUuid: 'gen-1',
      });

      await expect(service.reingest('test-uuid')).rejects.toThrow(
        ConflictException
      );
    });

    it('should delegate to ingestionService.ingest() with force=true (Q12)', async () => {
      mockAttachmentRepo.findOne.mockResolvedValue({
        publicId: 'test-uuid',
        checksum: 'abc123',
      });
      mockGenerationRepo.findOne.mockResolvedValue(null); // No BUILDING
      mockIngestionService.ingest.mockResolvedValue({
        attachmentChecksumSnapshot: 'abc123',
        status: 'BUILDING',
      });
      mockAiQueueService.enqueueRagAttachmentIngestion.mockResolvedValue(
        'job-123'
      );

      const result = await service.reingest('test-uuid');

      expect(mockIngestionService.ingest).toHaveBeenCalledWith(
        'test-uuid',
        true
      );
      expect(result.status).toBe('BUILDING');
      expect(result.jobId).toBe('job-123');
    });
  });

  describe('batchRetry (T020)', () => {
    it('should return partial-success format (Q17)', async () => {
      mockGenerationRepo.findOne.mockResolvedValue({
        generationUuid: 'gen-1',
        status: 'FAILED',
      });
      mockGenerationRepo.update.mockResolvedValue({});
      mockIngestionService.ingest.mockResolvedValue({
        attachmentChecksumSnapshot: 'abc',
      });
      mockAiQueueService.enqueueRagAttachmentIngestion.mockResolvedValue(
        'job-1'
      );

      const result = await service.batchRetry(['uuid-1', 'uuid-2']);

      expect(result).toHaveProperty('succeeded');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('totalRequested', 2);
      expect(result).toHaveProperty('totalSucceeded');
      expect(result).toHaveProperty('totalFailed');
    });

    it('should return failed[] for non-FAILED generations', async () => {
      mockGenerationRepo.findOne.mockResolvedValue({
        generationUuid: 'gen-1',
        status: 'ACTIVE',
      });

      const result = await service.batchRetry(['uuid-1']);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toContain('ACTIVE');
    });

    it('should return failed[] for attachments with no generation', async () => {
      mockGenerationRepo.findOne.mockResolvedValue(null);

      const result = await service.batchRetry(['uuid-1']);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toContain('No generation');
    });
  });

  // ==========================================================
  // Phase 2A: Audit Trail (Spec 255 FR-005, SC-006)
  // ==========================================================

  describe('listAttachmentsForClassification — Audit Trail (2A)', () => {
    it('2A.1: should return classificationOverride object when attachment has been overridden', async () => {
      const qb = mockAttachmentRepo.createQueryBuilder();
      qb.getCount.mockResolvedValue(1);
      qb.getRawMany.mockResolvedValue([
        {
          attachmentPublicId: 'test-uuid-1',
          originalFilename: 'doc1.pdf',
          effectiveClassification: 'CONFIDENTIAL',
          overrideReason: 'Security review required',
          overrideActor: 'admin-user-uuid',
          overrideAt: new Date('2026-09-12T00:00:00Z'),
        },
      ]);

      const result = await service.listAttachmentsForClassification({});

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.classificationOverride).not.toBeNull();
      expect(item.classificationOverride?.reason).toBe(
        'Security review required'
      );
      expect(item.classificationOverride?.overriddenBy).toBe('admin-user-uuid');
      expect(item.classificationOverride?.overriddenAt).toEqual(
        new Date('2026-09-12T00:00:00Z')
      );
      expect(item.effectiveClassification).toBe('CONFIDENTIAL');
    });

    it('2A.2: should return classificationOverride = null when attachment has never been overridden', async () => {
      const qb = mockAttachmentRepo.createQueryBuilder();
      qb.getCount.mockResolvedValue(1);
      qb.getRawMany.mockResolvedValue([
        {
          attachmentPublicId: 'test-uuid-2',
          originalFilename: 'doc2.pdf',
          effectiveClassification: 'INTERNAL',
          overrideReason: null,
          overrideActor: null,
          overrideAt: null,
        },
      ]);

      const result = await service.listAttachmentsForClassification({});

      expect(result.items).toHaveLength(1);
      expect(result.items[0].classificationOverride).toBeNull();
    });
  });

  describe('batchRetry — Permanent Error (2A.3, US5 AC4)', () => {
    it('2A.3: should return failed[] with user-friendly reason when ingestion throws permanent error', async () => {
      mockGenerationRepo.findOne.mockResolvedValue({
        generationUuid: 'gen-1',
        status: 'FAILED',
        attachmentUuid: 'uuid-1',
      });
      mockGenerationRepo.update.mockResolvedValue({});
      // Simulate permanent error from ingestionService.ingest()
      mockIngestionService.ingest.mockRejectedValue(
        new Error('File is corrupted and cannot be ingested')
      );

      const result = await service.batchRetry(['uuid-1']);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].attachmentPublicId).toBe('uuid-1');
      expect(result.failed[0].reason).toContain('corrupted');
      expect(result.succeeded).toHaveLength(0);
    });
  });

  // ==========================================================
  // Phase 2B: Pagination Edge Cases (Spec 255 FR-003)
  // ==========================================================

  describe('listAttachments — Pagination Edge Cases (2B)', () => {
    it('2B.1: should accept pageSize=50 and return correct total', async () => {
      const qb = mockAttachmentRepo.createQueryBuilder();
      qb.getCount.mockResolvedValue(100);
      qb.getRawMany.mockResolvedValue([]);

      const result = await service.listAttachments({
        page: 1,
        pageSize: RagAdminPageSize.FIFTY,
      });

      expect(result.pageSize).toBe(RagAdminPageSize.FIFTY);
      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
    });

    it('2B.2: should return empty items when page exceeds total pages (no error)', async () => {
      const qb = mockAttachmentRepo.createQueryBuilder();
      qb.getCount.mockResolvedValue(5);
      qb.getRawMany.mockResolvedValue([]);

      // Page 100 when only 5 items exist (page 1 of pageSize 20)
      const result = await service.listAttachments({
        page: 100,
        pageSize: RagAdminPageSize.TWENTY,
      });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(5);
      expect(result.page).toBe(100);
    });

    it('2B.3: should apply both status filter and project filter together', async () => {
      const qb = mockAttachmentRepo.createQueryBuilder();
      qb.getCount.mockResolvedValue(2);
      qb.getRawMany.mockResolvedValue([
        {
          attachmentPublicId: 'uuid-1',
          originalFilename: 'doc1.pdf',
          mimeType: 'application/pdf',
          ragStatus: 'FAILED',
          aiProcessingStatus: 'DONE',
          chunkCount: 1,
          effectiveClassification: 'INTERNAL',
          overrideReason: null,
          overrideActor: null,
          overrideAt: null,
          lastUpdated: new Date(),
          createdAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      ]);

      const result = await service.listAttachments({
        status: 'FAILED' as never,
        projectPublicId: 'proj-uuid-1',
      });

      // Verify andWhere was called (filter applied)
      expect(qb.andWhere).toHaveBeenCalled();
      expect(result.total).toBe(2);
    });
  });
});
