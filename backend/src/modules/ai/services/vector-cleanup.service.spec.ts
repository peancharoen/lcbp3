// File: backend/src/modules/ai/services/vector-cleanup.service.spec.ts
// Change Log:
// - 2026-09-10: T061 — สร้าง unit test สำหรับ orphanScanRagAttachments (Feature 255, Q8)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { VectorCleanupService } from './vector-cleanup.service';
import { AiQdrantService } from '../qdrant.service';
import { PendingVectorDeletion } from '../entities/pending-vector-deletion.entity';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { RagAttachmentPage } from '../entities/rag-attachment-page.entity';

type MockQueryBuilder = {
  leftJoin: jest.Mock;
  where: jest.Mock;
  select: jest.Mock;
  getRawMany: jest.Mock;
};

type MockRepository = {
  createQueryBuilder: jest.Mock<MockQueryBuilder>;
  find: jest.Mock;
  delete: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

function createMockRepository(): MockRepository {
  const qb: MockQueryBuilder = {
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  return {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    find: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
}

describe('VectorCleanupService — orphanScanRagAttachments (T061)', () => {
  let service: VectorCleanupService;
  let mockQdrantService: Record<string, jest.Mock>;
  let mockPendingRepo: MockRepository;
  let mockGenerationRepo: MockRepository;
  let mockChunkRepo: MockRepository;
  let mockPageRepo: MockRepository;
  let mockDataSource: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockQdrantService = { deleteByPointIds: jest.fn() };
    mockPendingRepo = createMockRepository();
    mockGenerationRepo = createMockRepository();
    mockChunkRepo = createMockRepository();
    mockPageRepo = createMockRepository();
    mockDataSource = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorCleanupService,
        { provide: AiQdrantService, useValue: mockQdrantService },
        {
          provide: getRepositoryToken(PendingVectorDeletion),
          useValue: mockPendingRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
        {
          provide: getRepositoryToken(RagAttachmentGeneration),
          useValue: mockGenerationRepo,
        },
        {
          provide: getRepositoryToken(RagAttachmentChunk),
          useValue: mockChunkRepo,
        },
        {
          provide: getRepositoryToken(RagAttachmentPage),
          useValue: mockPageRepo,
        },
      ],
    }).compile();

    service = module.get<VectorCleanupService>(VectorCleanupService);
  });

  it('should skip if generation repository not available', async () => {
    // Create service without generation repo
    const moduleWithoutGen: TestingModule = await Test.createTestingModule({
      providers: [
        VectorCleanupService,
        { provide: AiQdrantService, useValue: mockQdrantService },
        {
          provide: getRepositoryToken(PendingVectorDeletion),
          useValue: mockPendingRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
        // No generation/chunk/page repos
      ],
    }).compile();
    const serviceWithoutGen =
      moduleWithoutGen.get<VectorCleanupService>(VectorCleanupService);

    // Should not throw, just log warning
    await expect(
      serviceWithoutGen.orphanScanRagAttachments()
    ).resolves.not.toThrow();
  });

  it('should find and clean orphaned generations (Q8)', async () => {
    const qb = mockGenerationRepo.createQueryBuilder();
    qb.getRawMany.mockResolvedValue([
      { generationUuid: 'gen-1', attachmentUuid: 'att-1' },
      { generationUuid: 'gen-2', attachmentUuid: 'att-2' },
    ]);
    mockChunkRepo.find.mockResolvedValue([
      { chunkPublicId: 'chunk-1' },
      { chunkPublicId: 'chunk-2' },
    ]);
    mockQdrantService.deleteByPointIds.mockResolvedValue(undefined);
    mockChunkRepo.delete.mockResolvedValue({});
    mockPageRepo.delete.mockResolvedValue({});
    mockGenerationRepo.delete.mockResolvedValue({});

    await service.orphanScanRagAttachments();

    // Should delete chunks, pages, and generation for each orphan
    expect(mockChunkRepo.delete).toHaveBeenCalledTimes(2);
    expect(mockPageRepo.delete).toHaveBeenCalledTimes(2);
    expect(mockGenerationRepo.delete).toHaveBeenCalledTimes(2);
    expect(mockQdrantService.deleteByPointIds).toHaveBeenCalledTimes(2);
  });

  it('should handle empty orphan list gracefully', async () => {
    const qb = mockGenerationRepo.createQueryBuilder();
    qb.getRawMany.mockResolvedValue([]);

    await service.orphanScanRagAttachments();

    expect(mockChunkRepo.delete).not.toHaveBeenCalled();
    expect(mockGenerationRepo.delete).not.toHaveBeenCalled();
  });

  it('should continue DB cleanup even if Qdrant deletion fails', async () => {
    const qb = mockGenerationRepo.createQueryBuilder();
    qb.getRawMany.mockResolvedValue([
      { generationUuid: 'gen-1', attachmentUuid: 'att-1' },
    ]);
    mockChunkRepo.find.mockResolvedValue([{ chunkPublicId: 'chunk-1' }]);
    mockQdrantService.deleteByPointIds.mockRejectedValue(
      new Error('Qdrant unavailable')
    );
    mockChunkRepo.delete.mockResolvedValue({});
    mockPageRepo.delete.mockResolvedValue({});
    mockGenerationRepo.delete.mockResolvedValue({});

    await service.orphanScanRagAttachments();

    // DB cleanup should still happen
    expect(mockChunkRepo.delete).toHaveBeenCalledWith({
      generationUuid: 'gen-1',
    });
    expect(mockPageRepo.delete).toHaveBeenCalledWith({
      generationUuid: 'gen-1',
    });
    expect(mockGenerationRepo.delete).toHaveBeenCalledWith({
      generationUuid: 'gen-1',
    });
  });
});
