import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';

import { getQueueToken } from '@nestjs/bullmq';
import { RagService } from '../rag.service';
import { QdrantService } from '../qdrant.service';
import { EmbeddingService } from '../embedding.service';
import { TyphoonService } from '../typhoon.service';
import { IngestionService } from '../ingestion.service';
import { DocumentChunk } from '../entities/document-chunk.entity';
import { QUEUE_AI_VECTOR_DELETION } from '../../common/constants/queue.constants';

const DEFAULT_REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

const mockQdrant = {
  isReady: jest.fn(),
  hybridSearch: jest.fn(),
  deleteByDocumentId: jest.fn(),
};

const mockEmbedding = {
  embed: jest.fn(),
};

const mockTyphoon = {
  generate: jest.fn(),
  sanitizeInput: jest.fn((t: string) => t),
};

const mockIngestion = { enqueue: jest.fn() };

const mockChunkRepo = {
  count: jest.fn(),
  delete: jest.fn(),
  manager: {
    query: jest.fn(),
  },
};

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
};

const mockVectorDeletionQueue = {
  add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
};

describe('RagService', () => {
  let service: RagService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagService,
        { provide: QdrantService, useValue: mockQdrant },
        { provide: EmbeddingService, useValue: mockEmbedding },
        { provide: TyphoonService, useValue: mockTyphoon },
        { provide: IngestionService, useValue: mockIngestion },
        { provide: getRepositoryToken(DocumentChunk), useValue: mockChunkRepo },
        { provide: DEFAULT_REDIS_TOKEN, useValue: mockRedis },
        {
          provide: getQueueToken(QUEUE_AI_VECTOR_DELETION),
          useValue: mockVectorDeletionQueue,
        },
      ],
    }).compile();

    service = module.get<RagService>(RagService);
    jest.clearAllMocks();
  });

  describe('query()', () => {
    const dto = {
      question: 'เอกสารเกี่ยวกับอะไร?',
      projectPublicId: 'proj-uuid-1234',
    };
    const memberPerms: string[] = [];
    const adminPerms = ['system.manage_all'];

    it('should return answer with citations on PUBLIC cache miss → write cache', async () => {
      mockQdrant.isReady.mockReturnValue(true);
      mockRedis.get.mockResolvedValue(null);
      mockEmbedding.embed.mockResolvedValue(new Array(768).fill(0.1));
      mockQdrant.hybridSearch.mockResolvedValue([
        {
          chunkId: 'chunk-1',
          publicId: 'att-1',
          docType: 'CORR',
          docNumber: 'REF-001',
          revision: null,
          projectCode: 'PRJ-001',
          contentPreview: 'เนื้อหาเอกสาร',
          score: 0.92,
        },
      ]);
      mockTyphoon.generate.mockResolvedValue({
        answer: 'คำตอบ',
        usedFallbackModel: false,
      });

      const result = await service.query(dto, memberPerms);

      expect(result.answer).toBe('คำตอบ');
      expect(result.citations).toHaveLength(1);
      expect(result.usedFallbackModel).toBe(false);
      expect(mockRedis.setex).toHaveBeenCalledTimes(1);
    });

    it('should return cached result without calling Qdrant on cache hit', async () => {
      mockQdrant.isReady.mockReturnValue(true);
      const cached = JSON.stringify({
        answer: 'cached answer',
        citations: [],
        confidence: 0.9,
        usedFallbackModel: false,
      });
      mockRedis.get.mockResolvedValue(cached);

      const result = await service.query(dto, memberPerms);

      expect(result.answer).toBe('cached answer');
      expect(mockQdrant.hybridSearch).not.toHaveBeenCalled();
      expect(mockEmbedding.embed).not.toHaveBeenCalled();
    });

    it('CONFIDENTIAL: must use Ollama only, skip cache read and write', async () => {
      mockQdrant.isReady.mockReturnValue(true);
      mockEmbedding.embed.mockResolvedValue(new Array(768).fill(0.1));
      mockQdrant.hybridSearch.mockResolvedValue([]);
      mockTyphoon.generate.mockResolvedValue({
        answer: 'ลับมาก',
        usedFallbackModel: true,
      });

      const result = await service.query(dto, adminPerms);

      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(mockRedis.setex).not.toHaveBeenCalled();
      expect(mockTyphoon.generate).toHaveBeenCalledWith(
        expect.any(String),
        true
      );
      expect(result.usedFallbackModel).toBe(true);
    });

    it('collectionReady=false → throw ServiceUnavailableException RAG_NOT_READY', async () => {
      mockQdrant.isReady.mockReturnValue(false);

      await expect(service.query(dto, memberPerms)).rejects.toThrow(
        ServiceUnavailableException
      );
    });

    it('cross-project cache isolation: same question different projectPublicId → different cache key', async () => {
      mockQdrant.isReady.mockReturnValue(true);
      mockRedis.get.mockResolvedValue(null);
      mockEmbedding.embed.mockResolvedValue(new Array(768).fill(0.1));
      mockQdrant.hybridSearch.mockResolvedValue([]);
      mockTyphoon.generate.mockResolvedValue({
        answer: 'A',
        usedFallbackModel: false,
      });

      await service.query(
        { question: 'Q?', projectPublicId: 'proj-A' },
        memberPerms
      );
      await service.query(
        { question: 'Q?', projectPublicId: 'proj-B' },
        memberPerms
      );

      const calls = mockRedis.setex.mock.calls as [string, ...unknown[]][];
      expect(calls[0][0]).not.toBe(calls[1][0]);
    });

    it('classification ceiling derived from role, not from request body', async () => {
      mockQdrant.isReady.mockReturnValue(true);
      mockRedis.get.mockResolvedValue(null);
      mockEmbedding.embed.mockResolvedValue(new Array(768).fill(0.1));
      mockQdrant.hybridSearch.mockResolvedValue([]);
      mockTyphoon.generate.mockResolvedValue({
        anwer: 'ok',
        usedFallbackModel: false,
      });

      await service.query(dto, memberPerms);
      expect(mockQdrant.hybridSearch).toHaveBeenCalledWith(
        expect.any(Array),
        dto.projectPublicId,
        'INTERNAL',
        20
      );

      jest.clearAllMocks();
      mockQdrant.isReady.mockReturnValue(true);
      mockRedis.get.mockResolvedValue(null);
      mockEmbedding.embed.mockResolvedValue(new Array(768).fill(0.1));
      mockQdrant.hybridSearch.mockResolvedValue([]);
      mockTyphoon.generate.mockResolvedValue({
        answer: 'ok',
        usedFallbackModel: true,
      });

      await service.query(dto, adminPerms);
      expect(mockQdrant.hybridSearch).toHaveBeenCalledWith(
        expect.any(Array),
        dto.projectPublicId,
        'CONFIDENTIAL',
        20
      );
    });
  });
});
