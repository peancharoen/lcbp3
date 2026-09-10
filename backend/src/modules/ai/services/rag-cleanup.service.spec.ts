// File: backend/src/modules/ai/services/rag-cleanup.service.spec.ts
// Change Log:
// - 2026-09-09: เพิ่ม integration tests สำหรับ RETIRED generation cleanup (Feature 254)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { RagAttachmentPage } from '../entities/rag-attachment-page.entity';
import { RagCleanupService } from './rag-cleanup.service';
import { AiQdrantService } from '../qdrant.service';

describe('RagCleanupService', () => {
  let service: RagCleanupService;
  const generationRepository = {
    find: jest.fn(),
    delete: jest.fn(),
  };
  const chunkRepository = {
    find: jest.fn(),
    delete: jest.fn(),
  };
  const pageRepository = {
    delete: jest.fn(),
  };
  const qdrantService = {
    deleteByPointIds: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagCleanupService,
        {
          provide: getRepositoryToken(RagAttachmentGeneration),
          useValue: generationRepository,
        },
        {
          provide: getRepositoryToken(RagAttachmentChunk),
          useValue: chunkRepository,
        },
        {
          provide: getRepositoryToken(RagAttachmentPage),
          useValue: pageRepository,
        },
        { provide: AiQdrantService, useValue: qdrantService },
      ],
    }).compile();
    service = module.get<RagCleanupService>(RagCleanupService);
  });

  it('returns zeros when no RETIRED generations exist', async () => {
    generationRepository.find.mockResolvedValue([]);

    const result = await service.cleanupRetiredGenerations(24);

    expect(result).toEqual({
      cleanedGenerations: 0,
      deletedChunks: 0,
      deletedPages: 0,
      failedCleanups: 0,
    });
    expect(qdrantService.deleteByPointIds).not.toHaveBeenCalled();
  });

  it('cleans up RETIRED generation with vectors, chunks, pages', async () => {
    generationRepository.find.mockResolvedValue([
      { generationUuid: 'gen-1', attachmentUuid: 'att-1' },
    ]);
    chunkRepository.find.mockResolvedValue([
      { chunkPublicId: 'chunk-1' },
      { chunkPublicId: 'chunk-2' },
    ]);
    chunkRepository.delete.mockResolvedValue({ affected: 2 });
    pageRepository.delete.mockResolvedValue({ affected: 1 });
    generationRepository.delete.mockResolvedValue({ affected: 1 });

    const result = await service.cleanupRetiredGenerations(24);

    expect(qdrantService.deleteByPointIds).toHaveBeenCalledWith([
      'chunk-1',
      'chunk-2',
    ]);
    expect(chunkRepository.delete).toHaveBeenCalledWith({
      generationUuid: 'gen-1',
    });
    expect(pageRepository.delete).toHaveBeenCalledWith({
      generationUuid: 'gen-1',
    });
    expect(generationRepository.delete).toHaveBeenCalledWith({
      generationUuid: 'gen-1',
    });
    expect(result).toEqual({
      cleanedGenerations: 1,
      deletedChunks: 2,
      deletedPages: 1,
      failedCleanups: 0,
    });
  });

  it('continues cleanup when Qdrant delete throws (warns but proceeds)', async () => {
    generationRepository.find.mockResolvedValue([
      { generationUuid: 'gen-1', attachmentUuid: 'att-1' },
    ]);
    chunkRepository.find.mockResolvedValue([{ chunkPublicId: 'chunk-1' }]);
    qdrantService.deleteByPointIds.mockRejectedValue(new Error('Qdrant down'));
    chunkRepository.delete.mockResolvedValue({ affected: 1 });
    pageRepository.delete.mockResolvedValue({ affected: 1 });
    generationRepository.delete.mockResolvedValue({ affected: 1 });

    const result = await service.cleanupRetiredGenerations(24);

    // Qdrant failure is caught — cleanup proceeds with MariaDB deletion
    expect(result.cleanedGenerations).toBe(1);
    expect(result.failedCleanups).toBe(0);
  });

  it('skips Qdrant delete when no chunks exist for generation', async () => {
    generationRepository.find.mockResolvedValue([
      { generationUuid: 'gen-1', attachmentUuid: 'att-1' },
    ]);
    chunkRepository.find.mockResolvedValue([]);
    chunkRepository.delete.mockResolvedValue({ affected: 0 });
    pageRepository.delete.mockResolvedValue({ affected: 0 });
    generationRepository.delete.mockResolvedValue({ affected: 1 });

    const result = await service.cleanupRetiredGenerations(24);

    expect(qdrantService.deleteByPointIds).not.toHaveBeenCalled();
    expect(result.cleanedGenerations).toBe(1);
  });
});
