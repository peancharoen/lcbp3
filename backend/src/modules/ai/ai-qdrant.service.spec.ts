// File: backend/src/modules/ai/ai-qdrant.service.spec.ts
// Change Log:
// - 2026-06-05: สร้าง unit test สำหรับ AiQdrantService ครอบคลุม deleteByDocumentPublicId (T4)
// - 2026-09-15: Extended with search, searchByProject, upsert, checkHealth, ensureCollection tests

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiQdrantService } from './qdrant.service';

describe('AiQdrantService', () => {
  let service: AiQdrantService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'AI_QDRANT_URL' || key === 'QDRANT_URL') {
        return 'http://localhost:6333';
      }
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiQdrantService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AiQdrantService>(AiQdrantService);
  });

  /**
   * Helper: เข้าถึง QdrantClient mock ภายใน service
   * ใช้ unknown narrowing แทน any เพื่อปฏิบัติตาม strict TypeScript rules
   */
  function getClientMock(): Record<string, jest.Mock> {
    const internal = service as unknown as {
      client: Record<string, jest.Mock>;
    };
    return internal.client;
  }

  it('ควรถูกสร้างขึ้นสำเร็จ', () => {
    expect(service).toBeDefined();
  });

  describe('deleteByDocumentPublicId', () => {
    it('ควร throw error ถ้า projectPublicId ว่าง', async () => {
      await expect(
        service.deleteByDocumentPublicId('', 'doc-uuid-123')
      ).rejects.toThrow('AI_QDRANT_PROJECT_SCOPE_REQUIRED');
    });

    it('ควร throw error ถ้า projectPublicId เป็น undefined', async () => {
      await expect(
        service.deleteByDocumentPublicId(
          undefined as unknown as string,
          'doc-uuid-123'
        )
      ).rejects.toThrow('AI_QDRANT_PROJECT_SCOPE_REQUIRED');
    });

    it('ควรเรียก Qdrant delete ด้วย filter ที่ถูกต้อง (project_public_id + doc_public_id)', async () => {
      const mockDelete = jest.fn().mockResolvedValue(undefined);
      getClientMock().delete = mockDelete;

      await service.deleteByDocumentPublicId('proj-uuid-456', 'doc-uuid-123');

      expect(mockDelete).toHaveBeenCalledWith('lcbp3_vectors', {
        wait: true,
        filter: {
          must: [
            { key: 'project_public_id', match: { value: 'proj-uuid-456' } },
            { key: 'doc_public_id', match: { value: 'doc-uuid-123' } },
          ],
        },
      });
    });
  });

  describe('search', () => {
    it('ควร throw error ถ้า projectPublicId ว่าง', async () => {
      await expect(
        service.search('', [0.1, 0.2], undefined, 5)
      ).rejects.toThrow('AI_QDRANT_PROJECT_SCOPE_REQUIRED');
    });

    it('ควรเรียก client.query ด้วย bge_dense เมื่อไม่มี sparse vector (dense-only fallback)', async () => {
      const mockQuery = jest.fn().mockResolvedValue({
        points: [{ id: 'point-1', score: 0.95, payload: { doc_type: 'RFA' } }],
      });
      getClientMock().query = mockQuery;

      const results = await service.search(
        'proj-uuid',
        [0.1, 0.2],
        undefined,
        5
      );

      expect(mockQuery).toHaveBeenCalledWith(
        'lcbp3_vectors',
        expect.objectContaining({
          query: [0.1, 0.2],
          using: 'bge_dense',
          limit: 5,
          filter: {
            must: [{ key: 'project_public_id', match: { value: 'proj-uuid' } }],
          },
          with_payload: true,
        })
      );
      expect(results).toHaveLength(1);
      expect(results[0].pointId).toBe('point-1');
      expect(results[0].score).toBe(0.95);
    });

    it('ควรใช้ topK จากตัวเลขแทน sparseVector เมื่อส่ง number มา', async () => {
      const mockQuery = jest.fn().mockResolvedValue({ points: [] });
      getClientMock().query = mockQuery;

      await service.search('proj-uuid', [0.1], 10);

      expect(mockQuery).toHaveBeenCalledWith(
        'lcbp3_vectors',
        expect.objectContaining({ limit: 10 })
      );
    });

    it('ควรเรียก client.query เมื่อมี sparse vector (hybrid search)', async () => {
      const mockQuery = jest.fn().mockResolvedValue({
        points: [{ id: 'point-2', score: 0.88, payload: { doc_type: 'LTR' } }],
      });
      getClientMock().query = mockQuery;

      const sparseVec = { indices: [1, 2], values: [0.5, 0.3] };
      const results = await service.search(
        'proj-uuid',
        [0.1, 0.2],
        sparseVec,
        3
      );

      expect(mockQuery).toHaveBeenCalledWith(
        'lcbp3_vectors',
        expect.objectContaining({
          limit: 3,
          filter: {
            must: [{ key: 'project_public_id', match: { value: 'proj-uuid' } }],
          },
        })
      );
      expect(results).toHaveLength(1);
      expect(results[0].pointId).toBe('point-2');
    });

    it('ควร map score เป็น 0 เมื่อ result.score เป็น null/undefined', async () => {
      const mockQuery = jest.fn().mockResolvedValue({
        points: [{ id: 'point-1', score: null, payload: {} }],
      });
      getClientMock().query = mockQuery;

      const results = await service.search('proj-uuid', [0.1], undefined, 5);

      expect(results[0].score).toBe(0);
    });

    it('ควร map payload เป็น empty object เมื่อ result.payload เป็น null/undefined', async () => {
      const mockQuery = jest.fn().mockResolvedValue({
        points: [{ id: 'point-1', score: 0.5, payload: null }],
      });
      getClientMock().query = mockQuery;

      const results = await service.search('proj-uuid', [0.1], undefined, 5);

      expect(results[0].payload).toEqual({});
    });
  });

  describe('searchByProject', () => {
    it('ควรเรียก search แบบดั้งเดิม: (vector, projectPublicId, limit)', async () => {
      const searchSpy = jest.spyOn(service, 'search').mockResolvedValue([]);
      const mockClientSearch = jest.fn().mockResolvedValue([]);
      getClientMock().search = mockClientSearch;

      await service.searchByProject([0.1, 0.2], 'proj-uuid', 10);

      expect(searchSpy).toHaveBeenCalledWith(
        'proj-uuid',
        [0.1, 0.2],
        undefined,
        10
      );
      searchSpy.mockRestore();
    });

    it('ควรเรียก search แบบใหม่: (dense, sparse, projectPublicId, limit)', async () => {
      const searchSpy = jest.spyOn(service, 'search').mockResolvedValue([]);
      const mockClientSearch = jest.fn().mockResolvedValue([]);
      getClientMock().search = mockClientSearch;

      const sparseVec = { indices: [1], values: [0.5] };
      await service.searchByProject([0.1], sparseVec, 'proj-uuid', 5);

      expect(searchSpy).toHaveBeenCalledWith('proj-uuid', [0.1], sparseVec, 5);
      searchSpy.mockRestore();
    });
  });

  describe('upsert', () => {
    it('ควร throw error ถ้า projectPublicId ว่าง', async () => {
      await expect(
        service.upsert('', [
          {
            id: 'point-1',
            vector: {
              bge_dense: [0.1],
              bge_sparse: { indices: [1], values: [0.5] },
            },
            payload: { doc_type: 'RFA' },
          },
        ])
      ).rejects.toThrow('AI_QDRANT_PROJECT_SCOPE_REQUIRED');
    });

    it('ควรเรียก client.upsert พร้อมเพิ่ม project_public_id ใน payload', async () => {
      const mockUpsert = jest.fn().mockResolvedValue(undefined);
      getClientMock().upsert = mockUpsert;

      const points = [
        {
          id: 'point-1',
          vector: {
            bge_dense: [0.1, 0.2],
            bge_sparse: { indices: [1], values: [0.5] },
          },
          payload: { doc_type: 'RFA' },
        },
      ];

      await service.upsert('proj-uuid', points);

      expect(mockUpsert).toHaveBeenCalledWith(
        'lcbp3_vectors',
        expect.objectContaining({
          wait: true,
          points: expect.arrayContaining([
            expect.objectContaining({
              payload: expect.objectContaining({
                doc_type: 'RFA',
                project_public_id: 'proj-uuid',
              }),
            }),
          ]),
        })
      );
    });
  });

  describe('checkHealth', () => {
    it('ควร return HEALTHY เมื่อ getCollections สำเร็จ', async () => {
      const mockGetCollections = jest.fn().mockResolvedValue({
        collections: [{ name: 'lcbp3_vectors' }, { name: 'test' }],
      });
      getClientMock().getCollections = mockGetCollections;

      const result = await service.checkHealth();

      expect(result.status).toBe('HEALTHY');
      expect(result.collections).toEqual(['lcbp3_vectors', 'test']);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('ควร return DOWN เมื่อ getCollections ล้มเหลว', async () => {
      const mockGetCollections = jest
        .fn()
        .mockRejectedValue(new Error('Connection refused'));
      getClientMock().getCollections = mockGetCollections;

      const result = await service.checkHealth();

      expect(result.status).toBe('DOWN');
      expect(result.error).toBe('Connection refused');
    });

    it('ควร return DEGRADED เมื่อ error คือ timeout', async () => {
      const mockGetCollections = jest
        .fn()
        .mockRejectedValue(new Error('Qdrant request timeout'));
      getClientMock().getCollections = mockGetCollections;

      const result = await service.checkHealth();

      expect(result.status).toBe('DEGRADED');
      expect(result.error).toContain('timeout');
    });
  });

  describe('ensureCollection', () => {
    it('ควรสร้าง collection เมื่อยังไม่มี', async () => {
      const mockGetCollections = jest.fn().mockResolvedValue({
        collections: [],
      });
      const mockCreateCollection = jest.fn().mockResolvedValue(undefined);
      const mockCreatePayloadIndex = jest.fn().mockResolvedValue(undefined);

      getClientMock().getCollections = mockGetCollections;
      getClientMock().createCollection = mockCreateCollection;
      getClientMock().createPayloadIndex = mockCreatePayloadIndex;

      await service.ensureCollection();

      expect(mockCreateCollection).toHaveBeenCalledWith(
        'lcbp3_vectors',
        expect.objectContaining({
          vectors: {
            bge_dense: { size: 1024, distance: 'Cosine' },
          },
          sparse_vectors: { bge_sparse: {} },
        })
      );
    });

    it('ควร skip recreation เมื่อ collection มีอยู่และเป็น Hybrid 1024 dims', async () => {
      const mockGetCollections = jest.fn().mockResolvedValue({
        collections: [{ name: 'lcbp3_vectors' }],
      });
      const mockGetCollection = jest.fn().mockResolvedValue({
        config: {
          params: {
            vectors: {
              bge_dense: { size: 1024 },
            },
            sparse_vectors: { bge_sparse: {} },
          },
        },
      });
      const mockCreatePayloadIndex = jest.fn().mockResolvedValue(undefined);
      const mockDeleteCollection = jest.fn();

      getClientMock().getCollections = mockGetCollections;
      getClientMock().getCollection = mockGetCollection;
      getClientMock().createPayloadIndex = mockCreatePayloadIndex;
      getClientMock().deleteCollection = mockDeleteCollection;

      await service.ensureCollection();

      expect(mockDeleteCollection).not.toHaveBeenCalled();
      expect(mockCreatePayloadIndex).toHaveBeenCalled();
    });
  });

  describe('scrollByProject', () => {
    it('ควร throw error ถ้า projectPublicId ว่าง', async () => {
      await expect(service.scrollByProject('', 100)).rejects.toThrow(
        'AI_QDRANT_PROJECT_SCOPE_REQUIRED'
      );
    });

    it('ควรเรียก scroll API พร้อม filter project_public_id', async () => {
      const mockScroll = jest.fn().mockResolvedValue({
        points: [
          { id: 'p1', payload: { doc_public_id: 'doc-1' } },
          { id: 'p2', payload: { doc_public_id: 'doc-2' } },
        ],
        next_page_offset: 'next-1',
      });
      getClientMock().scroll = mockScroll;

      const result = await service.scrollByProject('proj-uuid-1', 50);

      expect(mockScroll).toHaveBeenCalledWith('lcbp3_vectors', {
        limit: 50,
        with_payload: true,
        filter: {
          must: [{ key: 'project_public_id', match: { value: 'proj-uuid-1' } }],
        },
      });
      expect(result.points).toHaveLength(2);
      expect(result.nextOffset).toBe('next-1');
    });

    it('ควรส่ง offset เมื่อระบุ offsetPoint', async () => {
      const mockScroll = jest.fn().mockResolvedValue({
        points: [],
        next_page_offset: null,
      });
      getClientMock().scroll = mockScroll;

      await service.scrollByProject('proj-uuid-1', 100, 'offset-2');

      expect(mockScroll).toHaveBeenCalledWith(
        'lcbp3_vectors',
        expect.objectContaining({ offset: 'offset-2' })
      );
    });
  });

  describe('deleteByPointIds', () => {
    it('ควร no-op เมื่อ pointIds ว่าง', async () => {
      const mockDelete = jest.fn();
      getClientMock().delete = mockDelete;

      await service.deleteByPointIds([]);

      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('ควรเรียก delete API ด้วย points array', async () => {
      const mockDelete = jest.fn().mockResolvedValue(undefined);
      getClientMock().delete = mockDelete;

      await service.deleteByPointIds(['p1', 'p2', 'p3']);

      expect(mockDelete).toHaveBeenCalledWith('lcbp3_vectors', {
        wait: true,
        points: ['p1', 'p2', 'p3'],
      });
    });
  });

  // Feature 254 — Phase 4 US2 — T034
  // ADR-023A: Qdrant search ต้องบังคับ project_public_id filter เสมอ (multi-tenant isolation)
  // และ payload ต้องมี generation_uuid เพื่อให้ RagRetrievalService ตรวจ ACTIVE generation ได้
  describe('Feature 254 T034: mandatory project_public_id filter', () => {
    /**
     * TC1: search() ต้องแนบ project_public_id ใน Qdrant filter payload เสมอ
     * ไม่ว่าจะเป็น dense-only หรือ hybrid search
     */
    it('TC1: search() ควรแนบ project_public_id ใน Qdrant filter payload (dense-only)', async () => {
      const mockQuery = jest.fn().mockResolvedValue({ points: [] });
      getClientMock().query = mockQuery;

      await service.search('proj-uuid-t034', [0.1, 0.2], undefined, 5);

      const callArgs = mockQuery.mock.calls[0] as unknown[];
      const queryPayload = callArgs[1] as Record<string, unknown>;
      const filter = queryPayload.filter as {
        must: Array<{ key: string; match: { value: string } }>;
      };

      expect(filter).toBeDefined();
      expect(filter.must).toBeDefined();
      expect(filter.must).toHaveLength(1);
      expect(filter.must[0].key).toBe('project_public_id');
      expect(filter.must[0].match.value).toBe('proj-uuid-t034');
    });

    it('TC1b: search() ควรแนบ project_public_id ใน Qdrant filter payload (hybrid)', async () => {
      const mockQuery = jest.fn().mockResolvedValue({ points: [] });
      getClientMock().query = mockQuery;

      const sparseVec = { indices: [1, 2], values: [0.5, 0.3] };
      await service.search('proj-uuid-t034', [0.1, 0.2], sparseVec, 5);

      const callArgs = mockQuery.mock.calls[0] as unknown[];
      const queryPayload = callArgs[1] as Record<string, unknown>;
      const filter = queryPayload.filter as {
        must: Array<{ key: string; match: { value: string } }>;
      };

      expect(filter).toBeDefined();
      expect(filter.must).toBeDefined();
      expect(filter.must[0].key).toBe('project_public_id');
      expect(filter.must[0].match.value).toBe('proj-uuid-t034');
    });

    /**
     * TC2: search() ต้อง throw เมื่อ projectPublicId ขาดหรือว่าง
     * ป้องกัน cross-project data leakage (ADR-023A hard requirement)
     */
    it('TC2: search() ควร throw เมื่อ projectPublicId เป็น empty string', async () => {
      await expect(
        service.search('', [0.1, 0.2], undefined, 5)
      ).rejects.toThrow('AI_QDRANT_PROJECT_SCOPE_REQUIRED');
    });

    it('TC2b: search() ควร throw เมื่อ projectPublicId เป็น undefined', async () => {
      await expect(
        service.search(undefined as unknown as string, [0.1, 0.2], undefined, 5)
      ).rejects.toThrow('AI_QDRANT_PROJECT_SCOPE_REQUIRED');
    });

    it('TC2c: search() ควร throw เมื่อ projectPublicId เป็น whitespace-only string', async () => {
      // whitespace-only string ผ่าน !projectPublicId check ไม่ได้ (truthy) —
      // แต่ ADR-023A บังคับว่า project scope ต้องไม่ว่าง
      // หาก implementation ปัจจุบันยังไม่ trim จะถือว่าเป็น gap (RED)
      await expect(
        service.search('   ', [0.1, 0.2], undefined, 5)
      ).rejects.toThrow('AI_QDRANT_PROJECT_SCOPE_REQUIRED');
    });

    /**
     * TC3: filter ต้องเป็น `must` (mandatory) ไม่ใช่ `should` (optional)
     * หากเป็น `should` แล้ว Qdrant อาจคืน results จากโครงการอื่นได้
     */
    it('TC3: search() ต้องใช้ must filter (ไม่ใช่ should) เพื่อกัน cross-project results', async () => {
      const mockQuery = jest.fn().mockResolvedValue({ points: [] });
      getClientMock().query = mockQuery;

      await service.search('proj-uuid-t034', [0.1, 0.2], undefined, 5);

      const callArgs = mockQuery.mock.calls[0] as unknown[];
      const queryPayload = callArgs[1] as Record<string, unknown>;
      const filter = queryPayload.filter as Record<string, unknown>;

      // must ต้องมี, should ต้องไม่มี (มิฉะนั้น filter เป็น optional คืน cross-project ได้)
      expect(filter.must).toBeDefined();
      expect(filter.should).toBeUndefined();
      expect(filter.must).toEqual([
        { key: 'project_public_id', match: { value: 'proj-uuid-t034' } },
      ]);
    });

    it('TC3b: search() hybrid ต้องใช้ must filter เช่นกัน', async () => {
      const mockQuery = jest.fn().mockResolvedValue({ points: [] });
      getClientMock().query = mockQuery;

      const sparseVec = { indices: [1], values: [0.5] };
      await service.search('proj-uuid-t034', [0.1], sparseVec, 3);

      const callArgs = mockQuery.mock.calls[0] as unknown[];
      const queryPayload = callArgs[1] as Record<string, unknown>;
      const filter = queryPayload.filter as Record<string, unknown>;

      expect(filter.must).toBeDefined();
      expect(filter.should).toBeUndefined();
    });

    /**
     * TC4: upsert/search payload ต้องมี generation_uuid เพื่อให้ RagRetrievalService
     * ตรวจ ACTIVE generation ได้ (ADR-023A ACTIVE-generation validation)
     */
    it('TC4: upsert() ต้อง preserve generation_uuid ใน payload ที่ส่งไป Qdrant', async () => {
      const mockUpsert = jest.fn().mockResolvedValue(undefined);
      getClientMock().upsert = mockUpsert;

      const generationUuid = 'gen-uuid-active-t034';
      const points = [
        {
          id: 'point-t034',
          vector: {
            bge_dense: [0.1, 0.2],
            bge_sparse: { indices: [1], values: [0.5] },
          },
          payload: {
            chunk_public_id: 'chunk-t034',
            generation_uuid: generationUuid,
            attachment_public_id: 'att-t034',
            owner_type: 'CORRESPONDENCE',
            owner_public_id: 'corr-t034',
            classification: 'INTERNAL',
          },
        },
      ];

      await service.upsert('proj-uuid-t034', points);

      expect(mockUpsert).toHaveBeenCalledWith(
        'lcbp3_vectors',
        expect.objectContaining({
          wait: true,
          points: expect.arrayContaining([
            expect.objectContaining({
              payload: expect.objectContaining({
                generation_uuid: generationUuid,
                project_public_id: 'proj-uuid-t034',
                chunk_public_id: 'chunk-t034',
              }),
            }),
          ]),
        })
      );
    });

    it('TC4b: search() ต้องคืน payload ที่มี generation_uuid (with_payload: true)', async () => {
      const generationUuid = 'gen-uuid-active-t034';
      const mockQuery = jest.fn().mockResolvedValue({
        points: [
          {
            id: 'point-t034',
            score: 0.92,
            payload: {
              chunk_public_id: 'chunk-t034',
              generation_uuid: generationUuid,
              project_public_id: 'proj-uuid-t034',
            },
          },
        ],
      });
      getClientMock().query = mockQuery;

      const results = await service.search(
        'proj-uuid-t034',
        [0.1, 0.2],
        undefined,
        5
      );

      // with_payload ต้องเป็น true เพื่อให้ RagRetrievalService อ่าน generation_uuid ได้
      const callArgs = mockQuery.mock.calls[0] as unknown[];
      const queryPayload = callArgs[1] as Record<string, unknown>;
      expect(queryPayload.with_payload).toBe(true);

      // result payload ต้องมี generation_uuid ส่งต่อให้ retrieval layer
      expect(results).toHaveLength(1);
      expect(results[0].payload.generation_uuid).toBe(generationUuid);
    });
  });
});
