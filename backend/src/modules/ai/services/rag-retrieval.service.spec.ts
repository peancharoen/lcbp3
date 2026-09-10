// File: backend/src/modules/ai/services/rag-retrieval.service.spec.ts
// Change Log:
// - 2026-09-09: เพิ่ม integration tests สำหรับ ACTIVE-generation retrieval guard (Feature 254)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagRetrievalService } from './rag-retrieval.service';
import { RagRetrievalGuardService } from './rag-retrieval-guard.service';
import { RagCitationService } from './rag-citation.service';
import { AiQdrantService } from '../qdrant.service';

describe('RagRetrievalService', () => {
  let service: RagRetrievalService;
  const chunkRepository = { find: jest.fn() };
  const generationRepository = { find: jest.fn() };
  const qdrantService = { search: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagRetrievalService,
        RagRetrievalGuardService,
        RagCitationService,
        {
          provide: getRepositoryToken(RagAttachmentChunk),
          useValue: chunkRepository,
        },
        {
          provide: getRepositoryToken(RagAttachmentGeneration),
          useValue: generationRepository,
        },
        { provide: AiQdrantService, useValue: qdrantService },
      ],
    }).compile();
    service = module.get<RagRetrievalService>(RagRetrievalService);
  });

  it('throws when projectPublicId is missing', async () => {
    await expect(service.retrieve('', [0.1, 0.2], 5)).rejects.toThrow(
      'RAG_RETRIEVAL_PROJECT_SCOPE_REQUIRED'
    );
  });

  it('returns empty result when Qdrant has no matches', async () => {
    qdrantService.search.mockResolvedValue([]);
    const result = await service.retrieve('proj-1', [0.1, 0.2], 5);
    expect(result.citations).toEqual([]);
    expect(result.totalFound).toBe(0);
    expect(result.skippedStale).toBe(0);
  });

  it('skips all results when generation_uuid payload is missing', async () => {
    qdrantService.search.mockResolvedValue([
      { pointId: 'p1', score: 0.9, payload: { chunk_public_id: 'chunk-1' } },
    ]);
    const result = await service.retrieve('proj-1', [0.1, 0.2], 5);
    expect(result.citations).toEqual([]);
    expect(result.totalFound).toBe(1);
    expect(result.skippedStale).toBe(1);
  });

  it('skips chunks from non-ACTIVE generations', async () => {
    qdrantService.search.mockResolvedValue([
      {
        pointId: 'p1',
        score: 0.9,
        payload: { chunk_public_id: 'chunk-1', generation_uuid: 'gen-retired' },
      },
    ]);
    generationRepository.find.mockResolvedValue([]);
    const result = await service.retrieve('proj-1', [0.1, 0.2], 5);
    expect(result.citations).toEqual([]);
    expect(result.skippedStale).toBe(1);
  });

  it('returns citations for ACTIVE generation chunks', async () => {
    qdrantService.search.mockResolvedValue([
      {
        pointId: 'p1',
        score: 0.95,
        payload: { chunk_public_id: 'chunk-1', generation_uuid: 'gen-active' },
      },
    ]);
    generationRepository.find.mockResolvedValue([
      { generationUuid: 'gen-active' },
    ]);
    chunkRepository.find.mockResolvedValue([
      {
        chunkPublicId: 'chunk-1',
        attachmentUuid: 'att-1',
        ownerType: 'CORRESPONDENCE',
        ownerPublicId: 'corr-1',
        content: 'hello world',
        classification: 'INTERNAL',
      },
    ]);
    const result = await service.retrieve('proj-1', [0.1, 0.2], 5);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]).toMatchObject({
      chunkPublicId: 'chunk-1',
      attachmentPublicId: 'att-1',
      ownerType: 'CORRESPONDENCE',
      content: 'hello world',
      score: 0.95,
    });
  });

  it('filters out chunks by classification when allowedClassifications set', async () => {
    qdrantService.search.mockResolvedValue([
      {
        pointId: 'p1',
        score: 0.9,
        payload: { chunk_public_id: 'chunk-1', generation_uuid: 'gen-active' },
      },
    ]);
    generationRepository.find.mockResolvedValue([
      { generationUuid: 'gen-active' },
    ]);
    chunkRepository.find.mockResolvedValue([
      {
        chunkPublicId: 'chunk-1',
        attachmentUuid: 'att-1',
        ownerType: 'CORRESPONDENCE',
        ownerPublicId: 'corr-1',
        content: 'secret',
        classification: 'CONFIDENTIAL',
      },
    ]);
    const result = await service.retrieve('proj-1', [0.1, 0.2], 5, [
      'PUBLIC',
      'INTERNAL',
    ]);
    expect(result.citations).toEqual([]);
    expect(result.skippedStale).toBe(1);
  });
});
