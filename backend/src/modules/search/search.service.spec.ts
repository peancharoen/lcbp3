// File: backend/src/modules/search/search.service.spec.ts
// Change Log:
// - 2026-06-20: Initial creation — unit tests สำหรับ SearchService

import { Test, TestingModule } from '@nestjs/testing';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { SearchService } from './search.service';

/** Type สำหรับ mock ElasticsearchService */
type MockEsService = {
  ping: jest.Mock;
  indices: {
    exists: jest.Mock;
    create: jest.Mock;
  };
  index: jest.Mock;
  delete: jest.Mock;
  search: jest.Mock;
};

describe('SearchService', () => {
  let service: SearchService;
  let mockEsService: MockEsService;
  let mockConfigService: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockEsService = {
      ping: jest.fn(),
      indices: {
        exists: jest.fn(),
        create: jest.fn(),
      },
      index: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
    };
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'ELASTICSEARCH_NODE') return 'http://localhost:9200';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: ElasticsearchService, useValue: mockEsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should set isElasticsearchAvailable=true when ping succeeds', async () => {
      mockEsService.ping.mockResolvedValue(true);
      mockEsService.indices.exists.mockResolvedValue(true);

      await service.onModuleInit();

      // Verify search works (isElasticsearchAvailable should be true)
      mockEsService.search.mockResolvedValue({
        hits: { hits: [], total: 0 },
        took: 5,
      });
      const result = await service.search({ q: 'test' });
      expect(result.meta.total).toBe(0);
    });

    it('should set isElasticsearchAvailable=false when ping fails', async () => {
      mockEsService.ping.mockRejectedValue(new Error('Connection refused'));

      await service.onModuleInit();

      // Search should return empty when ES is not available
      const result = await service.search({ q: 'test' });
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('should create index when it does not exist', async () => {
      mockEsService.ping.mockResolvedValue(true);
      mockEsService.indices.exists.mockResolvedValue(false);
      mockEsService.indices.create.mockResolvedValue(true);

      await service.onModuleInit();

      expect(mockEsService.indices.create).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'dms_documents',
        })
      );
    });

    it('should not create index when it already exists', async () => {
      mockEsService.ping.mockResolvedValue(true);
      mockEsService.indices.exists.mockResolvedValue(true);

      await service.onModuleInit();

      expect(mockEsService.indices.create).not.toHaveBeenCalled();
    });

    it('should handle index creation error gracefully', async () => {
      mockEsService.ping.mockResolvedValue(true);
      mockEsService.indices.exists.mockResolvedValue(false);
      mockEsService.indices.create.mockRejectedValue(
        new Error('Index creation failed')
      );

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('indexDocument', () => {
    beforeEach(async () => {
      mockEsService.ping.mockResolvedValue(true);
      mockEsService.indices.exists.mockResolvedValue(true);
      await service.onModuleInit();
    });

    it('should index a document with publicId', async () => {
      const doc = {
        type: 'correspondence',
        publicId: 'uuid-123',
        title: 'Test Doc',
      };
      mockEsService.index.mockResolvedValue({ result: 'created' });

      const result = await service.indexDocument(doc);

      expect(mockEsService.index).toHaveBeenCalledWith({
        index: 'dms_documents',
        id: 'correspondence_uuid-123',
        document: doc,
      });
      expect(result).toEqual({ result: 'created' });
    });

    it('should index a document with numeric id when no publicId', async () => {
      const doc = {
        type: 'rfa',
        id: 42,
        title: 'Test RFA',
      };
      mockEsService.index.mockResolvedValue({ result: 'created' });

      await service.indexDocument(doc);

      expect(mockEsService.index).toHaveBeenCalledWith({
        index: 'dms_documents',
        id: 'rfa_42',
        document: doc,
      });
    });

    it('should handle indexing errors gracefully', async () => {
      mockEsService.index.mockRejectedValue(new Error('ES error'));

      const result = await service.indexDocument({
        type: 'correspondence',
        id: 1,
      });

      expect(result).toBeUndefined();
    });
  });

  describe('removeDocument', () => {
    beforeEach(async () => {
      mockEsService.ping.mockResolvedValue(true);
      mockEsService.indices.exists.mockResolvedValue(true);
      await service.onModuleInit();
    });

    it('should remove a document from index', async () => {
      mockEsService.delete.mockResolvedValue({ result: 'deleted' });

      await service.removeDocument('correspondence', 42);

      expect(mockEsService.delete).toHaveBeenCalledWith({
        index: 'dms_documents',
        id: 'correspondence_42',
      });
    });

    it('should handle removal errors gracefully', async () => {
      mockEsService.delete.mockRejectedValue(new Error('Not found'));

      await expect(
        service.removeDocument('correspondence', 999)
      ).resolves.not.toThrow();
    });
  });

  describe('search', () => {
    it('should return empty result when ES is not available', async () => {
      mockEsService.ping.mockRejectedValue(new Error('Connection refused'));
      await service.onModuleInit();

      const result = await service.search({ q: 'test' });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.took).toBe(0);
    });

    it('should search with query string', async () => {
      mockEsService.ping.mockResolvedValue(true);
      mockEsService.indices.exists.mockResolvedValue(true);
      await service.onModuleInit();

      const mockHits = [
        { _source: { id: 1, title: 'Test Doc' } },
        { _source: { id: 2, title: 'Test Doc 2' } },
      ];
      mockEsService.search.mockResolvedValue({
        hits: { hits: mockHits, total: 2 },
        took: 10,
      });

      const result = await service.search({ q: 'test', page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.took).toBe(10);
      expect(mockEsService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'dms_documents',
          from: 0,
          size: 20,
        })
      );
    });

    it('should search with match_all when no query string', async () => {
      mockEsService.ping.mockResolvedValue(true);
      mockEsService.indices.exists.mockResolvedValue(true);
      await service.onModuleInit();

      mockEsService.search.mockResolvedValue({
        hits: { hits: [], total: 0 },
        took: 5,
      });

      await service.search({ page: 1, limit: 20 });

      expect(mockEsService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              must: [{ match_all: {} }],
            }),
          }),
        })
      );
    });

    it('should apply type, status, and projectId filters', async () => {
      mockEsService.ping.mockResolvedValue(true);
      mockEsService.indices.exists.mockResolvedValue(true);
      await service.onModuleInit();

      mockEsService.search.mockResolvedValue({
        hits: { hits: [], total: 0 },
        took: 5,
      });

      await service.search({
        q: 'test',
        type: 'correspondence',
        status: 'DRAFT',
        projectId: 5,
      });

      const callArgs = (
        mockEsService.search.mock.calls[0] as unknown[]
      )[0] as Record<string, unknown>;
      const query = callArgs.query as { bool: { filter: unknown[] } };
      expect(query.bool.filter).toHaveLength(3);
    });

    it('should calculate from offset correctly', async () => {
      mockEsService.ping.mockResolvedValue(true);
      mockEsService.indices.exists.mockResolvedValue(true);
      await service.onModuleInit();

      mockEsService.search.mockResolvedValue({
        hits: { hits: [], total: 0 },
        took: 5,
      });

      await service.search({ q: 'test', page: 3, limit: 10 });

      expect(mockEsService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 20,
          size: 10,
        })
      );
    });

    it('should handle total as object with value property', async () => {
      mockEsService.ping.mockResolvedValue(true);
      mockEsService.indices.exists.mockResolvedValue(true);
      await service.onModuleInit();

      mockEsService.search.mockResolvedValue({
        hits: { hits: [], total: { value: 100, relation: 'eq' } },
        took: 5,
      });

      const result = await service.search({ q: 'test' });

      expect(result.meta.total).toBe(100);
    });

    it('should handle search errors gracefully', async () => {
      mockEsService.ping.mockResolvedValue(true);
      mockEsService.indices.exists.mockResolvedValue(true);
      await service.onModuleInit();

      mockEsService.search.mockRejectedValue(new Error('Search failed'));

      const result = await service.search({ q: 'test' });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.took).toBe(0);
    });

    it('should use default page and limit', async () => {
      mockEsService.ping.mockResolvedValue(true);
      mockEsService.indices.exists.mockResolvedValue(true);
      await service.onModuleInit();

      mockEsService.search.mockResolvedValue({
        hits: { hits: [], total: 0 },
        took: 5,
      });

      const result = await service.search({});

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });
  });
});
