// File: backend/tests/integration/cross-spec/qdrant-isolation.spec.ts
// Change Log:
// - 2026-05-16: Cross-spec integration test for QdrantService projectPublicId isolation
// - 2026-05-16: Fixed mocking strategy to use factory pattern with proper method exposure

// Define types for Qdrant mock responses
interface QdrantSearchResult {
  id: string;
  payload: Record<string, unknown>;
  score: number;
}

// Create mock functions that can be spied on
const mockSearch = jest.fn();
const mockGetCollections = jest.fn().mockResolvedValue({ collections: [] });
const mockCreateCollection = jest.fn().mockResolvedValue(true);
const mockCreatePayloadIndex = jest.fn().mockResolvedValue(true);

// Mock QdrantClient before importing the service
jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => ({
    getCollections: mockGetCollections,
    createCollection: mockCreateCollection,
    createPayloadIndex: mockCreatePayloadIndex,
    search: mockSearch,
    delete: jest.fn().mockResolvedValue(true),
    upsert: jest.fn().mockResolvedValue(true),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AiQdrantService } from '../../../src/modules/ai/qdrant.service';
import { ConfigService } from '@nestjs/config';

describe('Cross-Spec: QdrantService Isolation', () => {
  let service: AiQdrantService;

  beforeEach(async () => {
    // Reset mocks before each test
    mockSearch.mockReset();
    mockGetCollections.mockResolvedValue({ collections: [] });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiQdrantService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                AI_QDRANT_URL: 'http://192.168.10.100:6333',
                QDRANT_URL: 'http://192.168.10.100:6333',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AiQdrantService>(AiQdrantService);
  });

  it('should enforce projectPublicId as required parameter in search', async () => {
    // Test that search() signature requires projectPublicId
    const searchMethod = service.search;

    // Get parameter names from function signature
    const fnStr = searchMethod.toString();

    // Assert: projectPublicId must be first parameter
    expect(fnStr).toContain('projectPublicId');

    // Act: Verify search calls Qdrant with projectPublicId filter
    const mockResponse = [
      {
        id: 'doc-1',
        payload: { document_public_id: 'doc-1', project_public_id: 'proj-a' },
        score: 0.95,
      },
    ];

    mockSearch.mockResolvedValue(mockResponse as QdrantSearchResult[]);

    await service.search('proj-a', [0.1, 0.2, 0.3], 5);

    // Assert: Qdrant client call includes project_public_id filter
    expect(mockSearch).toHaveBeenCalledWith(
      'lcbp3_vectors',
      expect.objectContaining({
        filter: {
          must: [{ key: 'project_public_id', match: { value: 'proj-a' } }],
        },
      })
    );
  });

  it('should isolate results between different projects', async () => {
    // Arrange: Mock Qdrant responses for two projects
    const projectAResponse = [
      { id: 'doc-a1', payload: { project_public_id: 'proj-a' }, score: 0.9 },
      { id: 'doc-a2', payload: { project_public_id: 'proj-a' }, score: 0.85 },
    ];

    const projectBResponse = [
      { id: 'doc-b1', payload: { project_public_id: 'proj-b' }, score: 0.92 },
    ];

    // Act: Query Project A
    mockSearch.mockResolvedValueOnce(projectAResponse as QdrantSearchResult[]);
    const resultA = await service.search('proj-a', [0.1, 0.2], 5);

    // Act: Query Project B
    mockSearch.mockResolvedValueOnce(projectBResponse as QdrantSearchResult[]);
    const resultB = await service.search('proj-b', [0.1, 0.2], 5);

    // Assert: Results are isolated by project
    expect(resultA.every((r) => r.payload.project_public_id === 'proj-a')).toBe(
      true
    );
    expect(resultB.every((r) => r.payload.project_public_id === 'proj-b')).toBe(
      true
    );

    // Assert: Different filters used for each project
    const call1 = mockSearch.mock.calls[0] as unknown[];
    const call2 = mockSearch.mock.calls[1] as unknown[];
    type FilterArg = { filter: { must: Array<{ match: { value: string } }> } };
    expect((call1[1] as FilterArg).filter.must[0].match.value).toBe('proj-a');
    expect((call2[1] as FilterArg).filter.must[0].match.value).toBe('proj-b');
  });

  it('should verify no rawSearch method exists (security)', () => {
    // Assert: No rawSearch method that bypasses projectPublicId filtering
    expect((service as Record<string, unknown>).rawSearch).toBeUndefined();
  });

  it('should handle RFA cross-spec usage correctly', async () => {
    // Simulate RFA feature using QdrantService for document context
    const mockEmbedding: number[] = new Array(768).fill(0.1);

    const mockResponse = [
      {
        id: 'related-doc-1',
        payload: {
          document_public_id: 'rel-1',
          project_public_id: 'shared-proj',
          content_preview: 'Related document content',
        },
        score: 0.88,
      },
    ];

    mockSearch.mockResolvedValue(mockResponse as QdrantSearchResult[]);

    // RFA feature queries for related documents
    const result = await service.search('shared-proj', mockEmbedding, 5);

    // Assert: Results are scoped to project
    expect(result[0].payload.project_public_id).toBe('shared-proj');

    // Assert: Filter was applied
    expect(mockSearch).toHaveBeenCalledWith(
      'lcbp3_vectors',
      expect.objectContaining({
        filter: {
          must: [{ key: 'project_public_id', match: { value: 'shared-proj' } }],
        },
      })
    );
  });
});
